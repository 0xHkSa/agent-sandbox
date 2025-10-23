'use client';

import { useEffect, useState } from 'react';

interface LandingAnimationProps {
  onComplete: () => void;
}

export default function LandingAnimation({ onComplete }: LandingAnimationProps) {
  const [stage, setStage] = useState<'initial' | 'expand' | 'fadeout'>('initial');

  useEffect(() => {
    // Stage 1: Show text with scale-up effect
    const expandTimer = setTimeout(() => {
      setStage('expand');
    }, 600);

    // Stage 2: Fade out and complete
    const fadeTimer = setTimeout(() => {
      setStage('fadeout');
    }, 2800);

    // Stage 3: Remove component
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3800);

    return () => {
      clearTimeout(expandTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-1000 ${
        stage === 'fadeout' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative">
        {/* Main Text */}
        <h2
          className={`text-white font-bold uppercase tracking-wide leading-tight text-center transition-all duration-1500 ${
            stage === 'initial' 
              ? 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl opacity-0 scale-75' 
              : 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl opacity-100 scale-100'
          }`}
          style={{
            textShadow: '0 0 40px rgba(20, 184, 166, 0.5)',
          }}
        >
          GO HAWAII
        </h2>

        {/* Animated underline/glow effect */}
        <div
          className={`absolute -bottom-4 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent transition-all duration-1000 ${
            stage === 'initial' ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
          }`}
          style={{
            boxShadow: '0 0 20px rgba(20, 184, 166, 0.8)',
          }}
        />

        {/* Particles/dots effect (optional decorative elements) */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 bg-teal-400/30 rounded-full transition-all duration-1000 ${
                stage === 'initial' ? 'opacity-0' : 'opacity-100'
              }`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS for particle float animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
      `}</style>
    </div>
  );
}

