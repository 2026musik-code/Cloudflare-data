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

export const generateWorkerCode = async (prompt: string, userKey?: string) => {
  try {
    const ai = getAI(userKey);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a Cloudflare Worker script based on this requirement: ${prompt}. 
      Return ONLY the JavaScript code, no markdown formatting if possible, or wrap it in a code block.`,
      config: {
        temperature: 0.7,
      },
    });
    return response.text;
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

export const analyzeWorker = async (code: string, userKey?: string) => {
  try {
    const ai = getAI(userKey);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

export const chatWithAI = async (message: string, context?: string, userKey?: string) => {
  try {
    const ai = getAI(userKey);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: `You are a Cloudflare expert assistant. You help users manage their Workers and DNS records. 
        Context about the current state: ${context || "No context provided"}.
        Be professional, concise, and helpful.`,
      },
    });
    return response.text;
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};
