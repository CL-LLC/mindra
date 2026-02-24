# Mindra — Product Specification

> **Version:** 1.0  
> **Last Updated:** 2026-02-24  
> **Status:** Draft — Ready for Build

---

## 1. Vision & Purpose

### The Problem

People want to visualize their goals and dreams, but existing solutions fail because:

1. **Creation is hard** — Making vision boards or mind movies requires time, skill, and tools
2. **Usage is inconsistent** — People create once, then forget about it
3. **No feedback loop** — Apps don't help improve when things aren't working
4. **Static content** — Life changes, goals evolve, but the content doesn't

### The Solution

**Mindra** is an AI-powered app that:
1. **Creates** personalized mind movies from user goals
2. **Enforces** daily usage through gamified tracking
3. **Evolves** content based on results and life changes
4. **Retains** users through continuous improvement cycles

### The Mission

> Help users achieve their goals through personalized visualization videos and habit enforcement, creating an ongoing relationship that grows with them.

---

## 2. Target Audience

### Primary Persona

**"Aspiring Achiever"** — Ages 25-45

- Interested in self-improvement, manifestation, goal-setting
- Has tried vision boards, affirmations, or meditation apps
- Struggles with consistency
- Wants technology to help them succeed
- Mobile-first user (primarily on phone)

### Secondary Persona

**"Goal-Oriented Professional"** — Ages 30-50

- Successful but wants more
- Uses tools like Notion, Todoist, habit trackers
- Values efficiency and measurable progress
- Willing to pay for premium features

### Market

- **Primary:** English-speaking (US, UK, Canada, Australia)
- **Secondary:** Spanish-speaking (Latin America, US Hispanics)
- **TAM:** $2.6B wellness/self-improvement app market

---

## 3. Core Value Proposition

**Mindra = Personalized Visualization + Habit Enforcement + Continuous Evolution**

| Pillar | What It Means |
|--------|---------------|
| **Create** | AI generates personalized mind movies from goals |
| **Track** | Gamified system rewards daily use, penalizes inconsistency |
| **Evolve** | Content improves based on results and life changes |
| **Retain** | Ongoing relationship, not one-time purchase |

---

## 4. Key Differentiators

### 4.1 Gamified Tracking (Habit Enforcement)

**Not passive tracking — active accountability:**

#### Rewards (Incentives)
| Behavior | Reward |
|----------|--------|
| Daily completion (2x/day) | XP points, streak increment |
| 7-day streak | Streak multiplier (2x XP) |
| 30-day streak | Badge unlock, premium feature trial |
| 90-day streak | "Master" status, exclusive themes |
| Consistent morning sessions | "Early Bird" badge |
| Consistent evening sessions | "Night Owl" badge |

#### Penalties (Accountability)
| Behavior | Consequence |
|----------|-------------|
| Missed session | Streak resets to 0 |
| 3+ days missed | "Motivation drop" notification |
| 7+ days missed | Account "cold" status, recovery email |

#### Rescue Mechanics
| Feature | Purpose |
|---------|---------|
| Streak Freeze (1/month) | Save streak during emergencies |
| Recovery Mode | Reduced requirements to rebuild habit |
| Community Accountability | Optional: share streaks with friends |

### 4.2 Evolving Mind Movies (Growth Partnership)

**The app grows with the user:**

#### Scenario A: Not Seeing Results
```
User: "I've been using my mind movie for 30 days but nothing's happening."
App: → Analyzes affirmations, images, emotional tone
     → Suggests improvements
     → Offers to regenerate with different approach
     → Provides A/B testing (try new version)
```

#### Scenario B: Goals Achieved
```
User: "I got the job I was visualizing!"
App: → "Congratulations! 🎉"
     → "Ready to level up? What's your next goal?"
     → Archive the win (celebration moment)
     → Create new movie with expanded vision
```

#### Scenario C: Life Changed
```
User: "I moved to a new city, my goals are different now."
App: → "Let's update your mind movie."
     → Quick onboarding for new goals
     → Preserve what's working, change what's not
```

---

## 5. User Journey

### 5.1 Onboarding (Day 1)

