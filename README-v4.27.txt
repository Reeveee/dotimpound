SA DOT v4.27 - LEO Tow Tracking

Adds transmission confirmation animation, automatic live tow tracking after submission, progress stages, assigned DOT operator display, completion/impound result, and Track Existing Request by TR reference.

No new database schema is required. The live tracker reads the existing tow_requests record by reference. Existing Supabase SELECT policy/RPC access must permit the LEO client to read tow request status.
