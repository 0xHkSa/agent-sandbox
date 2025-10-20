'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

// Import Leaflet for custom icons
let L: any = null;
if (typeof window !== 'undefined') {
  L = require('leaflet');
}

interface BeachSpot {
  name: string;
  lat: number;
  lon: number;
  type: 'family' | 'surf' | 'snorkel' | 'scenic' | 'mixed';
  island: string;
  description: string;
}

interface BeachConditions {
  spot: string;
  temperature: number;
  windSpeed: number;
  waveHeight: number;
  wavePeriod: number;
  outdoorScore: number;
  lastUpdated: string;
}

const HAWAII_SPOTS: BeachSpot[] = [
  { name: 'Waikiki Beach', lat: 21.2766, lon: -157.8269, type: 'family', island: 'Oahu', description: 'Iconic beach, perfect for beginners' },
  { name: 'North Shore (Ehukai)', lat: 21.6649, lon: -158.0532, type: 'surf', island: 'Oahu', description: 'World-famous surf spot' },
  { name: 'Kailua Beach', lat: 21.401, lon: -157.7394, type: 'family', island: 'Oahu', description: 'Calm waters, great for kayaking' },
  { name: 'Lanikai Beach', lat: 21.3927, lon: -157.7160, type: 'scenic', island: 'Oahu', description: 'Crystal clear water, stunning views' },
  { name: 'Hanauma Bay', lat: 21.2706, lon: -157.6939, type: 'snorkel', island: 'Oahu', description: 'Protected marine life sanctuary' },
  { name: 'Ala Moana Beach', lat: 21.2906, lon: -157.8422, type: 'family', island: 'Oahu', description: 'Protected lagoon, great for families' },
  { name: 'Honolulu', lat: 21.3069, lon: -157.8583, type: 'mixed', island: 'Oahu', description: 'City beach with amenities' },
];

