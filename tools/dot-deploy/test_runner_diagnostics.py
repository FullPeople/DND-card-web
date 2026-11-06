"""Sanitized diagnostics must preserve the first failure without retrying writes."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import runner_production as runner


class RunnerDiagnosticsTests(unittest.TestCase):
    def envelope(self):
        return {'operation': 'publish', 'oidc': 'NEVER_ECHO_TOKEN', 'private': 'NEVER_ECHO_REQUEST'}

    def records(self, output):
        value = output.getvalue()
        for secret in ('NEVER_ECHO_TOKEN', 'NEVER_ECHO_REQUEST', 'NEVER_ECHO_STDERR', 'NEVER_ECHO_EXCEPTION'):
            self.assertNotIn(secret, value)
        return [json.loads(line)['deploymentDiagnostic'] for line in value.splitlines() if line]

    def test_initial_timeout_survives_a_successful_read_only_reconciliation(self):
        output = io.StringIO()
        response = {'ok': True, 'result': {'status': 'artifact-preflight-passed'}}
        with contextlib.redirect_stdout(output), patch.object(runner, 'transfer', side_effect=[runner.c.Denied('ssh-transfer-timeout'), response]) as transfer, patch.object(runner, 'fresh_token', return_value='NEVER_ECHO_TOKEN'):
            self.assertEqual(runner.reconcile(['ssh'], self.envelope(), Path('archive')), response)
        self.assertEqual([call.args[1]['operation'] for call in transfer.call_args_list], ['publish', 'status'])
        self.assertEqual(self.records(output), [{'phase': 'initial', 'operation': 'publish', 'code': 'ssh-transfer-timeout'}])

    def test_unknown_result_preserves_all_three_read_only_failures_without_another_write(self):
        output = io.StringIO()
        errors = [RuntimeError('NEVER_ECHO_EXCEPTION'), runner.c.Denied('publisher-lock-busy'), RuntimeError('NEVER_ECHO_EXCEPTION'), runner.c.Denied('deployment-unavailable')]
        with contextlib.redirect_stdout(output), patch.object(runner, 'transfer', side_effect=errors) as transfer, patch.object(runner, 'fresh_token', return_value='NEVER_ECHO_TOKEN'):
            with self.assertRaisesRegex(runner.c.Denied, 'deployment-result-unknown-status-required'):
                runner.reconcile(['ssh'], self.envelope(), Path('archive'))
        self.assertEqual([call.args[1]['operation'] for call in transfer.call_args_list], ['publish', 'status', 'status', 'status'])
        records = self.records(output)
        self.assertEqual([row['phase'] for row in records], ['initial', 'status-query', 'status-query', 'status-query'])
        self.assertEqual([row['code'] for row in records], ['deployment-runtime-error', 'publisher-lock-busy', 'deployment-runtime-error', 'deployment-unavailable'])
        self.assertEqual([row['attempt'] for row in records[1:]], [1, 2, 3])

    def test_explicit_permission_denial_still_stops_before_any_alternate_query(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), patch.object(runner, 'transfer', side_effect=runner.c.Denied('oidc-scope-denied')) as transfer, patch.object(runner, 'fresh_token') as fresh:
            with self.assertRaisesRegex(runner.c.Denied, 'oidc-scope-denied'):
                runner.reconcile(['ssh'], self.envelope(), Path('archive'))
        self.assertEqual(transfer.call_count, 1)
        fresh.assert_not_called()
        self.assertEqual(self.records(output), [])

    def test_diagnostic_schema_cannot_log_arbitrary_text_or_unknown_metrics(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            runner.diagnostic('NEVER_ECHO_REQUEST', 'NEVER_ECHO_TOKEN', 'NEVER_ECHO_EXCEPTION',
                              stderr='NEVER_ECHO_STDERR', responseBytes='NEVER_ECHO_REQUEST',
                              writerFailed='NEVER_ECHO_TOKEN', sshExitCode=7)
        self.assertEqual(self.records(output), [{'phase': 'unknown', 'operation': 'unknown',
                                                'code': 'deployment-runtime-error', 'sshExitCode': 7}])

    def test_oversized_real_response_is_rejected_without_logging_its_contents(self):
        output = io.StringIO()
        code = "import sys; sys.stdin.buffer.read(); sys.stdout.write('NEVER_ECHO_TOKEN'*2000)"
        with contextlib.redirect_stdout(output), self.assertRaisesRegex(runner.c.Denied, 'invalid-server-response'):
            runner.transfer([sys.executable, '-c', code], self.envelope())
        records = self.records(output)
        self.assertTrue(records)
        self.assertEqual(records[0]['responseBytes'], 32000)

    def test_token_refresh_failure_does_not_erase_the_original_transport_failure(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), patch.object(runner, 'transfer', side_effect=runner.c.Denied('ssh-transfer-failed')) as transfer, patch.object(runner, 'fresh_token', side_effect=RuntimeError('NEVER_ECHO_EXCEPTION')):
            with self.assertRaisesRegex(RuntimeError, 'NEVER_ECHO_EXCEPTION'):
                runner.reconcile(['ssh'], self.envelope(), Path('archive'))
        self.assertEqual(transfer.call_count, 1)
        self.assertEqual(self.records(output), [{'phase': 'initial', 'operation': 'publish', 'code': 'ssh-transfer-failed'}])

    def test_real_failed_transport_records_only_exit_status_and_response_size(self):
        output = io.StringIO()
        code = "import sys; sys.stdin.buffer.read(); sys.stderr.write('NEVER_ECHO_STDERR'); sys.exit(7)"
        with contextlib.redirect_stdout(output), self.assertRaises(Exception):
            runner.transfer([sys.executable, '-c', code], self.envelope())
        records = self.records(output)
        self.assertTrue(records, 'The failed real subprocess must leave a sanitized transport diagnostic.')
        self.assertEqual(records[0]['phase'], 'transport')
        self.assertEqual(records[0]['code'], 'ssh-transfer-result')
        self.assertEqual(records[0]['sshExitCode'], 7)
        self.assertEqual(records[0]['responseBytes'], 0)
        self.assertNotIn('stderr', records[0])
        self.assertNotIn('stdout', records[0])

    def test_real_transfer_timeout_has_a_fixed_code_without_echoing_input(self):
        output = io.StringIO()
        code = 'import sys,time; sys.stdin.buffer.read(); time.sleep(10)'
        with contextlib.redirect_stdout(output), self.assertRaisesRegex(runner.c.Denied, 'ssh-transfer-timeout'):
            runner.transfer([sys.executable, '-c', code], self.envelope(), timeout=0.1)
        records = self.records(output)
        self.assertTrue(records, 'A real timeout must retain its original sanitized code.')
        self.assertEqual(records[0]['phase'], 'transport')
        self.assertEqual(records[0]['code'], 'ssh-transfer-timeout')

    def test_successful_binary_transfer_keeps_the_original_receipt_and_no_diagnostics(self):
        output = io.StringIO()
        code = 'import sys,json; json.loads(sys.stdin.buffer.readline()); data=sys.stdin.buffer.read(); print(json.dumps({"ok":True,"bytes":len(data)}))'
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'archive'
            archive.write_bytes(b'authored\x00binary\xff')
            with contextlib.redirect_stdout(output):
                response = runner.transfer([sys.executable, '-c', code], self.envelope(), archive)
            self.assertEqual(response, {'ok': True, 'bytes': archive.stat().st_size})
        self.assertEqual(self.records(output), [])


if __name__ == '__main__':
    unittest.main()
