"use client";

import { useEffect, useState } from "react";

// What the tutor is currently looking over her shoulder at.
//
// The dock is mounted once in the root layout so the conversation survives
// navigation, which means it cannot receive props from the page. Rather than
// lifting lecture state into a provider that wraps the whole app, the study
// views announce what is on screen and the dock listens. Without this the
// tutor opened on Physiology no matter what she was reading, which is what
// made it feel bolted on.

export interface StudyContext {
  course?: string;
  lectureId?: string;
  lectureTitle?: string;
}

const EVENT = "study-context-change";
let current: StudyContext = {};

export function setStudyContext(next: StudyContext): void {
  current = next;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Announce what this view is showing for as long as it is mounted. */
export function useAnnounceStudyContext(ctx: StudyContext): void {
  const { course, lectureId, lectureTitle } = ctx;
  useEffect(() => {
    setStudyContext({ course, lectureId, lectureTitle });
    return () => setStudyContext({});
  }, [course, lectureId, lectureTitle]);
}

export function useStudyContext(): StudyContext {
  const [ctx, setCtx] = useState<StudyContext>(current);
  useEffect(() => {
    const onChange = () => setCtx(current);
    window.addEventListener(EVENT, onChange);
    // Whatever was announced before this mounted still counts.
    setCtx(current);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return ctx;
}
