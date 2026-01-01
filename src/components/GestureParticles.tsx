import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { HandTracker, detectGesture } from '../utils/handDetection';
import { ShapeGenerator } from '../utils/shapes';
import { generateParticleCode } from '../utils/gemini';

const PARTICLE_COUNT = 20000;

export default function GestureParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [gesture, setGesture] = useState("None");
  const [apiKey, setApiKey] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiError, setAiError] = useState("");
  const [isAiActive, setIsAiActive] = useState(false);
  
  // Refs for Three.js objects to avoid re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const shapeGenRef = useRef<ShapeGenerator | null>(null);
  const handTrackerRef = useRef<HandTracker | null>(null);
  const aiUpdateFnRef = useRef<Function | null>(null);
  
  // Animation state
  const targetPositionsRef = useRef<Float32Array | null>(null);
  const targetColorsRef = useRef<Float32Array | null>(null);
  const currentPositionsRef = useRef<Float32Array | null>(null);
  const currentColorsRef = useRef<Float32Array | null>(null);
  const lastGestureRef = useRef<string>("None");
  const formationStartTimeRef = useRef<number>(0);

  useEffect(() => {
    init();
    return () => {
      // Cleanup
      rendererRef.current?.dispose();
    };
  }, []);

  const init = async () => {
    if (!containerRef.current) return;

    // 1. Setup Three.js
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 35;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Post Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.1;
    bloomPass.strength = 0.8;
    bloomPass.radius = 0;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // Particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    // Initial random positions
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 50;
      colors[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometryRef.current = geometry;

    const material = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // State Arrays
    currentPositionsRef.current = positions.slice();
    currentColorsRef.current = colors.slice();
    targetPositionsRef.current = positions.slice();
    targetColorsRef.current = colors.slice();

    // 2. Initialize Helpers
    const shapeGen = new ShapeGenerator();
    await shapeGen.loadFont();
    shapeGenRef.current = shapeGen;

    const tracker = new HandTracker();
    await tracker.initialize();
    handTrackerRef.current = tracker;

    // Start Camera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    }

    setLoading(false);
    animate();
  };

  const animate = () => {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.001;

    // 1. Hand Detection
    if (handTrackerRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      const results = handTrackerRef.current.detect(videoRef.current);
      if (results && results.landmarks) {
        const detected = detectGesture(results.landmarks);
        setGesture(detected);
        handleGesture(detected, time);
      }
    }

    // 2. Update Particles
    if (geometryRef.current && particlesRef.current) {
      const positions = geometryRef.current.attributes.position.array as Float32Array;
      const colors = geometryRef.current.attributes.color.array as Float32Array;

      if (isAiActive && aiUpdateFnRef.current) {
        // AI Mode: Execute dynamic code
        try {
          aiUpdateFnRef.current(PARTICLE_COUNT, time, positions, colors);
          geometryRef.current.attributes.position.needsUpdate = true;
          geometryRef.current.attributes.color.needsUpdate = true;
          
          // Sync current refs for smooth transition out
          currentPositionsRef.current?.set(positions);
          currentColorsRef.current?.set(colors);
        } catch (e) {
          console.error("AI Code Error", e);
          setIsAiActive(false);
        }
      } else {
        // Standard Mode: Lerp to target
        const lerpFactor = 0.05;
        const targetPos = targetPositionsRef.current;
        const targetCol = targetColorsRef.current;

        if (targetPos && targetCol) {
          for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
            positions[i] += (targetPos[i] - positions[i]) * lerpFactor;
            colors[i] += (targetCol[i] - colors[i]) * lerpFactor;
          }
          geometryRef.current.attributes.position.needsUpdate = true;
          geometryRef.current.attributes.color.needsUpdate = true;
        }
      }
      
      // Rotate particles slowly
      const formationDuration = 2.0;
      const elapsed = time - formationStartTimeRef.current;
      
      if (elapsed < formationDuration) {
        particlesRef.current.rotation.y = 0;
      } else {
        particlesRef.current.rotation.y = (elapsed - formationDuration) * 0.1;
      }
    }

    // 3. Render
    if (composerRef.current) {
      composerRef.current.render();
    }
  };

  const handleGesture = (gestureName: string, time: number) => {
    if (isAiActive) return; // Don't override AI magic with gestures
    if (!shapeGenRef.current) return;

    // Only update if gesture changed
    if (gestureName === lastGestureRef.current) return;
    lastGestureRef.current = gestureName;
    
    // Reset formation time
    formationStartTimeRef.current = time;

    let shapeData;

    switch (gestureName) {
      case "Fist": // Saturn
        shapeData = shapeGenRef.current.getSaturn(PARTICLE_COUNT);
        break;
      case "V-Sign": // Text
        shapeData = shapeGenRef.current.getText(PARTICLE_COUNT, "I LOVE YOU");
        break;
      case "Finger Heart": // Heart
        shapeData = shapeGenRef.current.getHeart(PARTICLE_COUNT);
        break;
      case "Open Hand": // Sphere
        shapeData = shapeGenRef.current.getText(PARTICLE_COUNT, "HAPPY NEW YEAR");
        break;
      case "None":
      default:
        // Back to scattered (Cube)
        shapeData = shapeGenRef.current.getCube(PARTICLE_COUNT);
        break;
    }

    if (shapeData) {
      targetPositionsRef.current = shapeData.positions;
      targetColorsRef.current = shapeData.colors;
    }
  };

  const handleAiGenerate = async () => {
    if (!apiKey) {
      setAiError("Please enter a Gemini API Key");
      return;
    }
    setLoading(true);
    setAiError("");
    
    try {
      const code = await generateParticleCode(apiKey, prompt);
      // Create optimized function
      // We wrap the user code in a loop for performance
      const fullBody = `
        for (let i = 0; i < count; i++) {
          ${code}
        }
      `;
      const fn = new Function('count', 'time', 'positions', 'colors', fullBody);
      aiUpdateFnRef.current = fn;
      setIsAiActive(true);
      setShowModal(false);
    } catch (err: any) {
      setAiError(err.message || "Failed to generate code");
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-black overflow-hidden font-sans">
      {/* Webcam Preview */}
      <video 
        ref={videoRef} 
        className="absolute top-4 left-4 w-48 h-36 object-cover rounded-xl border-2 border-white/20 shadow-lg transform -scale-x-100 z-10"
        muted 
        playsInline
      />

      {/* UI Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-4 z-10">
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 text-white">
          <h2 className="text-xs uppercase tracking-widest text-white/60 mb-1">Detected Gesture</h2>
          <div className="text-2xl font-bold text-cyan-400">{gesture}</div>
        </div>

        <button 
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform"
        >
          ✨ AI Magic
        </button>

        <button 
          onClick={() => setIsAiActive(false)}
          className={`bg-gray-800 text-white p-2 rounded-xl text-sm ${!isAiActive ? 'hidden' : ''}`}
        >
          Stop AI
        </button>

        <button 
          onClick={toggleFullscreen}
          className="bg-white/10 text-white p-2 rounded-xl hover:bg-white/20"
        >
          ⛶ Fullscreen
        </button>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 text-white">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">🌀</div>
            <p>Initializing Magic...</p>
          </div>
        </div>
      )}

      {/* AI Modal */}
      {showModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-gray-900 p-6 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
            <h3 className="text-xl text-white font-bold mb-4">Generate Particle Magic</h3>
            
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Gemini API Key</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded p-2 text-white focus:outline-none focus:border-purple-500"
                placeholder="Enter your API Key"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs text-gray-400 mb-1">Describe the Effect</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded p-2 text-white h-24 focus:outline-none focus:border-purple-500"
                placeholder="e.g., 'A spiral galaxy that pulses with music', 'Matrix rain code', 'Exploding fireworks'"
              />
            </div>

            {aiError && <p className="text-red-400 text-sm mb-4">{aiError}</p>}

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button 
                onClick={handleAiGenerate}
                disabled={loading}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold"
              >
                {loading ? 'Generating...' : 'Cast Spell'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
        <div className="inline-block bg-black/50 backdrop-blur px-6 py-3 rounded-full border border-white/10 text-white/80 text-sm">
          ✊ Saturn &nbsp;•&nbsp; ✌️ I Love You &nbsp;•&nbsp; 🤌 Heart &nbsp;•&nbsp; 🖐 Happy NY
        </div>
      </div>
    </div>
  );
}
