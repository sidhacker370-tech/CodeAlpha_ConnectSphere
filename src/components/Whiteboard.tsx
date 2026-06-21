import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Pencil, Eraser, Trash2 } from 'lucide-react';
import { type Socket } from 'socket.io-client';

interface WhiteboardProps {
  socket: Socket | null;
  sendDrawingStroke: (stroke: any) => void;
  sendClearDrawing: () => void;
}

interface StrokeData {
  prevX: number;
  prevY: number;
  currX: number;
  currY: number;
  color: string;
  size: number;
}

const BRUSH_SIZES = [2, 5, 10, 15, 20];
const BRUSH_COLORS = [
  '#ffffff', // White
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ef4444', // Red
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#eab308', // Yellow
];

const CANVAS_BACKGROUND = '#09090b';

export const Whiteboard = ({ socket, sendDrawingStroke, sendClearDrawing }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#6366f1');
  const [size, setSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  
  const lastX = useRef(0);
  const lastY = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = CANVAS_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleDrawLine = (stroke: StrokeData) => {
      drawLineOnCanvas(stroke.prevX, stroke.prevY, stroke.currX, stroke.currY, stroke.color, stroke.size);
    };

    const handleClearCanvas = () => {
      clearCanvasLocal();
    };

    socket.on('draw-line', handleDrawLine);
    socket.on('clear-canvas', handleClearCanvas);

    return () => {
      socket.off('draw-line', handleDrawLine);
      socket.off('clear-canvas', handleClearCanvas);
    };
  }, [socket]);

  const drawLineOnCanvas = (
    prevX: number,
    prevY: number,
    currX: number,
    currY: number,
    strokeColor: string,
    strokeSize: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
    ctx.closePath();
  };

  const getCoordinates = (e: MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    
    setIsDrawing(true);
    lastX.current = coords.x;
    lastY.current = coords.y;
  };

  const draw = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const activeColor = isEraser ? CANVAS_BACKGROUND : color;

    // Draw locally
    drawLineOnCanvas(lastX.current, lastY.current, coords.x, coords.y, activeColor, size);

    // Emit to socket
    sendDrawingStroke({
      prevX: lastX.current,
      prevY: lastY.current,
      currX: coords.x,
      currY: coords.y,
      color: activeColor,
      size,
    });

    lastX.current = coords.x;
    lastY.current = coords.y;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = CANVAS_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearBoard = () => {
    clearCanvasLocal();
    sendClearDrawing();
  };

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl bg-gray-950/60 border border-gray-900 shadow-xl max-w-full">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-gray-900/40 rounded-xl border border-gray-800/50">
        <div className="flex items-center gap-3">
          {/* Pencil & Eraser */}
          <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-850">
            <button
              onClick={() => setIsEraser(false)}
              className={`p-2 rounded-md transition ${!isEraser ? 'bg-brand-indigo text-white shadow' : 'text-gray-400 hover:text-white'}`}
              title="Pencil"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsEraser(true)}
              className={`p-2 rounded-md transition ${isEraser ? 'bg-brand-indigo text-white shadow' : 'text-gray-400 hover:text-white'}`}
              title="Eraser"
            >
              <Eraser className="h-4 w-4" />
            </button>
          </div>

          {/* Size Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-semibold mr-1">SIZE:</span>
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`flex items-center justify-center rounded-md font-semibold transition ${size === s ? 'bg-gray-800 text-brand-indigo border border-brand-indigo/35' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
                style={{ width: '28px', height: '28px', fontSize: '11px' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette (disabled in eraser mode) */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 p-1 rounded-lg ${isEraser ? 'opacity-40 pointer-events-none' : ''}`}>
            {BRUSH_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border transition active:scale-95 ${color === c ? 'border-white scale-110 shadow-lg shadow-indigo-500/20' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Clear screen */}
          <button
            onClick={handleClearBoard}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-semibold hover:bg-red-500/10 hover:border-red-500/40 transition duration-150"
            title="Clear Board"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border border-gray-900 rounded-xl overflow-hidden shadow-inner bg-zinc-950 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="canvas-cursor w-full h-auto bg-zinc-950 max-h-[60vh] object-contain block"
        />
      </div>
    </div>
  );
};

export default Whiteboard;
