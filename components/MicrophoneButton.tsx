import React from 'react';

interface MicrophoneButtonProps {
  isListening: boolean;
  isLoading: boolean;
  isSpeaking: boolean;
  onClick: () => void;
}

const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({
  isListening,
  isLoading,
  isSpeaking,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || isSpeaking}
      className={`w-20 h-20 rounded-full relative overflow-hidden ${
        isListening 
          ? 'bg-[#8A2BE2]/80 shadow-lg shadow-[#8A2BE2]/50 border border-[#B19CD9]/50 scale-110' 
          : isSpeaking || isLoading
              ? 'bg-[#9966FF]/40 shadow-lg shadow-[#9966FF]/30 border border-[#B19CD9]/30 opacity-50 cursor-not-allowed'
              : 'bg-[#9966FF]/70 shadow-lg shadow-[#9966FF]/50 border border-[#B19CD9]/50 hover:scale-105'
      }`}
    >
      {/* Simple centered content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : isListening ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="white">
            <rect x="6" y="6" width="8" height="8" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </div>
      
      {/* Pulsing effect when listening */}
      {isListening && (
        <div className="absolute inset-0 animate-ping-slow bg-[#8A2BE2]/30"></div>
      )}
    </button>
  );
};

export default MicrophoneButton; 