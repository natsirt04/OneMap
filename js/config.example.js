/* =========================================================================
   config.example.js  —  OPTIONAL LOCAL FALLBACK
   -------------------------------------------------------------------------
   PREFERRED setup: don't use this file at all. Set ONEMAP_EMAIL /
   ONEMAP_PASSWORD (see .env.example) and let the /api/onemap-token serverless
   function mint and auto-renew tokens for you. See README.md "OneMap
   Authentication".

   This file is only a FALLBACK for running on a plain static server (e.g.
   `serve` / Live Server) that can't execute the serverless function. In that
   case:
     1. Copy this file and rename the copy to:  config.js
     2. Paste a token between the quotes below (it still expires after ~3 days,
        so you'll have to refresh it manually — that's exactly the chore the
        serverless function removes).
     3. NEVER commit config.js (it is listed in .gitignore).

   Get a token: register at https://www.onemap.gov.sg/apidocs/register, then
   POST your email+password to https://www.onemap.gov.sg/api/auth/post/getToken.
   ========================================================================= */

window.ONEMAP_CONFIG = {
  // Optional fallback token. Leave as "" to rely on the serverless endpoint,
  // or to run with basemaps + Search only.
  token: "PASTE_YOUR_ONEMAP_TOKEN_HERE",
};
