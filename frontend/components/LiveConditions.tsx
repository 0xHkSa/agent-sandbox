'use client';

import { useState, useEffect } from 'react';

export default function LiveConditions() {
  const [conditions, setConditions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);
  const [beachScore, setBeachScore] = useState<any>(null);

  useEffect(() => {
    // Fetch current conditions for Waikiki (default spot)
    fetchConditions('Waikiki');
  }, []);

  const fetchConditions = async (spot: string) => {
    // Fade out current content
    setFading(true);
    
    // Wait for fade-out animation
    await new Promise(resolve => setTimeout(resolve, 300));
    
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

        // Fetch beach score
        try {
          console.log('Fetching score for:', spotData.data.name, 'at', lat, lon);
          const scoreRes = await fetch('http://localhost:4000/tool/getBeachScore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              beach: spotData.data.name, 
              lat, 
              lon, 
              activity: 'surfing' 
            })
          });
          const scoreData = await scoreRes.json();
          console.log('Score data:', scoreData);
          if (scoreData.ok && scoreData.data) {
            setBeachScore(scoreData.data);
          }
        } catch (error) {
          console.error('Failed to fetch beach score:', error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch conditions:', error);
    } finally {
      setLoading(false);
      setFading(false);
    }
  };

  const { weather, weather_converted, surf, surf_converted } = conditions || {};
  const waveHeight = surf?.wave_height?.[0];
  const wavePeriod = surf?.wave_period?.[0];

  return (
    <div className="overflow-hidden">
      <div className="px-6 py-4 mb-4">
        <h3 className={`text-2xl font-bold text-white transition-opacity duration-300 ${fading || loading ? 'opacity-30' : 'opacity-100'}`}>
          📍 Live Conditions - {conditions?.spot || 'Loading...'}
        </h3>
      </div>
      
      <div className="px-6">
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-6 transition-opacity duration-300 ${fading || loading ? 'opacity-30' : 'opacity-100'}`}>
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

        {/* Spot Selector - Categorized by Type */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-sm text-white/60 uppercase tracking-wide mb-4">Select Beach by Category:</p>
          
          {/* Grid layout with buttons and score card */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
            {/* Left side - Beach buttons */}
            <div>
              {/* Family-Friendly Beaches */}
              <div className="mb-6">
                <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center">
                  <span className="mr-2">👨‍👩‍👧</span> Family-Friendly
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {[
                'Waikiki Beach',
                'Kailua Beach',
                'Ala Moana Beach',
                'Waimanalo Beach'
              ].map((spot) => (
                <button
                  key={spot}
                  onClick={() => fetchConditions(spot)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    conditions?.spot === spot
                      ? 'bg-teal-500 text-white shadow-lg scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                  }`}
                >
                  {spot.replace(' Beach', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Surf Beaches */}
          <div className="mb-6">
            <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center">
              <span className="mr-2">🏄</span> Surf
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {[
                'North Shore',
                'Pipeline',
                'Sunset Beach',
                'Sandy Beach'
              ].map((spot) => (
                <button
                  key={spot}
                  onClick={() => fetchConditions(spot)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    conditions?.spot === spot
                      ? 'bg-teal-500 text-white shadow-lg scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                  }`}
                >
                  {spot.replace(' Beach', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Scenic & Snorkel */}
          <div>
            <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center">
              <span className="mr-2">🤿</span> Scenic & Snorkel
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {[
                'Lanikai Beach',
                'Hanauma Bay',
                'Makapu\'u Beach',
                'Honolulu'
              ].map((spot) => (
                <button
                  key={spot}
                  onClick={() => fetchConditions(spot)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    conditions?.spot === spot
                      ? 'bg-teal-500 text-white shadow-lg scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                  }`}
                >
                  {spot.replace(' Beach', '')}
                </button>
              ))}
            </div>
          </div>
            </div>

            {/* Right side - Beach Score Card */}
            <div className="flex items-center justify-center lg:justify-start">
              <div className={`rounded-lg px-6 py-4 transition-opacity duration-300 ${fading || loading ? 'opacity-30' : 'opacity-100'}`}>
                <div className="text-center min-w-[140px]">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Beach Score</div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-teal-400">
                      {beachScore?.overall ? beachScore.overall.toFixed(1) : '--'}
                    </span>
                    <span className="text-sm text-white/60">/10</span>
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    {beachScore?.recommendations?.[0] || beachScore?.best_time_today || 'Loading...'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-white/40">
          Updated {new Date().toLocaleTimeString()} • Data from Open-Meteo
        </div>
      </div>
    </div>
  );
}

