// Chemistry and physiology notes read better as clean typography than as
// LaTeX. This turns the LaTeX models like to emit into plain HTML with real
// superscripts, subscripts and symbols — no math engine required.

const SYMBOLS: Array<[RegExp, string]> = [
  [/\\times/g, "×"], [/\\cdot/g, "·"], [/\\div/g, "÷"],
  [/\\pm/g, "±"], [/\\mp/g, "∓"],
  [/\\leq|\\le\b/g, "≤"], [/\\geq|\\ge\b/g, "≥"], [/\\neq|\\ne\b/g, "≠"],
  [/\\approx/g, "≈"], [/\\propto/g, "∝"], [/\\infty/g, "∞"],
  [/\\leftrightarrow|\\rightleftharpoons|\\iff/g, "⇌"],
  [/\\rightarrow|\\to\b|\\Rightarrow/g, "→"],
  [/\\leftarrow|\\Leftarrow/g, "←"],
  [/\\uparrow/g, "↑"], [/\\downarrow/g, "↓"],
  [/\\Delta/g, "Δ"], [/\\delta/g, "δ"], [/\\alpha/g, "α"], [/\\beta/g, "β"],
  [/\\gamma/g, "γ"], [/\\lambda/g, "λ"], [/\\mu/g, "μ"], [/\\pi/g, "π"],
  [/\\sigma/g, "σ"], [/\\theta/g, "θ"], [/\\omega/g, "ω"], [/\\phi/g, "φ"],
  [/\\degree|\\circ/g, "°"], [/\\percent/g, "%"],
  [/\\ldots|\\dots/g, "…"],
  [/\\quad|\\qquad|\\,|\\;|\\!/g, " "],
  [/\\left|\\right/g, ""],
];

/** Convert a LaTeX fragment to readable HTML. */
function latexToHtml(src: string): string {
  let s = src;

  // \text{...}, \mathrm{...}, \ce{...} → their contents
  s = s.replace(/\\(?:text|mathrm|mathit|textrm|ce|mathbf)\{([^{}]*)\}/g, "$1");
  // \frac{a}{b} → a/b  (parenthesised when either side is compound)
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a, b) => {
    const wrap = (x: string) => (/[\s+\-]/.test(x.trim()) ? `(${x})` : x);
    return `${wrap(a)}/${wrap(b)}`;
  });
  // \sqrt{x} → √x
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, "√$1");
  // log/ln/sin etc lose their backslash
  s = s.replace(/\\(log|ln|sin|cos|tan|exp|max|min|sum|int)\b/g, "$1");

  for (const [re, ch] of SYMBOLS) s = s.replace(re, ch);

  // Superscripts and subscripts → real tags
  s = s.replace(/\^\{([^{}]*)\}/g, "<sup>$1</sup>");
  s = s.replace(/\^(-?[\w+−-])/g, "<sup>$1</sup>");
  s = s.replace(/_\{([^{}]*)\}/g, "<sub>$1</sub>");
  s = s.replace(/_(\w)/g, "<sub>$1</sub>");

  // Leftover braces and stray backslashes
  s = s.replace(/[{}]/g, "").replace(/\\\\/g, " ").replace(/\\([a-zA-Z]+)/g, "$1");

  return s.trim();
}

/**
 * Replace LaTeX delimiters in a line of already-escaped markdown text.
 * `$$…$$` becomes a centred equation block; `$…$` becomes inline math.
 * Returns HTML.
 */
export function renderMath(escaped: string): string {
  let s = escaped;

  // Display math — whole-line equations
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, body) =>
    `<span class="eq-block">${latexToHtml(body)}</span>`);

  // Inline math
  s = s.replace(/\$([^$\n]+?)\$/g, (_m, body) =>
    `<span class="eq-inline">${latexToHtml(body)}</span>`);

  // Bare chemistry notation that never had delimiters: H+ / OH- / Kw / 10^-14
  s = s.replace(/\[([A-Za-z]{1,3})\^?([+-])\]/g, "[$1<sup>$2</sup>]");
  s = s.replace(/\b(\d+)\^\{?(-?\d+)\}?/g, "$1<sup>$2</sup>");

  return s;
}

/** Shared CSS for the equation spans. */
export const MATH_CSS = `
  .eq-block { display:block; margin:.85rem 0; padding:.7rem 1rem; border-radius:10px;
              background:rgba(124,92,252,.07); border-left:3px solid var(--purple,#7C5CFC);
              font-size:1.05rem; letter-spacing:.01em; text-align:center; }
  .eq-inline { padding:0 .15rem; font-weight:600; }
  .eq-block sup, .eq-inline sup { font-size:.7em; vertical-align:super; line-height:0; }
  .eq-block sub, .eq-inline sub { font-size:.7em; vertical-align:sub; line-height:0; }
`;
