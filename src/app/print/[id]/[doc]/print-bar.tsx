"use client";

import Link from "next/link";
import { useEffect } from "react";

// The bar above the document (not printed): back to the project, and Save as PDF. Opened with
// ?print=1, the print window opens by itself once the pictures have loaded.
export function PrintBar({ label, back, tip, href }: { label: string; back: string; tip: string; href: string }) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const go = () => { setTimeout(() => window.print(), 300); };
    const images = [...document.images].filter((i) => !i.complete);
    if (!images.length) { go(); return; }
    let left = images.length;
    const done = () => { left -= 1; if (left === 0) go(); };
    images.forEach((i) => { i.addEventListener("load", done, { once: true }); i.addEventListener("error", done, { once: true }); });
  }, []);
  return (
    <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: "1px solid #DAD6D1", padding: "10px 24px", display: "flex", alignItems: "center", gap: 16, fontSize: 14 }}>
      <Link href={href} style={{ textDecoration: "underline", color: "#4A4744" }}>{back}</Link>
      <span style={{ color: "#7A7774", fontSize: 13, flex: 1 }}>{tip}</span>
      <button type="button" className="mn-btn mn-btn--primary" onClick={() => window.print()}>{label}</button>
    </div>
  );
}
