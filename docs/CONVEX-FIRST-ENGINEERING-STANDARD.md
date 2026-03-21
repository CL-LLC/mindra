# Mindra — Convex-First Engineering Standard (Permanent)

Status: **ACTIVE POLICY**
Applies to: Lucho, Builder, Architect, Genius, and any coding subagent working on Mindra.

## Why this exists
Mindra uses Convex as the core backend and should leverage Convex-native patterns first.
The goal is simpler code, faster iteration, stronger realtime behavior, and better AI-agent maintainability.

## Non-negotiable rules

1. **Convex-first architecture**
   - Prefer Convex queries/mutations/actions/schedulers before external orchestration layers.
   - Keep business logic close to Convex functions and schema.

2. **Auth consistency**
   - Use one canonical identity path with Convex Auth.
   - Avoid ad-hoc user identity mapping (e.g., mixing email/id lookup patterns).
   - Never introduce parallel auth models without explicit approval.

3. **Schema-driven implementation**
   - Schema changes are explicit and intentional.
   - Every write path must satisfy schema-required fields.
   - Add/adjust indexes before shipping query patterns.

4. **Type-safe generated API usage**
   - Use Convex generated API/data model imports correctly.
   - No brittle import aliases that break build/typecheck.

5. **Idempotent mutations**
   - Repeated user actions should not create duplicate records unless intentional.
   - Tracking/streak logic must be safe on retries.

6. **Realtime by default**
   - Prefer reactive UI with Convex query hooks where possible.
   - Avoid unnecessary polling/manual state when Convex can drive updates.

7. **Fail-soft AI integration**
   - AI generation paths should have deterministic fallback behavior.
   - Missing model keys/services must fail gracefully in UI.

8. **Quality gate before handoff**
   - Required checks before saying “ready to test”:
     - `npx tsc --noEmit`
     - `npm run build`
     - `npx convex dev --once` (or equivalent function compile validation)

9. **No hidden demo bypass in primary flow**
   - Demo routes can exist, but authenticated primary flow must remain production-oriented.

10. **Convex feature adoption mindset**
   - When implementing new backend features, actively evaluate latest Convex-native capabilities first.
   - Prefer simplifying with Convex primitives over custom complexity.

11. **Use Convex Components whenever possible**
   - Before writing custom backend plumbing, check if an official/maintained Convex Component already solves it.
   - Prefer component-based integration for stronger defaults, faster delivery, and easier maintenance.
   - Re-evaluate available components periodically since Convex releases evolve quickly.

## Operational instruction for all subagents
When assigned a Mindra coding task, each subagent must:
1. Check this file first.
2. State which rules are relevant to the task.
3. Implement changes in compliance.
4. Report any unavoidable deviation explicitly.

## Escalation
If a requested change conflicts with this standard, pause and escalate to JC with tradeoffs.
