import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateParticleCode = async (apiKey: string, prompt: string) => {
  if (!apiKey) throw new Error("API Key is required");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const systemPrompt = `
    You are a graphics programming expert. 
    Generate a JavaScript loop body to calculate particle positions and colors based on a user description.
    
    Context:
    - You have access to these variables:
      - 'i': current particle index (0 to count-1)
      - 'count': total number of particles
      - 'time': current animation time in seconds
      - 'positions': Float32Array (x, y, z)
      - 'colors': Float32Array (r, g, b)
    
    Requirements:
    - Output ONLY the raw JavaScript code for the loop body.
    - DO NOT wrap in a function or markdown code blocks.
    - DO NOT use 'return'.
    - Assign values to 'positions[i * 3]', 'positions[i * 3 + 1]', 'positions[i * 3 + 2]'.
    - Assign values to 'colors[i * 3]', 'colors[i * 3 + 1]', 'colors[i * 3 + 2]'.
    - Use Math functions (Math.sin, Math.cos, etc.).
    - The shape should be centered at (0,0,0).
    - Scale should be roughly within -10 to 10 range.
  `;

  const result = await model.generateContent([systemPrompt, `User Prompt: ${prompt}`]);
  const response = result.response;
  let text = response.text();
  
  // Clean up markdown if present
  text = text.replace(/```javascript/g, "").replace(/```/g, "").trim();
  
  return text;
};
