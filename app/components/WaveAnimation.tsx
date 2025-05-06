'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface WaveAnimationProps {
  isListening: boolean;
}

export default function WaveAnimation({ isListening }: WaveAnimationProps) {
  // Add console log to confirm component renders
  useEffect(() => {
    console.log('WaveAnimation component mounted');
  }, []);

  // Create fewer wave lines to be less distracting
  const waveCount = 6; // Reduced from 12
  const waves = Array.from({ length: waveCount }, (_, i) => i);
  
  // Colors that match our lighter indigo theme
  const colors = [
    'bg-[#8362d9]', // Lighter indigo
    'bg-[#7e3af2]', // Main lighter indigo
    'bg-[#a78bda]', // Soft indigo
    'bg-[#c4b5fd]', // Pale indigo
    'bg-[#d8b4fe]', // Light lavender
    'bg-[#9370db]'  // Medium purple
  ];
  
  return (
    <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden z-0">
      <div className="relative h-[200px]"> {/* Reduced height */}
        {waves.map((i) => {
          const amplitude = 10 + i * 2; // Reduced amplitude
          const period = 0.8 + i * 0.2; // Adjusted period
          const height = 8 + i * 2; // Reduced height
          const width = 1800 + i * 30;
          const color = colors[i % colors.length];
          const delay = i * 0.15;
          
          return (
            <motion.div
              key={i}
              className={`absolute bottom-0 left-1/2 ${color} opacity-30 rounded-t-[100%]`} // Increased opacity for better visibility
              style={{
                height: `${height}px`,
                width: `${width}px`,
                marginLeft: `-${width / 2}px`
              }}
              animate={{
                y: [0, -amplitude, 0], // Smaller movements
                scaleX: [1, 1 + period * 0.008, 1], // Reduced scale changes
                opacity: isListening ? [0.3, 0.4, 0.3] : [0.2, 0.3, 0.2] // Increased opacity
              }}
              transition={{
                repeat: Infinity,
                duration: 4 + period, // Slower animation
                ease: "easeInOut",
                delay: delay
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
