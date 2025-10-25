'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatBubbleProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ConversationContext {
  messages: Message[];
  sessionId: string;
}

export default function ChatBubble({ isOpen, onClose }: ChatBubbleProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Aloha! I'm your Hawaii AI guide powered by MCP (Model Context Protocol) and Gemini AI. I can help you with:\n\n🏄 Real-time surf conditions and wave forecasts\n🌡️ Live weather data for all Oahu beaches\n🏖️ Smart beach recommendations based on conditions\n🌊 Tide times and UV index information\n📍 Multi-beach analysis and comparisons\n\nAsk me anything about your Hawaiian adventure!",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Smart context filtering - only include relevant recent messages
  const getSmartContext = (): Message[] => {
    const relevantKeywords = ['weather', 'surf', 'wave', 'beach', 'tide', 'uv', 'temperature', 'wind', 'tomorrow', 'today', 'forecast'];
    
    // Get last 30 messages, but prioritize relevant ones
    const recentMessages = messages.slice(-30);
    const relevantMessages = recentMessages.filter(msg => 
      relevantKeywords.some(keyword => 
        msg.text.toLowerCase().includes(keyword)
      )
    );
    
    // If we have relevant messages, use them; otherwise use recent messages
    // Ensure we have max 15 user + 15 AI messages
    if (relevantMessages.length > 0) {
      return relevantMessages.slice(-30);
    }
    
    // Count user vs AI messages to maintain 15/15 balance
    const userMessages = recentMessages.filter(msg => msg.isUser);
    const aiMessages = recentMessages.filter(msg => !msg.isUser);
    
    // Take up to 15 of each type
    const balancedMessages = [
      ...userMessages.slice(-15),
      ...aiMessages.slice(-15)
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return balancedMessages;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Get smart context for conversation
      const contextMessages = getSmartContext();
      
      const response = await fetch('http://localhost:4000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userMessage.text,
          conversation: contextMessages,
          sessionId: sessionId
        })
      });

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.ok ? data.answer : "Sorry, I'm having trouble right now. Please try again!",
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting. Please check your connection and try again.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Chat Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl">
        
        {/* Header */}
        <div className="bg-black/30 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white text-lg font-bold">AI</span>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Hawaii AI Guide</h3>
              <p className="text-white/60 text-sm">Powered by MCP & Gemini AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[400px] max-h-[500px]">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl px-4 py-3 rounded-2xl text-base ${
                message.isUser
                  ? 'bg-teal-500 text-black'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="whitespace-pre-line">{message.text}</div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl text-base">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

        {/* Input */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about surf conditions, weather, beach recommendations..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full text-base text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || isLoading}
              className="bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 text-white p-3 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          </div>
        </div>
      
      </div>
    </div>
  );
}
