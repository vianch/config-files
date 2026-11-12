#!/usr/bin/env python3
"""Plan usage for Claude and Codex, read from files those tools write on this machine.

Claude: ~/.claude/.session-state/rate-limits.json (written by the Claude Code statusline from its
payload's rate_limits) and ~/.claude/daily-cost.json. Codex: the newest session rollout carrying
rate_limits. Prints a list shaped like OpenUsage's /v1/usage so one parser reads either.
"""
import datetime
import glob
import json
import os
import sys
import time

ROLLOUTS_SCANNED = 40
TAIL_BYTES = 1 << 20
TREND_DAYS = 31
WINDOW_LABELS = {300: '5h limit', 10080: 'Weekly', 43200: 'Monthly'}


def read_json(path):
    try:
        with open(path, 'rb') as handle:
            return json.loads(handle.read())
    except (OSError, ValueError):
        return None


def iso(seconds):
    if not isinstance(seconds, (int, float)) or isinstance(seconds, bool):
        return None
    return datetime.datetime.fromtimestamp(seconds, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')


def window(label, used, resets_at, period_ms, now_s):
    if not isinstance(used, (int, float)) or isinstance(used, bool):
        return None
    rolled = isinstance(resets_at, (int, float)) and resets_at < now_s
    return {'type': 'progress', 'label': label, 'used': 0 if rolled else round(used, 1), 'limit': 100,
            'format': {'kind': 'percent'}, 'resetsAt': None if rolled else iso(resets_at), 'periodDurationMs': period_ms}


def money(value):
    return '$%s' % format(value, ',.2f')


def cost_lines(costs, today):
    if not isinstance(costs, dict) or not costs:
        return []
    day = lambda back: (today - datetime.timedelta(days=back)).isoformat()
    spent = lambda back: float(costs.get(day(back)) or 0)
    lines = [{'type': 'text', 'label': 'Today', 'value': money(spent(0))},
             {'type': 'text', 'label': 'Yesterday', 'value': money(spent(1))},
             {'type': 'text', 'label': 'Last 30 days', 'value': money(sum(spent(n) for n in range(30)))}]
    lines.append({'type': 'barChart', 'label': 'Usage Trend',
                  'points': [{'value': round(spent(n), 2), 'label': day(n)} for n in reversed(range(TREND_DAYS))]})
    return lines


def claude(home, now_s, today):
    limits = read_json(os.path.join(home, '.claude', '.session-state', 'rate-limits.json'))
    if not isinstance(limits, dict):
        return None
    five, week = limits.get('five_hour') or {}, limits.get('seven_day') or {}
    lines = [line for line in (
        window('Session', five.get('used_percentage'), five.get('resets_at'), 5 * 3600 * 1000, now_s),
        window('Weekly', week.get('used_percentage'), week.get('resets_at'), 7 * 86400 * 1000, now_s),
    ) if line]
    lines += cost_lines(read_json(os.path.join(home, '.claude', 'daily-cost.json')), today)
    return {'providerId': 'claude', 'displayName': 'Claude', 'plan': None, 'fetchedAt': iso(limits.get('at')),
            'source': 'Claude Code statusline', 'lines': lines}


def last_rate_limits(path):
    try:
        with open(path, 'rb') as handle:
            size = os.fstat(handle.fileno()).st_size
            handle.seek(max(0, size - TAIL_BYTES))
            chunk = handle.read()
    except OSError:
        return None
    for line in reversed(chunk.split(b'\n')):
        if b'"rate_limits"' not in line:
            continue
        try:
            row = json.loads(line)
        except ValueError:
            continue
        payload = row.get('payload') or {}
        limits = payload.get('rate_limits') or (payload.get('info') or {}).get('rate_limits')
        if isinstance(limits, dict) and (limits.get('primary') or limits.get('secondary')):
            return row.get('timestamp'), limits
    return None


def codex_window(limit, stamp_s, now_s):
    if not isinstance(limit, dict):
        return None
    minutes = limit.get('window_minutes')
    resets_at = limit.get('resets_at')
    if resets_at is None and isinstance(limit.get('resets_in_seconds'), (int, float)) and stamp_s:
        resets_at = stamp_s + limit['resets_in_seconds']
    label = WINDOW_LABELS.get(minutes) or ('%dh limit' % (minutes // 60) if isinstance(minutes, int) and minutes < 1440
                                             else '%d-day' % (minutes // 1440) if isinstance(minutes, int) else 'Limit')
    period = minutes * 60000 if isinstance(minutes, (int, float)) else None
    return window(label, limit.get('used_percent'), resets_at, period, now_s)


def codex(home, now_s):
    root = os.environ.get('CODEX_HOME') or os.path.join(home, '.codex')
    files = glob.glob(os.path.join(root, 'sessions', '**', 'rollout-*.jsonl'), recursive=True)
    for path in sorted(files, key=lambda p: os.path.getmtime(p), reverse=True)[:ROLLOUTS_SCANNED]:
        found = last_rate_limits(path)
        if not found:
            continue
        stamp, limits = found
        stamp_s = None
        try:
            stamp_s = datetime.datetime.strptime(stamp[:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=datetime.timezone.utc).timestamp()
        except (TypeError, ValueError):
            pass
        lines = [line for line in (codex_window(limits.get('primary'), stamp_s, now_s),
                                   codex_window(limits.get('secondary'), stamp_s, now_s)) if line]
        credits = limits.get('credits') or {}
        if credits.get('has_credits') and credits.get('balance') is not None:
            lines.append({'type': 'text', 'label': 'Credits', 'value': str(credits['balance'])})
        plan = limits.get('plan_type')
        return {'providerId': 'codex', 'displayName': 'Codex', 'plan': plan.capitalize() if isinstance(plan, str) else None,
                'fetchedAt': stamp, 'source': 'last Codex turn', 'lines': lines}
    return None


def usage(home=None, now_s=None, today=None):
    home = home or os.path.expanduser('~')
    now_s = now_s or time.time()
    today = today or datetime.date.today()
    return [p for p in (claude(home, now_s, today), codex(home, now_s)) if p]


if __name__ == '__main__':
    try:
        result = usage()
    except Exception:  # a broken file must not blank the status bar; it shows "no data" instead
        result = []
    sys.stdout.write(json.dumps(result, separators=(',', ':')))
