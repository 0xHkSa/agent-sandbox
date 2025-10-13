import { getWeather, getSurf, computeOutdoorIndex } from "./mcp/tools.js";
import express from "express";

const app = express();
app.use(express.json());
const PORT = Number(process.env.PORT || 4000);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "agent-sandbox", version: "0.1.0" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});


import { findSpot } from "./utils/spots.js";

app.post("/tool/resolveSpot", (req, res) => {
  const spot = String(req.body?.spot ?? "");
  const match = findSpot(spot);
  if (!match) return res.status(404).json({ ok:false, error:"spot not found"});
  res.json({ ok:true, data: match });
});

app.post("/tool/getWeather", async (req, res) => {
  const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ ok:false, error:"lat/lon required"});
  try {
    const data = await getWeather(lat, lon);
    res.json({ ok:true, data });
  } catch (e) {
    res.status(502).json({ ok:false, error: (e&&e.message)||"weather fetch failed" });
  }
});

app.post("/tool/getSurf", async (req, res) => {
  const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ ok:false, error:"lat/lon required"});
  try {
    const data = await getSurf(lat, lon);
    res.json({ ok:true, data });
  } catch (e) {
    res.status(502).json({ ok:false, error: (e&&e.message)||"surf fetch failed" });
  }
});

app.post("/tool/getOutdoorIndex", async (req, res) => {
  const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ ok:false, error:"lat/lon required"});
  try {
    const w = await getWeather(lat, lon);
    const out = computeOutdoorIndex(w);
    res.json({ ok:true, data: out });
  } catch (e) {
    res.status(502).json({ ok:false, error: (e&&e.message)||"outdoor index failed" });
  }
});
