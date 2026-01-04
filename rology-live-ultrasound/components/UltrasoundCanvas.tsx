import React, { useRef, useEffect } from 'react';

interface UltrasoundCanvasProps {
  gain: number;
  depth: number;
  frozen?: boolean;
}

const UltrasoundCanvas: React.FC<UltrasoundCanvasProps> = ({ gain, depth, frozen = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let offset = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Create the "Sector" clipping mask
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.arc(width / 2, 0, height - 10, 0.5, Math.PI - 0.5); // Fan shape
      ctx.lineTo(width / 2, 0);
      ctx.clip();

      // Generate Noise (The ultrasound tissue texture)
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;
      
      // Simulation parameters derived from props
      const brightness = gain * 2.5; // Gain controls brightness
      const density = 0.05 + (depth / 200); // Depth controls texture density slightly

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          
          // Simple procedural noise
          const noise = Math.random();
          // Simulate structure (bands)
          const structure = Math.sin((y + offset) * 0.05) * Math.cos((x) * 0.02);
          
          let value = (noise * brightness) + (structure * 40);
          
          // Falloff at edges of depth
          if (y > height * 0.8) value *= 0.5;

          data[index] = value;     // R
          data[index + 1] = value; // G
          data[index + 2] = value; // B
          data[index + 3] = 255;   // Alpha
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      ctx.restore();

      // Overlay Info
      ctx.fillStyle = '#06b6d4'; // Cyan
      ctx.font = '12px monospace';
      ctx.fillText(`MI: 0.7  TIS: 0.2`, 20, 30);
      ctx.fillText(`GAIN: ${gain}`, 20, 50);
      ctx.fillText(`DEPTH: ${depth}cm`, 20, 70);
      ctx.fillText(`FREQ: 4.5MHz`, width - 100, 30);
      
      // Moving Scan Line
      if (!frozen) {
        offset += 2; 
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gain, depth, frozen]);

  return (
    <canvas 
      ref={canvasRef} 
      width={640} 
      height={480} 
      className="w-full h-full object-contain bg-black border-2 border-slate-700 shadow-2xl rounded-sm"
    />
  );
};

export default UltrasoundCanvas;