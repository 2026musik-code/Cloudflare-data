import axios from 'axios';

let currentKey: string | null = null;

const getAIConfig = (userKey?: string) => {
  const key = (userKey && userKey.trim() !== "") 
    ? userKey 
    : localStorage.getItem('gemini_api_key') || "";
  
  if (!key) {
    throw new Error("API Key is missing. Please set it in Settings.");
  }

  currentKey = key;
  return {
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  };
};

const cleanCode = (text: string) => {
  const codeBlockRegex = /```(?:javascript|js|typescript|ts|html)?\s*([\s\S]*?)```/i;
  const match = text.match(codeBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return text
    .replace(/^```(?:javascript|js|typescript|ts|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
};

export const fetchModels = async (userKey?: string) => {
  try {
    const config = getAIConfig(userKey);
    const response = await axios.get('/api/azkha/models', config);
    return response.data.data.map((m: any) => m.id);
  } catch (error: any) {
    // Only log the message to avoid huge stack traces in the console,
    // especially when the external API is offline (e.g. 530 Argo Tunnel error).
    console.warn(`Could not fetch models from API: ${error.message}. Using fallback models.`);
    // Fallback list as in the python script
    return [
      // Kilo Code
      "kc/anthropic/claude-sonnet-4-20250514", "kc/anthropic/claude-opus-4-20250514",
      "kc/google/gemini-2.5-pro", "kc/google/gemini-2.5-flash",
      "kc/openai/gpt-4.1", "kc/openai/o3",
      "kc/deepseek/deepseek-chat", "kc/deepseek/deepseek-reasoner",
      "kc/kilo-auto/free", "kc/openrouter/free", "kc/tencent/hy3:free",
      "kc/nvidia/nemotron-3-super-120b-a12b:free", "kc/nvidia/nemotron-3-ultra-550b-a55b:free",
      "kc/poolside/laguna-m.1:free", "kc/cohere/north-mini-code:free", "kc/google/lyria-3-pro-preview",
      "kc/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "kc/google/lyria-3-clip-preview",
      "kc/poolside/laguna-xs.2.1:free", "kc/stepfun/step-3.7-flash:free",
      // Antigravity
      "ag/gemini-3-flash-agent", "ag/gemini-3.5-flash-low", "ag/gemini-3.5-flash-extra-low",
      "ag/gemini-pro-agent", "ag/gemini-3.1-pro-low", "ag/claude-sonnet-4-6",
      "ag/claude-opus-4-6-thinking", "ag/gpt-oss-120b-medium", "ag/gemini-3-flash",
      // Cline
      "cl/anthropic/claude-opus-4.7", "cl/anthropic/claude-sonnet-4.6", "cl/anthropic/claude-opus-4.6",
      "cl/openai/gpt-5.3-codex", "cl/openai/gpt-5.4", "cl/google/gemini-3.1-pro-preview",
      "cl/google/gemini-3.1-flash-lite-preview", "cl/kwaipilot/kat-coder-pro",
      // Kiro AI
      "kr/claude-sonnet-5", "kr/claude-sonnet-4.5", "kr/claude-haiku-4.5", "kr/deepseek-3.2",
      "kr/qwen3-coder-next", "kr/glm-5", "kr/MiniMax-M2.5", "kr/claude-sonnet-5-thinking",
      "kr/claude-sonnet-4.5-thinking", "kr/claude-haiku-4.5-thinking", "kr/claude-sonnet-5-agentic",
      "kr/claude-sonnet-4.5-agentic", "kr/claude-haiku-4.5-agentic", "kr/claude-sonnet-5-thinking-agentic",
      "kr/claude-sonnet-4.5-thinking-agentic", "kr/claude-haiku-4.5-thinking-agentic",
      // NVIDIA NIM
      "nim/llama3", "nim/mixtral-8x22b", "nim/nemotron-4",
      // Cloudflare
      "cf/anthropic/claude-fable-5", "cf/@cf/meta/llama-3.2-1b-instruct", "cf/@cf/meta/llama-3.2-3b-instruct",
      "cf/@cf/meta/llama-3.1-8b-instruct-fp8-fast", "cf/@cf/meta/llama-3.1-8b-instruct-awq",
      "cf/@cf/mistralai/mistral-small-3.1-24b-instruct", "cf/@cf/meta/llama-3.1-70b-instruct-fp8-fast",
      "cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast", "cf/@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      "cf/@cf/moonshotai/kimi-k2.5", "cf/@cf/moonshotai/kimi-k2.6", "cf/@cf/zai-org/glm-4.7-flash",
      "cf/@cf/qwen/qwq-32b", "cf/@cf/qwen/qwen2.5-coder-32b-instruct",
      // Open Code Free
      "oc/north-mini-code-free", "oc/big-pickle", "oc/deepseek-v4-flash-free",
      "oc/mimo-v2.5-free", "oc/nemotron-3-ultra-free", "oc/hy3-free"
    ];
  }
};

export const generateWorkerCode = async (prompt: string, userKey?: string, model: string = "kc/google/gemini-2.5-pro") => {
  try {
    const config = getAIConfig(userKey);
    const response = await axios.post('/api/azkha/chat/completions', {
      model,
      messages: [
        {
          role: "system",
          content: `Generate a robust, production-ready Cloudflare Worker script based on this requirement: ${prompt}. 
      
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
      10. If you use a template literal for HTML, ensure it is properly quoted with backticks (\`).`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.5
    }, config);
    
    return cleanCode(response.data.choices[0].message.content);
  } catch (error: any) {
    if (error.response && error.response.status === 530) {
      console.warn("AI API is currently offline (Cloudflare 530 Argo Tunnel error).");
      throw new Error("The AI server is currently offline or unreachable (Error 530). Please try again later.");
    }
    console.error("Generate Code Error:", error.message || error);
    throw error;
  }
};

