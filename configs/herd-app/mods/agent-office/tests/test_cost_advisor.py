import sys
import unittest

sys.dont_write_bytecode = True

from office_support import (  # noqa: E402
    office, stamp, assistant, tool_use, scan,
)


class Usage(unittest.TestCase):
    def test_rows_of_one_message_count_once(self):
        usage = {'input_tokens': 2, 'output_tokens': 244, 'cache_read_input_tokens': 28532,
                 'cache_creation_input_tokens': 72868,
                 'cache_creation': {'ephemeral_1h_input_tokens': 0, 'ephemeral_5m_input_tokens': 72868}}
        state = scan([
            assistant(100, 'msg_1', [{'type': 'thinking', 'thinking': ''}], usage=usage),
            assistant(100, 'msg_1', [{'type': 'text', 'text': 'hi'}], usage=usage),
            assistant(100, 'msg_1', [tool_use('t1', 'Bash', {'command': 'ls'})], usage=usage),
        ])
        tokens, usd, partial = office.file_cost(state)
        self.assertEqual(tokens, {'in': 2, 'out': 244, 'cr': 28532, 'cw': 72868})
        self.assertAlmostEqual(usd, (2 * 4 + 244 * 20 + 28532 * 0.2 + 72868 * 5) / 1e6, places=4)
        self.assertFalse(partial)
        self.assertEqual(state['tools'], 1)

    def test_one_hour_cache_writes_cost_twice_input(self):
        usage = {'input_tokens': 0, 'output_tokens': 0, 'cache_read_input_tokens': 0,
                 'cache_creation_input_tokens': 1000000,
                 'cache_creation': {'ephemeral_1h_input_tokens': 1000000, 'ephemeral_5m_input_tokens': 0}}
        state = scan([assistant(100, 'm', [{'type': 'text', 'text': 'x'}], usage=usage)])
        self.assertAlmostEqual(office.file_cost(state)[1], 8.0)

    def test_unknown_model_marks_partial(self):
        state = scan([assistant(100, 'm', [{'type': 'text', 'text': 'x'}], model='mystery-1')])
        self.assertTrue(office.file_cost(state)[2])


class Advisor(unittest.TestCase):
    def iterations(self, *advice):
        rows = [{'type': 'message', 'input_tokens': 1, 'output_tokens': 1}]
        for model, tokens_in, tokens_out in advice:
            rows.append({'type': 'advisor_message', 'model': model, 'input_tokens': tokens_in,
                         'output_tokens': tokens_out, 'cache_read_input_tokens': 0, 'cache_creation_input_tokens': 0})
        rows.append({'type': 'message', 'input_tokens': 1, 'output_tokens': 1})
        return {'input_tokens': 2, 'output_tokens': 2, 'cache_read_input_tokens': 0, 'cache_creation_input_tokens': 0,
                'iterations': rows}

    def test_kth_call_takes_kth_iteration(self):
        usage = self.iterations(('claude-fable-5-2', 138184, 11611))
        state = scan([
            {'type': 'attachment', 'timestamp': stamp(99),
             'attachment': {'type': 'advisor_tool', 'available': True, 'model': 'claude-fable-5-2'}},
            assistant(100, 'm1', [{'type': 'server_tool_use', 'name': 'advisor', 'id': 'srv1', 'input': {}}], usage=usage),
            assistant(232, 'm1', [{'type': 'advisor_tool_result', 'tool_use_id': 'srv1',
                                   'content': {'type': 'advisor_redacted_result'}}], usage=usage),
        ])
        consult, = office.consults_of(state, 'coordinator')
        self.assertEqual((consult['in'], consult['out'], consult['model']), (138184, 11611, 'claude-fable-5-2'))
        self.assertAlmostEqual(consult['usd'], 1.5699, places=3)
        self.assertEqual(consult['ms'], 132000)
        self.assertTrue(consult['redacted'])
        self.assertEqual(office.file_cost(state)[0]['in'], 2)

    def test_count_mismatch_gives_no_tokens(self):
        usage = self.iterations(('claude-fable-5-2', 5, 5))
        state = scan([assistant(100, 'm1', [{'type': 'server_tool_use', 'name': 'advisor', 'id': 's1', 'input': {}},
                                            {'type': 'server_tool_use', 'name': 'advisor', 'id': 's2', 'input': {}}],
                                usage=usage)])
        self.assertTrue(all(one['in'] is None for one in office.consults_of(state, 'coordinator')))

    def test_error_result(self):
        state = scan([assistant(100, 'm1', [{'type': 'server_tool_use', 'name': 'advisor', 'id': 's1', 'input': {}},
                                            {'type': 'advisor_tool_result', 'tool_use_id': 's1',
                                             'content': {'type': 'advisor_tool_result_error', 'error_code': 'overloaded'}}])])
        consult, = office.consults_of(state, 'coordinator')
        self.assertEqual(consult['error'], 'overloaded')


if __name__ == '__main__':
    unittest.main()
