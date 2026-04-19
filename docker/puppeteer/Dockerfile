# Puppeteer PDF generation container
# Source: https://pptr.dev/troubleshooting
#
# Uses Debian-based image (NOT Alpine) per RESEARCH.md recommendation.
# Alpine causes font rendering issues in Puppeteer.
FROM node:22-slim

# Install Chrome dependencies for Debian
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user for security
RUN groupadd -r pptruser && useradd -r -g pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy browser server script
COPY browser-server.js ./

# Change ownership to non-root user
RUN chown -R pptruser:pptruser /app

USER pptruser

# Expose WebSocket endpoint (default port)
EXPOSE 3100

# Chrome sandbox args for container
CMD ["node", "browser-server.js"]
