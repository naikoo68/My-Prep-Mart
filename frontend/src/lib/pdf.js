// On-demand PDF text extraction in the browser.
//
// pdf.js is loaded from a CDN the first time a PDF is uploaded, so it never
// enters the app bundle and needs no build-time dependency (npm install here is
// blocked, and a lockfile mismatch would break `npm ci` in CI). The jsdelivr
// "@4" major range guarantees the library and its worker resolve to the same
// existing version.
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build";

let libPromise = null;
function loadPdfjs() {
  if (!libPromise) {
    // @vite-ignore keeps Vite from trying to bundle/resolve the CDN URL — it
    // stays a native runtime dynamic import in the browser.
    libPromise = import(/* @vite-ignore */ `${PDFJS}/pdf.min.mjs`).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return libPromise;
}

// Rebuild readable, line-broken text from pdf.js text items. pdf.js returns
// small text fragments with position info; joining them all with spaces (the
// old behaviour) destroyed line breaks, so numbered questions ("1.", "2.") no
// longer started a line and the question detector/splitter couldn't find them.
// Here we start a new line when pdf.js flags an end-of-line (hasEOL) or when the
// vertical position (transform[5]) jumps between fragments.
function itemsToText(items) {
  const lines = [];
  let cur = "";
  let lastY = null;
  for (const it of items) {
    if (!it || typeof it.str !== "string") continue;
    const y = Array.isArray(it.transform) ? it.transform[5] : null;
    const yJumped = lastY !== null && y !== null && Math.abs(y - lastY) > 2;
    if (yJumped) { lines.push(cur); cur = it.str; }
    else { cur += it.str; }
    if (it.hasEOL) { lines.push(cur); cur = ""; lastY = null; }
    else if (y !== null) lastY = y;
  }
  if (cur) lines.push(cur);
  return lines
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// Extract plain text from a PDF File/Blob. onProgress(page, totalPages) fires
// once per page so the caller can show progress. Returns the combined text
// (empty string for image-only / scanned PDFs that have no selectable text).
export async function extractPdfText(file, onProgress) {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await lib.getDocument({ data }).promise;
  const pages = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(itemsToText(content.items));
      onProgress?.(i, pdf.numPages);
    }
  } finally {
    try { await pdf.cleanup(); } catch { /* ignore */ }
  }
  return pages
    .join("\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
