# End-user interface policy

Updated 2026-08-06 (Asia/Ho_Chi_Minh).

The workbench GUI is a research product for people comparing objects, not a live debugger for its implementation. Every visible element should help a user prepare inputs, start or stop an action, understand progress, inspect a scientific result, recover from an error, or export their work.

The primary interface may show canonical object names, input counts, meaningful loading or completion states, the NCD matrix, the inferred tree, the K-grid arrangement, and controls needed to inspect those results. Scientific caveats belong in the method and corpus documentation when they are not necessary to interpret the immediate view.

The GUI must not expose internal object identifiers, random seeds, protocol or cache versions, worker throughput, iteration counters, objective-function values, raw topology-search counts, debug messages, or implementation-oriented status bars. These values remain available through typed computation results, explicit research exports, browser or worker logs, automated tests, and technical documentation. An error shown to a user should describe what failed and what they can do next; internal stack traces and transport details stay in logs.

New interface work should apply this test before adding text or controls: if the information is useful mainly for diagnosing the implementation and does not help the user make a decision about their data or result, it does not belong in the production GUI.
