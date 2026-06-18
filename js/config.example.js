/* =========================================================================
   config.example.js  —  TEMPLATE
   -------------------------------------------------------------------------
   1. Copy this file and rename the copy to:  config.js
   2. Paste your OneMap API token between the quotes below.
   3. NEVER commit config.js (it is listed in .gitignore).

   How to get a token:
     - Register a free account at https://www.onemap.gov.sg/apidocs/register
     - Generate a token from your account / the auth endpoint.
     - OneMap tokens are SHORT-LIVED (they expire after ~3 days), so you will
       need to regenerate it periodically. See README.md "Authentication".
   ========================================================================= */

window.ONEMAP_CONFIG = {
  // Paste your token here. Leave as "" to run with basemap + search only.
  token: "PASTE_YOUR_ONEMAP_TOKEN_HERE",
};
