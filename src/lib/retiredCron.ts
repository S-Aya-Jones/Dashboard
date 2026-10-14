import { NextResponse } from "next/server";

// Routes that used to text her, and must not any more.
//
// Each of these was a cron endpoint of its own with its own path to her phone.
// The dispatch spine replaced all of them: one pinger, one claim per slot per
// day, one place that knows which sections are paused.
//
// What was left behind was seven URLs that still sent. Nothing in the app calls
// them — but an external pinger does not know that, and cron-job.org keeps
// running a job until somebody deletes it. A route that still works is a route
// that still fires, and what arrives is a text from the version of her life she
// had in June: school deadlines during a break, a second morning briefing, a
// reminder for a block that no longer exists.
//
// They are stopped here rather than deleted so nothing is lost and the history
// stays readable. If one is ever wanted again, it belongs in the spine as a
// slot, not as a URL anyone can hit.
export function supersededByDispatch(name: string) {
  return NextResponse.json(
    {
      sent: false,
      retired: true,
      route: name,
      reason:
        "Superseded by /api/cron/dispatch. This endpoint no longer sends. " +
        "If something is still calling it, delete that job.",
    },
    { status: 410 },
  );
}
