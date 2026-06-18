# 🇸🇬 OneMap Reference

A zero-dependency, no-build **starter kit for building interactive maps of Singapore**
using the official [OneMap](https://www.onemap.gov.sg/home) basemaps and APIs.

Open `index.html` in a browser and you have a working app with:

- 🗺️ OneMap basemaps (Default / Grey / Night / Original)
- 📍 A draggable marker with popups
- 🔎 **Search API** — find any Singapore address or building
- 🧭 **Reverse Geocode API** — click the map to get the nearest address
- 🏫 **Themes API** — overlay live thematic data (libraries, hospitals, hawker centres, …)

Built for the **SHINE26** hackathon. Pure HTML + CSS + JavaScript. No npm, no bundler.

---

## 📂 Project structure

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

## 🚀 Quick start

1. **Get the code**

   ```bash
   git clone https://github.com/natsirt04/SHINE26.git
   cd SHINE26
   ```

2. **Add your OneMap token**

   ```bash
   cp js/config.example.js js/config.js
   ```

   Open `js/config.js` and paste your token. (This file is git-ignored so your
   secret never gets pushed.) Search works without a token, but **Reverse
   Geocode** and **Themes** require one.

3. **Run it**

   Because OneMap APIs are called from the browser, you should serve the folder
   over `http://` rather than `file://` (this avoids some CORS/security quirks).
   Pick whichever you have:

   ```bash
   # Python 3
   python -m http.server 5500

   # Node (if you have it)
   npx serve .

   # VS Code: right-click index.html → "Open with Live Server"
   ```

   Then open <http://localhost:5500>.

   > Opening `index.html` directly (double-click) also works for the basemap and
   > Search, but a local server is the recommended, trouble-free way.

---

## 🔑 Authentication

OneMap issues **JWT tokens that expire after ~3 days**. When token-protected
APIs start returning `401 Unauthorized`, generate a fresh token and paste it
into `js/config.js`.

- Register / manage tokens: <https://www.onemap.gov.sg/apidocs/register>
- The token is sent in the `Authorization` request header.

| API | Token required? |
| --- | --- |
| Basemap tiles | ❌ No |
| Search | ❌ No |
| Reverse Geocode | ✅ Yes |
| Themes | ✅ Yes |
| Planning Area | ✅ Yes |

---

## 🗺️ OneMap basemaps used

Raster XYZ tiles (zoom 11–19):

```
https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png
https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png
https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png
https://www.onemap.gov.sg/maps/tiles/Original/{z}/{x}/{y}.png
```

**Attribution is mandatory** and is already wired into `app.js`. Do not remove it.

---

## 📖 Official documentation

- Maps & basemaps: <https://www.onemap.gov.sg/apidocs/maps>
- All API docs: <https://www.onemap.gov.sg/docs/>
- OneMap home: <https://www.onemap.gov.sg/home>

---

## 📜 License & data attribution

Map data © OneMap, Singapore Land Authority. Your use of OneMap is subject to
the [OneMap API Terms of Service](https://www.onemap.gov.sg/legal/termsofservice.html).
Your own code can use whatever license you choose.
