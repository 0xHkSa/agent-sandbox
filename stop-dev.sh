#!/bin/bash
# Stop all development servers

echo "🛑 Stopping all services..."

# Kill MCP server
pkill -9 -f "src/mcp/server.mcp.ts" 2>/dev/null

# Kill backend API server
pkill -9 -f "src/server.ts" 2>/dev/null

# Kill Next.js frontend (both "next dev" and "next-server" processes)
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null

sleep 1

# Verify all stopped
RUNNING=$(ps aux | grep -E "(src/mcp/server.mcp.ts|src/server.ts|next-server)" | grep -v grep)
if [ -n "$RUNNING" ]; then
    echo "⚠️  Some processes may still be running:"
    echo "$RUNNING"
    echo ""
    echo "💡 Try manually killing them:"
    echo "   pkill -9 -f next-server"
else
    echo "✅ All services stopped successfully"
fi

