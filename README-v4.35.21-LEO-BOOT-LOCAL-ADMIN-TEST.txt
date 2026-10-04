SA DOT v4.35.21

Changes:
- LEO remembered sessions now still play the secure boot animation on every police.html load.
- Local file:// admin dashboard now signs in as ADMIN for testing.
- Local file:// LOG OUT no longer calls Supabase; it returns to index.html cleanly.
- Live login/logout behaviour is unchanged.
- Postal 3000 tow request path tested locally: request submission/tracker accepts the postal text. Postal 3000 remains unmapped on the dispatch map coordinate lookup for now.
