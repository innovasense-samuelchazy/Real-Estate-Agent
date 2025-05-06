"use client";

import { useState, useRef, useEffect } from 'react';
import MicrophoneButton from './components/MicrophoneButton';
import DynamicBackground from './components/DynamicBackground';
import ClientOnly from './components/ClientOnly';

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
  
  // Add this helper function to generate a random session ID
  const generateSessionId = (): string => {
    return 'session_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };
  
  const startListening = async () => {
    setIsListening(true);
    setMessage("I'm listening...");
    audioChunksRef.current = [];
    recordingStartTimeRef.current = Date.now();
    lastAudioTimestampRef.current = Date.now(); // Initialize last audio timestamp
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      
      // Set up audio analysis for silence detection
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Start silence detection
      startSilenceDetection();
      
      // Set up media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      console.log('Using MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
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
        
        // Clean up audio context resources
        if (analyserRef.current) {
          // Disconnect not needed as the mediaRecorder.stop() already stops the stream
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      console.log('MediaRecorder started');
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsListening(false);
      setMessage(`Error accessing microphone: ${error instanceof Error ? error.message : String(error)}`);
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
    if (isLoading || isSpeaking) return; // Don't do anything if loading or Lora is speaking
    
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

  const sendAudioToWebhook = async (audioBlob: Blob) => {
    setIsLoading(true);
    setMessage("Hold on a second, while I retrieve the information...");
    
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
      
      // Use our API endpoint
      const apiUrl = '/api/speech';
      console.log('Sending to API endpoint:', apiUrl);
      
      console.log('Sending request...');
      
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
          throw new Error(`API error! status: ${response.status}`);
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
          const jsonData = await response.json();
          console.log('API JSON response:', jsonData);
          
          if (jsonData.success) {
            setMessage(jsonData.message || "Your message has been processed successfully!");
          } else {
            setMessage(jsonData.error || "There was an error processing your message.");
          }
        }
        else {
          // Text or other response
          const textResponse = await response.text();
          console.log('API text response:', textResponse);
          setMessage("Response received. Thank you for your message.");
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        console.error('Error sending audio:', error);
        
        if (error instanceof DOMException && error.name === 'AbortError') {
          setMessage('Request took too long. The assistant is still processing your message in the background.');
        } else {
          setMessage('Error: ' + (error as Error).message);
        }
      }
    } catch (error) {
      console.error('Error preparing audio:', error);
      setMessage('Error preparing your message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to play audio response
  const playAudioResponse = (audioBlob: Blob, aiResponseText: string) => {
    // Create a URL for the blob
    const audioUrl = URL.createObjectURL(audioBlob);
    
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
      
      audioRef.current.onended = () => {
        // Update the message with the AI response when audio ends
        const responseText = audioRef.current?.dataset.aiResponse || aiResponseText || "";
        setMessage(responseText);
        
        // Clean up the blob URL
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false); // Set speaking state to false when audio ends
      };
      
      audioRef.current.onerror = (e) => {
        console.error('Audio element error:', e);
        setMessage("Error loading audio response");
        setIsSpeaking(false);
      };
      
      // Now set the source and attempt to play
      audioRef.current.src = audioUrl;
      setMessage("Lora is responding...");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-10 px-8 relative overflow-hidden">
      <ClientOnly>
        <DynamicBackground />
      </ClientOnly>
      
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-between h-full relative z-10 -mt-20">
        {/* Logo with enhanced size and subtle glow effect */}
        <div className="mb-8">
          <img 
            src="/images/innovasense-logo.png" 
            alt="InnovaSense" 
            className="h-40 w-auto filter drop-shadow-lg hover:drop-shadow-xl transition-all duration-300" 
          />
        </div>
        
        {/* Title */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#8362d9] mb-2">
            Real Estate AI Employee
          </h1>
          <p className="text-[#c4b5fd] text-lg">
            Dubai Rental AI Search
          </p>
        </div>
        
        {/* Microphone Button */}
        <div className="flex flex-col items-center justify-center mb-8">
          <button
            onClick={handleButtonClick}
            onMouseDown={() => setIsButtonPressed(true)}
            onMouseUp={() => setIsButtonPressed(false)}
            onMouseLeave={() => setIsButtonPressed(false)}
            onTouchStart={() => setIsButtonPressed(true)}
            onTouchEnd={() => setIsButtonPressed(false)}
            disabled={isLoading || isSpeaking}
            className={`w-16 h-16 rounded-full flex items-center justify-center focus:outline-none transition-all duration-300 ${
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
              className={`w-8 h-8 text-white transition-all ${isButtonPressed ? 'scale-90' : 'scale-100'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={isListening ? "M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" : "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"} 
              />
            </svg>
          </button>
          
          {/* Instruction Text - Updated to match UI elements */}
          {!isListening && !isLoading && !isSpeaking && (
            <div className="mt-4 px-4 py-2 rounded-lg bg-[#6d28d9]/90 backdrop-blur-sm">
              <p className="text-white font-medium text-sm md:text-base text-center">
                <span className="text-[#d8b4fe] font-bold">Click once</span> to start recording, <span className="text-[#d8b4fe] font-bold">click again</span> to stop and process
              </p>
            </div>
          )}
        </div>
        
        {/* AI Response Box */}
        <div className={`bg-[#6d28d9]/80 rounded-lg px-8 py-4 w-full max-w-sm mx-auto mb-8 backdrop-blur-sm transition-all duration-300 ${
          isListening ? 'border border-red-500/50 shadow-md shadow-red-500/20' : 
          isLoading ? 'border border-yellow-500/50 shadow-md shadow-yellow-500/20' : 
          isSpeaking ? 'border border-green-500/50 shadow-md shadow-green-500/20' : 
          'border border-[#8362d9]/50'
        }`}>
          <p className="text-white text-center font-medium">
            {isListening ? 'Listening...' : 
             isLoading ? 'Processing your request...' : 
             isSpeaking ? 'AI is responding...' : 
             message || 'AI Assistant Response'}
          </p>
          
          {/* Status indicator dot */}
          <div className="flex justify-center mt-2">
            <div className={`h-2 w-2 rounded-full ${
              isListening ? 'bg-red-500 animate-pulse' : 
              isLoading ? 'bg-yellow-500 animate-pulse' : 
              isSpeaking ? 'bg-green-500 animate-pulse' : 
              'bg-[#c4b5fd]'
            }`}></div>
          </div>
        </div>
        
        {/* Email input */}
        <div className="bg-[#6d28d9]/80 border border-[#8362d9] rounded-lg p-4 backdrop-blur-md w-full max-w-md mb-6">
          <p className="text-white text-center mb-4">
            Ask the AI Assistant to email you the conversation.
          </p>
          <div className="flex items-center gap-2">
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
      
      {/* Wave animation removed */}
      
      {/* Hidden audio element for playback */}
      <audio 
        ref={audioRef} 
        className="hidden" 
        controls={false}
      />
    </main>
  );
}
