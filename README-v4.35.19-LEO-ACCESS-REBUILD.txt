SA DOT v4.35.19

LEO menu access rebuilt to remove the fragile browser prompt gate.

Changes:
- Public portal LEO link now navigates directly to police.html.
- police.html always loads normally.
- LEO code entry is now an in-page secure terminal overlay.
- Correct code remains: dotpd
- Successful access is remembered where localStorage is available.
- If browser storage is unavailable, the current page session still works.
- Added short secure-session boot animation after authentication.
- Existing Tow / Road Closure / DMV / Vehicle Release functions retained.
- No Supabase/database changes required.
