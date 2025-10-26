import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { selectBestTemplate, applyTemplate, type TemplateContext } from "./response-templates";

// Response cache for performance optimization
interface CacheEntry {
  response: string;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

const responseCache = new Map<string, CacheEntry>();

// Cache statistics for monitoring
let cacheStats = {
  hits: 0,
  misses: 0,
  total: 0
};

// Cache TTL settings (in milliseconds)
const CACHE_TTL = {
  WEATHER: 5 * 60 * 1000,      // 5 minutes
  SURF: 10 * 60 * 1000,        // 10 minutes
  BEACH_SCORE: 15 * 60 * 1000, // 15 minutes
  TIDE: 30 * 60 * 1000,        // 30 minutes
  RECOMMEND: 10 * 60 * 1000,
  FAMILY: 10 * 60 * 1000,
  GENERAL: 5 * 60 * 1000       // 5 minutes for general questions
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const MODEL_TIMEOUT_MS = 12_000;
const MCP_TOOL_TIMEOUT_MS = 8_000;

type ConversationTurn = {
  text: string;
  isUser?: boolean;
};

interface ConversationState {
  focusSpot?: SpotInfo;
  lastAssistant?: string;
  priorRecommendations: string[];
}

interface SpotInfo {
  spot: string;
  lat: number;
  lon: number;
  aliases: string[];
  display?: string;
}

const KNOWN_SPOTS: SpotInfo[] = [
  {
    spot: "Waikiki",
    display: "Waikiki",
    lat: 21.2766,
    lon: -157.8269,
    aliases: ["waikiki", "waikiki beach"]
  },
  {
    spot: "North Shore",
    display: "the North Shore",
    lat: 21.6649,
    lon: -158.0532,
    aliases: ["north shore", "northshore", "haleiwa"]
  },
  {
    spot: "Honolulu",
    display: "Honolulu",
    lat: 21.3069,
    lon: -157.8583,
    aliases: ["honolulu", "town"]
  },
  {
    spot: "Kailua Beach",
    display: "Kailua",
    lat: 21.401,
    lon: -157.7394,
    aliases: ["kailua", "kailua beach"]
  },
  {
    spot: "Lanikai",
    display: "Lanikai",
    lat: 21.3927,
    lon: -157.716,
    aliases: ["lanikai"]
  },
  {
    spot: "Hanauma Bay",
    display: "Hanauma Bay",
    lat: 21.2706,
    lon: -157.6939,
    aliases: ["hanauma", "hanauma bay"]
  },
  {
    spot: "Ala Moana",
    display: "Ala Moana",
    lat: 21.2906,
    lon: -157.8422,
    aliases: ["ala moana", "ala moana beach", "magic island"]
  }
];

// MCP tools available to the agent
const TOOLS = [
  {
    name: "resolveSpot",
    description: "Convert a Hawaii beach/surf spot name into coordinates. Use this when user mentions a location by name.",
    parameters: { spot: "string - name of the Hawaii location (e.g., 'Waikiki', 'North Shore')" }
  },
  {
    name: "getWeather",
    description: "Get current weather conditions including temperature, precipitation, wind speed for given coordinates.",
    parameters: { lat: "number", lon: "number" }
  },
  {
    name: "getSurf",
    description: "Get surf forecast including wave height, period, and direction for given coordinates.",
    parameters: { lat: "number", lon: "number" }
  },
  {
    name: "getOutdoorIndex",
    description: "Calculate a 0-10 outdoor comfort score based on current weather conditions.",
    parameters: { lat: "number", lon: "number" }
  },
  {
    name: "getTides",
    description: "Get tide information including current level and next high/low tide times for Hawaii locations.",
    parameters: { lat: "number", lon: "number" }
  },
  {
    name: "getUVIndex",
    description: "Get UV index with sun protection recommendations and risk level.",
    parameters: { lat: "number", lon: "number" }
  },
  {
    name: "recommendBeaches",
    description: "Get beach recommendations based on criteria like family-friendly, surf, snorkel, scenic, or specific island.",
    parameters: { family: "boolean (optional)", surf: "boolean (optional)", snorkel: "boolean (optional)", scenic: "boolean (optional)", island: "string (optional)" }
  },
  {
    name: "getBeachScore",
    description: "Get comprehensive beach score (0-10 scale) including weather, waves, UV, tides, and crowd levels for any location.",
    parameters: { lat: "number", lon: "number", beachType: "string (optional)", crowdLevel: "number (optional)" }
  }
];

const MCP_SERVER_URL = "http://localhost:4100/mcp";

// Cache utility functions
function normalizeLocationName(name?: string): string {
  return (name || 'general').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function hashQuestion(question: string): string {
  let hash = 0;
  for (let i = 0; i < question.length; i++) {
    hash = (hash * 31 + question.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function isFutureQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  return /(tomorrow|later|next|tonight|morning|afternoon|evening|hour|hrs|time|forecast|plan|schedule)/.test(lower);
}

function shouldUseCache(question: string): boolean {
  const lower = question.toLowerCase();
  if (isFutureQuestion(question)) return false;
  if (/(kids|family|recommend|best|where|calmer|score|plan)/.test(lower)) return false;
  const intent = classifyQuestionIntent(question);
  return intent === "simple";
}

function generateCacheKey(question: string, toolResults: any[]): string {
  const q = question.toLowerCase().trim();
  
  // Extract location and question type for cache key
  let location = 'general';
  let questionType = 'general';
  
  // Extract location (more comprehensive)
  if (q.includes('waikiki')) location = 'waikiki';
  else if (q.includes('north shore') || q.includes('northshore')) location = 'northshore';
  else if (q.includes('kailua')) location = 'kailua';
  else if (q.includes('honolulu')) location = 'honolulu';
  else if (q.includes('lanikai')) location = 'lanikai';
  else if (q.includes('hanauma')) location = 'hanauma';
  else if (q.includes('ala moana')) location = 'alamoana';
  
  // If no location in question, try to infer from tool results
  if (toolResults.length > 0) {
    if (location === 'general') {
      const weatherResult = toolResults.find(r => r.tool === 'getWeather');
      if (weatherResult?.result?.location) {
        location = normalizeLocationName(weatherResult.result.location);
      }
    }
    
    if (location === 'general') {
      const resolveResult = toolResults.find(r => r.tool === 'resolveSpot');
      if (resolveResult?.result?.name) {
        location = normalizeLocationName(resolveResult.result.name);
      }
    }
    
    if (location === 'general') {
      const recommendResult = toolResults.find(r => r.tool === 'recommendBeaches');
      const topRecommendation = Array.isArray(recommendResult?.result) ? recommendResult.result[0] : null;
      if (topRecommendation?.name) {
        location = normalizeLocationName(topRecommendation.name);
      }
    }
  }
  
  // Extract question type (more comprehensive)
  if (q.includes('weather') || q.includes('temperature') || q.includes('temp')) {
    questionType = 'weather';
  } else if (q.includes('surf') || q.includes('wave') || q.includes('good to surf') || q.includes('surfing')) {
    questionType = 'surf';
  } else if (q.includes('score') || q.includes('rating')) {
    questionType = 'beachscore';
  } else if (q.includes('tide')) {
    questionType = 'tide';
  } else if (q.includes('family') || q.includes('kids') || q.includes('children')) {
    questionType = 'family';
  } else if (q.includes('recommend') || q.includes('best beach')) {
    questionType = 'recommend';
  }
  
  // Create time-based key (round to nearest 5 minutes for weather, 10 for surf)
  const now = new Date();
  const timeKey = questionType === 'weather' ? 
    Math.floor(now.getTime() / (5 * 60 * 1000)) : // 5-minute buckets
    Math.floor(now.getTime() / (10 * 60 * 1000));  // 10-minute buckets
  
  let key = `${questionType}:${location}:${timeKey}`;
  
  if (questionType === 'general' || questionType === 'recommend' || questionType === 'family' || location === 'general') {
    const signature = hashQuestion(q.replace(/[^a-z0-9]/g, ''));
    key = `${key}:${signature}`;
  }
  
  console.log(`🔑 Cache key details: question="${q}", location="${location}", type="${questionType}", timeKey="${timeKey}"`);
  return key;
}

function getCacheEntry(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) {
    cacheStats.misses++;
    cacheStats.total++;
    return null;
  }
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    responseCache.delete(key);
    cacheStats.misses++;
    cacheStats.total++;
    return null;
  }
  
  cacheStats.hits++;
  cacheStats.total++;
  console.log(`📊 Cache stats: ${cacheStats.hits}/${cacheStats.total} hits (${Math.round(cacheStats.hits/cacheStats.total*100)}%)`);
  return entry.response;
}

function setCacheEntry(key: string, response: string, questionType: string): void {
  const ttl = CACHE_TTL[questionType.toUpperCase() as keyof typeof CACHE_TTL] || CACHE_TTL.GENERAL;
  responseCache.set(key, {
    response,
    timestamp: Date.now(),
    ttl
  });
  
  // Log cache hit for monitoring
  console.log(`💾 Cached response for key: ${key}`);
  
  // Cleanup old entries periodically (keep cache size manageable)
  if (responseCache.size > 100) {
    cleanupCache();
  }
}

function cleanupCache(): void {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      responseCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, ms);
    
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function safeGenerateContent(prompt: string, timeoutMessage: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  Gemini API key missing; skipping model call");
    return null;
  }
  
  try {
    const result = await withTimeout(model.generateContent(prompt), MODEL_TIMEOUT_MS, timeoutMessage);
    const text = result?.response?.text?.() ?? "";
    return text.trim() ? text : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gemini error";
    console.error(`❌ Gemini generateContent failed: ${message}`);
    return null;
  }
}

function findSpotMatch(text: string): SpotInfo | null {
  const lower = text.toLowerCase();
  for (const spot of KNOWN_SPOTS) {
    if (spot.aliases.some(alias => lower.includes(alias))) {
      return spot;
    }
    if (lower.includes(spot.spot.toLowerCase())) {
      return spot;
    }
  }
  return null;
}

function detectSpotFromConversation(conversation: ConversationTurn[] = []): SpotInfo | null {
  if (!conversation.length) return null;
  let aiFallback: SpotInfo | null = null;
  for (let i = conversation.length - 1; i >= 0; i--) {
    const turn = conversation[i];
    if (!turn?.text) continue;
    const match = findSpotMatch(turn.text);
    if (!match) continue;
    if (turn.isUser !== false) {
      return match;
    }
    if (!aiFallback) {
      aiFallback = match;
    }
  }
  return aiFallback;
}

function deriveConversationState(question: string, conversation: ConversationTurn[] = []): ConversationState {
  const state: ConversationState = {
    priorRecommendations: []
  };
  const questionSpot = findSpotMatch(question);
  if (questionSpot) {
    state.focusSpot = questionSpot;
  }
  for (let i = conversation.length - 1; i >= 0; i--) {
    const turn = conversation[i];
    if (!turn?.text) continue;
    if (!state.lastAssistant && turn.isUser === false) {
      state.lastAssistant = turn.text.trim();
    }
    const spot = findSpotMatch(turn.text);
    if (!spot) continue;
    if (!state.focusSpot && turn.isUser !== false) {
      state.focusSpot = spot;
    }
    if (turn.isUser === false && !state.priorRecommendations.includes(spot.spot)) {
      state.priorRecommendations.push(spot.spot);
    }
  }
  return state;
}

function fallbackToolPlan(question: string, conversation: ConversationTurn[] = []): any[] {
  const q = question.toLowerCase();
  const plan: any[] = [];
  const explicitSpot = findSpotMatch(q);
  const contextualSpot = explicitSpot || detectSpotFromConversation(conversation);
  const intentSignals = analyzeConversationIntent(question, conversation);
  
  const wantsRecommendation = /(best|recommend|where should).*(beach|spot)/.test(q);
  const wantsScore = q.includes("score") || q.includes("rating");
  const wantsSurf = q.includes("surf") || q.includes("wave") || q.includes("swell") || intentSignals.wantsSurf;
  const wantsFamily = q.includes("family") || q.includes("kids") || q.includes("children") || intentSignals.wantsFamily;
  const wantsSnorkel = q.includes("snorkel") || intentSignals.wantsSnorkel;
  const wantsWeather = q.includes("weather") || q.includes("temperature") || q.includes("temp") || q.includes("rain");
  const wantsTide = q.includes("tide");
  const wantsUV = q.includes("uv");
  const wantsOutdoorIndex = q.includes("should") || q.includes("conditions") || q.includes("overall");
  
  if (!contextualSpot) {
    if (wantsRecommendation) {
      const recommendArgs: any = {};
      if (wantsFamily) recommendArgs.family = true;
      if (wantsSurf) recommendArgs.surf = true;
      if (wantsSnorkel) recommendArgs.snorkel = true;
      plan.push({ tool: "recommendBeaches", args: recommendArgs });
    }
    return plan;
  }
  
  plan.push({ tool: "resolveSpot", args: { spot: contextualSpot.spot } });
  const coords = { lat: contextualSpot.lat, lon: contextualSpot.lon };
  
  const addTool = (tool: string, args: any) => {
    if (!plan.some(item => item.tool === tool)) {
      plan.push({ tool, args });
    }
  };
  
  if (wantsWeather) {
    addTool("getWeather", coords);
  }
  
  if (wantsSurf) {
    addTool("getSurf", coords);
    if (wantsTide || !plan.some(item => item.tool === "getTides")) {
      addTool("getTides", coords);
    }
  } else if (wantsTide) {
    addTool("getTides", coords);
  }
  
  if (wantsUV) {
    addTool("getUVIndex", coords);
  }
  
  if (wantsOutdoorIndex) {
    addTool("getOutdoorIndex", coords);
  }
  
  if (wantsScore) {
    addTool("getBeachScore", { lat: contextualSpot.lat, lon: contextualSpot.lon, beach: contextualSpot.spot });
  }
  
  if (wantsRecommendation) {
    const recommendArgs: any = {};
    if (wantsFamily) recommendArgs.family = true;
    if (wantsSurf) recommendArgs.surf = true;
    if (wantsSnorkel) recommendArgs.snorkel = true;
    addTool("recommendBeaches", recommendArgs);
  }
  
  return plan;
}

function getDisplayLocation(raw?: string): string | null {
  if (!raw || raw.toLowerCase() === "the area") return null;
  const match = findSpotMatch(raw);
  return match?.display || raw;
}

function describeSurfMood(waveHeight?: number, conditions?: string): string {
  if (typeof waveHeight === "number") {
    if (waveHeight >= 6) return "pumping";
    if (waveHeight >= 3) return "pretty fun";
    if (waveHeight >= 1) return "nice and mellow";
    return "almost lake-flat";
  }
  
  if (conditions) {
    const lower = conditions.toLowerCase();
    if (lower.includes("rain")) return "a bit rainy";
    if (lower.includes("cloud")) return "a touch cloudy";
    if (lower.includes("wind")) return "a little breezy";
    if (lower.includes("sun")) return "sunny";
  }
  
  return "looking good";
}

function normalizeSentence(text: string): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (/[.!?]$/.test(cleaned)) return cleaned;
  return `${cleaned}.`;
}

function normalizeForComparison(text: string | undefined): string {
  if (!text) return "";
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  if (items.length === 2) {
    const first = items[0] ?? "";
    const second = items[1] ?? "";
    return `${first} or ${second}`.trim();
  }
  const head = items.slice(0, -1).filter(Boolean);
  const tail = items[items.length - 1] ?? "";
  return `${head.join(", ")}, or ${tail}`.trim();
}

const COMFORT_VARIANTS = [
  "Feels comfortable outside - I'd head out soon before the afternoon breeze picks up.",
  "Looking mellow out there - grab your spot before the tradewinds wake up.",
  "Super comfortable right now, so I'd roll out before the afternoon breeze shows up."
];

const BEACH_CHILL_VARIANTS = [
  "Great time for a beach hang - pack reef-safe sunscreen and claim a shady spot early.",
  "Perfect mellow window for the beach - grab a shady corner and settle in.",
  "Easy beach weather for the crew - snag a spot and enjoy the calm before it warms up."
];

const FAMILY_SURF_VARIANTS = [
  "The inside stays mellow so the keiki can splash while you slide out a little farther for those rolling sets.",
  "Plenty of room for the kids in the lagoon while you snag a couple of cruisy peelers just beyond them.",
  "Shallow water hugs the sand so the family hangs close as you paddle a few yards out for waist-high lines."
];

function deterministicPick(seed: string, variants: string[]): string {
  if (!variants.length) return "";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const index = hash % variants.length;
  return variants[index] ?? variants[0] ?? "";
}

function buildRecommendationSentence(question: string, context: TemplateContext, waveHeight?: number): string | null {
  const activity = context.activityType;
  const wind = typeof context.windSpeed === "number" ? context.windSpeed : undefined;
  const precipitation = typeof context.precipitation === "number" ? context.precipitation : undefined;
  const temperature = typeof context.temperature === "number" ? context.temperature : undefined;
  const seed = `${context.location}:${question}`;
  
  if (context.wantsFamily && context.wantsSurf && !context.togetherPreference) {
    return deterministicPick(seed, FAMILY_SURF_VARIANTS);
  }
  
  if (activity === "surfing" && typeof waveHeight === "number") {
    if (waveHeight >= 6) return "Only confident surfers should paddle out until the sets ease.";
    if (waveHeight >= 3) return "Grab a shortboard and aim for the earlier tide before tradewinds rough it up.";
    if (waveHeight >= 1) return "Perfect window for a mellow longboard cruise or soft-top session.";
    return "Surf's tiny, so maybe switch it up with a snorkel or beach walk instead.";
  }
  
  if (activity === "snorkeling" && typeof waveHeight === "number") {
    if (waveHeight >= 3) return "Water's a bit rough for snorkeling, so look for a sheltered cove or wait for the tide to drop.";
    return "Visibility should be solid for snorkeling, just hug the reef and watch the current.";
  }
  
  if ((activity === "family" || activity === "general") && typeof waveHeight === "number") {
    if (waveHeight >= 4) return "Waves are punchy, so stick close to shore or pick a calmer spot for the kiddos.";
    if (waveHeight <= 2 && typeof wind === "number" && wind < 18) {
      return deterministicPick(seed, BEACH_CHILL_VARIANTS);
    }
  }
  
  if (typeof precipitation === "number" && precipitation > 0.1) {
    return "Expect a few windward showers rolling through, so stash a light jacket with your beach gear.";
  }
  
  if (typeof temperature === "number" && typeof wind === "number" && wind < 15) {
    return deterministicPick(seed, COMFORT_VARIANTS);
  }
  
  return null;
}

function buildSafetyTip(context: TemplateContext, waveHeight?: number): string | null {
  const uv = typeof context.uvIndex === "number" ? context.uvIndex : undefined;
  const wind = typeof context.windSpeed === "number" ? context.windSpeed : undefined;
  
  if (uv && uv >= 8) {
    return "UV index is blazing, so reapply reef-safe sunscreen and bring a rash guard.";
  }
  
  if (waveHeight && waveHeight >= 6) {
    return "Watch for strong rip currents and never paddle out alone.";
  }
  
  if (wind && wind >= 20) {
    return "Trades are howling, so expect chop and secure anything you leave on the sand.";
  }
  
  return null;
}

function buildConversationalResponse(question: string, context: TemplateContext, toolResults: any[], state?: ConversationState): string | null {
  if (isFutureQuestion(question)) {
    return null;
  }
  const waveHeight = typeof context.waveHeight === "number" ? context.waveHeight : undefined;
  let displayLocation = getDisplayLocation(context.location);
  const temperature = typeof context.temperature === "number" ? Math.round(context.temperature) : undefined;
  const windSpeed = typeof context.windSpeed === "number" ? Math.round(context.windSpeed) : undefined;
  const recommendResult = toolResults.find(r => r.tool === "recommendBeaches");
  const recommendedRaw = Array.isArray(recommendResult?.result) ? recommendResult.result : [];
  let recommendations = recommendedRaw.filter((item: any) => item && item.name);
  if (context.wantsFamily || context.togetherPreference) {
    const familyList = recommendations.filter((item: any) => (item.type || '').toLowerCase().includes('family'));
    if (familyList.length) {
      recommendations = familyList;
    }
  }
  if (context.wantsSnorkel) {
    const snorkelList = recommendations.filter((item: any) => (item.type || '').toLowerCase().includes('snorkel'));
    if (snorkelList.length) {
      recommendations = snorkelList;
    }
  }
  if (state?.priorRecommendations?.length) {
    const unused = recommendations.filter((item: any) => !state.priorRecommendations.includes(item.name));
    if (unused.length) {
      recommendations = unused;
    }
  }
  const primaryRecommendation = recommendations[0];
  if (!displayLocation && primaryRecommendation) {
    displayLocation = primaryRecommendation.name;
  }
  
  const summaryParts: string[] = [];
  if (typeof waveHeight === "number" && !Number.isNaN(waveHeight)) {
    summaryParts.push(`${waveHeight.toFixed(1)}ft waves`);
  }
  if (typeof temperature === "number" && !Number.isNaN(temperature)) {
    summaryParts.push(`${temperature}°F`);
  }
  if (typeof windSpeed === "number" && !Number.isNaN(windSpeed)) {
    summaryParts.push(`${windSpeed}mph wind`);
  }
  
  if (summaryParts.length === 0) {
    const weatherResult = toolResults.find(r => r.tool === "getWeather")?.result;
    if (!weatherResult?.current_converted) return null;
    const temp = weatherResult.current_converted.temperature_fahrenheit;
    const wind = weatherResult.current_converted.wind_speed_mph;
    const cond = weatherResult.current?.conditions || context.conditions;
    const fallbackSummary = [];
    if (typeof temp === "number") fallbackSummary.push(`${Math.round(temp)}°F`);
    if (typeof wind === "number") fallbackSummary.push(`${Math.round(wind)}mph wind`);
    if (!fallbackSummary.length) return null;
    summaryParts.push(...fallbackSummary);
    if (cond) summaryParts.push(cond.toLowerCase());
  }
  
  const mood = describeSurfMood(waveHeight, context.conditions);
  const sentences: string[] = [];
  let firstSentence: string | null = null;
  
  if (primaryRecommendation) {
    const topName = displayLocation || primaryRecommendation.name || "This spot";
    const descriptor = typeof primaryRecommendation.description === "string" ? primaryRecommendation.description.split(/[.!]/)[0] : "";
    const summaryText = summaryParts.length ? summaryParts.join(", ") : descriptor;
    const focusPhrase = context.togetherPreference ? "for the whole crew" : context.wantsFamily
      ? "for a chill family beach day"
      : context.wantsSurf
        ? "for a quick surf check"
        : "right now";
    if (summaryText) {
      firstSentence = `${topName}'s ${mood} ${focusPhrase} - ${summaryText}.`;
    } else {
      firstSentence = `${topName} should be ${mood} ${focusPhrase}.`;
    }
  } else {
    const locationPhrase = displayLocation ? `${displayLocation}'s ${mood}` : `Conditions are ${mood}`;
    let constructed = `${locationPhrase} right now`;
    if (summaryParts.length) {
      constructed += ` - ${summaryParts.join(", ")}.`;
    } else {
      constructed += ".";
    }
    firstSentence = constructed;
  }
  
  const normalizedFirst = normalizeSentence(firstSentence);
  if (normalizedFirst) {
    sentences.push(normalizedFirst);
  }
  
  const recommendation = buildRecommendationSentence(question, context, waveHeight);
  const normalizedRecommendation = recommendation ? normalizeSentence(recommendation) : null;
  if (normalizedRecommendation) {
    sentences.push(normalizedRecommendation);
  }
  
  if (recommendations.length > 1 && sentences.length < 3) {
    const altNames = recommendations.slice(1, 3).map((item: any) => item.name).filter(Boolean);
    if (altNames.length > 0) {
      let altSentence: string | null = null;
      if (context.wantsFamily && context.wantsSurf && !context.togetherPreference) {
        altSentence = normalizeSentence(`If you want a backup with easy surf, ${formatList(altNames)} keep everyone smiling without much paddling.`);
      } else {
        altSentence = normalizeSentence(`If you want to mix it up, ${formatList(altNames)} stay nice and mellow too.`);
      }
      if (altSentence) {
        sentences.push(altSentence);
      }
    }
  }
  
  const safety = buildSafetyTip(context, waveHeight);
  const normalizedSafety = safety ? normalizeSentence(safety) : null;
  if (normalizedSafety && sentences.length < 3) {
    sentences.push(normalizedSafety);
  }
  
  if (!sentences.length) {
    return null;
  }
  
  return sentences.slice(0, 3).join(" ");
}

// Call an MCP tool
async function callMCPTool(toolName: string, args: any): Promise<any> {
  try {
    const response = await axios.post(
      MCP_SERVER_URL,
      {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream"
        },
        timeout: MCP_TOOL_TIMEOUT_MS
      }
    );
    
    return response.data.result?.structuredContent || response.data.result;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        console.error(`Timeout calling tool ${toolName} after ${MCP_TOOL_TIMEOUT_MS}ms`);
        throw new Error(`Timed out calling ${toolName}`);
      }
      const message = error.response?.data?.error?.message || error.message || "Unknown MCP error";
      console.error(`Error calling tool ${toolName}:`, message);
      throw new Error(`Failed to call ${toolName}: ${message}`);
    }
    console.error(`Unexpected error calling tool ${toolName}:`, (error as Error).message);
    throw error;
  }
}

