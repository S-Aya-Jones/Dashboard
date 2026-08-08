// Turning a provider error into something worth reading.
//
// The raw failure arrives as a wall of JSON with the request id in it, which
// gets pasted into the UI verbatim. Buried in the middle of it is usually one
// fact that matters and one action to take — and in the case that actually
// stops everything, running out of credit, the action is not in the app at all.

export interface AiFailure {
  message: string;
  /** True when nothing will work until she does something outside the app. */
  blocking: boolean;
}

export function describeAiError(e: unknown): AiFailure {
  const raw = e instanceof Error ? e.message : String(e);

  if (/credit balance is too low|insufficient[_ ]quota|billing/i.test(raw)) {
    return {
      blocking: true,
      message:
        "Your Anthropic API credits have run out, so nothing can be generated. " +
        "Add credits at console.anthropic.com under Plans & Billing, then press Resume. " +
        "Your transcript is safe in the meantime.",
    };
  }

  if (/\b429\b|rate[_ ]limit/i.test(raw)) {
    return {
      blocking: false,
      message: "The model is rate-limited right now. Wait a minute and press Resume.",
    };
  }

  if (/\b529\b|overloaded/i.test(raw)) {
    return {
      blocking: false,
      message: "The model is overloaded right now. Press Resume in a few minutes.",
    };
  }

  if (/\b401\b|invalid[_ ]api[_ ]key|authentication/i.test(raw)) {
    return {
      blocking: true,
      message: "The Anthropic API key was rejected — check ANTHROPIC_API_KEY in Vercel.",
    };
  }

  if (/\b504\b|timed? ?out|ETIMEDOUT/i.test(raw)) {
    return { blocking: false, message: "That step timed out. Press Resume to pick it up again." };
  }

  return { blocking: false, message: raw.slice(0, 220) };
}