```
1. Sign up (email or Google)
2. Brief intro: "What is a mind movie?"
3. Goal input:
   - Voice recording (Whisper transcribes)
   - Text input (type your dreams)
   - Guided prompts (categories: career, health, relationships, wealth)
4. AI processes goals → extracts themes → generates affirmations
5. Storyboard preview (user approves/edits)
6. Asset gathering:
   - Upload personal images
   - Select from stock (Pexels)
   - Generate AI images (DALL-E 3)
7. Video renders (30-60 seconds)
8. First watch
9. Set reminder times (morning + evening)
```

### 5.2 Daily Use (Ongoing)

```
Morning (6-10 AM):
┌─────────────────────────────────────┐
│ 🔔 "Time for your morning mind movie" │
│                                     │
│ [Watch Now] [Snooze 10min]          │
└─────────────────────────────────────┘
         ↓
User watches video (2-4 min)
         ↓
Completion logged → XP earned → Streak updated
         ↓
Optional: Quick journal entry

Evening (8-11 PM):
┌─────────────────────────────────────┐
│ 🌙 "Evening visualization time"      │
│                                     │
│ [Watch Now] [Skip today 😢]         │
└─────────────────────────────────────┘
         ↓
Same flow → Daily completion = 2x streak
```

### 5.3 Check-ins (Weekly/Monthly)

```
Weekly (Day 7):
"How's your mind movie feeling?"
[🔥 Still inspiring] [😐 Getting stale] [😢 Not working]

Monthly (Day 30):
"Let's review your progress"
- Goals check-in
- Effectiveness rating
- Improvement suggestions
- Option to evolve/upgrade
```

---

## 6. Technical Architecture

### 6.1 Platform Strategy: Mobile-First Web (PWA)

| Decision | Rationale |
|----------|-----------|
| **Mobile-first responsive** | Primary use is on phone |
| **PWA (Progressive Web App)** | Installable, works offline |
| **Single codebase** | Faster development, easier maintenance |
| **Capacitor-ready** | Can wrap for App Stores later |

### 6.2 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + React | UI framework |
| **Styling** | Tailwind CSS | Mobile-first responsive design |
| **Backend** | Convex Pro | Real-time database, functions, auth |
| **Auth** | Clerk | User authentication |
| **AI - Text** | GPT-4 / GLM-5 | Clarity Engine, affirmations |
| **AI - Voice** | Whisper (OpenAI) | Voice-to-text for goal input |
| **AI - Images** | DALL-E 3 | Generate visualization images |
| **Video** | Editly + FFmpeg | Video rendering pipeline |
| **Stock Media** | Pexels API | Free stock photos/videos |
| **Music** | Uppbeat | Royalty-free background music |
| **Storage** | Cloudflare R2 | Video/image hosting |
| **Notifications** | Telegram Bot + OneSignal | Reminders, streak alerts |
| **Payments** | Stripe | Subscription management |

### 6.3 Mobile-First Design Principles

1. **Touch-first interactions** — Large tap targets, swipe gestures
2. **Vertical video support** — 9:16 aspect ratio for Reels/TikTok generation
3. **Offline capable** — Cache videos for viewing without internet
4. **Fast loads** — Lazy loading, optimized assets
5. **Native feel** — Smooth animations, haptic feedback (where supported)

---

## 7. Feature Breakdown

### Phase 1: MVP (Weeks 1-6)

| Feature | Priority | Description |
|---------|----------|-------------|
| User auth | P0 | Sign up, login, profile |
| Goal input | P0 | Text + voice (Whisper) |
| Clarity Engine | P0 | Extract themes, generate affirmations |
| Storyboard builder | P0 | Visual timeline editor |
| Asset manager | P0 | Upload, stock search, AI generate |
| Video renderer | P0 | Basic Editly pipeline |
| Watch player | P0 | Video playback in app |
| Streak tracking | P0 | Daily completion logging |
| Basic notifications | P0 | Morning/evening reminders |
| Dashboard | P0 | Stats, streak, progress |

### Phase 2: Gamification (Weeks 7-8)

