import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { findSpot, recommendBeaches } from "../utils/spots.js";
import { getWeather, getSurf, computeOutdoorIndex, getTides, getUVIndex, calculateBeachScore, analyzeMultipleSpots } from "./tools";

const app = express();
app.use(express.json());

const server = new McpServer({ 
  name: "hawaii-tools", 
  version: "0.1.0",
  capabilities: {
    tools: { listChanged: true }
  }
});

// tool: resolveSpot
server.registerTool(
  "resolveSpot",
  {
    title: "Resolve Hawaii spot to coordinates",
    description: "Given a spot name like Waikiki, return {lat, lon}.",
    inputSchema: { spot: z.string().min(1) }
  },
  async ({ spot }: { spot: string }) => {
    const m = findSpot(spot);
    if (!m) throw new Error("spot not found");
    const output = { name: m.name, lat: m.lat, lon: m.lon };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
);

// tool: getWeather
server.registerTool(
  "getWeather",
  {
    title: "Get current weather conditions",
    description: "Get temperature, precipitation, and wind for given coordinates",
    inputSchema: { lat: z.number(), lon: z.number() }
  },
  async ({ lat, lon }: { lat: number; lon: number }) => {
    const data = await getWeather(lat, lon);
    return {
      content: [{ type: "text", text: JSON.stringify(data.current) }],
      structuredContent: data
    };
  }
);

// tool: getSurf
server.registerTool(
  "getSurf",
  {
    title: "Get surf forecast",
    description: "Get wave height, period, and direction for given coordinates",
    inputSchema: { lat: z.number(), lon: z.number() }
  },
  async ({ lat, lon }: { lat: number; lon: number }) => {
    const data = await getSurf(lat, lon);
    const summary = {
      firstHour: {
        waveHeight: data.hourly?.wave_height?.[0],
        wavePeriod: data.hourly?.wave_period?.[0],
        waveDirection: data.hourly?.wave_direction?.[0]
      }
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: data
    };
  }
);

// tool: getOutdoorIndex
server.registerTool(
  "getOutdoorIndex",
  {
    title: "Get outdoor comfort index",
    description: "Calculate a 0-10 score for outdoor conditions based on weather",
    inputSchema: { lat: z.number(), lon: z.number() }
  },
  async ({ lat, lon }: { lat: number; lon: number }) => {
    const weather = await getWeather(lat, lon);
    const output = computeOutdoorIndex(weather);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
);

// tool: getTides
server.registerTool(
  "getTides",
  {
    title: "Get tide information",
    description: "Get current tide level and next high/low tide times for Hawaii",
    inputSchema: { lat: z.number(), lon: z.number() }
  },
  async ({ lat, lon }: { lat: number; lon: number }) => {
    const data = await getTides(lat, lon);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data
    };
  }
);

// tool: getUVIndex
server.registerTool(
  "getUVIndex",
  {
    title: "Get UV index and sun protection advice",
    description: "Get current UV index with risk level and protection recommendations",
    inputSchema: { lat: z.number(), lon: z.number() }
  },
  async ({ lat, lon }: { lat: number; lon: number }) => {
    const data = await getUVIndex(lat, lon);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data
    };
  }
);

// tool: recommendBeaches
server.registerTool(
  "recommendBeaches",
  {
    title: "Recommend beaches based on criteria",
    description: "Get beach recommendations for families, surfers, snorkelers, etc.",
    inputSchema: { 
      family: z.boolean().optional(),
      surf: z.boolean().optional(), 
      snorkel: z.boolean().optional(),
      scenic: z.boolean().optional(),
      island: z.string().optional()
    }
  },
  async ({ family, surf, snorkel, scenic, island }: { 
    family?: boolean; 
    surf?: boolean; 
    snorkel?: boolean; 
    scenic?: boolean; 
    island?: string; 
  }) => {
    const beaches = recommendBeaches({ family, surf, snorkel, scenic, island });
    return {
      content: [{ type: "text", text: JSON.stringify(beaches) }],
      structuredContent: beaches
    };
  }
);

// tool: getBeachScore
server.registerTool(
  "getBeachScore",
  {
    title: "Get comprehensive beach score",
    description: "Get detailed scoring for a beach including weather, waves, UV, tides, and crowd levels (0-10 scale)",
    inputSchema: { 
      lat: z.number(), 
      lon: z.number(),
      beachType: z.enum(['family', 'surf', 'snorkel', 'scenic', 'mixed']).optional(),
      crowdLevel: z.number().optional()
    }
  },
  async ({ lat, lon, beachType = 'mixed', crowdLevel }: { 
    lat: number; 
    lon: number; 
    beachType?: 'family' | 'surf' | 'snorkel' | 'scenic' | 'mixed';
    crowdLevel?: number;
  }) => {
    try {
      // Get all the data needed for scoring
      const [weather, surf, uv, tides] = await Promise.all([
        getWeather(lat, lon),
        getSurf(lat, lon),
        getUVIndex(lat, lon),
        getTides(lat, lon)
      ]);

      // Calculate comprehensive beach score
      const score = calculateBeachScore(weather, surf, uv, tides, beachType, crowdLevel);
      
      return {
        content: [{ type: "text", text: JSON.stringify(score) }],
        structuredContent: score
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        structuredContent: { error: error.message }
      };
    }
  }
);

// tool: analyzeMultipleSpots
server.registerTool(
  "analyzeMultipleSpots",
  {
    title: "Analyze multiple beach spots simultaneously",
    description: "Compare multiple Hawaii beach spots with comprehensive analysis including rankings, insights, and recommendations",
    inputSchema: { 
      spotNames: z.array(z.string()).min(1).max(10),
      beachTypes: z.array(z.enum(['surf', 'family', 'snorkel', 'scenic', 'mixed'])).optional()
    }
  },
  async ({ spotNames, beachTypes }: { 
    spotNames: string[];
    beachTypes?: Array<'surf' | 'family' | 'snorkel' | 'scenic' | 'mixed'>;
  }) => {
    try {
      const analysis = await analyzeMultipleSpots(spotNames, beachTypes);
      
      return {
        content: [{ type: "text", text: JSON.stringify(analysis) }],
        structuredContent: analysis
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
        structuredContent: { error: error.message }
      };
    }
  }
);

// single /mcp endpoint using Streamable HTTP transport
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = Number(process.env.MCP_PORT || 4100);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[mcp] streamable http listening at http://localhost:${PORT}/mcp`);
});
