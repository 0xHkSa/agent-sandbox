'use client';

import { useEffect, useState } from 'react';

export default function HeaderWeather() {
  const [temp, setTemp] = useState<number | null>(null);
  const [emoji, setEmoji] = useState('☀️');

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Fetch weather for Honolulu/Waikiki area
        const res = await fetch('http://localhost:4000/tool/getWeather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            lat: 21.2793,  // Honolulu coordinates
            lon: -157.8293 
          })
        });
        
        const data = await res.json();
        
        if (data.ok && data.data) {
          // Get temperature in Fahrenheit from converted data
          const tempF = Math.round(data.data.current_converted?.temperature_fahrenheit || 0);
          setTemp(tempF);
          
          // Set emoji based on weather conditions
          const precip = data.data.current?.precipitation || 0;
          const tempC = data.data.current?.temperature_2m || 0;
          
          if (precip > 0.5) {
            setEmoji('🌧️'); // Raining
          } else if (tempC > 28) {
            setEmoji('☀️'); // Hot and sunny
          } else if (tempC > 22) {
            setEmoji('🌤️'); // Pleasant
          } else {
            setEmoji('⛅'); // Mild
          }
        }
      } catch (error) {
        console.error('Failed to fetch weather:', error);
        // Fallback to default
        setTemp(81);
        setEmoji('☀️');
      }
    };

    fetchWeather();
    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-white text-lg font-bold flex items-center space-x-2">
      <span>{temp !== null ? `${temp}°` : '...'}</span>
      <span>{emoji}</span>
    </div>
  );
}

