#!/bin/bash
# Auto-start script for development servers

set -e

echo "🚀 Starting Hawaii Agent Development Environment..."

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Stopping all services..."
    pkill -P $$ || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start MCP Server
echo "📡 Starting MCP Server on port 4100..."
cd /workspaces/agent-sandbox
pnpm mcp:server > /tmp/mcp-server.log 2>&1 &
MCP_PID=$!

# Wait a moment for MCP to start
sleep 2

# Start Backend API Server
echo "🔧 Starting Backend API Server on port 4000..."
pnpm dev:server > /tmp/backend-server.log 2>&1 &
API_PID=$!

# Wait a moment for backend to start
sleep 2

# Start Frontend
echo "🎨 Starting Frontend on port 3000..."
cd /workspaces/agent-sandbox/frontend
pnpm dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for services to be ready
sleep 3

echo ""
echo "✅ All services started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 MCP Server:     http://localhost:4100/mcp"
echo "🔧 Backend API:    http://localhost:4000"
echo "🎨 Frontend:       http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Logs available at:"
echo "   MCP:      tail -f /tmp/mcp-server.log"
echo "   Backend:  tail -f /tmp/backend-server.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running
wait

