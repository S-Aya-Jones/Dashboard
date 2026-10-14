import { supersededByDispatch } from "@/lib/retiredCron";

export const dynamic = "force-dynamic";

// Retired. What this route used to do is in git history; why it had to stop
// sending is in retiredCron.ts.
export async function GET() {
  return supersededByDispatch("afternoon-check");
}
