"use client";

import { usePathname } from "next/navigation";
import { usePausedModules } from "@/hooks/usePausedModules";
import { pausedSet } from "@/lib/modules";
import { VoiceButton } from "@/components/VoiceButton";
import { TutorDock } from "@/components/tutor/TutorDock";

// The two floating buttons, and where they don't belong.
//
// VoiceButton is the schedule voice command; the Tutor dock is school. Both
// float over every page in the app, which put two different microphones on the
// journal page — one that writes the entry and one that tries to parse what she
// said as a schedule change. Whichever she tapped first would have been the
// wrong one.
//
// Tutor follows the School pause: no point docking a tutor to every screen
// during a break from school. It stays reachable at /tutor.

const NO_VOICE = ["/journal"];
const NO_TUTOR = ["/journal", "/modules"];

export function FloatingDocks() {
  const pathname = usePathname();
  const tutorPaused = pausedSet(usePausedModules()).has("/tutor");
  return (
    <>
      {!NO_VOICE.includes(pathname) && <VoiceButton />}
      {!tutorPaused && !NO_TUTOR.includes(pathname) && <TutorDock />}
    </>
  );
}