export default function InteractiveMap() {
  const [conditions, setConditions] = useState<Record<string, BeachConditions>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);

  // Create custom HTML marker icon
  const createCustomIcon = (spot: BeachSpot, condition: BeachConditions | null) => {
    if (!L) return null;
    
    const markerColor = condition ? getMarkerColor(spot.name) : '#gray';
    const spotIcon = getSpotIcon(spot);
    
    return L.divIcon({
      html: `
        <div style="
          background: ${markerColor};
          border: 3px solid white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: transform 0.2s ease;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          ${spotIcon}
        </div>
      `,
      className: 'custom-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });
  };

  useEffect(() => {
    fetchAllConditions();
  }, []);

  const fetchAllConditions = async () => {
    setLoading(true);
    const newConditions: Record<string, BeachConditions> = {};

    try {
      // Fetch conditions for all spots in parallel
      const promises = HAWAII_SPOTS.map(async (spot) => {
        try {
          // Get weather and surf data
          const [weatherRes, surfRes] = await Promise.all([
            fetch('http://localhost:4000/tool/getWeather', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat: spot.lat, lon: spot.lon }),
            }),
            fetch('http://localhost:4000/tool/getSurf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat: spot.lat, lon: spot.lon }),
            }),
          ]);

          const weatherData = await weatherRes.json();
          const surfData = await surfRes.json();

          if (weatherData.ok && surfData.ok) {
            const weather = weatherData.data;
            const surf = surfData.data;

            newConditions[spot.name] = {
              spot: spot.name,
              temperature: weather.current_converted?.temperature_fahrenheit || weather.current?.temperature_2m,
              windSpeed: weather.current_converted?.wind_speed_mph || weather.current?.wind_speed_10m,
              waveHeight: surf.hourly_converted?.wave_height_feet?.[0] || (surf.hourly?.wave_height?.[0] ? surf.hourly.wave_height[0] * 3.28 : 0),
              wavePeriod: surf.hourly?.wave_period?.[0] || 0,
              outdoorScore: 8, // Simplified for now
              lastUpdated: new Date().toLocaleTimeString(),
            };
          }
        } catch (error) {
          console.error(`Failed to fetch conditions for ${spot.name}:`, error);
        }
      });

      await Promise.all(promises);
      setConditions(newConditions);
    } catch (error) {
      console.error('Failed to fetch conditions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMarkerColor = (spotName: string): string => {
    const condition = conditions[spotName];
    if (!condition) return '#gray';
    
    const score = condition.outdoorScore;
    if (score >= 8) return '#22c55e'; // Green - excellent
    if (score >= 6) return '#eab308'; // Yellow - good
    if (score >= 4) return '#f97316'; // Orange - fair
    return '#ef4444'; // Red - poor
  };

  const getSpotIcon = (spot: BeachSpot): string => {
    switch (spot.type) {
      case 'surf': return '🏄‍♂️';
      case 'family': return '👨‍👩‍👧‍👦';
      case 'snorkel': return '🤿';
      case 'scenic': return '📸';
      default: return '🏖️';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-800 to-gray-600 px-6 py-4">
        <h3 className="text-2xl font-bold text-white">🗺️ Live Hawaii Beach Map</h3>
        <p className="text-gray-300 mt-1">Click markers for current conditions</p>
      </div>
      
      <div className="p-6">
        {/* Legend */}
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Excellent (8-10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Good (6-7)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>Fair (4-5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Poor (0-3)</span>
          </div>
        </div>

        {/* Map Container */}
        <div className="h-[600px] w-full rounded-lg overflow-hidden border border-gray-200 relative z-10">
          <MapContainer
            center={[21.4, -157.8]} // Center on Oahu
            zoom={10}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            
            {HAWAII_SPOTS.map((spot) => {
              const condition = conditions[spot.name];
              const customIcon = createCustomIcon(spot, condition);
              
              return (
                <Marker
                  key={spot.name}
                  position={[spot.lat, spot.lon]}
                  icon={customIcon || undefined}
                  eventHandlers={{
                    click: () => setSelectedSpot(spot.name),
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getSpotIcon(spot)}</span>
                        <h4 className="font-bold text-gray-900">{spot.name}</h4>
                      </div>
                      
                      {condition ? (
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>🌡️ Temp:</span>
                            <span className="font-medium">{condition.temperature}°F</span>
                          </div>
                          <div className="flex justify-between">
                            <span>💨 Wind:</span>
                            <span className="font-medium">{condition.windSpeed} mph</span>
                          </div>
                          <div className="flex justify-between">
                            <span>🌊 Waves:</span>
                            <span className="font-medium">{condition.waveHeight.toFixed(1)}ft</span>
                          </div>
                          <div className="flex justify-between">
                            <span>⏱️ Period:</span>
                            <span className="font-medium">{condition.wavePeriod.toFixed(0)}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span>☀️ Score:</span>
                            <span className="font-medium">{condition.outdoorScore}/10</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Updated: {condition.lastUpdated}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          Loading conditions...
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-gray-600">
                        {spot.description}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Selected Spot Details */}
        {selectedSpot && conditions[selectedSpot] && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-2">
              {getSpotIcon(HAWAII_SPOTS.find(s => s.name === selectedSpot)!)} {selectedSpot}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Temperature:</span>
                <div className="font-bold text-lg">{conditions[selectedSpot].temperature}°F</div>
              </div>
              <div>
                <span className="text-gray-600">Wind Speed:</span>
                <div className="font-bold text-lg">{conditions[selectedSpot].windSpeed} mph</div>
              </div>
              <div>
                <span className="text-gray-600">Wave Height:</span>
                <div className="font-bold text-lg">{conditions[selectedSpot].waveHeight.toFixed(1)}ft</div>
              </div>
              <div>
                <span className="text-gray-600">Outdoor Score:</span>
                <div className="font-bold text-lg">{conditions[selectedSpot].outdoorScore}/10</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-xs text-gray-400">
          Updated {new Date().toLocaleTimeString()} • Data from Open-Meteo
        </div>
      </div>
    </div>
  );
}
