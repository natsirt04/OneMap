# OneMap Reference

A small starter kit for putting Singapore maps on a web page, built on the
official [OneMap](https://www.onemap.gov.sg/home) basemaps and APIs. No build
step, no framework, nothing to install before you can see it. You clone it, drop
in an API token, and open the page.

Open `index.html` in a browser and you've got:

- OneMap basemaps (Default, Grey, Night, Original)
- A draggable marker with popups
- **Search API**: find any Singapore address or building
- **Reverse Geocode API**: click the map, get the nearest address
- **Themes API**: overlay live data like libraries, hospitals, and hawker centres
- **My location**: reads your phone's GPS through the browser Geolocation API
- **Routing API**: walk, drive, or cycle directions from where you are to a search result

It was built for the SHINE26 hackathon, so it's meant to be read and pulled
apart, not just imported. Plain HTML, CSS, and JavaScript.

---

## Project structure

```
onemap-reference/
├── README.md
├── .gitignore
├── index.html            # the page + Leaflet/OneMap setup
├── css/
│   └── styles.css        # layout & theme
├── js/
│   ├── app.js            # all the map logic
│   ├── config.example.js # token template (committed)
│   └── config.js         # YOUR token (git-ignored — create this)
└── assets/               # your images / data
```

---

## Quick start

Three steps to a running map on your own machine.

1. **Get the code**

   ```bash
   git clone https://github.com/natsirt04/SHINE26.git
   cd SHINE26
   ```

2. **Add your OneMap token**

   ```bash
   cp js/config.example.js js/config.js
   ```

   Open `js/config.js` and paste your token in. That file is git-ignored on
   purpose, so you won't accidentally push your key. The basemaps and Search
   work without a token, but Reverse Geocode, Themes, and Routing won't. They
   all need one.

3. **Run it**

   The APIs are called from the browser, so you want a real `http://` server,
   not a `file://` page opened off disk. Any of these do the job:

   ```bash
   # Python 3
   python -m http.server 5500

   # Node
   npx serve .

   # VS Code: right-click index.html → "Open with Live Server"
   ```

   Then open <http://localhost:5500>. That's all you need for local work, and
   because `localhost` counts as a secure origin, even GPS works here.

---

## Put it on your phone (Vercel)

Testing a map on a phone is awkward. You can't open the file directly, and the
usual "point your phone at your laptop's IP" trick falls apart the moment you
need GPS, because browsers won't hand over location unless the page is HTTPS.
So skip all that and deploy. Vercel's free Hobby plan takes about a minute,
gives you HTTPS for nothing, and hands back a URL that opens on any phone
anywhere, not only one sitting on your Wi-Fi.

### Deploy it

```bash
npm i -g vercel     # one time
cd onemap-reference
vercel login
vercel --prod
```

The first `vercel --prod` walks you through a few setup questions. Take the
defaults, and when it asks **"Connect detected Git repository?"**, say **no**.
The reason matters: your token lives in `js/config.js`, which is git-ignored, so
a GitHub-connected build would ship without it and every token-based feature
would break. Deploying straight from the CLI uploads your local files, token and
all, because `.vercelignore` (not `.gitignore`) decides what the CLI sends.

When it's done you'll see two URLs. Use the short **aliased** one, something like
`https://onemap-reference.vercel.app`. It stays put on every future deploy; the
longer `...-xxxx.vercel.app` link is tied to one specific build.

One caveat worth saying out loud: a static site ships its JavaScript to the
browser, so anyone who opens the page can read the token in the source. That's
fine for a short-lived hackathon token (they expire in about 3 days anyway), but
regenerate it after the event and never put a long-lived key in there.

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

The deployed link is just a link. Send `https://onemap-reference.vercel.app` to
a teammate or a judge and it opens on their phone with no install and no account.
That's the real payoff of deploying instead of tunneling off your laptop.

### Update it after you change code

Vercel doesn't watch your editor, so changes don't go live on their own. When
you're ready to push an update, run the same command again:

```bash
vercel --prod
```

A static deploy is usually live within a few seconds, and the aliased URL
updates in place, so any link you already shared keeps working. Refresh the
phone to see the new build. If it looks stuck on the old one, that's the service
worker holding the cached shell. Pull to refresh, or close and reopen the tab.

---

## Authentication

OneMap hands out JWT tokens that expire after about 3 days. When the
token-based calls start coming back `401 Unauthorized`, that's your cue to
generate a fresh one and paste it into `js/config.js`.

- Register or manage tokens: <https://www.onemap.gov.sg/apidocs/register>
- The token goes in the `Authorization` request header.

| API | Token required? |
| --- | --- |
| Basemap tiles | No |
| Search | No |
| Reverse Geocode | Yes |
| Themes | Yes |
| Planning Area | Yes |
| Routing | Yes (in the `Authorization` header) |

---

## Using your location for directions

Quick myth-bust first: there's no OneMap API that "connects to your phone." Your
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
`http://localhost`. That's the whole reason the phone steps go through Vercel,
since the `vercel.app` URL is HTTPS and location just works. Everything else
(basemaps, search, themes, clicking the map to reverse-geocode) runs fine
without it.

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

Keep the attribution. OneMap requires it, and it's already wired into `app.js`,
so just leave it in.

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
