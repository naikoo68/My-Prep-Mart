import { useMemo, useState } from "react";
import {
  FileText, Download, Loader2, Plus, Trash2, Copy, ArrowUp, ArrowDown,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from "lucide-react";
import { useSettings } from "../../context/SettingsContext";
import { buildDocPdf, DOC_FONTS, DOC_BLOCK_TYPES } from "../../lib/pdfDoc";

let _id = 1;
const uid = () => `b${_id++}_${Date.now().toString(36)}`;

const defaultsFor = (typeId) => {
  const t = DOC_BLOCK_TYPES.find((x) => x.id === typeId) || DOC_BLOCK_TYPES[2];
  return {
    id: uid(),
    type: t.id,
    text: t.hasText ? "" : "",
    fontSize: t.size,
    bold: !!t.bold,
    italic: false,
    underline: false,
    align: "left",
    color: t.id === "heading" || t.id === "subheading" ? "#1e293b" : "#0f172a",
  };
};

const PX = (pt) => `${(Number(pt) || 11) * 1.3333}px`; // pt → screen px

// A blank-canvas VECTOR PDF builder: add heading / paragraph / bullet / divider
// blocks, format them, preview on an A4 sheet, and download a crisp, selectable
// PDF (opens perfectly in Adobe Reader).
export default function AdminPdfBuilder() {
  const { settings } = useSettings();
  const [title, setTitle] = useState("Untitled document");
  const [fontFamily, setFontFamily] = useState("helvetica");
  const [margin, setMargin] = useState(20);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [useWatermark, setUseWatermark] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [blocks, setBlocks] = useState(() => [
    { ...defaultsFor("heading"), text: "Document title" },
    { ...defaultsFor("paragraph"), text: "Start writing here. Use the buttons on the left to add headings, paragraphs, bullet lists, dividers, spacers and page breaks — then download a crisp, selectable PDF." },
  ]);

  const wmText = (settings?.watermarkText || "").trim() || `${settings?.siteName || "My Study Guide"}`;
  const brand = (settings?.siteName || "").trim();
  const fontCss = (DOC_FONTS.find((f) => f.id === fontFamily) || DOC_FONTS[0]).css;

  const addBlock = (typeId) => setBlocks((b) => [...b, defaultsFor(typeId)]);
  const patch = (id, kv) => setBlocks((b) => b.map((x) => (x.id === id ? { ...x, ...kv } : x)));
  const remove = (id) => setBlocks((b) => b.filter((x) => x.id !== id));
  const duplicate = (id) => setBlocks((b) => {
    const i = b.findIndex((x) => x.id === id);
    if (i < 0) return b;
    const copy = { ...b[i], id: uid() };
    return [...b.slice(0, i + 1), copy, ...b.slice(i + 1)];
  });
  const move = (id, dir) => setBlocks((b) => {
    const i = b.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= b.length) return b;
    const next = [...b];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const download = async () => {
    setBusy(true);
    setErr("");
    try {
      const ok = await buildDocPdf(blocks, {
        title,
        fontFamily,
        margin: Number(margin) || 20,
        pageNumbers,
        watermark: useWatermark ? wmText : "",
        brand,
      });
      if (!ok) setErr("Couldn't generate the PDF. Please try again.");
    } catch (e) {
      setErr(e?.message || "Couldn't generate the PDF.");
    } finally {
      setBusy(false);
    }
  };

  // On-screen A4 sheet preview (mirrors the vector layout; the PDF is the source
  // of truth for exact pagination).
  const previewPadPx = useMemo(() => `${(Number(margin) || 20) * 3.7795}px`, [margin]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><FileText className="h-6 w-6 text-brand-600" /> PDF Builder</h1>
          <p className="text-sm text-slate-500">Build a document block by block and download a crisp, selectable PDF (opens perfectly in Adobe Reader).</p>
        </div>
        <button onClick={download} disabled={busy} className="btn-primary">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Download className="h-4 w-4" /> Download PDF</>}
        </button>
      </div>

      {err && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">{err}</p>}

      {/* Document settings */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Title / file name</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input !py-1.5 !text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Font</span>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="input !py-1.5 !text-sm">
              {DOC_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Page margin: {margin} mm</span>
            <input type="range" min={10} max={35} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full" />
          </label>
          <div className="flex items-end gap-4 text-sm">
            <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)} /> Page numbers</label>
            <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={useWatermark} onChange={(e) => setUseWatermark(e.target.checked)} /> Watermark</label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Editor */}
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {DOC_BLOCK_TYPES.map((t) => (
              <button key={t.id} type="button" onClick={() => addBlock(t.id)} className="btn-outline !py-1 !text-xs">
                <Plus className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {blocks.map((b, i) => (
              <BlockEditor
                key={b.id}
                b={b}
                first={i === 0}
                last={i === blocks.length - 1}
                onPatch={(kv) => patch(b.id, kv)}
                onRemove={() => remove(b.id)}
                onDup={() => duplicate(b.id)}
                onMove={(d) => move(b.id, d)}
              />
            ))}
            {!blocks.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">Add a block to begin.</p>}
          </div>
        </div>

        {/* Live A4 preview */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Preview (A4)</p>
          <div className="max-h-[75vh] overflow-auto rounded-xl bg-slate-200 p-4 dark:bg-slate-800">
            <div
              className="mx-auto bg-white text-slate-900 shadow-lg"
              style={{ width: "794px", minHeight: "1123px", padding: previewPadPx, fontFamily: fontCss }}
            >
              {blocks.map((b) => <PreviewBlock key={b.id} b={b} fontCss={fontCss} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlignBtn({ active, onClick, children, title }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`rounded p-1.5 ${active ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{children}</button>
  );
}

function BlockEditor({ b, first, last, onPatch, onRemove, onDup, onMove }) {
  const meta = DOC_BLOCK_TYPES.find((t) => t.id === b.type);
  const hasText = !!meta?.hasText;
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center gap-1">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800">{meta?.label || b.type}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" title="Move up" disabled={first} onClick={() => onMove(-1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" title="Move down" disabled={last} onClick={() => onMove(1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" title="Duplicate" onClick={onDup} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Copy className="h-4 w-4" /></button>
          <button type="button" title="Delete" onClick={onRemove} className="rounded p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {hasText && (
        <textarea
          value={b.text}
          onChange={(e) => onPatch({ text: e.target.value })}
          rows={b.type === "paragraph" || b.type === "bullets" ? 3 : 1}
          placeholder={b.type === "bullets" ? "One item per line" : "Text…"}
          className="input mb-2 w-full !py-1.5 !text-sm"
        />
      )}

      {(hasText || b.type === "divider" || b.type === "spacer") && (
        <div className="flex flex-wrap items-center gap-2">
          {hasText && (
            <>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                Size
                <input type="number" min={6} max={72} value={b.fontSize} onChange={(e) => onPatch({ fontSize: Number(e.target.value) })} className="w-14 rounded border border-slate-300 px-1.5 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" />
              </label>
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                <button type="button" title="Bold" onClick={() => onPatch({ bold: !b.bold })} className={`rounded p-1.5 ${b.bold ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}><Bold className="h-4 w-4" /></button>
                <button type="button" title="Italic" onClick={() => onPatch({ italic: !b.italic })} className={`rounded p-1.5 ${b.italic ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}><Italic className="h-4 w-4" /></button>
                <button type="button" title="Underline" onClick={() => onPatch({ underline: !b.underline })} className={`rounded p-1.5 ${b.underline ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}><Underline className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                <AlignBtn title="Left" active={b.align === "left"} onClick={() => onPatch({ align: "left" })}><AlignLeft className="h-4 w-4" /></AlignBtn>
                <AlignBtn title="Center" active={b.align === "center"} onClick={() => onPatch({ align: "center" })}><AlignCenter className="h-4 w-4" /></AlignBtn>
                <AlignBtn title="Right" active={b.align === "right"} onClick={() => onPatch({ align: "right" })}><AlignRight className="h-4 w-4" /></AlignBtn>
                <AlignBtn title="Justify" active={b.align === "justify"} onClick={() => onPatch({ align: "justify" })}><AlignJustify className="h-4 w-4" /></AlignBtn>
              </div>
            </>
          )}
          <label className="flex items-center gap-1 text-xs text-slate-500" title="Colour">
            Colour
            <input type="color" value={b.color || "#0f172a"} onChange={(e) => onPatch({ color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-slate-300 dark:border-slate-600" />
          </label>
        </div>
      )}
    </div>
  );
}

function PreviewBlock({ b, fontCss }) {
  if (b.type === "pagebreak") {
    return <div className="my-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-300" />Page break<span className="h-px flex-1 bg-slate-300" /></div>;
  }
  if (b.type === "spacer") return <div style={{ height: PX((Number(b.fontSize) || 11) * 1.2) }} />;
  if (b.type === "divider") return <hr style={{ border: "none", borderTop: `1px solid ${b.color || "#94a3b8"}`, margin: "8px 0" }} />;

  const style = {
    fontFamily: fontCss,
    fontSize: PX(b.fontSize),
    fontWeight: b.bold ? 700 : 400,
    fontStyle: b.italic ? "italic" : "normal",
    textDecoration: b.underline ? "underline" : "none",
    textAlign: b.align || "left",
    color: b.color || "#0f172a",
    margin: b.type === "paragraph" ? "0 0 8px" : "0 0 6px",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  };

  if (b.type === "bullets") {
    const items = String(b.text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    return <ul style={{ ...style, paddingLeft: "20px", listStyle: "disc" }}>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
  }
  return <div style={style}>{b.text || <span style={{ color: "#cbd5e1" }}>Empty {b.type}</span>}</div>;
}
