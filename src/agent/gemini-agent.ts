import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

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
const SYSTEM_PROMPT = `You are a Hawaii outdoor activity advisor AI assistant. Your job is to help people decide what outdoor activities to do in Hawaii based on current conditions.

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

// Main agent function
export async function askAgent(question: string): Promise<string> {
  try {
    console.log("\n🤔 User question:", question);
    console.log("🔑 API Key loaded:", process.env.GEMINI_API_KEY ? "YES" : "NO");
    
    // Phase 1: Let AI decide what tools to call
    const planningPrompt = `${SYSTEM_PROMPT}

**USER QUESTION:** "${question}"

**YOUR TASK:** Analyze the question and call ONLY the tools needed to answer it.

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
    let toolCalls: any[] = [];
    try {
      const jsonMatch = planText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        toolCalls = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse tool calls, trying without tools");
    }
    
    // Phase 2: Execute tool calls
    const toolResults: any[] = [];
    let resolvedCoords: { lat: number; lon: number } | null = null;
    
    for (const call of toolCalls) {
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
    
    // Phase 3: Generate final answer based on tool results
    const answerPrompt = `${SYSTEM_PROMPT}

**USER QUESTION:** "${question}"

**TOOL RESULTS:**
${toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result || r.error, null, 2)}`).join('\n\n')}

**CRITICAL: You MUST respond in 2-3 sentences MAX. Anything longer will be rejected.**

**FORMAT (FOLLOW EXACTLY):**
Sentence 1: Yes/No + key recommendation
Sentence 2: Weather/wave data (temp in °F, wave height in feet, wind in mph, outdoor score)
Sentence 3 (optional): One brief tip, caution, or access restriction (e.g., "Bellows requires military ID", "Hanauma Bay needs reservations")

**EXAMPLES YOU MUST COPY:**
✅ "Yes, great surf today! Waikiki has 3ft waves, 79°F, light 4mph wind, outdoor score 10/10. Perfect for beginners."

✅ "Not ideal. North Shore has rough 6ft waves, 9mph wind, score 6/10. Try Waikiki instead or wait for calmer conditions."

✅ "Decent conditions. 77°F, 2.6ft waves, 5mph wind, score 8/10."

**FORBIDDEN (DO NOT USE):**
❌ "Aloha! I'd be happy to..."
❌ "Looking to surf? Here's the scoop..."
❌ "The current weather is absolutely beautiful..."
❌ "Remember to stay hydrated..."
❌ ANY paragraph longer than 3 sentences

Your 2-3 sentence response:`;

    const answerResult = await model.generateContent(answerPrompt);
    let answer = answerResult.response.text().trim();
    
    // Force brevity: Keep only first 3 sentences if too long
    const sentences = answer.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    if (sentences.length > 4) {
      console.log("⚠️  Response too long, keeping first 3 sentences...");
      answer = sentences.slice(0, 3).join(' ');
    }
    
    console.log("💬 AI Answer:", answer);
    
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
    if (result.tool === "getWeather" && result.result?.current) {
      const c = result.result.current;
      bullets.push(`🌡️ Temperature: ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C)`);
      if (c.precipitation > 0) bullets.push(`🌧️ Rain: ${c.precipitation}mm`);
      bullets.push(`💨 Wind: ${c.wind_speed_10m} km/h`);
    }
    
    if (result.tool === "getSurf" && result.result?.hourly) {
      const h = result.result.hourly;
      if (h.wave_height?.[0]) {
        bullets.push(`🌊 Waves: ${h.wave_height[0]}m (${(h.wave_height[0] * 3.28).toFixed(1)}ft)`);
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

