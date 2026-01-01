import { FilesetResolver, HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

export class HandTracker {
  landmarker: HandLandmarker | null = null;
  runningMode: "IMAGE" | "VIDEO" = "VIDEO";
  
  async initialize() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: this.runningMode,
      numHands: 1
    });
  }

  detect(video: HTMLVideoElement) {
    if (!this.landmarker) return null;
    const startTimeMs = performance.now();
    return this.landmarker.detectForVideo(video, startTimeMs);
  }
}

export const detectGesture = (landmarks: any[]): string => {
  if (!landmarks || landmarks.length === 0) return "None";

  const lm = landmarks[0]; // First hand
  
  // Helper to check if finger is extended
  const isExtended = (tipIdx: number, pipIdx: number) => {
    return lm[tipIdx].y < lm[pipIdx].y; // Simple check for upright hand
  };

  // Thumb is a bit different, check x distance or angle, but for simplicity:
  // We'll use a simpler distance based check for "folded" vs "extended" relative to palm
  const wrist = lm[0];
  const thumbTip = lm[4];
  const indexTip = lm[8];
  const middleTip = lm[12];
  const ringTip = lm[16];
  const pinkyTip = lm[20];

  const thumbIndexDist = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) + 
    Math.pow(thumbTip.y - indexTip.y, 2) + 
    Math.pow(thumbTip.z - indexTip.z, 2)
  );

  // Finger states (approximate)
  // Note: Y increases downwards in MediaPipe screen coords usually, but 3D coords might be different.
  // Let's use relative positions to knuckles (MCP).
  const isFingerUp = (tip: number, mcp: number) => lm[tip].y < lm[mcp].y;
  
  const indexUp = isFingerUp(8, 5);
  const middleUp = isFingerUp(12, 9);
  const ringUp = isFingerUp(16, 13);
  const pinkyUp = isFingerUp(20, 17);

  // Fist: All fingers down
  if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
    return "Fist";
  }

  // V-Sign: Index and Middle up, others down
  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return "V-Sign";
  }

  // Open Hand: All fingers up
  if (indexUp && middleUp && ringUp && pinkyUp) {
    return "Open Hand";
  }

  // Finger Heart: Thumb and Index close, others down (or up, but usually down/relaxed)
  // This is tricky. Usually crossed. Let's check distance.
  if (thumbIndexDist < 0.05) {
    return "Finger Heart";
  }

  return "Unknown";
};
