import sys
import json
import os
import unittest

sys.dont_write_bytecode = True

from office_support import (  # noqa: E402
    office, compact, stamp, human, assistant, tool_use, tool_result, request, write_lines, scan,
    Home,
)


class Incremental(Home):
    def rows(self):
        return [human(100, 'go'), request(101),
                assistant(102, 'm1', [tool_use('t1', 'Agent', {'description': 'd', 'subagent_type': 'vistack:analyst',
                                                               'prompt': 'p'})]),
                tool_result(103, 't1', {'status': 'async_launched', 'agentId': 'aaa'}), request(104),
                assistant(105, 'm2', [{'type': 'text', 'text': 'done'}], stop='end_turn'),
                {'type': 'system', 'subtype': 'stop_hook_summary', 'timestamp': stamp(106)}]

    def test_appends_cut_mid_line_equal_one_shot(self):
        path = os.path.join(self.root, 'x.jsonl')
        data = ''.join(compact(row) + '\n' for row in self.rows()).encode()
        whole = office.new_file_state()
        with open(path, 'wb') as handle:
            handle.write(data)
        office.refresh_file(whole, path, True)
        pieces = office.new_file_state()
        cuts = [0, 37, len(data) // 2, len(data) // 2 + 5, len(data) - 3, len(data)]
        for start, end in zip(cuts, cuts[1:]):
            with open(path, 'wb' if start == 0 else 'ab') as handle:
                handle.write(data[start:end])
            office.refresh_file(pieces, path, True)
            self.assertEqual(pieces['offset'], data.rfind(b'\n', 0, end) + 1)
        roundtrip = json.loads(json.dumps(pieces))
        for state in (whole, roundtrip):
            state.pop('mtime')
        self.assertEqual(roundtrip, whole)
        self.assertEqual(whole['spawned'], {'t1': 'aaa'})

    def test_shrunk_file_resets(self):
        path = os.path.join(self.root, 'x.jsonl')
        write_lines(path, self.rows())
        state = office.new_file_state()
        office.refresh_file(state, path, True)
        self.assertEqual(state['asks'], 1)
        write_lines(path, [human(200, 'fresh')])
        self.assertTrue(office.refresh_file(state, path, True))
        self.assertEqual((state['asks'], state['prompt'], state['tools']), (1, 'fresh', 0))
        self.assertEqual(state['offset'], os.path.getsize(path))

    def test_unchanged_file_is_not_reread(self):
        path = os.path.join(self.root, 'x.jsonl')
        write_lines(path, self.rows())
        state = office.new_file_state()
        self.assertTrue(office.refresh_file(state, path, True))
        self.assertFalse(office.refresh_file(state, path, True))

    def test_blob_lines_are_skipped(self):
        state = scan([{'type': 'api-request-blob', 'timestamp': stamp(1), 'blob': 'x' * 100}])
        self.assertIsNone(state['first'])


if __name__ == '__main__':
    unittest.main()
