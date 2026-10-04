SA DOT v4.35.6

Built from v4.35.5.

Vehicle checklist:
- Keeps the simple CSS/HTML truck style.
- Truck is now more recognisable as the SA DOT roadside assistance pickup:
  crew-cab shape, orange/white livery, H361, E-ZPass detail, white utility body,
  State Farm detail, black push bar, amber/white lightbar, message-board rack,
  utility compartments and tow gear.
- Existing test animations remain.

Auto Walkaround:
- AUTO WALKAROUND now runs every diagnostic in sequence.
- Each diagnostic runs for about 1.85 seconds.
- It automatically marks that check PASS.
- It shows the PASS state, then automatically advances to the next guided step.
- The operator can stop it at any time.
- Manual PASS / ISSUE can still override results afterwards.

Discord Report:
- New three-option report menu:
  1. DOT Towing Report (clickable)
  2. DOT Sign Truck Incident Report (clickable)
  3. DOT Road Closure Report (darkened and disabled)
- The first two options currently open a selected-template workspace ready for us to build the actual generator fields next.
- No Discord sending/webhook logic yet.
- No database changes required.
