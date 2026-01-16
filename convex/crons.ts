import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.weekly(
  "weekly-digests",
  { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
  internal.digests.scheduleWeeklyForAll,
);

export default crons;
