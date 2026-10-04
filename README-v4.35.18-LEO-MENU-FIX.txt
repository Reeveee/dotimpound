SA DOT v4.35.18

LEO Menu repair:
- Removed legacy duplicate/stale LEO navigation helpers from police.js.
- Removed the duplicate old submitClosure implementation.
- Rebuilt openLeoService around the current page IDs only.
- Added a known-good home/menu reset on page load and browser back/forward restore.
- Added cache-busting versions to police.css/js/gate/config references so Netlify/browser cannot mix old LEO assets with the new deploy.
- Preserves the v4.35.17 compact Discord report redesign.
