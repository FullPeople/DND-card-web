# Fixed item-charge accounting — source checkpoint (2026-10-27)

This isolated checkpoint depends on the limited-source-use checkpoint `54784d1fd8fa308e263ae0ee2ae9556d71e9fb88`. It is not merged or deployed and is not final browser, CI, report-pairing or whole-item acceptance.

## Bounded implementation

Of 88 source-verified item candidates, 56 have one explicitly bounded fixed-cost bookkeeping action: 36 may reach zero and 20 must retain at least one charge. Another 32 remain held for unresolved pool authority or different units. This is not complete automation of those items or their effects, and does not yet add runtime-report witness credit.

Acquisition requires one genuinely owned/equipped item and a separately confirmed known balance; the balance field starts blank. Exact source, edition, full-entry fingerprint and canonical/alias eligibility are checked without changing the source snapshot. Debit, persistence, source withdrawal and reopening retain the owned ledger without granting automatic refill, recovery or marker-based ownership. Generic/manual counters are not adopted. Unknown authority, malformed mirrors, lock changes and stale/duplicate requests are held atomically.

The UI adds explicit balance confirmation and a bounded debit control. Editing the value invalidates its confirmation; acknowledgement requires the validated owned transaction receipt. Current permission and resource locks also guard intentional authorized Undo/redo, while the existing three-way merge and unrelated manual history behavior remain unchanged.

## Directed evidence

The final source gate passed 124 checks with zero skips; the affected UI/SSR/history gate passed 22 with zero skips. Installed TypeScript and diff checks passed. First red cases and a prior unchanged ordinary-source cold-test timeout were retained; that unchanged four-case gate passed its bounded serial recheck without changing assertions or time limits.

Four rendered-control tests are authored but were not executed locally because the installed DOM environment is absent. They are not counted as passes. Actual App/browser acceptance, grouped full-source replay, updated data report and exact-head full CI are pending.

## Explicit limitations

This supports only the identified fixed-cost accounting branch. Item effects, spell execution, commands, targets/triggers, action time, damage, duration, concentration, expiry and recovery remain manual. No assertion, timeout, skip, source denominator or existing accepted browser check was relaxed. No private cards, source bodies or internal work notes are included.
