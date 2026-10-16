// The one canonical origin for links that get handed to other people.
//
// Vercel preview deployments (dashboard-<hash>-aya-jones-projects.vercel.app)
// sit behind Vercel's login wall, so a share link built from
// window.location.origin while viewing a preview is dead on arrival for the
// person you sent it to. Any link that leaves the app has to be built from
// here, not from wherever the tab happens to be.

export const SITE_URL = "https://dashboard-phi-six-70.vercel.app";

/**
 * Origin to build shareable links from. Uses the current origin for local
 * development, and the production domain everywhere else — including preview
 * deployments, which is the case that actually bites.
 */
export function shareOrigin(): string {
  if (typeof window === "undefined") return SITE_URL;
  const { origin, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
  return SITE_URL;
}
