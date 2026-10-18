# QA code follow-up — 2026-10-18

Two issues from the simulator reports were addressed:

- Completion wizard: after the final focused editor saves, queue the requested Complete/Paid review until Job View has committed. Focused editors omit Documents, so opening their invoice controller immediately caused “Invoice review is unavailable.” The review now uses the mounted View controller and preserves the requested status.
- Quick Material: keep negative total/unit-price input visible, reject negative totals, unit prices and quantities, and prevent Save or Add to job until corrected. Blur preserves invalid input for correction rather than turning it into a positive amount or hiding it.

Validation: both targeted mobile Jest suites passed, 80 tests total. Mobile TypeScript checking also passed with workspace package paths mapped to this checkout and an increased Node stack. The wizard regression uses a focused editor without a Documents controller and confirms that final Done opens review once without committing status. Material regressions cover ASCII/Unicode minus input, correction, blur, and the assignment bypass. These fixes have not yet been rerun on the simulator.

The original requirement-related portion of FIND-01 was based on the older contract. Current invoicing contracts intentionally require financial final review for Complete/Paid; no change to that requirement is part of these fixes.
