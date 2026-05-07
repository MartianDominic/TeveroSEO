#!/bin/bash
# TeveroSEO Camoufox - Install System Dependencies
# Run as root on Ubuntu 22.04

set -e

echo "========================================"
echo "Installing Camoufox system dependencies"
echo "========================================"

# Update package lists
apt-get update

# Core dependencies for headless Firefox/Camoufox
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    wget \
    curl \
    jq

# Virtual display dependencies
apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    xauth

# Process management and monitoring
apt-get install -y \
    htop \
    iotop \
    procps \
    psmisc

# Node.js 20.x (if not already installed)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# PM2 (if not already installed)
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

echo ""
echo "System dependencies installed successfully."
echo "Node.js version: $(node --version)"
echo "PM2 version: $(pm2 --version)"
