SA DOT v4.30 - Road Closure Live Fix
- Road closure submission uses submit_road_closure_request RPC in both legacy/current handlers.
- No direct road_closure_requests inserts remain in police.js.
- police.js cache-busted in police.html (?v=430) to prevent an older browser/CDN copy loading.
- Based on v4.29/v4.28 feature set, preserving Vehicle Checklist and LEO Tow Tracking.
Deploy the CONTENTS of this folder to the existing Netlify site.
