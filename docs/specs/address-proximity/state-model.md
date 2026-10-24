# Address proximity state model

- STATE-01: Not requested → native foreground permission request on first Address focus. A local installation flag is saved before requesting. Concurrent requests share one permission promise.
- STATE-02: Granted → permission recheck → one low-accuracy fix or an unexpired rounded fix. No escalation from approximate permission. Acquisition deadline: three seconds, excluding time the user spends in the permission dialog.
- STATE-03: Denied, blocked, expired one-time permission, disabled services, error or timeout → business fallback. Previously attempted permission is never requested automatically again.
- STATE-04: Device unavailable → one deduplicated business lookup → rounded point or no bias. Business lookup failure cannot prevent ordinary suggestions.
- STATE-05: Privacy Choices device switch → first native request for a never-requested permission, otherwise FieldSoli's device Settings. Keep the displayed switch at the OS-reported value until the request completes or the app returns to the foreground; then refresh location and Contacts metadata. Full and limited Contacts access display on. Opening the screen never requests access or reads location/contact content.
- STATE-06: Background → abort active interaction and invalidate all caches. Foreground → resolve anew if the field remains focused. Native permission dialogs may temporarily make iOS inactive; that alone does not count as backgrounding.
- STATE-07: Sign-out/account switch/save Business Details → invalidate caches and pending generations. Old-account responses never populate a new cache or an active field.
- STATE-08: Blur/unmount/query change → ignore stale location or autocomplete responses. Track actual input focus separately from retained suggestion-panel visibility: blur aborts the location interaction and ignores pending autocomplete responses, while already displayed suggestions remain tappable. Background/foreground invalidation cannot restart device, business, or autocomplete lookups for a blurred field; refocusing starts a new interaction. Query edits retain the resolved bias while focused. Late timed-out device fixes never enter caches.

Device fixes expire after 60 seconds without sliding renewal. Business results (including null) expire after five minutes. Coordinates never survive app termination.
