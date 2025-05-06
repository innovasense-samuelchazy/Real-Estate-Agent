'use client';

import { motion } from 'framer-motion';

interface WaveAnimationProps {
  isListening: boolean;
}

export default function WaveAnimation({ isListening }: WaveAnimationProps) {
  // Create minimal audio bars
  const leftBars = Array.from({ length: 5 }, (_, i) => i);
  const rightBars = Array.from({ length: 5 }, (_, i) => i);
  
  // Simple purple colors
  const colors = [
    'bg-[#9966FF]', // Purple
    'bg-[#8A7ED9]', // Lavender
  ];
  
  return (
    <div className="relative flex items-center justify-center gap-1 mt-3 mb-1">
      {/* Left side bars */}
      <div className="flex items-end gap-[1px]">
        {leftBars.map((i) => {
          const baseHeight = 2 + i * 1.5;
          const colorIndex = i % colors.length;
          
          // Simple subtle animations
          const randomHeight1 = baseHeight + 3 + Math.random() * 3;
          const randomHeight2 = baseHeight + 2 + Math.random() * 2;
          
          // Randomize animation durations and delays
          const duration = isListening ? 0.9 + Math.random() * 0.3 : 0;
          const delay = i * 0.06;
          
          return (
            <motion.div
              key={`left-bar-${i}`}
              className={`w-[1px] ${colors[colorIndex]} rounded-full opacity-40`}
              initial={{ height: baseHeight }}
              animate={{ 
                height: isListening 
                  ? [
                      `${baseHeight}px`,
                      `${randomHeight1}px`,
                      `${randomHeight2}px`,
                      `${baseHeight + 2}px`,
                      `${baseHeight}px`
                    ] 
                  : `${baseHeight}px`,
                opacity: isListening ? [0.4, 0.5, 0.4, 0.5, 0.4] : 0.4,
              }}
              transition={{
                duration,
                repeat: Infinity,
                delay,
                ease: "easeInOut"
              }}
            />
          );
        })}
      </div>
      
      {/* Center gap for microphone */}
      <div className="w-14 h-14 flex items-center justify-center">
        {/* Placeholder for microphone button */}
      </div>
      
      {/* Right side bars */}
      <div className="flex items-end gap-[1px]">
        {rightBars.map((i) => {
          const baseHeight = 2 + i * 1.5;
          const colorIndex = i % colors.length;
          
          // Simple subtle animations
          const randomHeight1 = baseHeight + 3 + Math.random() * 3;
          const randomHeight2 = baseHeight + 2 + Math.random() * 2;
          
          // Randomize animation durations and delays
          const duration = isListening ? 0.9 + Math.random() * 0.3 : 0;
          const delay = i * 0.06;
          
          return (
            <motion.div
              key={`right-bar-${i}`}
              className={`w-[1px] ${colors[colorIndex]} rounded-full opacity-40`}
              initial={{ height: baseHeight }}
              animate={{ 
                height: isListening 
                  ? [
                      `${baseHeight}px`,
                      `${randomHeight1}px`,
                      `${randomHeight2}px`,
                      `${baseHeight + 2}px`,
                      `${baseHeight}px`
                    ] 
                  : `${baseHeight}px`,
                opacity: isListening ? [0.4, 0.5, 0.4, 0.5, 0.4] : 0.4,
              }}
              transition={{
                duration,
                repeat: Infinity,
                delay,
                ease: "easeInOut"
              }}
            />
          );
        })}
      </div>
      
      {/* Minimal glow effect - only visible when listening */}
      {isListening && (
        <motion.div 
          className="absolute w-24 h-24 rounded-full bg-gradient-to-r from-[#9966FF]/5 to-[#8A7ED9]/5 blur-md"
          animate={{
            scale: [1, 1.03, 1, 1.05, 1],
            opacity: [0.05, 0.1, 0.05, 0.1, 0.05]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </div>
  );
}
