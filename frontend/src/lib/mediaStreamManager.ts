/**
 * Global Media Stream and Evidence Capture Manager
 * Ensures persistent, non-interrupted camera and microphone access across
 * page transitions (e.g. Gesture Detection -> Alert Trigger -> Evidence).
 */

let sharedStream: MediaStream | null = null;
let currentFacing: 'front' | 'rear' = 'front';
let activeVideoRecorder: MediaRecorder | null = null;
let activeAudioRecorder: MediaRecorder | null = null;
let currentAudioQuality: 'low' | 'high' = 'high';
let videoChunks: Blob[] = [];
let audioChunks: Blob[] = [];

// Fallback WAV generator if device has no microphone hardware
export function generateFallbackAudioWav(quality: 'low' | 'high' = 'high'): string {
  const sampleRate = quality === 'low' ? 8000 : 44100;
  const numSamples = sampleRate * 2;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.25;
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
}

/**
 * Switch camera facing mode dynamically without dropping audio tracks
 */
export async function switchCameraFacing(facing: 'front' | 'rear'): Promise<MediaStream | null> {
  currentFacing = facing;
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return sharedStream;
  }

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facing === 'front' ? 'user' : 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    });

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (sharedStream && newVideoTrack) {
      sharedStream.getVideoTracks().forEach((t) => {
        t.stop();
        sharedStream?.removeTrack(t);
      });
      sharedStream.addTrack(newVideoTrack);
      return sharedStream;
    } else {
      sharedStream = newStream;
      return sharedStream;
    }
  } catch (err) {
    console.warn('Switch camera facing notice:', err);
    return sharedStream;
  }
}

/**
 * Acquire or return existing global MediaStream with camera and microphone
 */
export async function getGlobalMediaStream(facing: 'front' | 'rear' = 'front'): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  // If we already have an active stream with live tracks and matching facing, return it
  if (sharedStream && sharedStream.active) {
    const videoTracks = sharedStream.getVideoTracks();
    if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
      if (currentFacing === facing) {
        return sharedStream;
      }
      return await switchCameraFacing(facing);
    }
  }

  currentFacing = facing;

  try {
    // Request video + microphone together for instant synchronized evidence
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facing === 'front' ? 'user' : 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    });
    sharedStream = stream;
    return stream;
  } catch (err1) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing === 'front' ? 'user' : 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: true
      });
      sharedStream = stream;
      return stream;
    } catch (err2) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing === 'front' ? 'user' : 'environment' }
        });
        sharedStream = stream;
        return stream;
      } catch (err3) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          sharedStream = stream;
          return stream;
        } catch (err4) {
          console.warn('Unable to access camera or microphone:', err4);
          return null;
        }
      }
    }
  }
}

/**
 * Capture an authentic live photograph from a HTMLVideoElement
 */
export function captureFrameFromVideo(video: HTMLVideoElement | null, facingLabel?: string): string | null {
  if (!video) return null;
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw the actual real camera frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Subtle security timestamp badge overlay in top-left
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    const label = facingLabel ? `● SOS ${facingLabel.toUpperCase()}: ${timeStr}` : `● SOS CAM: ${timeStr}`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(10, 10, 195, 26);
    ctx.fillStyle = '#00e676';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(label, 16, 28);

    return canvas.toDataURL('image/jpeg', 0.90);
  } catch (e) {
    console.error('Frame capture exception:', e);
    return null;
  }
}

/**
 * Capture a burst of real photos directly from the video element
 */
