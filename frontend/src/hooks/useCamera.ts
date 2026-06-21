import { useState, useEffect, useRef } from 'react';

export function useCamera(facingMode: 'user' | 'environment' = 'user') {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API not supported');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false
        });

        activeStream = mediaStream;
        setStream(mediaStream);
        setIsMock(false);
        setError(null);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.warn('Camera access failed, falling back to mock:', err);
        setError(err.message || 'Camera access denied');
        setIsMock(true);
      }
    }

    setupCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  return { stream, error, isMock, videoRef };
}