| Feature | Priority | Description |
|---------|----------|-------------|
| XP system | P1 | Points for actions |
| Streak multipliers | P1 | Bonus for consistency |
| Badges/achievements | P1 | Unlockable rewards |
| Streak freeze | P1 | Emergency protection |
| Leaderboards | P2 | Community comparison (optional) |

### Phase 3: Evolution (Weeks 9-10)

| Feature | Priority | Description |
|---------|----------|-------------|
| Effectiveness check-ins | P1 | Weekly/monthly surveys |
| AI improvement suggestions | P1 | Analyze and recommend changes |
| Goal achieved flow | P1 | Celebration + next goal |
| Mind movie versioning | P1 | Save history, revert if needed |
| Quick regenerate | P2 | One-click refresh |

### Phase 4: Polish & Launch (Weeks 11-12)

| Feature | Priority | Description |
|---------|----------|-------------|
| Landing page | P0 | Marketing, SEO |
| Pricing tiers | P0 | Free/Pro/Ultra |
| Payment integration | P0 | Stripe subscriptions |
| Mobile optimization | P0 | PWA, installable |
| Error handling | P0 | Graceful failures |
| Analytics | P1 | User behavior tracking |

---

## 8. Database Schema (Convex)

### Users
```typescript
{
  _id: Id<"users">,
  email: string,
  name?: string,
  telegramId?: string,
  pushToken?: string,
  timezone: string,
  createdAt: number,
  subscription: "free" | "pro" | "ultra",
  xp: number,
  level: number,
  badges: string[],
  streakFreezesAvailable: number,
}
```

### Mind Movies
```typescript
{
  _id: Id<"mindMovies">,
  userId: Id<"users">,
  title: string,
  version: number,
  status: "draft" | "rendering" | "ready" | "archived",
  goals: string[],
  affirmations: string[],
  storyboard: StoryboardJSON,
  assets: Asset[],
  videoUrl?: string,
  thumbnailUrl?: string,
  duration: number,
  musicTrack?: string,
  createdAt: number,
  updatedAt: number,
  effectivenessScore?: number,
}
```

### Usage Tracking
```typescript
{
  _id: Id<"usageTracking">,
  userId: Id<"users">,
  date: string, // YYYY-MM-DD
  morningCompleted: boolean,
  eveningCompleted: boolean,
  morningTime?: number,
  eveningTime?: number,
  xpEarned: number,
  notes?: string,
}
```

### Streaks
```typescript
{
  _id: Id<"streaks">,
  userId: Id<"users">,
  currentStreak: number,
  longestStreak: number,
  lastCompletedDate: string,
  streakFreezesUsed: number,
  streakHistory: StreakEvent[],
}
```

### Notifications
```typescript
{
  _id: Id<"notifications">,
  userId: Id<"users">,
  type: "morning_reminder" | "evening_reminder" | "streak_at_risk" | "streak_lost" | "goal_achieved",
  sentAt: number,
  opened: boolean,
  actionTaken: boolean,
}
```

---

## 9. Gamification System

### 9.1 XP & Levels

| Action | XP Earned |
|--------|-----------|
| Watch mind movie | +10 XP |
| Complete both sessions (daily) | +25 XP bonus |
| 7-day streak | +100 XP |
| 30-day streak | +500 XP |
| Goal achieved (reported) | +1000 XP |
| Improve mind movie | +50 XP |
| Invite friend | +200 XP |

### Level Progression

| Level | XP Required | Reward |
|-------|-------------|--------|
| 1 | 0 | Basic features |
| 5 | 500 | Unlock new music tracks |
| 10 | 1,500 | Unlock new visual themes |
| 20 | 5,000 | Unlock premium effects |
| 50 | 25,000 | "Master" badge, exclusive features |

### 9.2 Badges

| Badge | Requirement | Reward |
|-------|-------------|--------|
| First Step | Create first mind movie | +50 XP |
| Week Warrior | 7-day streak | +100 XP |
| Month Master | 30-day streak | +500 XP |
| Early Bird | 14 consecutive morning sessions | New theme |
| Night Owl | 14 consecutive evening sessions | New theme |
| Goal Getter | Mark first goal as achieved | +1000 XP |
| Evolver | Improve mind movie 3 times | +150 XP |
| Social Butterfly | Invite 5 friends | Premium trial |

