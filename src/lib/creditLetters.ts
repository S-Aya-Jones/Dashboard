import type { CreditAccount } from "@/lib/creditAccounts";

// The letters, written out and ready to print.
//
// Every step in the plan that says "send a letter" now produces the letter.
// They are templates with her numbers filled in, not generated text: the
// wording of a validation request and a dispute is doing legal work — it
// invokes specific rights and starts specific clocks — so it is fixed, quoted
// where it matters, and reviewed once here rather than freshly improvised on
// every render.
//
// Bureau addresses verified August 2026:
//   equifax.com/personal/help/article-list/-/h/a/mail-in-credit-report-dispute
//   consumerfinance.gov/ask-cfpb/how-do-i-dispute-an-error-on-my-credit-report-en-314
//   files.consumerfinance.gov/f/documents/092016_cfpb__CreditReportingSampleLetter.pdf

export type LetterKind = "validation" | "dispute" | "goodwill" | "payForDelete";

export interface Sender {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

export const EMPTY_SENDER: Sender = { name: "", street: "", city: "", state: "", zip: "" };

export interface Recipient {
  name: string;
  address: string[];
}

export interface Letter {
  kind: LetterKind;
  title: string;
  /**
   * Something only she can complete, because it is a statement of fact about
   * her own affairs. A template that asserts "this account is not mine" on her
   * behalf would have her signing a claim she may not be able to stand behind,
   * to a federal agency's process.
   */
  fillIn?: { label: string; options: string[] };
  /** One line on what this letter does and what it triggers. */
  purpose: string;
  recipient: Recipient;
  subject: string;
  body: string[];
  /** How to send it, where that materially changes the outcome. */
  sendingNote: string;
  /** Anything she must add by hand before it goes. */
  attachments: string[];
}

export const BUREAUS: Record<string, Recipient> = {
  equifax: {
    name: "Equifax Information Services LLC",
    address: ["P.O. Box 740256", "Atlanta, GA 30374-0256"],
  },
  experian: {
    name: "Experian",
    address: ["P.O. Box 4500", "Allen, TX 75013"],
  },
  transunion: {
    name: "TransUnion LLC Consumer Dispute Center",
    address: ["P.O. Box 2000", "Chester, PA 19016"],
  },
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function today(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function senderBlock(s: Sender): string[] {
  return [s.name, s.street, `${s.city}${s.city && s.state ? ", " : ""}${s.state} ${s.zip}`.trim()]
    .filter(Boolean);
}

export function senderComplete(s: Sender): boolean {
  return Boolean(s.name.trim() && s.street.trim() && s.city.trim() && s.state.trim() && s.zip.trim());
}

/**
 * Split a one-line report address into printable lines, keeping
 * "City, ST 12345" together — splitting on every comma put the city on its own
 * line above the state, which is not how an envelope is addressed.
 */
function addressLines(raw: string | null): string[] {
  if (!raw) return ["(address not shown on your report — write it on before sending)"];
  const parts = raw.split(",").map(x => x.trim()).filter(Boolean);
  if (parts.length <= 1) return parts;
  const zipIdx = parts.findIndex(x => /\d{5}(-\d{4})?$/.test(x));
  if (zipIdx > 0) {
    return [...parts.slice(0, zipIdx - 1), parts.slice(zipIdx - 1).join(", ")];
  }
  return parts;
}

/**
 * Debt validation, under the Fair Debt Collection Practices Act. Sent to a
 * collector, not a bureau. Its power is procedural: until the collector
 * validates, it must stop collection activity, and a collector that cannot
 * validate generally deletes rather than litigate.
 */
export function validationLetter(a: CreditAccount): Letter {
  return {
    kind: "validation",
    title: `Debt validation — ${a.name}`,
    purpose:
      "Makes the collector prove the debt is yours and that they may collect it. Collection activity must pause until they do. Send this before paying anything.",
    recipient: { name: a.name, address: addressLines(a.address) },
    subject: `Request for validation of debt${a.balance !== null ? ` — ${money(a.balance)}` : ""}`,
    body: [
      `I am writing in response to an account you have reported on my credit file in the amount of ${a.balance !== null ? money(a.balance) : "the amount stated"}${a.openedYear ? `, shown as opened in ${a.openedYear}` : ""}.`,
      "This is not a refusal to pay. This is a request for validation made under the Fair Debt Collection Practices Act, 15 U.S.C. § 1692g. I am disputing this debt and requesting that you validate it.",
      "Please provide the following:",
      "  1. The amount you claim I owe, itemised, including any interest or fees added since the original balance.",
      "  2. The name and address of the original creditor.",
      "  3. Documentation showing that you own this debt or are authorised to collect it on behalf of the owner.",
      "  4. Evidence of a contractual agreement between me and the original creditor bearing my signature.",
      "  5. Proof that you are licensed to collect debts in my state, and your licence number.",
      "Until you have provided this validation, please cease all collection activity, including reporting this account to any consumer reporting agency. Reporting an account that is known to be disputed, without noting the dispute, is itself a violation.",
      "I am requesting that all further communication about this account be in writing.",
    ],
    sendingNote:
      "Send certified mail with return receipt. The receipt is the proof that they received it and when — that date is what starts the clock, and it is what you would rely on if this ever goes further. Keep a copy of everything.",
    attachments: [],
  };
}

/**
 * A dispute to the bureaus themselves, under the Fair Credit Reporting Act.
 * This is the one with the 30-day clock: unverified information must come off.
 */
export function disputeLetter(a: CreditAccount, bureauKey: string): Letter {
  const bureau = BUREAUS[bureauKey] ?? BUREAUS.equifax;
  return {
    kind: "dispute",
    title: `Dispute to ${bureau.name.split(" ")[0]} — ${a.name}`,
    purpose:
      "Forces the bureau to investigate within 30 days. Anything they cannot verify with the furnisher has to be deleted. Send the same letter to all three bureaus on the same day. You have to fill in the reason yourself — see below.",
    recipient: bureau,
    subject: `Dispute of inaccurate information — ${a.name}`,
    fillIn: {
      label: "Your reason for disputing — only write what is actually true",
      options: [
        "I have no record of this account and it does not belong to me.",
        "This account is mine, but the balance reported is wrong.",
        "This account was paid in full and should not show a balance.",
        "This account was settled and is being reported as still open.",
        "The dates reported on this account are wrong.",
      ],
    },
    body: [
      "I am writing to dispute information appearing on my credit report. The item below is inaccurate and I am requesting that it be investigated and removed.",
      `Account: ${a.name}${a.balance !== null ? `, reported balance ${money(a.balance)}` : ""}${a.openedYear ? `, reported as opened ${a.openedYear}` : ""}.`,
      "The reason I am disputing it: [ ___ — see the note below. Write the one that is true for you, in your own words, and delete this bracket before sending. ]",
      "Under the Fair Credit Reporting Act, 15 U.S.C. § 1681i, you are required to conduct a reasonable investigation of disputed information within 30 days and to delete any item that cannot be verified. Forwarding my dispute to the furnisher and repeating their answer is not a reasonable investigation.",
      "Please send me a written description of your investigation, including the name, address and telephone number of anyone you contacted, along with an updated copy of my credit report once the investigation is complete.",
      "I have enclosed a copy of my credit report with the disputed item marked.",
    ],
    sendingNote:
      "Certified mail with return receipt, and send it to all three bureaus the same day — an item deleted by one bureau can stay on the other two. The 30 days runs from the date they receive it.",
    attachments: [
      "A copy of the page of your credit report with this account circled or highlighted.",
      "A copy of your driver's licence or state ID.",
      "A copy of something showing your current address — a utility bill or bank statement.",
    ],
  };
}

/**
 * Pay-for-delete. Only ever sent after validation, and never paid without the
 * agreement in writing first — once the money moves there is nothing left to
 * negotiate with.
 */
export function payForDeleteLetter(a: CreditAccount): Letter {
  const offer = a.balance !== null ? Math.round(a.balance * 0.5) : null;
  return {
    kind: "payForDelete",
    title: `Pay for delete — ${a.name}`,
    purpose:
      "Offers payment in exchange for removing the entry entirely. Only send after the debt has been validated, and never pay until the agreement comes back signed — a paid collection still on your report helps far less than a deleted one.",
    recipient: { name: a.name, address: addressLines(a.address) },
    subject: `Settlement offer conditional on deletion${a.balance !== null ? ` — ${money(a.balance)}` : ""}`,
    body: [
      `I am writing regarding the account you have reported in the amount of ${a.balance !== null ? money(a.balance) : "the amount stated"}.`,
      `I am willing to pay ${offer !== null ? money(offer) : "an agreed amount"} to settle this account in full, on one condition: that upon receipt of payment you delete all reference to this account from my credit file with Equifax, Experian and TransUnion. Not mark it paid, not mark it settled — delete it.`,
      "This offer is made without any acknowledgement that the debt is mine, and is conditional on the above.",
      "If you accept, please confirm in writing on your company letterhead, signed, before any payment is made. I will send payment within ten days of receiving that confirmation.",
      "If I do not receive written agreement, no payment will be made and I will continue to dispute this account.",
      "This offer expires thirty days from the date of this letter.",
    ],
    sendingNote:
      "Certified mail with return receipt. Do not pay over the phone and do not accept a verbal promise to delete — it is not enforceable and it is routinely not honoured. Written agreement first, then payment.",
    attachments: [],
  };
}

/**
 * Goodwill. No legal force at all — it is a request to a human, which is why
 * it reads differently from the others and works best on an account that has
 * been clean since.
 */
export function goodwillLetter(a: CreditAccount): Letter {
  return {
    kind: "goodwill",
    title: `Goodwill removal — ${a.name}`,
    purpose:
      "Asks the lender to remove a late payment as a courtesy. No legal weight — it works on an otherwise good account with a real explanation, and it is free to ask.",
    recipient: { name: a.name, address: addressLines(a.address) },
    subject: "Goodwill request — removal of late payment notation",
    body: [
      `I have been a customer of ${a.name} and I am writing to ask for a goodwill adjustment on my account.`,
      "My payment history shows a late payment. I am not disputing that it happened. I fell behind during a difficult stretch, and since then I have kept the account current.",
      "I am currently applying for financing for graduate school, and this notation is affecting my ability to qualify. I am asking whether you would consider removing it as a gesture of goodwill, given the account's history since.",
      "I understand you are under no obligation to do this and I am grateful for any consideration. If there is anything further you need from me, I am glad to provide it.",
    ],
    sendingNote:
      "Regular mail is fine. Send it to the lender's customer service or executive office rather than the collections department — this is a request to a person, and it is worth resending in a few months if the first answer is no.",
    attachments: [],
  };
}

/** Which letters make sense for a given account. */
export function lettersFor(a: CreditAccount): Letter[] {
  if (a.kind === "collection" || a.status === "collection" || a.status === "chargeoff") {
    return [validationLetter(a), disputeLetter(a, "equifax"), payForDeleteLetter(a)];
  }
  if (a.status === "late") return [goodwillLetter(a)];
  return [disputeLetter(a, "equifax")];
}

/**
 * The letter as plain text, for printing or copying.
 *
 * `fill` replaces the bracketed reason a dispute leaves open. Printing with
 * the bracket still in it is allowed on purpose — she can write the reason on
 * the page by hand — but it is visible enough that it can't go out unnoticed.
 */
export function renderLetter(letter: Letter, sender: Sender, fill?: string): string {
  const lines: string[] = [];
  lines.push(...senderBlock(sender));
  lines.push("");
  lines.push(today());
  lines.push("");
  lines.push(letter.recipient.name);
  lines.push(...letter.recipient.address);
  lines.push("");
  lines.push(`Re: ${letter.subject}`);
  lines.push("");
  lines.push("To whom it may concern,");
  lines.push("");
  for (const p of letter.body) {
    lines.push(
      fill && p.startsWith("The reason I am disputing it:")
        ? `The reason I am disputing it: ${fill}`
        : p,
    );
    lines.push("");
  }
  lines.push("Sincerely,");
  lines.push("");
  lines.push("");
  lines.push(sender.name || "____________________");
  if (letter.attachments.length) {
    lines.push("");
    lines.push("Enclosures:");
    for (const a of letter.attachments) lines.push(`  · ${a}`);
  }
  return lines.join("\n");
}
