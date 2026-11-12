import sys
import json
import os
import time
import unittest

sys.dont_write_bytecode = True

from office_support import (  # noqa: E402
    office, stamp, user, human, assistant, tool_use, tool_result, request, write_lines, Home,
    SESSION, TEAM, CWD,
)


class Subagents(Home):
    def write_parent(self, now, extra=()):
        rows = [human(now - 50, 'go'), request(now - 49),
                assistant(now - 48, 'm1', [tool_use('t1', 'Agent', {'description': 'look', 'subagent_type': 'vistack:analyst',
                                                                    'prompt': 'p'})]),
                tool_result(now - 47, 't1', {'status': 'async_launched', 'agentId': 'adone'}),
                assistant(now - 46, 'm2', [tool_use('t2', 'Agent', {'description': 'build', 'subagent_type': 'vistack:implementer',
                                                                    'prompt': 'p'})]),
                tool_result(now - 45, 't2', {'status': 'async_launched', 'agentId': 'arun'}),
                assistant(now - 44, 'm3', [{'type': 'text', 'text': 'waiting'}], stop='end_turn')]
        write_lines(os.path.join(self.project, SESSION + '.jsonl'), rows + list(extra))

    def write_agent(self, agent_id, agent_type, rows, meta):
        directory = os.path.join(self.project, SESSION, 'subagents')
        write_lines(os.path.join(directory, 'agent-%s.jsonl' % agent_id), rows)
        meta = dict(meta, agentType=agent_type)
        with open(os.path.join(directory, 'agent-%s.meta.json' % agent_id), 'w') as handle:
            json.dump(meta, handle)

    def test_finished_running_and_states(self):
        now = int(time.time())
        self.write_parent(now)
        self.write_agent('adone', 'vistack:analyst',
                         [user(now - 47, 'prompt'), assistant(now - 40, 'x1', [{'type': 'text', 'text': 'r'}], stop='end_turn')],
                         {'finished': True, 'description': 'look'})
        self.write_agent('arun', 'vistack:implementer',
                         [user(now - 45, 'prompt'), assistant(now - 30, 'y1', [tool_use('b1', 'Bash', {'command': 'make'})],
                                                              model='claude-sonnet-5-5')],
                         {'description': 'build', 'model': 'sonnet'})
        snap = self.snapshot(self.live_record())
        agents = {agent['id']: agent for agent in snap['agents']}
        self.assertEqual(agents['adone']['status'], 'completed')
        self.assertIsNotNone(agents['adone']['endedAt'])
        self.assertEqual(agents['arun']['status'], 'running')
        self.assertEqual(agents['arun']['lastActivity']['detail'], 'Bash make')
        self.assertEqual(agents['arun']['model'], 'claude-sonnet-5-5')
        self.assertEqual(agents['adone']['department'], 'Research')
        self.assertEqual(snap['coordinator']['state'], 'waiting-agents')
        self.assertEqual(snap['coordinator']['label'], 'waiting on 1 agent')
        dispatched = [comm['to'] for comm in snap['comms'] if comm['kind'] == 'dispatch']
        self.assertEqual(dispatched, ['adone', 'arun'])

    def test_dead_parent_and_failed_note(self):
        now = int(time.time())
        note = user(now - 10, '<task-notification><task-id>adone</task-id><status>failed</status>'
                              '<summary>Agent "look" failed</summary></task-notification>',
                    origin={'kind': 'task-notification'})
        self.write_parent(now, [note])
        self.write_agent('adone', 'vistack:analyst', [user(now - 47, 'prompt')], {'finished': True})
        self.write_agent('arun', 'vistack:implementer', [user(now - 45, 'prompt'), request(now - 44)], {})
        record = self.live_record()
        record['procStart'] = 'Mon Jan  1 00:00:00 2001'
        snap = self.snapshot(record)
        agents = {agent['id']: agent for agent in snap['agents']}
        self.assertFalse(snap['session']['live'])
        self.assertEqual(agents['adone']['status'], 'failed')
        self.assertEqual((agents['arun']['status'], agents['arun']['statusReason']), ('killed', 'lost'))
        self.assertEqual(snap['coordinator']['state'], 'idle')

    def test_stopped_by_user_and_unfinished_turn_end(self):
        now = int(time.time())
        self.write_parent(now)
        self.write_agent('adone', 'vistack:analyst', [user(now - 47, 'prompt')], {'stoppedByUser': True})
        self.write_agent('arun', 'vistack:implementer',
                         [user(now - 45, 'p'), assistant(now - 44, 'z', [{'type': 'text', 'text': 'w'}], stop='end_turn')], {})
        agents = {agent['id']: agent for agent in self.snapshot(self.live_record())['agents']}
        self.assertEqual(agents['adone']['status'], 'killed')
        self.assertEqual(agents['arun']['status'], 'waiting')


