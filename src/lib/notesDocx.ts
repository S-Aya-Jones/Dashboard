import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from "docx";

// Markdown → a real .docx with Word's own heading styles, so the file opens
// cleanly, keeps its navigation pane, and prints properly.

const PURPLE = "5B3FD4";
const GREY = "6B7280";
const RULE = "E5E7EB";
const TINT = "F6F4FF";

/** Split a line into runs, honouring **bold**, *italic* and `code`. */
function runs(text: string, base: { size?: number; color?: string } = {}): TextRun[] {
  const out: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (t: string, opts: Record<string, unknown> = {}) => {
    if (t) out.push(new TextRun({ text: t, ...base, ...opts }));
  };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) push(tok.slice(2, -2), { bold: true });
    else if (tok.startsWith("`")) push(tok.slice(1, -1), { font: "Consolas" });
    else push(tok.slice(1, -1), { italics: true });
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return out.length ? out : [new TextRun({ text: "", ...base })];
}

function cleanInline(s: string): string {
  return s
    .replace(/\[EMPHASIZED\]/g, "  ← emphasized in lecture")
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/\\(?:text|mathrm|ce|mathbf)\{([^{}]*)\}/g, "$1")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\(?:log|ln)\b/g, (x) => x.slice(1))
    .replace(/\\rightarrow|\\to\b/g, "→")
    .replace(/\\times/g, "×").replace(/\\pm/g, "±")
    .replace(/\\leq/g, "≤").replace(/\\geq/g, "≥").replace(/\\approx/g, "≈")
    .replace(/\\Delta/g, "Δ").replace(/\\alpha/g, "α").replace(/\\beta/g, "β")
    .replace(/\^\{?([^\s{}]+)\}?/g, "^$1")
    .replace(/[{}]/g, "")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .trim();
}

function tableFrom(header: string[], rows: string[][]): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map(h => new TableCell({
          borders,
          shading: { type: ShadingType.CLEAR, fill: TINT },
          children: [new Paragraph({ children: runs(cleanInline(h), { size: 20 }).map(r => r), spacing: { before: 60, after: 60 } })],
        })),
      }),
      ...rows.map(r => new TableRow({
        children: r.map(c => new TableCell({
          borders,
          children: [new Paragraph({ children: runs(cleanInline(c), { size: 20 }), spacing: { before: 60, after: 60 } })],
        })),
      })),
    ],
  });
}

export async function notesToDocx(notes: {
  title: string; course: string; summary: string; outline: string; createdAt: string;
}): Promise<Buffer> {
  const date = new Date(notes.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: notes.course.toUpperCase(), bold: true, size: 18, color: PURPLE })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: notes.title, bold: true, size: 40 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Lecture notes · ${date}`, size: 20, color: GREY })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: PURPLE, space: 8 } },
      spacing: { after: 200 },
    }),
  ];

  if (notes.summary) {
    children.push(new Paragraph({
      children: runs(cleanInline(notes.summary), { size: 22 }),
      spacing: { after: 260 },
    }));
  }

  const lines = notes.outline.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // table
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const header = line.split("|").slice(1, -1).map(c => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map(c => c.trim())); i++;
      }
      children.push(tableFrom(header, rows));
      children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);

    if (h2 || h1) {
      children.push(new Paragraph({
        children: runs(cleanInline((h2 ?? h1)![1]), { size: 28 }).map(r => r),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
      }));
    } else if (h3) {
      children.push(new Paragraph({
        children: runs(cleanInline(h3[1]), { size: 24, color: PURPLE }),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 90 },
      }));
    } else if (quote) {
      children.push(new Paragraph({
        children: runs(cleanInline(quote[1]), { size: 21 }),
        shading: { type: ShadingType.CLEAR, fill: TINT },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: PURPLE, space: 10 } },
        indent: { left: 240 },
        spacing: { before: 120, after: 140 },
      }));
    } else if (bullet) {
      children.push(new Paragraph({
        children: runs(cleanInline(bullet[2]), { size: 22 }),
        bullet: { level: bullet[1].length >= 2 ? 1 : 0 },
        spacing: { after: 70 },
      }));
    } else if (numbered) {
      children.push(new Paragraph({
        children: runs(cleanInline(numbered[1]), { size: 22 }),
        bullet: { level: 0 },
        spacing: { after: 70 },
      }));
    } else if (line.trim() === "") {
      // paragraph break — spacing already handled
    } else {
      children.push(new Paragraph({
        children: runs(cleanInline(line), { size: 22 }),
        spacing: { after: 110 },
        alignment: AlignmentType.LEFT,
      }));
    }
    i++;
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 300 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
