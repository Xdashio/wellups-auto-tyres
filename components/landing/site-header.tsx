"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent<string>("wl:toast", { detail: message }));
}

export function switchLandingTab(tab: "products" | "services") {
  window.dispatchEvent(new CustomEvent<string>("wl:switch-tab", { detail: tab }));
}

export function SiteHeader({
  productCount = 0,
  serviceCount = 0,
  branchCount = 0,
}: {
  productCount?: number;
  serviceCount?: number;
  branchCount?: number;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const goTab = useCallback((tab: "products" | "services") => {
    setMenuOpen(false);
    switchLandingTab(tab);
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const goSection = useCallback((id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <>
      <div className="announcement-bar">
        Genuine parts. Expert fitting. Two Nairobi branches.
        <a href="#branches" onClick={(e) => { e.preventDefault(); goSection("branches"); }}>
          Find your nearest branch
        </a>
      </div>

      <nav className={`nav${scrolled ? " scrolled" : ""}`} id="mainNav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <img
              src="/images/wellups_logo_no_bg.png"
              alt="Well Lups Auto Tyres"
              className="nav-logo-icon"
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
            />
            <div className="nav-logo-text">
              <span className="nav-logo-main">WELL LUPS</span>
              <span className="nav-logo-sub">AUTO TYRES LIMITED</span>
            </div>
          </Link>

          <ul className="nav-links">
            <li>
              <Link href="/products">Shop Products</Link>
            </li>
            <li>
              <Link href="/services">Garage Services</Link>
            </li>
            <li>
              <a href="#branches" onClick={(e) => { e.preventDefault(); goSection("branches"); }}>
                Our Branches
              </a>
            </li>
          </ul>

          <div className="nav-actions">
            <Link
              href="/products"
              className="nav-search"
              style={{ fontFamily: "inherit", textDecoration: "none" }}
              aria-label="Search tyres and parts"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              Search tyres, parts…
            </Link>
            <button className="nav-icon-btn" aria-label="Account" onClick={() => toast("Account feature coming soon")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button className="nav-icon-btn" aria-label="Cart" onClick={() => toast("Item added to cart")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="nav-cart-badge">2</span>
            </button>
            <button
              className="nav-menu-btn nav-icon-btn"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="mobileMenu"
              onClick={() => setMenuOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`mobile-menu-overlay${menuOpen ? " open" : ""}`}
        id="mobileMenuOverlay"
        aria-hidden={!menuOpen}
        onClick={() => setMenuOpen(false)}
      />
      <div
        className={`mobile-menu${menuOpen ? " open" : ""}`}
        id="mobileMenu"
        aria-hidden={!menuOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div className="mobile-menu-header">
          <Link href="/" className="nav-logo" style={{ marginRight: 0 }} onClick={() => setMenuOpen(false)}>
            <img src="/images/wellups_logo_no_bg.png" alt="" className="nav-logo-icon" />
            <div className="nav-logo-text">
              <span className="nav-logo-main">WELL LUPS</span>
              <span className="nav-logo-sub">AUTO TYRES LIMITED</span>
            </div>
          </Link>
          <button className="mobile-menu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mobile-menu-body">
          <form
            className="mobile-menu-search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              setMenuOpen(false);
              window.location.href = q ? `/products?search=${encodeURIComponent(String(q))}` : "/products";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" name="q" placeholder="Search tyres, parts, brands…" aria-label="Search tyres and parts" />
          </form>

          <nav className="mobile-menu-nav">
            <a href="#catalog" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); goTab("products"); }}>
              <span className="mobile-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /></svg>
              </span>
              <span className="mobile-nav-text">Shop Products</span>
              <span className="mobile-nav-badge">{productCount}</span>
              <svg className="mobile-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
            <a href="#catalog" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); goTab("services"); }}>
              <span className="mobile-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
              </span>
              <span className="mobile-nav-text">Garage Services</span>
              <span className="mobile-nav-badge">{String(serviceCount).padStart(2, "0")}</span>
              <svg className="mobile-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
            <a href="#fitFinder" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); goSection("fitFinder"); }}>
              <span className="mobile-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3 3 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>
              </span>
              <span className="mobile-nav-text">Vehicle Fit Finder</span>
              <svg className="mobile-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
            <a href="#booking" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); goSection("booking"); }}>
              <span className="mobile-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              </span>
              <span className="mobile-nav-text">Book Fitting &amp; Care</span>
              <svg className="mobile-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
            <a href="#branches" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); goSection("branches"); }}>
              <span className="mobile-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              </span>
              <span className="mobile-nav-text">Our Branches ({branchCount})</span>
              <svg className="mobile-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </a>
          </nav>

          <div className="mobile-menu-actions">
            <div className="mobile-menu-user-row">
              <button
                className="btn-secondary"
                style={{ height: 44, fontSize: 13, flex: 1, gap: 8 }}
                onClick={() => toast("Account feature coming soon")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                Account
              </button>
              <button
                className="btn-primary"
                style={{ height: 44, fontSize: 13, flex: 1, gap: 8 }}
                onClick={() => toast("Cart has 2 items")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                Cart (2)
              </button>
            </div>
          </div>

          <div className="mobile-menu-footer">
            <div className="mobile-menu-footer-title">Need direct assistance?</div>
            <a
              href="https://wa.me/254748088741?text=Hello%20Well%20Lups!%20I%20would%20like%20to%20inquire%20about%20your%20tyres%2C%20products%2C%20and%20garage%20services."
              target="_blank"
              rel="noopener"
              className="mobile-menu-wa-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.587 1.777.949 2.796.949h.002c3.181 0 5.768-2.586 5.768-5.766 0-3.18-2.587-5.736-5.77-5.736zm3.392 8.235c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.146-.531-1.857-.772-3.053-2.66-3.146-2.784-.093-.123-.746-.991-.746-1.889 0-.898.472-1.339.64-1.52.169-.181.369-.226.492-.226.124 0 .248.002.355.007.113.006.265-.043.414.316.154.372.525 1.282.571 1.376.046.093.077.202.015.326-.062.124-.093.201-.185.31-.093.109-.196.243-.279.327-.093.093-.19.195-.082.381.108.186.48 1.921 1.031 2.412.71.633 1.309.83 1.495.922.186.093.294.078.403-.047.109-.124.464-.541.588-.727.124-.186.248-.155.418-.093.17.062 1.082.51 1.267.603.186.093.309.139.355.217.046.077.046.449-.098.854z" /></svg>
              <span>Chat on WhatsApp</span>
            </a>
            <div className="mobile-menu-branches-info">
              <div><strong>Industrial Area:</strong> Commercial St, Nairobi</div>
              <div><strong>Westlands:</strong> Mpaka Rd, Nairobi</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
