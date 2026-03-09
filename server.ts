import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for Cloudflare API to avoid CORS issues
  app.all("/api/cloudflare/*", async (req, res) => {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: "No API Token provided" });
    }

    const cfPath = req.params[0];
    const url = `https://api.cloudflare.com/client/v4/${cfPath}`;

    try {
      const response = await axios({
        method: req.method,
        url,
        headers: {
          Authorization: token,
          "Content-Type": req.headers["content-type"] || "application/json",
        },
        params: req.query,
        data: req.body,
        responseType: 'text', // Get raw response to handle scripts
      });
      
      // Try to parse as JSON if possible, otherwise send as is
      try {
        const jsonData = JSON.parse(response.data);
        res.status(response.status).json(jsonData);
      } catch {
        res.status(response.status).send(response.data);
      }
    } catch (error: any) {
      console.error("Cloudflare Proxy Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Internal Server Error" });
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