// System prompt that teaches AI how to use tools
const SYSTEM_PROMPT = `You are a knowledgeable, friendly Hawaii beach and surf guide. You help visitors plan their perfect day in paradise.

**PERSONALITY:**
- Be conversational and enthusiastic about Hawaii
- Use local knowledge and insider tips
- Be helpful but concise (2-3 sentences max)
- Sound like a local friend giving advice
- Use emojis sparingly but effectively

**EXPERTISE:**
- Weather patterns and microclimates across Hawaii
- Surf conditions, wave quality, and safety
- Beach characteristics and best activities
- Local timing (tides, crowds, conditions)
- Safety considerations for all activities

**RESPONSE STYLE:**
- Start naturally (no "Yes," "No," or formal greetings)
- Be specific with recommendations
- Mention timing when relevant
- Include safety tips when needed
- End with helpful next steps or alternatives

**CONTEXT AWARENESS:**
- Remember previous questions in the conversation
- Build on previous recommendations
- Reference earlier locations or activities
- Provide follow-up suggestions

**YOUR AVAILABLE TOOLS:**
${TOOLS.map(t => `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`).join('\n')}

**YOUR PROCESS:**
1. When user asks about a location by name, FIRST call resolveSpot to get coordinates
2. Then call weather/surf/outdoorIndex tools with those coordinates
3. Analyze the data and give helpful, friendly recommendations
4. Focus on SURF and BEACH activities for now

**RULES:**
- ONLY answer questions about Hawaii outdoor activities
- Always be helpful, friendly, and safety-conscious
- Give specific recommendations based on actual data
- If conditions are dangerous, warn the user clearly
- Keep responses concise but informative (2-4 paragraphs max)

**EXAMPLE FLOW:**
User: "Should I surf Waikiki today?"
You think: "I need to check Waikiki conditions"
1. Call resolveSpot("Waikiki") → get lat/lon
2. Call getWeather(lat, lon) → check weather
3. Call getSurf(lat, lon) → check waves
4. Call getOutdoorIndex(lat, lon) → check comfort
5. Analyze and respond with recommendation

Now help the user!`;

