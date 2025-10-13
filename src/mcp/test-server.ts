import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

const server = new McpServer({ name: "test-server", version: "1.0.0" });

// Tool 1
server.registerTool(
  "add",
  {
    title: "Add two numbers",
    description: "Add two numbers together",
    inputSchema: { a: z.number(), b: z.number() }
  },
  async ({ a, b }: { a: number; b: number }) => {
    const result = { sum: a + b };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result
    };
  }
);

// Tool 2
server.registerTool(
  "multiply",
  {
    title: "Multiply two numbers",
    description: "Multiply two numbers together",
    inputSchema: { a: z.number(), b: z.number() }
  },
  async ({ a, b }: { a: number; b: number }) => {
    const result = { product: a * b };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result
    };
  }
);

console.log("✅ Registered 2 tools");

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(4200, "0.0.0.0", () => {
  console.log(`[test] listening on http://localhost:4200/mcp`);
});

