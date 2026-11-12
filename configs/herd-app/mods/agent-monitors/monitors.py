#!/usr/bin/env python3
"""Lists the monitors, loops and cron jobs armed in every live Claude Code session.

Claude Code keeps these in memory, so the only durable trace is the session transcript:
Monitor / CronCreate / ScheduleWakeup calls start them; task notifications, TaskStop,
CronDelete, ScheduleWakeup {stop} and their own clocks end them.
"""
import argparse
import calendar
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

OUTPUT_VERSION = 1
CACHE_VERSION = 1
TEXT_CAP = 240
TITLE_TAIL_BYTES = 262144
RECENT_MS = 15 * 60 * 1000
CRON_LIFE_MS = 7 * 24 * 3600 * 1000
FIRE_GRACE_MS = 2 * 60 * 1000
LOOP_RUN_MS = 10 * 60 * 1000
PENDING_MS = 3600 * 1000
WAKE_MIN_S, WAKE_MAX_S = 60, 3600
CRON_SCAN_MINUTES = 8 * 24 * 60

ENDING_STATUSES = {'completed', 'failed', 'killed', 'stopped', 'error', 'timeout', 'expired', 'cancelled', 'canceled'}
WATCHED_TOOLS = ('Monitor', 'CronCreate', 'CronDelete', 'TaskStop', 'ScheduleWakeup')
TOOL_MARKERS = tuple(('"name":"%s"' % name).encode() for name in WATCHED_TOOLS)
NOTIFICATION_MARKER = b'<task-notification>'
LOOP_PROMPT = re.compile(r'^(/loop\b|<<autonomous-loop)')

NOTIFICATION = re.compile(r'<task-notification>(.*?)</task-notification>', re.S)
TASK_ID = re.compile(r'<task-id>([^<]+)</task-id>')
STATUS = re.compile(r'<status>([^<]+)</status>')
EVENT = re.compile(r'<event>(.*?)</event>', re.S)
PROC_START = re.compile(r'([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})|(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})')


def claude_home():
    return os.environ.get('CLAUDE_CONFIG_DIR') or os.path.join(os.path.expanduser('~'), '.claude')


def clip(text, cap=TEXT_CAP):
    text = ' '.join(str(text or '').split())
    return text if len(text) <= cap else text[:cap - 1] + '…'


def iso_to_ms(stamp):
    if not isinstance(stamp, str) or len(stamp) < 19:
        return None
    try:
        seconds = calendar.timegm((int(stamp[0:4]), int(stamp[5:7]), int(stamp[8:10]),
                                   int(stamp[11:13]), int(stamp[14:16]), int(stamp[17:19])))
    except ValueError:
        return None
    fraction = re.match(r'\.(\d{1,3})', stamp[19:])
    return seconds * 1000 + (int(fraction.group(1).ljust(3, '0')) if fraction else 0)


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def read_json(path):
    try:
        with open(path, 'rb') as handle:
            return json.loads(handle.read())
    except (OSError, ValueError):
        return None


# ---- cron expressions -------------------------------------------------------------------------

def cron_field(text, low, high):
    values = set()
    for part in text.split(','):
        step = 1
        if '/' in part:
            part, step_text = part.split('/', 1)
            step = int(step_text)
        if part in ('*', ''):
            start, end = low, high
        elif '-' in part:
            start, end = (int(x) for x in part.split('-', 1))
        else:
            start = int(part)
            end = high if step > 1 else start
        values.update(range(start, end + 1, step))
    return values


def parse_cron(expression):
    fields = expression.split()
    if len(fields) != 5:
        return None
    try:
        minute, hour, dom, month, dow = (cron_field(f, lo, hi) for f, (lo, hi)
                                         in zip(fields, ((0, 59), (0, 23), (1, 31), (1, 12), (0, 7))))
    except ValueError:
        return None
    dow = {0 if d == 7 else d for d in dow}
    return {'minute': minute, 'hour': hour, 'dom': dom, 'month': month, 'dow': dow,
            'dom_any': fields[2] == '*', 'dow_any': fields[4] == '*'}


