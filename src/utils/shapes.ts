import * as THREE from 'three';
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader.js';

export class ShapeGenerator {
  font: Font | null = null;
  loader = new FontLoader();

  async loadFont(url: string = 'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json') {
    return new Promise<void>((resolve, reject) => {
      this.loader.load(url, (font) => {
        this.font = font;
        resolve();
      }, undefined, reject);
    });
  }

  getSaturn(count: number): { positions: Float32Array, colors: Float32Array } {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sphereCount = Math.floor(count * 0.4);
    const ringCount = count - sphereCount;

    // Sphere (Blue)
    for (let i = 0; i < sphereCount; i++) {
      const r = 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = 0.1;
      colors[i * 3 + 1] = 0.3;
      colors[i * 3 + 2] = 0.9;
    }

    // Rings (Beige/Gold)
    for (let i = sphereCount; i < count; i++) {
      const innerR = 9;
      const outerR = 14;
      const r = innerR + Math.random() * (outerR - innerR);
      const theta = Math.random() * Math.PI * 2;

      const x = r * Math.cos(theta);
      const y = (Math.random() - 0.5) * 0.5; // Flat
      const z = r * Math.sin(theta);

      // Tilt
      const tilt = Math.PI / 6;
      const yTilted = y * Math.cos(tilt) - z * Math.sin(tilt);
      const zTilted = y * Math.sin(tilt) + z * Math.cos(tilt);

      positions[i * 3] = x;
      positions[i * 3 + 1] = yTilted;
      positions[i * 3 + 2] = zTilted;

      colors[i * 3] = 0.8;
      colors[i * 3 + 1] = 0.7;
      colors[i * 3 + 2] = 0.4;
    }

    return { positions, colors };
  }

  getHeart(count: number): { positions: Float32Array, colors: Float32Array } {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    // Reduce particle count for heart to avoid excessive brightness
    const activeCount = Math.min(count, 4000);

    for (let i = 0; i < count; i++) {
      if (i >= activeCount) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        continue;
      }

      // Parametric Heart
      // x = 16sin^3(t)
      // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
      
      const t = Math.random() * Math.PI * 2;
      // Add some volume
      const scale = 0.5;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const z = (Math.random() - 0.5) * 4; // Thickness

      positions[i * 3] = x * scale;
      positions[i * 3 + 1] = y * scale;
      positions[i * 3 + 2] = z * scale;

      // Pink
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.4;
      colors[i * 3 + 2] = 0.7;
    }

    return { positions, colors };
  }

  getText(count: number, text: string = "I LOVE YOU"): { positions: Float32Array, colors: Float32Array } {
    if (!this.font) return this.getSphere(count); // Fallback

    // Adjust size based on text length
    const isLongText = text.length > 10;
    const fontSize = isLongText ? 2.5 : 3.5;

    const shapes = this.font.generateShapes(text, fontSize);
    
    // Collect all paths (shapes + holes) to sample from outlines
    const paths: THREE.Path[] = [];
    shapes.forEach(shape => {
      paths.push(shape);
      if (shape.holes && shape.holes.length > 0) {
        shape.holes.forEach(hole => paths.push(hole as THREE.Path));
      }
    });

    // Calculate total length for weighted sampling
    const lengths: number[] = [];
    let totalLength = 0;
    paths.forEach(path => {
      const len = path.getLength();
      lengths.push(len);
      totalLength += len;
    });

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    // Limit active particles for outline style
    // Reduced count to avoid excessive brightness, similar to Heart shape
    const activeCount = Math.min(count, isLongText ? 3000 : 2000);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < activeCount; i++) {
      // Weighted random selection of path
      let r = Math.random() * totalLength;
      let selectedPath = paths[0];
      for (let j = 0; j < paths.length; j++) {
        if (r <= lengths[j]) {
          selectedPath = paths[j];
          break;
        }
        r -= lengths[j];
      }

      // Point on path
      const u = Math.random();
      const point = selectedPath.getPoint(u);

      // Add thickness (Z) - similar to Heart shape
      // Heart uses (random - 0.5) * 4 * 0.5 = range 2.0
      const z = (Math.random() - 0.5) * 2.0;

      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = z;

      // Track bounds for centering
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;

      // Gold/Yellow color
      colors[i * 3] = 0.8;
      colors[i * 3 + 1] = 0.6;
      colors[i * 3 + 2] = 0.0;
    }

    // Center the text
    if (minX !== Infinity) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      for (let i = 0; i < activeCount; i++) {
        positions[i * 3] -= centerX;
        positions[i * 3 + 1] -= centerY;
      }
    }

    // Hide unused particles
    for (let i = activeCount; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0;
      colors[i * 3 + 2] = 0;
    }

    return { positions, colors };
  }

  getSphere(count: number): { positions: Float32Array, colors: Float32Array } {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 10 * Math.cbrt(Math.random()); // Uniform distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Rainbow
      const color = new THREE.Color().setHSL(Math.random(), 1.0, 0.5);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return { positions, colors };
  }

  getCube(count: number): { positions: Float32Array, colors: Float32Array } {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

      colors[i * 3] = Math.random();
      colors[i * 3 + 1] = Math.random();
      colors[i * 3 + 2] = Math.random();
    }

    return { positions, colors };
  }
}
