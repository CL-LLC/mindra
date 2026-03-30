# 🚀 Mindra - Quick Start Cheat Sheet

## Running the App

### **Terminal 1 - Convex Backend**
```bash
cd /Users/lucho/.openclaw/workspace/projects/ai-tools/mindra
npx convex dev
```
*(Keep this running - shows Convex logs)*

### **Terminal 2 - Next.js Frontend**
```bash
cd /Users/lucho/.openclaw/workspace/projects/ai-tools/mindra
npm run dev
```
*(Keep this running - shows Next.js logs)*

### **Access the App**
```
http://localhost:3000
```

### **Quick Kill (when done)**
Press `Ctrl+C` in both terminals to stop.

---

## **Alternative - One Command (optional)**
```bash
cd /Users/lucho/.openclaw/workspace/projects/ai-tools/mindra && npx convex dev & npm run dev
```

---

## **Key Files**

| File | Purpose |
|------|---------|
| `convex/aiFunctions.ts` | OpenAI integration functions |
| `.env` | Environment variables (Clerk, Convex, OpenAI) |
| `convex/schema.ts` | Database schema with authTables |
| `src/app/` | Next.js pages |
| `docs/OPENCLAW_CONFIG.md` | OpenClaw model configuration guide |

---

## **Testing**

Run integration tests:
```bash
cd /Users/lucho/.openclaw/workspace/projects/ai-tools/mindra
node test-full-integration.js
```

---

## **Status**

- ✅ Clerk authentication configured
- ✅ Convex OAuth with authTables
- ✅ OpenAI API integration
- ✅ Storyboard generation
- ✅ Affirmation generation
- ✅ Scene emotion analysis

---

# 📊 OpenClaw Model Configuration

**Main Config**: `/Users/lucho/.openclaw/openclaw.json`

## Model Types

### **ZAI Models** (Recommended)
- `glm-5` - High quality, main recommendation
- `glm-4.7` - High quality
- `glm-4.7-flash` - Fast, cheap
- `glm-4.7-flashx` - Extremely fast

### **OpenAI Models**
- `gpt-5.3-codex` - Coding specialist
- `gpt-4o` - General purpose

### **OpenRouter Models**
- `moonshotai/kimi-k2.5` - Current default

## Configuration Levels

1. **Global Default**: `openclaw.json` → `agents.defaults.model.primary`
2. **Agent Specific**: `openclaw.json` → `agents.list[].model`
3. **Per-Request**: Override when spawning sub-agent

## Model Aliases

| Alias | Full Model | Cost/Month |
|-------|------------|------------|
| GLM | zai/glm-5 | ~$15 |
| Flash | zai/glm-4.7-flash | ~$5 |
| Sage | zai/glm-4.7 | ~$15 |
| Builder | zai/glm-5 | ~$15 |
| Codex | openai/gpt-5.3-codex | Included |

## Current Agents

| Agent | Model | Role |
|-------|-------|------|
| Scout | `glm-4.7-flash` | Quick searches |
| Sage | `glm-4.7` | Deep analysis |
| Builder | `glm-5` | Coder |
| Architect | `gpt-5.3-codex` | System design |

## Total Monthly Cost

- GLM-5 (Builder): $15
- GLM-4.7 (Sage): $15
- GLM-4.7-Flash (Scout): $5
- OpenAI Codex: Included in $20
- **Total**: ~$135/mo

## Switching Models

1. Edit `/Users/lucho/.openclaw/openclaw.json`
2. Change `primary` model in `defaults` or agent model in `list`
3. Restart OpenClaw: `openclaw gateway restart`
4. Verify: Run `openclaw status`

See full guide: `docs/OPENCLAW_CONFIG.md`
