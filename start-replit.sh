#!/bin/bash

echo "🚀 Starting Audio Chat Application..."

# Check if this is a production deployment
if [ "$NODE_ENV" = "production" ] || [ "$REPL_DEPLOYMENT" = "1" ]; then
    echo "🏭 Production mode detected"
    
    # Source the Nix environment to ensure npm is available
    if [ -f ~/.bashrc ]; then
        source ~/.bashrc
    fi

    # Add common npm paths
    export PATH="/nix/store/$(ls /nix/store/ | grep nodejs-20 | head -1)/bin:$PATH"

    # Verify npm is available
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found. Trying to locate it..."
        # Find npm in the Nix store
        NPM_PATH=$(find /nix/store -name "npm" -type f 2>/dev/null | grep nodejs | head -1)
        if [ -n "$NPM_PATH" ]; then
            export PATH="$(dirname $NPM_PATH):$PATH"
            echo "✅ Found npm at $NPM_PATH"
        else
            echo "❌ Could not locate npm. Please check Nix configuration."
            exit 1
        fi
    fi

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

    echo "🌐 Starting production server..."
    NODE_ENV=production exec node server.js

else
    echo "🔧 Development mode detected"
    
    # Source the Nix environment to ensure npm is available
    if [ -f ~/.bashrc ]; then
        source ~/.bashrc
    fi

    # Add common npm paths
    export PATH="/nix/store/$(ls /nix/store/ | grep nodejs-20 | head -1)/bin:$PATH"

    # Verify npm is available
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found. Trying to locate it..."
        # Find npm in the Nix store
        NPM_PATH=$(find /nix/store -name "npm" -type f 2>/dev/null | grep nodejs | head -1)
        if [ -n "$NPM_PATH" ]; then
            export PATH="$(dirname $NPM_PATH):$PATH"
            echo "✅ Found npm at $NPM_PATH"
        else
            echo "❌ Could not locate npm. Please check Nix configuration."
            exit 1
        fi
    fi

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
    echo "🖥️  Starting backend server on port 3001..."
    npm run dev &
    BACKEND_PID=$!

    # Start frontend preview server
    echo "🎨 Starting frontend server on port 4173..."
    cd frontend
    npm run preview -- --port 4173 --host 0.0.0.0 &
    FRONTEND_PID=$!
    cd ..

    # Function to cleanup processes on exit
    cleanup() {
        echo "🛑 Shutting down servers..."
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
        exit
    }

    # Set trap to cleanup on script exit
    trap cleanup SIGINT SIGTERM

    echo "✅ Both servers are running!"
    echo "📍 Backend API: http://localhost:3001"
    echo "📍 Frontend: http://localhost:4173"
    echo "Press Ctrl+C to stop both servers"

    # Wait for both processes
    wait
fi