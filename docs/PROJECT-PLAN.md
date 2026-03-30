# Mindra Project Plan

## Current State

### Working
- Login / auth / dashboard navigation
- Create flow persistence
- Edit flow persistence
- Logout redirect fix

### Partially Working
- Affirmation generation exists, but outputs are too close to raw user input
- Cursor ACP one-shot execution works, but planning should not depend on it

### Broken
- Video rendering pipeline
- Watch/playback for rendered videos

## Priority Order

1. Improve affirmation generation quality
2. Fix video rendering end-to-end
3. Make watch/playback reliable
4. Validate and polish UX

## Task Breakdown

### MINDRA-PLAN-0001 — Upgrade affirmation quality
**Goal:** Make affirmations feel transformed, vivid, and emotionally useful instead of echoing the input.

**Done when:**
- outputs are clearly rewritten, not paraphrased
- tone arc is stronger: grounding → identity shift → expansion → close
- English and Spanish outputs are both natural and native-feeling
- at least 3 example inputs produce notably improved affirmations

### MINDRA-PLAN-0002 — Repair render pipeline
**Goal:** Get actual videos rendering reliably from created content.

**Done when:**
- create flow triggers render successfully
- output video file is generated and stored
- failures are surfaced clearly in UI/logs
- pipeline works on a fresh test case

### MINDRA-PLAN-0003 — Restore watch/playback
**Goal:** Make rendered videos playable from the watch screen.

**Done when:**
- watch page loads a valid video
- player starts reliably
- empty/error states are handled cleanly
- user can review the generated video end to end

### MINDRA-PLAN-0004 — UX validation and polish
**Goal:** Make sure the flow feels complete and robust.

**Done when:**
- create/edit/watch flows are tested end to end
- obvious edge cases are handled
- no major navigation/auth regressions remain
- project is ready for next growth step

## Notes
- Mission Control remains the system of record for task status.
- All Mission Control changes must go through the Mission Control API (`/api/mission-control/manage`).
- Direct database edits are not the standard workflow and should be avoided except for emergency recovery.
- Cursor should be used for implementation, not for defining the plan.
- Keep execution focused: one task at a time, validate each step.
