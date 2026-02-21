'use client';

import { useEffect, useRef, useState } from 'react';
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

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalRef = useRef<string>(''); // source of truth for final text

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setUnsupported(true);
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    };

    recognition.onresult = (event: any) => {
      // Only process the NEW results since last callback
      let nextInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = (res?.[0]?.transcript ?? '').trim();
        if (!text) continue;

        if (res.isFinal) {
          // Append only once when finalised
          finalRef.current = `${finalRef.current} ${text}`.trim();
        } else {
          // Interim should be just the latest "live" phrase(s)
          nextInterim += `${text} `;
        }
      }

      setFinalText(finalRef.current);
      setInterim(nextInterim.trim());
    };

    recognition.onerror = (e: any) => {
      // Common on mobile: "no-speech", "aborted", "network"
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      // Keep whatever we have; user can still "Use Transcript"
      console.warn('Speech recognition error:', e?.error ?? e);
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('Recognition start failed:', err);
      setUnsupported(true);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const stopRecording = () => {
    // Stop first so we don’t get a late onresult that changes state mid-submit
    try {
      recognitionRef.current?.stop();
    } catch {}

    const text = `${finalRef.current} ${interim}`.trim();
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
                {interim && <span className="text-gray-400"> {interim}</span>}
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                try { recognitionRef.current?.stop(); } catch {}
                onCancel();
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Square className="w-5 h-5" />
              Use Transcript
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}