function classifyQuestionIntent(question: string): 'simple' | 'complex' | 'forecast' {
  const q = question.toLowerCase().trim();
  
  if (q.match(/(next|tomorrow|today|hour|hours|morning|afternoon|evening|all day|tonight|week|weekend)/)) {
    return 'forecast';
  }
  
  if (q.match(/(should|recommend|best|compare|advice|when|where|which|good|bad)/)) {
    return 'complex';
  }
  
  if (q.match(/^(what's|how's|what is|how is|current).*(weather|surf|waves|temperature|temp)/)) {
    return 'simple';
  }
  
  return 'simple'; // Default to simple for safety
}

// Extract template context from tool results
function extractTemplateContext(toolResults: any[], question: string, conversation: ConversationTurn[] = []): TemplateContext {
  const context: TemplateContext = {
    location: 'the area',
    temperature: 75,
    windSpeed: 10,
    precipitation: 0,
    conditions: 'clear sky',
    timeOfDay: getCurrentTimeOfDay(),
    activityType: detectActivityType(question, conversation)
  };
  const intents = analyzeConversationIntent(question, conversation);
  context.wantsFamily = intents.wantsFamily;
  context.wantsSurf = intents.wantsSurf;
  context.wantsSnorkel = intents.wantsSnorkel;
  context.togetherPreference = intents.togetherPreference;

  // Extract weather data
  const weatherResult = toolResults.find(r => r.tool === 'getWeather');
  if (weatherResult?.result) {
    const weather = weatherResult.result;
    context.location = weather.location || context.location;
    context.temperature = weather.current_converted?.temperature_fahrenheit || weather.current?.temperature_2m || context.temperature;
    context.windSpeed = weather.current_converted?.wind_speed_mph || weather.current?.wind_speed_10m || context.windSpeed;
    context.precipitation = weather.current?.precipitation || context.precipitation;
    context.conditions = getWeatherDescription(weather.current?.weather_code) || context.conditions;
    context.hourlyForecast = weather.hourly_forecast;
  }

  // Extract surf data
  const surfResult = toolResults.find(r => r.tool === 'getSurf');
  if (surfResult?.result) {
    const surf = surfResult.result;
    context.waveHeight = surf.hourly_converted?.wave_height_feet?.[0] || (surf.hourly?.wave_height?.[0] ? surf.hourly.wave_height[0] * 3.28084 : undefined);
    context.wavePeriod = surf.hourly?.wave_period?.[0];
  }

  if (context.location === 'the area') {
    const resolveResult = toolResults.find(r => r.tool === 'resolveSpot');
    if (resolveResult?.result?.name) {
      context.location = resolveResult.result.name;
    }
  }

  // Extract UV data
  const uvResult = toolResults.find(r => r.tool === 'getUV');
  if (uvResult?.result) {
    context.uvIndex = uvResult.result.uv_index;
  }

  // Extract tide data
  const tideResult = toolResults.find(r => r.tool === 'getTides');
  if (tideResult?.result) {
    context.tideLevel = tideResult.result.current_tide_level;
  }

  // Extract beach score
  const scoreResult = toolResults.find(r => r.tool === 'getBeachScore');
  if (scoreResult?.result) {
    context.beachScore = scoreResult.result.overall;
  }

  const recommendResult = toolResults.find(r => r.tool === 'recommendBeaches');
  if (Array.isArray(recommendResult?.result)) {
    const recommendations = recommendResult.result.filter((item: any) => item && item.name);
    if (recommendations.length > 0) {
      context.primaryRecommendation = recommendations[0].name;
      context.recommendedBeaches = recommendations.map((item: any) => item.name);
      if (context.location === 'the area') {
        context.location = recommendations[0].name || context.location;
      }
    }
  }

  return context;
}

