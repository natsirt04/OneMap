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

// The token is read from js/config.js (window.ONEMAP_CONFIG.token).
// Some APIs (Search) are public; others (Reverse Geocode, Themes, Planning
// Area) require this token in the Authorization header.
const TOKEN = (window.ONEMAP_CONFIG && window.ONEMAP_CONFIG.token) || "";

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
  const headers = {};
  if (auth) {
    if (!TOKEN || TOKEN.startsWith("PASTE_")) {
      throw new Error(
        "This OneMap API needs a token. Add it to js/config.js first."
      );
    }
    // OneMap expects the raw token in the Authorization header.
    headers["Authorization"] = TOKEN;
  }

  const res = await fetch(`${ONEMAP_API}${path}`, { headers });
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
   8. Friendly startup message in the console
   ------------------------------------------------------------------------- */

console.log(
  "%cOneMap Hackathon Starter ready.",
  "color:#38bdf8;font-weight:bold;"
);
if (!TOKEN || TOKEN.startsWith("PASTE_")) {
  console.warn(
    "No OneMap token set. Search works, but Reverse Geocode and Themes need a " +
      "token in js/config.js."
  );
}
