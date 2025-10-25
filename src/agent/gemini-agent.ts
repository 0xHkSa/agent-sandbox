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
  GENERAL: 5 * 60 * 1000       // 5 minutes for general questions
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
  if (location === 'general' && toolResults.length > 0) {
    const weatherResult = toolResults.find(r => r.tool === 'getWeather');
    if (weatherResult?.result?.location) {
      location = weatherResult.result.location.toLowerCase().replace(/\s+/g, '');
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
  }
  
  // Create time-based key (round to nearest 5 minutes for weather, 10 for surf)
  const now = new Date();
  const timeKey = questionType === 'weather' ? 
    Math.floor(now.getTime() / (5 * 60 * 1000)) : // 5-minute buckets
    Math.floor(now.getTime() / (10 * 60 * 1000));  // 10-minute buckets
  
  const key = `${questionType}:${location}:${timeKey}`;
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
        }
      }
    );
    
    return response.data.result?.structuredContent || response.data.result;
  } catch (error: any) {
    console.error(`Error calling tool ${toolName}:`, error.message);
    throw new Error(`Failed to call ${toolName}: ${error.message}`);
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

// Question intent classification - cleaner than keyword lists
function classifyQuestionIntent(question: string): 'simple' | 'complex' | 'forecast' {
  const q = question.toLowerCase().trim();
  
  // Forecast: time-based questions (next, tomorrow, hours, all day, etc.)
  if (q.match(/(next|tomorrow|today|hour|hours|morning|afternoon|evening|all day|tonight|week|weekend)/)) {
    return 'forecast';
  }
  
  // Complex: recommendations, comparisons, advice, "should I" questions
  if (q.match(/(should|recommend|best|compare|advice|when|where|which|good|bad)/)) {
    return 'complex';
  }
  
  // Simple: current conditions only (what's, how's, current weather/surf)
  if (q.match(/^(what's|how's|what is|how is|current).*(weather|surf|waves|temperature|temp)/)) {
    return 'simple';
  }
  
  return 'simple'; // Default to simple for safety
}

// Extract template context from tool results
function extractTemplateContext(toolResults: any[], question: string): TemplateContext {
  const context: TemplateContext = {
    location: 'the area',
    temperature: 75,
    windSpeed: 10,
    precipitation: 0,
    conditions: 'clear sky',
    timeOfDay: getCurrentTimeOfDay(),
    activityType: detectActivityType(question)
  };

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

function detectActivityType(question: string): 'surfing' | 'family' | 'snorkeling' | 'general' {
  const q = question.toLowerCase();
  if (q.includes('surf') || q.includes('wave')) return 'surfing';
  if (q.includes('family') || q.includes('kids') || q.includes('children')) return 'family';
  if (q.includes('snorkel') || q.includes('dive')) return 'snorkeling';
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
    
    // Check cache first (before any processing)
    const cacheKey = generateCacheKey(question, []);
    console.log(`🔑 Generated cache key: ${cacheKey}`);
    const cachedResponse = getCacheEntry(cacheKey);
    if (cachedResponse) {
      console.log("⚡ Cache HIT! Returning cached response");
      return cachedResponse;
    }
    console.log("💾 Cache MISS - processing new request");
    
    // Phase 1: Try fast routing first, fallback to Gemini for complex questions
    let toolCalls: any[] = [];
    
    // Build conversation context for both fast route and Gemini
    const conversationContext = conversation.length > 0 ? 
      `\n**CONVERSATION HISTORY:**\n${conversation.map(msg => 
        `${msg.isUser ? 'User' : 'AI'}: ${msg.text}`
      ).join('\n')}\n\n**CONTEXT NOTES:**\n- Remember previous locations mentioned\n- Build on earlier recommendations\n- Reference previous conditions or activities\n- Provide follow-up suggestions\n` : '';
    
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

      const planResult = await model.generateContent(planningPrompt);
      const planText = planResult.response.text();
      console.log("🧠 AI Plan:", planText);
      
      // Parse tool calls
      try {
        const jsonMatch = planText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          toolCalls = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Failed to parse tool calls, trying without tools");
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
    
    // Phase 3: Try fast synthesis first, fallback to Gemini for complex responses
    let answer: string;
    
    const fastResponse = fastSynthesizeResponse(toolResults, question);
    if (fastResponse) {
      console.log("⚡ Using fast template for simple response...");
      answer = fastResponse;
    } else {
      console.log("🧠 Using Gemini for complex synthesis...");
          // Generate final answer based on tool results
          const answerPrompt = `${SYSTEM_PROMPT}${conversationContext}

**USER QUESTION:** "${question}"

**TOOL RESULTS:**
${toolResults.map(r => {
  if (r.tool === 'getWeather' && r.result?.hourly_forecast) {
    // Format weather data for better Gemini understanding
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

      const answerResult = await model.generateContent(answerPrompt);
      answer = answerResult.response.text().trim();
      
      // Force brevity: Keep only first 3 sentences if too long
      const sentences = answer.split(/(?<=[.!?])\s+/).filter(s => s.trim());
      if (sentences.length > 4) {
        console.log("⚠️  Response too long, keeping first 3 sentences...");
        answer = sentences.slice(0, 3).join(' ');
      }
    }
    
    // Try template system first for consistent responses
    const templateContext = extractTemplateContext(toolResults, question);
    const selectedTemplate = selectBestTemplate(question, templateContext);
    
    if (selectedTemplate) {
      console.log(`🎯 Using template: ${selectedTemplate.id}`);
      const templateResponse = applyTemplate(selectedTemplate, templateContext);
      
      // Use template response if it's good, otherwise fall back to Gemini
      if (templateResponse && templateResponse.length > 20) {
        answer = templateResponse;
        console.log("🎨 Template response applied");
      } else {
        console.log("⚠️  Template response too short, using Gemini");
      }
    } else {
      console.log("🔍 No matching template found, using Gemini response");
    }
    
    console.log("💬 Final Answer:", answer);
    
    // Cache the response for future requests
    const finalCacheKey = generateCacheKey(question, toolResults);
    const questionType = finalCacheKey.split(':')[0] || 'general';
    console.log(`💾 Storing response in cache with key: ${finalCacheKey}`);
    setCacheEntry(finalCacheKey, answer, questionType);
    
    return answer;
    
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

