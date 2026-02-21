'use client';

import { useState } from 'react';
import { Mic, Send, Loader2 } from 'lucide-react';
import { VoiceRecorder } from './voice-recorder';

interface MealLogInputProps {
  onSubmitMeal: (text: string) => Promise<void>;
  isProcessing: boolean;
}

export function MealLogInput({ onSubmitMeal, isProcessing }: MealLogInputProps) {
  const [input, setInput] = useState('');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  const handleSubmit = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    await onSubmitMeal(text);
    setInput('');
  };

  const handleVoiceComplete = async (transcription: string) => {
    setShowVoiceRecorder(false);
    await handleSubmit(transcription);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(input)}
            placeholder="e.g., grilled chicken breast with rice and broccoli"
            className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            disabled={isProcessing}
          />
          <button
            onClick={() => handleSubmit(input)}
            disabled={isProcessing || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <button
          onClick={() => setShowVoiceRecorder(true)}
          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          disabled={isProcessing}
          type="button"
        >
          <Mic className="w-5 h-5" />
          <span className="hidden sm:inline">Voice</span>
        </button>
      </div>

      {showVoiceRecorder && (
        <VoiceRecorder onComplete={handleVoiceComplete} onCancel={() => setShowVoiceRecorder(false)} />
      )}

      <p className="text-sm text-gray-500">
        Describe your meal naturally - AI will estimate calories and macros automatically
      </p>
    </div>
  );
}
