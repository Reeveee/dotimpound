SA DOT v4.22 – LEO Vehicle Release

Adds a fourth LEO Menu option: VEHICLE RELEASE.
- Restricted LEO view shows only PAID / ready-for-release impounds.
- LEO cannot access DOT Tow Requests, Road Closures, Impounds, Staff or SOP from this terminal.
- Releasing a vehicle asks only for officer callsign. No notes or character-name field.
- Release updates the shared impound to RELEASED, so it disappears from ready-for-release and no longer triggers the DMV active-impound alert.
- Local file demo contains three sample paid vehicles.

LIVE DEPLOYMENT:
1. Keep SUPABASE_SECRET_KEY configured in Netlify (do not place the secret in browser files).
2. Deploy this whole folder to the existing Netlify site.
3. Optional but recommended: run v4.22-leo-release.sql once in Supabase to store release_callsign for audit/history.

LEO access code remains: dotpd
