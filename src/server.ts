import "dotenv/config";
import { getWeather, getSurf, computeOutdoorIndex, getTides, getUVIndex, calculateBeachScore, analyzeMultipleSpots } from "./mcp/tools.js";
import { recommendBeaches } from "./utils/spots.js";
import { askAgent } from "./agent/gemini-agent.js";
import { logger } from "./utils/logger.js";
import express from "express";
import rateLimit from "express-rate-limit";

const app = express();

// Hawaii data cache for proactive loading
let hawaiiDataCache = {
  beaches: {},
  weather: {},
  surf: {},
  tides: {},
  lastUpdated: null,
  loading: false
};

// Hawaii beach coordinates for proactive loading
const HAWAII_BEACHES = [
  { name: 'Waikiki', lat: 21.2766, lon: -157.8269 },
  { name: 'North Shore', lat: 21.6649, lon: -158.0532 },
  { name: 'Kailua Beach', lat: 21.4010, lon: -157.7394 },
  { name: 'Lanikai Beach', lat: 21.3927, lon: -157.7160 },
  { name: 'Hanauma Bay', lat: 21.2706, lon: -157.6939 },
  { name: 'Ala Moana', lat: 21.2906, lon: -157.8422 },
  { name: 'Sandy Beach', lat: 21.2847, lon: -157.6728 },
  { name: 'Makapuu Beach', lat: 21.3106, lon: -157.6589 }
];

// Proactive data loading function
async function loadAllHawaiiData() {
  if (hawaiiDataCache.loading) {
    console.log('⏳ Data loading already in progress...');
    return;
  }
  
  hawaiiDataCache.loading = true;
  console.log('🚀 Starting proactive Hawaii data loading...');
  
  try {
    const startTime = Date.now();
    
    // Load weather data for all beaches in parallel
    console.log('🌤️ Loading weather data for all beaches...');
    const weatherPromises = HAWAII_BEACHES.map(async (beach) => {
      try {
        const weather = await getWeather(beach.lat, beach.lon);
        return { beach: beach.name, data: weather };
      } catch (error) {
        console.error(`❌ Failed to load weather for ${beach.name}:`, error.message);
        return { beach: beach.name, data: null, error: error.message };
      }
    });
    
    // Load surf data for all beaches in parallel
    console.log('🌊 Loading surf data for all beaches...');
    const surfPromises = HAWAII_BEACHES.map(async (beach) => {
      try {
        const surf = await getSurf(beach.lat, beach.lon);
        return { beach: beach.name, data: surf };
      } catch (error) {
        console.error(`❌ Failed to load surf for ${beach.name}:`, error.message);
        return { beach: beach.name, data: null, error: error.message };
      }
    });
    
    // Load tide data for all beaches in parallel
    console.log('🌊 Loading tide data for all beaches...');
    const tidePromises = HAWAII_BEACHES.map(async (beach) => {
      try {
        const tides = await getTides(beach.lat, beach.lon);
        return { beach: beach.name, data: tides };
      } catch (error) {
        console.error(`❌ Failed to load tides for ${beach.name}:`, error.message);
        return { beach: beach.name, data: null, error: error.message };
      }
    });
    
    // Wait for all data to load
    const [weatherResults, surfResults, tideResults] = await Promise.all([
      Promise.all(weatherPromises),
      Promise.all(surfPromises),
      Promise.all(tidePromises)
    ]);
    
    // Organize data by beach
    const beachesData = {};
    HAWAII_BEACHES.forEach(beach => {
      beachesData[beach.name] = {
        coordinates: { lat: beach.lat, lon: beach.lon },
        weather: weatherResults.find(r => r.beach === beach.name)?.data || null,
        surf: surfResults.find(r => r.beach === beach.name)?.data || null,
        tides: tideResults.find(r => r.beach === beach.name)?.data || null
      };
    });
    
    // Update cache
    hawaiiDataCache = {
      beaches: beachesData,
      weather: weatherResults.reduce((acc, r) => { acc[r.beach] = r.data; return acc; }, {}),
      surf: surfResults.reduce((acc, r) => { acc[r.beach] = r.data; return acc; }, {}),
      tides: tideResults.reduce((acc, r) => { acc[r.beach] = r.data; return acc; }, {}),
      lastUpdated: new Date(),
      loading: false
    };
    
    const loadTime = Date.now() - startTime;
    const successCount = weatherResults.filter(r => r.data).length;
    
    console.log(`✅ Hawaii data loaded successfully!`);
    console.log(`📊 Loaded ${successCount}/${HAWAII_BEACHES.length} beaches in ${loadTime}ms`);
    console.log(`🕒 Last updated: ${hawaiiDataCache.lastUpdated.toISOString()}`);
    
  } catch (error) {
    console.error('❌ Failed to load Hawaii data:', error);
    hawaiiDataCache.loading = false;
  }
}

