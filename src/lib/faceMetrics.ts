// Real geometric face metrics computed from MediaPipe Face Landmarker points.
// No fabricated scores (no attractiveness rating, no percentile, no demographic guesses) —
// every number here is a directly measurable distance, ratio, or angle between landmarks.

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface FaceMetrics {
  symmetryScore: number; // 0-100, higher = more symmetric
  symmetryNote: string;
  facialThirds: {
    upper: number; // forehead hairline-ish to brow, as % of total face height
    middle: number; // brow to nose base
    lower: number; // nose base to chin
    mostEven: boolean;
  };
  eyes: {
    interocularRatio: number; // eye-gap / eye-width, ~1.0 is the classic "one eye apart" ideal
    leftCanthalTiltDeg: number;
    rightCanthalTiltDeg: number;
  };
  jaw: {
    jawWidthToFaceWidthRatio: number;
    jawAngleDeg: number;
  };
  proportions: {
    faceWidthToHeightRatio: number;
    goldenRatioDeviationPct: number; // deviation from classic 1.618 width:height-derived ratio
  };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDeg(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

// MediaPipe Face Landmarker (468/478-point mesh) indices used below.
const IDX = {
  foreheadTop: 10,
  chin: 152,
  noseBridge: 168,
  noseBase: 2,
  leftFaceEdge: 454,
  rightFaceEdge: 234,
  leftJaw: 379,
  rightJaw: 150,
  leftEyeOuter: 263,
  leftEyeInner: 362,
  rightEyeOuter: 33,
  rightEyeInner: 133,
  browLeft: 105,
  browRight: 334,
  mouthLeft: 61,
  mouthRight: 291,
};

// A symmetric set of point-index pairs straddling the vertical midline,
// used to score overall facial symmetry by comparing mirrored distances from the midline.
const SYMMETRY_PAIRS: [number, number][] = [
  [33, 263], // eye outer corners
  [133, 362], // eye inner corners
  [105, 334], // brow
  [61, 291], // mouth corners
  [234, 454], // face edges
  [150, 379], // jaw
  [129, 358], // nose sides
];

export function computeFaceMetrics(landmarks: Point[]): FaceMetrics {
  const top = landmarks[IDX.foreheadTop];
  const chin = landmarks[IDX.chin];
  const noseBase = landmarks[IDX.noseBase];
  const leftEdge = landmarks[IDX.leftFaceEdge];
  const rightEdge = landmarks[IDX.rightFaceEdge];
  const leftJaw = landmarks[IDX.leftJaw];
  const rightJaw = landmarks[IDX.rightJaw];

  // Midline = vertical line through forehead-top and chin (x varies linearly with y).
  const midX = (y: number) => {
    const t = (y - top.y) / (chin.y - top.y || 1);
    return top.x + (chin.x - top.x) * t;
  };

  // --- Symmetry ---
  const deviations: number[] = [];
  for (const [li, ri] of SYMMETRY_PAIRS) {
    const l = landmarks[li];
    const r = landmarks[ri];
    if (!l || !r) continue;
    const lMid = midX(l.y);
    const rMid = midX(r.y);
    const lDist = Math.abs(l.x - lMid);
    const rDist = Math.abs(r.x - rMid);
    const avg = (lDist + rDist) / 2 || 1;
    deviations.push(Math.abs(lDist - rDist) / avg);
  }
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / (deviations.length || 1);
  const symmetryScore = Math.max(0, Math.min(100, 100 - avgDeviation * 100));
  const symmetryNote =
    symmetryScore >= 90
      ? "Very even left/right proportions — deviation is within normal measurement noise."
      : symmetryScore >= 75
      ? "Minor left/right differences, well within the normal range — true facial asymmetry is universal."
      : "Noticeable left/right differences in feature placement. Everyone has some asymmetry; this is just where yours shows up.";

  // --- Facial thirds ---
  const faceHeight = chin.y - top.y || 1;
  const browY = (landmarks[IDX.browLeft].y + landmarks[IDX.browRight].y) / 2;
  const upper = (browY - top.y) / faceHeight;
  const middle = (noseBase.y - browY) / faceHeight;
  const lower = (chin.y - noseBase.y) / faceHeight;
  const thirds = [upper, middle, lower];
  const idealThird = 1 / 3;
  const mostEven = Math.max(...thirds.map((t) => Math.abs(t - idealThird))) < 0.05;

  // --- Eyes ---
  const leftEyeOuter = landmarks[IDX.leftEyeOuter];
  const leftEyeInner = landmarks[IDX.leftEyeInner];
  const rightEyeOuter = landmarks[IDX.rightEyeOuter];
  const rightEyeInner = landmarks[IDX.rightEyeInner];
  const leftEyeWidth = dist(leftEyeOuter, leftEyeInner);
  const rightEyeWidth = dist(rightEyeOuter, rightEyeInner);
  const interocularGap = dist(leftEyeInner, rightEyeInner);
  const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2 || 1;
  const interocularRatio = interocularGap / avgEyeWidth;
  const leftCanthalTiltDeg = -angleDeg(leftEyeInner, leftEyeOuter);
  const rightCanthalTiltDeg = angleDeg(rightEyeInner, rightEyeOuter);

  // --- Jaw ---
  const jawWidth = dist(leftJaw, rightJaw);
  const faceWidth = dist(leftEdge, rightEdge) || 1;
  const jawWidthToFaceWidthRatio = jawWidth / faceWidth;
  const jawAngleDeg = Math.abs(angleDeg(leftJaw, chin)) ;

  // --- Overall proportions ---
  const faceWidthToHeightRatio = faceWidth / faceHeight;
  // Classic neoclassical ideal face width:height ≈ 1:1.618 (golden ratio), expressed as height/width here.
  const idealRatio = 1.618;
  const actualRatio = faceHeight / faceWidth;
  const goldenRatioDeviationPct = (Math.abs(actualRatio - idealRatio) / idealRatio) * 100;

  return {
    symmetryScore: Math.round(symmetryScore * 10) / 10,
    symmetryNote,
    facialThirds: {
      upper: Math.round(upper * 1000) / 10,
      middle: Math.round(middle * 1000) / 10,
      lower: Math.round(lower * 1000) / 10,
      mostEven,
    },
    eyes: {
      interocularRatio: Math.round(interocularRatio * 100) / 100,
      leftCanthalTiltDeg: Math.round(leftCanthalTiltDeg * 10) / 10,
      rightCanthalTiltDeg: Math.round(rightCanthalTiltDeg * 10) / 10,
    },
    jaw: {
      jawWidthToFaceWidthRatio: Math.round(jawWidthToFaceWidthRatio * 100) / 100,
      jawAngleDeg: Math.round(jawAngleDeg * 10) / 10,
    },
    proportions: {
      faceWidthToHeightRatio: Math.round(faceWidthToHeightRatio * 100) / 100,
      goldenRatioDeviationPct: Math.round(goldenRatioDeviationPct * 10) / 10,
    },
  };
}
