"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import MicrophoneButton from './components/MicrophoneButton';
import DynamicBackground from './components/DynamicBackground';
import ClientOnly from './components/ClientOnly';
import WaveAnimation from './components/WaveAnimation';

interface ConversationItem {
  type: 'user' | 'assistant';
  text: string;
}

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState("Hello! How can I assist you?");
  const [isLoading, setIsLoading] = useState(false);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [hasFallbackEnabled, setHasFallbackEnabled] = useState(false);
  const [hasApiError, setHasApiError] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add a ref to track if we're currently recording
  const isRecordingRef = useRef<boolean>(false);
  
  // Add state to track recording duration
  const recordingStartTimeRef = useRef<number | null>(null);
  
  // New ref for silence timeout
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // New ref for audio context
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // New ref for analyser
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // New ref to track when silence began
  const silenceStartTimeRef = useRef<number | null>(null);
  
  // New ref to track when we last received audio data
  const lastAudioTimestampRef = useRef<number>(0);
  
  // Clean up function to stop media streams when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);
  
  // Add this useEffect to generate a session ID when the component mounts
  useEffect(() => {
    // Generate a random session ID if one doesn't exist
    if (!sessionId) {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      console.log('Generated new session ID:', newSessionId);
    }
  }, [sessionId]);
  
  // Check for fallback mode in session storage
  useEffect(() => {
    const fallbackEnabled = window.sessionStorage.getItem('enableFallback') === 'true';
    if (fallbackEnabled) {
      setHasFallbackEnabled(true);
      console.log('Fallback mode enabled from session storage');
    }
  }, []);
  
  // Add this useEffect to detect production environment and set appropriate fallback settings
  useEffect(() => {
    // Check if we're in production (Vercel deployment)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      console.log('Running in production environment - checking microphone compatibility');
      // Pre-check microphone compatibility in production
      checkMicrophoneCompatibility();
    }
  }, []);
  
  // Add this helper function to generate a random session ID
  const generateSessionId = (): string => {
    return 'session_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };
  
  // New function to check microphone compatibility
  const checkMicrophoneCompatibility = async () => {
    // Check if the browser supports getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Browser does not support getUserMedia');
      setHasFallbackEnabled(true);
      window.sessionStorage.setItem('enableFallback', 'true');
      setMessage("Your browser doesn't support microphone access. Using text-only mode.");
      return false;
    }

    // Check if we can get permission for the microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks immediately, we just needed to check permission
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone permission granted');
      return true;
    } catch (error) {
      console.error('Error accessing microphone during compatibility check:', error);
      setHasFallbackEnabled(true);
      window.sessionStorage.setItem('enableFallback', 'true');
      setMessage("Microphone access not available. Using text-only mode.");
      return false;
    }
  };
  
  // Modify startListening to handle production-specific issues
  const startListening = async () => {
    setIsListening(true);
    setMessage("I'm listening...");
    audioChunksRef.current = [];
    recordingStartTimeRef.current = Date.now();
    lastAudioTimestampRef.current = Date.now(); // Initialize last audio timestamp
    
    try {
      // Add a timeout for getUserMedia to prevent hanging
      const microphonePromise = navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Microphone access timed out')), 5000);
      });
      
      // Race the promises
      const stream = await Promise.race([microphonePromise, timeoutPromise]) as MediaStream;
      console.log('Microphone access granted');
      
      // Store the stream for cleanup
      streamRef.current = stream;
      
      // Rest of the existing code for audio context setup
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (audioContextError) {
          console.error('Failed to create AudioContext:', audioContextError);
          // Continue without audio analysis
        }
      }
      
      if (audioContextRef.current) {
        const audioContext = audioContextRef.current;
        try {
          const analyser = audioContext.createAnalyser();
          analyserRef.current = analyser;
          
          const microphone = audioContext.createMediaStreamSource(stream);
          microphone.connect(analyser);
          
          analyser.fftSize = 256;
        } catch (analyserError) {
          console.error('Failed to set up audio analysis:', analyserError);
          // Continue without audio analysis
        }
      }
      
      // Start silence detection
      startSilenceDetection();
      
      // Set up media recorder with error handling
      let mimeType = 'audio/webm';
      
      // Check if opus codec is supported
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        console.warn('Using default MIME type, preferred types not supported');
      }
      
      console.log('Using MIME type:', mimeType);
      
      // Create MediaRecorder with error handling
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType });
      } catch (mrError) {
        console.error('Failed to create MediaRecorder with specified MIME type, trying default:', mrError);
        mediaRecorder = new MediaRecorder(stream);
      }
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Keep the rest of the existing code for mediaRecorder events
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`Received audio chunk: ${event.data.size} bytes`);
          
          // Update the last audio timestamp when we receive meaningful data
          if (event.data.size > 10) { // Only count chunks with actual data
            lastAudioTimestampRef.current = Date.now();
          }
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log(`Audio recording complete: ${audioBlob.size} bytes`);
        
        // Only process if we have a meaningful recording
        if (audioBlob.size > 1024) { // At least 1KB
          sendAudioToWebhook(audioBlob);
        } else {
          console.log('Recording too short or empty, not sending');
          setIsListening(false);
          setIsLoading(false);
          setMessage("I didn't catch that. Please try again.");
        }
        
        // Clean up
        if (silenceTimeoutRef.current) {
          clearInterval(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setIsListening(false);
        setMessage("There was an error with the audio recording. Please try again.");
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      console.log('MediaRecorder started');
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsListening(false);
      
      // In production, automatically enable fallback on microphone errors
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setHasFallbackEnabled(true);
        window.sessionStorage.setItem('enableFallback', 'true');
        setMessage("Microphone access issue. I'll still try to help with your Dubai property search.");
      } else {
        setMessage(`Error accessing microphone: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  
  // Simpler silence detection based on audio chunk timestamps
  const startSilenceDetection = () => {
    const SILENCE_DURATION = 5000; // 5 seconds in milliseconds
    
    // Clear any existing timeout
    if (silenceTimeoutRef.current) {
      clearInterval(silenceTimeoutRef.current);
    }
    
    // Set up interval to check for silence
    silenceTimeoutRef.current = setInterval(() => {
      if (!isListening) return;
      
      const now = Date.now();
      const timeSinceLastAudio = now - lastAudioTimestampRef.current;
      
      console.log(`Time since last audio: ${timeSinceLastAudio}ms`);
      
      // If no meaningful audio for 5 seconds, stop recording
      if (timeSinceLastAudio >= SILENCE_DURATION) {
        console.log('Silence detected for 5 seconds, stopping recording');
        stopListening();
        setMessage("I noticed you were silent, so I stopped listening.");
      }
    }, 1000); // Check every second
  };
  
  const stopListening = () => {
    // Clear silence detection interval
    if (silenceTimeoutRef.current) {
      clearInterval(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('Stopping MediaRecorder');
      mediaRecorderRef.current.stop();
      
      // Stop all tracks on the stream
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    
    setIsListening(false);
  };
  
  const handleButtonClick = () => {
    if (isLoading) return; // Don't do anything if loading
    
    if (isSpeaking) {
      // Stop the AI from speaking if it's currently speaking
      stopSpeaking();
      return;
    }
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current && !audioRef.current.paused) {
      console.log('Stopping Lora from speaking');
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
      
      // If we have an AI response text, show it immediately instead of waiting
      if (audioRef.current.dataset.aiResponse) {
        setMessage(audioRef.current.dataset.aiResponse);
      } else {
        setMessage("Response interrupted.");
      }
      
      // Clean up the blob URL if it exists
      if (audioRef.current.src) {
        const objectUrl = audioRef.current.src;
        if (objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(objectUrl);
          console.log('Revoked audio blob URL');
        }
        audioRef.current.src = '';
      }
    }
  };

  // Function to handle sending email with conversation history
  const handleEmailSubmit = () => {
    const emailInput = document.getElementById('email-input') as HTMLInputElement;
    if (emailInput && emailInput.value) {
      setUserEmail(emailInput.value);
      // No confirmation message, just set the email
    }
  };

  // Function to enable fallback mode
  const enableFallbackMode = () => {
    console.log('Enabling fallback mode');
    // Create a session storage flag
    window.sessionStorage.setItem('enableFallback', 'true');
    setHasFallbackEnabled(true);
    setHasApiError(false);
    setMessage("Fallback mode enabled. You can now try again.");
  };

  const sendAudioToWebhook = async (audioBlob: Blob) => {
    setIsLoading(true);
    setMessage("Hold on a second, while I retrieve the information...");
    setHasApiError(false);
    
    try {
      console.log('Preparing to send audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      // Create a FormData object to send the binary audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      // Always include the session ID
      if (sessionId) {
        formData.append('sessionId', sessionId);
        console.log('Adding session ID to request:', sessionId);
      }
      
      // Always include the email if it's available
      if (userEmail) {
        formData.append('email', userEmail);
        console.log('Adding email to request:', userEmail);
      }
      
      // Check if fallback mode is enabled from session storage
      const fallbackEnabled = window.sessionStorage.getItem('enableFallback') === 'true' || hasFallbackEnabled;
      if (fallbackEnabled) {
        formData.append('enableFallback', 'true');
        console.log('Fallback mode is enabled for this request');
      }
      
      // Detect if we're in production (Vercel)
      const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      if (isProduction) {
        console.log('Running in production environment');
        formData.append('environment', 'production');
      }
      
      // Use our API endpoint
      const apiUrl = '/api/speech';
      console.log('Sending to API endpoint:', apiUrl);
      
      // Add a longer timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('Response status:', response.status);
        
        // Check if the response is ok
        if (!response.ok) {
          console.error(`API error! status: ${response.status}`);
          setHasApiError(true);
          
          // Try to get more detailed error information
          try {
            const errorJson = await response.json();
            console.error('Error details:', errorJson);
            
            // Use the message if available, otherwise use a generic message
            const errorMessage = errorJson.message || 
                                `The AI assistant encountered an error (${response.status}). Please try again later.`;
            
            setMessage(errorMessage);
          } catch (jsonError) {
            // If we can't parse the JSON, just use a generic message
            setMessage(`The AI assistant encountered an error (${response.status}). Please try again later.`);
          }
          
          return;
        }
        
        // Get content type to determine how to handle the response
        const contentType = response.headers.get('content-type') || '';
        console.log('Response content type:', contentType);
        
        // Handle different response types
        if (contentType.includes('audio/')) {
          // Direct audio response
          console.log('Received audio response');
          const audioBlob = await response.blob();
          console.log('Audio blob size:', audioBlob.size);
          
          // Play the audio
          playAudioResponse(audioBlob, "AI Assistant Response");
        } 
        else if (contentType.includes('application/json')) {
          // JSON response
          console.log('Processing JSON response');
          try {
            const jsonData = await response.json();
            console.log('API JSON response:', jsonData);
            
            // If this is a fallback response and we're not in fallback mode,
            // enable fallback mode for future requests
            if (jsonData.isFallback && !hasFallbackEnabled) {
              console.log('Received fallback response - enabling fallback mode for future requests');
              setHasFallbackEnabled(true);
              window.sessionStorage.setItem('enableFallback', 'true');
            }
            
            if (jsonData.success) {
              setMessage(jsonData.message || "Your message has been processed successfully!");
            } else {
              setMessage(jsonData.message || jsonData.error || "There was an error processing your message.");
            }
          } catch (jsonError) {
            console.error('Error parsing JSON response:', jsonError);
            
            // If we're in production and encounter errors, enable fallback automatically
            const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
            if (isProduction && !hasFallbackEnabled) {
              setHasFallbackEnabled(true);
              window.sessionStorage.setItem('enableFallback', 'true');
              setMessage("I encountered an issue but I'll still try to help with your Dubai property search.");
            } else {
              setMessage("An unexpected response was received. Please try again.");
            }
          }
        }
        else {
          // Text or other response
          console.log('Processing text response');
          const textResponse = await response.text();
          console.log('API text response:', textResponse);
          try {
            // Try to parse as JSON in case content type header is incorrect
            const jsonData = JSON.parse(textResponse);
            
            // If this is a fallback response and we're not in fallback mode,
            // enable fallback mode for future requests
            if (jsonData.isFallback && !hasFallbackEnabled) {
              console.log('Received fallback response - enabling fallback mode for future requests');
              setHasFallbackEnabled(true);
              window.sessionStorage.setItem('enableFallback', 'true');
            }
            
            if (jsonData.success) {
              setMessage(jsonData.message || "Your message has been processed successfully!");
            } else {
              setMessage(jsonData.message || jsonData.error || "There was an error processing your message.");
            }
          } catch (e) {
            // If not valid JSON, return as text
            setMessage("Response received. Thank you for your message.");
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        console.error('Error sending audio:', error);
        
        // For production, enable fallback automatically on error
        const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (isProduction && !hasFallbackEnabled) {
          setHasFallbackEnabled(true);
          window.sessionStorage.setItem('enableFallback', 'true');
          setMessage("I'm having trouble connecting to our service, but I can still help with your Dubai property search.");
        } else if (error instanceof DOMException && error.name === 'AbortError') {
          setMessage('Request took too long. The AI assistant service may be busy. Please try again shortly.');
        } else {
          setMessage('Connection error: ' + (error as Error).message + '. Please check your internet connection.');
        }
      }
    } catch (error) {
      console.error('Error preparing audio:', error);
      setMessage('Error preparing your message. Please try again with a different question.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to play audio response
  const playAudioResponse = (audioBlob: Blob, aiResponseText: string) => {
    // Create a URL for the blob with explicit MIME type for iOS
    const audioBlob2 = new Blob([audioBlob], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob2);
    
    if (audioRef.current) {
      // Store the AI response text in the audio element's dataset for later use
      audioRef.current.dataset.aiResponse = aiResponseText || "";
      
      // Set up event listeners before setting the source
      audioRef.current.onloadedmetadata = () => {
        setIsSpeaking(true); // Set speaking state to true when audio starts
        audioRef.current?.play().catch(err => {
          console.error('Error playing audio:', err);
          setMessage("Error playing audio response: " + err.message);
          setIsSpeaking(false);
        });
      };
      
      // Now set the source and attempt to play
      audioRef.current.src = audioUrl;
      setMessage("Lora is responding...");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start py-6 desktop-py-16 px-8 relative overflow-hidden bg-gradient-to-b from-[#1e1b4b] to-[#4c2889]">
      <ClientOnly>
        <DynamicBackground />
        <WaveAnimation isListening={isListening} />
      </ClientOnly>
      
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-between h-full relative z-10">
        {/* Logo with reduced margin */}
        <div className="mb-4 desktop-mb-10">
          <Image 
            src="/images/innovasense-logo.png" 
            alt="InnovaSense" 
            width={100}
            height={40}
            className="h-32 w-auto filter drop-shadow-lg hover:drop-shadow-xl transition-all duration-300" 
            priority
          />
        </div>
        
        {/* Title with reduced margin */}
        <div className="mb-6 desktop-mb-12 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#8362d9] mb-1">
            Real Estate AI Employee
          </h1>
          <p className="text-[#c4b5fd] text-lg">
            Dubai Rental AI Search
          </p>
        </div>
        
        {/* Microphone Button with reduced margin */}
        <div className="flex flex-col items-center justify-center mb-6 desktop-mb-10 py-2">
          <button
            onClick={handleButtonClick}
            onMouseDown={() => setIsButtonPressed(true)}
            onMouseUp={() => setIsButtonPressed(false)}
            onMouseLeave={() => setIsButtonPressed(false)}
            onTouchStart={() => setIsButtonPressed(true)}
            onTouchEnd={() => setIsButtonPressed(false)}
            disabled={isLoading}
            className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center focus:outline-none transition-all duration-300 p-2 ${
              isListening 
                ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' 
                : isLoading
                  ? 'bg-yellow-500/70 shadow-lg shadow-yellow-500/30 cursor-wait'
                  : isSpeaking
                    ? 'bg-green-500/70 shadow-lg shadow-green-500/30'
                    : isButtonPressed
                      ? 'bg-[#6d28d9] scale-95 shadow-inner'
                      : 'bg-[#6d28d9] shadow-lg shadow-[#6d28d9]/50 hover:bg-[#7e3af2] hover:scale-105'
            }`}
          >
            <svg 
              className={`w-10 h-10 md:w-12 md:h-12 text-white transition-all ${isButtonPressed ? 'scale-90' : 'scale-100'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={isListening 
                   ? "M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" 
                   : isSpeaking
                     ? "M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                     : "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"} 
              />
            </svg>
          </button>
          
          {/* Instruction Text with reduced margin */}
          {!isListening && !isLoading && !isSpeaking && (
            <div className="mt-3 desktop-mt-6 px-4 py-2 desktop-py-5 rounded-lg bg-[#6d28d9]/90 backdrop-blur-sm">
              <p className="text-sm md:text-base lg:text-lg text-white font-medium text-center">
                <span className="text-[#d8b4fe] font-bold">Click once</span> to start recording, <span className="text-[#d8b4fe] font-bold">click again</span> to stop and process
              </p>
            </div>
          )}
          
          {!isListening && !isLoading && isSpeaking && (
            <div className="mt-3 desktop-mt-6 px-4 py-2 desktop-py-5 rounded-lg bg-[#6d28d9]/90 backdrop-blur-sm">
              <p className="text-sm md:text-base lg:text-lg text-white font-medium text-center">
                <span className="text-[#d8b4fe] font-bold">Click</span> to stop Lora from speaking
              </p>
            </div>
          )}
        </div>
        
        {/* AI Response Box with reduced margin */}
        <div className={`bg-[#6d28d9]/80 rounded-lg px-8 py-4 desktop-p-6 w-full max-w-sm mx-auto mb-5 desktop-mb-10 backdrop-blur-sm transition-all duration-300 ${
          isListening ? 'border border-red-500/50 shadow-md shadow-red-500/20' : 
          isLoading ? 'border border-yellow-500/50 shadow-md shadow-yellow-500/20' : 
          isSpeaking ? 'border border-green-500/50 shadow-md shadow-green-500/20' : 
          hasApiError ? 'border border-red-500/50' :
          'border border-[#8362d9]/50'
        }`}>
          <p className="text-white text-center font-medium">
            {isListening ? 'Listening...' : 
             isLoading ? 'Processing your request...' : 
             isSpeaking ? 'AI is responding...' : 
             message || 'AI Assistant Response'}
          </p>
          
          {/* Status indicator dot */}
          <div className="flex justify-center mt-2 desktop-mt-6">
            <div className={`h-2 w-2 rounded-full ${
              isListening ? 'bg-red-500 animate-pulse' : 
              isLoading ? 'bg-yellow-500 animate-pulse' : 
              isSpeaking ? 'bg-green-500 animate-pulse' : 
              hasApiError ? 'bg-red-500' :
              'bg-[#c4b5fd]'
            }`}></div>
          </div>
          
          {/* Fallback mode button - only show when there's an API error */}
          {hasApiError && !hasFallbackEnabled && (
            <div className="mt-3 desktop-mt-6 flex justify-center">
              <button 
                onClick={enableFallbackMode}
                className="bg-[#7e3af2] hover:bg-[#6d28d9] text-white text-sm px-3 py-1 rounded-lg transition-colors duration-200"
              >
                Enable Fallback Mode
              </button>
            </div>
          )}
        </div>
        
        {/* Email input with compact styling */}
        <div className="bg-[#6d28d9]/80 border border-[#8362d9] rounded-lg p-3 desktop-p-6 backdrop-blur-md w-full max-w-md">
          <p className="text-white text-center mb-3 desktop-mb-8">
            Ask the AI Assistant to email you the conversation.
          </p>
          <div className="flex items-center gap-2 desktop-gap-4">
            <input 
              id="email-input"
              type="email" 
              placeholder="Enter your email address" 
              className="flex-1 bg-[#7e3af2]/70 text-white border border-[#c4b5fd]/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#a78bda]/70"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
            <button 
              className="bg-[#7e3af2] hover:bg-[#8362d9] text-white px-3 py-2 rounded-lg transition-colors duration-200"
              onClick={handleEmailSubmit}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Hidden audio element for playback */}
      <audio 
        ref={audioRef} 
        className="hidden" 
        controls={false}
      />
    </main>
  );
}
