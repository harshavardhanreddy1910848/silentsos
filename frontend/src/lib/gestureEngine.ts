/**
 * SilentSOS High-Accuracy Real-Time Gesture Recognition & Landmark Validation Engine
 * 
 * Provides robust human detection, connected-component spatial clustering (Face vs Hands),
 * anatomical landmark tracking, anti-false-positive filtering, smooth temporal verification,
 * and instant automatic SOS trigger activation.
 */

export interface GestureDetectionResult {
  cameraStatus: 'Active' | 'Unavailable';
  humanStatus: 'Person detected' | 'No person detected';
  currentGesture:
    | 'No gesture detected'
    | 'Raised Palm'
    | 'Blink Pattern'
    | 'Crossed Arms'
    | 'Open Mouth Hold'
    | 'Gesture not recognized';
  confidence: number; // 0.0 to 1.0 (calibrated)
  progress: {
    blinkCount: number; // 0 to 3
    mouthHoldSeconds: number; // 0.0 to 1.0
    palmHoldFrames: number; // 0 to 14
    armsHoldFrames: number; // 0 to 14
    palmPercent: number; // 0 to 100
    blinkPercent: number; // 0 to 100
    armsPercent: number; // 0 to 100
    mouthPercent: number; // 0 to 100
  };
  sosStatus: 'Monitoring' | 'Gesture Verified' | 'SOS Triggered';
  landmarks: {
    faceDetected: boolean;
    faceRect?: { x: number; y: number; width: number; height: number };
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    mouth?: { x: number; y: number; width: number; height: number };
    ear: number; // Eye Aspect / Contrast Ratio
    mor: number; // Mouth Opening Ratio
    handDetected: boolean;
    handRect?: { x: number; y: number; width: number; height: number };
    extendedFingers: number;
    isOpenPalm: boolean;
    isWaving: boolean;
    armsCrossed: boolean;
  };
  isConfirmed: boolean;
  confirmedGestureName: string | null;
}

export interface EngineConfig {
  confidenceThreshold: number;
  requiredConsecutiveFrames: number;
  mouthHoldDurationMs: number;
  palmHoldFramesRequired: number;
  armsHoldFramesRequired: number;
  blinkWindowMs: number;
  safeTestMode: boolean;
}

export const DEFAULT_CONFIG: EngineConfig = {
  confidenceThreshold: 0.65,
  requiredConsecutiveFrames: 3,
  mouthHoldDurationMs: 850,
  palmHoldFramesRequired: 12,
  armsHoldFramesRequired: 12,
  blinkWindowMs: 4500,
  safeTestMode: false
};

// Robust skin classifier across diverse skin tones and lighting conditions
function isSkinColor(r: number, g: number, b: number): boolean {
  const sum = r + g + b;
  if (sum < 35 || sum > 745) return false;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 15 || lum > 250) return false;

  // YCbCr color space conversion
  const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  // Encompass fair, olive, tan, brown, and dark skin tones
  const ycbcr = Cr >= 115 && Cr <= 195 && Cb >= 60 && Cb <= 155;
  const rgb = r > 32 && g > 15 && b > 10 && r >= g && (r - b) >= 2;
  return ycbcr || rgb;
}

interface ComponentBlob {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  pixelCount: number;
  cellCount: number;
}

export class GestureRecognitionEngine {
  private config: EngineConfig;

  // Temporal Tracking State
  private blinkHistory: number[] = [];
  private eyelidWasClosed = false;
  private eyelidClosedTime = 0;
  private lastBlinkTime = 0;
  private baselineEyeContrast = 0.35;

  private mouthHoldAccumulatorMs = 0;
  private lastFrameTime = 0;

  private consecutivePalmFrames = 0;
  private handXMotion: { x: number; t: number }[] = [];

  private consecutiveArmsFrames = 0;

