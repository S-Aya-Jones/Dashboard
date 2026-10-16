"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Dictation for the journal.
//
// The app already has a VoiceButton, but it's built for commands: one phrase,
// no interim results, stops the moment you pause. Talking through how a day
// went is the opposite shape — long, full of pauses, and she needs to see the
// words land or she won't trust that it's listening.
//
// So: continuous, interim results on, and a restart on every `end` while she
// still has the mic open. That restart is not optional. Safari and Chrome both
// stop the recogniser after a few seconds of silence whatever `continuous`
// says, and without re-arming it a pause to think would quietly end the entry.

interface SpeechRecognitionAlternative { transcript: string; confidence: number }
interface SpeechRecognitionResult { readonly length: number; isFinal: boolean; [i: number]: SpeechRecognitionAlternative }
interface SpeechRecognitionResultList { readonly length: number; [i: number]: SpeechRecognitionResult }
interface SpeechRecognitionEventLike extends Event { resultIndex: number; results: SpeechRecognitionResultList }
interface SpeechRecognitionErrorLike extends Event { error: string }

interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// Deliberately not a `declare global` — VoiceButton already declares these on
// Window with its own narrower shape, and two global declarations of the same
// property is a type error. A local cast keeps the two components independent.
type SpeechWindow = {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

const speechWindow = (): SpeechWindow =>
  (typeof window === "undefined" ? {} : window) as unknown as SpeechWindow;

export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** Words recognised but not yet committed — shown greyed, mid-sentence. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * @param onText Called with each finalised chunk, ready to append. Given a
 *   leading space where one is needed so the caller can concatenate blindly.
 */
export function useDictation(onText: (chunk: string) => void): Dictation {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<Recognition | null>(null);
  // Read inside the recogniser's own callbacks, which close over their
  // creation-time scope — a piece of state would always be the old value.
  const wantOn = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    const w = speechWindow();
    setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  const build = useCallback((): Recognition | null => {
    const w = speechWindow();
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => { setListening(true); setError(null); };

    rec.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const clean = text.trim();
          if (clean) onTextRef.current(clean);
        } else {
          pending += text;
        }
      }
      setInterim(pending.trim());
    };

    rec.onerror = (e) => {
      // "no-speech" and "aborted" are ordinary in a long entry — she paused, or
      // we re-armed. Surfacing them would flash an error every time she thinks.
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantOn.current = false;
        setListening(false);
        setError("Microphone access is off for this site. Turn it on in your browser settings and try again.");
        return;
      }
      setError("Dictation dropped out. Tap the mic to pick it back up — nothing you've said is lost.");
    };

    rec.onend = () => {
      setInterim("");
      // The recogniser stops itself after a pause however `continuous` is set.
      // If she hasn't tapped stop, start it again.
      if (wantOn.current) {
        try { rec.start(); return; } catch { /* fall through to off */ }
      }
      setListening(false);
    };

    return rec;
  }, []);

  const start = useCallback(() => {
    if (wantOn.current) return;
    const rec = recRef.current ?? build();
    if (!rec) { setError("This browser can't do dictation. Safari on iPhone can."); return; }
    recRef.current = rec;
    wantOn.current = true;
    try { rec.start(); } catch { /* already running */ }
  }, [build]);

  const stop = useCallback(() => {
    wantOn.current = false;
    setInterim("");
    try { recRef.current?.stop(); } catch { /* not running */ }
    setListening(false);
  }, []);

  // A mic left live after the page closes is both a battery drain and a thing
  // nobody wants running unannounced.
  useEffect(() => () => {
    wantOn.current = false;
    try { recRef.current?.abort(); } catch { /* fine */ }
  }, []);

  return { supported, listening, interim, error, start, stop };
}
