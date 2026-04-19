/**
 * Puppeteer browser server.
 *
 * Launches a headless Chrome instance and exposes it via WebSocket.
 * Other services connect to generate PDFs.
 */
const puppeteer = require("puppeteer-core");
const http = require("http");

const PORT = process.env.PORT || 3100;

async function startBrowser() {
  console.log("Starting Puppeteer browser...");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--single-process",
      "--no-zygote",
    ],
  });

  const wsEndpoint = browser.wsEndpoint();
  console.log(`Browser WebSocket endpoint: ${wsEndpoint}`);

  // Simple health check server
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200);
      res.end("ok");
    } else if (req.url === "/ws") {
      // Return the WebSocket endpoint for discovery
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ wsEndpoint }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(PORT, () => {
    console.log(`Health check server on port ${PORT}`);
    // Output wsEndpoint to stdout for container orchestration
    console.log(`PUPPETEER_WS_ENDPOINT=${wsEndpoint}`);
  });

  // Handle shutdown gracefully
  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down browser...`);
    try {
      await browser.close();
      server.close();
    } catch (err) {
      console.error("Error during shutdown:", err);
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Keep process alive
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    // Don't exit - keep the browser running
  });
}

startBrowser().catch((err) => {
  console.error("Failed to start browser:", err);
  process.exit(1);
});
