import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateWorkerCode = async (prompt: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Generate a Cloudflare Worker script based on this requirement: ${prompt}. 
    Return ONLY the JavaScript code, no markdown formatting if possible, or wrap it in a code block.`,
    config: {
      temperature: 0.7,
    },
  });
  return response.text;
};

export const analyzeWorker = async (code: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analyze this Cloudflare Worker code for security, performance, and best practices:
    
    ${code}
    
    Provide a concise summary and suggestions.`,
  });
  return response.text;
};

export const chatWithAI = async (message: string, context?: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: message,
    config: {
      systemInstruction: `You are a Cloudflare expert assistant. You help users manage their Workers and DNS records. 
      Context about the current state: ${context || "No context provided"}.
      Be professional, concise, and helpful.`,
    },
  });
  return response.text;
};
