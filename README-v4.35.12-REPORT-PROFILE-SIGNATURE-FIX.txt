SA DOT v4.35.12

- Fixed/hardened Generate Discord Image so missing random signature assets cannot silently stop the export.
- Generator now reports any browser/export error visibly.
- New towing reports prefill DOT Operator Name from Account -> Operator Profile.
- DOT operator signature is generated from the saved account profile name instead of a random asset.
- Vehicle owner and officer signatures still use the 30-style random signature pool.
- Saving a new profile name updates the towing report prefill and operator signature immediately.
- Existing Account, Past Reports, Past Checklists, tracker changes and report variants are retained.
