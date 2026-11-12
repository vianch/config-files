import contextlib
import io
import json
import os
import sys
import unittest

sys.dont_write_bytecode = True

from office_support import office, human, write_lines, Home, SESSION  # noqa: E402


def run_cli(argv):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = office.main(argv)
    return code, out.getvalue()


class Cli(Home):
    def test_malformed_calls_print_one_error_line_and_exit_zero(self):
        for argv in (['--pid', 'abc'], [], ['--session', 'nope', '--cache-dir', self.cache]):
            code, out = run_cli(argv)
            self.assertEqual(code, 0)
            self.assertEqual(out.count('\n'), 1)
            self.assertEqual(json.loads(out)['v'], 1)
            self.assertIn('error', json.loads(out))

    def test_bad_pid_is_an_error_line(self):
        result = office.snapshot_for_pid(999999999, cache_root=self.cache)
        self.assertEqual(result, {'v': 1, 'error': 'no Claude session for pid 999999999'})

    def test_non_claude_foreground_falls_back_to_live_session_in_cwd(self):
        record = self.live_record()
        write_lines(os.path.join(self.project, SESSION + '.jsonl'), [human(100, 'hello')])
        for pid in (None, 999999999):
            snapshot = office.snapshot_for_pid(pid, fallback_cwd=record['cwd'], cache_root=self.cache)
            self.assertEqual((snapshot['session']['id'], snapshot['session']['pid']), (SESSION, record['pid']))
            self.assertTrue(snapshot['session']['live'])
            self.assertEqual(snapshot['owner']['prompt'], 'hello')

    def test_cache_problems_never_turn_a_poll_into_an_error(self):
        record = self.live_record()
        write_lines(os.path.join(self.project, SESSION + '.jsonl'), [human(100, 'hello')])
        missing = os.path.join(self.root, 'not', 'yet')
        blocker = os.path.join(self.root, 'a-file')
        open(blocker, 'w').close()
        read_only = os.path.join(self.root, 'read-only')
        os.makedirs(read_only, mode=0o500)
        try:
            for root in (missing, os.path.join(blocker, 'x'), read_only):
                for _ in range(2):
                    code, out = run_cli(['--pid', str(record['pid']), '--cache-dir', root])
                    snapshot = json.loads(out)
                    self.assertEqual(code, 0)
                    self.assertNotIn('error', snapshot, root)
                    self.assertEqual(snapshot['owner']['prompt'], 'hello')
            self.assertEqual(os.listdir(missing), [SESSION + '.json'])
            self.assertEqual(os.listdir(read_only), [])
        finally:
            os.chmod(read_only, 0o700)

    def test_list_shows_only_live_matching_pids(self):
        record = self.live_record()
        write_lines(os.path.join(self.project, SESSION + '.jsonl'), [human(100, 'hello')])
        stale = dict(record, pid=record['pid'], procStart='Mon Jan  1 00:00:00 2001', sessionId='stale')
        with open(os.path.join(self.home, 'sessions', '1.json'), 'w') as handle:
            json.dump(dict(stale, pid=1), handle)
        listed = office.list_sessions()
        self.assertEqual([one['sessionId'] for one in listed], [SESSION])


if __name__ == '__main__':
    unittest.main()
