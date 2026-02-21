'use client';

import { useEffect, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

interface VoiceRecorderProps {
  onComplete: (transcription: string) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      setUnsupported(true);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    recognition.onstart = () => {
      setIsRecording(true);
      timer = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    };

    recognition.onresult = (event: any) => {
      let nextFinal = '';
      let nextInterim = '';
      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) nextFinal += text + ' ';
        else nextInterim += text;
      }
      if (nextFinal.trim()) setFinalText(nextFinal.trim());
      setInterim(nextInterim.trim());
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.start();

    return () => {
      if (timer) clearInterval(timer);
      try { recognition.stop(); } catch {}
    };
  }, []);

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const stopRecording = () => {
    const text = `${finalText} ${interim}`.trim();
    if (text) onComplete(text);
    else onCancel();
  };

  if (unsupported) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
          <p className="text-gray-900 font-medium">Voice input isn&apos;t supported in this browser.</p>
          <p className="text-sm text-gray-500">Try Chrome, or use text input.</p>
          <button onClick={onCancel} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center space-y-6">
          <div className="flex justify-between items-start">
            <div className="flex-1" />
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative">
            <div className="w-32 h-32 mx-auto bg-red-500 rounded-full flex items-center justify-center relative">
              <Mic className="w-16 h-16 text-white" />
              {isRecording && <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping" />}
            </div>
          </div>

          <div>
            <p className="text-2xl font-semibold text-gray-900">{formatTime(recordingTime)}</p>
            <p className="text-gray-500 mt-2">Describe your meal...</p>
            {(finalText || interim) && (
              <p className="text-sm text-gray-700 mt-3 bg-gray-50 rounded-lg p-3 text-left">
                {finalText}
                <span className="text-gray-400"> {interim}</span>
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={onCancel} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={stopRecording} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
              <Square className="w-5 h-5" />
              Use Transcript
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
