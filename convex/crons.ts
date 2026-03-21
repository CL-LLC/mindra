import { cronJobs } from "convex/server";

// Temporarily disabled during local auth/dashboard bring-up.
// Re-enable with proper internal function references (not inline handlers).
const crons = cronJobs();

export default crons;
