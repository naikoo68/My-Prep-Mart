import { useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";

// Deters copying/screenshotting of site content for students (and guests):
//  - restrictCopy   : disables selection, right-click, copy/cut, drag, iOS callout
//  - screenshotGuard: covers the whole screen when the window loses focus / is
//                     hidden / a screenshot shortcut is pressed. The cover is
//                     toggled DIRECTLY on the DOM node (not via React state), so
//                     it appears instantly with no render lag. `guardHoldMs`
//                     controls how long it stays after a screenshot key.
// Admins are never restricted.
export default function ContentProtection() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const isAdmin = user?.role === "admin";
  const copyActive = settings?.restrictCopy !== false && !isAdmin;
  const guardActive = settings?.screenshotGuard === true && !isAdmin;
  const holdMs = Math.min(8000, Math.max(100, Number(settings?.guardHoldMs) || 1500));
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!copyActive) return;
    const block = (e) => {
      const t = e.target;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      return false;
    };
    const events = ["copy", "cut", "contextmenu", "selectstart", "dragstart"];
    events.forEach((ev) => document.addEventListener(ev, block));
    document.body.classList.add("no-select");
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, block));
      document.body.classList.remove("no-select");
    };
  }, [copyActive]);

  useEffect(() => {
    if (!guardActive) return;
    const el = overlayRef.current;
    if (!el) return;
    let timer;
    const show = () => { el.style.display = "flex"; }; // instant — direct DOM, no React re-render
    const hide = () => { el.style.display = "none"; };
    const flash = () => {
      show();
      clearTimeout(timer);
      timer = setTimeout(() => { if (document.hasFocus()) hide(); }, holdMs);
    };
    const onBlur = () => show();
    const onFocus = () => hide();
    const onVis = () => (document.hidden ? show() : hide());
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      const combo = (e.metaKey || e.ctrlKey) && e.shiftKey && ["s", "3", "4", "5"].includes(k);
      if (k === "printscreen" || combo) flash();
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [guardActive, holdMs]);

  if (!guardActive) return null;

  // Always mounted (hidden) so the guard can reveal it instantly via `display`.
  return (
    <div
      ref={overlayRef}
      style={{ display: "none" }}
      className="fixed inset-0 z-[9999] flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-white"
    >
      <ShieldAlert className="h-10 w-10 text-accent-400" />
      <p className="text-lg font-bold">Content hidden</p>
      <p className="max-w-xs text-sm text-slate-300">Return to the page to continue. Screenshots and screen sharing are restricted here.</p>
    </div>
  );
}