  // Anti-Repeated Trigger Guard
  private hasTriggered = false;
  private cooldownUntil = 0;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public updateConfig(newConfig: Partial<EngineConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public setSafeTestMode(enabled: boolean) {
    this.config.safeTestMode = enabled;
  }

  public isSafeTestMode(): boolean {
    return this.config.safeTestMode;
  }

  public resetTracking() {
    this.blinkHistory = [];
    this.eyelidWasClosed = false;
    this.eyelidClosedTime = 0;
    this.lastBlinkTime = 0;
    this.mouthHoldAccumulatorMs = 0;
    this.consecutivePalmFrames = 0;
    this.consecutiveArmsFrames = 0;
    this.handXMotion = [];
    if (Date.now() >= this.cooldownUntil) {
      this.hasTriggered = false;
    }
  }

  /**
   * Main Frame Processing Pipeline:
   * Real-time analysis of live webcam frame with fast landmark extraction
   * and immediate verification of the 4 trigger gestures.
   */
  public processFrame(
    ctx: CanvasRenderingContext2D,
    width = 160,
    height = 120,
    currentTime: number = Date.now()
  ): GestureDetectionResult {
    const defaultResult: GestureDetectionResult = {
      cameraStatus: 'Active',
      humanStatus: 'No person detected',
      currentGesture: 'No gesture detected',
      confidence: 0,
      progress: {
        blinkCount: 0,
        mouthHoldSeconds: 0,
        palmHoldFrames: 0,
        armsHoldFrames: 0,
        palmPercent: 0,
        blinkPercent: 0,
        armsPercent: 0,
        mouthPercent: 0
      },
      sosStatus: 'Monitoring',
      landmarks: {
        faceDetected: false,
        ear: 0,
        mor: 0,
        handDetected: false,
        extendedFingers: 0,
        isOpenPalm: false,
        isWaving: false,
        armsCrossed: false
      },
      isConfirmed: false,
      confirmedGestureName: null
    };

    const deltaMs = this.lastFrameTime > 0 ? Math.min(100, Math.max(10, currentTime - this.lastFrameTime)) : 50;
    this.lastFrameTime = currentTime;

    // 1. Frame validation & variance
    const frameData = ctx.getImageData(0, 0, width, height);
    const data = frameData.data;
    if (!data || data.length < width * height * 4) {
      return defaultResult;
    }

    let lumSum = 0;
    let lumSqSum = 0;
    const sampleStep = 4;
    let sampleCount = 0;

    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumSum += lum;
      lumSqSum += lum * lum;
      sampleCount++;
    }

    const meanLum = lumSum / sampleCount;
    const lumVariance = lumSqSum / sampleCount - meanLum * meanLum;

    if (meanLum < 8 || lumVariance < 12) {
      this.resetTracking();
      return defaultResult;
    }

    // 2. Spatial Grid Clustering: Separate Face cluster from Hand cluster(s)
    const { faceBlob, handBlob } = this.segmentSkinClusters(data, width, height);

    // 3. Extract Face Landmarks (Eyes, Mouth, EAR, MOR)
    const face = this.extractFaceFeatures(data, width, height, faceBlob);

    // 4. Extract Hand & Palm / Wave Features
    const hand = this.extractHandFeatures(data, width, height, handBlob, faceBlob, currentTime);

    // 5. Extract Upper Body & Crossed Arms Pose
    const arms = this.extractCrossedArms(data, width, height, faceBlob);

    const isHumanPresent = face.detected || hand.detected || arms.torsoDetected;

    if (!isHumanPresent) {
      this.resetTracking();
      return {
        ...defaultResult,
        humanStatus: 'No person detected'
      };
    }

    // Cooldown guard to prevent infinite re-trigger loop
    if (currentTime < this.cooldownUntil) {
      return {
        ...defaultResult,
        humanStatus: 'Person detected',
        currentGesture: 'No gesture detected',
        confidence: 0.95,
        sosStatus: 'SOS Triggered'
      };
    }

    // --- EVALUATE TRIGGER GESTURES ---
    let candidateGesture: GestureDetectionResult['currentGesture'] = 'No gesture detected';
    let gestureConfidence = 0;
    let gestureVerified = false;
    let confirmedName: string | null = null;

    // --- RULE 1: RAISED PALM / WAVE ---
    const palmFramesReq = this.config.palmHoldFramesRequired || 12;
    if (hand.detected && (hand.isOpenPalm || hand.isWaving)) {
      candidateGesture = 'Raised Palm';
      if (hand.isWaving) {
        this.consecutivePalmFrames = palmFramesReq;
        gestureConfidence = 0.98;
        gestureVerified = true;
        confirmedName = 'Raised palm / wave';
      } else {
        this.consecutivePalmFrames = Math.min(palmFramesReq, this.consecutivePalmFrames + 1);
        const ratio = this.consecutivePalmFrames / palmFramesReq;
        gestureConfidence = Math.min(0.96, 0.70 + ratio * 0.28);
        if (this.consecutivePalmFrames >= palmFramesReq) {
          gestureVerified = true;
          confirmedName = 'Raised palm / wave';
        }
      }
    } else {
      // Smooth decay so brief frame flicker does not reset progress
      this.consecutivePalmFrames = Math.max(0, this.consecutivePalmFrames - 1);
    }

    // --- RULE 2: BLINK PATTERN (3 Deliberate Blinks) ---
    if (face.detected && face.eyesTracked) {
      // Update baseline contrast slowly during open eyes
      if (!this.eyelidWasClosed) {
        this.baselineEyeContrast = 0.98 * this.baselineEyeContrast + 0.02 * face.ear;
      }

      // Closure detected when contrast drops below 76% of open baseline
      const isEyeClosed = face.ear < Math.max(0.12, this.baselineEyeContrast * 0.76);
      const isEyeOpen = face.ear >= Math.max(0.15, this.baselineEyeContrast * 0.88);

      if (isEyeClosed && !this.eyelidWasClosed) {
        this.eyelidWasClosed = true;
        this.eyelidClosedTime = currentTime;
      } else if (isEyeOpen && this.eyelidWasClosed) {
        const blinkDuration = currentTime - this.eyelidClosedTime;
        // Human deliberate blink duration: 75ms to 700ms
        if (blinkDuration >= 75 && blinkDuration <= 700) {
          if (currentTime - this.lastBlinkTime >= 120) {
            this.blinkHistory.push(currentTime);
            this.lastBlinkTime = currentTime;
            console.log(`👁️ [Gesture Engine] Valid blink counted: ${this.blinkHistory.length}/3`);
          }
        }
        this.eyelidWasClosed = false;
      }

      // Filter blinks within rolling window (4.5s)
      this.blinkHistory = this.blinkHistory.filter((t) => currentTime - t <= this.config.blinkWindowMs);

      if (this.blinkHistory.length > 0) {
        if (candidateGesture === 'No gesture detected') {
          candidateGesture = 'Blink Pattern';
          gestureConfidence = Math.min(0.98, 0.70 + this.blinkHistory.length * 0.095);
        }
        if (this.blinkHistory.length >= 3) {
          candidateGesture = 'Blink Pattern';
          gestureConfidence = 0.99;
          gestureVerified = true;
          confirmedName = 'Blink pattern';
        }
      }
    } else {
      this.eyelidWasClosed = false;
      this.blinkHistory = this.blinkHistory.filter((t) => currentTime - t <= this.config.blinkWindowMs);
    }

    // --- RULE 3: CROSSED ARMS ---
    const armsFramesReq = this.config.armsHoldFramesRequired || 12;
    if (arms.armsCrossed) {
      if (candidateGesture === 'No gesture detected') {
        candidateGesture = 'Crossed Arms';
      }
      this.consecutiveArmsFrames = Math.min(armsFramesReq, this.consecutiveArmsFrames + 1);
      const ratio = this.consecutiveArmsFrames / armsFramesReq;
      gestureConfidence = Math.max(gestureConfidence, Math.min(0.96, 0.72 + ratio * 0.26));

      if (this.consecutiveArmsFrames >= armsFramesReq) {
        candidateGesture = 'Crossed Arms';
        gestureVerified = true;
        confirmedName = 'Crossed arms';
      }
    } else {
      this.consecutiveArmsFrames = Math.max(0, this.consecutiveArmsFrames - 1);
    }

    // --- RULE 4: OPEN MOUTH HOLD ---
    const mouthReqMs = this.config.mouthHoldDurationMs || 850;
    if (face.detected && face.mouthTracked && face.mor >= 0.09) {
      this.mouthHoldAccumulatorMs += deltaMs;
      if (candidateGesture === 'No gesture detected') {
        candidateGesture = 'Open Mouth Hold';
      }
      const progressRatio = Math.min(1.0, this.mouthHoldAccumulatorMs / mouthReqMs);
      gestureConfidence = Math.max(gestureConfidence, Math.min(0.98, 0.74 + progressRatio * 0.24));

      if (this.mouthHoldAccumulatorMs >= mouthReqMs) {
        candidateGesture = 'Open Mouth Hold';
        gestureVerified = true;
        confirmedName = 'Open mouth hold';
      }
    } else {
      // Smooth decay so slight lip movements don't instantly wipe progress
      this.mouthHoldAccumulatorMs = Math.max(0, this.mouthHoldAccumulatorMs - deltaMs * 0.25);
    }

    // --- CONFIRMATION & AUTOMATIC SOS TRIGGER DISPATCH ---
    let sosStatus: GestureDetectionResult['sosStatus'] = 'Monitoring';
    let isConfirmed = false;

    if (gestureVerified && confirmedName && !this.hasTriggered) {
      isConfirmed = true;
      sosStatus = 'SOS Triggered';
      this.hasTriggered = true;
      this.cooldownUntil = currentTime + 3500;
      console.log(`🚨 [Gesture Recognition Engine] Confirmed Trigger Gesture: "${confirmedName}"! Automatically triggering SOS Alert!`);
    }

    const mouthSecs = Number((this.mouthHoldAccumulatorMs / 1000).toFixed(1));
    const palmPercent = Math.min(100, Math.round((this.consecutivePalmFrames / palmFramesReq) * 100));
    const blinkPercent = Math.min(100, Math.round((this.blinkHistory.length / 3) * 100));
    const armsPercent = Math.min(100, Math.round((this.consecutiveArmsFrames / armsFramesReq) * 100));
    const mouthPercent = Math.min(100, Math.round((this.mouthHoldAccumulatorMs / mouthReqMs) * 100));

    return {
      cameraStatus: 'Active',
      humanStatus: 'Person detected',
      currentGesture: candidateGesture,
      confidence: Number(gestureConfidence.toFixed(2)),
      progress: {
        blinkCount: this.blinkHistory.length,
        mouthHoldSeconds: mouthSecs,
        palmHoldFrames: this.consecutivePalmFrames,
        armsHoldFrames: this.consecutiveArmsFrames,
        palmPercent,
        blinkPercent,
        armsPercent,
        mouthPercent
      },
      sosStatus,
      landmarks: {
        faceDetected: face.detected,
        faceRect: face.rect,
        leftEye: face.leftEye,
        rightEye: face.rightEye,
        mouth: face.mouth,
        ear: Number(face.ear.toFixed(2)),
        mor: Number(face.mor.toFixed(2)),
        handDetected: hand.detected,
        handRect: hand.rect,
        extendedFingers: hand.extendedFingers,
        isOpenPalm: hand.isOpenPalm,
        isWaving: hand.isWaving,
        armsCrossed: arms.armsCrossed
      },
      isConfirmed,
      confirmedGestureName: confirmedName
    };
  }

