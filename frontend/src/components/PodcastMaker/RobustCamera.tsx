import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import CameraAlt from '@mui/icons-material/CameraAlt';
import FlipCameraAndroid from '@mui/icons-material/FlipCameraAndroid';
import Close from '@mui/icons-material/Close';
import Camera from '@mui/icons-material/Camera';

interface RobustCameraProps {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
  open: boolean;
}

export const RobustCamera: React.FC<RobustCameraProps> = ({ onCapture, onClose, open }) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Single source of truth - only use state for stream, not ref
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // DOM refs only
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Track initialization to prevent double-init
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Track attachment state
  const streamAttachedRef = useRef(false);
  
  // Cleanup function - stops all tracks and clears video
  const cleanupCamera = useCallback(() => {
    // Reset attachment tracking
    streamAttachedRef.current = false;
    
    // Stop video playback
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      videoElementRef.current.srcObject = null;
      videoElementRef.current.load(); // Reset video element
    }
    
    // Stop all tracks in the stream
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    // Clear state
    setStream(null);
    setCameraReady(false);
    setError(null);
    isInitializingRef.current = false;
  }, [stream]);

  // SINGLE useEffect to handle stream attachment to video
  useEffect(() => {
    const video = videoElementRef.current;
    
    // Early exit conditions
    if (!video || !stream) {
      streamAttachedRef.current = false;
      return;
    }
    
    // Skip if already attached to this stream
    if (video.srcObject === stream && streamAttachedRef.current) {
      return;
    }
    
    streamAttachedRef.current = true;
    
    // Set up event handlers
    const handleLoadedMetadata = () => {
      if (!isMountedRef.current) return;
      
      video.play()
        .then(() => {
          if (isMountedRef.current) {
            setCameraReady(true);
          }
        })
        .catch(err => {
          console.error('[RobustCamera] Video play error:', err);
          if (isMountedRef.current) {
            setError('Camera stream ready but video playback failed. Please try again.');
          }
        });
    };
    
    const handleError = (err: Event) => {
      console.error('[RobustCamera] Video error:', err);
      if (isMountedRef.current) {
        setError('Failed to display camera feed. Please try again.');
      }
    };
    
    // Attach event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    
    // Attach the stream
    video.srcObject = stream;
    
    // Cleanup function - only remove listeners, don't detach stream
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [stream]);

  // Initialize camera when dialog opens - using isCancelled pattern
  useEffect(() => {
    let isCancelled = false;
    
    if (open) {
      isMountedRef.current = true;
      
      const initCamera = async () => {
        // Prevent double initialization
        if (isInitializingRef.current) {
          return;
        }
        
        if (isCancelled) {
          return;
        }
        
        isInitializingRef.current = true;
        setLoading(true);
        setError(null);
        setCameraReady(false);
        
        // Clean up any existing stream first
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }

        try {
          const constraints = {
            video: {
              facingMode: facingMode,
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
            },
            audio: false,
          };

          const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // Check if cancelled or unmounted after await
          if (isCancelled || !isMountedRef.current) {
            mediaStream.getTracks().forEach(track => track.stop());
            isInitializingRef.current = false;
            return;
          }
          
          setStream(mediaStream);
          setLoading(false);
          
        } catch (err) {
          console.error('[RobustCamera] Camera access error:', err);
          
          if (isCancelled || !isMountedRef.current) return;
          
          setLoading(false);
          isInitializingRef.current = false;
          
          if (err instanceof Error) {
            if (err.name === 'NotAllowedError') {
              setError('Camera access denied. Please allow camera permissions in your browser settings.');
            } else if (err.name === 'NotFoundError') {
              setError('No camera found on this device.');
            } else if (err.name === 'NotReadableError') {
              setError('Camera is already in use by another application. Please close other apps using the camera.');
            } else if (err.name === 'OverconstrainedError') {
              setError('Camera does not support the requested resolution. Please try again.');
            } else {
              setError(`Failed to access camera: ${err.message}`);
            }
          } else {
            setError('Failed to access camera. Please try again.');
          }
        }
      };
      
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (!isCancelled) {
          initCamera();
        }
      }, 100);
      
      return () => {
        isCancelled = true;
        clearTimeout(timer);
      };
    } else {
      // Dialog closed - cleanup
      cleanupCamera();
    }
  }, [open]); // Only depend on open to prevent re-runs

  // Handle facing mode changes
  useEffect(() => {
    let isCancelled = false;
    
    if (open && stream) {
      const reinitCamera = async () => {
        cleanupCamera();
        
        // Small delay to let cleanup complete
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (isCancelled || !isMountedRef.current) return;
        
        isInitializingRef.current = false;
        
        // Re-initialize with new facing mode
        isInitializingRef.current = true;
        setLoading(true);
        setError(null);
        setCameraReady(false);
        
        try {
          const constraints = {
            video: {
              facingMode: facingMode,
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
            },
            audio: false,
          };

          const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          if (isCancelled || !isMountedRef.current) {
            mediaStream.getTracks().forEach(track => track.stop());
            isInitializingRef.current = false;
            return;
          }
          
          setStream(mediaStream);
          setLoading(false);
          
        } catch (err) {
          console.error('[RobustCamera] Camera error during flip:', err);
          if (!isCancelled && isMountedRef.current) {
            setLoading(false);
            isInitializingRef.current = false;
            setError('Failed to flip camera. Please try again.');
          }
        }
      };
      
      reinitCamera();
    }
    
    return () => {
      isCancelled = true;
    };
  }, [facingMode]); // Only re-run when facingMode changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanupCamera();
    };
  }, []);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoElementRef.current || !canvasRef.current || !cameraReady) {
      return;
    }

    const video = videoElementRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    
    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    if (context) {
      // Flip context if using front camera for mirror effect correction
      if (facingMode === 'user') {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to data URL
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      onCapture(imageDataUrl);
      onClose();
    }
  }, [cameraReady, facingMode, onCapture, onClose]);

  // Flip camera
  const flipCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'white'
      }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CameraAlt />
          Take a Selfie
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, minHeight: 400 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: 300,
            gap: 2
          }}>
            <CircularProgress size={60} />
            <Typography variant="body1" color="text.secondary">
              Initializing camera...
            </Typography>
          </Box>
        )}

        <Box sx={{ 
          position: 'relative',
          width: '100%',
          maxWidth: 600,
          mx: 'auto',
          bgcolor: 'black',
          borderRadius: 2,
          overflow: 'hidden',
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Video element - always rendered but styled based on readiness */}
          <video
            ref={videoElementRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            controls={false}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '60vh',
              objectFit: 'contain',
              display: cameraReady ? 'block' : 'none',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
            }}
          />
          
          {/* Loading overlay - shown when stream exists but camera not ready */}
          {!cameraReady && stream && (
            <Box sx={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.9)',
              color: 'white',
              gap: 2,
              zIndex: 1
            }}>
              <CircularProgress size={40} sx={{ color: 'white' }} />
              <Typography variant="body1">
                Starting camera feed...
              </Typography>
            </Box>
          )}

          {/* Initial state - no stream yet */}
          {!cameraReady && !stream && !loading && !error && (
            <Box sx={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.8)',
              color: 'white',
              gap: 2
            }}>
              <Camera sx={{ fontSize: 60 }} />
              <Typography variant="body1" textAlign="center">
                Camera initializing...
              </Typography>
            </Box>
          )}
        </Box>

        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 2 }}>
        {cameraReady && (
          <>
            <Tooltip title="Flip Camera">
              <IconButton onClick={flipCamera} color="primary">
                <FlipCameraAndroid />
              </IconButton>
            </Tooltip>
            <Button
              onClick={capturePhoto}
              variant="contained"
              size="large"
              startIcon={<CameraAlt />}
              sx={{ 
                borderRadius: 2,
                px: 3,
                py: 1.5
              }}
            >
              Capture Photo
            </Button>
          </>
        )}
        
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};
