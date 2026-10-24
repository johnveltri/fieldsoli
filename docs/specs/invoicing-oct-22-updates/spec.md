# Invoicing October 22 updates

Status: Implementation approved 2026-10-24; see implementation-evidence.md for validation and remaining release gates.
Last updated: 2026-10-22. Source: TestFlight reports on physical iPhone 17 Pro Max.

## Outcome and scope

Resolve all ten reports in existing Job, Business Details, document and sharing flows. The requirement table in [decision-packet.md](decision-packet.md#scope-and-proposed-acceptance-checks) owns REQ-01–REQ-10 as incorporated product requirements; its proposed checks are adopted by this spec, with these final decisions:

- Paid and In Progress jobs support creating and opening invoices, preserving current payment confirmation and default-type rules.
- The rich preview includes business name, document type, immutable total and immutable Job short title; FieldSoli is secondary. SMS leads with amount rather than number.
- “Buddy name” was in the To field. Never provide a name or invalid phone as a recipient. Verify iOS display-name resolution separately.
- Business address lookup is optional enhancement of the existing editable address, using the existing provider.

Existing immutable documents, selected invoice Revenue and Paid status semantics remain authoritative. Material view uses the current override/default calculation; it does not introduce new pricing rules or retroactively change snapshots. Existing contracts remain applicable except where these explicit copy/presentation changes supersede invoicing UX-07/09 and require synchronization during implementation.

## Artifact manifest

| Artifact | Applicability | Reason |
| --- | --- | --- |
| [state-model.md](state-model.md) | Required | Lookup, resume, creation and native handoff recovery |
| [data-contract.md](data-contract.md) | Required | Provider requests, derived prices, snapshot contacts and metadata |
| [ux-contract.md](ux-contract.md) | Required | Visible flows, exact copy, keyboard and accessibility |
| [test-contract.md](test-contract.md) | Required | Cross-layer and physical-device evidence |
| [plan.md](plan.md) | Required | Dependency-aware execution and release gates |

## Constraints and non-goals

Reuse current components and native primitives; add no provider, paid tier, or UI dependency. Do not change contact ownership, payment semantics, address deliverability guarantees, schema without demonstrated need, or existing document content. Keep manual entry available. No roadmap work. Deployments, production data changes and TestFlight submission need separate authorization.

## Acceptance

Every REQ must pass its TEST with the relevant STATE/DATA/UX rules. A mocked provider or simulator-only SMS check is insufficient. Root causes remain diagnostic tasks, not asserted conclusions. No product decisions remain open; new paid commitments or financial lifecycle changes require returning to PM.

## Deferred

No reported issue deferred. New providers, accounting features, contact management and guaranteed external preview-cache recall are outside scope.
