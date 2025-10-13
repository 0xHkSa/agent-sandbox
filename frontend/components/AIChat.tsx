'use client';

import { useState } from 'react';

export default function AIChat() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      const response = await fetch('http://localhost:4000/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (data.ok) {
        setAnswer(data.answer);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Failed to connect to AI service. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const exampleQuestions = [
    'Should I surf Waikiki today?',
    'What are the waves like at North Shore?',
    'What is the weather in Kailua?',
  ];

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-teal-600 p-6 text-white">
        <h3 className="text-2xl font-bold mb-2">🤖 AI Assistant (Beta)</h3>
        <p className="text-blue-100">Ask me anything about Hawaii outdoor conditions!</p>
      </div>

      <div className="p-6">
        {/* Input Section */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Should I surf Waikiki today?"
              className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
              disabled={loading}
            />
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
            >
              {loading ? '...' : 'Ask'}
            </button>
          </div>

          {/* Example Questions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {exampleQuestions.map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors duration-200"
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Answer Section */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-pulse">
            <p className="text-blue-600">🤔 Analyzing conditions...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">❌ {error}</p>
          </div>
        )}

        {answer && !loading && (
          <div className="bg-gradient-to-br from-blue-50 to-teal-50 border border-blue-200 rounded-lg p-5">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">💬</span>
              <div className="flex-1">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Powered by Google Gemini + Real-time Hawaii data</p>
        </div>
      </div>
    </div>
  );
}

