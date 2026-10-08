"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { foreground, palettes, validPalette, type Palette } from "./appearance";

export function WorkspaceAppearance({ children, sidebar, defaults, scope, workspaceName, variant = "default" }: {
  children: ReactNode; sidebar: ReactNode; defaults: Palette; scope: string; workspaceName?: string; variant?: "default" | "d5o-work";
}) {
  const [palette, setPalette] = useState(defaults);
  const [notice, setNotice] = useState("");
  const storageKey = `d5o.appearance.v1:${scope}`;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
        setPalette(validPalette(saved) ? saved : defaults);
      } catch { setPalette(defaults); }
    });
    return () => { active = false; };
  }, [storageKey, defaults]);
  function update(next: Palette, reset = false) {
    if (!validPalette(next)) return;
    setPalette(next);
    try {
      if (reset) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, JSON.stringify(next));
      setNotice(reset ? "Workspace preset restored." : "Colors saved for this account and workspace in this browser.");
    } catch { setNotice("Preview applied. Browser storage is unavailable; colors will not be remembered."); }
  }
  const style = {
    "--brand-primary": palette.primary, "--brand-accent": palette.accent,
    "--brand-on-primary": foreground(palette.primary), "--brand-on-accent": foreground(palette.accent)
  } as CSSProperties;
  return <div className={`app-shell d5o-branded${variant === "d5o-work" ? " d5o-app-shell" : ""}`} style={style}>
    <aside className="sidebar" aria-label="Primary navigation">
      {sidebar}
      <details className="appearance-panel">
        <summary>Appearance</summary>
        <p>{workspaceName || "D5O"} · Personal colors</p>
        <label>Color preset<select value="" onChange={e => { const p = palettes[e.target.value]; if (p) update(p); }}>
          <option value="" disabled>Choose a preset</option><option value="d5o">D5O · Slate & teal</option>
          <option value="rybex">Rybex · Navy & gold</option><option value="rotork">Rotork · Red, black & gray</option>
        </select></label>
        <label>Navigation color<input aria-label="Navigation color" type="color" value={palette.primary} onChange={e => update({ ...palette, primary: e.target.value })} /></label>
        <label>Accent color<input aria-label="Accent color" type="color" value={palette.accent} onChange={e => update({ ...palette, accent: e.target.value })} /></label>
        <p>Text switches between black and white for contrast. Status colors retain their meaning.</p>
        <button type="button" onClick={() => update(defaults, true)}>Reset to workspace preset</button>
        <p role="status">{notice}</p>
        <small>Personal preference in this browser. Does not change shared branding, workspace access or workflow rules.</small>
      </details>
    </aside>
    <main className="main-content">{children}</main>
  </div>;
}