class Teammates(Home):
    def test_roster_from_team_config(self):
        now = int(time.time())
        lead = [human(now - 100, 'build it'),
                assistant(now - 99, 'm1', [tool_use('t1', 'Agent', {'description': 'Build mod', 'name': 'jev-mod',
                                                                    'subagent_type': 'vistack:senior-implementer',
                                                                    'prompt': 'p'})]),
                tool_result(now - 98, 't1', {'status': 'teammate_spawned', 'agentId': 'jev-mod@' + TEAM}),
                assistant(now - 97, 'm2', [tool_use('t2', 'SendMessage', {'to': 'jev-mod', 'message': 'status?'})]),
                tool_result(now - 96, 't2', {'success': True}),
                user(now - 50, 'Another Claude session sent a message:\n<teammate-message teammate_id="jev-mod" color="blue">\n'
                               '{"type":"idle_notification","from":"jev-mod","result":"mod written"}\n</teammate-message>',
                     origin=None),
                assistant(now - 49, 'm3', [{'type': 'text', 'text': 'ok'}], stop='end_turn')]
        write_lines(os.path.join(self.project, SESSION + '.jsonl'), lead)
        mate_rows = [{'type': 'agent-setting', 'agentSetting': 'vistack:senior-implementer', 'sessionId': 'mate'},
                     {'type': 'attachment', 'timestamp': stamp(now - 98), 'agentName': 'jev-mod', 'teamName': TEAM,
                      'attachment': {'type': 'date'}},
                     request(now - 2)]
        write_lines(os.path.join(self.project, 'mate.jsonl'), mate_rows)
        other = [{'type': 'agent-setting', 'agentSetting': 'x', 'sessionId': 'other'},
                 {'type': 'attachment', 'agentName': 'jev-mod', 'teamName': 'session-99999999', 'attachment': {}}]
        write_lines(os.path.join(self.project, 'other.jsonl'), other)
        config = {'name': TEAM, 'leadSessionId': SESSION, 'members': [
            {'agentId': 'team-lead@' + TEAM, 'name': 'team-lead', 'agentType': 'team-lead', 'cwd': CWD},
            {'agentId': 'jev-mod@' + TEAM, 'name': 'jev-mod', 'agentType': 'vistack:senior-implementer',
             'model': 'opus', 'joinedAt': (now - 98) * 1000, 'cwd': CWD, 'color': 'blue', 'isActive': True}]}
        os.makedirs(os.path.join(self.home, 'teams', TEAM))
        with open(os.path.join(self.home, 'teams', TEAM, 'config.json'), 'w') as handle:
            json.dump(config, handle)
        snap = self.snapshot(self.live_record())
        agent, = snap['agents']
        self.assertEqual((agent['id'], agent['kind'], agent['nickname'], agent['department']),
                         ('jev-mod@' + TEAM, 'teammate', 'Crystal Cave', 'Architecture'))
        self.assertNotEqual(office.nickname(agent['type'], 'jev-mod', []), 'Crystal Cave')
        self.assertEqual(agent['status'], 'running')
        self.assertEqual(agent['lastActivity']['kind'], 'thinking')
        self.assertTrue(agent['file'].endswith('mate.jsonl'))
        self.assertEqual(agent['model'], 'claude-opus-5-5')
        self.assertEqual(agent['description'], 'Build mod')
        comms = [(comm['kind'], comm['from'], comm['to'], comm['text']) for comm in snap['comms']]
        self.assertIn(('message', 'coordinator', 'jev-mod@' + TEAM, 'status?'), comms)
        self.assertIn(('report', 'jev-mod@' + TEAM, 'coordinator', 'mod written'), comms)
        self.assertEqual(snap['owner']['asks'], 1)



class CoordinatorPrecedence(unittest.TestCase):
    def state_with(self, pending, inflight=False):
        state = office.new_file_state()
        state['pending'] = {'id%d' % index: [name, detail, 100 + index] for index, (name, detail) in enumerate(pending)}
        state['inflight'] = inflight
        state['reqAt'] = 50
        return state

    def test_deck_order_waiting_you_then_delegating_then_tool_then_thinking(self):
        working = [{'status': 'running', 'startedAt': 7}]
        cases = [
            ([('Bash', 'ls'), ('Agent', 'build'), ('AskUserQuestion', 'which?')], False,
             ('waiting-you', 'waiting on you: a question', 102)),
            ([('ExitPlanMode', '')], False, ('waiting-you', 'waiting on you: a plan to approve', 100)),
            ([('Bash', 'ls'), ('Agent', 'build')], False, ('delegating', 'delegating build', 101)),
            ([('Read', 'a.py'), ('Bash', 'make')], False, ('tool', 'Bash make', 101)),
            ([], True, ('thinking', 'thinking', 50)),
        ]
        for pending, inflight, expected in cases:
            self.assertEqual(office.coordinator_state(self.state_with(pending, inflight), working, True), expected)

    def test_idle_turn_waits_on_live_agents_else_idle(self):
        state = self.state_with([])
        state['idleAt'] = 90
        agents = [{'status': 'waiting', 'startedAt': 9}, {'status': 'running', 'startedAt': 5},
                  {'status': 'completed', 'startedAt': 1}]
        self.assertEqual(office.coordinator_state(state, agents, True), ('waiting-agents', 'waiting on 2 agents', 5))
        self.assertEqual(office.coordinator_state(state, agents[2:], True), ('idle', 'idle', 90))

    def test_dead_session_is_idle_whatever_the_tail_says(self):
        state = self.state_with([('Bash', 'ls')], inflight=True)
        self.assertEqual(office.coordinator_state(state, [], False)[0], 'idle')


if __name__ == '__main__':
    unittest.main()
