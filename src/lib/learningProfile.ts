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
- One good analogy beats three loose ones. If a concept genuinely has no honest analogy, say so plainly and explain it directly rather than forcing a bad one.`;

/** The same guidance, condensed, for prompts that are already long. */
export const LEARNING_PROFILE_SHORT = `She learns through analogies. Lead any mechanism or relationship with one grounded in everyday life, map each part of it explicitly onto the biology, and say where the analogy stops being true. One honest analogy beats several loose ones; if there isn't one, explain directly instead of forcing it.`;
