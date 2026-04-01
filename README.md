# Mindra — Mind Movie SaaS

> AI-assisted creation and habit-tracking for personalized motivational videos

## 🎯 Project Overview

**Mission:** Help users create 2-4 minute personalized "mind movies" (visualization videos) and actually USE them consistently through behavioral design.

**Key Differentiator:** Usage tracking + motivation system, not just video generation.

---

## 📁 Repository Structure

```
mindra/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/                # API routes
│   │   │   ├── phase1/         # Affirmation generation
│   │   │   ├── phase2/         # Storyboard creation
│   │   │   ├── phase3/         # Asset generation
│   │   │   └── phase4/         # Video rendering
│   │   ├── (landing)/          # Marketing pages
│   │   ├── dashboard/          # User dashboard
│   │   ├── mindra/             # App interface
│   │   └── layout.tsx
│   ├── components/             # React components
│   ├── convex/                 # Convex functions
│   │   ├── schema.ts
│   │   ├── auth.ts
│   │   ├── clarityEngine.ts    # Extract goals
│   │   ├── storyboard.ts       # Create timeline
│   │   ├── assets.ts           # Generate images/video
│   │   ├── render.ts           # Video pipeline
│   │   ├── tracking.ts         # Usage tracking
│   │   └── notifications.ts    # Motivation system
│   └── lib/
│       ├── video/              # Editly pipeline
│       ├── ai/                 # AI service wrappers
│       └── utils/
├── docs/
│   ├── architecture.md
│   ├── api-keys.md             # Store keys here (gitignored)
│   └── prompts.md              # LLM prompts
├── tests/
└── README.md
```

---

## 🛠️ Current Tech Stack (Revised)

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Backend** | Convex ✅ | Real-time, serverless, perfect for tracking |
| **Frontend** | Next.js + React ✅ | Standard, Convex-friendly |
| **Auth** | Convex native auth | Google OAuth + email magic link |
| **Video Pipeline** | Editly + FFmpeg | Cost-effective, controllable |
| **Images** | Local SDXL (Mac Studio) | **FREE**, fast, private |
| **Video Clips** | Stock (Pexels) + user uploads | **FREE**, reliable |
| **AI Clips (Premium)** | Veo 3 | Pay-per-use, optional upgrade |
| **Music** | Uppbeat (free tier) | Legal, no attribution |
| **Storage** | Cloudflare R2 | Cheap, S3-compatible |
| **Notifications** | Telegram bot + OneSignal | Free tiers, effective |

**Removed from initial scope:**
- ❌ Sora 2 (too expensive for MVP)
- ❌ Google Imagen (local SDXL is free)

---

## 🎬 Video Pipeline (Simplified)

```typescript
// Phase 1: User Input
User provides: voice/text + images + goals
↓
// Phase 2: Clarity Engine (LLM)
Extract: themes, affirmations, emotional tone
Generate: storyboard JSON (scenes, timings)
↓
// Phase 3: Asset Generation
For each scene:
  - If user uploaded image → use it
  - If stock available → Pexels search
  - If needs generation → Local SDXL
  - If key scene + premium → Veo 3 (optional)
↓
// Phase 4: Video Rendering
Editly stitches assets:
  - Scene transitions
  - Text overlays (affirmations)
  - Ken Burns effects on images
  - Music track
  - Kaleidoscope intro/outro
↓
// Output: MP4 file
Upload to R2 → serve to user
```

---

## 📊 Usage Tracking System (The Secret Sauce)

### Database Schema (Convex)

```typescript
// users
{
  _id: Id<"users">,
  email: string,
  telegramId?: string,
  pushToken?: string,
  createdAt: number,
  subscription: "free" | "pro" | "ultra",
}

// mindMovies
{
  _id: Id<"mindMovies">,
  userId: Id<"users">,
  title: string,
  status: "draft" | "rendering" | "ready" | "archived",
  storyboard: StoryboardJSON,
  assets: Asset[],
  videoUrl?: string,
  createdAt: number,
  updatedAt: number,
}

// usageTracking (THE KEY)
{
  _id: Id<"usageTracking">,
  userId: Id<"users">,
  mindMovieId: Id<"mindMovies">,
  date: string, // YYYY-MM-DD
  morningCompleted: boolean,
  eveningCompleted: boolean,
  morningTime?: number, // timestamp
  eveningTime?: number,
  streak: number,
  longestStreak: number,
  notes?: string, // journal entry
}

// notifications
{
  _id: Id<"notifications">,
  userId: Id<"users">,
  type: "morning_reminder" | "evening_reminder" | "streak_at_risk",
  sentAt: number,
  opened: boolean,
}
```

### Motivation Algorithm

```typescript
// Run every 15 minutes via cron
export const checkEngagement = internalAction({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    for (const user of users) {
      const tracking = await getTodayTracking(ctx, user._id);
      const hour = new Date().getHours();
      
      // Morning window: 6-10 AM
      if (hour >= 6 && hour <= 10 && !tracking?.morningCompleted) {
        await sendNotification(user, "morning");
      }
      
      // Evening window: 8 PM - 11 PM
      if (hour >= 20 && hour <= 23 && !tracking?.eveningCompleted) {
        await sendNotification(user, "evening");
      }
      
      // Streak at risk (missed yesterday)
      if (isStreakAtRisk(tracking)) {
        await sendNotification(user, "streak_warning");
      }
    }
  }
});
```

---

## 🎯 MVP Checklist

### Phase 1: Foundation (Week 1-2)
- [x] Convex schema + auth (Convex native auth)
- [ ] Landing page + signup
- [ ] Basic dashboard

### Phase 2: Creation Flow (Week 3-4)
- [ ] Voice/text input
- [ ] Clarity Engine (LLM extraction)
- [ ] Storyboard generation
- [ ] Asset upload interface

### Phase 3: Rendering (Week 5-6)
- [ ] Editly pipeline setup
- [ ] Local SDXL integration
- [ ] Video generation
- [ ] R2 storage

### Phase 4: Tracking (Week 7-8)
- [ ] Watch tracking (embed analytics)
- [ ] Telegram bot notifications
- [ ] Streak counter
- [ ] Dashboard stats

### Phase 5: Polish (Week 9-10)
- [ ] Kaleidoscope effects
- [ ] Music integration
- [ ] Mobile optimization
- [ ] Bug fixes

---

## 💰 Cost Estimate (MVP)

| Item | Monthly |
|------|---------|
| Convex | Free → $25 |
| Cloudflare R2 | ~$5 |
| Uppbeat | Free |
| OneSignal | Free |
| Telegram | Free |
| **Total** | **~$30/mo** ✅ |

---

## 🚀 Next Steps

1. **Share current code:** Put what you have in this folder
2. **I review:** Identify what's working/broken
3. **Prioritize:** What needs fixing first?
4. **Build:** I write code → you integrate into Cursor

**Ready to share the code?**
