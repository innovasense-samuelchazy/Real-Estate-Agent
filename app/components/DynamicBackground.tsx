'use client';

import React, { useEffect, useRef } from 'react';

export default function DynamicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    console.log('DynamicBackground component mounted');
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas to full window size
    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    // Force TypeScript to accept that canvas is not null inside this scope
    // since we've already checked it at the beginning of the useEffect
    const safeCanvas = canvas;
    
    // Particle class
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      
      constructor() {
        this.x = Math.random() * safeCanvas.width;
        this.y = Math.random() * safeCanvas.height;
        this.size = Math.random() * 3 + 0.5;
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 1 - 0.5;
        
        // Brighter indigo colors palette for better visibility
        const colors = [
          'rgba(93, 63, 211, 0.9)',   // #5d3fd3 - Mid indigo
          'rgba(126, 58, 242, 0.8)',   // #7e3af2 - Bright indigo
          'rgba(131, 98, 217, 0.7)',   // #8362d9 - Light indigo
          'rgba(196, 181, 253, 0.6)'   // #c4b5fd - Very light indigo
        ];
        
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }
      
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        // Bounce off edges
        if (this.x > safeCanvas.width || this.x < 0) {
          this.speedX = -this.speedX;
        }
        
        if (this.y > safeCanvas.height || this.y < 0) {
          this.speedY = -this.speedY;
        }
      }
      
      draw() {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Create particles
    const particles: Particle[] = [];
    const particleCount = Math.min(Math.floor(window.innerWidth * window.innerHeight / 8000), 150);
    
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
    
    // Animation loop
    const animate = () => {
      if (!ctx) return;
      
      // Create a gradient background with more vibrant colors
      const gradient = ctx.createLinearGradient(0, 0, 0, safeCanvas.height);
      // Brighter indigo gradient
      gradient.addColorStop(0, '#4c2889');  // Mid-dark indigo at the top
      gradient.addColorStop(1, '#7e3af2');  // Brighter indigo at the bottom
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, safeCanvas.width, safeCanvas.height);
      
      // Update and draw particles
      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });
      
      // Draw connections between particles
      connect();
      
      requestAnimationFrame(animate);
    };
    
    // Connect particles with lines if they're close enough
    function connect() {
      if (!ctx) return;
      
      const maxDistance = 150;
      
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Avoid drawing lines near the bottom of the screen
          const bottomEdgeBuffer = 300; // Don't draw lines in the bottom 300px (increased from 100px)
          const nearBottom = 
            particles[a].y > safeCanvas.height - bottomEdgeBuffer || 
            particles[b].y > safeCanvas.height - bottomEdgeBuffer;
            
          if (distance < maxDistance && !nearBottom) {
            // Set opacity based on distance - increased opacity for better visibility
            const opacity = 1 - (distance / maxDistance);
            ctx.strokeStyle = `rgba(214, 188, 250, ${opacity * 0.3})`;  // Brighter color with higher opacity
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    }
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full -z-10 opacity-100"
      aria-hidden="true"
      width={typeof window !== 'undefined' ? window.innerWidth : 1280}
      height={typeof window !== 'undefined' ? window.innerHeight : 720}
    />
  );
} 