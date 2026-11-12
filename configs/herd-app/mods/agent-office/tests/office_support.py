import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = importlib.util.spec_from_file_location('office', os.path.join(HERE, '..', 'office.py'))
office = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(office)

SESSION = '11111111-2222-3333-4444-555555555555'
TEAM = 'session-11111111'
CWD = '/work/demo'


def compact(row):
    return json.dumps(row, separators=(',', ':'))


def stamp(seconds):
    return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(seconds)) + '.000Z'


def user(at, content, **extra):
    row = {'parentUuid': None, 'type': 'user', 'timestamp': stamp(at), 'uuid': 'u%s' % at,
           'message': {'role': 'user', 'content': content}}
    row.update(extra)
    return row


def human(at, text):
    return user(at, text, origin={'kind': 'human'})


def assistant(at, message_id, blocks, stop='tool_use', model='claude-opus-5-5', usage=None):
    usage = usage or {'input_tokens': 10, 'output_tokens': 100, 'cache_read_input_tokens': 1000,
                      'cache_creation_input_tokens': 0}
    return {'parentUuid': None, 'type': 'assistant', 'timestamp': stamp(at), 'uuid': 'a%s-%s' % (at, message_id),
            'message': {'id': message_id, 'model': model, 'role': 'assistant', 'content': blocks,
                        'stop_reason': stop, 'usage': usage}}


def tool_use(use_id, name, tool_input):
    return {'type': 'tool_use', 'id': use_id, 'name': name, 'input': tool_input}


def tool_result(at, use_id, result=None):
    return user(at, [{'type': 'tool_result', 'tool_use_id': use_id, 'content': 'ok'}], toolUseResult=result or {})


def request(at):
    return {'type': 'api-request', 'timestamp': stamp(at), 'params': {'model': 'claude-opus-5-5'}}


def write_lines(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as handle:
        for row in rows:
            handle.write(compact(row) + '\n')


def scan(rows, is_main=True):
    state = office.new_file_state()
    for row in rows:
        office.scan_line(state, compact(row).encode(), is_main)
    return state


class Home(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix='office-test-')
        self.home = os.path.join(self.root, 'claude')
        self.cache = os.path.join(self.root, 'cache')
        os.makedirs(self.cache)
        self.saved = os.environ.get('CLAUDE_CONFIG_DIR')
        os.environ['CLAUDE_CONFIG_DIR'] = self.home
        self.project = os.path.join(self.home, 'projects', office.slug_of(CWD))

    def tearDown(self):
        if self.saved is None:
            os.environ.pop('CLAUDE_CONFIG_DIR', None)
        else:
            os.environ['CLAUDE_CONFIG_DIR'] = self.saved
        shutil.rmtree(self.root, ignore_errors=True)

    def live_record(self):
        pid = os.getpid()
        start = subprocess.run(['/bin/ps', '-o', 'lstart=', '-p', str(pid)], capture_output=True, text=True,
                               env=dict(os.environ, LC_ALL='C')).stdout.strip()
        record = {'pid': pid, 'sessionId': SESSION, 'cwd': CWD, 'procStart': start, 'version': '2.1.322'}
        os.makedirs(os.path.join(self.home, 'sessions'), exist_ok=True)
        with open(os.path.join(self.home, 'sessions', '%d.json' % pid), 'w') as handle:
            json.dump(record, handle)
        return record

    def snapshot(self, record):
        return office.build_snapshot(SESSION, pid=record['pid'], record=record, cache_root=self.cache)