// Helper functions for template context
function getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

function collectRecentUserTexts(conversation: ConversationTurn[], limit = 5): string[] {
  return conversation
    .filter(turn => turn?.text && turn.isUser !== false)
    .slice(-limit)
    .map(turn => turn.text.toLowerCase());
}

function analyzeConversationIntent(question: string, conversation: ConversationTurn[] = []): { wantsFamily: boolean; wantsSurf: boolean; wantsSnorkel: boolean; togetherPreference: boolean } {
  const current = question.toLowerCase();
  const history = collectRecentUserTexts(conversation, 8);
  const togetherPreference = /whole family|all together|can't split|cant split|stay together|keep everyone/.test(current);
  const wantsFamilyCurrent = /family|kids|keiki|children|toddler|stroller/.test(current) || togetherPreference;
  const wantsSurfCurrent = /surf|wave|barrel|swell|longboard|shortboard/.test(current);
  const wantsSnorkelCurrent = /snorkel|reef|dive|fish/.test(current);
  const wantsFamilyHistory = history.some(text => /family|kids|keiki|children/.test(text));
  const wantsSurfHistory = history.some(text => /surf|wave|barrel|swell/.test(text));
  const wantsSnorkelHistory = history.some(text => /snorkel|reef|dive|fish/.test(text));
  let wantsFamily = wantsFamilyCurrent || wantsFamilyHistory;
  let wantsSurf = wantsSurfCurrent || (!wantsFamilyCurrent && !togetherPreference && wantsSurfHistory);
  let wantsSnorkel = wantsSnorkelCurrent || wantsSnorkelHistory;
  if (togetherPreference) {
    wantsSurf = wantsSurfCurrent;
  }
  return { wantsFamily, wantsSurf, wantsSnorkel, togetherPreference };
}

function detectActivityType(question: string, conversation: ConversationTurn[] = []): 'surfing' | 'family' | 'snorkeling' | 'general' {
  const q = question.toLowerCase();
  if (q.includes('surf') || q.includes('wave')) return 'surfing';
  if (q.includes('snorkel') || q.includes('dive')) return 'snorkeling';
  if (q.includes('family') || q.includes('kids') || q.includes('children')) return 'family';
  
  const signals = analyzeConversationIntent(question, conversation);
  if (signals.wantsSurf && !signals.wantsFamily && !signals.wantsSnorkel) return 'surfing';
  if (signals.wantsSnorkel && !signals.wantsSurf) return 'snorkeling';
  if (signals.wantsFamily) return 'family';
  return 'general';
}

function getWeatherDescription(weatherCode?: number): string {
  if (!weatherCode) return 'clear sky';
  
  if (weatherCode === 0) return 'clear sky';
  if (weatherCode <= 3) return 'partly cloudy';
  if (weatherCode <= 48) return 'foggy';
  if (weatherCode <= 67) return 'rainy';
  if (weatherCode <= 77) return 'snowy';
  if (weatherCode <= 82) return 'rain showers';
  if (weatherCode <= 86) return 'snow showers';
  return 'thunderstorm';
}