def cron_matches(spec, moment):
    if moment.tm_min not in spec['minute'] or moment.tm_hour not in spec['hour'] or moment.tm_mon not in spec['month']:
        return False
    day_ok = moment.tm_mday in spec['dom']
    weekday_ok = ((moment.tm_wday + 1) % 7) in spec['dow']
    if spec['dom_any'] or spec['dow_any']:
        return day_ok and weekday_ok
    return day_ok or weekday_ok


def next_cron_ms(expression, after_ms):
    spec = parse_cron(expression or '')
    if spec is None:
        return None
    minute_s = (int(after_ms // 1000) // 60 + 1) * 60
    for step in range(CRON_SCAN_MINUTES):
        at = minute_s + step * 60
        if cron_matches(spec, time.localtime(at)):
            return at * 1000
    return None


# ---- transcript scan --------------------------------------------------------------------------

def new_state():
    return {'offset': 0, 'ino': None, 'pending': {}, 'monitors': {}, 'crons': {}, 'wakeups': [], 'loopStopAt': None}


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(block.get('text', '') for block in content if isinstance(block, dict))
    return ''


def end_item(item, at, by):
    if item is not None and item.get('endedAt') is None:
        item['endedAt'] = at
        item['endedBy'] = by


def scan_notifications(state, text, at, count_events):
    for body in NOTIFICATION.findall(text):
        ids = [task for task in TASK_ID.findall(body) if not task.startswith('__')]
        status = (STATUS.search(body) or [None, None])[1]
        event = EVENT.search(body)
        for task in ids:
            monitor = state['monitors'].get(task)
            if monitor is None:
                continue
            if count_events and event:
                monitor['events'] += 1
                monitor['lastEvent'] = clip(event.group(1))
                monitor['lastEventAt'] = at
            if status and status.strip().lower() in ENDING_STATUSES:
                end_item(monitor, at, status.strip().lower())


def wake_time(at, tool_input):
    delay = number(tool_input.get('delaySeconds'))
    if delay is None:
        return None
    return at + int(min(max(delay, WAKE_MIN_S), WAKE_MAX_S) * 1000)


def scan_tool_use(state, block, at):
    name, tool_input = block.get('name'), block.get('input') or {}
    if name not in WATCHED_TOOLS or not isinstance(tool_input, dict):
        return
    state['pending'][block.get('id')] = {'name': name, 'input': tool_input, 'at': at}
    if name == 'ScheduleWakeup':
        if tool_input.get('stop') is True:
            state['loopStopAt'] = at
            return
        next_at = wake_time(at, tool_input)
        if next_at is not None:
            state['wakeups'] = (state['wakeups'] + [{
                'use': block.get('id'), 'at': at, 'nextAt': next_at,
                'reason': clip(tool_input.get('reason')), 'prompt': clip(tool_input.get('prompt'), 120),
            }])[-4:]


def scan_tool_result(state, block, result, at):
    call = state['pending'].pop(block.get('tool_use_id'), None)
    if call is None:
        return
    name, tool_input = call['name'], call['input']
    failed = bool(block.get('is_error'))
    result = result if isinstance(result, dict) else {}
    if name == 'ScheduleWakeup':
        if failed:
            state['wakeups'] = [w for w in state['wakeups'] if w['use'] != block.get('tool_use_id')]
        elif number(result.get('scheduledFor')):
            for wakeup in state['wakeups']:
                if wakeup['use'] == block.get('tool_use_id'):
                    wakeup['nextAt'] = int(result['scheduledFor'])
        return
    if failed:
        return
    if name == 'Monitor' and result.get('taskId'):
        timeout = number(result.get('timeoutMs')) or number(tool_input.get('timeout_ms'))
        persistent = bool(result.get('persistent'))
        ws = tool_input.get('ws') if isinstance(tool_input.get('ws'), dict) else None
        state['monitors'][result['taskId']] = {
            'label': clip(tool_input.get('description'), 140) or 'Monitor',
            'detail': clip(tool_input.get('command') or (ws or {}).get('url')),
            'source': 'ws' if ws else 'command',
            'startedAt': call['at'], 'persistent': persistent,
            'deadlineAt': None if persistent or not timeout else call['at'] + int(timeout),
            'events': 0, 'lastEvent': None, 'lastEventAt': None, 'endedAt': None, 'endedBy': None,
        }
    elif name == 'CronCreate' and result.get('id'):
        state['crons'][result['id']] = {
            'schedule': tool_input.get('cron') or result.get('humanSchedule'),
            'prompt': clip(tool_input.get('prompt')),
            'recurring': result.get('recurring', tool_input.get('recurring', True)) is not False,
            'firstAt': number(result.get('nextFireAt')),
            'startedAt': call['at'], 'endedAt': None, 'endedBy': None,
        }
    elif name == 'CronDelete':
        end_item(state['crons'].get(tool_input.get('id')), at, 'canceled')
    elif name == 'TaskStop':
        end_item(state['monitors'].get(result.get('task_id') or tool_input.get('task_id')), at, 'stopped')


def scan_line(state, line):
    if not (NOTIFICATION_MARKER in line or any(marker in line for marker in TOOL_MARKERS)
            or (state['pending'] and b'tool_result' in line
                and any(use_id.encode() in line for use_id in state['pending'] if use_id))):
        return
    try:
        row = json.loads(line)
    except ValueError:
        return
    kind, at = row.get('type'), iso_to_ms(row.get('timestamp'))
    if at is None:
        return
    if kind == 'queue-operation':
        if row.get('operation') == 'enqueue':
            scan_notifications(state, text_of(row.get('content')), at, True)
        return
    if kind == 'attachment':
        attachment = row.get('attachment') or {}
        if attachment.get('type') == 'queued_command':
            scan_notifications(state, text_of(attachment.get('prompt')), at, False)
        return
    message = row.get('message') or {}
    content = message.get('content')
    if kind == 'user' and isinstance(content, str):
        scan_notifications(state, content, at, False)
        return
    if not isinstance(content, list):
        return
    for block in content:
        if not isinstance(block, dict):
            continue
        if kind == 'assistant' and block.get('type') == 'tool_use':
            scan_tool_use(state, block, at)
        elif kind == 'user' and block.get('type') == 'tool_result':
            scan_tool_result(state, block, row.get('toolUseResult'), at)
        elif kind == 'user' and block.get('type') == 'text':
            scan_notifications(state, block.get('text', ''), at, False)


def refresh_state(state, path):
    try:
        info = os.stat(path)
    except OSError:
        return state
    if state.get('ino') != info.st_ino or info.st_size < state.get('offset', 0):
        state = new_state()
        state['ino'] = info.st_ino
    if info.st_size == state['offset']:
        return state
    with open(path, 'rb') as handle:
        handle.seek(state['offset'])
        chunk = handle.read()
    end = chunk.rfind(b'\n')
    if end < 0:
        return state
    for line in chunk[:end].split(b'\n'):
        if line:
            scan_line(state, line)
    state['offset'] += end + 1
    return state


def prune(state, now):
    state['pending'] = {k: v for k, v in state['pending'].items() if now - v['at'] < PENDING_MS}
    for bucket in ('monitors', 'crons'):
        state[bucket] = {k: v for k, v in state[bucket].items()
                         if v.get('endedAt') is None or now - v['endedAt'] < RECENT_MS}


# ---- deriving what is armed now ---------------------------------------------------------------

def monitor_items(state, now):
    items = []
    for task, m in state['monitors'].items():
        ended_at, ended_by = m['endedAt'], m['endedBy']
        if ended_at is None and m['deadlineAt'] is not None and now >= m['deadlineAt']:
            ended_at, ended_by = m['deadlineAt'], 'expired'
        items.append({
            'id': task, 'kind': 'monitor', 'label': m['label'], 'detail': m['detail'], 'source': m['source'],
            'status': 'ended' if ended_at is not None else 'running',
            'startedAt': m['startedAt'], 'deadlineAt': m['deadlineAt'], 'persistent': m['persistent'],
            'events': m['events'], 'lastEvent': m['lastEvent'], 'lastEventAt': m['lastEventAt'],
            'endedAt': ended_at, 'endedBy': ended_by,
        })
    return items


def cron_items(state, now):
    items = []
    for job, c in state['crons'].items():
        ended_at, ended_by = c['endedAt'], c['endedBy']
        expires_at = c['startedAt'] + CRON_LIFE_MS if c['recurring'] else None
        if c['recurring']:
            next_at = next_cron_ms(c['schedule'], now)
            if ended_at is None and now >= expires_at:
                ended_at, ended_by = expires_at, 'expired'
        else:
            next_at = c['firstAt'] if c['firstAt'] is not None else next_cron_ms(c['schedule'], c['startedAt'])
            if ended_at is None and next_at is not None and now >= next_at + FIRE_GRACE_MS:
                ended_at, ended_by = next_at, 'fired'
        loop = bool(LOOP_PROMPT.match(c['prompt'] or ''))
        items.append({
            'id': job, 'kind': 'loop' if loop else 'cron', 'via': 'cron',
            'label': c['prompt'] or c['schedule'], 'detail': c['prompt'], 'schedule': c['schedule'],
            'recurring': c['recurring'], 'status': 'ended' if ended_at is not None else 'armed',
            'startedAt': c['startedAt'], 'nextAt': None if ended_at is not None else next_at,
            'expiresAt': expires_at, 'endedAt': ended_at, 'endedBy': ended_by,
        })
    return items


def loop_items(state, now, last_activity):
    if not state['wakeups']:
        return []
    wake = state['wakeups'][-1]
    stop_at = state['loopStopAt']
    ended_at = ended_by = None
    status = 'sleeping'
    if stop_at is not None and stop_at >= wake['at']:
        ended_at, ended_by = stop_at, 'stopped'
    elif now < wake['nextAt']:
        status = 'sleeping'
    elif last_activity >= wake['nextAt'] and now - last_activity < LOOP_RUN_MS:
        status = 'running'
    elif now - wake['nextAt'] < FIRE_GRACE_MS:
        status = 'due'
    else:
        ended_at, ended_by = max(wake['nextAt'], last_activity), 'finished'
    prompt = wake['prompt'] or ''
    label = wake['reason'] or ('autonomous loop' if prompt.startswith('<<') else prompt) or 'loop'
    return [{
        'id': 'wakeup:%d' % wake['nextAt'], 'kind': 'loop', 'via': 'wakeup', 'label': label,
        'detail': '' if prompt.startswith('<<') else prompt, 'status': 'ended' if ended_at else status,
        'startedAt': wake['at'], 'nextAt': wake['nextAt'], 'endedAt': ended_at, 'endedBy': ended_by,
    }]


def items_for(state, now, last_activity, born_ms):
    items = monitor_items(state, now) + cron_items(state, now) + loop_items(state, now, last_activity)
    return [item for item in items
            if item['startedAt'] >= born_ms and (item['endedAt'] is None or now - item['endedAt'] < RECENT_MS)]


# ---- live sessions ----------------------------------------------------------------------------

def proc_start_key(text):
    match = PROC_START.search(text or '')
    if not match:
        return None
    if match.group(1):
        return (match.group(1), int(match.group(2)), match.group(3), match.group(4))
    return (match.group(6), int(match.group(5)), match.group(7), match.group(8))


def process_starts(pids):
    wanted = [str(pid) for pid in pids if isinstance(pid, int) and pid > 0]
    if not wanted:
        return {}
    ps = '/bin/ps' if os.path.exists('/bin/ps') else (shutil.which('ps') or 'ps')
    try:
        output = subprocess.run([ps, '-o', 'pid=,lstart=', '-p', ','.join(wanted)], capture_output=True, text=True,
                                timeout=5, env=dict(os.environ, LC_ALL='C', LANG='C')).stdout
    except (OSError, subprocess.SubprocessError):
        return {}
    starts = {}
    for line in output.splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) == 2 and parts[0].isdigit():
            starts[int(parts[0])] = proc_start_key(parts[1])
    return starts


def live_sessions():
    records = []
    for path in glob.glob(os.path.join(claude_home(), 'sessions', '*.json')):
        record = read_json(path) if os.path.basename(path)[:-5].isdigit() else None
        if isinstance(record, dict) and record.get('sessionId'):
            records.append(record)
    starts = process_starts([record.get('pid') for record in records])
    return [record for record in records
            if record.get('pid') in starts and starts[record['pid']] == proc_start_key(record.get('procStart'))]


def slug_of(cwd):
    return re.sub(r'[^A-Za-z0-9]', '-', cwd or '')


def transcript_path(session_id, cwd):
    candidate = os.path.join(claude_home(), 'projects', slug_of(cwd), session_id + '.jsonl')
    if os.path.exists(candidate):
        return candidate
    found = glob.glob(os.path.join(claude_home(), 'projects', '*', session_id + '.jsonl'))
    return found[0] if found else None


def tail_title(path):
    try:
        size = os.path.getsize(path)
        with open(path, 'rb') as handle:
            handle.seek(max(0, size - TITLE_TAIL_BYTES))
            chunk = handle.read()
    except OSError:
        return None
    title = None
    for line in chunk.split(b'\n'):
        if b'"custom-title"' in line or b'"ai-title"' in line:
            try:
                row = json.loads(line)
            except ValueError:
                continue
            title = row.get('customTitle') or row.get('aiTitle') or title
    return title


def hc_binary():
    found = shutil.which('hc')
    if found:
        return found
    for candidate in ('~/.local/bin/hc', '/opt/homebrew/bin/hc', '/usr/local/bin/hc'):
        path = os.path.expanduser(candidate)
        if os.path.exists(path):
            return path
    return None


def terminals_by_pid(addresses):
    binary = hc_binary()
    found = {}
    for address in addresses if binary else []:
        try:
            result = subprocess.run([binary, 'get', address, '--json'], capture_output=True, text=True, timeout=5)
            pid = (json.loads(result.stdout).get('foreground') or {}).get('pid') if result.returncode == 0 else None
        except (OSError, subprocess.SubprocessError, ValueError):
            pid = None
        if isinstance(pid, int):
            found[pid] = address
    return found


# ---- cache + entry point ----------------------------------------------------------------------

def cache_root():
    root = os.path.join(tempfile.gettempdir(), 'herdr-agent-monitors-%d' % os.getuid())
    os.makedirs(root, mode=0o700, exist_ok=True)
    return root


def code_stamp():
    try:
        return int(os.path.getmtime(os.path.abspath(__file__)))
    except OSError:
        return 0


def load_state(path, stamp):
    cached = read_json(path)
    if isinstance(cached, dict) and cached.get('v') == CACHE_VERSION and cached.get('code') == stamp:
        return cached.get('state') or new_state()
    return new_state()


def save_state(path, stamp, state):
    temp = path + '.tmp'
    try:
        with open(temp, 'w') as handle:
            json.dump({'v': CACHE_VERSION, 'code': stamp, 'state': state}, handle)
        os.replace(temp, path)
    except OSError:
        pass


def snapshot(addresses, now=None):
    now = now or int(time.time() * 1000)
    root, stamp = cache_root(), code_stamp()
    pid_terminal = terminals_by_pid(addresses)
    sessions, items = [], []
    for record in live_sessions():
        session_id = record['sessionId']
        path = transcript_path(session_id, record.get('cwd'))
        if path is None:
            continue
        cache_path = os.path.join(root, re.sub(r'[^A-Za-z0-9-]', '', session_id) + '.json')
        state = refresh_state(load_state(cache_path, stamp), path)
        prune(state, now)
        save_state(cache_path, stamp, state)
        last_activity = int(os.path.getmtime(path) * 1000)
        born = number(record.get('startedAt')) or 0
        found = items_for(state, now, last_activity, born - 5000)
        sessions.append({
            'id': session_id, 'pid': record.get('pid'), 'cwd': record.get('cwd'),
            'title': clip(tail_title(path) or record.get('name'), 80), 'terminal': pid_terminal.get(record.get('pid')),
            'startedAt': born, 'lastActivity': last_activity, 'status': record.get('status'),
        })
        items.extend(dict(item, session=session_id) for item in found)
    sessions.sort(key=lambda s: s['lastActivity'], reverse=True)
    return {'v': OUTPUT_VERSION, 'at': now, 'sessions': sessions, 'items': items}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--terminals', default='', help='comma-separated Herdr terminal addresses to map to sessions')
    args = parser.parse_args(argv)
    try:
        result = snapshot([a for a in args.terminals.split(',') if a])
    except Exception as error:  # the panel shows any failure as a banner instead of going blank
        result = {'v': OUTPUT_VERSION, 'error': '%s: %s' % (type(error).__name__, clip(error, 200))}
    sys.stdout.write(json.dumps(result, separators=(',', ':')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
