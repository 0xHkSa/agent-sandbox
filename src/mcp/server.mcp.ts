import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { findSpot } from "../utils/spots.js";
import { getWeather, getSurf, computeOutdoorIndex } from "./tools";

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
