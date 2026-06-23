# OneMap Reference

A small starter kit for putting Singapore maps on a web page, built on the
official [OneMap](https://www.onemap.gov.sg/home) basemaps and APIs. There's no
build step and no framework to learn. You clone it, add your OneMap credentials,
and open the page.

Open `index.html` in a browser and you've got:

- OneMap basemaps (Default, Grey, Night, Original)
- A draggable marker with popups
- **Search API**: find any Singapore address or building
- **Reverse Geocode API**: click the map, get the nearest address
- **Themes API**: overlay live data like libraries, hospitals, and hawker centres
- **My location**: reads your phone's GPS through the browser Geolocation API
- **Routing API**: walk, drive, or cycle directions from where you are to a search result
---

## Project structure

```
onemap-reference/
├── README.md
├── .gitignore
├── .env.example          # serverless credential template (committed)
├── .env.local            # YOUR OneMap email+password (git-ignored — create this)
├── index.html            # the page + Leaflet/OneMap setup
├── api/
│   └── onemap-token.js   # serverless endpoint that mints & auto-renews tokens
├── css/
│   └── styles.css        # layout & theme
├── js/
│   ├── token.js          # browser token manager (cache, renew, retry)
│   ├── app.js            # all the map logic
│   ├── config.example.js # OPTIONAL static-fallback token template (committed)
│   └── config.js         # OPTIONAL fallback token (git-ignored — create this)
└── assets/               # your images / data
```

---

## Quick start

Three steps to a running map on your own machine.

1. **Get the code**

   ```bash
   git clone https://github.com/natsirt04/OneMap.git
   cd OneMap
   ```

2. **Add your OneMap credentials**

   The recommended way is the serverless endpoint, which renews tokens for you.
   Put your OneMap account email and password in a local env file:

   ```bash
   cp .env.example .env.local
   # then edit .env.local with your real OneMap email + password
   ```

   `.env.local` is git-ignored, so your credentials never get pushed. Basemaps
   and Search work without any token, but Reverse Geocode, Themes, and Routing
   need one, and the serverless endpoint supplies it.

   > Don't want to run the serverless function locally? You can paste a single
   > token into `js/config.js` (`cp js/config.example.js js/config.js`) as a
   > fallback instead. That token still expires every ~3 days and you'll have to
   > replace it by hand. See [OneMap Authentication](#onemap-authentication).

3. **Run it**

   To run the serverless token endpoint locally, use `vercel dev`. It reads
   `.env.local` and serves both the page and `/api/onemap-token`:

   ```bash
   npm i -g vercel        # one time
   vercel dev             # serves http://localhost:3000
   # or: npm run dev:api  (binds port 5500)
   ```

   If you're using the `js/config.js` fallback instead, any plain static server
   works. The serverless function just won't run:

   ```bash
   python -m http.server 5500     # Python 3
   npx serve .                    # Node
   # VS Code: right-click index.html → "Open with Live Server"
   ```

   Open the printed `http://localhost:...` URL. Because `localhost` counts as a
   secure origin, even GPS works here.

---

## Put it on your phone (Vercel)

Testing a map on a phone is tricky: you can't just open the file, and phones
won't hand over GPS unless the page is served over HTTPS. Deploying to Vercel
fixes both. The free Hobby plan takes about a minute and gives you HTTPS for
free, so the URL opens on any phone, not only one sitting on your Wi-Fi.

### Deploy it

```bash
npm i -g vercel    
cd OneMap
vercel login

# Set your OneMap credentials as encrypted env vars (To be done through online first).
# Paste the value when prompted; pick "Production" (and Preview/Development).
vercel env add ONEMAP_EMAIL
vercel env add ONEMAP_PASSWORD

vercel --prod
```

The env vars feed the `api/onemap-token.js` serverless function, which mints and
renews OneMap tokens on the server. Your email and password stay on Vercel's side
and never get shipped to the browser. The CLI uses `.vercelignore` (not
`.gitignore`) to decide what to upload, and we deliberately keep `js/config.js`
and `.env*` out of the deployment so no secret ends up in the client bundle.
Connecting a Git repository is fine here too, since the credentials live in
Vercel env vars rather than in any uploaded file.

When it's done you'll see two URLs. Use the short **aliased** one, something like
`https://onemap-reference.vercel.app`. It stays put on every future deploy. The
longer `...-xxxx.vercel.app` link is tied to one specific build.

One reason this setup matters: a static site ships its JavaScript to the browser,
so a token pasted into `config.js` is readable by anyone who opens the page, and
it dies every 3 days anyway. Minting tokens server-side keeps your credentials
private and makes renewal automatic.

### Open it on an iPhone

1. Open the `vercel.app` URL in Safari.
2. Tap **☰ Menu → 📍 Use my location**, then **Allow** on the prompt.
3. No prompt, or it says permission denied? iOS turns off Safari location at the
   system level by default. Go to **Settings → Privacy & Security → Location
   Services**, make sure it's on, scroll down to **Safari Websites**, and set it
   to "While Using the App" or "Ask". Reload the page and try again.
4. Want it to feel like a real app? Tap the **Share** icon, then **Add to Home
   Screen**. You get an icon, full screen, and an offline shell.

### Open it on an Android phone

1. Open the URL in Chrome.
2. Tap **☰ Menu → 📍 Use my location**, then **Allow**.
3. If location stays dead, check that both **Chrome ⋮ → Settings → Site settings
   → Location** and Android's own **Settings → Location** are switched on.
4. Install it the same way: **Chrome ⋮ → Add to Home screen**.

### Share it

The deployed link is just a link. Send `https://onemap-reference.vercel.app` to a
teammate or a judge and it opens on their phone with no install and no account.
That's the real payoff of deploying instead of tunneling off your laptop.

### Update it after you change code

Vercel doesn't watch your editor, so changes don't go live on their own. When
you're ready to push an update, run the same command again:

```bash
vercel --prod
```

A static deploy is usually live within a few seconds, and the aliased URL updates
in place, so any link you already shared keeps working. Refresh the phone to see
the new build. If it looks stuck on the old one, pull to refresh, or close and reopen the tab.

---

## OneMap Authentication

### Why tokens expire after 3 days

OneMap authentication is deliberately simple. You `POST` your account email and
password to `https://www.onemap.gov.sg/api/auth/post/getToken` and get back a JWT
plus an `expiry_timestamp`:

```jsonc
// POST https://www.onemap.gov.sg/api/auth/post/getToken
// { "email": "you@example.com", "password": "•••••••" }
{
  "access_token": "eyJhbGciOi...",   // a JWT
  "expiry_timestamp": "1718000000"   // Unix epoch seconds, ~3 days out
}
```

That JWT has a fixed 3-day TTL baked into it, and OneMap gives you no way to
extend it. There is:

- no refresh token,
- no token rotation,
- no OAuth refresh flow,
- no "renew" endpoint.

The only way to get a valid token after expiry is to call `getToken` again with
your credentials. OneMap's own
[authentication](https://www.onemap.gov.sg/apidocs/authentication) and
[token-management](https://www.onemap.gov.sg/apidocs/docs/tokenmanagement) docs
say as much (the second one is literally titled *"Managing and Refreshing OneMap
Token Validity in NodeJS"* and recommends re-calling `getToken`), and so does
SLA's own
[authentication module](https://github.com/sla-onemap/authentication_module_for_Windows_x64/blob/master/authentication_module/auth.go),
which caches the token to a file and mints a new one when it expires.

### How automatic renewal works

There's no refresh token, so "automatic renewal" here means automatically
re-authenticating: minting a brand-new token before the old one dies, without you
ever touching it. Two pieces cooperate:

1. **`api/onemap-token.js`** — a Vercel serverless function. It holds your
   credentials as server-side env vars, calls `getToken`, and caches the token in
   memory (the cache survives across requests while the function is warm). It only
   re-calls OneMap when the cached token is missing or within 10 minutes of
   expiry, so page loads almost never hit OneMap. It returns only the token to the
   browser, never your password.

2. **`js/token.js`** — a browser-side token manager. `OneMapAuth.getToken()`
   caches the token in memory, treats it as stale 10 minutes before expiry so
   renewal happens early, and coalesces concurrent callers onto a single request
   so you don't fire off duplicate auth calls. Every authenticated API call goes
   through `onemapGet()` in `app.js`, which retries once with a freshly minted
   token if a request comes back `401`/`403`. So even a token that dies
   mid-session gets recovered without you noticing.

If the serverless endpoint isn't available (say you're on a plain static server),
`js/token.js` falls back to a token in `js/config.js`.

### Where credentials should be configured

| Environment | Put credentials in | Used by |
| --- | --- | --- |
| Local (`vercel dev`) | `.env.local` (`ONEMAP_EMAIL`, `ONEMAP_PASSWORD`) | serverless function |
| Local (static server) | `js/config.js` (single token, fallback) | browser fallback |
| Vercel (deployed) | `vercel env add ONEMAP_EMAIL` / `ONEMAP_PASSWORD` | serverless function |

Never hard-code credentials in committed files. `.env.local`, `.env`, and
`js/config.js` are all git-ignored and `.vercelignore`'d.

### Local development setup

Run `vercel dev` as shown in [Quick start](#quick-start). To confirm renewal is
working, open the browser console and look for `OneMap token acquired — all APIs
available.` You can also hit the endpoint directly:

```bash
curl http://localhost:3000/api/onemap-token
```

### Vercel deployment setup

Set `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` as Vercel env vars and deploy. The full
commands are in [Put it on your phone](#put-it-on-your-phone-vercel). The deployed
site calls `/api/onemap-token` on the same origin, so tokens renew themselves
server-side from then on. Changed your credentials? Update the env vars and
redeploy with `vercel --prod`.

### Which APIs need a token

- Register an account: <https://www.onemap.gov.sg/apidocs/register>
- The token goes in the `Authorization` request header (raw token, no `Bearer`).

| API | Token required? |
| --- | --- |
| Basemap tiles | No |
| Search | No |
| Reverse Geocode | Yes |
| Themes | Yes |
| Planning Area | Yes |
| Routing | Yes (in the `Authorization` header) |

---

## Troubleshooting

### "Authentication token expired"

You shouldn't see this once the serverless endpoint is set up. Expired tokens get
renewed automatically, and any `401`/`403` triggers a one-time retry with a fresh
token. If it keeps happening:

- You're on the **static fallback** (`js/config.js`) with an expired token. Mint a
  new one, or switch to the serverless endpoint (`vercel dev` or a deploy) so
  renewal becomes automatic.
- The serverless function can't renew (see *renewal failures* below). Check the
  browser console and the function logs (`vercel logs <url>`).

### Invalid credentials

Symptom: the page can't get a token; the console shows a `BAD_CREDENTIALS` error,
or `/api/onemap-token` returns HTTP `502`.

- Double-check `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` are the exact email and password
  you registered at <https://www.onemap.gov.sg/apidocs/register>.
- Test them directly:
  ```bash
  curl -X POST https://www.onemap.gov.sg/api/auth/post/getToken \
    -H "Content-Type: application/json" \
    -d '{"email":"you@example.com","password":"•••"}'
  ```
  A `401` with an error message means the credentials are wrong. Reset your
  password on the OneMap site if you need to.

### Missing environment variables

Symptom: `/api/onemap-token` returns HTTP `500` with `NO_CREDENTIALS`. The
function can't see `ONEMAP_EMAIL`/`ONEMAP_PASSWORD`.

- **Locally:** make sure `.env.local` exists (not just `.env.example`) and you're
  running `vercel dev`, not a plain static server. Restart `vercel dev` after
  editing `.env.local`.
- **On Vercel:** run `vercel env ls` to confirm both vars exist for the right
  environment (Production/Preview), then redeploy. Env var changes only take
  effect on a new deployment.

### Renewal failures

Symptom: tokens were working, then API calls start failing again.

- **Upstream or network:** `UPSTREAM_UNREACHABLE` / `UPSTREAM_ERROR` means OneMap's
  `getToken` couldn't be reached or returned an error. Usually transient, so
  retry. Check OneMap's status if it persists.
- **Clock skew:** the renewal window relies on the device clock. A badly wrong
  local clock can make tokens look valid when they aren't, or the reverse.
- **Service worker serving stale code:** after deploying new auth code, an old
  cached shell can linger. Hard-refresh, or in DevTools → Application → Service
  Workers click *Unregister*, then reload. The token endpoint itself is never
  cached (the SW skips `/api/`).

### Rate limiting

OneMap throttles repeated `getToken` calls. The design already keeps them to a
minimum (one warm in-memory cache on the server, one in the browser, renewing only
near expiry), so you should rarely get close to a limit. If you see `429` or
repeated auth failures:

- Don't hammer `getToken` in a loop or on every request. Let the cache do its job,
  and don't call `OneMapAuth.getToken({ force: true })` except to recover from a
  `401`.
- Back off and retry after a short wait. Tokens last 3 days, so you only really
  need a new one a couple of times a week.

---

## Using your location for directions

To note: there's no OneMap API that "connects to your phone." Your
location comes from the browser's
[Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API),
a W3C standard every mobile browser already ships. The app reads your GPS with
`navigator.geolocation`, then sends that coordinate to OneMap's
[Routing API](https://www.onemap.gov.sg/apidocs/routing) to draw the path:

```
GET /public/routingsvc/route?start={lat,lng}&end={lat,lng}&routeType=walk
Authorization: <your token>
→ route_summary.total_time (s), route_summary.total_distance (m),
  route_geometry (an encoded polyline we decode and draw)
```

To use it: tap **📍 Use my location**, pick Walk, Drive, or Cycle, then tap a
search result. A green route shows up with the time and distance.

The catch is that browsers only hand over GPS on a secure origin: HTTPS, or
`http://localhost`. That's why the phone steps go through Vercel, since the
`vercel.app` URL is HTTPS and location just works. Everything else (basemaps,
search, themes, clicking the map to reverse-geocode) runs fine without it.

### Letting your PC use your location

On your own machine `http://localhost` already counts as secure, so GPS works
while you develop. You just have to let the browser do it:

1. Open the app at **`http://localhost:5500`**, not a `file://` path and not your
   `192.168.x.x` address.
2. Click **📍 Use my location** and hit **Allow** when asked.
3. Blocked it earlier by accident? Click the lock or location icon at the left of
   the address bar and set Location back to Allow (in Chrome or Edge you can also
   open `chrome://settings/content/location` or
   `edge://settings/content/location`), then reload.
4. Check the OS too. On Windows, **Settings → Privacy & security → Location**
   should be **On**, with desktop apps allowed. A laptop with no GPS chip guesses
   from Wi-Fi, so don't be surprised if it lands a few streets off.

---

## OneMap basemaps used

Raster XYZ tiles (zoom 11–19):

```
https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png
https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png
https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png
https://www.onemap.gov.sg/maps/tiles/Original/{z}/{x}/{y}.png
```

Keep the attribution. OneMap requires it, and it's already wired into `app.js`, so
just leave it in.

---

## Official documentation

- Maps & basemaps: <https://www.onemap.gov.sg/apidocs/maps>
- All API docs: <https://www.onemap.gov.sg/docs/>
- OneMap home: <https://www.onemap.gov.sg/home>

---

## License & data attribution

Map data © OneMap, Singapore Land Authority. Your use of OneMap is subject to the
[OneMap API Terms of Service](https://www.onemap.gov.sg/legal/termsofservice.html).
Your own code can use whatever license you choose.
