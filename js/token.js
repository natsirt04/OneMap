/* =========================================================================
   js/token.js — OneMap token manager (browser side)
   -------------------------------------------------------------------------
   OneMap tokens last ~3 days and there is NO refresh token: the only way to
   renew is to mint a brand-new one. This module hides that from the rest of
   the app behind a single call:

       const token = await OneMapAuth.getToken();

   How it gets a token (in priority order):
     1. The serverless endpoint /api/onemap-token  (the recommended path —
        your credentials stay on the server, the browser never sees them).
     2. A token pasted into js/config.js            (local fallback for a
        plain static server like `serve` / Live Server that can't run the
        serverless function).

   What it does for you:
     - Caches the token in memory with its expiry.
     - Renews proactively: a token within RENEW_SKEW_MS of expiry is treated
       as already stale, so requests never go out with a dying token.
     - Coalesces concurrent callers onto a single network request.
     - Supports a forced refresh (used to retry a request after a 401).
   ========================================================================= */

(function () {
  "use strict";

  const TOKEN_ENDPOINT = "/api/onemap-token";

  // Treat a token as stale this far before its real expiry.
  const RENEW_SKEW_MS = 10 * 60 * 1000; // 10 minutes

  // Assumed lifetime when we can't tell (e.g. a token from config.js whose
  // expiry we don't know). Keeps the cache from re-fetching every call.
  const ASSUMED_TTL_MS = 3 * 24 * 60 * 60 * 1000;

  let cache = { token: null, expiresAt: 0 }; // expiresAt = epoch ms
  let inFlight = null;

  function configToken() {
    const t = window.ONEMAP_CONFIG && window.ONEMAP_CONFIG.token;
    return t && !t.startsWith("PASTE_") ? t : null;
  }

  function isFresh() {
    return cache.token && Date.now() < cache.expiresAt - RENEW_SKEW_MS;
  }

  function toExpiryMs(expiryTimestamp) {
    const n = Number(expiryTimestamp);
    if (Number.isFinite(n) && n > 1e9) {
      return n < 1e12 ? n * 1000 : n; // seconds vs ms
    }
    return Date.now() + ASSUMED_TTL_MS;
  }

  async function fetchFromServer() {
    const res = await fetch(TOKEN_ENDPOINT, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(
        body.error || `Token endpoint failed (HTTP ${res.status}).`
      );
      err.status = res.status;
      err.code = body.code;
      throw err;
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error("Token endpoint returned no access_token.");
    }

    cache = {
      token: data.access_token,
      expiresAt: toExpiryMs(data.expiry_timestamp),
    };
    return cache.token;
  }

  async function refresh() {
    try {
      return await fetchFromServer();
    } catch (serverErr) {
      // No serverless function available (plain static host) or it errored —
      // fall back to a token in config.js if one was provided.
      const fallback = configToken();
      if (fallback) {
        cache = { token: fallback, expiresAt: Date.now() + ASSUMED_TTL_MS };
        return fallback;
      }
      throw serverErr;
    }
  }

  /**
   * Get a valid OneMap token, minting/renewing as needed.
   * @param {{force?: boolean}} [opts] force=true bypasses the cache (used to
   *        retry once after a 401).
   * @returns {Promise<string>}
   */
  async function getToken(opts) {
    const force = opts && opts.force;
    if (!force && isFresh()) return cache.token;

    if (!inFlight) {
      if (force) cache = { token: null, expiresAt: 0 };
      inFlight = refresh().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  window.OneMapAuth = { getToken };
})();
