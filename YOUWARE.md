# YOUWARE Project Documentation

## Project Overview
This is a **Gesture-Based Interactive Particle System** built with React, Three.js, and MediaPipe. It features real-time hand tracking to control a 3D particle system and integrates with Google Gemini API for generative visual effects.

## Architecture

### Core Components
- **`src/components/GestureParticles.tsx`**: The main orchestrator. Handles the Three.js scene, render loop, and UI state. It manages the particle system, post-processing (Bloom), and integrates hand tracking results.
- **`src/utils/handDetection.ts`**: Manages MediaPipe `HandLandmarker`. Detects gestures (Fist, V-Sign, Finger Heart, Open Hand) from video input.
- **`src/utils/shapes.ts`**: Generates particle positions and colors for different shapes (Saturn, Heart, Text, Sphere, Cube). Handles Font loading for 3D text generation.
- **`src/utils/gemini.ts`**: Interfaces with Google Gemini API to generate dynamic particle animation code based on user prompts.

### Technology Stack
- **Frontend**: React + Vite
- **3D Graphics**: Three.js (WebGL)
- **Computer Vision**: MediaPipe Tasks Vision (Client-side)
- **AI**: Google Generative AI SDK (Gemini)
- **Styling**: Tailwind CSS

## Development

### Commands
- **Install Dependencies**: `npm install`
- **Start Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Preview**: `npm run preview`

### Key Features
1.  **Particle System**: 20,000 particles using `BufferGeometry` for high performance.
2.  **Post-Processing**: UnrealBloomPass for neon glow effects.
3.  **Gesture Recognition**:
    - **Fist**: Saturn Shape
    - **V-Sign**: "I LOVE YOU" 3D Text
    - **Finger Heart**: Heart Shape
    - **Open Hand**: "HAPPY NEW YEAR" 3D Text
    - **None/Default**: Scattered Cube
4.  **Formation Animation**: When a new gesture is detected, the shape forms while facing front (rotation 0) for 2 seconds before starting to spin.
5.  **AI Magic**: Dynamic code generation via Gemini. Users can input a prompt to animate particles in real-time.

### Configuration
- **Gemini API Key**: Required for the "AI Magic" feature. The user must input this in the UI modal.
- **Font**: Loads `helvetiker_bold.typeface.json` from Three.js examples CDN.

## Notes
- The application uses `new Function()` to execute AI-generated code. This is sandboxed within the particle update loop.
- MediaPipe WASM files are loaded from jsDelivr CDN.
- `GestureParticles` uses `requestAnimationFrame` for the render loop, independent of React renders, but syncs with React state for gestures and AI mode.