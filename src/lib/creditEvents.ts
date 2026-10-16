"use client";

/**
 * Fired after a credit report is uploaded.
 *
 * The score card, the game plan, the loan panel and the Flow summary line all
 * read the same snapshot from different components. Without this, uploading a
 * report updated the card she was looking at and left the plan underneath it
 * showing the previous pull until she reloaded — which reads as "it didn't
 * work" rather than "it hasn't refreshed".
 */
export const CREDIT_UPDATED = "credit-updated";

export function announceCreditUpdate() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDIT_UPDATED));
}
