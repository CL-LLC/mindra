import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import GitHub from "@auth/core/providers/github";
import Resend from "@auth/core/providers/resend";

console.log("[auth] Initializing Convex Auth without custom JWT keys...");
console.log("[auth] Using built-in JWT generation");

const providers = [];

// Temporarily disabled Resend (not used in MVP)
// if (process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM) {
//   providers.push(
//       Resend({
//         apiKey: process.env.RESEND_API_KEY,
//         from: process.env.AUTH_EMAIL_FROM,
//       }),
//   );
// }

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}

console.log("[auth] Providers configured:", providers.map(p => p.id || 'unknown'));
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
});
