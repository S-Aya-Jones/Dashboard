// Generated from docs/mcat-137-runway.html — the 137-day MCAT runway plan.
// Static config, not database rows. Edit here to change the plan.

export type ChipCode = "bc" | "bio" | "gc" | "phys" | "org" | "ps" | "cars" | "fl" | "rest";

export const CHIP_LABELS: Record<ChipCode, string> = {
  bc: "BIOCHEM",
  bio: "BIO",
  gc: "GEN CHEM",
  phys: "PHYSICS",
  org: "ORGO",
  ps: "PSYCH/SOC",
  cars: "CARS",
  fl: "FULL-LENGTH",
  rest: "LIGHTER",
};

export interface RunwayPhase {
  phase: 1 | 2 | 3;
  no: string;
  title: string;
  sub: string;
}

export interface RunwayDay {
  day: number;
  phase: 1 | 2 | 3;
  chips: ChipCode[];
  /** Task text as HTML; only ever rendered from this static file, never user input. */
  task: string;
  long: boolean;
}

export interface RunwayWeek {
  index: number;
  name: string;
  focus: string;
  phase: 1 | 2 | 3;
  startDay: number;
  endDay: number;
  days: RunwayDay[];
}

export const RUNWAY_PHASES: RunwayPhase[] = [
  {
    "phase": 1,
    "no": "01",
    "title": "Content · Anki · CARS foundation",
    "sub": "weeks 1–8 · stop the bleeding on gaps"
  },
  {
    "phase": 2,
    "no": "02",
    "title": "UWorld — practice becomes the center",
    "sub": "weeks 9–15 · where the score actually climbs"
  },
  {
    "phase": 3,
    "no": "03",
    "title": "AAMC only — full-lengths & taper",
    "sub": "weeks 16–19.5 · the FL average is the truth"
  }
];

