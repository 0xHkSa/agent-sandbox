import axios from "axios";

const BASE = `http://localhost:${process.env.PORT || 4000}`;

async function main() {
  const spot = process.argv.slice(2).join(" ") || "Waikiki";

  // 1) resolve spot -> coords
  const spotRes = await axios.post(`${BASE}/tool/resolveSpot`, { spot });
  if (!spotRes.data?.ok) throw new Error("spot not found");
  const { lat, lon } = spotRes.data.data;

  // 2) get weather
  const weatherRes = await axios.post(`${BASE}/tool/getWeather`, { lat, lon });
  const currentT = weatherRes.data?.data?.current?.temperature_2m;

  // 3) get surf
  const surfRes = await axios.post(`${BASE}/tool/getSurf`, { lat, lon });
  const wave0 = surfRes.data?.data?.hourly?.wave_height?.[0];
  const period0 = surfRes.data?.data?.hourly?.wave_period?.[0];

  // 4) outdoor index
  const oiRes = await axios.post(`${BASE}/tool/getOutdoorIndex`, { lat, lon });
  const oi = oiRes.data?.data;

  console.log(`\nSpot: ${spot}  (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
  console.log(`Temp now: ${currentT}°C`);
  console.log(`Wave (t0): ${wave0 ?? "n/a"} m, Period: ${period0 ?? "n/a"} s`);
  console.log(`Outdoor Index: ${oi?.index} — ${oi?.note}\n`);
}

main().catch((e) => {
  console.error("CLI error:", e?.response?.data ?? e?.message);
  process.exit(1);
});

