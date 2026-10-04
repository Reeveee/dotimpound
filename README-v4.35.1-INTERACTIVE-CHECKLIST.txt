SA DOT v4.35.1 - Interactive Vehicle Inspection

Baseline:
- Branched directly from SA-DOT-v4.35-Exact-Postal-Tracker.
- Postal tracker, tow requests, road closures, impounds, releases, LEO portal and Supabase logic left intact.

Vehicle Checklist upgrades:
- Vehicle field changed to the six DOT fleet options.
- Optional TEST action for every inspection category.
- Each test has its own RP diagnostic animation.
- Tested / Pass / Issue live counters.
- NEXT UNCHECKED navigation.
- Optional RUN WALKAROUND DEMO cycles through all ten diagnostics.
- Completion banner and stronger visual feedback for PASS, ISSUE and TESTED.
- Existing PASS/ISSUE storage schema remains unchanged.
- Diagnostic-test state is draft-only browser state and does not require a Supabase schema change.

Fleet options:
DOT Pickup
DOT Heavy Pickup
DOT Flatbed
DOT Heavy Flatbed
DOT Commercial Flatbed
DOT Large Flatbed
