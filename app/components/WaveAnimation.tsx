'use client';

import { useEffect, useState, useRef } from 'react';

interface WaveAnimationProps {
  isListening: boolean;
}

interface Wave {
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
  color: string;
}

interface WavePoint {
  x: number;
  y: number;
}

export default function WaveAnimation({ isListening }: WaveAnimationProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    console.log('WaveAnimation component mounted (subtle waves version)');
    
    // Mark as loaded after component mounts in the browser
    setHasLoaded(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const updateDimensions = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // Center the waves in the vertical middle of the screen
    const numWaves = 5;
    const waves: Wave[] = [];
    for (let i = 0; i < numWaves; i++) {
      const speedFactor = isListening ? 1.5 : 1.0;
      waves.push({
        amplitude: 60 + i * 22, // Larger amplitude for more vertical spread
        frequency: 0.02 - i * 0.002,
        speed: (0.08 + i * 0.015) * speedFactor,
        phase: i * (Math.PI / 3),
        color: `rgba(139, 92, 246, ${0.35 - i * 0.05})`,
      });
    }
    
    // Gradient colors for fills between waves
    const gradientColors = [
      'rgba(139, 92, 246, 0.28)',
      'rgba(124, 58, 237, 0.22)',
      'rgba(109, 40, 217, 0.16)',
      'rgba(91, 33, 182, 0.12)',
    ];
    
    // Animation timestamp
    let timestamp = 0;
    
    // Animation function
    const animate = () => {
      if (!ctx || !canvas) return;
      
      // Clear canvas with transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Increment timestamp
      timestamp += 0.012;
      
      // Centered vertically
      const centerX = canvas.width / 2;
      // Place the center of the wave area at 50% of the screen height
      const centerY = canvas.height / 2;
      const waveAreaHeight = 220; // Height of the area the waves will occupy
      const waveWidth = Math.min(canvas.width * 0.7, 900);
      const startX = centerX - waveWidth / 2;
      const endX = centerX + waveWidth / 2;
      const waveSegments = 180;
      
      // Store wave points for filling between waves
      const wavePoints: WavePoint[][] = [];
      
      // Calculate all wave points (without drawing lines)
      for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
        const wave = waves[waveIndex];
        const points: WavePoint[] = [];
        
        // Create points for this wave
        for (let i = 0; i <= waveSegments; i++) {
          const x = startX + (i / waveSegments) * waveWidth;
          const xRatio = i / waveSegments; // 0 to 1 along the x-axis
          
          // Bell curve, but center the waves vertically in the area
          const amplitudeModifier = Math.sin(xRatio * Math.PI);
          
          // Offset each wave vertically so they are stacked and fill the area
          const yOffset = ((waveIndex - (numWaves - 1) / 2) / (numWaves - 1)) * waveAreaHeight;
          const y = centerY + yOffset + 
            Math.sin(xRatio * 10 + timestamp * wave.speed + wave.phase) * 
            wave.amplitude * amplitudeModifier;
          
          points.push({ x, y });
        }
        
        wavePoints.push(points);
      }
      
      // Fill areas between waves (from bottom to top for better layering)
      for (let i = wavePoints.length - 2; i >= 0; i--) {
        const currentWave = wavePoints[i];
        const nextWave = wavePoints[i + 1];
        
        if (currentWave && nextWave) {
          ctx.beginPath();
          
          // Start from the beginning of top wave
          ctx.moveTo(currentWave[0].x, currentWave[0].y);
          
          // Draw the top wave (current)
          for (let p = 0; p < currentWave.length; p++) {
            ctx.lineTo(currentWave[p].x, currentWave[p].y);
          }
          
          // Draw the bottom wave (next) in reverse
          for (let p = nextWave.length - 1; p >= 0; p--) {
            ctx.lineTo(nextWave[p].x, nextWave[p].y);
          }
          
          ctx.closePath();
          
          // Create a gradient fill for more dimension
          const gradient = ctx.createLinearGradient(
            startX, centerY, 
            endX, centerY
          );
          
          const colorBase = gradientColors[i % gradientColors.length];
          
          // Extract the color components from the rgba string
          const colorMatch = colorBase.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
          
          if (colorMatch) {
            const r = parseInt(colorMatch[1]);
            const g = parseInt(colorMatch[2]);
            const b = parseInt(colorMatch[3]);
            const a = parseFloat(colorMatch[4]);
            
            // Create a gradient with slightly varying opacity
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a * 0.9})`);
            gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${a})`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${a * 0.9})`);
            
            ctx.fillStyle = gradient;
          } else {
            // Fallback if regex fails
            ctx.fillStyle = colorBase;
          }
          
          ctx.fill();
        }
      }
      
      // Glow effect when listening
      if (isListening) {
        const pulseSize = 120 + Math.sin(timestamp * 3) * 30;
        const glowGradient = ctx.createRadialGradient(
          centerX, centerY, 0, 
          centerX, centerY, pulseSize
        );
        
        glowGradient.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
        glowGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();
      }
      
      // Request next frame
      animationRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening]);

  return (
    <>
      {hasLoaded && (
        <canvas 
          ref={canvasRef}
          className="fixed top-0 left-0 w-full h-full z-5 pointer-events-none"
          aria-hidden="true"
        />
      )}
    </>
  );
}
