#!/bin/bash

echo "🚀 Deploying Audio Chat Application to Production..."

# Set production environment
export NODE_ENV=production

# Build and start the application
echo "📦 Installing dependencies and building..."
npm install

# Build frontend
echo "🔨 Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "🌐 Starting production server..."
echo "📍 Application will be available at: http://localhost:3000"

# Start the server
exec node server.js 