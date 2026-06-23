/* =========================================================================
   OneMap Hackathon Starter — app.js
   -------------------------------------------------------------------------
   A pure-JavaScript interactive map built on Leaflet + OneMap basemaps & APIs.
   No build tools, no frameworks. Open index.html in a browser to run.

   Official docs:
     - Maps / basemaps : https://www.onemap.gov.sg/apidocs/maps
     - All APIs        : https://www.onemap.gov.sg/docs/
     - Home            : https://www.onemap.gov.sg/home

   What this file does:
     1. Creates a Leaflet map centred on Singapore.
     2. Loads the OneMap raster basemap (Default/Grey/Night/Original).
     3. Adds a draggable marker with a popup.
     4. Search API     — find addresses/buildings and fly to them.
     5. Reverse Geocode — click the map to get the nearest address.
     6. Themes API     — overlay live thematic data (libraries, hospitals, etc.).
   ========================================================================= */

"use strict";

/* -------------------------------------------------------------------------
   0. Constants & configuration
   ------------------------------------------------------------------------- */

// Base URL for all OneMap REST APIs.
const ONEMAP_API = "https://www.onemap.gov.sg/api";

// Tokens are obtained through OneMapAuth (js/token.js): it fetches a fresh
// token from the /api/onemap-token serverless endpoint (recommended) and
// falls back to a token pasted into js/config.js for plain static hosting.
// Some APIs (Search) are public; others (Reverse Geocode, Themes, Routing,
// Planning Area) require a token in the Authorization header.

// Singapore's geographic extent (WGS84 lat/lng). Used to stop users panning
// off into the ocean and to cap zoom for performance.
const SG_BOUNDS = L.latLngBounds(
  L.latLng(1.144, 103.535), // south-west corner
  L.latLng(1.494, 104.502)  // north-east corner
);

// City-centre default view.
const SG_CENTER = [1.3521, 103.8198];

// OneMap raster tile template. {s} is omitted because OneMap serves from a
// single host. Replace "Default" at runtime to switch basemaps.
const TILE_URL = "https://www.onemap.gov.sg/maps/tiles/{basemap}/{z}/{x}/{y}.png";

// MANDATORY OneMap attribution. OneMap's terms require their logo + credit be
// shown on every map. Do not remove this.
const ONEMAP_ATTRIBUTION =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" ' +
  'style="height:18px;width:18px;vertical-align:middle;"> ' +
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> ' +
  '&copy; contributors &#124; ' +
  '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>';

/* -------------------------------------------------------------------------
   1. Create the map and the basemap layer
   ------------------------------------------------------------------------- */

const map = L.map("map", {
  center: SG_CENTER,
  zoom: 12,
  minZoom: 11, // OneMap tiles exist from z11 ...
  maxZoom: 19, // ... to z19. Going outside this range gives blank tiles.
  maxBounds: SG_BOUNDS,
  maxBoundsViscosity: 0.7,
});

// Helper that builds a OneMap tile layer for a given basemap name.
function makeBasemap(name) {
  return L.tileLayer(TILE_URL, {
    basemap: name,
    detectRetina: true,
    attribution: ONEMAP_ATTRIBUTION,
  });
}

// Start with the Default basemap.
let currentBasemap = makeBasemap("Default").addTo(map);

/* -------------------------------------------------------------------------
   2. A draggable marker with a popup (Quick Start Steps 4 & 5)
   ------------------------------------------------------------------------- */

const marker = L.marker(SG_CENTER, { draggable: true })
  .addTo(map)
  .bindPopup("<b>Drag me!</b><br>This is the city centre.")
  .openPopup();

// Update the popup whenever the marker is dropped in a new spot.
marker.on("dragend", () => {
  const { lat, lng } = marker.getLatLng();
  marker
    .setPopupContent(
      `<b>Marker moved</b><br>Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}`
    )
    .openPopup();
});

/* -------------------------------------------------------------------------
   3. Small fetch helper that adds the Authorization header when needed
   ------------------------------------------------------------------------- */

