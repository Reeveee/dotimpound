SA DOT v4.35.28

DEPLOYMENT AUTH FIX
- Removed the unconditional dot21 mock account from deployed admin.html.
- Normal http/https deployments now use the real Supabase authenticated session.
- Local file:// testing still uses a demo ADMIN account only.
- Logout now signs out the local Supabase browser session, clears the cached operator hint, and returns to login.html.
- Cache versions bumped to v4.35.28.

Expected deployed behavior:
1. Open login.html.
2. Sign in with a real DOT account.
3. admin.html resolves the operator from the authenticated Supabase user UUID.
4. LOG OUT clears that session and returns to login.html.
