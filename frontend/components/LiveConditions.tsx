'use client';

import { useState, useEffect } from 'react';

export default function LiveConditions() {
  const [conditions, setConditions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch current conditions for Waikiki (default spot)
    fetchConditions('Waikiki');
  }, []);

  const fetchConditions = async (spot: string) => {
    setLoading(true);
    try {
      // Resolve spot to coordinates
      const spotRes = await fetch('http://localhost:4000/tool/resolveSpot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot }),
      });
      const spotData = await spotRes.json();

      if (spotData.ok) {
        const { lat, lon } = spotData.data;

        // Fetch weather and surf in parallel
        const [weatherRes, surfRes] = await Promise.all([
          fetch('http://localhost:4000/tool/getWeather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon }),
          }),
          fetch('http://localhost:4000/tool/getSurf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon }),
          }),
        ]);

        const weatherData = await weatherRes.json();
        const surfData = await surfRes.json();

        setConditions({
          spot: spotData.data.name,
          weather: weatherData.data?.current,
          weather_converted: weatherData.data?.current_converted,
          surf: surfData.data?.hourly,
          surf_converted: surfData.data?.hourly_converted,
        });
      }
    } catch (error) {
      console.error('Failed to fetch conditions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-xl p-8 animate-pulse">
        <div className="h-8 bg-white/20 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white/20 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!conditions) return null;

  const { weather, weather_converted, surf, surf_converted } = conditions;
  const waveHeight = surf?.wave_height?.[0];
  const wavePeriod = surf?.wave_period?.[0];

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl overflow-hidden">
      <div className="bg-white/10 backdrop-blur-sm px-6 py-4 border-b border-white/10">
        <h3 className="text-2xl font-bold text-white">📍 Live Conditions - {conditions.spot}</h3>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {/* Temperature */}
          <div className="text-center">
            <div className="text-4xl mb-2">🌡️</div>
            <div className="text-3xl font-bold text-white">
              {weather_converted?.temperature_fahrenheit || weather?.temperature_2m}°F
            </div>
            <div className="text-sm text-white/70 mt-1">Temperature</div>
            <div className="text-xs text-white/50 mt-1">
              Feels like {weather_converted?.apparent_temperature_fahrenheit || weather?.apparent_temperature}°F
            </div>
          </div>

          {/* Wind */}
          <div className="text-center">
            <div className="text-4xl mb-2">💨</div>
            <div className="text-3xl font-bold text-white">
              {weather_converted?.wind_speed_mph || weather?.wind_speed_10m} <span className="text-lg">mph</span>
            </div>
            <div className="text-sm text-white/70 mt-1">Wind Speed</div>
            <div className="text-xs text-white/50 mt-1">
              {weather?.precipitation > 0 ? `${weather.precipitation}mm rain` : 'No rain'}
            </div>
          </div>

          {/* Waves */}
          <div className="text-center">
            <div className="text-4xl mb-2">🌊</div>
            <div className="text-3xl font-bold text-white">
              {surf_converted?.wave_height_feet?.[0] || (waveHeight ? (waveHeight * 3.28).toFixed(1) : 'N/A')}ft
            </div>
            <div className="text-sm text-white/70 mt-1">Wave Height</div>
            <div className="text-xs text-white/50 mt-1">
              {waveHeight ? `${waveHeight.toFixed(1)}m` : 'N/A'}
            </div>
          </div>

          {/* Period */}
          <div className="text-center">
            <div className="text-4xl mb-2">⏱️</div>
            <div className="text-3xl font-bold text-white">
              {wavePeriod?.toFixed(0)}s
            </div>
            <div className="text-sm text-white/70 mt-1">Wave Period</div>
            <div className="text-xs text-white/50 mt-1">
              {wavePeriod > 10 ? 'Long period' : 'Short period'}
            </div>
          </div>
        </div>

        {/* Spot Selector */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-sm text-white/60 mb-3">View conditions for:</p>
          <div className="flex flex-wrap gap-2">
            {['Waikiki', 'North Shore', 'Kailua', 'Honolulu'].map((spot) => (
              <button
                key={spot}
                onClick={() => fetchConditions(spot)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  conditions.spot.includes(spot)
                    ? 'bg-teal-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {spot}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-white/40">
          Updated {new Date().toLocaleTimeString()} • Data from Open-Meteo
        </div>
      </div>
    </div>
  );
}

