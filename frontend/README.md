# 🌴 Hawaii Outdoor Hub - Frontend

Modern, responsive web app for Hawaii outdoor activities, weather, and surf conditions.

## Features

- 🏖️ **Spot Directory** - Browse popular Hawaii beaches and outdoor spots
- 🌡️ **Live Conditions** - Real-time weather and surf data
- 🤖 **AI Assistant** - Natural language queries for personalized recommendations
- 📱 **Responsive Design** - Works beautifully on mobile and desktop

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **API Integration** - Connects to Hawaii Agent backend

## Development

```bash
# Install dependencies (from frontend directory)
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment

Make sure the backend API is running on `http://localhost:4000`

```bash
# In the root directory, start backend servers:
pnpm mcp:server  # Port 4100
pnpm dev:server  # Port 4000
```

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx          # Homepage
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── SpotCard.tsx      # Spot display card
│   ├── AIChat.tsx        # AI chat interface
│   └── LiveConditions.tsx # Real-time data display
└── public/               # Static assets
```

## API Endpoints Used

- `POST /ask` - AI assistant questions
- `POST /tool/resolveSpot` - Get spot coordinates
- `POST /tool/getWeather` - Get weather data
- `POST /tool/getSurf` - Get surf conditions

## Future Enhancements

- [ ] Spot detail pages
- [ ] User favorites
- [ ] Push notifications for conditions
- [ ] PWA offline support
- [ ] Activity recommendations
- [ ] Business partnerships & bookings
