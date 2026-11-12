import sys
import unittest

sys.dont_write_bytecode = True

from office_support import (  # noqa: E402
    office,
)


class Roles(unittest.TestCase):
    def test_role_department_order_matters(self):
        cases = {'vistack:senior-implementer': ('wizard', 'Architecture', 'Principal engineer'),
                 'vistack:implementer': ('builder', 'Engineering', 'Engineer'),
                 'vistack:analyst': ('scout', 'Research', 'Analyst'),
                 'vistack:researcher': ('scholar', 'Library', 'Researcher'),
                 'vistack:health-check': ('critic', 'QA & Review', 'Reviewer'),
                 'vistack:pr-author': ('captain', 'Program', 'Program lead'),
                 'vistack:devops': ('helper', 'Operations', 'Generalist'),
                 'general-purpose': ('helper', 'Operations', 'Generalist')}
        for agent_type, (role, label, title) in cases.items():
            self.assertEqual(office.role_of(agent_type), role, agent_type)
            self.assertEqual(office.DEPARTMENTS[role], (label, title))

    def test_pool_sizes_match_the_deck(self):
        sizes = {role: len(pool) for role, pool in office.NAMES.items()}
        self.assertEqual(sizes, {'advisor': 58, 'builder': 58, 'captain': 59, 'critic': 60, 'helper': 55,
                                 'scholar': 57, 'scout': 58, 'wizard': 56})

    def test_teammate_nicknames_hash_the_member_agent_id(self):
        expected = {('vistack:senior-implementer', 'jev-mod@session-3d74fc00'): 'Flux',
                    ('vistack:implementer', 'status-mod@session-3d74fc00'): 'Jest In Time',
                    ('vistack:implementer', 'wire-retro@session-3d74fc00'): 'Bolt Cutter',
                    ('vistack:analyst', 'office-analyst@session-3d74fc00'): 'Spyglass',
                    ('vistack:analyst', 'ad2466af2fc36daab'): 'Log Digger'}
        for (agent_type, agent_id), name in expected.items():
            self.assertEqual(office.nickname(agent_type, agent_id, []), name)

    def test_hash_matches_javascript_for_astral_characters(self):
        self.assertEqual(office.deck_hash('a\U0001F600b'), 1809382)
        self.assertEqual(office.deck_hash('jev-mod@session-3d74fc00'), 1977487474)

    def test_collision_walks_forward(self):
        self.assertEqual(office.nickname('vistack:analyst', 'ad2466af2fc36daab', ['Log Digger']), 'Night Owl')

    def test_wake_replay_moves_one_slot_per_wake(self):
        def record(agent_id, at, wakes):
            return {'id': agent_id, 'type': 'vistack:implementer', 'startedAt': at, '_wakes': wakes, 'nickname': None}
        once = record('a2abc36b340139658', 1, [10])
        thrice = record('ae98f0e7e8ff8bb5a', 2, [11, 12, 13])
        never = record('aa0002762ab7f6771', 0, [])
        office.replay_deck_nicknames([never, once, thrice])
        self.assertEqual((never['nickname'], once['nickname'], thrice['nickname']), ('Spanner', 'Jackhammer', 'Pliers'))


class ProcStart(unittest.TestCase):
    def test_both_formats_compare_equal(self):
        self.assertEqual(office.proc_start_key('Wed Nov 11 14:28:52 2026'),
                         office.proc_start_key('Wed 11 Nov 14:28:52 2026'))


if __name__ == '__main__':
    unittest.main()