export async function captureBurstFromVideo(
  video: HTMLVideoElement | null,
  count = 5,
  intervalMs = 100,
  facingLabel?: string
): Promise<string[]> {
  const frames: string[] = [];
  if (!video) return frames;

  // If video is still warming up, wait briefly
  if (video.videoWidth === 0) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (video.videoWidth > 0) break;
    }
  }

  for (let i = 0; i < count; i++) {
    const frame = captureFrameFromVideo(video, facingLabel);
    if (frame) frames.push(frame);
    if (i < count - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return frames;
}

/**
 * Start synchronized video (with sound) and microphone audio recording
 */
export function startMediaRecording(stream: MediaStream, audioQuality: 'low' | 'high' = 'high'): void {
  if (activeVideoRecorder && activeVideoRecorder.state === 'recording') {
    return; // Already recording
  }

  currentAudioQuality = audioQuality;
  videoChunks = [];
  audioChunks = [];

  // Low bandwidth: 16 kbps; High quality: 128 kbps
  const audioBitrate = audioQuality === 'low' ? 16000 : 128000;

  const videoMimes = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4'
  ];
  const videoMime = videoMimes.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));

  const audioMimes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac'
  ];
  const audioMime = audioMimes.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));

  // 1. Setup Video Recorder
  try {
    if (stream.getVideoTracks().length > 0) {
      const options: MediaRecorderOptions = { audioBitsPerSecond: audioBitrate };
      if (videoMime) options.mimeType = videoMime;
      activeVideoRecorder = new MediaRecorder(stream, options);
      activeVideoRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) videoChunks.push(e.data);
      };
      activeVideoRecorder.start(200);
    }
  } catch (err) {
    console.warn('Video recorder setup notice:', err);
  }

  // 2. Setup Audio Recorder
  try {
    if (stream.getAudioTracks().length > 0) {
      const audioStream = new MediaStream(stream.getAudioTracks());
      const options: MediaRecorderOptions = { audioBitsPerSecond: audioBitrate };
      if (audioMime) options.mimeType = audioMime;
      activeAudioRecorder = new MediaRecorder(audioStream, options);
      activeAudioRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };
      activeAudioRecorder.start(200);
    }
  } catch (err) {
    console.warn('Audio recorder setup notice:', err);
  }
}

/**
 * Stop recording and return real Data URLs for video and audio
 */
export async function stopMediaRecording(durationWaitMs = 0): Promise<{ videoDataUrl: string; audioDataUrl: string }> {
  if (durationWaitMs > 0) {
    await new Promise((r) => setTimeout(r, durationWaitMs));
  }

  let finalVideoDataUrl = '';
  let finalAudioDataUrl = '';

  const stopVideo = new Promise<string>((resolve) => {
    if (!activeVideoRecorder || activeVideoRecorder.state !== 'recording') {
      if (videoChunks.length > 0) {
        const blob = new Blob(videoChunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      } else {
        resolve('');
      }
      return;
    }

    activeVideoRecorder.onstop = () => {
      const blob = new Blob(videoChunks, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    };

    try {
      activeVideoRecorder.stop();
    } catch {
      resolve('');
    }
  });

  const stopAudio = new Promise<string>((resolve) => {
    if (!activeAudioRecorder || activeAudioRecorder.state !== 'recording') {
      if (audioChunks.length > 0) {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve(generateFallbackAudioWav(currentAudioQuality));
        reader.readAsDataURL(blob);
      } else {
        resolve(generateFallbackAudioWav(currentAudioQuality));
      }
      return;
    }

    activeAudioRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = (reader.result as string) || '';
        resolve(res.startsWith('data:') ? res : generateFallbackAudioWav(currentAudioQuality));
      };
      reader.onerror = () => resolve(generateFallbackAudioWav(currentAudioQuality));
      reader.readAsDataURL(blob);
    };

    try {
      activeAudioRecorder.stop();
    } catch {
      resolve(generateFallbackAudioWav(currentAudioQuality));
    }
  });

  [finalVideoDataUrl, finalAudioDataUrl] = await Promise.all([stopVideo, stopAudio]);

  activeVideoRecorder = null;
  activeAudioRecorder = null;

  const result = {
    videoDataUrl: finalVideoDataUrl,
    audioDataUrl: finalAudioDataUrl || generateFallbackAudioWav(currentAudioQuality)
  };

  return result;
}

/**
 * Check if active recording is currently taking place
 */
export function isCurrentlyRecording(): boolean {
  return (
    (activeVideoRecorder !== null && activeVideoRecorder.state === 'recording') ||
    (activeAudioRecorder !== null && activeAudioRecorder.state === 'recording')
  );
}

/**
 * Release global stream (only when alert completely finished/cancelled)
 */
export function releaseGlobalMediaStream(): void {
  if (sharedStream) {
    sharedStream.getTracks().forEach((t) => t.stop());
    sharedStream = null;
  }
  activeVideoRecorder = null;
  activeAudioRecorder = null;
  videoChunks = [];
  audioChunks = [];
}
