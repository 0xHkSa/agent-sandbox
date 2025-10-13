import "dotenv/config";

console.log("✅ Step 1: dotenv loaded");
console.log("✅ GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);

try {
  console.log("✅ Step 2: importing tools...");
  const tools = await import("./src/mcp/tools.js");
  console.log("✅ Tools imported:", Object.keys(tools));
  
  console.log("✅ Step 3: importing agent...");
  const agent = await import("./src/agent/gemini-agent.js");
  console.log("✅ Agent imported:", Object.keys(agent));
  
  console.log("✅ Step 4: importing express...");
  const express = (await import("express")).default;
  console.log("✅ Express imported");
  
  console.log("✅ Step 5: creating app...");
  const app = express();
  app.use(express.json());
  
  console.log("✅ Step 6: registering routes...");
  app.get("/health", (_req: any, res: any) => {
    res.json({ ok: true });
  });
  
  console.log("✅ Step 7: starting server...");
  const server = app.listen(4000, "0.0.0.0", () => {
    console.log("✅ SERVER IS RUNNING on port 4000");
    console.log("Server object:", !!server);
  });
  
  // Keep process alive
  process.on('SIGTERM', () => {
    console.log('SIGTERM received');
    server.close();
  });
  
  console.log("✅ Step 8: setup complete, waiting for requests...");
  
} catch (error: any) {
  console.error("❌ ERROR:", error.message);
  console.error("❌ Stack:", error.stack);
  process.exit(1);
}

