'use client';

import { useState } from 'react';

interface FloatingChatButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export default function FloatingChatButton({ onClick, isOpen = false }: FloatingChatButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Button */}
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          group relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 transform
          ${isHovered ? 'scale-110 shadow-xl' : 'scale-100'}
          ${isOpen 
            ? 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700' 
            : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700'
          }
          border-2 border-white/20 hover:border-white/40
        `}
      >
        {/* Chat Icon */}
        {isOpen ? (
          <svg 
            className="w-6 h-6 text-white transition-transform duration-200 group-hover:scale-110" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg 
            className="w-6 h-6 text-white transition-transform duration-200 group-hover:scale-110" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
            />
          </svg>
        )}

        {/* Pulse Animation */}
        <div className="absolute inset-0 rounded-full bg-teal-400 animate-ping opacity-20"></div>
        
        {/* Notification Badge (optional - can be removed) */}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-xs text-white font-bold">AI</span>
        </div>
      </button>

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black/90 text-white text-sm rounded-lg whitespace-nowrap backdrop-blur-sm">
          {isOpen ? 'Close Chat' : 'Chat with AI Guide'}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
        </div>
      )}
    </div>
  );
}