async function onemapGet(path, { auth = false } = {}) {
  // One attempt at the request. `forceToken` bypasses the token cache so we
  // can retry with a freshly minted token after a 401/403.
  async function attempt(forceToken) {
    const headers = {};
    if (auth) {
      let token;
      try {
        token = await window.OneMapAuth.getToken({ force: forceToken });
      } catch (err) {
        throw new Error(
          "This OneMap API needs a token, and none could be obtained. " +
            "Configure ONEMAP_EMAIL/ONEMAP_PASSWORD (serverless) or paste a " +
            "token into js/config.js. Details: " +
            err.message
        );
      }
      // OneMap expects the raw token in the Authorization header.
      headers["Authorization"] = token;
    }
    return fetch(`${ONEMAP_API}${path}`, { headers });
  }

  let res = await attempt(false);

  // A token can expire mid-session. On the first auth failure, renew the token
  // once and retry transparently before giving up.
  if (auth && (res.status === 401 || res.status === 403)) {
    res = await attempt(true);
  }

  if (!res.ok) {
    throw new Error(`OneMap request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/* -------------------------------------------------------------------------
   4. Search API  —  find an address/building
   GET /common/elastic/search  (public, no token required)
   Docs: https://www.onemap.gov.sg/apidocs/search
   ------------------------------------------------------------------------- */

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchResults = document.getElementById("searchResults");

async function runSearch() {
  const value = searchInput.value.trim();
  searchResults.innerHTML = "";
  if (!value) return;

  searchResults.innerHTML = "<li>Searching…</li>";

  try {
    const params = new URLSearchParams({
      searchVal: value,
      returnGeom: "Y",      // include lat/lng + SVY21 X/Y
      getAddrDetails: "Y",  // include block, road, postal, etc.
      pageNum: "1",
    });
    const data = await onemapGet(`/common/elastic/search?${params}`);

    if (!data.results || data.results.length === 0) {
      searchResults.innerHTML = "<li>No results found.</li>";
      return;
    }

    // Render up to 10 clickable results.
    searchResults.innerHTML = "";
    data.results.slice(0, 10).forEach((r) => {
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="addr-name">${r.SEARCHVAL}</span><br>` +
        `<span class="addr-detail">${r.ADDRESS || ""}</span>`;
      li.addEventListener("click", () => {
        const lat = parseFloat(r.LATITUDE);
        const lng = parseFloat(r.LONGITUDE);
        map.flyTo([lat, lng], 17);
        marker.setLatLng([lat, lng]);
        marker
          .setPopupContent(`<b>${r.SEARCHVAL}</b><br>${r.ADDRESS || ""}`)
          .openPopup();
        // Remember this as the routing destination. If we already know the
        // user's location, draw a route to it straight away (see section 9).
        selectDestination(lat, lng, r.SEARCHVAL);
      });
      searchResults.appendChild(li);
    });
  } catch (err) {
    searchResults.innerHTML = `<li>Error: ${err.message}</li>`;
  }
}

searchBtn.addEventListener("click", runSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});

/* -------------------------------------------------------------------------
   5. Reverse Geocode API  —  click the map to get the nearest address
   GET /public/revgeocode  (requires token)
   Docs: https://www.onemap.gov.sg/apidocs/reverse-geocode
   ------------------------------------------------------------------------- */

const revgeoResult = document.getElementById("revgeoResult");

map.on("click", async (e) => {
  const { lat, lng } = e.latlng;
  revgeoResult.textContent = "Looking up address…";

  try {
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      buffer: "50",        // search radius in metres (0–500)
      addressType: "All",  // "All" or "HDB"
      otherFeatures: "N",
    });
    const data = await onemapGet(`/public/revgeocode?${params}`, { auth: true });

    const list = data.GeocodeInfo || [];
    if (list.length === 0) {
      revgeoResult.textContent = "No address found within 50 m of that point.";
      return;
    }
    const first = list[0];
    revgeoResult.innerHTML =
      `<b>${first.BUILDINGNAME || "Unnamed"}</b><br>` +
      `${first.BLOCK || ""} ${first.ROAD || ""}<br>` +
      `Singapore ${first.POSTALCODE || "—"}`;
  } catch (err) {
    revgeoResult.textContent = `Error: ${err.message}`;
  }
});

/* -------------------------------------------------------------------------
   6. Themes API  —  overlay live thematic data
   GET /public/themesvc/retrieveTheme  (requires token)
   Docs: https://www.onemap.gov.sg/apidocs/themes

   IMPORTANT: queryName must be a REAL theme name. Browse the full list with
   GET /public/themesvc/getAllThemesInfo. (There is NO "kindergartens" theme —
   that was a wrong guess; the dropdown below uses verified theme names.)

   The retrieveTheme response is:
     { "SrchResults": [
         { "FeatCount": 30, "Theme_Name": "...", ... },   // [0] = metadata
         { "NAME": "...", "ADDRESSSTREETNAME": "...",      // [1..] = features
           "ADDRESSPOSTALCODE": "...", "LatLng": "1.38,103.74" },
         ...
     ]}
   These themes are small (tens to hundreds of points), so we load ALL of them
   and zoom the map to fit — simpler and clearer than filtering by map extent.
   ------------------------------------------------------------------------- */

