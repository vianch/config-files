import datetime
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import quota  # noqa: E402

NOW = 1794480000
TODAY = datetime.date(2026, 11, 12)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as handle:
        handle.write(text)


class QuotaTests(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp()

    def test_nothing_recorded_means_no_providers(self):
        self.assertEqual(quota.usage(self.home, NOW, TODAY), [])

    def test_claude_limits_and_costs_come_from_the_statusline_files(self):
        write(os.path.join(self.home, '.claude/.session-state/rate-limits.json'), json.dumps(
            {'at': NOW - 30, 'five_hour': {'used_percentage': 10, 'resets_at': NOW + 3600},
             'seven_day': {'used_percentage': 28, 'resets_at': NOW - 5}}))
        write(os.path.join(self.home, '.claude/daily-cost.json'), json.dumps({'2026-11-12': 3.5, '2026-11-11': 10, '2026-10-01': 99}))
        [claude] = quota.usage(self.home, NOW, TODAY)
        session, weekly = claude['lines'][0], claude['lines'][1]
        self.assertEqual((session['label'], session['used'], session['resetsAt']), ('Session', 10, quota.iso(NOW + 3600)))
        self.assertEqual((weekly['used'], weekly['resetsAt']), (0, None))
        facts = {l['label']: l['value'] for l in claude['lines'] if l['type'] == 'text'}
        self.assertEqual(facts, {'Today': '$3.50', 'Yesterday': '$10.00', 'Last 30 days': '$13.50'})
        trend = [l for l in claude['lines'] if l['type'] == 'barChart'][0]['points']
        self.assertEqual((len(trend), trend[-1]['value']), (31, 3.5))

    def test_codex_reads_the_newest_rollout_that_carries_rate_limits(self):
        row = {'timestamp': '2026-11-03T20:35:38.127Z', 'type': 'event_msg', 'payload': {'type': 'token_count', 'rate_limits': {
            'primary': {'used_percent': 22.0, 'window_minutes': 43200, 'resets_at': NOW + 86400},
            'secondary': {'used_percent': 5, 'window_minutes': 10080, 'resets_at': NOW + 600}, 'plan_type': 'go'}}}
        write(os.path.join(self.home, '.codex/sessions/2026/11/03/rollout-a.jsonl'), json.dumps(row) + '\n{"type":"other"}\n')
        write(os.path.join(self.home, '.codex/sessions/2026/11/04/rollout-b.jsonl'), '{"type":"no limits here"}\n')
        [codex] = quota.usage(self.home, NOW, TODAY)
        self.assertEqual((codex['plan'], codex['fetchedAt']), ('Go', '2026-11-03T20:35:38.127Z'))
        self.assertEqual([(l['label'], l['used']) for l in codex['lines']], [('Monthly', 22.0), ('Weekly', 5)])

    def test_older_codex_builds_report_seconds_until_reset(self):
        row = {'timestamp': '2026-11-12T10:00:00Z', 'payload': {'info': {'rate_limits': {
            'primary': {'used_percent': 40, 'window_minutes': 300, 'resets_in_seconds': 3600}}}}}
        write(os.path.join(self.home, '.codex/sessions/x/rollout-c.jsonl'), json.dumps(row) + '\n')
        line = quota.usage(self.home, NOW, TODAY)[0]['lines'][0]
        self.assertEqual((line['label'], line['resetsAt']), ('5h limit', '2026-11-12T11:00:00.000Z'))


if __name__ == '__main__':
    unittest.main()
