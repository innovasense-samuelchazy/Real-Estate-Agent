'use client';

import React from 'react';

interface MicrophoneButtonProps {
  isListening: boolean;
  isLoading: boolean;
  isPressed?: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
}

const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({
  isListening,
  isLoading,
  isPressed = false,
  onMouseDown,
  onMouseUp,
  onTouchStart,
  onTouchEnd
}) => {
  return (
    <button
      className={`relative w-16 h-16 rounded-full flex items-center justify-center focus:outline-none transition-all duration-300 ${
        isListening 
          ? 'bg-red-500 shadow-lg shadow-red-500/50' 
          : isPressed
            ? 'bg-violet-700 shadow-lg shadow-violet-600/50 scale-95' // Pressed state
            : 'bg-violet-600 shadow-lg shadow-violet-500/50'
      }`}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp} // Also handle mouse leaving the button
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      disabled={isLoading}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : isListening ? (
        // Stop icon (square)
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="white">
          <rect x="6" y="6" width="8" height="8" />
        </svg>
      ) : (
        // Microphone icon
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )}
      
      {/* Pulsing effect when listening */}
      {isListening && (
        <div className="absolute w-full h-full rounded-full bg-red-500 animate-ping opacity-50"></div>
      )}
    </button>
  );
};

export default MicrophoneButton;
