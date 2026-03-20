#!/bin/bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Check if node_modules exists, if not, try to install
if [ ! -d "node_modules" ]; then
    echo "First time setup: Installing dependencies..."
    npm install
fi

# Start the server in the background
echo "Starting MintSync Server..."
npm start &

# Store the process ID to kill it later if needed
SERVER_PID=$!

# Wait for the server to initialize
sleep 2

# Open the browser to the local app
echo "Opening MintSync in your browser..."
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3000
elif command -v gnome-open > /dev/null; then
    gnome-open http://localhost:3000
else
    echo "Could not detect a browser opener. Please manually go to http://localhost:3000"
fi

# Keep the script running so the server doesn't die immediately
# and wait for the user to close the terminal or stop the process
wait $SERVER_PID
