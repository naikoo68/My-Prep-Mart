import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ZoomContext = createContext();
const MIN = 0.5;
const MAX = 2;
const KEY = "msg-zoom";

// Site-wide zoom. The chosen level is applied to the whole document and
// remembered across pages/reloads. Full-screen quiz/test screens apply the
// same value to their own container (the browser's top layer ignores the
// document zoom while an element is full-screen).
export function ZoomProvider({ children }) {
  const [zoom, setZoomState] = useState(() => {
    const v = parseFloat(localStorage.getItem(KEY));
    return v >= MIN && v <= MAX ? v : 1;
  });

  useEffect(() => {
    document.documentElement.style.zoom = String(zoom);
    localStorage.setItem(KEY, String(zoom));
  }, [zoom]);

  const clamp = (v) => Math.min(MAX, Math.max(MIN, +(+v).toFixed(2)));
  const setZoom = useCallback((v) => setZoomState(clamp(v)), []);
  const zoomIn = useCallback(() => setZoomState((z) => clamp(z + 0.1)), []);
  const zoomOut = useCallback(() => setZoomState((z) => clamp(z - 0.1)), []);
  const resetZoom = useCallback(() => setZoomState(1), []);

  return (
    <ZoomContext.Provider value={{ zoom, zoomIn, zoomOut, setZoom, resetZoom, MIN, MAX }}>
      {children}
    </ZoomContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useZoom() {
  return useContext(ZoomContext);
}
