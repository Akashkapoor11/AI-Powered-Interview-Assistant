import * as pdfjs from "pdfjs-dist";
// USE LOCAL PDF WORKER (from public/pdf.worker.min.js)
(pdfjs as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

// @ts-ignore
import mammoth from "mammoth";
import { createWorker, PSM } from "tesseract.js";

/* -------------------- Tesseract worker (singleton) -------------------- */

let _workerPromise: Promise<ReturnType<typeof createWorker>> | null = null;

async function getWorker() {
  if (!_workerPromise) {
    _workerPromise = (async () => {
      const worker = await createWorker({
        // Use local assets from /public/tesseract
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/tesseract-core.wasm",
        langPath: "/tesseract",
      });
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      return worker;
    })();
  }
  return _workerPromise!;
}

/* --------------------------- Public functions ------------------------- */

export async function extractTextFromPdf(
  file: File,
  onOcrProgress?: (pct: number, label?: string) => void
): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await (pdfjs as any).getDocument({ data: buf }).promise;

    // 1) Try selectable text
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = (content.items as any[]).map((it: any) => it.str);
      text += strings.join(" ") + "\n";
    }
    if (text.trim()) return normalize(text);

    // 2) OCR fallback
    return await ocrPdfBuffer(buf, pdf.numPages, onOcrProgress);
  } catch (e) {
    console.error("PDF parse error:", e);
    return "";
  }
}

export async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return normalize(value);
  } catch (e) {
    console.error("DOCX parse error:", e);
    return "";
  }
}

export async function extractTextFromImage(
  file: File,
  onOcrProgress?: (pct: number, label?: string) => void
): Promise<string> {
  try {
    const img = await fileToImage(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const scale = Math.max(1, 1600 / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    preprocessCanvas(ctx, canvas.width, canvas.height);

    const worker = await getWorker();
    const result = await worker.recognize(canvas, {
      logger: (m: any) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          onOcrProgress?.(
            Math.min(99, Math.floor(m.progress * 100)),
            "OCR image"
          );
        }
      },
    } as any);

    onOcrProgress?.(100, "OCR complete");
    return normalize(result.data.text || "");
  } catch (e) {
    console.error("IMAGE OCR error:", e);
    return "";
  }
}

/* ------------------------- Improved field extraction ------------------ */

