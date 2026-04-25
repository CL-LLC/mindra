# 📊 OpenClaw Configuration Guide

## Overview
OpenClaw uses a model configuration system where:
- **Providers**: Different API backends (zai, openai, openrouter, lmstudio)
- **Agents**: Individual AI instances with specific roles
- **Defaults**: Global settings that apply to all sessions

---

## 🗂️ Main Configuration Files

### **1. `/Users/lucho/.openclaw/openclaw.json`**
**Purpose**: Main OpenClaw configuration file

**Key Sections**:

#### **Authentication Profiles**
```json
"auth": {
  "profiles": {
    "zai:default": { "provider": "zai", "mode": "api_key" },
    "openai:default": { "provider": "openai", "mode": "api_key" }
  }
}
```

#### **Model Providers**
Each provider defines available models:

**ZAI Provider** (z.ai)
- `glm-5` - High-quality reasoning (primary recommendation)
- `glm-4.7` - High-quality reasoning
- `glm-4.7-flash` - Fast, cheap, good quality
- `glm-4.7-flashx` - Extremely fast

**OpenAI Provider**
- `gpt-5.3-codex` - Coding specialist
- `gpt-4o` - General purpose

**Mindra image backend**
- `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `MODAL_APP_NAME` - Modal deployment credentials and app name
- `MODAL_FLUX_ENDPOINT_URL` - deployed Modal HTTP endpoint for FLUX.2 klein 4B; required for video scene image generation
- `MODAL_FLUX_API_KEY` - optional bearer token for the deployed Modal endpoint

**OpenRouter Provider**
- `moonshotai/kimi-k2.5` - Current default model

**LMStudio Provider** (local)
- `qwen2.5-7b-instruct-mlx` - Local-only model

#### **Agents Configuration**
```json
"agents": {
  "defaults": {
    "model": {
      "primary": "openrouter/moonshotai/kimi-k2.5"  // Global default
    },
    "models": {
      "zai/glm-5": { "alias": "GLM" },
      "openai/gpt-5.3-codex": { "alias": "Codex" }
    }
  },
  "list": [
    {
      "id": "scout",
      "name": "Scout",
      "model": "zai/glm-4.7-flash"  // Agent-specific model
    },
    {
      "id": "researcher",
      "name": "Sage",
      "model": "zai/glm-4.7"
    },
    {
      "id": "builder",
      "name": "Builder",
      "model": "zai/glm-5"
    },
    {
      "id": "architect",
      "name": "Architect",
      "model": "openai/gpt-5.3-codex"
    }
  ]
}
```

**Model Format**: `provider/model-id`
- Examples: `zai/glm-5`, `openai/gpt-5.3-codex`, `openrouter/moonshotai/kimi-k2.5`

---

## 🎯 How Models Are Used

### **Level 1: Global Default**
- **File**: `openclaw.json` → `"agents.defaults.model.primary"`
- **Applies to**: Main session (you) when no specific agent is used
- **Current**: `openrouter/moonshotai/kimi-k2.5`

### **Level 2: Agent-Specific**
- **File**: `openclaw.json` → `"agents.list[].model"`
- **Applies to**: Named agents (Scout, Sage, Builder, Architect)
- **Current**:
  - Scout → `zai/glm-4.7-flash`
  - Sage → `zai/glm-4.7`
  - Builder → `zai/glm-5`
  - Architect → `openai/gpt-5.3-codex`

### **Level 3: Model Aliases**
- **File**: `openclaw.json` → `"agents.defaults.models.{id}"`
- **Purpose**: Short aliases for models
- **Examples**: `GLM`, `Codex`, `GPT4o`, `LocalQwen`, `Flash`

### **Level 4: Per-Request Override**
- **Tool**: `sessions_spawn(task, model: "specific-model")`
- **Purpose**: Temporarily override model for a task

---

## 💰 Cost Breakdown (Current Setup)

| Model | Purpose | Monthly Cost |
|-------|---------|--------------|
| GLM-5 | Builder agent | ~$15 |
| GLM-4.7 | Sage agent | ~$15 |
| GLM-4.7-Flash | Scout agent | ~$5 |
| OpenAI GPT-5.3-Codex | Architect agent | Included in $20 |
| Kimi-2.5 | Global default | FREE (OpenRouter) |
| Total | | **~$135/mo** |

---

## 🔄 Switching Models

### **Option 1: Change Global Default**
Edit `/Users/lucho/.openclaw/openclaw.json`:
```json
"defaults": {
  "model": {
    "primary": "zai/glm-5"  // Change from kimi-k2.5 to glm-5
  }
}
```
Then restart OpenClaw: `openclaw gateway restart`

### **Option 2: Change Agent Model**
Edit `/Users/lucho/.openclaw/openclaw.json`:
```json
"list": [
  {
    "id": "scout",
    "model": "zai/glm-5"  // Change from glm-4.7-flash
  }
]
```
Then restart OpenClaw: `openclaw gateway restart`

### **Option 3: Force Model for One Task**
When spawning sub-agent:
```javascript
sessions_spawn(task, model: "zai/glm-5")
```

---

## 🛠️ Configuration Syntax

### **Model Reference Format**
```
{provider}/{model-id}
```

**Valid References**:
- `zai/glm-5` → zai provider, glm-5 model
- `openai/gpt-5.3-codex` → openai provider, gpt-5.3-codex model
- `openrouter/moonshotai/kimi-k2.5` → openrouter, kimi-k2.5
- `lmstudio/qwen2.5-7b-instruct-mlx` → local model

### **Provider Priority**
OpenClaw tries models in this order:
1. Agent-specific model (if exists)
2. Global default model
3. Provider default (if specified)

---

## 📁 Workspace Files

| File | Purpose |
|------|---------|
| `openclaw.json` | Main OpenClaw configuration |
| `MEMORY.md` | Your long-term memory (main session only) |
| `AGENTS.md` | Agent team documentation |
| `USER.md` | Your profile & preferences |
| `SOUL.md` | Your personality & guidelines |
| `TOOLS.md` | Local notes (cameras, SSH, etc.) |
| `HEARTBEAT.md` | Heartbeat checklist |

---

## 🐛 Troubleshooting Model Issues

### **Issue: Model not found**
**Solution**: Check model ID spelling in `openclaw.json`

### **Issue: Agent not responding**
**Solution**: Check if model is defined in both `providers` and `agents.list[].model`

### **Issue: Cost too high**
**Solution**: Switch to faster/cheaper models (e.g., `glm-4.7-flash` instead of `glm-5`)

### **Issue: Quality too low**
**Solution**: Switch to higher-quality models (e.g., `glm-5` instead of `glm-4.7-flash`)

---

## ✅ Recommended Configuration

### **Balanced** (Quality + Speed + Cost)
```json
{
  "defaults": {
    "model": { "primary": "zai/glm-5" }
  },
  "list": [
    { "id": "scout", "model": "zai/glm-4.7-flash" },
    { "id": "researcher", "model": "zai/glm-4.7" },
    { "id": "builder", "model": "zai/glm-5" },
    { "id": "architect", "model": "openai/gpt-5.3-codex" }
  ]
}
```

### **Budget** (Cheapest but good quality)
```json
{
  "defaults": {
    "model": { "primary": "zai/glm-4.7" }
  },
  "list": [
    { "id": "scout", "model": "zai/glm-4.7-flash" },
    { "id": "researcher", "model": "zai/glm-4.7" },
    { "id": "builder", "model": "zai/glm-4.7" },
    { "id": "architect", "model": "openai/gpt-5.3-codex" }
  ]
}
```

---

## 📝 Quick Reference

| Setting | Location | What It Controls |
|---------|----------|------------------|
| Global default model | `agents.defaults.model.primary` | Your main session model |
| Agent models | `agents.list[].model` | Individual agent models |
| Model aliases | `agents.defaults.models` | Short names for models |
| Providers | `models.providers` | Available API backends |
| Cost tracking | Internal (no file) | Actual costs per model |

---

**Last Updated**: 2026-02-27
