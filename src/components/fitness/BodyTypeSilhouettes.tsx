// SVG silhouette illustrations for each goal body type

export function AthleticLeanSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="30" cy="8" rx="7" ry="8" fill="currentColor" />
      {/* Neck */}
      <rect x="27" y="15" width="6" height="5" rx="2" fill="currentColor" />
      {/* Shoulders - wide */}
      <path d="M10 22 Q30 18 50 22 L52 32 Q30 28 8 32 Z" fill="currentColor" />
      {/* Torso - narrow waist */}
      <path d="M16 30 Q30 35 44 30 L42 52 Q30 48 18 52 Z" fill="currentColor" />
      {/* Waist - very narrow */}
      <path d="M18 50 Q30 46 42 50 L41 56 Q30 52 19 56 Z" fill="currentColor" />
      {/* Hips - moderate */}
      <path d="M19 54 Q30 58 41 54 L40 65 Q30 61 20 65 Z" fill="currentColor" />
      {/* Arms */}
      <path d="M10 22 L6 48 Q8 50 10 48 L14 32" fill="currentColor" />
      <path d="M50 22 L54 48 Q52 50 50 48 L46 32" fill="currentColor" />
      {/* Legs - muscular */}
      <path d="M20 63 L16 96 Q20 97 22 96 L26 70 Q28 68 30 70 L34 96 Q36 97 40 96 L36 63" fill="currentColor" />
    </svg>
  );
}

export function HourglassSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="30" cy="8" rx="7" ry="8" fill="currentColor" />
      {/* Neck */}
      <rect x="27" y="15" width="6" height="5" rx="2" fill="currentColor" />
      {/* Shoulders - wide */}
      <path d="M8 22 Q30 17 52 22 L54 33 Q30 28 6 33 Z" fill="currentColor" />
      {/* Chest - full */}
      <path d="M14 30 Q30 38 46 30 L44 45 Q30 42 16 45 Z" fill="currentColor" />
      {/* Waist - very tight */}
      <path d="M20 44 Q30 40 40 44 L40 54 Q30 50 20 54 Z" fill="currentColor" />
      {/* Hips - wide */}
      <path d="M14 52 Q30 60 46 52 L45 66 Q30 62 15 66 Z" fill="currentColor" />
      {/* Arms */}
      <path d="M8 22 L4 50 Q6 52 8 50 L14 32" fill="currentColor" />
      <path d="M52 22 L56 50 Q54 52 52 50 L46 32" fill="currentColor" />
      {/* Legs - full */}
      <path d="M15 64 L11 96 Q15 97 17 96 L24 72 Q28 69 30 72 L36 96 Q38 97 42 96 L38 64" fill="currentColor" />
    </svg>
  );
}

export function TonedFitSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="30" cy="8" rx="7" ry="8" fill="currentColor" />
      {/* Neck */}
      <rect x="27" y="15" width="6" height="5" rx="2" fill="currentColor" />
      {/* Shoulders - moderate */}
      <path d="M12 22 Q30 19 48 22 L50 31 Q30 27 10 31 Z" fill="currentColor" />
      {/* Torso */}
      <path d="M16 29 Q30 33 44 29 L43 48 Q30 45 17 48 Z" fill="currentColor" />
      {/* Waist */}
      <path d="M19 47 Q30 43 41 47 L40 55 Q30 51 20 55 Z" fill="currentColor" />
      {/* Hips */}
      <path d="M17 53 Q30 58 43 53 L42 64 Q30 60 18 64 Z" fill="currentColor" />
      {/* Arms */}
      <path d="M12 22 L8 47 Q10 49 12 47 L16 31" fill="currentColor" />
      <path d="M48 22 L52 47 Q50 49 48 47 L44 31" fill="currentColor" />
      {/* Legs */}
      <path d="M18 62 L14 96 Q18 97 20 96 L26 70 Q28 68 30 70 L34 96 Q36 97 40 96 L37 62" fill="currentColor" />
    </svg>
  );
}

