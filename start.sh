#!/bin/bash

cleanup() {
    echo
    echo "Stopping client and server..."
    kill "$CLIENT_PID" "$SERVER_PID" 2>/dev/null
    wait
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "Starting client..."
(
    cd client || exit
    npm run dev
) &
CLIENT_PID=$!

echo "Starting server..."
(
    cd server || exit
    npm run dev
) &
SERVER_PID=$!

echo "Client PID: $CLIENT_PID"
echo "Server PID: $SERVER_PID"
echo "Press Ctrl+C to stop both."

wait
