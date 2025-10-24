.PHONY: help start stop restart logs status clean install

# Default target
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🌺 Hawaii Agent Development Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  make start      - Start all services"
	@echo "  make stop       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo "  make status     - Check service status"
	@echo "  make logs       - Tail all logs"
	@echo "  make install    - Install dependencies"
	@echo "  make clean      - Clean logs and temp files"
	@echo ""

# Start all services
start:
	@echo "🚀 Starting all services..."
	@./start-dev.sh &

# Stop all services
stop:
	@./stop-dev.sh

# Restart all services
restart: stop
	@sleep 2
	@$(MAKE) start

# Check status of services
status:
	@echo "📊 Service Status:"
	@echo ""
	@echo "🔍 MCP Server (4100):"
	@curl -s http://localhost:4100/mcp > /dev/null 2>&1 && echo "  ✅ Running" || echo "  ❌ Not running"
	@echo ""
	@echo "🔍 Backend API (4000):"
	@curl -s http://localhost:4000/health > /dev/null 2>&1 && echo "  ✅ Running" || echo "  ❌ Not running"
	@echo ""
	@echo "🔍 Frontend (3000):"
	@curl -s http://localhost:3000 > /dev/null 2>&1 && echo "  ✅ Running" || echo "  ❌ Not running"
	@echo ""
	@echo "📋 Running processes:"
	@ps aux | grep -E "(tsx|next dev)" | grep -v grep || echo "  No services running"

# Tail logs
logs:
	@echo "📋 Tailing logs (Ctrl+C to stop)..."
	@tail -f /tmp/mcp-server.log /tmp/backend-server.log /tmp/frontend.log 2>/dev/null || echo "No logs found. Start services first."

# Install dependencies
install:
	@echo "📦 Installing root dependencies..."
	@pnpm install
	@echo "📦 Installing frontend dependencies..."
	@cd frontend && pnpm install

# Clean logs and temp files
clean:
	@echo "🧹 Cleaning logs and temp files..."
	@rm -f /tmp/mcp-server.log /tmp/backend-server.log /tmp/frontend.log
	@echo "✅ Clean complete"