const themeSelect = document.getElementById("themeSelect");
const themeStatus = document.getElementById("themeStatus");
let themeLayer = null; // current Leaflet layer group, so we can replace/remove it

async function loadTheme(queryName) {
  // Remove any previously shown theme.
  if (themeLayer) {
    map.removeLayer(themeLayer);
    themeLayer = null;
  }

  // "— none —" selected: nothing more to do.
  if (!queryName) {
    themeStatus.textContent = "Pick a layer to plot it on the map.";
    return;
  }

  themeStatus.textContent = "Loading…";
  try {
    const params = new URLSearchParams({ queryName });
    const data = await onemapGet(
      `/public/themesvc/retrieveTheme?${params}`,
      { auth: true }
    );

    // OneMap returns { "error": "..." } when the theme name is wrong.
    if (data.error) throw new Error(data.error);

    // Keep only real features (those that carry a LatLng); drop the metadata row.
    const results = (data.SrchResults || []).filter((r) => r.LatLng);
    if (results.length === 0) {
      themeStatus.textContent = "No features returned for this theme.";
      return;
    }

    themeLayer = L.layerGroup();
    const latlngs = [];
    results.forEach((r) => {
      const [lat, lng] = r.LatLng.split(",").map(Number);
      latlngs.push([lat, lng]);

      // Build a tidy address line from whichever fields are present.
      const addr = [
        r.ADDRESSBLOCKHOUSENUMBER,
        r.ADDRESSSTREETNAME,
        r.ADDRESSPOSTALCODE ? "S(" + r.ADDRESSPOSTALCODE + ")" : "",
      ]
        .filter(Boolean)
        .join(" ");

      L.circleMarker([lat, lng], {
        radius: 7,
        color: "#f97316",
        fillColor: "#fb923c",
        fillOpacity: 0.85,
        weight: 2,
      })
        .bindPopup(`<b>${r.NAME || "Feature"}</b><br>${addr || ""}`)
        .addTo(themeLayer);
    });

    themeLayer.addTo(map);
    map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 16 });
    themeStatus.textContent = `Showing ${results.length} point(s).`;
  } catch (err) {
    themeStatus.textContent = `Error: ${err.message}`;
  }
}

themeSelect.addEventListener("change", () => loadTheme(themeSelect.value));

/* -------------------------------------------------------------------------
   7. Basemap switcher (Default / Grey / Night / Original)
   ------------------------------------------------------------------------- */

const basemapSelect = document.getElementById("basemapSelect");
basemapSelect.addEventListener("change", () => {
  map.removeLayer(currentBasemap);
  currentBasemap = makeBasemap(basemapSelect.value).addTo(map);
});

/* -------------------------------------------------------------------------
   9. Phone GPS + Routing
   -------------------------------------------------------------------------
   "Linking to your phone" is done by the BROWSER's Geolocation API — a W3C
   standard, not a OneMap feature. It reads the device's GPS/Wi-Fi position:
     MDN: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
   IMPORTANT: browsers only allow geolocation in a "secure context" — i.e.
   HTTPS, or http://localhost. Over plain http on a LAN IP it will be blocked.

   We then feed that position to OneMap's Routing API to draw directions:
     Docs: https://www.onemap.gov.sg/apidocs/routing
     GET /public/routingsvc/route?start=lat,lng&end=lat,lng&routeType=walk
     (token goes in the Authorization header). The response includes:
       - route_summary.total_time     (seconds)
       - route_summary.total_distance (metres)
       - route_geometry               (an ENCODED POLYLINE, precision 5)
   ------------------------------------------------------------------------- */

const locateBtn = document.getElementById("locateBtn");
const locateStatus = document.getElementById("locateStatus");
const routeTypeSelect = document.getElementById("routeTypeSelect");

let userLocation = null;   // {lat, lng} once we have the phone's GPS
let userMarker = null;     // blue "you are here" marker
let accuracyCircle = null; // shows GPS accuracy radius
let destination = null;    // {lat, lng, label} chosen from search
let routeLayer = null;     // the drawn route polyline

