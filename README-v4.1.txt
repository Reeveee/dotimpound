DOT Impound Portal v4.1 - Police Tow Request

BASELINE: v4 Shared remains the stable rollback version. This package branches from v4.

INSTALL:
1. Supabase > SQL Editor > New Query. Run v4.1-police-tow-upgrade.sql once.
2. Deploy the dot-impound folder to the existing Netlify site.
3. Existing SUPABASE_SECRET_KEY environment variable is unchanged.

NEW FLOW:
Public index > POLICE MENU > enter plate on the San Andreas plate > submit tow request.
DOT staff > TOW REQUESTS > CLAIM > EN ROUTE > ON SCENE > IMPOUND or NO IMPOUND.
IMPOUND automatically creates the standard $495 active impound using the request details.
