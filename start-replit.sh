#!/bin/bash

echo "🚀 Starting Audio Chat Application..."

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Install frontend dependencies and build
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

echo "🔨 Building frontend..."
npm run build
cd ..

echo "🌐 Starting servers..."

# Start backend server in background
echo "🖥️  Starting backend server on port 3000..."
npm run dev &
BACKEND_PID=$!

# Start frontend preview server
echo "🎨 Starting frontend server on port 4173..."
cd frontend
npm run preview -- --port 4173 --host 0.0.0.0 &
FRONTEND_PID=$!

# Function to cleanup processes on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

echo "✅ Both servers are running!"
echo "📍 Backend API: http://localhost:3000"
echo "📍 Frontend: http://localhost:4173"
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait 