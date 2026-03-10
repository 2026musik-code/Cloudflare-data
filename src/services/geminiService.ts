import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
let currentKey: string | null = null;

const getAI = (userKey?: string) => {
  const key = (userKey && userKey.trim() !== "") 
    ? userKey 
    : localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY || "";
  
  if (!key) {
    throw new Error("Gemini API Key is missing. Please set it in Settings.");
  }

  if (!aiInstance || currentKey !== key) {
    aiInstance = new GoogleGenAI({ apiKey: key });
    currentKey = key;
  }
  return aiInstance;
};

const cleanCode = (text: string) => {
  // Remove markdown code blocks (e.g., ```javascript ... ``` or ``` ... ```)
  const codeBlockRegex = /```(?:javascript|js|typescript|ts|html)?\s*([\s\S]*?)```/i;
  const match = text.match(codeBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // If no code block found, remove any leading/trailing backticks and language identifiers
  return text
    .replace(/^```(?:javascript|js|typescript|ts|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
};

export const generateWorkerCode = async (prompt: string, userKey?: string, model: string = "gemini-3-flash-preview") => {
  try {
    const ai = getAI(userKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: `Generate a robust, production-ready Cloudflare Worker script based on this requirement: ${prompt}. 
      
      STRICT RULES:
      1. Use the Service Worker format (using addEventListener('fetch', ...)).
      2. Include robust error handling (try/catch blocks) for all asynchronous operations.
      3. Add descriptive comments explaining the logic.
      4. Implement proper HTTP method handling (GET, POST, etc.) if applicable.
      5. Include basic logging for debugging purposes.
      6. Return ONLY the JavaScript code. 
      7. DO NOT include any markdown backticks (e.g., no \`\`\`javascript).
      8. DO NOT include any explanations, headers, or comments outside the code.
      9. Ensure all variables are properly defined with 'const' or 'let'.
      10. If you use a template literal for HTML, ensure it is properly quoted with backticks (\`).`,
      config: {
        temperature: 0.5, // Lower temperature for more consistent, professional code
      },
    });
    return cleanCode(response.text);
  } catch (error: any) {
    console.error("Gemini Generate Code Error:", error);
    throw error;
  }
};

export const validateKey = async (key: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "ping",
    });
    return !!response.text;
  } catch (error) {
    console.error("Key validation failed:", error);
    return false;
  }
};

export const analyzeWorker = async (code: string, userKey?: string, model: string = "gemini-3-flash-preview") => {
  try {
    const ai = getAI(userKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: `Analyze this Cloudflare Worker code for security, performance, and best practices:
      
      ${code}
      
      Provide a concise summary and suggestions.`,
    });
    return response.text;
  } catch (error: any) {
    console.error("Gemini Analyze Worker Error:", error);
    throw error;
  }
};

export const chatWithAI = async (message: string, context?: string, userKey?: string, model: string = "gemini-3-flash-preview") => {
  try {
    const ai = getAI(userKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: message,
      config: {
        systemInstruction: `You are a Cloudflare expert assistant. You help users manage their Workers and DNS records. 
        Context about the current state: ${context || "No context provided"}.
        Be professional, concise, and helpful.
        
        FORMATTING RULES:
        1. Use **bold** for important terms.
        2. Use [IMPORTANT: ...] for critical warnings or labels.
        3. Use [TIP: ...] for helpful hints.
        4. Use [SUCCESS: ...] for successful operations.
        5. If you provide web code (HTML/CSS/JS), wrap it in a code block with the language specified (e.g., \`\`\`html).
        6. Use clear headings and bullet points to keep responses neat.`,
      },
    });
    return response.text;
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};

export const improveWorkerCode = async (code: string, prompt: string, userKey?: string, model: string = "gemini-3-flash-preview") => {
  try {
    const ai = getAI(userKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: `Improve or modify this Cloudflare Worker script based on this requirement: ${prompt}.
      
      Current Code:
      ${code}
      
      STRICT RULES:
      1. Use the Service Worker format (using addEventListener('fetch', ...)).
      2. Include robust error handling (try/catch blocks) for all asynchronous operations.
      3. Add descriptive comments explaining the logic.
      4. Implement proper HTTP method handling (GET, POST, etc.) if applicable.
      5. Include basic logging for debugging purposes.
      6. Return ONLY the improved JavaScript code. 
      7. DO NOT include any markdown backticks (e.g., no \`\`\`javascript).
      8. DO NOT include any explanations, headers, or comments outside the code.
      9. Ensure all variables are properly defined with 'const' or 'let'.
      10. If you use a template literal for HTML, ensure it is properly quoted with backticks (\`).`,
      config: {
        temperature: 0.5, // Lower temperature for more consistent, professional code
      },
    });
    return cleanCode(response.text);
  } catch (error: any) {
    console.error("Gemini Improve Code Error:", error);
    throw error;
  }
};
