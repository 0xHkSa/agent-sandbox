'use client';

import { useState } from 'react';

interface BeachScoreData {
  overall: number;
  weather: number;
  waves: number;
  uv_safety: number;
  tides: number;
  crowd_level: number;
  breakdown: {
    temperature_score: number;
    wind_score: number;
    precipitation_score: number;
    wave_height_score: number;
    wave_period_score: number;
    uv_index_score: number;
    tide_level_score: number;
  };
  recommendations: string[];
  best_time_today?: string;
}

interface Beach {
  name: string;
  lat: number;
  lon: number;
  type: 'family' | 'surf' | 'snorkel' | 'scenic' | 'mixed';
  emoji: string;
}

const BEACHES: Beach[] = [
  { name: 'Waikiki Beach', lat: 21.2766, lon: -157.8269, type: 'family', emoji: '🏖️' },
  { name: 'North Shore', lat: 21.6649, lon: -158.0532, type: 'surf', emoji: '🌊' },
  { name: 'Kailua Beach', lat: 21.4010, lon: -157.7394, type: 'family', emoji: '🏝️' },
  { name: 'Hanauma Bay', lat: 21.2706, lon: -157.6939, type: 'snorkel', emoji: '🤿' },
  { name: 'Lanikai Beach', lat: 21.3927, lon: -157.7160, type: 'scenic', emoji: '🌅' },
  { name: 'Ala Moana Beach', lat: 21.2906, lon: -157.8422, type: 'family', emoji: '🏄' },
];

export default function BeachScoreTabs() {
  const [selectedBeach, setSelectedBeach] = useState(0);
  const [scoreData, setScoreData] = useState<BeachScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const currentBeach = BEACHES[selectedBeach];

  const fetchBeachScore = async (beach: Beach) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:4000/tool/getBeachScore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: beach.lat,
          lon: beach.lon,
          beachType: beach.type
        }),
      });

      const result = await response.json();
      if (result.ok) {
        setScoreData(result.data);
      } else {
        setError(result.error || 'Failed to fetch beach score');
      }
    } catch (err) {
      setError('Failed to fetch beach score');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (index: number) => {
    setSelectedBeach(index);
    setScoreData(null); // Clear previous data
    fetchBeachScore(BEACHES[index]);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-100';
    if (score >= 6) return 'bg-yellow-100';
    if (score >= 4) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 8) return '🏆';
    if (score >= 6) return '👍';
    if (score >= 4) return '⚠️';
    return '❌';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-teal-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">🏆 Smart Beach Scores</h3>
            <p className="text-sm text-gray-600 mt-1">
              Real-time scoring based on weather, waves, UV, tides & crowds
            </p>
          </div>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
            
            {showTooltip && scoreData && (
              <div className="absolute right-0 top-8 w-80 bg-gray-900 text-white p-4 rounded-lg shadow-lg z-10">
                <h4 className="font-semibold mb-3">Score Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Temperature:</span>
                    <span className={getScoreColor(scoreData.breakdown.temperature_score)}>
                      {scoreData.breakdown.temperature_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wind:</span>
                    <span className={getScoreColor(scoreData.breakdown.wind_score)}>
                      {scoreData.breakdown.wind_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Precipitation:</span>
                    <span className={getScoreColor(scoreData.breakdown.precipitation_score)}>
                      {scoreData.breakdown.precipitation_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wave Height:</span>
                    <span className={getScoreColor(scoreData.breakdown.wave_height_score)}>
                      {scoreData.breakdown.wave_height_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wave Period:</span>
                    <span className={getScoreColor(scoreData.breakdown.wave_period_score)}>
                      {scoreData.breakdown.wave_period_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>UV Index:</span>
                    <span className={getScoreColor(scoreData.breakdown.uv_index_score)}>
                      {scoreData.breakdown.uv_index_score.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tide Level:</span>
                    <span className={getScoreColor(scoreData.breakdown.tide_level_score)}>
                      {scoreData.breakdown.tide_level_score.toFixed(1)}/10
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-300">
                    Scores are weighted based on beach type ({currentBeach.type}) and real-time conditions
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {BEACHES.map((beach, index) => (
            <button
              key={beach.name}
              onClick={() => handleTabChange(index)}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                selectedBeach === index
                  ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{beach.emoji}</span>
              <span className="hidden sm:inline">{beach.name}</span>
              <span className="sm:hidden">{beach.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Selected Beach Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">{currentBeach.emoji}</span>
            <div>
              <h4 className="text-xl font-bold text-gray-900">{currentBeach.name}</h4>
              <p className="text-sm text-gray-600 capitalize">{currentBeach.type} Beach</p>
            </div>
          </div>
          {!scoreData && !loading && (
            <button
              onClick={() => fetchBeachScore(currentBeach)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Get Score
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Calculating {currentBeach.name} score...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => fetchBeachScore(currentBeach)}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Score Display */}
        {scoreData && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getScoreBgColor(scoreData.overall)}`}>
                <span className={`text-4xl font-bold ${getScoreColor(scoreData.overall)}`}>
                  {scoreData.overall.toFixed(1)}
                </span>
              </div>
              <div className="mt-3">
                <span className="text-3xl">{getScoreEmoji(scoreData.overall)}</span>
                <p className="text-lg font-semibold text-gray-700 mt-2">Overall Score</p>
                <p className="text-sm text-gray-500">for {currentBeach.name}</p>
              </div>
            </div>

            {/* Category Scores */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">🌡️</div>
                <div className={`text-2xl font-bold ${getScoreColor(scoreData.weather)}`}>
                  {scoreData.weather.toFixed(1)}
                </div>
                <p className="text-sm text-gray-600 mt-1">Weather</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">🌊</div>
                <div className={`text-2xl font-bold ${getScoreColor(scoreData.waves)}`}>
                  {scoreData.waves.toFixed(1)}
                </div>
                <p className="text-sm text-gray-600 mt-1">Waves</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">☀️</div>
                <div className={`text-2xl font-bold ${getScoreColor(scoreData.uv_safety)}`}>
                  {scoreData.uv_safety.toFixed(1)}
                </div>
                <p className="text-sm text-gray-600 mt-1">UV Safety</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">🌊</div>
                <div className={`text-2xl font-bold ${getScoreColor(scoreData.tides)}`}>
                  {scoreData.tides.toFixed(1)}
                </div>
                <p className="text-sm text-gray-600 mt-1">Tides</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">👥</div>
                <div className={`text-2xl font-bold ${getScoreColor(scoreData.crowd_level)}`}>
                  {scoreData.crowd_level.toFixed(1)}
                </div>
                <p className="text-sm text-gray-600 mt-1">Crowd Level</p>
              </div>
            </div>

            {/* Recommendations */}
            {scoreData.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-semibold text-blue-900 mb-3 flex items-center">
                  <span className="mr-2">💡</span>
                  Recommendations for {currentBeach.name}
                </h5>
                <ul className="space-y-2">
                  {scoreData.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-blue-800 flex items-start">
                      <span className="mr-2">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Best Time */}
            {scoreData.best_time_today && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-green-600 mr-3 text-xl">⏰</span>
                  <div>
                    <p className="font-semibold text-green-900">Best Time Today</p>
                    <p className="text-sm text-green-800">{scoreData.best_time_today}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Refresh Button */}
            <div className="text-center">
              <button
                onClick={() => fetchBeachScore(currentBeach)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Refresh Score
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
