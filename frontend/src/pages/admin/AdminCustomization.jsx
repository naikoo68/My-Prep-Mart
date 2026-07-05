import { useState } from "react";
import { Palette, Type, ImagePlus, Save, RotateCcw, CheckCircle2, Eye } from "lucide-react";
import { useSettings } from "../../context/SettingsContext";
import { FONT_OPTIONS } from "../../lib/theme";

const PRIMARY_PRESETS = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#db2777", "#e11d48"];
const ACCENT_PRESETS = ["#f97316", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ef4444"];
const DEFAULTS = { siteName: "My Study Guide", tagline: "Prepare Smart, Achieve More.", logoUrl: "", primaryColor: "#2563eb", accentColor: "#f97316", fontFamily: "Inter" };

export default function AdminCustomization() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState({ ...DEFAULTS, ...settings });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await save(form);
      flash("Saved! Your changes are now live across the site.");
    } catch (err) {
      setError(err.message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    setForm(DEFAULTS);
    setSaving(true);
    try {
      await save(DEFAULTS);
      flash("Reset to default theme.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const Swatch = ({ value, onPick, presets }) => (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((c) => (
        <button
          type="button"
          key={c}
          onClick={() => onPick(c)}
          style={{ background: c }}
          className={`h-9 w-9 rounded-lg ring-offset-2 transition dark:ring-offset-slate-900 ${value === c ? "ring-2 ring-slate-900 dark:ring-white" : ""}`}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700" />
      <span className="text-xs font-mono text-slate-500">{value}</span>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Customization</h1>
          <p className="text-slate-500 dark:text-slate-400">Change the site name, logo, colours and font. Changes apply everywhere instantly.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={resetDefaults} className="btn-outline">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branding */}
        <div className="card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold"><ImagePlus className="h-5 w-5 text-brand-600" /> Branding</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Website Name</label>
              <input className="input" value={form.siteName} onChange={(e) => set("siteName", e.target.value)} placeholder="My Study Guide" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Tagline</label>
              <input className="input" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Prepare Smart, Achieve More." />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Logo URL (optional)</label>
              <input className="input" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://.../logo.png" />
              <p className="mt-1 text-xs text-slate-400">Leave blank to use the default graduation-cap icon.</p>
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold"><Type className="h-5 w-5 text-violet-500" /> Font</h3>
          <label className="mb-1.5 block text-sm font-medium">Font Family</label>
          <select className="input" value={form.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}>
            {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-lg dark:bg-slate-800/60" style={{ fontFamily: `'${form.fontFamily}', sans-serif` }}>
            The quick brown fox jumps over the lazy dog. 1234567890
          </p>
        </div>

        {/* Colours */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-bold"><Palette className="h-5 w-5 text-accent-500" /> Theme Colours</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Primary colour</label>
              <Swatch value={form.primaryColor} onPick={(c) => set("primaryColor", c)} presets={PRIMARY_PRESETS} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Accent colour</label>
              <Swatch value={form.accentColor} onPick={(c) => set("accentColor", c)} presets={ACCENT_PRESETS} />
            </div>
          </div>

          {/* Live preview */}
          <div className="mt-6 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500"><Eye className="h-4 w-4" /> Live preview</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})` }}>{(form.siteName || "M")[0]}</span>
              <span className="text-lg font-extrabold">{form.siteName || "My Study Guide"}</span>
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: form.primaryColor }}>Primary button</button>
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: form.accentColor }}>Accent button</button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Save to apply these across the entire site (buttons, links, highlights, logo).</p>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-slate-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {toast}
        </div>
      )}
    </form>
  );
}
