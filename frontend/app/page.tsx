'use client';

import { useState } from 'react';
import SpotCard from '@/components/SpotCard';
import AIChat from '@/components/AIChat';
import LiveConditions from '@/components/LiveConditions';

const POPULAR_SPOTS = [
  { 
    name: 'Waikiki Beach', 
    location: 'Honolulu, Oahu',
    image: '🏖️',
    description: 'Perfect for beginners, gentle waves, iconic Hawaiian beach'
  },
  { 
    name: 'North Shore (Ehukai)', 
    location: 'Haleiwa, Oahu',
    image: '🌊',
    description: 'World-famous surf spot, powerful winter waves'
  },
  { 
    name: 'Kailua Beach', 
    location: 'Kailua, Oahu',
    image: '🏝️',
    description: 'Pristine white sand, great for kayaking and swimming'
  },
  { 
    name: 'Lanikai Beach', 
    location: 'Kailua, Oahu',
    image: '🌅',
    description: 'Crystal clear water, stunning sunrise views'
  },
];

export default function Home() {
  const [showAI, setShowAI] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-3xl">🌴</span>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                Hawaii Outdoor Hub
              </h1>
            </div>
            <button 
              onClick={() => setShowAI(!showAI)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-200 font-medium"
            >
              🤖 AI Assistant {showAI ? '✕' : ''}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Your Guide to Hawaii's Best <span className="text-blue-600">Outdoor Adventures</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            Real-time weather, surf conditions, and AI-powered recommendations for all Hawaii outdoor activities
          </p>
        </div>

        {/* AI Chat (Conditional) */}
        {showAI && (
          <div className="mb-12">
            <AIChat />
          </div>
        )}

        {/* Live Conditions */}
        <LiveConditions />

        {/* Popular Spots */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
              🏄 Popular Spots
            </h3>
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              View All →
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {POPULAR_SPOTS.map((spot) => (
              <SpotCard key={spot.name} spot={spot} />
            ))}
          </div>
        </div>

        {/* Info Sections */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="text-4xl mb-3">🌡️</div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Live Weather</h4>
            <p className="text-gray-600">Real-time temperature, wind, and precipitation data for all major Hawaii spots</p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="text-4xl mb-3">🌊</div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Surf Forecast</h4>
            <p className="text-gray-600">Wave height, period, and direction updated hourly from marine weather APIs</p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="text-4xl mb-3">🤖</div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">AI Assistant</h4>
            <p className="text-gray-600">Ask natural questions and get personalized recommendations instantly</p>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-teal-600 rounded-2xl p-8 sm:p-12 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">Ready to explore Hawaii?</h3>
          <p className="text-xl mb-6 text-blue-100">Get real-time conditions and expert AI guidance</p>
          <button 
            onClick={() => setShowAI(true)}
            className="px-8 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors duration-200"
          >
            Start Planning Your Adventure
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>© 2025 Hawaii Outdoor Hub. Built with ❤️ in Hawaii.</p>
          <p className="mt-2 text-sm">Real-time data from Open-Meteo & AI powered by Google Gemini</p>
        </div>
      </footer>
    </div>
  );
}
