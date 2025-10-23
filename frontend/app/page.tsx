'use client';

import { useState, useEffect } from 'react';
import AIChat from '@/components/AIChat';
import LiveConditions from '@/components/LiveConditions';
import RightNowSnapshot from '@/components/RightNowSnapshot';
import HeaderWeather from '@/components/HeaderWeather';
import LandingAnimation from '@/components/LandingAnimation';

const BEACH_ACTIVITIES = [
  {
    title: 'SURFING',
    description: 'World-class waves, warm waters, perfect conditions. Ride the legendary North Shore swells.',
    emoji: '🏄'
  },
  {
    title: 'SNORKELING',
    description: 'Crystal clear waters, vibrant coral reefs, tropical fish. Discover the underwater paradise.',
    emoji: '🤿'
  },
  {
    title: 'BEACH RELAXATION',
    description: 'Soft sand, gentle waves, endless sunshine. Your perfect day of paradise awaits.',
    emoji: '🏖️'
  },
];

export default function Home() {
  const [showAI, setShowAI] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  const handleLandingComplete = () => {
    setShowLanding(false);
  };

  return (
    <div className="relative min-h-screen">
      {/* Landing Animation - Only shows on first visit */}
      {showLanding && <LandingAnimation onComplete={handleLandingComplete} />}
      {/* Background Image - Fixed for entire page */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
        style={{
          backgroundImage: "url('/images/backgrounds/go-hawaii-background.jpg')",
        }}
      >
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        {/* Vintage/Muted color filter overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-rose-900/20 via-teal-900/20 to-slate-900/30 mix-blend-multiply"></div>
      </div>

      {/* Header Navigation - Fixed at top */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-black/30 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 py-4">
            <div className="flex items-center justify-between">
              {/* Left Side - Brand + Navigation */}
              <div className="flex items-center space-x-8 lg:space-x-12">
                {/* Brand */}
                <h1 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-wider">
                  GO HAWAII
                </h1>
                
                  {/* Navigation Links */}
                  <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
                    <button className="text-white/60 text-sm uppercase tracking-wide cursor-not-allowed group">
                      <span className="group-hover:text-white/80 transition-colors">SURF</span>
                      <span className="text-xs ml-2 text-white/40">(Coming Soon)</span>
                    </button>
                    <button className="text-white/60 text-sm uppercase tracking-wide cursor-not-allowed group">
                      <span className="group-hover:text-white/80 transition-colors">HIKE</span>
                      <span className="text-xs ml-2 text-white/40">(Coming Soon)</span>
                    </button>
                    <button className="text-white/60 text-sm uppercase tracking-wide cursor-not-allowed group">
                      <span className="group-hover:text-white/80 transition-colors">EXPLORE</span>
                      <span className="text-xs ml-2 text-white/40">(Coming Soon)</span>
                    </button>
                  </nav>
              </div>

              {/* Right Side - Utilities */}
              <div className="flex items-center space-x-4 lg:space-x-6">
                {/* Weather Widget */}
                <HeaderWeather />
                
                {/* AI Assistant Button */}
                <button 
                  onClick={() => setShowAI(!showAI)}
                  className="relative text-white text-sm uppercase tracking-wide transition-colors hidden sm:block px-4 py-2 rounded-lg border-2 border-teal-400/60 hover:border-teal-300 overflow-hidden group"
                >
                  {/* Continuous left-to-right shimmer effect */}
                  <span className="absolute inset-0 w-full bg-gradient-to-r from-transparent via-teal-300/70 to-transparent animate-shimmer blur-sm"></span>
                  <span className="relative z-10 group-hover:text-teal-300 transition-colors">AI GUIDE</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24">
        {/* Hero + Introduction Section (Combined with Right Now Widget) */}
        <section className="px-6 sm:px-12 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Left Side - Hero + Introduction */}
              <div className="flex flex-col justify-center">
                {/* Hero Title */}
                <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white uppercase tracking-wide leading-tight">
                  EXPLORE
                </h2>
                <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white uppercase mb-8 tracking-wide leading-tight">
                  PARADISE
                </h2>

                {/* Introduction Text */}
                <div className="text-left">
                  <h3 className="text-2xl sm:text-3xl font-bold text-white uppercase mb-4 tracking-wide">
                    Your Real-Time Hawaii Beach Guide
                  </h3>
                  <p className="text-base sm:text-lg text-white/80 leading-relaxed mb-6">
                    Get live weather, surf conditions, and AI-powered recommendations for Oahu's best beaches. 
                    Whether you're planning to surf, snorkel, or simply relax on the sand, we provide real-time 
                    data to help you make the most of your Hawaiian adventure.
                  </p>
                  <div className="flex flex-wrap justify-start gap-4 text-sm text-white/60">
                    <span className="flex items-center">
                      <span className="mr-2">🌡️</span> Real-Time Weather
                    </span>
                    <span className="flex items-center">
                      <span className="mr-2">🌊</span> Live Surf Conditions
                    </span>
                    <span className="flex items-center">
                      <span className="mr-2">🤖</span> AI Recommendations
                    </span>
                    <span className="flex items-center">
                      <span className="mr-2">📍</span> Multiple Beach Locations
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side - Right Now Snapshot */}
              <div className="flex items-center justify-center lg:justify-end">
                <div className="w-full max-w-md">
                  <RightNowSnapshot />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Conditions Section */}
        <section className="py-12 px-6">
          <div className="max-w-7xl mx-auto">
            <LiveConditions />
          </div>
        </section>

        {/* Beach Activity Cards Section */}
        <section className="py-12 px-6 sm:px-12">
          {/* Section Title */}
          <div className="text-center mb-8">
            <p className="text-white/60 text-sm uppercase tracking-wider mb-2">
              PLAN YOUR EXPERIENCE
            </p>
          </div>

          {/* Activity Cards */}
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              {BEACH_ACTIVITIES.map((activity) => (
                <div 
                  key={activity.title}
                  className="bg-black/40 backdrop-blur-md rounded-lg p-6 hover:bg-black/50 transition-all duration-300 group"
                >
                  {/* Emoji Icon */}
                  <div className="text-4xl mb-4">{activity.emoji}</div>
                  
                  {/* Title */}
                  <h3 className="text-white text-xl font-bold uppercase mb-3 tracking-wide">
                    {activity.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-white/80 text-sm mb-6 leading-relaxed">
                    {activity.description}
                  </p>
                  
                  {/* CTA Button */}
                  <button className="text-white text-sm uppercase tracking-wide border border-white/30 px-4 py-2 rounded hover:bg-white/10 transition-all w-full group-hover:border-white/50">
                    + VIEW DETAILS
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer Padding */}
        <div className="h-20"></div>
      </main>

      {/* AI Chat Modal */}
      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-lg shadow-2xl">
            <button
              onClick={() => setShowAI(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10"
            >
              ✕
            </button>
            <AIChat />
          </div>
        </div>
      )}
    </div>
  );
}
