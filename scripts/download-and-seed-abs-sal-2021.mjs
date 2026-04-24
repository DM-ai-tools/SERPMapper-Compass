/**
 * Download all Australian “Suburbs and Localities” (SAL) ~15k from ABS ASGS 2021
 * (ArcGIS feature service), then insert into `suburb_coordinates`.
 *
 * Source: https://www.abs.gov.au/... ASGS — digital boundaries / web services
 * (same open data; CC BY 4.0; statistical boundaries only)
 *
 * Prerequisites: DATABASE_URL in .env.local, table applied (npm run db:setup)
 *
 *   npm run db:download:suburbs:abs
 *
 * Optional: save merged GeoJSON (large, ~hundreds of MB) for offline use
 *   npm run db:download:suburbs:abs -- --write-geojson
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";

const { Pool } = pg;

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const STATE_MAP = {
  "New South Wales": "NSW",
  Victoria: "VIC",
  Queensland: "QLD",
  "Western Australia": "WA",
  "South Australia": "SA",
  Tasmania: "TAS",
  "Australian Capital Territory": "ACT",
  "Northern Territory": "NT",
};

const BASE =
  "https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SAL/MapServer/0/query";
const PAGE = 2000;
const SLEEP_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getCentroid(geometry) {
  if (!geometry) return { lat: 0, lng: 0 };
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates[0];
    const lats = coords.map((c) => c[1]);
    const lngs = coords.map((c) => c[0]);
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    };
  }
  if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates;
    polys.sort((a, b) => b[0].length - a[0].length);
    const coords = polys[0][0];
    const lats = coords.map((c) => c[1]);
    const lngs = coords.map((c) => c[0]);
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    };
  }
  return { lat: 0, lng: 0 };
}

function buildDataforSEOLocationName(sal, stateCode) {
  const stateName = Object.keys(STATE_MAP).find((k) => STATE_MAP[k] === stateCode) ?? stateCode;
  return `${sal},${stateName},Australia`;
}

function buildQueryUrl(offset) {
  const p = new URLSearchParams();
  p.set("where", "1=1");
  p.set("orderByFields", "objectid");
  p.set("outFields", "sal_name_2021,state_name_2021,area_albers_sqkm");
  p.set("returnGeometry", "true");
  p.set("outSR", "4326");
  p.set("returnZ", "false");
  p.set("returnM", "false");
  p.set("f", "geojson");
  p.set("resultOffset", String(offset));
  p.set("resultRecordCount", String(PAGE));
  return `${BASE}?${p.toString()}`;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 20_000,
});

const writeGeojson = process.argv.includes("--write-geojson");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Set DATABASE_URL in .env.local");
    process.exit(1);
  }

  console.log("Counting features…");
  const countRes = await fetch(
    `${BASE}?where=1%3D1&returnCountOnly=true&f=json`
  );
  const { count } = await countRes.json();
  console.log(`SAL 2021 total: ${count} (will fetch in pages of ${PAGE})`);

  let offset = 0;
  const allFeatures = writeGeojson ? [] : null;
  let upserted = 0;
  let failed = 0;
  const t0 = Date.now();

  const upsertSql = `INSERT INTO suburb_coordinates (name, state, postcode, lat, lng, dataforseo_location_name, geojson_polygon)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (name, state) DO UPDATE SET
             lat = EXCLUDED.lat,
             lng = EXCLUDED.lng,
             dataforseo_location_name = EXCLUDED.dataforseo_location_name,
             geojson_polygon = EXCLUDED.geojson_polygon`;

  while (offset < count) {
    const url = buildQueryUrl(offset);
    const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    if (!res.ok) {
      console.error(`HTTP ${res.status} at offset ${offset}`);
      process.exit(1);
    }
    const featureCollection = await res.json();
    if (!featureCollection.features?.length) break;

    for (const f of featureCollection.features) {
      if (allFeatures) allFeatures.push(f);
      const p = f.properties;
      const stateCode = STATE_MAP[p.state_name_2021] ?? p.state_name_2021;
      if (!p.sal_name_2021) {
        failed++;
        continue;
      }
      const centroid = getCentroid(f.geometry);
      const locationName = buildDataforSEOLocationName(
        p.sal_name_2021,
        stateCode
      );
      try {
        const r = await pool.query(upsertSql, [
          p.sal_name_2021,
          stateCode,
          "",
          centroid.lat,
          centroid.lng,
          locationName,
          f.geometry ? JSON.stringify(f.geometry) : null,
        ]);
        if (r.rowCount) upserted += r.rowCount;
      } catch (e) {
        failed++;
        if (failed < 10) {
          console.warn("Insert warn:", p.sal_name_2021, e.message);
        }
      }
    }

    const pageIndex = offset / PAGE + 1;
    const pages = Math.ceil(count / PAGE);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    process.stdout.write(
      `\rPage ${pageIndex}/${pages} · total upserted: ${upserted} · ${elapsed}s   `
    );

    offset += featureCollection.features.length;
    if (featureCollection.features.length < PAGE) break;
    await sleep(SLEEP_MS);
  }

  console.log(
    `\n\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s. Rows upserted: ${upserted}. Skipped/bad: ${failed}`
  );

  if (writeGeojson && allFeatures?.length) {
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const out = join(dir, "sal-2021-australia.geojson");
    const geo = { type: "FeatureCollection", features: allFeatures };
    writeFileSync(out, JSON.stringify(geo), "utf8");
    console.log("Wrote", out);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
