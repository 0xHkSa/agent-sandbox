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

**CRITICAL: You MUST call ALL FOUR tools for any Hawaii location question!**

**Required tools for ANY Hawaii location query:**
1. resolveSpot - get coordinates
2. getWeather - get temperature, wind, precipitation  
3. getSurf - get wave height, period, direction
4. getOutdoorIndex - get comfort score

**Response format - include ALL 4 tools:**
[
  {"tool": "resolveSpot", "args": {"spot": "Waikiki"}},
  {"tool": "getWeather", "args": {"lat": 21.281, "lon": -157.8374}},
  {"tool": "getSurf", "args": {"lat": 21.281, "lon": -157.8374}},
  {"tool": "getOutdoorIndex", "args": {"lat": 21.281, "lon": -157.8374}}
]

**Known coordinates (use these):**
- Waikiki: lat=21.281, lon=-157.8374
- North Shore: lat=21.6649, lon=-158.0532  
- Honolulu: lat=21.3069, lon=-157.8583
- Kailua: lat=21.4022, lon=-157.7394

**Output ONLY the JSON array with all 4 tool calls. No other text.**`;

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
    
    // Smart enhancement: If we got coordinates but didn't call all tools, call them now
    if (resolvedCoords) {
      const hasAllTools = ["getWeather", "getSurf", "getOutdoorIndex"]
        .every(tool => toolResults.some(r => r.tool === tool));
      
      if (!hasAllTools) {
        console.log("🔧 Auto-completing with remaining Hawaii outdoor data tools...");
        
        if (!toolResults.some(r => r.tool === "getWeather")) {
          console.log(`🔧 Calling tool: getWeather with args:`, resolvedCoords);
          try {
            const result = await callMCPTool("getWeather", resolvedCoords);
            toolResults.push({ tool: "getWeather", args: resolvedCoords, result });
            console.log(`✅ getWeather result:`, JSON.stringify(result).substring(0, 200));
          } catch (error: any) {
            console.error(`❌ getWeather failed:`, error.message);
          }
        }
        
        if (!toolResults.some(r => r.tool === "getSurf")) {
          console.log(`🔧 Calling tool: getSurf with args:`, resolvedCoords);
          try {
            const result = await callMCPTool("getSurf", resolvedCoords);
            toolResults.push({ tool: "getSurf", args: resolvedCoords, result });
            console.log(`✅ getSurf result:`, JSON.stringify(result).substring(0, 200));
          } catch (error: any) {
            console.error(`❌ getSurf failed:`, error.message);
          }
        }
        
        if (!toolResults.some(r => r.tool === "getOutdoorIndex")) {
          console.log(`🔧 Calling tool: getOutdoorIndex with args:`, resolvedCoords);
          try {
            const result = await callMCPTool("getOutdoorIndex", resolvedCoords);
            toolResults.push({ tool: "getOutdoorIndex", args: resolvedCoords, result });
            console.log(`✅ getOutdoorIndex result:`, JSON.stringify(result).substring(0, 200));
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

**YOUR TASK:**
Based on the tool results above, provide a helpful, friendly answer to the user's question.

- Be specific and reference actual data from the tools
- Give actionable recommendations
- Warn about safety if needed (e.g., waves too big)
- Keep it conversational and helpful
- 2-4 paragraphs max

Your response:`;

    const answerResult = await model.generateContent(answerPrompt);
    const answer = answerResult.response.text();
    
    console.log("💬 AI Answer:", answer.substring(0, 200) + "...\n");
    
    return answer;
    
  } catch (error: any) {
    console.error("❌ Agent error:", error.message);
    console.error("❌ Full error:", error);
    return "I'm having trouble processing that request right now. Please try asking about Hawaii surf or beach conditions!";
  }
}