// Fast router - replaces Gemini planning for common questions
function fastRouteQuestion(question: string): any[] | null {
  const intent = classifyQuestionIntent(question);
  
  // Only use fast routing for simple current conditions
  if (intent !== 'simple') {
    console.log(`🚫 Skipping fast routing - ${intent} question detected: "${question}"`);
    return null;
  }
  
  const q = question.toLowerCase();
  
  // Weather questions (only simple current conditions)
  if (q.includes('weather') && q.includes('waikiki') && !q.includes('next') && !q.includes('tomorrow')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'Waikiki' } },
      { tool: 'getWeather', args: { lat: 21.2766, lon: -157.8269 } }
    ];
  }
  
  if (q.includes('weather') && q.includes('north shore') && !q.includes('next') && !q.includes('tomorrow')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'North Shore' } },
      { tool: 'getWeather', args: { lat: 21.6649, lon: -158.0532 } }
    ];
  }
  
  if (q.includes('weather') && q.includes('kailua') && !q.includes('next') && !q.includes('tomorrow')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'Kailua Beach' } },
      { tool: 'getWeather', args: { lat: 21.4010, lon: -157.7394 } }
    ];
  }
  
  // Temperature questions (only simple current conditions)
  if ((q.includes('temperature') || q.includes('temp')) && !q.includes('next') && !q.includes('tomorrow')) {
    if (q.includes('waikiki')) {
      return [
        { tool: 'resolveSpot', args: { spot: 'Waikiki' } },
        { tool: 'getWeather', args: { lat: 21.2766, lon: -157.8269 } }
      ];
    }
    if (q.includes('north shore')) {
      return [
        { tool: 'resolveSpot', args: { spot: 'North Shore' } },
        { tool: 'getWeather', args: { lat: 21.6649, lon: -158.0532 } }
      ];
    }
  }
  
  // Surf questions (only simple current conditions)
  if (q.includes('surf') && q.includes('waikiki') && !q.includes('next') && !q.includes('tomorrow')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'Waikiki' } },
      { tool: 'getWeather', args: { lat: 21.2766, lon: -157.8269 } },
      { tool: 'getSurf', args: { lat: 21.2766, lon: -157.8269 } },
      { tool: 'getTides', args: { lat: 21.2766, lon: -157.8269 } }
    ];
  }
  
  if (q.includes('surf') && q.includes('north shore') && !q.includes('next') && !q.includes('tomorrow')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'North Shore' } },
      { tool: 'getWeather', args: { lat: 21.6649, lon: -158.0532 } },
      { tool: 'getSurf', args: { lat: 21.6649, lon: -158.0532 } },
      { tool: 'getTides', args: { lat: 21.6649, lon: -158.0532 } }
    ];
  }
  
  // Wave questions (only simple current conditions)
  if (q.includes('wave') && q.includes('waikiki') && !q.includes('next') && !q.includes('tomorrow')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'Waikiki' } },
      { tool: 'getSurf', args: { lat: 21.2766, lon: -157.8269 } },
      { tool: 'getTides', args: { lat: 21.2766, lon: -157.8269 } }
    ];
  }
  
  if (q.includes('wave') && q.includes('north shore') && !q.includes('next') && !q.includes('tomorrow')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'North Shore' } },
      { tool: 'getSurf', args: { lat: 21.6649, lon: -158.0532 } },
      { tool: 'getTides', args: { lat: 21.6649, lon: -158.0532 } }
    ];
  }
  
  // Beach score questions
  if (q.includes('score') && q.includes('waikiki')) {
    return [
      { tool: 'getBeachScore', args: { beach: 'Waikiki Beach', lat: 21.2766, lon: -157.8269, activity: 'surfing' } }
    ];
  }
  
  if (q.includes('score') && q.includes('north shore')) {
    return [
      { tool: 'getBeachScore', args: { beach: 'North Shore', lat: 21.6649, lon: -158.0532, activity: 'surfing' } }
    ];
  }
  
  // Sun times questions
  if ((q.includes('sunrise') || q.includes('sunset') || q.includes('golden hour') || q.includes('day length')) && q.includes('waikiki')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'Waikiki' } },
      { tool: 'getSunTimes', args: { lat: 21.2766, lon: -157.8269 } }
    ];
  }
  
  if ((q.includes('sunrise') || q.includes('sunset') || q.includes('golden hour') || q.includes('day length')) && (q.includes('north shore') || q.includes('northshore'))) {
    return [
      { tool: 'resolveSpot', args: { spot: 'North Shore' } },
      { tool: 'getSunTimes', args: { lat: 21.6649, lon: -158.0532 } }
    ];
  }
  
  // General sun times questions (for any location)
  if ((q.includes('sunrise') || q.includes('sunset') || q.includes('golden hour') || q.includes('day length')) && !q.includes('waikiki') && !q.includes('north shore') && !q.includes('northshore')) {
    return [
      { tool: 'resolveSpot', args: { spot: 'Waikiki' } }, // Default to Waikiki if no specific location
      { tool: 'getSunTimes', args: { lat: 21.2766, lon: -157.8269 } }
    ];
  }
  
  // Best beach questions
  if (q.includes('best beach') || q.includes('recommend beach')) {
    return [
      { tool: 'recommendBeaches', args: { criteria: { activity: 'family' } } }
    ];
  }
  
  // Return null for complex questions that need Gemini
  return null;
}

