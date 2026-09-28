"use client";

// Power BI-style focus mode: fullscreen overlay for one visual.
import { useEffect } from "react";

export default function FocusOverlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="tile flex h-[88vh] w-[94vw] max-w-[1200px] flex-col p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close focus mode"
            className="rounded px-2 py-1 text-sm text-[var(--ink-2)] hover:bg-black/5"
          >
            ✕ Esc
          </button>
        </div>
        <div className="thin-scroll flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
