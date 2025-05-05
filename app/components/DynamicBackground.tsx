'use client';

import React, { useEffect, useRef } from 'react';

const DynamicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas to full screen
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Wave parameters - Adjusted for oscillating motion
    const waves = [
      { color: '#9966FF', amplitude: 60, frequency: 0.01, speed: 0.5, offset: 0, phase: 0 },
      { color: '#8A2BE2', amplitude: 80, frequency: 0.008, speed: 0.4, offset: 2, phase: Math.PI / 4 },
      { color: '#B19CD9', amplitude: 50, frequency: 0.012, speed: 0.6, offset: 4, phase: Math.PI / 2 },
      { color: '#7B68EE', amplitude: 40, frequency: 0.015, speed: 0.45, offset: 6, phase: Math.PI * 3 / 4 },
      { color: '#9370DB', amplitude: 45, frequency: 0.009, speed: 0.55, offset: 8, phase: Math.PI },
    ];
    
    // Particle system for subtle background animation
    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      color: waves[Math.floor(Math.random() * waves.length)].color,
      speed: Math.random() * 0.5 + 0.1,
      direction: Math.random() * Math.PI * 2,
      pulse: Math.random() * 0.5 + 0.5
    }));
    
    let animationFrameId: number;
    let time = 0;
    
    const animate = () => {
      time += 0.05;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background with violet gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#0A0A20'); // Dark blue-black at top
      bgGradient.addColorStop(0.4, '#1A0A2E'); // Dark violet
      bgGradient.addColorStop(1, '#3A1A5E'); // Deeper violet at bottom
      
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw subtle stars/particles with pulsing effect
      particles.forEach(particle => {
        // Pulsing size effect
        const pulsingRadius = particle.radius * (1 + 0.3 * Math.sin(time * particle.pulse));
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, pulsingRadius, 0, Math.PI * 2);
        
        // Pulsing opacity
        const opacity = 0.2 + 0.2 * Math.sin(time * particle.pulse);
        ctx.fillStyle = particle.color + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
        
        // Move particles in a slightly wavy pattern
        particle.x += Math.cos(particle.direction) * particle.speed;
        particle.y += Math.sin(particle.direction + Math.sin(time * 0.2) * 0.2) * particle.speed;
        
        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
      });
      
      // Draw each wave with oscillating motion
      waves.forEach((wave, index) => {
        ctx.beginPath();
        
        // Start at the left edge, at the vertical center plus some offset based on the wave index
        const startY = canvas.height / 2 + (index * 20);
        ctx.moveTo(0, startY);
        
        // Draw wave path with oscillating motion
        for (let x = 0; x < canvas.width; x += 5) {
          // Use time for oscillation rather than horizontal movement
          const y = startY + 
            Math.sin(x * wave.frequency + wave.phase) * wave.amplitude * Math.sin(time * wave.speed) + 
            Math.sin(x * wave.frequency * 2 + wave.phase * 1.5) * (wave.amplitude * 0.3) * Math.sin(time * wave.speed * 1.3);
          
          ctx.lineTo(x, y);
        }
        
        // Complete the wave path
        ctx.lineTo(canvas.width, startY);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        
        // Create gradient for wave with violet tones
        const gradient = ctx.createLinearGradient(0, startY, 0, canvas.height);
        gradient.addColorStop(0, wave.color + '33'); // 20% opacity
        gradient.addColorStop(0.5, wave.color + 'AA'); // 66% opacity
        gradient.addColorStop(1, '#4B0082' + '66'); // Indigo with 40% opacity
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw the wave line with glow effect
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Add glow effect
        ctx.shadowColor = wave.color;
        ctx.shadowBlur = 10 + 5 * Math.sin(time * 0.5 + index); // Pulsing glow
        ctx.strokeStyle = wave.color + '80'; // 50% opacity
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full -z-10"
    />
  );
};

export default DynamicBackground; 