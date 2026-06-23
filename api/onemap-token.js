/* =========================================================================
   api/onemap-token.js — Vercel serverless function (Node runtime)
   -------------------------------------------------------------------------
   Issues short-lived OneMap access tokens to the browser WITHOUT exposing the
   OneMap account credentials.

   Why this exists:
     OneMap has no refresh token and no OAuth refresh flow. The ONLY way to get
     a new token is to POST email+password to getToken again. Putting those
     credentials in client-side JS would leak your whole account, so the
     credentials live here as server-only environment variables. The browser
     only ever receives the 3-day access token, never the password.

   Flow:
     GET /api/onemap-token
       -> returns { access_token, expiry_timestamp } (epoch seconds)
     Internally this caches the token in module scope (persists while the
     lambda is warm) and only re-calls OneMap's getToken when the cached token
     is missing or within RENEW_SKEW_MS of expiry.

   Required environment variables (set in Vercel / .env.local):
     ONEMAP_EMAIL     - the email you registered at onemap.gov.sg/apidocs
     ONEMAP_PASSWORD  - that account's password
   ========================================================================= */

"use strict";

const GET_TOKEN_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";

// Renew this far ahead of the real expiry so a request never goes out with a
// token that dies mid-flight.
const RENEW_SKEW_MS = 10 * 60 * 1000; // 10 minutes

// Module-scope cache. On Vercel this survives between invocations for as long
// as the function instance stays warm, so most page loads cost zero calls to
// OneMap. A cold start simply mints one fresh token.
let cached = { token: null, expiresAt: 0 };

// Coalesce concurrent cold-start requests onto a single getToken call.
let inFlight = null;

// OneMap returns expiry_timestamp as Unix *seconds* (a string). Normalise to
// epoch milliseconds, tolerating seconds-vs-ms and bad/missing values.
function toExpiryMs(expiryTimestamp) {
  const n = Number(expiryTimestamp);
  if (Number.isFinite(n) && n > 1e9) {
    return n < 1e12 ? n * 1000 : n; // < 1e12 means it's in seconds
  }
  // Fallback: assume the documented 3-day TTL.
  return Date.now() + 3 * 24 * 60 * 60 * 1000;
}

async function mintToken() {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;

  if (!email || !password) {
    const e = new Error(
      "Server is missing ONEMAP_EMAIL / ONEMAP_PASSWORD environment variables."
    );
    e.code = "NO_CREDENTIALS";
    throw e;
  }

  let res;
  try {
    res = await fetch(GET_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (networkErr) {
    const e = new Error(`Could not reach OneMap: ${networkErr.message}`);
    e.code = "UPSTREAM_UNREACHABLE";
    throw e;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    // OneMap returns 401 + an "error" message for bad credentials.
    const e = new Error(
      data.error || `OneMap getToken failed (HTTP ${res.status}).`
    );
    e.code = res.status === 401 ? "BAD_CREDENTIALS" : "UPSTREAM_ERROR";
    e.status = res.status;
    throw e;
  }

  cached = {
    token: data.access_token,
    expiresAt: toExpiryMs(data.expiry_timestamp),
  };
  return cached;
}

async function getCachedToken() {
  const fresh = cached.token && Date.now() < cached.expiresAt - RENEW_SKEW_MS;
  if (fresh) return cached;

  if (!inFlight) {
    inFlight = mintToken().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

module.exports = async (req, res) => {
  // Never let a CDN or browser cache a bearer token.
  res.setHeader("Cache-Control", "no-store");

  try {
    const { token, expiresAt } = await getCachedToken();
    res.status(200).json({
      access_token: token,
      // Mirror OneMap's own field name; epoch seconds.
      expiry_timestamp: Math.floor(expiresAt / 1000),
    });
  } catch (err) {
    const status =
      err.code === "NO_CREDENTIALS" ? 500 : // our config problem
      err.code === "BAD_CREDENTIALS" ? 502 : // upstream rejected our creds
      502;                                    // upstream/network problem
    res.status(status).json({
      error: err.message,
      code: err.code || "ERROR",
    });
  }
};
