import "dotenv/config";
import { getWeather, getSurf, computeOutdoorIndex } from "./mcp/tools.js";
import { askAgent } from "./agent/gemini-agent.js";
import { logger } from "./utils/logger.js";
import express from "express";
import rateLimit from "express-rate-limit";

const app = express();
app.use(express.json());
const PORT = Number(process.env.PORT || 4000);

// Rate limiting: 100 requests per day for free tier
const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100, // Limit each IP to 100 requests per day
  message: { 
    ok: false, 
    error: "Daily limit reached (100 questions/day). Please try again tomorrow!" 
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", { ip: req.ip });
    res.status(429).json({ 
      ok: false, 
      error: "Daily limit reached (100 questions/day). Please try again tomorrow!" 
    });
  }
});

// Apply rate limiting to /ask endpoint only
app.use("/ask", limiter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "agent-sandbox", version: "0.1.0" });
});

app.get("/debug", (_req, res) => {
  res.json({
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info(`API server listening on port ${PORT}`, { port: PORT });
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

// AI Agent endpoint - The magic happens here!
app.post("/ask", async (req, res) => {
  const question = String(req.body?.question || "").trim();
  
  // Validation
  if (!question) {
    return res.status(400).json({ ok: false, error: "Question required" });
  }
  if (question.length > 500) {
    return res.status(400).json({ ok: false, error: "Question too long (max 500 characters)" });
  }
  
  try {
    logger.info("User question received", { question, ip: req.ip });
    const answer = await askAgent(question);
    
    logger.info("Question answered successfully", { 
      question, 
      answerLength: answer.length 
    });
    
    res.json({ 
      ok: true, 
      question,
      answer,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    logger.error("Error in /ask endpoint", { 
      question, 
      error: e.message, 
      stack: e.stack 
    });
    
    res.status(500).json({ 
      ok: false, 
      error: "Sorry, I had trouble processing that. Please try again!" 
    });
  }
});
