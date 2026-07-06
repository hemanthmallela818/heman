"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useData } from './context';

export default function VoiceAssistant() {
  const router = useRouter();
  const { data, fetchData } = useData();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Tap the microphone to issue voice commands');
  const [isCommandMatch, setIsCommandMatch] = useState(false);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setStatusMessage('Speech recognition is not supported in this browser. Try Google Chrome.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-IN'; // Optimize for English with Indian locale/accent

    rec.onstart = () => {
      setIsListening(true);
      setIsCommandMatch(false);
      setShowConfirmPrompt(false);
      setTranscript('');
      setStatusMessage('Listening to your voice command...');
    };

    rec.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setTranscript(speechToText);
      setShowConfirmPrompt(true);
      setStatusMessage("Transcribed. Review text and click 'Confirm & Send'.");
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setStatusMessage('Microphone access denied. Please allow microphone permissions in the browser settings.');
      } else {
        setStatusMessage(`Speech Error: ${event.error}. Click mic to try again.`);
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;

    // Developer test helper to simulate speech transcription from the console
    const handleMockSpeech = (e) => {
      const mockText = e.detail;
      setTranscript(mockText);
      setShowConfirmPrompt(true);
      setStatusMessage("Transcribed. Review text and click 'Confirm & Send'.");
    };

    window.addEventListener('mock-speech', handleMockSpeech);
    return () => {
      window.removeEventListener('mock-speech', handleMockSpeech);
    };
  }, []);

  // Temporary test hook to check layout via ?mockSpeech=true
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mockSpeech=true')) {
      setTranscript("what is today's profit");
      setShowConfirmPrompt(true);
      setStatusMessage("Transcribed. Review text and click 'Confirm & Send'.");
    }
  }, []);

  const toggleListen = () => {
    if (!isSupported) return;
    
    // Stop speaking if active
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setShowConfirmPrompt(false);
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  const speak = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const processCommand = async (rawText) => {
    const text = rawText.toLowerCase().trim();
    setIsCommandMatch(true);
    setStatusMessage("Sending voice transcript to n8n...");
    setIsSpeaking(true); // Activate waveform speaking state

    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: rawText }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';

      // 1. If response is binary audio (e.g. from an OpenAI/ElevenLabs TTS node in n8n)
      if (contentType.includes('audio')) {
        const responseTextHeader = response.headers.get('X-Response-Text');
        if (responseTextHeader) {
          const originalText = decodeURIComponent(responseTextHeader);
          setTranscript(originalText);
          setStatusMessage(`n8n response: "${originalText}"`);
        } else {
          setStatusMessage("n8n audio response received. Playing back...");
        }
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onplay = () => {
          setIsSpeaking(true);
        };
        audio.onended = () => {
          setIsSpeaking(false);
          setStatusMessage("AI voice agent audio completed.");
        };
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          setIsSpeaking(false);
          setStatusMessage("Failed to play n8n audio output.");
        };
        
        await audio.play();
        return;
      }

      // 2. If response is JSON
      if (contentType.includes('application/json')) {
        const data = await response.json();
        
        if (data.error) {
          // If n8n is unconfigured in env, automatically fallback to local offline matches
          if (data.error.includes('N8N_WEBHOOK_URL is not configured')) {
            console.log("n8n Webhook URL is unconfigured. Falling back to local command logic.");
            processLocalCommand(rawText);
            return;
          }
          throw new Error(data.error);
        }

        const replyText = data.text || data.message || data.output || data.response || '';
        if (replyText) {
          setStatusMessage(`n8n: "${replyText}"`);
          speak(replyText);
          
          // Auto-navigate client if response suggests routing
          const replyTextLower = replyText.toLowerCase();
          if (replyTextLower.includes('navigat') || replyTextLower.includes('switch page') || replyTextLower.includes('database') || replyTextLower.includes('data manager')) {
            if (replyTextLower.includes('data') || replyTextLower.includes('database')) {
              setTimeout(() => router.push('/data'), 2000);
            }
          }
        } else {
          setStatusMessage("Received empty reply payload from n8n.");
          setIsSpeaking(false);
        }
        return;
      }

      // 3. Fallback: text response
      const rawResponseText = await response.text();
      if (rawResponseText) {
        setStatusMessage(`n8n: "${rawResponseText}"`);
        speak(rawResponseText);
      } else {
        setStatusMessage("Webhook response loaded successfully.");
        setIsSpeaking(false);
      }

    } catch (err) {
      console.warn("n8n connection failed, using local offline processor. Detail:", err.message);
      processLocalCommand(rawText);
    }
  };

  // Local Offline Commands fallback
  const processLocalCommand = (rawText) => {
    const text = rawText.toLowerCase().trim();
    setIsCommandMatch(true);

    // 1. Navigation intents
    if (
      text.includes('go to data') || 
      text.includes('manage data') || 
      text.includes('open data') || 
      text.includes('database') || 
      text.includes('table') || 
      text.includes('ledger') || 
      text.includes('inventory')
    ) {
      speak("Navigating to the Database Manager page.");
      setStatusMessage("Offline match: Navigation. Opening Data Manager...");
      setTimeout(() => {
        router.push('/data');
      }, 1000);
      return;
    }

    if (
      text.includes('go to analytics') || 
      text.includes('overview') || 
      text.includes('home') || 
      text.includes('main page')
    ) {
      speak("You are already viewing the Analytics overview page.");
      setStatusMessage("Offline match: Navigation. Already on Analytics home.");
      return;
    }

    // 2. Sync intents
    if (
      text.includes('refresh') || 
      text.includes('sync') || 
      text.includes('reload') || 
      text.includes('fetch')
    ) {
      speak("Synchronizing dashboard stats with your live Google Sheet now.");
      setStatusMessage("Offline match: Sync database. Syncing sheets...");
      fetchData(false);
      return;
    }

    // 3. KPI query intents
    if (text.includes('profit') || text.includes('net profit') || text.includes('earnings')) {
      const profit = data.kpis.todaysProfit;
      const speech = `Today's net profit margin is ${profit > 0 ? Math.round(profit) : 0} rupees.`;
      speak(speech);
      setStatusMessage(`Offline match: Today's Profit inquiry. Reading value...`);
      return;
    }

    if (text.includes('revenue') || text.includes('sales revenue') || text.includes('income')) {
      const revenue = data.kpis.todaysRevenue;
      const speech = `Today's gross revenue totals ${revenue > 0 ? Math.round(revenue) : 0} rupees.`;
      speak(speech);
      setStatusMessage(`Offline match: Today's Revenue inquiry. Reading value...`);
      return;
    }

    if (text.includes('stock value') || text.includes('valuation') || text.includes('stock valuation') || text.includes('inventory value')) {
      const valuation = data.kpis.totalStockValue;
      const speech = `The total cost valuation of your current stock is ${Math.round(valuation)} rupees.`;
      speak(speech);
      setStatusMessage(`Offline match: Stock Valuation inquiry. Reading value...`);
      return;
    }

    if (text.includes('low stock') || text.includes('shortage') || text.includes('restock')) {
      const count = data.kpis.lowStockCount;
      const speech = count > 0 
        ? `You currently have ${count} items running below safe stock levels.` 
        : "All inventory items are currently at safe stock levels.";
      speak(speech);
      setStatusMessage(`Offline match: Low Stock inquiry. Reading value...`);
      return;
    }

    // Help command
    if (text.includes('help') || text.includes('suggest') || text.includes('what can i say')) {
      speak("You can say read today's profit, navigate to database, or sync spreadsheet.");
      setStatusMessage("Suggestions read aloud.");
      return;
    }

    // Command didn't match intents
    setIsCommandMatch(false);
    speak(`I heard "${rawText}". Try saying: profit today, or navigate to database.`);
    setStatusMessage("Incomplete query. Choose a shortcut below or speak again.");
  };

  const handleSuggestionClick = (phrase) => {
    setTranscript(phrase);
    setShowConfirmPrompt(false);
    processCommand(phrase);
  };

  return (
    <div className={`voice-widget-card ${isListening ? 'active' : ''}`}>
      <div className="voice-mic-container">
        <button 
          className={`voice-mic-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
          onClick={toggleListen}
          disabled={!isSupported}
          title={isListening ? 'Stop Listening' : 'Click to Speak'}
        >
          {isListening ? <Mic size={24} /> : <MicOff size={24} />}
        </button>
        <span className="voice-mic-label">{isListening ? 'Listening' : 'Talk to AI'}</span>
      </div>

      <div className="voice-content-area">
        {/* Status prompt indicator always visible above transcript box */}
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span className={`sync-dot ${isListening ? 'syncing' : ''}`} style={{ width: '6px', height: '6px', backgroundColor: isListening ? 'var(--blue)' : 'var(--text-muted)' }}></span>
          {statusMessage}
        </p>

        <div className="voice-transcript-wrapper">
          {transcript ? (
            <p className={`voice-transcript-text ${isListening ? 'listening' : ''} ${isCommandMatch ? 'command-match' : ''}`}>
              &ldquo;{transcript}&rdquo;
            </p>
          ) : (
            <p className="voice-transcript-text placeholder" style={{ opacity: 0.5 }}>
              Awaiting speech capture...
            </p>
          )}

          {isListening && (
            <div className="waveform-container">
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
              <div className="waveform-bar"></div>
            </div>
          )}
          
          {isSpeaking && (
            <Volume2 size={16} color="var(--emerald)" style={{ marginLeft: 'auto', animation: 'pulse-dot-active 1s infinite alternate' }} />
          )}
        </div>

        {/* Confirmation prompt for microphone inputs */}
        {showConfirmPrompt && (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setTranscript('');
                setShowConfirmPrompt(false);
                setStatusMessage('Tap the microphone to issue voice commands');
              }}
              style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto', background: 'rgba(255,255,255,0.02)' }}
            >
              Discard & Record Again
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setShowConfirmPrompt(false);
                processCommand(transcript);
              }}
              style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto', background: 'var(--blue)', borderColor: 'var(--blue)' }}
            >
              Confirm & Send
            </button>
          </div>
        )}

        <div className="voice-suggestions-area">
          <h3 className="voice-suggestions-title">Quick voice shortcuts</h3>
          <div className="voice-suggestion-pills">
            <button className="voice-suggestion-pill" onClick={() => handleSuggestionClick("Read today's profit")}>
              🎙️ Profit Today
            </button>
            <button className="voice-suggestion-pill" onClick={() => handleSuggestionClick("Read today's revenue")}>
              🎙️ Revenue Today
            </button>
            <button className="voice-suggestion-pill" onClick={() => handleSuggestionClick("What is the stock value?")}>
              🎙️ Stock Valuation
            </button>
            <button className="voice-suggestion-pill" onClick={() => handleSuggestionClick("Go to data manager")}>
              🎙️ Navigate to Database
            </button>
            <button className="voice-suggestion-pill" onClick={() => handleSuggestionClick("Sync spreadsheet")}>
              🎙️ Sync Sheets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
