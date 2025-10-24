# 🌴 Go Hawaii - Frontend

Modern, responsive single-page web app for Hawaii beach conditions, weather, and AI-powered recommendations.

## ✨ Current Features

- 🏄‍♂️ **Live Beach Conditions** - Real-time weather, surf, and smart scoring for 12 Oahu beaches
- 🤖 **AI Assistant** - Natural language queries with conversational memory
- 📊 **Smart Beach Scoring** - Composite scores based on weather, waves, UV, tides, and crowd levels
- 🌡️ **Live Weather Widget** - Honolulu temperature in header
- ⚡ **Right Now Snapshot** - Dynamic recommendations for best surfing, beginners, and least crowded beaches
- 🎨 **Landing Animation** - Smooth "GO HAWAII" intro animation
- 📱 **Responsive Design** - Mobile-first with dark ocean aesthetic

## 🛠️ Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling with custom animations
- **Bruno Ace Font** - Custom typography throughout
- **MCP Integration** - Model Context Protocol for AI tools

## 🚀 Development

```bash
# Install dependencies (from workspace root)
pnpm install

# Run development server
cd frontend && pnpm dev

# Build for production
cd frontend && pnpm build
```

## 🔧 Environment Setup

Make sure both backend servers are running:

```bash
# In the root directory:
pnpm mcp:server  # MCP server on port 4100
pnpm dev:server  # Main API server on port 4000
```

## 📁 Project Structure

```
frontend/
├── app/
│   ├── page.tsx              # Main homepage with hero + conditions
│   ├── layout.tsx            # Root layout with Bruno Ace font
│   └── globals.css           # Global styles + custom animations
├── components/
│   ├── LiveConditions.tsx    # Beach selector + live data display
│   ├── RightNowSnapshot.tsx  # Dynamic recommendations widget
│   ├── HeaderWeather.tsx    # Live weather in header
│   ├── LandingAnimation.tsx  # Landing page animation
│   ├── AIChat.tsx           # AI assistant modal
│   └── InteractiveMap.tsx   # Map component (for future use)
└── public/
    └── images/
        └── backgrounds/
            └── go-hawaii-background.jpg
```

## 🔌 API Endpoints

- `POST /ask` - AI assistant questions
- `POST /tool/resolveSpot` - Get beach coordinates
- `POST /tool/getWeather` - Get weather data with conversions
- `POST /tool/getSurf` - Get surf conditions with conversions
- `POST /tool/getBeachScore` - Get smart beach scoring

## 🎯 Next Development Priorities

- [ ] Fix Tailwind CSS build issue (lightningcss error)
- [ ] Custom traffic/crowd API architecture
- [ ] Advanced MCP tools (forecasting, safety alerts)
- [ ] Machine learning for crowd prediction
- [ ] Real-time features (webcams, parking)
- [ ] Mobile PWA optimization