export function extractFields(text: string) {
  // Normalize lines once for name detection
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\u00A0/g, " ").trim())
    .filter(Boolean);

  /* --- Email --- */
  const email =
    (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || undefined;

  /* --- Phone (handles +91, leading 0, mixed separators) --- */
  const phoneCandidates =
    text.match(
      /(\+?\s?91[\s\-]?)?(0?\s*)?\(?\d{2,5}\)?[\s.\-]?\d{3,5}[\s.\-]?\d{3,5}/gi
    ) || [];
  const phone =
    phoneCandidates
      .map((p) =>
        p
          .replace(/[^\d+]/g, "")
          .replace(/^00/, "+")
          .replace(/^(\+?91)0+/, "$1")
      )
      .filter((p) =>
        p.startsWith("+")
          ? p.length >= 12 && p.length <= 14
          : p.length >= 10 && p.length <= 12
      )
      .sort((a, b) => b.length - a.length)[0] || undefined;

  /* --- Name --- */
  const blacklist =
    /(curriculum|resume|résumé|cv|objective|summary|profile|education|experience|projects|skills|phone|email|contact)/i;

  // 1) Explicit "Name: ..." line
  const explicit = lines.find((l) => /^name\s*[:\-]/i.test(l));

  // 2) Heuristic: first 1–6 lines that look like a person name
  const likelyLine =
    explicit ||
    lines.slice(0, 6).find((l) => {
      if (blacklist.test(l)) return false;
      const clean = l.replace(/[^A-Za-z.'\-\s]/g, " ").replace(/\s+/g, " ").trim();
      if (!clean) return false;
      const parts = clean.split(/\s+/);
      // at least two words, not crazy long
      return parts.length >= 2 && parts.length <= 5;
    });

  // 3) Build final name from the chosen line
  let name =
    (likelyLine || "")
      .replace(/^name\s*[:\-]/i, "")
      .replace(/[^A-Za-z.'\-\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || undefined;

  if (name) {
    // Title-case & de-duplicate consecutive tokens (OCR sometimes repeats)
    const tokens = name.split(" ");
    const dedup: string[] = [];
    for (const t of tokens) {
      const tc = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      if (dedup[dedup.length - 1] !== tc) dedup.push(tc);
    }
    name = dedup.slice(0, 4).join(" ");
  }

  // 4) Fallback: derive from email username if still no name
  if (!name && email) {
    name = usernameToHumanName(email.split("@")[0]);
  }

  return { name, email, phone };
}

/* ------------------------------ Internals ----------------------------- */

function usernameToHumanName(usernameRaw: string): string | undefined {
  if (!usernameRaw) return undefined;

  // Remove digits, normalize separators, split camelCase
  let u = usernameRaw
    .replace(/\d+/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!u) return undefined;

  // If we still have a single glued token (e.g., "akashkapoor"), try surname suffix split
  if (!/\s/.test(u) && u.length >= 8) {
    const lower = u.toLowerCase();
    const surnames = [
      "kapoor","kumar","kannan","singh","sharma","gupta","verma","yadav","khan",
      "das","nair","reddy","rao","mehta","agarwal","agrawal","banerjee","bose",
      "bhattacharya","iyer","iyengar","mishra","joshi","pandey","tiwari",
      "choudhary","chowdhury","saxena","garg","jain","patel","roy","paul","saha",
      "sen","ghosh","gopal","raj","gowda","shetty"
    ];
    for (const s of surnames) {
      const idx = lower.lastIndexOf(s);
      if (idx > 0 && idx + s.length === lower.length) {
        const first = u.slice(0, idx);
        const last = u.slice(idx);
        u = `${first} ${last}`;
        break;
      }
    }
    // If still one token, do a balanced 2-word split on vowel boundary
    if (!/\s/.test(u)) {
      const mid = Math.floor(u.length / 2);
      const candidates = [mid - 1, mid, mid + 1].filter(
        (i) => i > 1 && i < u.length - 1
      );
      let splitAt = candidates[0];
      for (const i of candidates) {
        if (/[aeiou]/i.test(u[i]) && /[bcdfghjklmnpqrstvwxyz]/i.test(u[i + 1])) {
          splitAt = i + 1;
          break;
        }
      }
      u = `${u.slice(0, splitAt)} ${u.slice(splitAt)}`;
    }
  }

  return u
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normalize(s: string) {
  return s
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

async function ocrPdfBuffer(
  buf: ArrayBuffer,
  pageCount: number,
  onOcrProgress?: (pct: number, label?: string) => void
): Promise<string> {
  const pdf = await (pdfjs as any).getDocument({ data: buf }).promise;
  const worker = await getWorker();

  let fullText = "";
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    preprocessCanvas(ctx, canvas.width, canvas.height);

    const base = ((i - 1) / pageCount) * 100;
    const span = 100 / pageCount;

    const result = await worker.recognize(canvas, {
      logger: (m: any) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          const pct = base + m.progress * span;
          onOcrProgress?.(
            Math.min(99, Math.floor(pct)),
            `OCR page ${i}/${pageCount}`
          );
        }
      },
    } as any);

    fullText += (result.data.text || "") + "\n";
    onOcrProgress?.(
      Math.min(99, Math.floor(base + span)),
      `OCR page ${i}/${pageCount} done`
    );
  }
  onOcrProgress?.(100, "OCR complete");
  return normalize(fullText);
}

function preprocessCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  factor = 0.85
) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    sum += lum;
  }
  const avg = sum / (d.length / 4);
  const th = avg * factor;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum > th ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = reader.result as string;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
