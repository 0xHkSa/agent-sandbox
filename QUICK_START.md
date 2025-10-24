# ⚡ Quick Start

## From Your Local Machine Terminal

### Option 1: Use the Control Script (Easiest!)
```bash
# Make sure the script is executable first (one time only)
chmod +x ./hawaii

# Then use it:
./hawaii start       # Start all services
./hawaii stop        # Stop all services
./hawaii status      # Check status
./hawaii logs        # View logs
./hawaii shell       # Open shell in container
```

### Option 2: Use Docker Compose
```bash
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs -f   # View logs
```

### Option 3: Execute Commands in Container
```bash
# Find your container name
docker ps

# Execute commands
docker exec <container-name> bash -c "cd /workspaces/agent-sandbox && pnpm start:all"
docker exec <container-name> bash -c "cd /workspaces/agent-sandbox && pnpm stop:all"
```

## From Inside the Container (Cursor/VSCode)

### Use Make Commands
```bash
make start       # Start all services
make stop        # Stop all services  
make status      # Check status
make logs        # View logs
```

### Or NPM Scripts
```bash
pnpm start:all   # Start all services
pnpm stop:all    # Stop all services
```

### Or Direct Shell Scripts
```bash
./start-dev.sh   # Start all services
./stop-dev.sh    # Stop all services
```

## Service URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **MCP Server**: http://localhost:4100/mcp

## Most Common Workflow

```bash
# From your local terminal:
./hawaii start    # Start everything
./hawaii status   # Verify it's running

# Open browser to http://localhost:3000

# When done:
./hawaii stop     # Stop everything
```

## Auto-Start on Container Launch

Add to `.devcontainer/devcontainer.json`:
```json
{
  "postStartCommand": "cd /workspaces/agent-sandbox && pnpm start:all"
}
```

That's it! 🎉

