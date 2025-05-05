'use client';

import { motion } from 'framer-motion';

interface WaveAnimationProps {
  isListening: boolean;
}

export default function WaveAnimation({ isListening }: WaveAnimationProps) {
  // Create more wave lines to match the image
  const waveCount = 12;
  const waves = Array.from({ length: waveCount }, (_, i) => i);
  
  // Colors that match our updated violet background
  const colors = [
    'bg-[#9966FF]',
    'bg-[#8A2BE2]',
    'bg-[#B19CD9]',
    'bg-[#7B68EE]',
    'bg-[#9370DB]'
  ];
  
  return (
    <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden">
      <div className="relative h-[300px]">
        {waves.map((i) => {
          const amplitude = 15 + i * 2;
          const period = 1 + i * 0.2;
          const phase = i * 0.5;
          const colorIndex = i % colors.length;
          
          return (
            <motion.div
              key={`wave-${i}`}
              className={`absolute bottom-0 left-0 right-0 h-[120px] ${colors[colorIndex]}/30`}
              style={{
                maskImage: `url("data:image/svg+xml;utf8,<svg viewBox='0 0 1200 120' xmlns='http://www.w3.org/2000/svg'><path d='M0,${60 + amplitude} C300,${60 - amplitude} 600,${60 + amplitude} 1200,${60 - amplitude}' fill='%23000'/></svg>")`,
                maskSize: `${1200 * period}px 120px`,
                maskRepeat: 'repeat-x',
                transform: `translateY(${i * 10}px)`,
              }}
              animate={{
                maskPosition: [`-${1200 * period}px 0px`, `0px 0px`],
              }}
              transition={{
                duration: 10 + i * 2,
                ease: "linear",
                repeat: Infinity,
                repeatType: "loop",
                delay: i * 0.2,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
