# MINDRA OAuth Implementation Plan — Convex Auth

**Prepared by:** Lucho (using Kimi K2.5)  
**Date:** 2026-02-26  
**Approach:** Convex Auth (removing Clerk dependency)

---

## 1. Architecture Overview

### How Convex Auth Works

```
User clicks "Sign in with Google"
        ↓
Next.js frontend calls Convex OAuth
        ↓
Convex redirects to Google OAuth
        ↓
User authenticates with Google
        ↓
Google redirects back to /api/auth/callback
        ↓
Convex creates/updates user in database
        ↓
JWT token stored in httpOnly cookie
        ↓
User is authenticated for all Convex queries/mutations
```

### Key Differences from Clerk

| Feature | Clerk | Convex Auth |
|---------|-------|-------------|
| **Cost** | $25/mo at scale | **Free** |
| **Bundle size** | Larger (~200KB) | Smaller |
| **User data** | Stored externally | **Stored in your Convex DB** |
| **Offline dev** | Requires API key | Works fully offline |
| **Lock-in** | Vendor lock-in | **You own the data** |
| **Setup** | Drop-in components | More initial setup |

---

## 2. Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
# Remove Clerk (we're migrating away)
npm uninstall @clerk/nextjs

# Install Convex Auth
npm install @convex-dev/auth
```

### Step 2: Environment Variables

Add to `.env.local`:

```bash
# Convex (already have these)
CONVEX_DEPLOYMENT=your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Auth secret (generate with: openssl rand -base64 32)
AUTH_SECRET=your-random-secret-here
```

### Step 3: Update Convex Schema

Your schema already has `authTables` imported — good! No changes needed:

```typescript
// convex/schema.ts (already correct)
import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,  // ← This adds: accounts, sessions, users, verificationTokens
  
  // Your existing tables stay the same
  users: defineTable({
    // ... your existing user fields
  }),
  // ... rest of your tables
});
```

### Step 4: Create Auth Configuration

**File:** `convex/auth.ts` (NEW)

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import GitHub from "@auth/core/providers/github";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  
  // Optional: Customize user creation
  callbacks: {
    async createUser({ user, account, profile }) {
      // Add custom fields to user on creation
      return {
        ...user,
        xp: 0,
        level: 1,
        streakFreezesAvailable: 3,
        subscription: "free",
        timezone: "America/New_York", // Default, user can change
      };
    },
  },
});
```

### Step 5: Create Convex HTTP Action

**File:** `convex/http.ts` (NEW)

```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Add auth routes
auth.addHttpRoutes(http);

export default http;
```

### Step 6: Update Convex Configuration

**File:** `convex.json` (in root, UPDATE)

```json
{
  "authInfo": [
    {
      "domain": "https://your-production-domain.com",
      "applicationID": "convex"
    }
  ]
}
```

### Step 7: Create Auth Provider (Frontend)

**File:** `src/components/ConvexAuthProvider.tsx` (NEW)

```typescript
"use client";

import { ConvexProviderWithAuth } from "convex/react-auth";
import { ReactNode } from "react";
import { convex } from "@/lib/convex";

export function ConvexAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex}>
      {children}
    </ConvexProviderWithAuth>
  );
}
```

### Step 8: Update Root Layout

**File:** `src/app/layout.tsx` (UPDATE)

```typescript
import { ConvexAuthProvider } from "@/components/ConvexAuthProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConvexAuthProvider>
          {children}
        </ConvexAuthProvider>
      </body>
    </html>
  );
}
```

### Step 9: Create Sign-In/Sign-Out Components

**File:** `src/components/AuthButtons.tsx` (NEW)

```typescript
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  const { signIn } = useAuthActions();
  
  return (
    <div className="flex gap-2">
      <Button 
        onClick={() => signIn("google")}
        variant="outline"
      >
        Sign in with Google
      </Button>
      <Button 
        onClick={() => signIn("github")}
        variant="outline"
      >
        Sign in with GitHub
      </Button>
    </div>
  );
}

export function SignOutButton() {
  const { signOut } = useAuthActions();
  
  return (
    <Button onClick={() => signOut()} variant="ghost">
      Sign Out
    </Button>
  );
}
```

