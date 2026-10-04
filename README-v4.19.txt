SA DOT v4.19 - Operator Identity Fix

- Live DOT login now clears any previous Supabase operator session before signing in.
- admin.html always resolves the displayed operator from the current authenticated user's UUID in dot_staff.
- Switching from dot2 to dot1/Belanger no longer carries dot2's display identity forward.
- Logout clears the local operator display hint.
- Operator avatar initials now follow the logged-in username.
- Local file demo still intentionally uses the demo operator dot2 because there is no Supabase login in file:// demo mode.
