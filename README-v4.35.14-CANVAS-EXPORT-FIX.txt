SA DOT v4.35.14

Fixes the Discord report PNG export error: "Tainted canvases may not be exported".

The report generator no longer draws external PNG signature assets onto the export canvas.
Owner and officer signatures are now drawn procedurally on the canvas using the same randomly selected 1-30 signature slot as a deterministic seed, so they remain varied while keeping the canvas origin-clean.
The account/operator signature still uses the saved Account → Operator Profile name.

The 30 signature assets remain in the site for the on-screen preview/shuffle UI.