### Step 10: Create Protected Route Component

**File:** `src/components/ProtectedRoute.tsx` (NEW)

```typescript
"use client";

import { useConvexAuth } from "convex/react-auth";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  
  if (isLoading) {
    return <div>Loading...</div>; // Or your loading component
  }
  
  if (!isAuthenticated) {
    redirect("/sign-in");
  }
  
  return <>{children}</>;
}
```

### Step 11: Use in Dashboard Pages

**File:** `src/app/dashboard/page.tsx` (EXAMPLE)

```typescript
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SignOutButton } from "@/components/AuthButtons";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>
        <h1>Dashboard</h1>
        <SignOutButton />
        {/* Your dashboard content */}
      </div>
    </ProtectedRoute>
  );
}
```

### Step 12: Create Sign-In Page

**File:** `src/app/sign-in/page.tsx` (NEW)

```typescript
import { SignInButton } from "@/components/AuthButtons";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to MINDRA</h1>
        <p className="text-gray-600 mb-6">Sign in to start creating mind movies</p>
        <SignInButton />
      </div>
    </div>
  );
}
```

---

## 3. OAuth Provider Setup

### Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. **APIs & Services** → **Credentials**
4. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
5. Configure consent screen (External for testing)
6. Application type: **Web application**
7. **Authorized redirect URIs:**
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
8. Copy **Client ID** and **Client Secret** to `.env.local`

### GitHub

1. Go to https://github.com/settings/developers
2. **OAuth Apps** → **New OAuth App**
3. Application name: MINDRA
4. Homepage URL: `http://localhost:3000` (dev) / your domain (prod)
5. **Authorization callback URL:**
   - `http://localhost:3000/api/auth/callback/github`
6. Copy **Client ID** and generate **Client Secret**

---

## 4. Security Considerations

### Token Refresh
Convex Auth handles this automatically — no code needed.

### Session Expiration
Set in `convex/auth.ts`:

```typescript
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [...],
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,    // Refresh token every 24 hours
  },
});
```

### Protecting Convex Functions

**File:** `convex/utils.ts` (NEW)

```typescript
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

export const authenticatedQuery = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return { userId };
  },
});

// Use in your queries:
export const getMyMindMovies = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    
    return ctx.db
      .query("mindMovies")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .collect();
  },
});
```

---

## 5. Testing Strategy

### Local Development

```bash
# 1. Start Convex
cd /Users/lucho/.openclaw/workspace/projects/ai-tools/mindra
npx convex dev

# 2. In another terminal, start Next.js
npm run dev

# 3. Test sign-in
# Open http://localhost:3000/sign-in
# Click "Sign in with Google"
# Should redirect to Google, then back, then authenticated
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "redirect_uri_mismatch" | Check OAuth callback URLs match exactly |
| "No user found" | Clear cookies, try again |
| "Invalid client" | Check env vars are loaded |
| CORS errors | Ensure `http://localhost:3000` is in allowed origins |

---

## 6. Estimated Effort

| Task | Hours | Complexity |
|------|-------|------------|
| Install dependencies | 0.5 | Easy |
| Create auth files | 2 | Medium |
| OAuth provider setup | 1 | Medium |
| Update components | 3 | Medium |
| Remove Clerk code | 1 | Easy |
| Testing & debugging | 2 | Medium |
| **Total** | **~10 hours** | **Medium** |

---

## 7. Migration Path from Clerk

1. **Keep Clerk** during development (parallel)
2. **Add Convex Auth** alongside Clerk
3. **Test thoroughly** with both systems
4. **Migrate users** (they'll need to re-authenticate once)
5. **Remove Clerk** when confident

**Note:** Users will need to sign in again after migration — there's no way to transfer Clerk sessions to Convex Auth.

---

## 8. Next Steps

1. ✅ Review this plan with JC
2. Set up Google/GitHub OAuth apps
3. Create the auth files (Builder agent)
4. Test locally
5. Deploy to production

---

**Questions or need clarification on any section?**