export const RUNWAY_WEEKS: RunwayWeek[] = [
  {
    "index": 1,
    "name": "Biochem — proteins & enzymes",
    "focus": "highest-yield subject, first",
    "phase": 1,
    "startDay": 1,
    "endDay": 7,
    "days": [
      {
        "day": 1,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Amino acids I.</span> Nonpolar + aromatic — draw all, classify, charge at pH 7, 1- & 3-letter codes. Cards + 5 discretes.",
        "long": false
      },
      {
        "day": 2,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Amino acids II.</span> Polar uncharged, acidic, basic. Side-chain pKa's, charge at pH 7. Cards + 5 discretes.",
        "long": false
      },
      {
        "day": 3,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Protein structure.</span> 1°→4°, the bond stabilizing each level, denaturation. Cards.",
        "long": false
      },
      {
        "day": 4,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Enzyme function.</span> Active site, cofactors vs coenzymes, allosteric & feedback regulation. Cards.",
        "long": false
      },
      {
        "day": 5,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Enzyme kinetics.</span> Michaelis–Menten, Km/Vmax, Lineweaver–Burk, all inhibition types + what shifts. Cards + discretes.",
        "long": false
      },
      {
        "day": 6,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Long day.</span> Re-draw all 20 AAs cold from blank paper (target <10 min, 0 errors). 2 biochem passage sets + deep review. Begin glycolysis reading.",
        "long": true
      },
      {
        "day": 7,
        "phase": 1,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Lighter.</span> Anki + CARS only, then re-do the week's weakest cards and re-tag any miss you didn't fully understand.",
        "long": false
      }
    ]
  },
  {
    "index": 2,
    "name": "Biochem — metabolism",
    "focus": "build one giant hand-drawn map",
    "phase": 1,
    "startDay": 8,
    "endDay": 14,
    "days": [
      {
        "day": 8,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Glycolysis.</span> Every regulated step, PFK-1 as the gatekeeper + its activators/inhibitors, net products. Start the metabolism map.",
        "long": false
      },
      {
        "day": 9,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Pyruvate fates + TCA.</span> PDH regulation, each TCA step, rate-limiting enzymes. Add to map.",
        "long": false
      },
      {
        "day": 10,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>ETC + oxidative phosphorylation.</span> Complexes, chemiosmosis, uncouplers, what poisons do. Add to map.",
        "long": false
      },
      {
        "day": 11,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Gluconeogenesis + glycogen.</span> Synthesis/breakdown, hormonal control (insulin/glucagon/epi).",
        "long": false
      },
      {
        "day": 12,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Lipid metabolism.</span> Fatty acid synthesis vs β-oxidation, ketone bodies, cholesterol basics.",
        "long": false
      },
      {
        "day": 13,
        "phase": 1,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>Long day.</span> Reproduce the ENTIRE metabolism map from a blank page — star every rate-limiting enzyme + its regulator. 2–3 biochem passage sets + review.",
        "long": true
      },
      {
        "day": 14,
        "phase": 1,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Lighter.</span> Anki + CARS, review week's misses, patch the fuzzy map regions.",
        "long": false
      }
    ]
  },
  {
    "index": 3,
    "name": "Bio — molecular & genetics",
    "focus": "techniques over rote pathways",
    "phase": 1,
    "startDay": 15,
    "endDay": 21,
    "days": [
      {
        "day": 15,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>DNA → central dogma.</span> Replication, repair, the flow. Cards + discretes.",
        "long": false
      },
      {
        "day": 16,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Transcription + translation.</span> Steps, post-translational modification. Cards.",
        "long": false
      },
      {
        "day": 17,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Gene regulation.</span> Operons (lac/trp), eukaryotic control, epigenetics. Cards.",
        "long": false
      },
      {
        "day": 18,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Lab techniques.</span> PCR, gel electrophoresis, Southern/Northern/Western, sequencing, cloning — higher yield than memorizing every transcription detail.",
        "long": false
      },
      {
        "day": 19,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Genetics.</span> Mendelian, pedigrees, Hardy–Weinberg, linkage & recombination. Cards + discretes.",
        "long": false
      },
      {
        "day": 20,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Long day.</span> Bio passage sets ×2–3 + review. Pankow P/S deck check-in: are you keeping pace on new cards?",
        "long": true
      },
      {
        "day": 21,
        "phase": 1,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Lighter.</span> Anki + CARS, week review.",
        "long": false
      }
    ]
  },
  {
    "index": 4,
    "name": "Bio — cells, micro, immune",
    "focus": "",
    "phase": 1,
    "startDay": 22,
    "endDay": 28,
    "days": [
      {
        "day": 22,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Cell biology.</span> Organelles, membrane structure, transport (passive/active/bulk). Cards.",
        "long": false
      },
      {
        "day": 23,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Cell cycle.</span> Mitosis vs meiosis, checkpoints, cancer/apoptosis. Cards + discretes.",
        "long": false
      },
      {
        "day": 24,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Microbiology.</span> Bacteria structure/genetics, viral life cycles (lytic/lysogenic, retro). Cards.",
        "long": false
      },
      {
        "day": 25,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Immunology.</span> Innate vs adaptive, B/T cells, antibody structure & function. Cards.",
        "long": false
      },
      {
        "day": 26,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Bioenergetics + catch-up.</span> Patch any weak bio topic flagged so far. Discretes on weak areas.",
        "long": false
      },
      {
        "day": 27,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Long day.</span> Bio passage sets + review.",
        "long": true
      },
      {
        "day": 28,
        "phase": 1,
        "chips": [
          "rest",
          "cars"
        ],
        "task": "<span class='lead'>Lighter + CARS push.</span> Anki, then one full timed CARS section (not 2 passages) to start building stamina + review every miss.",
        "long": false
      }
    ]
  },
  {
    "index": 5,
    "name": "Bio — physiology I",
    "focus": "endocrine table is the giant",
    "phase": 1,
    "startDay": 29,
    "endDay": 35,
    "days": [
      {
        "day": 29,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Endocrine I.</span> Build hormone table: hypothalamus/pituitary axis, thyroid, adrenal — source · trigger · target · effect · feedback.",
        "long": false
      },
      {
        "day": 30,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Endocrine II.</span> Pancreas, gonads, calcium regulation (PTH/calcitonin/vit D). Complete the table. Drill the feedback loops.",
        "long": false
      },
      {
        "day": 31,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Neuron + signaling.</span> Resting potential, action potential, synapse, major neurotransmitters. Cards.",
        "long": false
      },
      {
        "day": 32,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Nervous system organization.</span> CNS/PNS, autonomic, reflex arcs, sensory basics. Cards.",
        "long": false
      },
      {
        "day": 33,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Muscle.</span> Skeletal/cardiac/smooth, sliding-filament, motor units, excitation-contraction. Cards + discretes.",
        "long": false
      },
      {
        "day": 34,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Long day.</span> Reproduce the full hormone table from blank paper. Physiology passage sets + review.",
        "long": true
      },
      {
        "day": 35,
        "phase": 1,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Lighter.</span> Anki + CARS, week review.",
        "long": false
      }
    ]
  },
  {
    "index": 6,
    "name": "Bio — physiology II",
    "focus": "if X rises, what happens to Y",
    "phase": 1,
    "startDay": 36,
    "endDay": 42,
    "days": [
      {
        "day": 36,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Cardiovascular.</span> Heart anatomy, conduction order, cardiac cycle, BP regulation, circulation. Cards.",
        "long": false
      },
      {
        "day": 37,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Respiratory.</span> Gas exchange, O₂–hemoglobin dissociation curve + every shift, control of breathing. Cards.",
        "long": false
      },
      {
        "day": 38,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Renal.</span> Nephron — where each thing is filtered/reabsorbed/secreted, osmoregulation, acid-base. Cards.",
        "long": false
      },
      {
        "day": 39,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Digestive.</span> Enzymes by site, absorption, hormonal control (gastrin/secretin/CCK). Cards.",
        "long": false
      },
      {
        "day": 40,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Reproductive + development.</span> Cycles, hormones, fertilization → early development. Cards + discretes.",
        "long": false
      },
      {
        "day": 41,
        "phase": 1,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>Long day.</span> Big physiology passage day across all systems. Recall hormone table + feedback loops cold. Review.",
        "long": true
      },
      {
        "day": 42,
        "phase": 1,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Lighter.</span> Anki + CARS, week review.",
        "long": false
      }
    ]
  },
  {
    "index": 7,
    "name": "General chemistry",
    "focus": "acid/base + equilibrium = the core",
    "phase": 1,
    "startDay": 43,
    "endDay": 49,
    "days": [
      {
        "day": 43,
        "phase": 1,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>Atomic + bonding (fast).</span> Periodic trends, bonding, intermolecular forces — mostly review. Discretes.",
        "long": false
      },
      {
        "day": 44,
        "phase": 1,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>Acids & bases.</span> pH/pKa, buffers, titration curves, polyprotic. HIGHEST-frequency gen chem topic. Cards + discretes.",
        "long": false
      },
      {
        "day": 45,
        "phase": 1,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>Equilibrium.</span> Keq, Le Châtelier reasoning, Ksp & solubility. Cards + discretes.",
        "long": false
      },
      {
        "day": 46,
        "phase": 1,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>Thermo + kinetics.</span> ΔG/ΔH/ΔS spontaneity & sign conventions, rate laws, catalysts. Cards.",
        "long": false
      },
      {
        "day": 47,
        "phase": 1,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>Electrochem + gases/solutions.</span> Galvanic vs electrolytic, Nernst; gas laws, colligative properties. Cards.",
        "long": false
      },
      {
        "day": 48,
        "phase": 1,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>Long day.</span> Gen chem passage sets + discretes (it shows up as passage-embedded reasoning). Review.",
        "long": true
      },
      {
        "day": 49,
        "phase": 1,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Lighter.</span> Anki + CARS, week review.",
        "long": false
      }
    ]
  },
  {
    "index": 8,
    "name": "Physics · Orgo · baseline FL",
    "focus": "low yield — compress, don't sink",
    "phase": 1,
    "startDay": 50,
    "endDay": 56,
    "days": [
      {
        "day": 50,
        "phase": 1,
        "chips": [
          "phys"
        ],
        "task": "<span class='lead'>Physics core.</span> Kinematics, forces, work/energy. Memorize the formula sheet to instant recall. Discretes.",
        "long": false
      },
      {
        "day": 51,
        "phase": 1,
        "chips": [
          "phys"
        ],
        "task": "<span class='lead'>Fluids.</span> Bernoulli, continuity, pressure, buoyancy — reappears constantly in cardio physiology. Cards + discretes.",
        "long": false
      },
      {
        "day": 52,
        "phase": 1,
        "chips": [
          "phys"
        ],
        "task": "<span class='lead'>Circuits + electrostatics.</span> Ohm's law, series/parallel, fields/potential — circuits map onto neurons. Cards.",
        "long": false
      },
      {
        "day": 53,
        "phase": 1,
        "chips": [
          "phys"
        ],
        "task": "<span class='lead'>Waves, sound, optics, thermo.</span> One focused pass, formula recall, move on. Discretes.",
        "long": false
      },
      {
        "day": 54,
        "phase": 1,
        "chips": [
          "org"
        ],
        "task": "<span class='lead'>Orgo — the high-yield slice.</span> Spectroscopy (IR peaks, NMR splitting/shift, mass spec) + separations/chromatography. This is most of orgo's points.",
        "long": false
      },
      {
        "day": 55,
        "phase": 1,
        "chips": [
          "org"
        ],
        "task": "<span class='lead'>Orgo — minimal.</span> Stereochemistry + the handful of common mechanisms. Do NOT memorize every reaction. Mixed passages + review.",
        "long": true
      },
      {
        "day": 56,
        "phase": 1,
        "chips": [
          "fl"
        ],
        "task": "<span class='lead'>BASELINE FULL-LENGTH.</span> Third-party FL (save AAMC for Phase 3), full timing, 7:30am start. This is your Phase 1 readout, not a grade — log section scores + every cause-tag.",
        "long": true
      }
    ]
  },
  {
    "index": 9,
    "name": "UWorld — biochem + bio",
    "focus": "~40–50 q/day, review > doing",
    "phase": 2,
    "startDay": 57,
    "endDay": 63,
    "days": [
      {
        "day": 57,
        "phase": 2,
        "chips": [
          "bc"
        ],
        "task": "<span class='lead'>UWorld biochem block</span> (timed). Then review longer than you did it — tag every miss. Patch gaps with cards.",
        "long": false
      },
      {
        "day": 58,
        "phase": 2,
        "chips": [
          "bc",
          "bio"
        ],
        "task": "<span class='lead'>UWorld biochem/bio block.</span> Timed → deep review. Re-study any topic two misses point to.",
        "long": false
      },
      {
        "day": 59,
        "phase": 2,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>UWorld bio block</span> (physiology emphasis). Timed → tag → patch.",
        "long": false
      },
      {
        "day": 60,
        "phase": 2,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>UWorld bio block</span> (molecular/genetics). Timed → review → cards on gaps.",
        "long": false
      },
      {
        "day": 61,
        "phase": 2,
        "chips": [
          "bc",
          "bio"
        ],
        "task": "<span class='lead'>Mixed B/B block.</span> Timed → review. Note which cause-tag is repeating most this week — that's next week's fix.",
        "long": false
      },
      {
        "day": 62,
        "phase": 2,
        "chips": [
          "bc",
          "bio"
        ],
        "task": "<span class='lead'>Long day.</span> 3–4 UWorld B/B sets + one long review block tagging everything. Anki backlog clear.",
        "long": true
      },
      {
        "day": 63,
        "phase": 2,
        "chips": [
          "rest",
          "cars"
        ],
        "task": "<span class='lead'>Lighter.</span> Full timed CARS section + review. Anki. Weekly miss audit.",
        "long": false
      }
    ]
  },
  {
    "index": 10,
    "name": "UWorld — bio + gen chem",
    "focus": "",
    "phase": 2,
    "startDay": 64,
    "endDay": 70,
    "days": [
      {
        "day": 64,
        "phase": 2,
        "chips": [
          "bio"
        ],
        "task": "<span class='lead'>UWorld bio block.</span> Timed → review → patch.",
        "long": false
      },
      {
        "day": 65,
        "phase": 2,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>UWorld gen chem block.</span> Timed → review. Acid/base + equilibrium emphasis.",
        "long": false
      },
      {
        "day": 66,
        "phase": 2,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>UWorld gen chem block.</span> Timed → review → cards on weak equations/concepts.",
        "long": false
      },
      {
        "day": 67,
        "phase": 2,
        "chips": [
          "bio",
          "gc"
        ],
        "task": "<span class='lead'>Mixed bio/gen-chem block.</span> Timed → review.",
        "long": false
      },
      {
        "day": 68,
        "phase": 2,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>UWorld gen chem block.</span> Thermo/electrochem emphasis. Timed → tag → patch.",
        "long": false
      },
      {
        "day": 69,
        "phase": 2,
        "chips": [
          "bio",
          "gc"
        ],
        "task": "<span class='lead'>Long day.</span> 3–4 mixed sets + review.",
        "long": true
      },
      {
        "day": 70,
        "phase": 2,
        "chips": [
          "rest",
          "cars"
        ],
        "task": "<span class='lead'>Lighter.</span> Full timed CARS + review. Anki. Weekly audit.",
        "long": false
      }
    ]
  },
  {
    "index": 11,
    "name": "UWorld — gen chem + physics",
    "focus": "",
    "phase": 2,
    "startDay": 71,
    "endDay": 77,
    "days": [
      {
        "day": 71,
        "phase": 2,
        "chips": [
          "gc"
        ],
        "task": "<span class='lead'>UWorld gen chem block.</span> Timed → review.",
        "long": false
      },
      {
        "day": 72,
        "phase": 2,
        "chips": [
          "phys"
        ],
        "task": "<span class='lead'>UWorld physics block.</span> Fluids + circuits emphasis. Timed → review → formula recall fixes.",
        "long": false
      },
      {
        "day": 73,
        "phase": 2,
        "chips": [
          "phys"
        ],
        "task": "<span class='lead'>UWorld physics block.</span> Timed → review → cards.",
        "long": false
      },
      {
        "day": 74,
        "phase": 2,
        "chips": [
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Mixed C/P (chem-phys) block.</span> Timed → review. This mirrors a real test section.",
        "long": false
      },
      {
        "day": 75,
        "phase": 2,
        "chips": [
          "phys"
        ],
        "task": "<span class='lead'>UWorld physics block.</span> Weak-topic emphasis from this week's tags. Timed → patch.",
        "long": false
      },
      {
        "day": 76,
        "phase": 2,
        "chips": [
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Long day.</span> 3–4 C/P sets + review.",
        "long": true
      },
      {
        "day": 77,
        "phase": 2,
        "chips": [
          "rest",
          "cars"
        ],
        "task": "<span class='lead'>Lighter.</span> Full timed CARS + review. Anki. Weekly audit.",
        "long": false
      }
    ]
  },
  {
    "index": 12,
    "name": "UWorld — physics, orgo + mid FL",
    "focus": "midpoint reality check",
    "phase": 2,
    "startDay": 78,
    "endDay": 84,
    "days": [
      {
        "day": 78,
        "phase": 2,
        "chips": [
          "phys"
        ],
        "task": "<span class='lead'>UWorld physics block.</span> Timed → review.",
        "long": false
      },
      {
        "day": 79,
        "phase": 2,
        "chips": [
          "org"
        ],
        "task": "<span class='lead'>UWorld orgo block.</span> Spectroscopy + lab techniques emphasis. Timed → review.",
        "long": false
      },
      {
        "day": 80,
        "phase": 2,
        "chips": [
          "org",
          "gc"
        ],
        "task": "<span class='lead'>Mixed orgo/gen-chem block.</span> Timed → review → cards.",
        "long": false
      },
      {
        "day": 81,
        "phase": 2,
        "chips": [
          "bc",
          "org"
        ],
        "task": "<span class='lead'>Mixed C/P block.</span> Biochem + orgo + chem together. Timed → review.",
        "long": false
      },
      {
        "day": 82,
        "phase": 2,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Mixed everything block.</span> Start training section-switching. Timed → review.",
        "long": false
      },
      {
        "day": 83,
        "phase": 2,
        "chips": [
          "fl"
        ],
        "task": "<span class='lead'>MIDPOINT FULL-LENGTH.</span> Third-party FL, full sim, 7:30am. Compare to baseline — is each section moving? Tag everything.",
        "long": true
      },
      {
        "day": 84,
        "phase": 2,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>FL review day.</span> Tag every miss from the FL to root cause. The FL review matters more than the FL. Anki.",
        "long": false
      }
    ]
  },
  {
    "index": 13,
    "name": "UWorld — psych/soc heavy + mixed",
    "focus": "fastest points on the test",
    "phase": 2,
    "startDay": 85,
    "endDay": 91,
    "days": [
      {
        "day": 85,
        "phase": 2,
        "chips": [
          "ps"
        ],
        "task": "<span class='lead'>Pankow deck — close the gap.</span> If the deck isn't finished, this is the week it gets done. UWorld P/S block + review.",
        "long": false
      },
      {
        "day": 86,
        "phase": 2,
        "chips": [
          "ps"
        ],
        "task": "<span class='lead'>UWorld P/S block.</span> Learn how they phrase questions — the content is the easy part. Timed → review.",
        "long": false
      },
      {
        "day": 87,
        "phase": 2,
        "chips": [
          "ps"
        ],
        "task": "<span class='lead'>UWorld P/S block.</span> Khan P/S videos ONLY for deck-flagged fuzzy concepts. Timed → review.",
        "long": false
      },
      {
        "day": 88,
        "phase": 2,
        "chips": [
          "ps",
          "bio"
        ],
        "task": "<span class='lead'>P/S + bio (behavioral) block.</span> Nervous system + behavior overlap. Timed → review.",
        "long": false
      },
      {
        "day": 89,
        "phase": 2,
        "chips": [
          "ps"
        ],
        "task": "<span class='lead'>UWorld P/S block.</span> This is your 125→132 section — grind it. Timed → review → cards.",
        "long": false
      },
      {
        "day": 90,
        "phase": 2,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys",
          "ps"
        ],
        "task": "<span class='lead'>Long day.</span> Mixed sets across all sections + review.",
        "long": true
      },
      {
        "day": 91,
        "phase": 2,
        "chips": [
          "rest",
          "cars"
        ],
        "task": "<span class='lead'>Lighter.</span> Full timed CARS + review. Anki. Weekly audit.",
        "long": false
      }
    ]
  },
  {
    "index": 14,
    "name": "UWorld — mixed timed sections",
    "focus": "train the full-section muscle",
    "phase": 2,
    "startDay": 92,
    "endDay": 98,
    "days": [
      {
        "day": 92,
        "phase": 2,
        "chips": [
          "bio",
          "bc"
        ],
        "task": "<span class='lead'>Timed B/B half-section.</span> ~30 questions in one sitting → review.",
        "long": false
      },
      {
        "day": 93,
        "phase": 2,
        "chips": [
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Timed C/P half-section.</span> ~30 questions → review.",
        "long": false
      },
      {
        "day": 94,
        "phase": 2,
        "chips": [
          "ps"
        ],
        "task": "<span class='lead'>Timed P/S half-section.</span> ~30 questions → review.",
        "long": false
      },
      {
        "day": 95,
        "phase": 2,
        "chips": [
          "cars"
        ],
        "task": "<span class='lead'>Timed full CARS section.</span> 9 passages, real pacing → review every miss to a trap pattern.",
        "long": false
      },
      {
        "day": 96,
        "phase": 2,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Mixed science block.</span> Patch the weakest tag from the week. Timed → review.",
        "long": false
      },
      {
        "day": 97,
        "phase": 2,
        "chips": [
          "bio",
          "bc",
          "gc",
          "phys",
          "ps"
        ],
        "task": "<span class='lead'>Long day.</span> Two full timed sections back to back (build stamina) + review.",
        "long": true
      },
      {
        "day": 98,
        "phase": 2,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Lighter.</span> Anki, CARS, audit. Finish remaining UWorld; flag everything missed for Phase 3 re-do.",
        "long": false
      }
    ]
  },
  {
    "index": 15,
    "name": "Bridge into AAMC",
    "focus": "transition to the test-makers' material",
    "phase": 2,
    "startDay": 99,
    "endDay": 105,
    "days": [
      {
        "day": 99,
        "phase": 2,
        "chips": [
          "bc",
          "bio"
        ],
        "task": "<span class='lead'>AAMC Section Bank — B/B.</span> Begin. Harder + more representative than UWorld. Timed → deep review.",
        "long": false
      },
      {
        "day": 100,
        "phase": 2,
        "chips": [
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>AAMC Section Bank — C/P.</span> Timed → deep review → cards.",
        "long": false
      },
      {
        "day": 101,
        "phase": 2,
        "chips": [
          "ps"
        ],
        "task": "<span class='lead'>AAMC Section Bank — P/S.</span> Timed → review.",
        "long": false
      },
      {
        "day": 102,
        "phase": 2,
        "chips": [
          "cars"
        ],
        "task": "<span class='lead'>AAMC CARS Question Pack.</span> Switch all CARS to AAMC material now. Review trap patterns.",
        "long": false
      },
      {
        "day": 103,
        "phase": 2,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>AAMC Question Pack (science).</span> Discretes-heavy, exposes precise gaps. Timed → patch.",
        "long": false
      },
      {
        "day": 104,
        "phase": 2,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys",
          "ps"
        ],
        "task": "<span class='lead'>Long day.</span> Mixed AAMC Section Bank + Q-Pack work + review. Finish UWorld if anything remains.",
        "long": true
      },
      {
        "day": 105,
        "phase": 2,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Lighter.</span> Anki, AAMC CARS, weekly audit. Prep for FL phase.",
        "long": false
      }
    ]
  },
  {
    "index": 16,
    "name": "AAMC Section Banks + FL1",
    "focus": "one full-length per Saturday now",
    "phase": 3,
    "startDay": 106,
    "endDay": 112,
    "days": [
      {
        "day": 106,
        "phase": 3,
        "chips": [
          "bc",
          "bio"
        ],
        "task": "<span class='lead'>AAMC Section Bank — B/B.</span> Finish remaining passages. Timed → deep review.",
        "long": false
      },
      {
        "day": 107,
        "phase": 3,
        "chips": [
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>AAMC Section Bank — C/P.</span> Timed → review → cards on residual gaps.",
        "long": false
      },
      {
        "day": 108,
        "phase": 3,
        "chips": [
          "ps"
        ],
        "task": "<span class='lead'>AAMC Section Bank — P/S.</span> Timed → review.",
        "long": false
      },
      {
        "day": 109,
        "phase": 3,
        "chips": [
          "cars"
        ],
        "task": "<span class='lead'>AAMC CARS Q-Pack.</span> Daily CARS is now all AAMC. Trap-pattern review.",
        "long": false
      },
      {
        "day": 110,
        "phase": 3,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>AAMC Question Packs.</span> Across sciences. Timed → patch weakest tag.",
        "long": false
      },
      {
        "day": 111,
        "phase": 3,
        "chips": [
          "fl"
        ],
        "task": "<span class='lead'>AAMC FULL-LENGTH 1.</span> Full sim — 7:30am start, real breaks, real timing, test-day breakfast. No phone. This score range is your real signal.",
        "long": true
      },
      {
        "day": 112,
        "phase": 3,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>FL1 review (part 1).</span> Tag every miss to root cause. Patch the biggest holes first. Anki.",
        "long": false
      }
    ]
  },
  {
    "index": 17,
    "name": "AAMC Q-Packs + FL2",
    "focus": "",
    "phase": 3,
    "startDay": 113,
    "endDay": 119,
    "days": [
      {
        "day": 113,
        "phase": 3,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys",
          "ps"
        ],
        "task": "<span class='lead'>FL1 review (part 2).</span> Finish tagging. Build a patch list of the top 10 recurring weaknesses — work them all week.",
        "long": false
      },
      {
        "day": 114,
        "phase": 3,
        "chips": [
          "bc",
          "bio"
        ],
        "task": "<span class='lead'>AAMC Q-Pack — Bio/Biochem.</span> Timed → review → patch.",
        "long": false
      },
      {
        "day": 115,
        "phase": 3,
        "chips": [
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>AAMC Q-Pack — Chem/Phys.</span> Timed → review → patch.",
        "long": false
      },
      {
        "day": 116,
        "phase": 3,
        "chips": [
          "ps",
          "cars"
        ],
        "task": "<span class='lead'>AAMC P/S Q-Pack + CARS Q-Pack.</span> Timed → review.",
        "long": false
      },
      {
        "day": 117,
        "phase": 3,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Patch-list day.</span> Hit the specific holes FL1 exposed with targeted Section Bank / Q-Pack passages.",
        "long": false
      },
      {
        "day": 118,
        "phase": 3,
        "chips": [
          "fl"
        ],
        "task": "<span class='lead'>AAMC FULL-LENGTH 2.</span> Full sim, 7:30am. Compare section-by-section to FL1 — what moved, what's stuck?",
        "long": true
      },
      {
        "day": 119,
        "phase": 3,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>FL2 review (part 1).</span> Tag everything. Anki.",
        "long": false
      }
    ]
  },
  {
    "index": 18,
    "name": "Targeted patching + FL3",
    "focus": "close the stuck sections",
    "phase": 3,
    "startDay": 120,
    "endDay": 126,
    "days": [
      {
        "day": 120,
        "phase": 3,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys",
          "ps"
        ],
        "task": "<span class='lead'>FL2 review (part 2).</span> Update the patch list. Whatever section is stuck gets the most hours this week.",
        "long": false
      },
      {
        "day": 121,
        "phase": 3,
        "chips": [
          "bc",
          "bio"
        ],
        "task": "<span class='lead'>Weakest-section drill.</span> Section Bank / Q-Pack passages aimed at the lowest FL section. Timed → review.",
        "long": false
      },
      {
        "day": 122,
        "phase": 3,
        "chips": [
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Second-weakest drill.</span> Targeted AAMC passages. Timed → review.",
        "long": false
      },
      {
        "day": 123,
        "phase": 3,
        "chips": [
          "ps",
          "cars"
        ],
        "task": "<span class='lead'>P/S + CARS.</span> Keep both warm — P/S should be near-locked by now, CARS stays daily. Review.",
        "long": false
      },
      {
        "day": 124,
        "phase": 3,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Mixed AAMC discretes.</span> Re-do previously missed AAMC questions — did the patch hold? Re-tag any that didn't.",
        "long": false
      },
      {
        "day": 125,
        "phase": 3,
        "chips": [
          "fl"
        ],
        "task": "<span class='lead'>AAMC FULL-LENGTH 3.</span> Full sim, 7:30am. Your last-month FL average is forming — is it tracking toward 518+?",
        "long": true
      },
      {
        "day": 126,
        "phase": 3,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>FL3 review (part 1).</span> Tag everything. Anki.",
        "long": false
      }
    ]
  },
  {
    "index": 19,
    "name": "Final FL + taper begins",
    "focus": "peak, then come down clean",
    "phase": 3,
    "startDay": 127,
    "endDay": 133,
    "days": [
      {
        "day": 127,
        "phase": 3,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys",
          "ps"
        ],
        "task": "<span class='lead'>FL3 review (part 2).</span> Last full patch list. Work the highest-frequency cause-tag across all FLs.",
        "long": false
      },
      {
        "day": 128,
        "phase": 3,
        "chips": [
          "bc",
          "bio"
        ],
        "task": "<span class='lead'>Weakest-section targeted drill.</span> AAMC Section Bank / Q-Pack passages aimed at your lowest FL section. Timed → review.",
        "long": false
      },
      {
        "day": 129,
        "phase": 3,
        "chips": [
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Second-weakest targeted drill.</span> Same approach, second-lowest section. Timed → review → patch.",
        "long": false
      },
      {
        "day": 130,
        "phase": 3,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys"
        ],
        "task": "<span class='lead'>Re-do flagged AAMC items.</span> Did the patches hold? Re-tag anything that didn't. Re-read your error log, not new material.",
        "long": false
      },
      {
        "day": 131,
        "phase": 3,
        "chips": [
          "ps",
          "cars"
        ],
        "task": "<span class='lead'>P/S + CARS warm + skim.</span> One P/S Q-Pack set, daily CARS, and a pass over the high-yield sheets (AAs, hormone table, formula sheet).",
        "long": false
      },
      {
        "day": 132,
        "phase": 3,
        "chips": [
          "fl"
        ],
        "task": "<span class='lead'>AAMC FULL-LENGTH 4</span> (or Sample, whichever's unused). Last full sim — lands ~5 days before test. 7:30am. Then stop taking new FLs.",
        "long": true
      },
      {
        "day": 133,
        "phase": 3,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>FL4 review.</span> Final patch — only the cheapest, highest-frequency fixes. No new content from here. Anki light.",
        "long": false
      }
    ]
  },
  {
    "index": 20,
    "name": "Test week — taper & execute",
    "focus": "the work is done; protect the asset",
    "phase": 3,
    "startDay": 134,
    "endDay": 137,
    "days": [
      {
        "day": 134,
        "phase": 3,
        "chips": [
          "bc",
          "bio",
          "gc",
          "phys",
          "ps"
        ],
        "task": "<span class='lead'>Light review.</span> Re-skim error log + high-yield sheets only: 20 AAs, metabolism map, hormone table, formula sheet, P/S terms. Nothing new.",
        "long": false
      },
      {
        "day": 135,
        "phase": 3,
        "chips": [
          "ps",
          "cars"
        ],
        "task": "<span class='lead'>Stay warm, don't strain.</span> A few P/S discretes + 1–2 CARS passages to keep the rhythm. Confirm test-center logistics, ID, route, snacks.",
        "long": false
      },
      {
        "day": 136,
        "phase": 3,
        "chips": [
          "rest"
        ],
        "task": "<span class='lead'>Day before — OFF (or near).</span> Optional 20–30 min light Anki to feel warm. Pack everything. Sleep is the highest-yield activity now. No studying past early afternoon.",
        "long": false
      },
      {
        "day": 137,
        "phase": 3,
        "chips": [
          "fl"
        ],
        "task": "<span class='lead'>TEST DAY.</span> Eat the breakfast you practiced. Trust the reps. Every passage: main idea first, eliminate traps, pace by the section clock. You built this.",
        "long": true
      }
    ]
  }
];

export const RUNWAY_TOTAL_DAYS = 137;

export const RUNWAY_DAYS: RunwayDay[] = RUNWAY_WEEKS.flatMap((w) => w.days);
