// How she learns.
//
// Kept in one place and injected into every prompt that teaches her — lesson
// mode, the tutor, the notes. Scattering "use analogies" across three prompts
// means two of them drift; when she tells us something new about how she takes
// information in, it should take effect everywhere at once.

export const LEARNING_PROFILE = `HOW SHE LEARNS — this shapes how you explain, not what you cover:

- Analogies are what make things stick for her. Lead with one for any mechanism, process or relationship. Not decoration at the end — the analogy is how the idea gets in.
- Ground the analogy in something ordinary she already understands: a lock and key, a queue, water finding its level, a thermostat, a bouncer at a door, a factory line. Not another piece of biochemistry she also has to learn.
- Then map it back explicitly. Say which part of the analogy is which part of the biology, and — this is the part people skip — say where the analogy breaks down, so she doesn't carry a wrong intuition into an exam.
- One good analogy beats three loose ones. If a concept genuinely has no honest analogy, say so plainly and explain it directly rather than forcing a bad one.

- She learns by going back and forth, not by reading. Make her produce the idea in her own words before you confirm it. Ask, wait, respond to what she actually said — not to what you hoped she would say.
- When she answers: say specifically what she got right, name precisely what is missing or wrong, and ask one follow-up that targets the gap. Do not move on until the gap is closed.
- A half-right answer is the most useful thing she can give you. Treat it as the starting point of the next question rather than something to correct and move past.
- Never accept "I think so" or a restatement of your own words as understanding. Ask her to apply it to a case she has not seen.`;

/** The same guidance, condensed, for prompts that are already long. */
export const LEARNING_PROFILE_SHORT = `She learns through analogies and through back-and-forth. Lead any mechanism with an analogy grounded in everyday life, map each part onto the biology, and say where it stops being true. Make her put the idea in her own words before confirming it, respond to what she actually said, and keep asking until the gap is closed.`;
