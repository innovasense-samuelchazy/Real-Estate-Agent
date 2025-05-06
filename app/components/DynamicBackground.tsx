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
    
    // Simple elegant wave colors with purple theme
    const waveColors = [
      { color: '#9966FF', opacity: 0.15 }, // Main purple
      { color: '#8A2BE2', opacity: 0.1 }, // Secondary purple
    ];
    
    // Subtle particle colors
    const particleColors = [
      '#9966FF', // Purple
      '#8A7ED9', // Lavender
      '#A89AE0', // Light purple
    ];
    
    // Very minimal particles, mostly near center
    const particles = Array.from({ length: 15 }, () => {
      // Concentrate particles in center horizontal band
      const centerBiasX = Math.random() * canvas.width;
      const centerBiasY = canvas.height * 0.5 + (Math.random() - 0.5) * canvas.height * 0.2;
        
      return {
        x: centerBiasX,
        y: centerBiasY,
        radius: Math.random() * 1 + 0.2,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        speed: Math.random() * 0.15 + 0.05,
        pulse: Math.random() * 0.2 + 0.1
      };
    });
    
    let animationFrameId: number;
    let time = 0;
    
    const animate = () => {
      time += 0.01;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background with subtle gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#1A0A2E'); // Dark violet
      bgGradient.addColorStop(0.5, '#2A1A4E'); // Medium violet
      bgGradient.addColorStop(1, '#3A2A5E'); // Light violet at bottom
      
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw minimal particles
      particles.forEach(particle => {
        // Very subtle pulsing
        const pulsingRadius = particle.radius * (1 + 0.05 * Math.sin(time * particle.pulse));
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, pulsingRadius, 0, Math.PI * 2);
        
        // Very low opacity
        const opacity = 0.05 + 0.05 * Math.sin(time * particle.pulse);
        ctx.fillStyle = particle.color + Math.floor(opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
        
        // Barely visible glow
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 1;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Slow horizontal movement
        particle.x += particle.speed * 0.2;
        
        // Wrap around edges
        if (particle.x > canvas.width) particle.x = 0;
      });
      
      // Draw a single elegant horizontal wave across the center
      const waveY = canvas.height * 0.5; // Center of screen
      const waveHeight = canvas.height * 0.06; // Height of wave area
      const waveWidth = canvas.width;
      
      // Draw two overlapping waves for depth
      waveColors.forEach((waveColor, wIndex) => {
        const amplitude = waveHeight * (wIndex === 0 ? 1 : 0.6);
        const frequency = 0.003 * (wIndex === 0 ? 1 : 1.5);
        const speed = 0.2 * (wIndex === 0 ? 1 : 1.2);
        const yOffset = wIndex === 0 ? 0 : waveHeight * 0.2;
        
        ctx.beginPath();
        
        // Create a smooth path from left to right
        ctx.moveTo(0, waveY + yOffset);
        
        // Draw wave with finer points for smoother appearance
        for (let x = 0; x < waveWidth; x += 1) {
          // Create flowing motion
          const flowX = x + time * 30 * speed;
          
          // Calculate smooth wave with subtle secondary motion
          const y = waveY + yOffset + 
                  Math.sin(flowX * frequency) * amplitude * 0.7 + 
                  Math.sin(flowX * frequency * 2) * amplitude * 0.3;
          
          ctx.lineTo(x, y);
        }
        
        // Complete the path for fill
        ctx.lineTo(waveWidth, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        
        // Create very subtle gradient for wave
        const gradient = ctx.createLinearGradient(0, waveY - amplitude, 0, waveY + amplitude);
        gradient.addColorStop(0, waveColor.color + '05'); // Almost invisible at top
        gradient.addColorStop(0.5, waveColor.color + Math.floor(waveColor.opacity * 255).toString(16).padStart(2, '0')); // Main color in middle  
        gradient.addColorStop(1, waveColor.color + '02'); // Almost invisible at bottom
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw extremely thin wave line
        ctx.strokeStyle = waveColor.color + '20'; // Very low opacity
        ctx.lineWidth = 0.3;
        ctx.stroke();
        
        // Add very subtle glow
        ctx.shadowColor = waveColor.color;
        ctx.shadowBlur = 2;
        ctx.strokeStyle = waveColor.color + '15';
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