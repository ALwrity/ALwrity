import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  IconButton,
  Slider,
  Button,
  Chip,
  Tooltip,
} from '@mui/material';
import Brush from '@mui/icons-material/Brush';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Clear from '@mui/icons-material/Clear';
import ZoomIn from '@mui/icons-material/ZoomIn';
import ZoomOut from '@mui/icons-material/ZoomOut';
import Undo from '@mui/icons-material/Undo';
import { alpha } from '@mui/material/styles';

interface ImageMaskEditorProps {
  baseImage: string | null;
  maskImage: string | null;
  onMaskChange: (maskBase64: string | null) => void;
  onClose?: () => void;
}

type BrushMode = 'paint' | 'erase';

export const ImageMaskEditor: React.FC<ImageMaskEditorProps> = ({
  baseImage,
  maskImage,
  onMaskChange,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushMode, setBrushMode] = useState<BrushMode>('paint');
  const [brushSize, setBrushSize] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize canvases
  useEffect(() => {
    if (!baseImage || !canvasRef.current || !maskCanvasRef.current) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      
      // Set canvas sizes to match image
      canvas.width = img.width;
      canvas.height = img.height;
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
      
      // Draw base image on display canvas
      ctx.drawImage(img, 0, 0);
      
      // Initialize mask canvas (black = preserve, white = edit)
      maskCtx.fillStyle = '#000000';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      // If existing mask, load it
      if (maskImage) {
        const maskImg = new Image();
        maskImg.onload = () => {
          maskCtx.drawImage(maskImg, 0, 0);
          // Redraw display
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < maskData.data.length; i += 4) {
            const maskValue = maskData.data[i];
            if (maskValue > 128) {
              imageData.data[i] = Math.min(255, imageData.data[i] * 0.7 + 255 * 0.3);
              imageData.data[i + 1] = imageData.data[i + 1] * 0.7;
              imageData.data[i + 2] = imageData.data[i + 2] * 0.7;
            }
          }
          ctx.putImageData(imageData, 0, 0);
          
          // Save initial state to history
          const imageDataForHistory = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          setHistory([imageDataForHistory]);
          setHistoryIndex(0);
        };
        maskImg.src = maskImage;
      } else {
        // Redraw display
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Save initial state to history
        const imageDataForHistory = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        setHistory([imageDataForHistory]);
        setHistoryIndex(0);
      }
    };
    img.src = baseImage;
  }, [baseImage, maskImage]);

  const redraw = useCallback(() => {
    if (!canvasRef.current || !maskCanvasRef.current || !imageRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const maskCtx = maskCanvasRef.current.getContext('2d');
    if (!ctx || !maskCtx) return;

    // Draw base image
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(imageRef.current, 0, 0);
    
    // Overlay mask as red tint (white areas in mask = red overlay)
    const maskData = maskCtx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    for (let i = 0; i < maskData.data.length; i += 4) {
      const maskValue = maskData.data[i]; // Grayscale value
      if (maskValue > 128) { // White area = masked (to be edited)
        // Apply red overlay
        imageData.data[i] = Math.min(255, imageData.data[i] * 0.7 + 255 * 0.3); // Red tint
        imageData.data[i + 1] = imageData.data[i + 1] * 0.7; // Reduce green
        imageData.data[i + 2] = imageData.data[i + 2] * 0.7; // Reduce blue
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const saveHistory = useCallback(() => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0 || !maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const prevIndex = historyIndex - 1;
    ctx.putImageData(history[prevIndex], 0, 0);
    setHistoryIndex(prevIndex);
    redraw();
  }, [history, historyIndex, redraw]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
    
    if (clientX === undefined || clientY === undefined) return null;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const draw = useCallback((x: number, y: number) => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = brushMode === 'paint' ? 'source-over' : 'destination-out';
    ctx.fillStyle = brushMode === 'paint' ? '#ffffff' : '#000000';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    redraw();
  }, [brushMode, brushSize, redraw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    draw(coords.x, coords.y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    draw(coords.x, coords.y);
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistory();
      exportMask();
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    draw(coords.x, coords.y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    draw(coords.x, coords.y);
  };

  const handleTouchEnd = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistory();
      exportMask();
    }
  };

  const exportMask = useCallback(() => {
    if (!maskCanvasRef.current) return;
    
    const maskBase64 = maskCanvasRef.current.toDataURL('image/png');
    onMaskChange(maskBase64);
  }, [onMaskChange]);

  const clearMask = () => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    redraw();
    saveHistory();
    onMaskChange(null);
  };

  if (!baseImage) {
    return (
      <Paper
        sx={{
          p: 3,
          textAlign: 'center',
          background: alpha('#0f172a', 0.7),
          border: '1px dashed rgba(255,255,255,0.2)',
        }}
      >
        <Typography color="text.secondary">
          Upload an image first to create a mask
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        background: alpha('#0f172a', 0.8),
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Stack spacing={2} p={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={700}>
            Mask Editor
          </Typography>
          {onClose && (
            <IconButton size="small" onClick={onClose}>
              <Clear fontSize="small" />
            </IconButton>
          )}
        </Stack>

        {/* Toolbar */}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Tooltip title="Paint (add to mask)">
            <IconButton
              size="small"
              onClick={() => setBrushMode('paint')}
              sx={{
                bgcolor: brushMode === 'paint' ? alpha('#667eea', 0.2) : 'transparent',
              }}
            >
              <Brush fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Erase (remove from mask)">
            <IconButton
              size="small"
              onClick={() => setBrushMode('erase')}
              sx={{
                bgcolor: brushMode === 'erase' ? alpha('#667eea', 0.2) : 'transparent',
              }}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ width: 100, mx: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Size: {brushSize}px
            </Typography>
            <Slider
              size="small"
              value={brushSize}
              onChange={(_, value) => setBrushSize(value as number)}
              min={5}
              max={100}
              step={5}
            />
          </Box>
          <Tooltip title="Undo">
            <IconButton size="small" onClick={undo} disabled={historyIndex <= 0}>
              <Undo fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear mask">
            <IconButton size="small" onClick={clearMask}>
              <Clear fontSize="small" />
            </IconButton>
          </Tooltip>
          <Chip
            size="small"
            label={brushMode === 'paint' ? 'Paint Mode' : 'Erase Mode'}
            sx={{ ml: 'auto' }}
          />
        </Stack>

        {/* Canvas Container */}
        <Box
          sx={{
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflow: 'auto',
            maxHeight: '60vh',
            background: '#000',
          }}
        >
          <Box
            sx={{
              display: 'inline-block',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                display: 'block',
                cursor: brushMode === 'paint' ? 'crosshair' : 'grab',
                maxWidth: '100%',
                height: 'auto',
              }}
            />
            {/* Hidden mask canvas */}
            <canvas ref={maskCanvasRef} style={{ display: 'none' }} />
          </Box>
        </Box>

        {/* Zoom Controls */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton size="small" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
            <ZoomOut fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ minWidth: 60, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton size="small" onClick={() => setZoom(Math.min(2, zoom + 0.25))}>
            <ZoomIn fontSize="small" />
          </IconButton>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setZoom(1)}
            sx={{ ml: 'auto' }}
          >
            Reset Zoom
          </Button>
        </Stack>

        {/* Instructions */}
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          💡 Tip: Paint areas you want to edit (shown in red overlay). White areas in the mask
          will be modified, black areas will be preserved.
        </Typography>
      </Stack>
    </Paper>
  );
};