// Fast response synthesizer - replaces Gemini synthesis for simple questions
function fastSynthesizeResponse(toolResults: any[], question: string): string | null {
  const intent = classifyQuestionIntent(question);
  
  // Only use fast synthesis for simple current conditions
  if (intent !== 'simple') {
    console.log(`🚫 Skipping fast synthesis - ${intent} question detected: "${question}"`);
    return null; // Let Gemini handle complex synthesis
  }
  
  const q = question.toLowerCase();
  
  // Check if question asks about future/hourly conditions
  const askingAboutFuture = q.includes('next') || q.includes('hour') || q.includes('later') || 
                           q.includes('afternoon') || q.includes('morning') || q.includes('tonight') ||
                           q.includes('today') || q.includes('forecast');
  
  // Only use fast synthesis for very specific, simple questions
  // Weather responses - check if asking for hourly forecast
  if ((q.includes('weather') || q.includes('temperature') || q.includes('temp')) && 
      !q.includes('should') && !q.includes('recommend') && !q.includes('advice') && 
      !q.includes('beginner') && !q.includes('safety') && !q.includes('first time')) {
    const weather = toolResults.find(r => r.tool === 'getWeather')?.result;
    if (weather) {
      // If asking about future AND we have hourly forecast data, use it
      if (askingAboutFuture && weather.hourly_forecast && weather.hourly_forecast.length > 0) {
        const location = weather.location || 'the area';
        
        let response = `Weather forecast for ${location} (next ${weather.hourly_forecast.length} hours):\n`;
        
        // Add hourly breakdown
        weather.hourly_forecast.forEach((hour: any) => {
          const emoji = hour.is_good_weather ? '☀️' : '⛅';
          response += `${emoji} ${hour.time}: ${hour.temperature_f}°F, ${hour.wind_mph}mph wind, ${hour.conditions}\n`;
        });
        
        return response;
      }
      
      // Otherwise return current conditions
      const temp = weather.current_converted?.temperature_fahrenheit || weather.current?.temperature_2m;
      const wind = weather.current_converted?.wind_speed_mph || weather.current?.wind_speed_10m;
      const precip = weather.current?.precipitation || 0;
      const location = weather.location || 'the area';
      
      return `Weather in ${location}: ${temp}°F, ${wind}mph winds, ${precip > 0 ? 'rain expected' : 'no rain'}.`;
    }
  }
  
  // Surf responses - only for direct surf condition questions
  if ((q.includes('surf') || q.includes('wave')) && 
      !q.includes('should') && !q.includes('recommend') && !q.includes('advice') && 
      !q.includes('beginner') && !q.includes('safety') && !q.includes('first time') &&
      !q.includes('what should') && !q.includes('what to know')) {
    const surf = toolResults.find(r => r.tool === 'getSurf')?.result;
    const weather = toolResults.find(r => r.tool === 'getWeather')?.result;
    const tides = toolResults.find(r => r.tool === 'getTides')?.result;
    
    if (surf) {
      // If asking about future AND we have hourly forecast data, use it
      if (askingAboutFuture && surf.hourly_forecast && surf.hourly_forecast.length > 0) {
        const location = 'the spot';
        
        let response = `Surf forecast for ${location} (next ${surf.hourly_forecast.length} hours):\n`;
        
        // Add hourly breakdown
        surf.hourly_forecast.forEach((hour: any) => {
          const emoji = hour.good_for_surfing ? '🏄' : '🌊';
          response += `${emoji} ${hour.time}: ${hour.wave_height_ft.toFixed(1)}ft, ${hour.wave_period_s}s, ${hour.wave_direction} - ${hour.quality_description} (${hour.quality}/5)\n`;
        });
        
        return response;
      }
      
      // Otherwise return current conditions
      const waveHeight = surf.hourly_converted?.wave_height_feet?.[0] || (surf.hourly?.wave_height?.[0] ? surf.hourly.wave_height[0] * 3.28 : 0);
      const wavePeriod = surf.hourly?.wave_period?.[0] || 0;
      const waveDirection = surf.hourly?.wave_direction?.[0] || 0;
      
      let response = `Surf conditions: ${waveHeight.toFixed(1)}ft waves, ${wavePeriod.toFixed(1)}s period`;
      
      if (waveDirection) {
        const direction = getWindDirection(waveDirection);
        response += ` from the ${direction}`;
      }
      
      if (tides) {
        const tideLevel = tides.current?.tide_level || 0;
        response += `. Tide level: ${tideLevel.toFixed(1)}ft`;
      }
      
      if (weather) {
        const temp = weather.current_converted?.temperature_fahrenheit || weather.current?.temperature_2m;
        const wind = weather.current_converted?.wind_speed_mph || weather.current?.wind_speed_10m;
        response += `. Weather: ${temp}°F, ${wind}mph winds`;
      }
      
      // Add surf recommendation
      if (waveHeight > 6) {
        response += '. Conditions are challenging - experienced surfers only.';
      } else if (waveHeight > 3) {
        response += '. Good surf conditions for intermediate surfers.';
      } else if (waveHeight > 1) {
        response += '. Gentle conditions perfect for beginners.';
      } else {
        response += '. Very calm conditions - great for learning.';
      }
      
      return response;
    }
  }
  
  // Beach score responses - only for direct score questions
  if (q.includes('score') && !q.includes('should') && !q.includes('recommend') && !q.includes('advice')) {
    const score = toolResults.find(r => r.tool === 'getBeachScore')?.result;
    if (score) {
      return `Beach score: ${score.overall}/10. ${score.recommendations?.[0] || 'Good conditions today!'}`;
    }
  }
  
  // Comparison questions (e.g., "2pm or 5pm surf time")
  if ((q.includes(' or ') || q.includes('" or "') || q.includes("' or '")) && (q.includes('pm') || q.includes('am') || q.includes('hour'))) {
    const surf = toolResults.find(r => r.tool === 'getSurf')?.result;
    const weather = toolResults.find(r => r.tool === 'getWeather')?.result;
    
    if (surf && surf.hourly_forecast && surf.hourly_forecast.length > 0) {
      // Extract times from question (handle quotes and various formats)
      const timeMatches = q.match(/(\d{1,2})(am|pm)/gi);
      if (timeMatches && timeMatches.length >= 2) {
        const times = timeMatches.map(match => {
          const matchResult = match.match(/(\d{1,2})(am|pm)/i);
          if (!matchResult || !matchResult[1] || !matchResult[2]) return null;
          const hour = matchResult[1];
          const period = matchResult[2];
          let hour24 = parseInt(hour);
          if (period.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
          if (period.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
          return { original: match, hour24, hour: parseInt(hour), period: period.toLowerCase() };
        }).filter((t): t is NonNullable<typeof t> => t !== null);
        
        let response = `Surf comparison for ${times.map(t => t.original).join(' vs ')}:\n\n`;
        
        times.forEach(time => {
          const hourData = surf.hourly_forecast.find((h: any) => h.hour_24 === time.hour24);
          if (hourData) {
            const emoji = hourData.good_for_surfing ? '🏄' : '🌊';
            response += `${emoji} ${time.original}: ${hourData.wave_height_ft.toFixed(1)}ft, ${hourData.wave_period_s}s, ${hourData.wave_direction} - ${hourData.quality_description} (${hourData.quality}/5)\n`;
          }
        });
        
        // Add recommendation
        const bestTime = times.reduce((best, current) => {
          const currentData = surf.hourly_forecast.find((h: any) => h.hour_24 === current.hour24);
          const bestData = surf.hourly_forecast.find((h: any) => h.hour_24 === best.hour24);
          return (currentData?.quality || 0) > (bestData?.quality || 0) ? current : best;
        });
        
        const bestData = surf.hourly_forecast.find((h: any) => h.hour_24 === bestTime.hour24);
        if (bestData) {
          response += `\n🏆 Best choice: ${bestTime.original} (${bestData.quality}/5 quality)`;
        }
        
        return response;
      }
    }
  }
  
  // Sun times responses
  if (q.includes('sunrise') || q.includes('sunset') || q.includes('golden hour') || q.includes('day length')) {
    const sunTimes = toolResults.find(r => r.tool === 'getSunTimes')?.result;
    if (sunTimes) {
      let response = `Sun times for today:\n`;
      response += `🌅 Sunrise: ${sunTimes.sunrise.formatted}\n`;
      response += `🌇 Sunset: ${sunTimes.sunset.formatted}\n`;
      response += `⏰ Day length: ${sunTimes.day_length.formatted}\n`;
      response += `✨ Golden hour: ${sunTimes.golden_hour.start.formatted} - ${sunTimes.golden_hour.end.formatted}`;
      return response;
    }
  }
  
  // Return null for complex responses that need Gemini
  return null;
}

// Helper function to convert wind direction degrees to compass direction
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index] || 'N';
}

