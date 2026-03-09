import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

    if (req.headers["content-type"] && req.method !== "GET") {
      headers["Content-Type"] = req.headers["content-type"];
    }

    try {
      const response = await axios({
        method: req.method,
        url,
        headers,
        params: req.query,
        data: req.method !== "GET" ? req.body : undefined,
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
