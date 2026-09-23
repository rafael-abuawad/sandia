import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire and reconcile payments",
  { minutes: 1 },
  internal.across.reconcilePending,
);

export default crons;