// Main agent function
export async function askAgent(question: string, conversation: any[] = []): Promise<string> {
  try {
    console.log("\n🤔 User question:", question);
  
    
    // Log conversation context
    if (conversation && conversation.length > 0) {
      console.log("💬 Conversation context:", conversation.length, "messages");
      conversation.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.isUser ? 'User' : 'AI'}: ${msg.text.substring(0, 50)}...`);
      });
    }
    const state = deriveConversationState(question, conversation as ConversationTurn[]);

    // Check cache first (before any processing)
    const useCache = shouldUseCache(question);
    let initialCacheKey: string | null = null;
    if (useCache) {
      initialCacheKey = generateCacheKey(question, []);
      console.log(`🔑 Generated cache key: ${initialCacheKey}`);
      const cachedResponse = getCacheEntry(initialCacheKey);
      if (cachedResponse) {
        console.log("⚡ Cache HIT! Returning cached response");
        return cachedResponse;
      }
      console.log("💾 Cache MISS - processing new request");
    } else {
      console.log("🚫 Skipping cache for this question");
    }
    
    // Phase 1: Try fast routing first, fallback to Gemini for complex questions
    let toolCalls: any[] = [];
    
    // Build conversation context for both fast route and Gemini
    const sessionNotes: string[] = [];
    const intentSignals = analyzeConversationIntent(question, conversation as ConversationTurn[]);
    if (intentSignals.wantsFamily) sessionNotes.push('User wants family-friendly conditions.');
    if (intentSignals.wantsSurf) sessionNotes.push('User also wants to surf.');
    if (intentSignals.wantsSnorkel) sessionNotes.push('User is interested in snorkeling.');
    if (intentSignals.togetherPreference) sessionNotes.push('Keep the whole family together at one spot.');
    if (state.focusSpot) sessionNotes.push(`Recent focus: ${state.focusSpot.display || state.focusSpot.spot}.`);

    const conversationContext = conversation.length > 0 ? 
      `\n**CONVERSATION HISTORY:**\n${conversation.map(msg => 
        `${msg.isUser ? 'User' : 'AI'}: ${msg.text}`
      ).join('\n')}\n${sessionNotes.length ? `\n**SESSION NOTES:**\n- ${sessionNotes.join('\n- ')}\n` : ''}` : '';
    
    const fastRouteResult = fastRouteQuestion(question);
    if (fastRouteResult) {
      console.log("⚡ Using fast routing for simple question...");
      toolCalls = fastRouteResult;
    } else {
      console.log("🧠 Using Gemini for complex question...");
          // Phase 1: Let AI decide what tools to call
          
          const planningPrompt = `${SYSTEM_PROMPT}${conversationContext}

**USER QUESTION:** "${question}"

**YOUR TASK:** Analyze the question and call ONLY the tools needed to answer it. Be conversational and helpful!

**Available tools:**
1. **resolveSpot** - Convert location name to coordinates (ALWAYS call first if location mentioned)
2. **getWeather** - Get temperature, wind, precipitation (for weather questions)
3. **getSurf** - Get wave height, period, direction (for surf/wave questions)
4. **getOutdoorIndex** - Get 0-10 outdoor comfort score (for "should I" or "conditions" questions)
5. **getTides** - Get tide level and next high/low tide times (for surf timing questions)
6. **getUVIndex** - Get UV index and sun protection advice (for safety questions)
7. **recommendBeaches** - Get beach recommendations based on criteria (for "best beach" questions)
8. **getBeachScore** - Get comprehensive 0-10 beach score with detailed breakdown (for scoring questions)

**Decision guide:**
- "What's the weather?" → resolveSpot + getWeather + getUVIndex
- "How are the waves?" → resolveSpot + getSurf + getTides
- "Should I surf?" → resolveSpot + getWeather + getSurf + getTides + getOutdoorIndex (comprehensive)
- "What's the temperature?" → resolveSpot + getWeather + getUVIndex
- "Overall conditions?" → resolveSpot + getWeather + getSurf + getTides + getUVIndex + getOutdoorIndex
- "Best time to surf?" → resolveSpot + getSurf + getTides + getWeather
- "Best beach for families?" → recommendBeaches(family: true) + getBeachScore for top recommendations
- "Best beach to go to?" → recommendBeaches + getBeachScore for top spots
- "Score this beach" → resolveSpot + getBeachScore
- "How good is [beach] today?" → resolveSpot + getBeachScore

**IMPORTANT - Time-based questions:**
- "weather for next 8 hours" → resolveSpot + getWeather (provides hourly forecast)
- "surf conditions tomorrow" → resolveSpot + getSurf (provides daily forecast)
- "what about tomorrow" → resolveSpot + getWeather + getSurf (comprehensive forecast)
- "forecast for [location]" → resolveSpot + getWeather + getSurf + getTides

**CRITICAL - Follow-up questions:**
- If user asks "what about for the next 8 hours" after asking about a location, use the SAME location
- If user asks "what about tomorrow" after asking about weather, get weather + surf for that location
- Always check conversation context to determine which location they're referring to

**Known coordinates (use when mentioned):**
- Waikiki: lat=21.2766, lon=-157.8269
- North Shore: lat=21.6649, lon=-158.0532  
- Honolulu: lat=21.3069, lon=-157.8583
- Kailua: lat=21.4010, lon=-157.7394
- Lanikai: lat=21.3927, lon=-157.7160
- Hanauma Bay: lat=21.2706, lon=-157.6939
- Ala Moana: lat=21.2906, lon=-157.8422

**Access restrictions:**
- Bellows Beach: Military-only access (requires military ID)
- Hanauma Bay: Requires reservations and entrance fee

**Output ONLY a JSON array of tool calls. Examples:**

For "What's the weather in Waikiki?":
[{"tool": "resolveSpot", "args": {"spot": "Waikiki"}}, {"tool": "getWeather", "args": {"lat": 21.281, "lon": -157.8374}}]

For "How are the waves at North Shore?":
[{"tool": "resolveSpot", "args": {"spot": "North Shore"}}, {"tool": "getSurf", "args": {"lat": 21.6649, "lon": -158.0532}}]

Your JSON array:`;

      const planText = await safeGenerateContent(planningPrompt, "Gemini planning timed out");
      if (planText) {
        console.log("🧠 AI Plan:", planText);
        try {
          const jsonMatch = planText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            toolCalls = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error("Failed to parse tool calls, trying without tools");
        }
      } else {
        console.warn("⚠️  Gemini planning unavailable, falling back to rule-based tool plan");
        toolCalls = fallbackToolPlan(question, conversation as ConversationTurn[]);
      }
    }
    
    // Phase 2: Execute tool calls in parallel for better performance
    const toolResults: any[] = [];
    let resolvedCoords: { lat: number; lon: number } | null = null;
    
    if (toolCalls.length === 0) {
      console.log("⚠️ No tool calls to execute");
    } else if (toolCalls.length === 1) {
      // Single tool call - execute normally
      const call = toolCalls[0];
      console.log(`🔧 Calling tool: ${call.tool} with args:`, call.args);
      try {
        const result = await callMCPTool(call.tool, call.args);
        toolResults.push({
          tool: call.tool,
          args: call.args,
          result: result
        });
        console.log(`✅ ${call.tool} result:`, JSON.stringify(result).substring(0, 200));
        
        // If this was resolveSpot, capture coordinates for auto-enhancement
        if (call.tool === "resolveSpot" && result && result.lat && result.lon) {
          resolvedCoords = { lat: result.lat, lon: result.lon };
        }
      } catch (error: any) {
        console.error(`❌ ${call.tool} failed:`, error.message);
        toolResults.push({
          tool: call.tool,
          error: error.message
        });
      }
    } else {
      // Multiple tool calls - execute in parallel
      console.log(`🚀 Executing ${toolCalls.length} tools in parallel...`);
      
      const toolPromises = toolCalls.map(async (call) => {
        console.log(`🔧 Calling tool: ${call.tool} with args:`, call.args);
        try {
          const result = await callMCPTool(call.tool, call.args);
          console.log(`✅ ${call.tool} result:`, JSON.stringify(result).substring(0, 200));
          return {
            tool: call.tool,
            args: call.args,
            result: result,
            success: true
          };
        } catch (error: any) {
          console.error(`❌ ${call.tool} failed:`, error.message);
          return {
            tool: call.tool,
            args: call.args,
            error: error.message,
            success: false
          };
        }
      });
      
      // Wait for all tools to complete
      const results = await Promise.all(toolPromises);
      
      // Process results and capture coordinates
      for (const result of results) {
        toolResults.push(result);
        
        // If this was resolveSpot, capture coordinates for auto-enhancement
        if (result.tool === "resolveSpot" && result.result && result.result.lat && result.result.lon) {
          resolvedCoords = { lat: result.result.lat, lon: result.result.lon };
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`🎯 Parallel execution complete: ${successCount}/${toolCalls.length} tools succeeded`);
    }
    
    // Smart enhancement: Add missing tools based on question intent
    if (resolvedCoords) {
      const questionLower = question.toLowerCase();
      if (isFutureQuestion(question)) {
        const hasExtendedWeather = toolResults.some(r => r.tool === "getWeather" && (r.args?.hours || r.args?.startOffsetHours || r.args?.timeDescriptor));
        if (!hasExtendedWeather) {
          const horizon = questionLower.includes('next 4') ? 4 : questionLower.includes('next 6') ? 6 : questionLower.includes('next 8') ? 8 : 12;
          const startOffset = questionLower.includes('tomorrow') ? 24 : questionLower.includes('later') ? 6 : 0;
          const forecastArgs = { lat: resolvedCoords.lat, lon: resolvedCoords.lon, hours: horizon, startOffsetHours: startOffset, timeDescriptor: question };
          console.log("🔧 Fetching extended weather window...");
          try {
            const result = await callMCPTool("getWeather", forecastArgs);
            toolResults.push({ tool: "getWeather", args: forecastArgs, result });
            console.log(`✅ getWeather (extended) result:`, JSON.stringify(result).substring(0, 200));
          } catch (error: any) {
            console.error("❌ getWeather extended window failed:", error.message);
          }
        }
      }
      
      // Add surf if question mentions waves/surf but getSurf wasn't called
      if ((questionLower.includes('wave') || questionLower.includes('surf')) && 
          !toolResults.some(r => r.tool === "getSurf")) {
        console.log("🔧 Adding getSurf based on question...");
        try {
          const result = await callMCPTool("getSurf", resolvedCoords);
          toolResults.push({ tool: "getSurf", args: resolvedCoords, result });
          console.log(`✅ getSurf result:`, JSON.stringify(result).substring(0, 200));
        } catch (error: any) {
          console.error(`❌ getSurf failed:`, error.message);
        }
      }
      
      // Add weather if question mentions weather/temperature but getWeather wasn't called
      if ((questionLower.includes('weather') || questionLower.includes('temperature') || questionLower.includes('temp')) &&
          !toolResults.some(r => r.tool === "getWeather")) {
        console.log("🔧 Adding getWeather based on question...");
        try {
          const result = await callMCPTool("getWeather", resolvedCoords);
          toolResults.push({ tool: "getWeather", args: resolvedCoords, result });
          console.log(`✅ getWeather result:`, JSON.stringify(result).substring(0, 200));
        } catch (error: any) {
          console.error(`❌ getWeather failed:`, error.message);
        }
      }
      
      // Add outdoor index + related tools for comprehensive questions
      const needsComprehensive = 
        (questionLower.includes('should') && (questionLower.includes('surf') || questionLower.includes('go'))) ||
        questionLower.includes('conditions') ||
        questionLower.includes('overall');
      
      if (needsComprehensive) {
        console.log("🔧 Comprehensive question - adding all relevant tools...");
        
        if (!toolResults.some(r => r.tool === "getWeather")) {
          try {
            const result = await callMCPTool("getWeather", resolvedCoords);
            toolResults.push({ tool: "getWeather", args: resolvedCoords, result });
          } catch (error: any) {
            console.error(`❌ getWeather failed:`, error.message);
          }
        }
        
        if (!toolResults.some(r => r.tool === "getSurf")) {
          try {
            const result = await callMCPTool("getSurf", resolvedCoords);
            toolResults.push({ tool: "getSurf", args: resolvedCoords, result });
          } catch (error: any) {
            console.error(`❌ getSurf failed:`, error.message);
          }
        }
        
        if (!toolResults.some(r => r.tool === "getOutdoorIndex")) {
          try {
            const result = await callMCPTool("getOutdoorIndex", resolvedCoords);
            toolResults.push({ tool: "getOutdoorIndex", args: resolvedCoords, result });
          } catch (error: any) {
            console.error(`❌ getOutdoorIndex failed:`, error.message);
          }
        }
      }
    }
    
    const recommendationEntry = toolResults.find(r => r.tool === "recommendBeaches");
    if (Array.isArray(recommendationEntry?.result) && recommendationEntry.result.length > 0) {
      const primaryRecommendation = recommendationEntry.result[0];
      if (primaryRecommendation?.lat && primaryRecommendation?.lon) {
        const recCoords = { lat: primaryRecommendation.lat, lon: primaryRecommendation.lon };
        const hasWeatherForRecommendation = toolResults.some(r => r.tool === "getWeather" && r.args && typeof r.args.lat === "number" && Math.abs(r.args.lat - recCoords.lat) < 0.01 && Math.abs(r.args.lon - recCoords.lon) < 0.01);
        if (!hasWeatherForRecommendation) {
          try {
            console.log("🔧 Fetching weather for recommended beach...");
            const result = await callMCPTool("getWeather", recCoords);
            toolResults.push({ tool: "getWeather", args: recCoords, result });
            console.log(`✅ getWeather (recommended) result:`, JSON.stringify(result).substring(0, 200));
          } catch (error: any) {
            console.error("❌ getWeather for recommendation failed:", error.message);
          }
        }
        if (!resolvedCoords) {
          resolvedCoords = recCoords;
        }
      }
    }
    
    // Phase 3: Build conversational response with fallbacks
    const templateContext = extractTemplateContext(toolResults, question, conversation as ConversationTurn[]);
    let answer: string | null = buildConversationalResponse(question, templateContext, toolResults, state);
    
    const allowTemplates = !isFutureQuestion(question);
    
    if (answer) {
      console.log("💬 Using heuristic conversational response");
    } else if (allowTemplates) {
      const selectedTemplate = !intentSignals.togetherPreference || !templateContext.recommendedBeaches ? selectBestTemplate(question, templateContext) : null;
      if (selectedTemplate) {
        console.log(`🎯 Using template: ${selectedTemplate.id}`);
        const templateResponse = applyTemplate(selectedTemplate, templateContext);
        if (templateResponse && templateResponse.length > 20) {
          answer = templateResponse;
          console.log("🎨 Template response applied");
        }
      }
    }
    
    if (!answer && allowTemplates) {
      const fastResponse = fastSynthesizeResponse(toolResults, question);
      if (fastResponse) {
        console.log("⚡ Using fast template for simple response...");
        answer = fastResponse;
      }
    }
    
    if (!answer) {
      console.log("🧠 Using Gemini for complex synthesis...");
      const answerPrompt = `${SYSTEM_PROMPT}${conversationContext}

**USER QUESTION:** "${question}"

**TOOL RESULTS:**
${toolResults.map(r => {
  if (r.tool === 'getWeather' && r.result?.hourly_forecast) {
    const weather = r.result;
    let formatted = `Weather Data for ${weather.location || 'location'}:\n`;
    formatted += `Current: ${weather.current_converted?.temperature_fahrenheit || weather.current?.temperature_2m}°F, ${weather.current_converted?.wind_speed_mph || weather.current?.wind_speed_10m}mph winds\n\n`;
    formatted += `Hourly Forecast (next ${weather.hourly_forecast.length} hours):\n`;
    weather.hourly_forecast.forEach((hour: any) => {
      formatted += `${hour.time}: ${hour.temperature_f}°F, ${hour.wind_mph}mph wind, ${hour.conditions}\n`;
    });
    return formatted;
  }
  return `${r.tool}: ${JSON.stringify(r.result || r.error, null, 2)}`;
}).join('\n\n')}

**CRITICAL: You MUST respond in 2-3 sentences MAX. Anything longer will be rejected.**

**CONVERSATIONAL STYLE (FOLLOW EXACTLY):**
- Be natural and conversational, like talking to a friend
- Start with the main point (no "Yes," "No," or formal greetings)
- Use specific data from the tools
- Include timing when relevant
- End with helpful next steps or alternatives
- Sound enthusiastic about Hawaii!

**FORMAT EXAMPLES:**
Sentence 1: Natural recommendation with key data (temp in °F, wave height in feet, wind in mph)
Sentence 2: Additional details or context
Sentence 3 (optional): One brief tip, caution, or access restriction

**CRITICAL TEMPERATURE RULE:**
- ALWAYS use temperature_fahrenheit from current_converted (NOT temperature_2m from current)
- ALWAYS use wind_speed_mph from current_converted (NOT wind_speed_10m from current)
- ALWAYS use wave_height_feet from hourly_converted (NOT wave_height from hourly)

**EXAMPLES YOU MUST COPY:**
✅ "Waikiki's looking great right now - 3ft waves, 79°F, light 4mph wind. Perfect for beginners."

✅ "North Shore's pretty rough today with 6ft waves and 9mph wind. Maybe try Waikiki instead or wait for calmer conditions."

✅ "Decent conditions at 77°F, 2.6ft waves, 5mph wind. Should be good for most activities."

**FORBIDDEN (DO NOT USE):**
❌ "Yes, the weather is..."
❌ "No, I don't recommend..."
❌ "Aloha! I'd be happy to..."
❌ "Looking to surf? Here's the scoop..."
❌ "The current weather is absolutely beautiful..."
❌ "Remember to stay hydrated..."
❌ "Based on the data..."
❌ "According to the forecast..."
❌ ANY paragraph longer than 3 sentences

Your 2-3 sentence response:`;

      const geminiAnswer = await safeGenerateContent(answerPrompt, "Gemini answer timed out");
      if (geminiAnswer) {
        const sentences = geminiAnswer.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        if (sentences.length > 3) {
          console.log("⚠️  Gemini response too long, trimming to 3 sentences");
        }
        answer = sentences.slice(0, 3).join(' ').trim();
      }
    }
    
    if (!answer) {
      console.warn("⚠️  Falling back to default response");
      answer = "Still double-checking the latest conditions - mind giving me another shot in a moment?";
    }
    
    let finalAnswer = answer || "Still double-checking the latest conditions - mind giving me another shot in a moment?";
    if (state.lastAssistant && normalizeForComparison(finalAnswer) === normalizeForComparison(state.lastAssistant)) {
      finalAnswer += " If you'd like a different beach or timing, just say the word and I'll spin up a new game plan.";
    }
    console.log("💬 Final Answer:", finalAnswer);
    
    // Cache the response for future requests (when appropriate)
    if (useCache) {
      const finalCacheKey = generateCacheKey(question, toolResults);
      const questionType = finalCacheKey.split(':')[0] || 'general';
      console.log(`💾 Storing response in cache with key: ${finalCacheKey}`);
      setCacheEntry(finalCacheKey, finalAnswer, questionType);
    } else {
      console.log("🚫 Skipping cache storage for this answer");
    }
    
    return finalAnswer;
    
  } catch (error: any) {
    console.error("❌ Agent error:", error.message);
    console.error("❌ Full error:", error);
    return "I'm having trouble processing that request right now. Please try asking about Hawaii surf or beach conditions!";
  }
}

// Helper function to format response as bullet points (optional)
export function formatAsBullets(answer: string, toolResults: any[]): string {
  const bullets: string[] = [];
  
  // Extract key data from tool results
  for (const result of toolResults) {
    if (result.tool === "getWeather" && result.result?.current_converted) {
      const c = result.result.current_converted;
      bullets.push(`🌡️ Temperature: ${c.temperature_fahrenheit}°F (feels like ${c.apparent_temperature_fahrenheit}°F)`);
      if (c.precipitation_mm > 0) bullets.push(`🌧️ Rain: ${c.precipitation_mm}mm`);
      bullets.push(`💨 Wind: ${c.wind_speed_mph} mph`);
    }
    
    if (result.tool === "getSurf" && result.result?.hourly_converted) {
      const h = result.result.hourly_converted;
      if (h.wave_height_feet?.[0]) {
        bullets.push(`🌊 Waves: ${h.wave_height_feet[0].toFixed(1)}ft`);
        if (h.wave_period?.[0]) bullets.push(`⏱️ Period: ${h.wave_period[0]}s`);
      }
    }
    
    if (result.tool === "getOutdoorIndex" && result.result) {
      bullets.push(`☀️ Outdoor Score: ${result.result.index}/10 - ${result.result.note}`);
    }
  }
  
  if (bullets.length === 0) return answer;
  
  // Return bullet format
  const recommendation = answer.split(/[.!?]/)[0] + '.';
  return `${recommendation}\n\n${bullets.join('\n')}`;
}
