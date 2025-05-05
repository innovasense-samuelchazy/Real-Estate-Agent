'use client';

import { useState, useRef, useCallback } from 'react';

// Try to import lamejs, but make it optional
let lamejs: any;
try {
  // Using dynamic import to avoid build errors
  // This will be properly handled at runtime
  lamejs = null; // Will be initialized later if needed
} catch (error) {
  console.warn('lamejs module not available, MP3 encoding will not be supported');
}

interface AudioRecorderProps {
  onAudioData: (blob: Blob) => void;
  onSilence?: () => void;
  silenceDuration?: number;
  audioRef?: React.RefObject<HTMLAudioElement>;
}

export function useAudioRecorder({
  onAudioData,
  onSilence,
  silenceDuration = 3000,
  audioRef,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startRecording = useCallback(async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const options = { mimeType: 'audio/webm' };
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Reset silence timeout when data is received
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }
          
          // Set a new silence timeout
          if (onSilence) {
            silenceTimeoutRef.current = setTimeout(() => {
              onSilence();
            }, silenceDuration);
          }
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert WebM to MP3 using a server-side API if needed
        // For now, we'll send the WebM file and let n8n handle the conversion
        sendAudioToWebhook(audioBlob);
        
        // Stop all audio tracks
        streamRef.current?.getTracks().forEach(track => track.stop());
        
        // Clear silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Set initial silence timeout
      if (onSilence) {
        silenceTimeoutRef.current = setTimeout(() => {
          onSilence();
        }, silenceDuration);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      setMessage('Error starting recording: ' + (error as Error).message);
    }
  }, [onAudioData, onSilence, silenceDuration]);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    }
  }, [isRecording]);
  
  const sendAudioToWebhook = async (audioBlob: Blob) => {
    setIsLoading(true);
    setMessage("Processing your message...");
    
    try {
      console.log('Sending audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      // Log the webhook URL (without sensitive info)
      console.log('Sending to webhook URL:', process.env.NEXT_PUBLIC_WEBHOOK_URL ? 'URL configured' : 'URL missing');
      
      const response = await fetch(process.env.NEXT_PUBLIC_WEBHOOK_URL || '', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Response status:', response.status);
      
      // Check if the response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get all headers as an object for easier debugging
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      console.log('Headers as object:', headers);
      
      // Try to get user input and AI response from headers
      // Check for common header naming conventions
      const userInput = 
        headers['x-user-input'] || 
        headers['user-input'] || 
        headers['x-user-query'] || 
        'User audio message';
        
      const aiResponse = 
        headers['x-ai-response'] || 
        headers['ai-response'] || 
        headers['x-assistant-response'] || 
        'Click & hold the microphone to start recording';
      
      console.log('Extracted from headers:', { userInput, aiResponse });
      
      // Get content type to determine how to handle the response body
      const contentType = headers['content-type'] || '';
      console.log('Content type:', contentType);
      
      // Handle audio response (binary data)
      if (contentType.includes('audio/')) {
        console.log('Processing audio response');
        const audioBlob = await response.blob();
        console.log('Received audio blob:', {
          size: audioBlob.size,
          type: audioBlob.type
        });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Play the audio and update conversation
        playAudioAndUpdateConversation(audioUrl, userInput, aiResponse);
      }
      // Handle JSON response
      else if (contentType.includes('application/json')) {
        console.log('Processing JSON response');
        const jsonData = await response.json();
        console.log('JSON data:', jsonData);
        
        // Check if we have a base64 audio file in the response
        if (jsonData.audio_file) {
          console.log('Found base64 audio in JSON');
          try {
            const audioUrl = processBase64Audio(jsonData.audio_file);
            
            // Play the audio and update conversation
            playAudioAndUpdateConversation(audioUrl, userInput, aiResponse);
          } catch (error) {
            console.error('Error processing base64 audio:', error);
            setMessage("Error processing audio data");
            
            // Still update conversation even if audio fails
            updateConversationHistory(userInput, aiResponse);
          }
        } else {
          // Handle regular JSON response without audio
          console.log('No audio in JSON response');
          setMessage(`Response: ${aiResponse}`);
          updateConversationHistory(userInput, aiResponse);
        }
      }
      // Handle text response
      else {
        console.log('Processing text response');
        const textResponse = await response.text();
        console.log('Text response:', textResponse);
        
        setMessage(`Response: ${aiResponse || textResponse}`);
        updateConversationHistory(userInput, aiResponse || textResponse);
      }
    } catch (error) {
      console.error('Error sending audio:', error);
      setMessage('Error: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to process base64 audio
  const processBase64Audio = (base64Data: string): string => {
    // Check if the base64 string includes the data URL prefix
    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    // Create a blob from the base64 data
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], { type: 'audio/mp3' });
    
    // Create a URL for the blob
    return URL.createObjectURL(audioBlob);
  };
  
  // Helper function to play audio and update conversation
  const playAudioAndUpdateConversation = (audioUrl: string, userInput: string, aiResponse: string) => {
    if (audioRef?.current) {
      // Set up event listeners before setting the source
      audioRef.current.onloadedmetadata = () => {
        console.log('Audio metadata loaded, attempting to play');
        audioRef.current?.play().catch((err: Error) => {
          console.error('Error playing audio:', err);
          setMessage("Error playing audio response: " + err.message);
        });
      };
      
      audioRef.current.onended = () => {
        console.log('Audio playback ended');
        setMessage("Hello, I am Lora, your AI assistant. Click & hold the microphone to start recording");
        // Clean up the blob URL
        URL.revokeObjectURL(audioUrl);
      };
      
      audioRef.current.onerror = () => {
        console.error('Audio error occurred');
        setMessage("Error playing audio");
      };
      
      // Now set the source and attempt to play
      audioRef.current.src = audioUrl;
    } else {
      console.warn('Audio element reference not available');
      setMessage(aiResponse);
    }
    
    // Update conversation history regardless of audio playback
    updateConversationHistory(userInput, aiResponse);
  };
  
  // Helper function to update conversation history
  const updateConversationHistory = (userInput: string, aiResponse: string) => {
    console.log('Conversation updated:', { userInput, aiResponse });
    // If you need to implement actual conversation history, you would do it here
  };
  
  // Function to convert audio blob to MP3
  const convertToMp3 = async (audioBlob: Blob): Promise<Blob> => {
    // This is a simplified approach - for a production app, you might want a more robust solution
    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioData = new Float32Array(arrayBuffer);
      
      // Set up MP3 encoder
      const mp3encoder = new lamejs.Mp3Encoder(1, 44100, 128); // mono, 44.1kHz, 128kbps
      
      // Process the audio data in chunks
      const sampleBlockSize = 1152; // Must be a multiple of 576 for MP3
      const mp3Data = [];
      
      for (let i = 0; i < audioData.length; i += sampleBlockSize) {
        const sampleChunk = audioData.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      // Get the last chunk of MP3 data
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      // Combine all MP3 chunks into a single blob
      const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
      return mp3Blob;
    } catch (error) {
      console.error('Error converting to MP3:', error);
      // If conversion fails, return the original blob
      return audioBlob;
    }
  };
  
  return {
    isRecording,
    startRecording,
    stopRecording,
    message,
    isLoading,
  };
}
