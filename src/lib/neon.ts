import { neon } from "@neondatabase/serverless";

// Next.js patches global fetch with a data cache. Neon's driver sends SQL
// over HTTP, so without an explicit opt-out each distinct query string gets
// cached on first execution and replayed forever — stale reads and writes
// that "succeed" without executing. Every DB client must go through here.
export function neonClient(url: string) {
  return neon(url, { fetchOptions: { cache: "no-store" } });
}