---

## 10. Pricing & Monetization

### Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 1 mind movie, basic tracking, 7-day streak max |
| **Pro** | $9.99/mo | Unlimited movies, full gamification, all themes, priority support |
| **Ultra** | $19.99/mo | Everything in Pro + AI image generation, custom music, early features |

### Conversion Triggers

- Free user hits 7-day streak limit → Upgrade prompt
- Free user wants 2nd mind movie → Upgrade prompt
- Free user wants AI images → Upgrade prompt
- Pro user wants unlimited AI → Ultra upsell

---

## 11. Success Metrics

### North Star Metric

**Weekly Active Users with 2x Daily Completion**

### Key Metrics

| Metric | Target (MVP) | Target (6 months) |
|--------|--------------|-------------------|
| DAU/MAU ratio | 40% | 60% |
| 7-day retention | 30% | 50% |
| 30-day retention | 15% | 30% |
| Daily completion rate | 50% | 70% |
| Free → Pro conversion | 5% | 10% |
| Monthly churn | <10% | <5% |
| NPS score | 40+ | 60+ |

---

## 12. MVP Scope (What's In/Out)

### In Scope (MVP)

✅ User authentication  
✅ Goal input (text + voice)  
✅ AI affirmation generation  
✅ Basic storyboard builder  
✅ Asset upload + stock search  
✅ Video rendering (Editly)  
✅ Watch + completion tracking  
✅ Streak system  
✅ Basic gamification (XP, badges)  
✅ Morning/evening notifications  
✅ Dashboard  
✅ Free + Pro tiers  
✅ Mobile-first responsive design  

### Out of Scope (MVP)

❌ Native iOS/Android apps  
❌ AI video generation (Veo 3)  
❌ Community/social features  
❌ Leaderboards  
❌ Custom music uploads  
❌ Multi-language (English only first)  
❌ White-label/B2B  
❌ Advanced analytics  

---

## 13. Roadmap

### Phase 0: Foundation (Week 1)
- Project setup (Next.js, Convex, Clerk)
- Database schema
- Basic auth flow

### Phase 1: Core Features (Weeks 2-4)
- Goal input + Clarity Engine
- Storyboard builder
- Asset manager
- Video rendering pipeline

### Phase 2: Tracking & Gamification (Weeks 5-6)
- Watch tracking
- Streak system
- XP + badges
- Notifications

### Phase 3: Polish (Weeks 7-8)
- Dashboard
- Mobile optimization
- PWA setup
- Payment integration

### Phase 4: Launch (Week 9-10)
- Landing page
- Beta testing
- Bug fixes
- Public launch

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Video rendering slow/expensive | Medium | High | Use efficient Editly config, queue system |
| Users don't watch daily | High | High | Strong gamification, notifications |
| Competition copies features | Medium | Medium | Focus on gamification moat |
| AI costs spiral | Medium | Medium | Use local SDXL as backup, cache results |
| Low retention | High | High | Evolution system, check-ins |
| App store rejection (later) | Low | Medium | PWA first, native wrapper later |

---

## 15. Open Questions

1. **Pricing validation** — Is $9.99/mo right? Need user research
2. **Gamification balance** — How strict vs forgiving?
3. **Content moderation** — What if users input harmful goals?
4. **AI provider** — GPT-4 vs GLM-5 vs Claude for Clarity Engine?
5. **Video hosting** — R2 vs Cloudflare Stream vs Mux?
6. **Spanish launch** — When to localize?

---

## 16. Next Steps

1. ✅ **Product spec approved** (this document)
2. 🔲 **Technical architecture doc** — Detailed system design
3. 🔲 **Phase 0 setup** — Project initialization
4. 🔲 **Design system** — UI components, mobile-first
5. 🔲 **Start building** — Phase 1 features

---

**Document Status:** ✅ Ready for Build  
**Next Action:** Review with JC, then start Phase 0 setup
