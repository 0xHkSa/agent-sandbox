# Agent Sandbox

A safe Docker-based development environment for running AI agent code in isolation.

## 🎯 What is this?

This is a **sandboxed environment** that lets you run code from AI agents (or any untrusted source) without risking your actual computer. Docker creates an isolated mini-computer where everything runs safely contained.

## 🚀 How to use on any machine

### Prerequisites
- Docker Desktop installed and running
- VS Code or Cursor editor

### Steps
1. Clone/open this project folder
2. Open folder in VS Code/Cursor
3. When prompted, click **"Reopen in Container"**
4. Wait ~30 seconds for the first build
5. You're in! 🎉

### Verify you're in Docker
Run this in the terminal:
```bash
[ -f /.dockerenv ] && echo "✅ In Docker" || echo "❌ Not in Docker"
```

Or check the hostname (should be a random hash like `6e11238f77f3`):
```bash
hostname
```

## 📦 What's included

- **Node.js v20** (Debian Bookworm base)
- **Non-root user** (runs as `node` user for security)
- **Port 4000** forwarded (for future web apps)
- **pnpm** package manager

## 🔧 Configuration

The setup is defined in:
- `.devcontainer/Dockerfile` — The container image recipe
- `.devcontainer/devcontainer.json` — VS Code/Cursor dev container config

## 💡 Why Docker?

- **Isolated** — Can't access your personal files
- **Safe** — Can't mess with your system
- **Disposable** — Easy to reset if something breaks
- **Reproducible** — Same environment on any machine

## 📝 Quick Reference

**Check current user:**
```bash
whoami
```

**Check Node version:**
```bash
node --version
```

**Check working directory:**
```bash
pwd
```

---

**TL;DR:** Open this folder in VS Code/Cursor → Click "Reopen in Container" → You're in a safe sandbox! 🛡️