// CORS Middleware - Manual implementation (more reliable than package)
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const origin = req.headers.origin;
  
  // Only log CORS errors, not every request
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  } else if (origin) {
    console.log('[CORS] Origin not allowed:', origin);
  }
  
  // Handle preflight silently
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  
  next();
});

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

import { findSpot } from "./utils/spots.js";

app.post("/tool/resolveSpot", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
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

app.post("/tool/getTides", async (req, res) => {
  const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ ok:false, error:"lat/lon required"});
  try {
    const data = await getTides(lat, lon);
    res.json({ ok:true, data });
  } catch (e) {
    res.status(502).json({ ok:false, error: (e&&e.message)||"tide data failed" });
  }
});

app.post("/tool/getUVIndex", async (req, res) => {
  const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ ok:false, error:"lat/lon required"});
  try {
    const data = await getUVIndex(lat, lon);
    res.json({ ok:true, data });
  } catch (e) {
    res.status(502).json({ ok:false, error: (e&&e.message)||"UV data failed" });
  }
});

app.post("/tool/recommendBeaches", async (req, res) => {
  try {
    const { family, surf, snorkel, scenic, island } = req.body;
    const beaches = recommendBeaches({ family, surf, snorkel, scenic, island });
    res.json({ ok:true, data: beaches });
  } catch (e) {
    res.status(502).json({ ok:false, error: (e&&e.message)||"beach recommendations failed" });
  }
});

app.post("/tool/analyzeMultipleSpots", async (req, res) => {
  try {
    const { spotNames, beachTypes } = req.body;
    if (!spotNames || !Array.isArray(spotNames) || spotNames.length === 0) {
      return res.status(400).json({ ok:false, error: "spotNames array required" });
    }
    if (spotNames.length > 10) {
      return res.status(400).json({ ok:false, error: "Maximum 10 spots allowed" });
    }
    
    const analysis = await analyzeMultipleSpots(spotNames, beachTypes);
    res.json({ ok:true, data: analysis });
  } catch (e) {
    res.status(502).json({ ok:false, error: (e&&e.message)||"multi-spot analysis failed" });
  }
});

app.post("/tool/getBeachScore", async (req, res) => {
  const lat = Number(req.body?.lat), lon = Number(req.body?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return res.status(400).json({ ok:false, error:"lat/lon required"});
  try {
    const { beachType = 'mixed', crowdLevel } = req.body;
    
    // Get all the data needed for scoring
    const [weather, surf, uv, tides] = await Promise.all([
      getWeather(lat, lon),
      getSurf(lat, lon),
      getUVIndex(lat, lon),
      getTides(lat, lon)
    ]);

    // Calculate comprehensive beach score
    const score = calculateBeachScore(weather, surf, uv, tides, beachType, crowdLevel);
    
    res.json({ ok:true, data: score });
  } catch (e) {
    res.status(502).json({ ok:false, error: (e&&e.message)||"beach scoring failed" });
  }
});

// AI Agent endpoint - The magic happens here!
app.post("/ask", async (req, res) => {
  // Manual CORS headers (for debugging)
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const question = String(req.body?.question || "").trim();
  const conversation = req.body?.conversation || [];
  const sessionId = req.body?.sessionId || null;
  
  // Validation
  if (!question) {
    return res.status(400).json({ ok: false, error: "Question required" });
  }
  if (question.length > 500) {
    return res.status(400).json({ ok: false, error: "Question too long (max 500 characters)" });
  }
  
  // Log conversation context for debugging
  if (conversation && conversation.length > 0) {
    logger.info("Conversation context", { 
      sessionId, 
      contextLength: conversation.length,
      lastMessage: conversation[conversation.length - 1]?.text?.substring(0, 50) + "..."
    });
  }
  
  try {
    logger.info("User question received", { question, sessionId, ip: req.ip });
    const answer = await askAgent(question, conversation);
    
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

// Health endpoint to check data status
app.get('/health', (req, res) => {
  const dataAge = hawaiiDataCache.lastUpdated ? 
    Date.now() - hawaiiDataCache.lastUpdated.getTime() : null;
  
  res.json({
    status: 'healthy',
    dataLoaded: !!hawaiiDataCache.lastUpdated,
    dataAge: dataAge ? `${Math.round(dataAge / 1000)}s ago` : 'never',
    beachesLoaded: Object.keys(hawaiiDataCache.beaches).length,
    loading: hawaiiDataCache.loading,
    lastUpdated: hawaiiDataCache.lastUpdated?.toISOString()
  });
});

// Start server (MUST be at the end after all routes are defined!)
app.listen(PORT, "0.0.0.0", async () => {
  logger.info(`API server listening on port ${PORT}`, { port: PORT });
  console.log(`[server] Ready! CORS enabled for http://localhost:3000`);
  
  // Load Hawaii data on startup
  console.log('🚀 Starting proactive data loading...');
  await loadAllHawaiiData();
});
