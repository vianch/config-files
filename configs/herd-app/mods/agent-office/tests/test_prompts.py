import sys
import unittest

sys.dont_write_bytecode = True

from office_support import (  # noqa: E402
    stamp, user, human, scan,
)


class HumanPrompts(unittest.TestCase):
    def test_queued_prompt_counts_once_and_injected_rows_do_not_count(self):
        state = scan([
            human(100, 'first ask'),
            {'type': 'queue-operation', 'operation': 'enqueue', 'timestamp': stamp(101), 'content': 'mid-turn ask'},
            {'type': 'queue-operation', 'operation': 'remove', 'timestamp': stamp(102), 'content': 'mid-turn ask'},
            {'type': 'attachment', 'timestamp': stamp(102),
             'attachment': {'type': 'queued_command', 'prompt': 'mid-turn ask', 'origin': {'kind': 'human'}}},
            user(103, 'Another Claude session sent a message:\n<teammate-message teammate_id="jev-mod" color="blue">\n'
                      '{"type":"idle_notification","from":"jev-mod","result":"done"}\n</teammate-message>', origin=None),
            user(104, '<task-notification><task-id>abc</task-id><status>completed</status></task-notification>',
                 origin={'kind': 'task-notification'}),
            user(105, '<system-reminder>be nice</system-reminder>', isMeta=True),
            user(106, 'Another Claude session sent a message:\n<agent-message from="a1">x</agent-message>',
                 origin={'kind': 'peer', 'from': 'a1', 'handbackReportText': 'report'}, isMeta=True),
            {'type': 'attachment', 'timestamp': stamp(107), 'attachment': {'type': 'hook_success', 'content': 'hook out'}},
            {'type': 'last-prompt', 'lastPrompt': 'Another Claude session sent a message: <teammate-message'},
        ])
        self.assertEqual(state['asks'], 2)
        self.assertEqual(state['prompt'], 'mid-turn ask')
        self.assertEqual(state['promptAt'], 102000)
        self.assertIsNone(state['lastPrompt'])

    def test_slash_command_and_interrupt(self):
        state = scan([
            human(100, '<command-message>vistack:run</command-message>\n<command-name>/vistack:run</command-name>\n'
                       '<command-args>run unattended</command-args>'),
            user(101, [{'type': 'text', 'text': '[Request interrupted by user]'}], origin=None),
        ])
        self.assertEqual(state['prompt'], '/vistack:run run unattended')
        self.assertTrue(state['interrupted'])
        self.assertFalse(state['turnOpen'])

    def test_wrapper_markup_is_stripped_from_real_prompts(self):
        state = scan([
            human(100, '<system-reminder>\nThe user started this session without a folder.\n</system-reminder>\n\n\n'
                       'show me the closed PR links'),
            {'type': 'attachment', 'timestamp': stamp(101),
             'attachment': {'type': 'queued_command', 'origin': {'kind': 'human'},
                            'prompt': '<pasted_content id="b4f8">\n/vistack:vistack run unattended\n</pasted_content id="b4f8">'}},
            human(102, '<system-reminder>only a reminder</system-reminder>'),
        ])
        self.assertEqual(state['asks'], 2)
        self.assertEqual(state['comms'][0]['text'], 'show me the closed PR links')
        self.assertEqual(state['prompt'], '/vistack:vistack run unattended')

    def test_legacy_rows_without_origin(self):
        state = scan([user(100, 'old style prompt'), user(101, '<local-command-stdout>x</local-command-stdout>'),
                      user(102, 'Another Claude session sent a message: hi')])
        self.assertEqual(state['asks'], 1)
        self.assertEqual(state['prompt'], 'old style prompt')

    def test_queued_command_in_agent_file_is_not_a_prompt(self):
        state = scan([{'type': 'attachment', 'timestamp': stamp(100),
                       'attachment': {'type': 'queued_command', 'prompt': 'x', 'origin': {'kind': 'human'}}}],
                     is_main=False)
        self.assertEqual(state['asks'], 0)


if __name__ == '__main__':
    unittest.main()