export const validateKey = async (key: string) => {
  try {
    const response = await axios.post('/api/azkha/chat/completions', {
      model: "kc/google/gemini-2.5-flash",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5
    }, {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });
    return !!response.data.choices;
  } catch (error) {
    console.error("Key validation failed:", error);
    return false;
  }
};

export const analyzeWorker = async (code: string, userKey?: string, model: string = "kc/google/gemini-2.5-pro") => {
  try {
    const config = getAIConfig(userKey);
    const response = await axios.post('/api/azkha/chat/completions', {
      model,
      messages: [
        {
          role: "user", 
          content: `Analyze this Cloudflare Worker code for security, performance, and best practices:\n\n${code}\n\nProvide a concise summary and suggestions.`
        }
      ]
    }, config);
    return response.data.choices[0].message.content;
  } catch (error: any) {
    if (error.response && error.response.status === 530) {
      console.warn("AI API is currently offline (Cloudflare 530 Argo Tunnel error).");
      throw new Error("The AI server is currently offline or unreachable (Error 530). Please try again later.");
    }
    console.error("Analyze Worker Error:", error.message || error);
    throw error;
  }
};



export const chatWithAI = async (
  history: any[],
  message: string,
  context?: string,
  userKey?: string,
  model: string = "kc/google/gemini-2.5-pro",
  tools?: any[]
) => {
  try {
    const config = getAIConfig(userKey);
    
    // Map history to OpenAI format
    const messages = [];
    messages.push({
      role: "system",
      content: `You are a Cloudflare expert assistant. You help users manage their Workers and DNS records. 
        Context about the current state: ${context || "No context provided"}.
        Be professional, concise, and helpful.
        
        FORMATTING RULES:
        1. Use **bold** for important terms.
        2. Use [IMPORTANT: ...] for critical warnings or labels.
        3. Use [TIP: ...] for helpful hints.
        4. Use [SUCCESS: ...] for successful operations.
        5. If you provide web code (HTML/CSS/JS), wrap it in a code block with the language specified (e.g., \`\`\`html).
        6. Use clear headings and bullet points to keep responses neat.
        
        CODE GENERATION RULES:
        1. When generating web applications, HTML, CSS, or JS code, ALWAYS aim for modern, beautiful, and highly polished designs.
        2. Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) for styling by default.
        3. Include modern typography (e.g., Inter or Roboto via Google Fonts), smooth animations, glassmorphism, and responsive layouts.
        4. DO NOT generate basic, plain, or outdated HTML. Make the UI look professional, like a modern SaaS application or a high-quality landing page.
        5. CRITICAL: When deploying a web app to a Worker, the 'workerCode' MUST be a valid Cloudflare Worker script. You CANNOT deploy raw HTML or React components directly. You MUST embed the HTML inside a Worker fetch handler.
        
        TOOL USAGE RULES:
        1. Use tools to actively perform tasks for the user. If the user asks you to create, deploy, read, or delete a worker, use the appropriate tool.
        2. If you deploy a worker, you do not need to use 'proposeWorker'.
        3. If the user is just asking for code examples, explanations, or general advice, provide the code in a markdown code block instead.
        4. When asked to create a full web application that requires storage (like KV or R2), you MUST first use the 'createKvNamespace' or 'createR2Bucket' tools to create the necessary resources.
        5. After creating the resources, use the 'deployWorker' tool and pass the 'bindings' parameter to link the created KV namespaces or R2 buckets to the worker. For KV, use type 'kv_namespace' and the returned 'id' as 'namespace_id'. For R2, use type 'r2_bucket' and the 'name' as 'bucket_name'.
        6. Once the deployment is complete, provide a summary to the user explaining what was created (e.g., "I created a KV namespace named 'my-kv' and deployed the worker 'my-app'").`
    });

    for (const h of history) {
      if (h.role === 'user') {
        const textParts = h.parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
        if (textParts) messages.push({ role: "user", content: textParts });
        
        // Handle tool outputs
        const toolResponses = h.parts.filter((p: any) => p.functionResponse);
        for (const tr of toolResponses) {
           messages.push({
             role: "tool",
             tool_call_id: tr.functionResponse.name + "_call", // mock ID
             content: JSON.stringify(tr.functionResponse.response)
           });
        }
      } else {
        // assistant
        messages.push({ role: "assistant", content: h.parts?.[0]?.text || h });
      }
    }

    if (message) {
      messages.push({ role: "user", content: message });
    }

    // Map tools to OpenAI format
    const openAITools = tools?.[0]?.functionDeclarations?.map((f: any) => {
      const properties: any = {};
      for (const [key, val] of Object.entries(f.parameters.properties as Record<string, any>)) {
        properties[key] = {
           type: typeof val.type === 'string' ? val.type.toLowerCase() : 'string',
           description: val.description
        };
        if (properties[key].type === 'array' && val.items) {
           properties[key].items = { type: typeof val.items.type === 'string' ? val.items.type.toLowerCase() : 'string' };
        }
      }
      return {
        type: "function",
        function: {
          name: f.name,
          description: f.description,
          parameters: {
            type: "object",
            properties: properties,
            required: f.parameters.required || []
          }
        }
      };
    });

    const response = await axios.post('/api/azkha/chat/completions', {
      model,
      messages,
      tools: openAITools,
      temperature: 0.5
    }, config);

    const choice = response.data.choices[0];
    const assistantMessage = choice.message;

    // Convert back to Google format so App.tsx doesn't break entirely
    const candidates = [{
      content: {
        role: "model",
        parts: [{ text: assistantMessage.content || "" }]
      }
    }];

    const functionCalls = assistantMessage.tool_calls?.map((tc: any) => {
      let args = {};
      try { args = JSON.parse(tc.function.arguments); } catch (e) {}
      return {
        name: tc.function.name,
        args: args
      };
    }) || [];

    return { candidates, functionCalls, text: assistantMessage.content || "" };
  } catch (error: any) {
    if (error.response && error.response.status === 530) {
      console.warn("AI API is currently offline (Cloudflare 530 Argo Tunnel error).");
      throw new Error("The AI server is currently offline or unreachable (Error 530). Please try again later.");
    }
    console.error("Chat Error:", error.message || error);
    throw error;
  }
};

export const improveWorkerCode = async (code: string, prompt: string, userKey?: string, model: string = "kc/google/gemini-2.5-pro") => {
  try {
    const config = getAIConfig(userKey);
    const response = await axios.post('/api/azkha/chat/completions', {
      model,
      messages: [
        {
          role: "system",
          content: `Improve or modify this Cloudflare Worker script based on this requirement: ${prompt}.
      
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
      10. If you use a template literal for HTML, ensure it is properly quoted with backticks (\`).`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.5
    }, config);
    return cleanCode(response.data.choices[0].message.content);
  } catch (error: any) {
    if (error.response && error.response.status === 530) {
      console.warn("AI API is currently offline (Cloudflare 530 Argo Tunnel error).");
      throw new Error("The AI server is currently offline or unreachable (Error 530). Please try again later.");
    }
    console.error("Improve Code Error:", error.message || error);
    throw error;
  }
};
