SA DOT v4.29 - Road Closure RPC Fix

Changes:
- LEO Road Closure submission now uses the secure Supabase RPC: submit_road_closure_request.
- Removes the anonymous direct INSERT path that was blocked by row-level security.
- Preserves v4.28 Vehicle Checklist and v4.27 LEO Tow Tracking functionality.

Required Supabase setup:
- public.road_closure_requests table
- public.submit_road_closure_request(text,text,text,text,text,text,text,text,text) RPC
These were supplied separately in the SQL fix prior to this build.