// Decode a Google/OneMap "encoded polyline" (precision 5) into [lat,lng] pairs.
// Standard algorithm — see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Ask the phone for its current position.
function locateMe() {
  if (!("geolocation" in navigator)) {
    locateStatus.textContent = "This browser has no Geolocation support.";
    return;
  }
  if (!window.isSecureContext) {
    locateStatus.innerHTML =
      "⚠️ Location needs <b>HTTPS</b> (or localhost). On a plain-http LAN " +
      "address the browser blocks GPS — deploy over HTTPS to use this.";
    return;
  }

  locateStatus.textContent = "Locating… (allow the permission prompt)";
  locateBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locateBtn.disabled = false;
      const { latitude, longitude, accuracy } = pos.coords;
      userLocation = { lat: latitude, lng: longitude };

      // Drop / move the "you are here" marker + accuracy circle.
      if (userMarker) {
        userMarker.setLatLng([latitude, longitude]);
        accuracyCircle.setLatLng([latitude, longitude]).setRadius(accuracy);
      } else {
        userMarker = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          weight: 3,
        })
          .bindPopup("<b>You are here</b>")
          .addTo(map);
        accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          weight: 1,
        }).addTo(map);
      }

      map.flyTo([latitude, longitude], 16);
      locateStatus.textContent = `Found you (±${Math.round(accuracy)} m). Tap a search result for directions.`;

      // If a destination was already chosen, route to it now.
      if (destination) drawRoute();
    },
    (err) => {
      locateBtn.disabled = false;
      const msgs = {
        1: "Permission denied. Click the 🔒/📍 icon in the address bar → set " +
          "Location to “Allow”, then tap the button again.",
        2: "Position unavailable. Check that GPS / location services are on.",
        3: "Timed out getting your location. Try again.",
      };
      locateStatus.textContent = msgs[err.code] || `Location error: ${err.message}`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Called when a search result is clicked (see section 4).
function selectDestination(lat, lng, label) {
  destination = { lat, lng, label };
  if (userLocation) {
    drawRoute();
  } else {
    locateStatus.textContent =
      `Destination set: ${label}. Tap “Use my location” to get directions.`;
  }
}

// Call the OneMap Routing API and draw the path.
async function drawRoute() {
  if (!userLocation || !destination) return;

  locateStatus.textContent = "Getting directions…";
  try {
    const params = new URLSearchParams({
      start: `${userLocation.lat},${userLocation.lng}`,
      end: `${destination.lat},${destination.lng}`,
      routeType: routeTypeSelect.value, // walk | drive | cycle
    });
    const data = await onemapGet(`/public/routingsvc/route?${params}`, {
      auth: true,
    });

    if (!data.route_geometry) {
      throw new Error(data.status_message || "No route found.");
    }

    // Remove an old route before drawing the new one.
    if (routeLayer) map.removeLayer(routeLayer);

    const path = decodePolyline(data.route_geometry);
    routeLayer = L.polyline(path, {
      color: "#22c55e",
      weight: 5,
      opacity: 0.9,
    }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

    // route_summary gives time (s) and distance (m).
    const mins = Math.round((data.route_summary.total_time || 0) / 60);
    const km = ((data.route_summary.total_distance || 0) / 1000).toFixed(2);
    locateStatus.innerHTML =
      `🧭 <b>${destination.label}</b><br>` +
      `${routeTypeSelect.value} · ~${mins} min · ${km} km`;
  } catch (err) {
    locateStatus.textContent = `Routing error: ${err.message}`;
  }
}

locateBtn.addEventListener("click", locateMe);
// Re-route if the user switches Walk/Drive/Cycle after a route is shown.
routeTypeSelect.addEventListener("change", () => {
  if (userLocation && destination) drawRoute();
});

/* -------------------------------------------------------------------------
   10. Friendly startup message in the console
   ------------------------------------------------------------------------- */

console.log(
  "%cOneMap Reference ready.",
  "color:#38bdf8;font-weight:bold;"
);
// Probe token availability so missing config is obvious in the console, but
// don't block startup — Search and basemaps work without a token.
window.OneMapAuth.getToken()
  .then(() => console.log("OneMap token acquired — all APIs available."))
  .catch((err) =>
    console.warn(
      "No OneMap token available. Search and basemaps still work, but " +
        "Reverse Geocode, Themes, and Routing need one. " +
        "Set ONEMAP_EMAIL/ONEMAP_PASSWORD (serverless) or js/config.js. " +
        "Details: " +
        err.message
    )
  );
