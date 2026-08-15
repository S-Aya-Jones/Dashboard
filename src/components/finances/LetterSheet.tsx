"use client";

import { useState } from "react";
import { X, Printer, Copy, Check } from "lucide-react";
import type { CreditAccount } from "@/lib/creditAccounts";
import {
  lettersFor, renderLetter, senderBlock, senderComplete,
  EMPTY_SENDER, type Letter, type Sender,
} from "@/lib/creditLetters";

// A letter she can print and put in an envelope.
//
// The plan used to say "send a debt validation letter" and leave her to find
// out what one is. This writes it, addresses it from the address printed on her
// own report, and prints. The print stylesheet drops everything except the
// page itself so what comes out of the printer is a letter, not a screenshot
// of a dashboard.

interface Props {
  account: CreditAccount;
  sender: Sender | undefined;
  onSender: (s: Sender) => void;
  onClose: () => void;
}

export function LetterSheet({ account, sender, onSender, onClose }: Props) {
  const letters = lettersFor(account);
  const [pick, setPick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(!senderComplete(sender ?? EMPTY_SENDER));
  const [reason, setReason] = useState<string>("");

  const s = sender ?? EMPTY_SENDER;
  const letter: Letter = letters[pick];
  const text = renderLetter(letter, s, reason || undefined);

  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const field = (key: keyof Sender, label: string, w = "100%") => (
    <label style={{ display: "block", width: w }}>
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-light)" }}>{label}</span>
      <input
        value={s[key]}
        onChange={e => onSender({ ...s, [key]: e.target.value })}
        className="w-full text-sm px-2.5 py-1.5 rounded-lg mt-0.5"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto letter-overlay"
      style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .letter-page, .letter-page * { visibility: visible !important; }
          .letter-page {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0.75in; background: #fff; color: #000;
            box-shadow: none; border: none;
          }
          .letter-noprint { display: none !important; }
        }
      `}</style>

      <div className="mx-auto my-6 px-4" style={{ maxWidth: "44rem" }} onClick={e => e.stopPropagation()}>
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>

          {/* Controls — none of this prints */}
          <div className="letter-noprint p-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-serif text-lg flex-1" style={{ color: "var(--text)" }}>{letter.title}</h3>
              <button onClick={onClose} aria-label="Close"><X size={18} style={{ color: "var(--text-muted)" }} /></button>
            </div>

            {letters.length > 1 && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {letters.map((l, i) => (
                  <button key={l.kind} onClick={() => setPick(i)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={i === pick
                      ? { background: "var(--text)", color: "var(--surface)" }
                      : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {l.kind === "validation" ? "1. Validate first"
                      : l.kind === "dispute" ? "2. Dispute to bureaus"
                      : l.kind === "payForDelete" ? "3. Pay for delete"
                      : "Goodwill"}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>{letter.purpose}</p>

            {/* Her address — the one thing a template can't fill in */}
            {editing || !senderComplete(s) ? (
              <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  Your return address — it goes at the top of every letter
                </p>
                {field("name", "Full name")}
                {field("street", "Street")}
                <div className="flex gap-2">
                  {field("city", "City", "50%")}
                  {field("state", "State", "22%")}
                  {field("zip", "ZIP", "28%")}
                </div>
                {senderComplete(s) && (
                  <button onClick={() => setEditing(false)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--text)", color: "var(--surface)" }}>
                    Done
                  </button>
                )}
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
                From {s.name}, {s.city} {s.state} — change
              </button>
            )}

            {letter.fillIn && (
              <div className="rounded-xl p-3 mt-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{letter.fillIn.label}</p>
                <p className="text-[11px] mt-0.5 mb-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  A dispute is a statement of fact to a federal process. Pick the one that is
                  genuinely true — I won&apos;t put a claim in the letter on your behalf.
                </p>
                <div className="space-y-1">
                  {letter.fillIn.options.map(o => (
                    <button key={o} onClick={() => setReason(reason === o ? "" : o)}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg leading-snug"
                      style={reason === o
                        ? { background: "var(--text)", color: "var(--surface)" }
                        : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      {o}
                    </button>
                  ))}
                </div>
                {!reason && (
                  <p className="text-[11px] mt-2" style={{ color: "#C0503C" }}>
                    Nothing picked yet — the letter will print with a blank to fill in by hand.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={() => window.print()} disabled={!senderComplete(s)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                style={{ background: "#B4552F", color: "#fff" }}>
                <Printer size={13} /> Print this letter
              </button>
              <button onClick={copy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
                style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" }}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy text"}
              </button>
            </div>

            <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: "var(--bg)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-light)" }}>
                How to send it
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{letter.sendingNote}</p>
            </div>

            {letter.attachments.length > 0 && (
              <div className="mt-2 rounded-xl px-3 py-2.5" style={{ background: "var(--bg)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-light)" }}>
                  Put in the envelope with it
                </p>
                <ul className="space-y-1">
                  {letter.attachments.map((a, i) => (
                    <li key={i} className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>· {a}</li>
                  ))}
                </ul>
              </div>
            )}

            {!account.address && letter.kind !== "dispute" && (
              <p className="text-xs mt-3 leading-relaxed" style={{ color: "#C0503C" }}>
                Your report didn&apos;t print a mailing address for {account.name}. Find it on the
                account page of your report and write it on before sending — don&apos;t use one from a
                search, the same agency runs several and only the one on your file counts.
              </p>
            )}
          </div>

          {/* The letter itself — this is what prints */}
          <div className="letter-page p-6 md:p-10" style={{ background: "#fff" }}>
            <pre style={{
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "12.5pt", lineHeight: 1.55, color: "#111",
            }}>{text}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export { senderBlock };
