import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import fs from "fs";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const STORAGE_DIR = path.join(process.cwd(), ".storage");

  // Create storage directory if it doesn't exist
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  app.use(express.json());
  app.use(express.text({ type: ['application/javascript', 'text/plain', 'application/octet-stream'] }));

  // Storage API to simulate R2 in local dev
  app.get("/api/storage/:filename", (req, res) => {
    const filePath = path.join(STORAGE_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      try {
        res.json(JSON.parse(data));
      } catch {
        res.send(data);
      }
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  app.put("/api/storage/:filename", (req, res) => {
    const filePath = path.join(STORAGE_DIR, req.params.filename);
    const data = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    fs.writeFileSync(filePath, data);
    res.json({ success: true });
  });

  // Proxy for Cloudflare API to avoid CORS issues
  app.all("/api/cloudflare/*", async (req, res) => {
    let token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: "No API Token provided" });
    }

    // Ensure token has Bearer prefix if it's a token, but don't double it
    if (!token.startsWith("Bearer ") && !token.startsWith("bearer ")) {
      token = `Bearer ${token}`;
    }

    const cfPath = req.params[0];
    const url = `https://api.cloudflare.com/client/v4/${cfPath}`;

    const headers: any = {
      Authorization: token,
      "User-Agent": "Dashbro-AI/1.1.0",
    };

    // Forward content-type if present
    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }

    // Ensure data is sent correctly based on content-type
    let data = req.body;
    if (req.method !== "GET" && typeof data === 'object' && Object.keys(data).length === 0 && req.headers["content-type"]?.includes('javascript')) {
      // This might happen if express.json() parsed an empty body or if it's not a string
      // But express.text should have caught it.
    }

    try {
      const response = await axios({
        method: req.method,
        url,
        headers,
        params: req.query,
        data: req.method !== "GET" ? data : undefined,
        responseType: 'text',
      });
      
      try {
        const jsonData = JSON.parse(response.data);
        res.status(response.status).json(jsonData);
      } catch {
        res.status(response.status).send(response.data);
      }
    } catch (error: any) {
      console.error("Cloudflare Proxy Error:", error.response?.data || error.message);
      const errorData = error.response?.data;
      
      // If it's a string (like a script error), send it as is, otherwise parse
      if (typeof errorData === 'string') {
        try {
          res.status(error.response?.status || 500).json(JSON.parse(errorData));
        } catch {
          res.status(error.response?.status || 500).send(errorData);
        }
      } else {
        res.status(error.response?.status || 500).json(errorData || { error: "Internal Server Error" });
      }
    }
  });

  // Catch-all for unknown API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
