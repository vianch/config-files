import json
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import monitors  # noqa: E402

T0 = 1794470000000


def stamp(ms):
    return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(ms // 1000)) + '.%03dZ' % (ms % 1000)


def use(at, use_id, name, tool_input, blob=False):
    row = {'type': 'assistant', 'message': {'role': 'assistant', 'content': [
        {'type': 'tool_use', 'id': use_id, 'name': name, 'input': tool_input}]}}
    if blob:
        row['type'] = 'api-request-blob'
    else:
        row['timestamp'] = stamp(at)
    return row


def result(at, use_id, tool_result, error=False):
    return {'type': 'user', 'timestamp': stamp(at), 'toolUseResult': tool_result, 'message': {'role': 'user', 'content': [
        {'type': 'tool_result', 'tool_use_id': use_id, 'content': 'ok', 'is_error': error}]}}


def note(task, status=None, event=None):
    body = '<task-id>%s</task-id><summary>x</summary>' % task
    if status:
        body += '<status>%s</status>' % status
    if event:
        body += '<event>%s</event>' % event
    return '<task-notification>\n%s\n</task-notification>' % body


def enqueue(at, text):
    return {'type': 'queue-operation', 'operation': 'enqueue', 'timestamp': stamp(at), 'content': text}


def delivered(at, text):
    return {'type': 'user', 'timestamp': stamp(at), 'message': {'role': 'user', 'content': text}}


def queued(at, text):
    return {'type': 'attachment', 'timestamp': stamp(at), 'attachment': {'type': 'queued_command', 'prompt': text}}


def scan(rows):
    state = monitors.new_state()
    for row in rows:
        monitors.scan_line(state, json.dumps(row, separators=(',', ':')).encode())
    return state


def by_id(items):
    return {item['id']: item for item in items}


MONITOR_START = [
    use(T0, 'u1', 'Monitor', {'description': 'deploy log errors', 'command': 'tail -f log', 'timeout_ms': 1800000}),
    use(T0, 'u1', 'Monitor', {'description': 'deploy log errors', 'command': 'tail -f log', 'timeout_ms': 1800000}, blob=True),
    result(T0 + 500, 'u1', {'taskId': 'bmon1', 'timeoutMs': 1800000, 'persistent': False}),
]


class MonitorTests(unittest.TestCase):
    def test_a_started_monitor_runs_until_its_deadline_then_reads_as_expired(self):
        state = scan(MONITOR_START)
        live = by_id(monitors.items_for(state, T0 + 60000, T0, 0))['bmon1']
        self.assertEqual((live['status'], live['label'], live['deadlineAt']), ('running', 'deploy log errors', T0 + 1800000))
        expired = by_id(monitors.items_for(state, T0 + 1800001, T0, 0))['bmon1']
        self.assertEqual((expired['status'], expired['endedBy']), ('ended', 'expired'))

    def test_events_count_once_though_each_notification_is_both_enqueued_and_delivered(self):
        text = note('bmon1', event='ERROR disk full')
        state = scan(MONITOR_START + [enqueue(T0 + 9000, text), delivered(T0 + 9100, text), queued(T0 + 9200, text)])
        item = by_id(monitors.items_for(state, T0 + 10000, T0, 0))['bmon1']
        self.assertEqual((item['events'], item['lastEvent'], item['lastEventAt']), (1, 'ERROR disk full', T0 + 9000))

    def test_an_ending_status_from_any_delivery_ends_the_monitor(self):
        state = scan(MONITOR_START + [queued(T0 + 7000, note('bmon1', status='failed'))])
        item = by_id(monitors.items_for(state, T0 + 8000, T0, 0))['bmon1']
        self.assertEqual((item['status'], item['endedBy'], item['endedAt']), ('ended', 'failed', T0 + 7000))

    def test_task_stop_ends_the_monitor(self):
        state = scan(MONITOR_START + [use(T0 + 3000, 'u2', 'TaskStop', {'task_id': 'bmon1'}),
                                      result(T0 + 3100, 'u2', {'task_id': 'bmon1', 'message': 'stopped'})])
        item = by_id(monitors.items_for(state, T0 + 4000, T0, 0))['bmon1']
        self.assertEqual(item['endedBy'], 'stopped')

    def test_work_from_an_earlier_process_of_a_resumed_transcript_is_dropped(self):
        state = scan(MONITOR_START)
        self.assertEqual(monitors.items_for(state, T0 + 60000, T0, T0 + 1000), [])

    def test_ended_items_linger_as_recent_then_leave(self):
        state = scan(MONITOR_START + [enqueue(T0 + 2000, note('bmon1', status='completed'))])
        self.assertEqual(len(monitors.items_for(state, T0 + 2000 + monitors.RECENT_MS - 1, T0, 0)), 1)
        self.assertEqual(monitors.items_for(state, T0 + 2000 + monitors.RECENT_MS + 1, T0, 0), [])


class CronTests(unittest.TestCase):
    def test_a_one_shot_job_is_armed_until_it_fires(self):
        fire = T0 + 3600000
        state = scan([use(T0, 'c1', 'CronCreate', {'cron': '7 9 25 12 *', 'prompt': 'check deploy', 'recurring': False}),
                      result(T0 + 100, 'c1', {'id': 'j1', 'humanSchedule': '7 9 25 12 *', 'recurring': False, 'nextFireAt': fire})])
        armed = by_id(monitors.items_for(state, T0 + 1000, T0, 0))['j1']
        self.assertEqual((armed['kind'], armed['status'], armed['nextAt']), ('cron', 'armed', fire))
        fired = by_id(monitors.items_for(state, fire + monitors.FIRE_GRACE_MS + 1, T0, 0))['j1']
        self.assertEqual(fired['endedBy'], 'fired')

    def test_cron_delete_cancels_and_recurring_jobs_expire_after_seven_days(self):
        rows = [use(T0, 'c1', 'CronCreate', {'cron': '*/5 * * * *', 'prompt': 'poll ci'}),
                result(T0 + 100, 'c1', {'id': 'j1', 'recurring': True, 'nextFireAt': T0 + 300000})]
        expiring = by_id(monitors.items_for(scan(rows), T0 + monitors.CRON_LIFE_MS + 1, T0, 0))
        self.assertEqual(expiring['j1']['endedBy'], 'expired')
        canceled = scan(rows + [use(T0 + 5000, 'c2', 'CronDelete', {'id': 'j1'}), result(T0 + 5100, 'c2', {'id': 'j1'})])
        self.assertEqual(by_id(monitors.items_for(canceled, T0 + 6000, T0, 0))['j1']['endedBy'], 'canceled')

    def test_a_delete_whose_result_is_plain_text_still_cancels(self):
        rows = [use(T0, 'c1', 'CronCreate', {'cron': '*/5 * * * *', 'prompt': 'poll ci'}),
                result(T0 + 100, 'c1', {'id': 'j1', 'recurring': True}),
                use(T0 + 5000, 'c2', 'CronDelete', {'id': 'j1'}), result(T0 + 5100, 'c2', 'Cancelled job j1.')]
        self.assertEqual(by_id(monitors.items_for(scan(rows), T0 + 6000, T0, 0))['j1']['endedBy'], 'canceled')

    def test_a_recurring_job_reports_its_next_match(self):
        rows = [use(T0, 'c1', 'CronCreate', {'cron': '*/5 * * * *', 'prompt': 'poll ci'}),
                result(T0 + 100, 'c1', {'id': 'j1', 'recurring': True})]
        item = by_id(monitors.items_for(scan(rows), T0 + 1000, T0, 0))['j1']
        self.assertEqual(time.localtime(item['nextAt'] // 1000).tm_min % 5, 0)
        self.assertGreater(item['nextAt'], T0 + 1000)

    def test_a_cron_started_by_slash_loop_is_a_loop(self):
        rows = [use(T0, 'c1', 'CronCreate', {'cron': '*/10 * * * *', 'prompt': '/loop 10m /babysit-prs'}),
                result(T0 + 100, 'c1', {'id': 'j9', 'recurring': True})]
        self.assertEqual(by_id(monitors.items_for(scan(rows), T0 + 1000, T0, 0))['j9']['kind'], 'loop')

    def test_a_failed_create_is_not_armed(self):
        rows = [use(T0, 'c1', 'CronCreate', {'cron': 'bad', 'prompt': 'x'}), result(T0 + 100, 'c1', 'Error: bad cron', error=True)]
        self.assertEqual(monitors.items_for(scan(rows), T0 + 1000, T0, 0), [])


class LoopTests(unittest.TestCase):
    WAKE = [use(T0, 'w1', 'ScheduleWakeup', {'delaySeconds': 600, 'prompt': '<<autonomous-loop-dynamic>>', 'reason': 'watching CI run'}),
            result(T0 + 100, 'w1', {'ok': True})]

    def test_a_wakeup_sleeps_then_runs_while_the_session_works(self):
        state = scan(self.WAKE)
        sleeping = monitors.items_for(state, T0 + 1000, T0, 0)[0]
        self.assertEqual((sleeping['status'], sleeping['nextAt'], sleeping['label']), ('sleeping', T0 + 600000, 'watching CI run'))
        running = monitors.items_for(state, T0 + 700000, T0 + 650000, 0)[0]
        self.assertEqual(running['status'], 'running')

    def test_a_wakeup_that_fired_long_ago_with_no_follow_up_has_finished(self):
        item = monitors.items_for(scan(self.WAKE), T0 + 610000 + monitors.LOOP_RUN_MS + 1, T0 + 610000, 0)[0]
        self.assertEqual((item['status'], item['endedBy']), ('ended', 'finished'))

    def test_stop_ends_the_loop_and_the_delay_is_clamped(self):
        stopped = scan(self.WAKE + [use(T0 + 5000, 'w2', 'ScheduleWakeup', {'stop': True})])
        self.assertEqual(monitors.items_for(stopped, T0 + 6000, T0, 0)[0]['endedBy'], 'stopped')
        clamped = scan([use(T0, 'w3', 'ScheduleWakeup', {'delaySeconds': 5, 'reason': 'fast'}), result(T0 + 1, 'w3', {})])
        self.assertEqual(monitors.items_for(clamped, T0 + 10, T0, 0)[0]['nextAt'], T0 + 60000)

    def test_a_reported_fire_time_wins_over_the_computed_one(self):
        state = scan([use(T0, 'w1', 'ScheduleWakeup', {'delaySeconds': 600, 'reason': 'r'}),
                      result(T0 + 100, 'w1', {'scheduledFor': T0 + 612345})])
        self.assertEqual(monitors.items_for(state, T0 + 1000, T0, 0)[0]['nextAt'], T0 + 612345)


class IncrementalTests(unittest.TestCase):
    def test_a_half_written_line_waits_for_the_next_read(self):
        lines = [json.dumps(row, separators=(',', ':')) for row in MONITOR_START]
        with tempfile.NamedTemporaryFile('w', suffix='.jsonl', delete=False) as handle:
            handle.write(lines[0] + '\n' + lines[1] + '\n' + lines[2][:40])
            path = handle.name
        try:
            state = monitors.refresh_state(monitors.new_state(), path)
            self.assertEqual(state['monitors'], {})
            with open(path, 'a') as handle:
                handle.write(lines[2][40:] + '\n')
            state = monitors.refresh_state(state, path)
            self.assertIn('bmon1', state['monitors'])
        finally:
            os.unlink(path)


class CronExpressionTests(unittest.TestCase):
    def test_fields_and_ranges(self):
        spec = monitors.parse_cron('*/15 9-17 * * 1-5')
        self.assertEqual(sorted(spec['minute']), [0, 15, 30, 45])
        self.assertEqual(sorted(spec['dow']), [1, 2, 3, 4, 5])
        self.assertIsNone(monitors.parse_cron('nope'))
        self.assertEqual(monitors.parse_cron('0 0 * * 7')['dow'], {0})


if __name__ == '__main__':
    unittest.main()