  /**
   * Spatial Grid Clustering:
   * Divides the frame into an 8x8 pixel grid (20x15 cells for 160x120),
   * identifies skin-dense cells, and runs connected-component labeling.
   * This cleanly separates the Face from any raised Hand/Arm!
   */
  private segmentSkinClusters(data: Uint8ClampedArray, width: number, height: number): {
    faceBlob: ComponentBlob | null;
    handBlob: ComponentBlob | null;
  } {
    const cellSize = 8;
    const cols = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);
    const grid: number[] = new Array(cols * rows).fill(0);

    // 1. Compute skin density per cell
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let skinPixels = 0;
        const startX = c * cellSize;
        const startY = r * cellSize;
        for (let y = startY; y < startY + cellSize; y += 2) {
          for (let x = startX; x < startX + cellSize; x += 2) {
            const idx = (y * width + x) * 4;
            if (isSkinColor(data[idx], data[idx + 1], data[idx + 2])) {
              skinPixels++;
            }
          }
        }
        // At least 4 skin samples out of 16 sampled points (~25% skin density)
        if (skinPixels >= 4) {
          grid[r * cols + c] = 1;
        }
      }
    }

    // 2. Connected Component Labeling using BFS
    const visited = new Uint8Array(cols * rows);
    const components: ComponentBlob[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (grid[idx] === 1 && !visited[idx]) {
          // New component found
          let minX = c * cellSize;
          let maxX = (c + 1) * cellSize;
          let minY = r * cellSize;
          let maxY = (r + 1) * cellSize;
          let cellCount = 0;
          let xSum = 0;
          let ySum = 0;

          const queue: [number, number][] = [[c, r]];
          visited[idx] = 1;

          while (queue.length > 0) {
            const [qc, qr] = queue.shift()!;
            cellCount++;
            xSum += qc * cellSize + cellSize / 2;
            ySum += qr * cellSize + cellSize / 2;

            minX = Math.min(minX, qc * cellSize);
            maxX = Math.max(maxX, (qc + 1) * cellSize);
            minY = Math.min(minY, qr * cellSize);
            maxY = Math.max(maxY, (qr + 1) * cellSize);

            // 4-neighborhood
            const neighbors: [number, number][] = [
              [qc + 1, qr],
              [qc - 1, qr],
              [qc, qr + 1],
              [qc, qr - 1]
            ];

            for (const [nc, nr] of neighbors) {
              if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                const nIdx = nr * cols + nc;
                if (grid[nIdx] === 1 && !visited[nIdx]) {
                  visited[nIdx] = 1;
                  queue.push([nc, nr]);
                }
              }
            }
          }

          if (cellCount >= 3) {
            components.push({
              minX,
              maxX,
              minY,
              maxY,
              centerX: Math.round(xSum / cellCount),
              centerY: Math.round(ySum / cellCount),
              pixelCount: cellCount * 16,
              cellCount
            });
          }
        }
      }
    }

    if (components.length === 0) {
      return { faceBlob: null, handBlob: null };
    }

    // Sort components by cell count (largest first)
    components.sort((a, b) => b.cellCount - a.cellCount);

    // Identify Face candidate: typically in upper 65% of screen, near horizontal center
    let faceBlob: ComponentBlob | null = null;
    let handBlob: ComponentBlob | null = null;

    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      const w = comp.maxX - comp.minX;
      const h = comp.maxY - comp.minY;
      const aspect = w / Math.max(1, h);

      // Face candidates have reasonable aspect ratio and are located in upper portion of frame
      if (!faceBlob && comp.centerY < height * 0.72 && aspect >= 0.5 && aspect <= 1.8 && comp.cellCount >= 6) {
        faceBlob = comp;
      } else if (!handBlob && comp.cellCount >= 2) {
        // Any other distinct skin component is a hand candidate
        handBlob = comp;
      }
    }

    // If only one component was found, check if it's high enough to be face, or if it's a raised hand
    if (!faceBlob && components.length > 0) {
      faceBlob = components[0];
    }

    return { faceBlob, handBlob };
  }

  /**
   * Face and Facial Landmark Extraction
   */
  private extractFaceFeatures(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    faceBlob: ComponentBlob | null
  ) {
    if (!faceBlob) {
      return {
        detected: false,
        eyesTracked: false,
        mouthTracked: false,
        ear: 0,
        mor: 0
      };
    }

    const faceX = faceBlob.minX;
    const faceY = faceBlob.minY;
    const faceWidth = faceBlob.maxX - faceBlob.minX;
    const faceHeight = faceBlob.maxY - faceBlob.minY;

    if (faceWidth < 18 || faceHeight < 18) {
      return {
        detected: false,
        eyesTracked: false,
        mouthTracked: false,
        ear: 0,
        mor: 0
      };
    }

    // Compute average skin luminance inside face
    let skinLumSum = 0;
    let skinCount = 0;
    for (let y = faceY; y < faceY + faceHeight; y += 2) {
      for (let x = faceX; x < faceX + faceWidth; x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        if (isSkinColor(r, g, b)) {
          skinLumSum += 0.299 * r + 0.587 * g + 0.114 * b;
          skinCount++;
        }
      }
    }
    const avgSkinLum = skinCount > 0 ? skinLumSum / skinCount : 120;

    // --- EYES EXTRACTION & CONTRAST RATIO ---
    const eyeBandY = Math.round(faceY + faceHeight * 0.36);
    const leftEyeX = Math.round(faceX + faceWidth * 0.32);
    const rightEyeX = Math.round(faceX + faceWidth * 0.68);

    const eyeRadiusX = Math.max(3, Math.round(faceWidth * 0.13));
    const eyeRadiusY = Math.max(2, Math.round(faceHeight * 0.09));

    let eyeDarkPixels = 0;
    let eyeTotalSamples = 0;

    for (let dy = -eyeRadiusY; dy <= eyeRadiusY; dy += 2) {
      for (let dx = -eyeRadiusX; dx <= eyeRadiusX; dx += 2) {
        const ly = eyeBandY + dy;
        const lx1 = leftEyeX + dx;
        const lx2 = rightEyeX + dx;

        if (ly >= 0 && ly < height) {
          if (lx1 >= 0 && lx1 < width) {
            const idx1 = (ly * width + lx1) * 4;
            const lum1 = 0.299 * data[idx1] + 0.587 * data[idx1 + 1] + 0.114 * data[idx1 + 2];
            if (lum1 < avgSkinLum * 0.76) eyeDarkPixels++;
            eyeTotalSamples++;
          }
          if (lx2 >= 0 && lx2 < width) {
            const idx2 = (ly * width + lx2) * 4;
            const lum2 = 0.299 * data[idx2] + 0.587 * data[idx2 + 1] + 0.114 * data[idx2 + 2];
            if (lum2 < avgSkinLum * 0.76) eyeDarkPixels++;
            eyeTotalSamples++;
          }
        }
      }
    }

    const ear = eyeTotalSamples > 0 ? eyeDarkPixels / eyeTotalSamples : 0;
    const eyesTracked = eyeTotalSamples >= 8;

    // --- MOUTH EXTRACTION & OPENING RATIO (MOR) ---
    const mouthY = Math.round(faceY + faceHeight * 0.74);
    const mouthCenterX = Math.round(faceX + faceWidth * 0.50);
    const mouthRadiusX = Math.max(4, Math.round(faceWidth * 0.18));
    const mouthRadiusY = Math.max(3, Math.round(faceHeight * 0.12));

    let mouthDarkPixels = 0;
    let mouthSamplePoints = 0;

    for (let dy = -mouthRadiusY; dy <= mouthRadiusY; dy += 2) {
      for (let dx = -mouthRadiusX; dx <= mouthRadiusX; dx += 2) {
        const my = mouthY + dy;
        const mx = mouthCenterX + dx;
        if (my >= 0 && my < height && mx >= 0 && mx < width) {
          const idx = (my * width + mx) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          // Open oral cavity has distinct contrast darker than skin cheeks
          if (lum < Math.min(100, avgSkinLum * 0.78)) {
            mouthDarkPixels++;
          }
          mouthSamplePoints++;
        }
      }
    }

    const mor = mouthSamplePoints > 0 ? (mouthDarkPixels / mouthSamplePoints) * 1.4 : 0;
    const mouthTracked = mouthSamplePoints >= 8;

    return {
      detected: true,
      rect: { x: faceX, y: faceY, width: faceWidth, height: faceHeight },
      leftEye: { x: leftEyeX, y: eyeBandY },
      rightEye: { x: rightEyeX, y: eyeBandY },
      mouth: {
        x: mouthCenterX - mouthRadiusX,
        y: mouthY - mouthRadiusY,
        width: mouthRadiusX * 2,
        height: mouthRadiusY * 2
      },
      eyesTracked,
      mouthTracked,
      ear,
      mor
    };
  }

  /**
   * Hand & Raised Palm / Wave Extraction
   */
  private extractHandFeatures(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    handBlob: ComponentBlob | null,
    _faceBlob: ComponentBlob | null,
    currentTime: number
  ) {
    if (!handBlob) {
      return {
        detected: false,
        extendedFingers: 0,
        isOpenPalm: false,
        isWaving: false,
        palmRatio: 0
      };
    }

    const handWidth = handBlob.maxX - handBlob.minX;
    const handHeight = handBlob.maxY - handBlob.minY;
    const palmRatio = handHeight > 0 ? handWidth / handHeight : 0;

    // Hand presence requirements
    if (handBlob.cellCount < 2 || handWidth < 10 || handHeight < 10) {
      return {
        detected: false,
        extendedFingers: 0,
        isOpenPalm: false,
        isWaving: false,
        palmRatio: 0
      };
    }

    const palmCenterX = handBlob.centerX;
    const palmCenterY = handBlob.centerY;

    // Track motion for wave detection (oscillating horizontal movement)
    this.handXMotion.push({ x: palmCenterX, t: currentTime });
    this.handXMotion = this.handXMotion.filter((m) => currentTime - m.t <= 1400);

    let isWaving = false;
    if (this.handXMotion.length >= 5) {
      const xs = this.handXMotion.map((m) => m.x);
      const span = Math.max(...xs) - Math.min(...xs);
      let reversals = 0;
      let lastDir = 0;
      for (let i = 1; i < xs.length; i++) {
        const diff = xs[i] - xs[i - 1];
        if (Math.abs(diff) >= 3) {
          const dir = diff > 0 ? 1 : -1;
          if (lastDir !== 0 && dir !== lastDir) {
            reversals++;
          }
          lastDir = dir;
        }
      }
      if (span >= 12 && reversals >= 2) {
        isWaving = true;
      }
    }

    // Extended fingers / palm spread detection
    const testRadius = Math.round(handHeight * 0.42);
    const angles = [-50, -25, 0, 25, 50];
    let extendedFingers = 0;

    for (const deg of angles) {
      const rad = (deg - 90) * (Math.PI / 180);
      const fx = Math.round(palmCenterX + Math.cos(rad) * testRadius);
      const fy = Math.round(palmCenterY + Math.sin(rad) * testRadius);

      if (fx >= 0 && fx < width && fy >= 0 && fy < height) {
        const idx = (fy * width + fx) * 4;
        if (isSkinColor(data[idx], data[idx + 1], data[idx + 2])) {
          extendedFingers++;
        }
      }
    }

    // Raised palm condition:
    // Hand is held in upper/middle 85% of screen with solid palm aspect or spread fingers
    const isRaised = palmCenterY < height * 0.88;
    const isOpenPalm =
      isRaised &&
      (extendedFingers >= 2 || (handBlob.cellCount >= 3 && palmRatio >= 0.45 && palmRatio <= 2.1));

    return {
      detected: true,
      rect: { x: handBlob.minX, y: handBlob.minY, width: handWidth, height: handHeight },
      extendedFingers,
      isOpenPalm,
      isWaving,
      palmRatio
    };
  }

  /**
   * Upper Body & Crossed Arms Pose Extraction
   */
  private extractCrossedArms(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    faceBlob: ComponentBlob | null
  ) {
    if (!faceBlob) {
      return { torsoDetected: false, armsCrossed: false };
    }

    const faceH = faceBlob.maxY - faceBlob.minY;
    const torsoYStart = Math.min(height - 18, faceBlob.maxY + 2);
    const torsoYEnd = Math.min(height - 2, faceBlob.maxY + Math.round(faceH * 1.5));
    const chestMidline = faceBlob.centerX;
    const chestHalfWidth = Math.max(22, Math.round((faceBlob.maxX - faceBlob.minX) * 0.75));

    let chestSkinPixels = 0;
    let chestTotalPixels = 0;
    let leftChestLimb = 0;
    let rightChestLimb = 0;

    // Scan chest / torso area below chin
    for (let y = torsoYStart; y < torsoYEnd; y += 2) {
      for (let x = Math.max(6, chestMidline - chestHalfWidth); x < Math.min(width - 6, chestMidline + chestHalfWidth); x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Hands / wrists (skin) or arms crossing over chest
        if (isSkinColor(r, g, b)) {
          chestSkinPixels++;
        }

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 15) {
          if (x < chestMidline - 4) leftChestLimb++;
          else if (x > chestMidline + 4) rightChestLimb++;
          chestTotalPixels++;
        }
      }
    }

    const torsoDetected = chestTotalPixels >= 16;
    // Crossed arms: wrists/hands (skin) placed in center of chest or limbs crossing chest midline
    const armsCrossed =
      torsoDetected &&
      ((chestSkinPixels >= 8 && leftChestLimb >= 6 && rightChestLimb >= 6) ||
        (leftChestLimb >= 14 && rightChestLimb >= 14 && chestSkinPixels >= 4));

    return {
      torsoDetected,
      armsCrossed
    };
  }
}
