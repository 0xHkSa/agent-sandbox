'use client';

import { useEffect, useState } from 'react';

interface BeachRecommendation {
  activity: string;
  beach: string;
  emoji: string;
  score?: number;
}

export default function RightNowSnapshot() {
  const [recommendations, setRecommendations] = useState<BeachRecommendation[]>([
    { activity: 'Best for Surfing', beach: 'Loading...', emoji: '🏄' },
    { activity: 'Best for Beginners', beach: 'Loading...', emoji: '🌊' },
    { activity: 'Least Crowded', beach: 'Loading...', emoji: '🏖️' },
  ]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    // Fetch real-time recommendations from API
    const fetchRecommendations = async () => {
      try {
        // Get beach scores for all 13 Oahu beaches with coordinates
        const beaches = [
          { name: 'Waikiki Beach', lat: 21.2766, lon: -157.8269 },
          { name: 'Kailua Beach', lat: 21.4010, lon: -157.7394 },
          { name: 'Lanikai Beach', lat: 21.3927, lon: -157.7160 },
          { name: 'North Shore', lat: 21.6649, lon: -158.0532 },
          { name: 'Sandy Beach', lat: 21.2847, lon: -157.6722 },
          { name: 'Makapu\'u Beach', lat: 21.3106, lon: -157.6589 },
          { name: 'Hanauma Bay', lat: 21.2706, lon: -157.6939 },
          { name: 'Sunset Beach', lat: 21.6589, lon: -158.0539 },
          { name: 'Pipeline', lat: 21.6649, lon: -158.0532 },
          { name: 'Ala Moana Beach', lat: 21.2906, lon: -157.8422 },
          { name: 'Waimanalo Beach', lat: 21.3347, lon: -157.7000 },
          { name: 'Honolulu', lat: 21.3069, lon: -157.8583 }
        ];
        
        const scorePromises = beaches.map(async (beach) => {
          try {
            const res = await fetch('http://localhost:4000/tool/getBeachScore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                beach: beach.name, 
                lat: beach.lat, 
                lon: beach.lon, 
                activity: 'surfing' 
              })
            });
            const data = await res.json();
            return { beach: beach.name, data: data.data };
          } catch {
            return { beach: beach.name, data: null };
          }
        });

        const scores = await Promise.all(scorePromises);
        const validScores = scores.filter(s => s.data);

        if (validScores.length > 0) {
          // Find best surfing spot (highest wave score)
          const bestSurf = validScores.reduce((prev, current) => {
            const prevWave = prev.data?.waves || 0;
            const currWave = current.data?.waves || 0;
            return currWave > prevWave ? current : prev;
          });

          // Find best beginner spot (Waikiki or best overall score)
          const waikiki = validScores.find(s => s.beach.includes('Waikiki'));
          const bestBeginner = waikiki || validScores.reduce((prev, current) => {
            const prevScore = prev.data?.overall || 0;
            const currScore = current.data?.overall || 0;
            return currScore > prevScore ? current : prev;
          });

          // Find least crowded (lowest crowd level)
          const leastCrowded = validScores.reduce((prev, current) => {
            const prevCrowd = prev.data?.crowd_level || 10;
            const currCrowd = current.data?.crowd_level || 10;
            return currCrowd < prevCrowd ? current : prev;
          });

          setRecommendations([
            { 
              activity: 'Best for Surfing', 
              beach: bestSurf.beach, 
              emoji: '🏄',
              score: Math.round((bestSurf.data?.waves || 0))
            },
            { 
              activity: 'Best for Beginners', 
              beach: bestBeginner.beach, 
              emoji: '🌊',
              score: Math.round((bestBeginner.data?.overall || 0))
            },
            { 
              activity: 'Least Crowded', 
              beach: leastCrowded.beach, 
              emoji: '🏖️',
              score: Math.round((leastCrowded.data?.crowd_level || 0))
            },
          ]);

          // Set last update time
          const now = new Date();
          setLastUpdate(now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }));
        } else {
          throw new Error('No valid scores');
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
        // Fallback to static data
        setRecommendations([
          { activity: 'Best for Surfing', beach: 'North Shore', emoji: '🏄', score: 8 },
          { activity: 'Best for Beginners', beach: 'Waikiki Beach', emoji: '🌊', score: 9 },
          { activity: 'Least Crowded', beach: 'Lanikai Beach', emoji: '🏖️', score: 3 },
        ]);
        
        // Set last update time even in offline mode
        const now = new Date();
        setLastUpdate(now.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }) + ' (Offline)');
      }
    };

    fetchRecommendations();
    // Refresh every 5 minutes
    const interval = setInterval(fetchRecommendations, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-white text-2xl font-bold uppercase tracking-wide">
          Right Now
        </h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-white/60 text-xs uppercase">Live</span>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-6">
        {recommendations.map((rec, index) => (
          <div 
            key={index}
            className="group hover:bg-white/5 p-4 rounded-lg transition-all duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-3xl">{rec.emoji}</span>
                  <p className="text-white/60 text-sm uppercase tracking-wide">
                    {rec.activity}
                  </p>
                </div>
                <p className="text-white font-bold text-base ml-12">
                  {rec.beach}
                </p>
              </div>
              {rec.score && (
                <div className="text-right">
                  <p className="text-teal-400 text-2xl font-bold">
                    {rec.score}
                    {index === 0 && <span className="text-sm ml-1">ft</span>}
                    {index === 1 && <span className="text-sm ml-1 text-white/60">/10</span>}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Last Updated */}
      {lastUpdate && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-white/40 text-xs text-center">
            Updated at {lastUpdate}
          </p>
        </div>
      )}
    </div>
  );
}

