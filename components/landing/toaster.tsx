"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    setShow(false);
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const onToast = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      setShow(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), 3000);
    };
    window.addEventListener("wl:toast", onToast);
    return () => {
      window.removeEventListener("wl:toast", onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className={`toast${show ? " show" : ""}`} id="toast" role="alert" aria-live="polite">
      <span id="toastMsg">{msg ?? "Item added to cart"}</span>
      <button className="toast-close" onClick={hide} aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
