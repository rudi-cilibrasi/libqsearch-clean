# End-user interface policy

Updated 2026-08-09 (Asia/Ho_Chi_Minh).

The workbench GUI is a research product for people comparing objects, not a live debugger for its implementation. Every visible element should help a user prepare inputs, start or stop an action, understand progress, inspect a scientific result, recover from an error, or export their work.

The primary interface may show canonical object names, input counts, meaningful loading or completion states, the NCD matrix, deterministic group memberships, nearest-pair and relative-isolation summaries, the inferred tree, the K-grid arrangement, and controls needed to inspect those results. A separation summary must include the limitation needed to interpret it; longer method and corpus caveats belong in technical documentation.

The GUI must not expose internal object identifiers, random seeds, protocol or cache versions, worker throughput, iteration counters, objective-function values, debug messages, or implementation-oriented status bars. A research section may show the selected topology's aggregate recurrence across the bounded search schedule only when it is labeled optimization repeatability and explicitly distinguished from bootstrap support or scientific confidence. Seeds, per-run scores, internal topology identifiers, and edge-level search diagnostics remain available through typed computation results, explicit research exports, browser or worker logs, automated tests, and technical documentation. An error shown to a user should describe what failed and what they can do next; internal stack traces and transport details stay in logs.

New interface work should apply this test before adding text or controls: if the information is useful mainly for diagnosing the implementation and does not help the user make a decision about their data or result, it does not belong in the production GUI.
