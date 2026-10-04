SA DOT v4.35.11
- Fixed blank postal tracker: old prototype pins referenced unmapped postals.
- Tracker now shows live requests when request text contains a verified postal, otherwise valid verified reference pins are shown.
- Added top-right Account option.
- Account opens with tablet boot animation and game-style folders: Past Checklists, Past Reports, Operator Profile.
- Operator Profile name prefills new Discord reports.
- Generated towing reports save into Past Reports for the signed-in browser account and can be reopened.
- Added second generated report style: Highway Operations, alongside Operations Slate.
No Supabase schema changes required. Account profile/Past Reports are browser-local per signed-in DOT user.
