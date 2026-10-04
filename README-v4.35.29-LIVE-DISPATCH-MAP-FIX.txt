SA DOT v4.35.29

- Removed all fake/prototype map calls from the deployed dashboard.
- Dispatch map now renders ONLY current active Tow Requests and Road Closure jobs.
- Map reset restores the current live jobs instead of accidentally loading prototype markers.
- If a live job has no postal, the map tells you that instead of inventing a marker.
- If a live job uses a postal not present in the current coordinate map (for example postal 3000), it is counted as unmapped and no fake marker is shown.
- Manual postal lookup remains available.