export function SlimTrimSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="30" cy="8" rx="6" ry="7" fill="currentColor" />
      {/* Neck */}
      <rect x="27.5" y="14" width="5" height="5" rx="2" fill="currentColor" />
      {/* Shoulders - narrower */}
      <path d="M16 21 Q30 19 44 21 L46 29 Q30 26 14 29 Z" fill="currentColor" />
      {/* Torso - straight */}
      <path d="M18 28 Q30 31 42 28 L41 50 Q30 47 19 50 Z" fill="currentColor" />
      {/* Waist */}
      <path d="M21 49 Q30 46 39 49 L38 56 Q30 53 22 56 Z" fill="currentColor" />
      {/* Hips - close to waist */}
      <path d="M20 54 Q30 57 40 54 L39 63 Q30 59 21 63 Z" fill="currentColor" />
      {/* Arms - slim */}
      <path d="M16 21 L12 46 Q14 48 16 46 L19 29" fill="currentColor" />
      <path d="M44 21 L48 46 Q46 48 44 46 L41 29" fill="currentColor" />
      {/* Legs - slender */}
      <path d="M21 61 L17 96 Q21 97 23 96 L27 70 Q29 68 31 70 L35 96 Q37 97 40 96 L37 61" fill="currentColor" />
    </svg>
  );
}

export function CurvyFitSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="30" cy="8" rx="7" ry="8" fill="currentColor" />
      {/* Neck */}
      <rect x="27" y="15" width="6" height="5" rx="2" fill="currentColor" />
      {/* Shoulders */}
      <path d="M10 22 Q30 18 50 22 L52 32 Q30 28 8 32 Z" fill="currentColor" />
      {/* Chest - full */}
      <path d="M14 30 Q30 40 46 30 L45 46 Q30 44 15 46 Z" fill="currentColor" />
      {/* Waist - defined */}
      <path d="M18 45 Q30 41 42 45 L41 54 Q30 50 19 54 Z" fill="currentColor" />
      {/* Hips - very full */}
      <path d="M12 52 Q30 62 48 52 L47 67 Q30 64 13 67 Z" fill="currentColor" />
      {/* Arms */}
      <path d="M10 22 L6 50 Q8 52 10 50 L14 32" fill="currentColor" />
      <path d="M50 22 L54 50 Q52 52 50 50 L46 32" fill="currentColor" />
      {/* Legs - full & curvy */}
      <path d="M13 65 L9 96 Q13 97 15 96 L23 72 Q27 69 30 72 L37 96 Q39 97 43 96 L39 65" fill="currentColor" />
    </svg>
  );
}

export function BuilderSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="30" cy="7" rx="7" ry="7" fill="currentColor" />
      {/* Neck - thick */}
      <rect x="25" y="13" width="10" height="6" rx="2" fill="currentColor" />
      {/* Shoulders - very wide */}
      <path d="M4 20 Q30 14 56 20 L58 33 Q30 27 2 33 Z" fill="currentColor" />
      {/* Chest - massive */}
      <path d="M10 30 Q30 42 50 30 L50 50 Q30 46 10 50 Z" fill="currentColor" />
      {/* Waist */}
      <path d="M16 49 Q30 44 44 49 L44 58 Q30 53 16 58 Z" fill="currentColor" />
      {/* Hips */}
      <path d="M16 56 Q30 60 44 56 L43 66 Q30 62 17 66 Z" fill="currentColor" />
      {/* Arms - very thick */}
      <path d="M4 20 L0 52 Q3 55 6 52 L12 32" fill="currentColor" />
      <path d="M56 20 L60 52 Q57 55 54 52 L48 32" fill="currentColor" />
      {/* Legs - thick */}
      <path d="M17 64 L12 96 Q17 97 19 96 L25 70 Q28 67 30 70 L35 96 Q37 97 42 96 L38 64" fill="currentColor" />
    </svg>
  );
}
