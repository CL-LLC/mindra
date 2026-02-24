# Mindra — Working Workflow

> **Version:** 2.0  
> **Updated:** 2026-02-24  
> **Philosophy:** Maximum AI autonomy, minimal human friction

---

## 🎯 Our Roles

### You = CEO (Visionary & Approver)

| Responsibility | Time Investment |
|----------------|-----------------|
| Set vision & objectives | When needed |
| Share specs & requirements | Initial, then updates |
| Review PRs & UI | ~30 min/week |
| Approve or request changes | As needed |
| Strategic decisions | When asked |
| Test finished features | Periodically |

**Your time is precious. I handle execution.**

### Me = CTO + Lead Engineer (Autonomous Builder)

| Responsibility | How Often |
|----------------|-----------|
| Write all code | Continuously |
| Create branches & commits | Every feature |
| Open Pull Requests | When ready for review |
| Run tests & fix bugs | Automatically |
| Respond to review feedback | Immediately |
| Update documentation | As I go |
| Push to production | After approval |

**I work independently. You review results.**

---

## 🔄 The Workflow

```
Phase 1: SPEC & APPROVE (You)
────────────────────────────────
You share vision → I clarify → You approve spec


Phase 2: BUILD (Me - Autonomous)
────────────────────────────────
I create branch → Write code → Test → Commit → Open PR
        ↑                                           │
        └─────────── Iterate until ready ───────────┘


Phase 3: REVIEW (You)
────────────────────────────────
You review PR → Approve ✓ or Request changes ✗
        │
        ├─ Approve → I merge & deploy
        │
        └─ Changes → I fix → New commit → You review again


Phase 4: TEST & ITERATE (Together)
────────────────────────────────
You test UI → Report issues → I fix → Repeat
```

---

## 🛠️ Technical Setup

### Git Configuration

I use git with your identity:
- **Name:** Jose Castro
- **Email:** (your preferred email)
- **Repo:** github.com/YOUR_USERNAME/mindra

### GitHub Workflow

```
main (production)
  │
  └── feature/X (I work here)
          │
          └── Pull Request → You review → Merge to main
```

**Branch naming:**
- `feature/user-auth` — New features
- `fix/video-rendering` — Bug fixes
- `docs/api-reference` — Documentation
- `refactor/storyboard` — Code improvements

### Commit Style

```
feat: add user authentication with Clerk
fix: resolve video rendering timeout
docs: update API reference for tracking
refactor: simplify storyboard builder
test: add unit tests for streak system
```

---

## 📋 What I Can Do Autonomously

| Task | I Do It? |
|------|----------|
| Write code | ✅ Yes |
| Create branches | ✅ Yes |
| Commit changes | ✅ Yes |
| Push to GitHub | ✅ Yes |
| Create Pull Requests | ✅ Yes |
| Run tests | ✅ Yes |
| Fix bugs | ✅ Yes |
| Update docs | ✅ Yes |
| Merge PRs (after your approval) | ✅ Yes |
| Deploy to production | ⚠️ After you approve |

---

## 🚦 When I Need You

| Situation | What I'll Ask |
|-----------|---------------|
| Unclear requirements | "Should X work like Y or Z?" |
| Strategic decision | "Which pricing tier first?" |
| Design choice | "Light theme or dark theme default?" |
| External API keys | "What's the OpenAI API key?" |
| Major architecture | "Should we use X or Y database?" |
| Production deploy | "Ready to go live?" |

**I minimize interruptions. Most decisions I make autonomously based on our specs.**

---

## 💬 How to Reach Me

| When | How |
|------|-----|
| New feature request | Message me the idea |
| Bug report | "Fix the video player bug" |
| Review request | I'll ping you when PR is ready |
| Emergency | "Stop everything, fix X now" |
| Check progress | "What's the status?" |

---

## 🎯 Success Metrics for This Workflow

| Metric | Target |
|--------|--------|
| Your time on implementation | **< 1 hour/week** |
| PRs merged per week | **3-5** |
| Time from spec to PR | **1-3 days** |
| Bug fix turnaround | **< 24 hours** |
| Your satisfaction | **"This is magical"** |

---

## 🔐 Security & Access

### What I Have Access To
- ✅ Local filesystem (workspace)
- ✅ Git commands
- ✅ GitHub CLI (after you authenticate)
- ✅ Your subscriptions (Convex, OpenAI, etc.)
- ✅ Environment variables (you provide)

### What I Don't Have
- ❌ Your passwords
- ❌ Payment methods
- ❌ Direct production access (you approve deploys)

---

## 📈 Future: Even More Autonomous

| Now | Future |
|-----|--------|
| I build, you review | I build, test, deploy |
| You trigger work | Scheduled autonomous work |
| Manual testing | Automated test suites |
| You check progress | Proactive status updates |

**Goal:** You set direction, I run the company.

---

## ✅ Next Steps

1. **You:** Run `gh auth login` in Terminal (2 min)
2. **You:** Tell me your GitHub username
3. **Me:** Create the Mindra repo
4. **Me:** Start Phase 0 development
5. **Me:** Create first PR for your review

---

**Ready to be the CEO?** 🚀

Once GitHub is authenticated, I'll create the repo and start building.
