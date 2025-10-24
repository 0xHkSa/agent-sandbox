# Hawaii AI Agent 🌺

An intelligent beach and surf advisor powered by MCP (Model Context Protocol) and Google Gemini AI.

## 🎯 What is this?

A **portfolio project** demonstrating MCP server integration with AI agents. The system provides real-time weather, surf conditions, and beach recommendations for Hawaii locations using live API data and intelligent tool orchestration.

## 🚀 Quick Start

### Local Development
1. Clone this repository
2. Open in VS Code/Cursor and click **"Reopen in Container"**
3. Start services: `./hawaii start` (from local terminal)
4. Visit: `http://localhost:3000`

### Services
- **Frontend**: Next.js app on port 3000
- **Backend API**: Express server on port 4000  
- **MCP Server**: Tool server on port 4100

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, Tailwind CSS v4, Turbopack
- **Backend**: Node.js, Express, TypeScript
- **AI**: Google Gemini API, MCP (Model Context Protocol)
- **APIs**: Open-Meteo (weather/surf), NOAA (tides), EPA (UV)
- **Container**: Docker, VS Code Dev Containers

## 🌊 MCP Tools

The system includes 9 intelligent tools:

- `resolveSpot` - Location resolution for Hawaii spots
- `getWeather` - Hourly weather forecasts + current conditions
- `getSurf` - Wave conditions with quality ratings (0-5 scale)
- `getSunTimes` - Sunrise/sunset/golden hour times
- `getTides` - Tide levels and timing
- `getUVIndex` - UV safety recommendations
- `getBeachScore` - Comprehensive beach scoring (0-10 scale)
- `analyzeMultipleSpots` - Multi-location comparison
- `recommendBeaches` - Smart beach recommendations

## 🎯 Current Status

**Phase 0.5 Complete** ✅
- Enhanced toolkit with hourly data
- Smart fast routing vs complex questions
- Real-time API integration
- Comprehensive beach intelligence

**Next Phase**: Day Planner with Google Calendar export

## 📁 Project Structure

```
src/
├── mcp/
│   ├── server.mcp.ts    # MCP server with tool definitions
│   └── tools.ts         # Tool implementations
├── agent/
│   └── gemini-agent.ts  # AI agent with smart routing
├── server.ts            # Backend API server
└── utils/
    └── spots.ts         # Hawaii location data
```

## 🔧 Development

**Start all services:**
```bash
./hawaii start
```

**View logs:**
```bash
./hawaii logs
```

**Stop services:**
```bash
./hawaii stop
```

**Check status:**
```bash
./hawaii status
```

---

**Portfolio Project**: Demonstrates MCP integration, AI tool orchestration, and real-time data processing for beach/surf intelligence.

