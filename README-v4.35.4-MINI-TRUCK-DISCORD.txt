SA DOT v4.35.4 - Mini Truck + Discord Report

Built directly from approved v4.35.3 Smoother Guided Checklist.

Vehicle Checklist:
- Keeps the guided checklist layout and smoother animations unchanged.
- Adds a SMALL animated 2D DOT truck to the right-hand side of Guided mode.
- It is deliberately a visual companion, not a new large vehicle viewer.
- It reacts to the currently running diagnostic:
  Tyres -> wheels move
  Lights -> bar/grille/headlights flash
  Brakes -> rear brake lamp pulses
  Fluids -> bonnet raises
  Body -> scan line moves over vehicle
  Tow -> hitch extends
  Safety -> utility kit pulses
  Radio -> signal waves animate
  Cab -> wipers sweep
  Fuel -> gauge fills
- PASS / ISSUE / TESTED states are reflected in its status label.

Left menu:
- Added new DISCORD REPORT section.
- Added a basic Discord Report workspace shell only.
- No form fields, Discord webhooks, database changes or sending actions yet. That module is ready for the next step.

No Supabase changes required.
