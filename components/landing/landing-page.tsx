"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATIC_VEHICLE_MODELS,
  STATIC_YEARS,
  whatsappInquiryUrl,
  type LandingBranch,
  type LandingProduct,
  type LandingService,
} from "./landing-data";
import { toast } from "./site-header";

export interface LandingContent {
  products: LandingProduct[];
  services: LandingService[];
  branches: LandingBranch[];
  productCount: number;
  serviceCount: number;
  makes: string[];
  modelsByMake: Record<string, string[]>;
  years: string[];
  featured: LandingProduct[];
  heroProduct: { name: string; spec: string } | null;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);
const TYRE_R = 0.427;
const DEG = 57.2958;

function useReducedMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRm(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setRm(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return rm;
}

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal-heading");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => {
        (el as HTMLElement).style.opacity = "1";
        (el as HTMLElement).style.transform = "none";
        (el as HTMLElement).style.transition = "none";
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function loop(fn: (dt: number, t: number) => boolean | void) {
  let last = performance.now();
  let id = 0;
  let alive = true;
  const tick = (t: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (fn(dt, t) === false) {
      alive = false;
      return;
    }
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => {
    alive = false;
    cancelAnimationFrame(id);
  };
}

/* ─── Neutral catalogue placeholders ───────────────────
   The public catalogue carries no imagery yet, so cards render a generic
   visual until real product photos land. No brand, no fake product. */
function GenericTyreSvg({ extraRef }: { extraRef?: (el: SVGSVGElement | null) => void }) {
  return (
    <svg
      className="tyre-img"
      ref={extraRef}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="Tyre placeholder"
    >
      <circle cx="100" cy="100" r="94" fill="#1A1B1B" />
      <circle cx="100" cy="100" r="94" stroke="#000" strokeOpacity="0.3" strokeWidth="2" />
      <circle cx="100" cy="100" r="80" stroke="#3a3b3b" strokeWidth="6" strokeDasharray="10 8" />
      <circle cx="100" cy="100" r="58" fill="#E8E9EC" />
      <circle cx="100" cy="100" r="58" stroke="#c9caca" strokeWidth="2" />
      {[0, 72, 144, 216, 288].map((a) => (
        <rect
          key={a}
          x="93"
          y="48"
          width="14"
          height="104"
          rx="4"
          fill="#658EBE"
          transform={`rotate(${a} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="20" fill="#045CB4" />
      <circle cx="100" cy="100" r="20" stroke="#043D8B" strokeWidth="2" />
      <circle cx="100" cy="100" r="7" fill="#fff" />
    </svg>
  );
}

function GenericServiceSvg() {
  return (
    <svg
      className="oil-svg"
      viewBox="0 0 160 200"
      fill="none"
      role="img"
      aria-label="Service placeholder"
    >
      <circle cx="80" cy="100" r="56" stroke="#658EBE" strokeWidth="10" strokeDasharray="14 10" />
      <circle cx="80" cy="100" r="34" fill="#144177" />
      <circle cx="80" cy="100" r="34" stroke="#0d2a45" strokeWidth="2" />
      <rect x="72" y="84" width="16" height="32" rx="8" fill="#fff" opacity="0.85" />
      <circle cx="80" cy="100" r="6" fill="#045CB4" />
    </svg>
  );
}

function WishButton({ name }: { name: string }) {
  const [active, setActive] = useState(false);
  return (
    <button
      className={`wishlist-btn${active ? " active" : ""}`}
      aria-label="Toggle wishlist"
      onClick={(e) => {
        e.stopPropagation();
        setActive((a) => {
          toast(a ? `${name} removed from wishlist` : `${name} added to wishlist`);
          return !a;
        });
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={active ? "#ef4444" : "none"}
        stroke={active ? "#ef4444" : "#777"}
        strokeWidth="2"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}

const STOCK_META = {
  in: { label: "In Stock", cls: "stock-in" },
  low: { label: "Low Stock", cls: "stock-low" },
  out: { label: "Out of Stock", cls: "stock-out" },
} as const;

function ProductCard({ product }: { product: LandingProduct }) {
  const meta = STOCK_META[product.stock];
  const out = product.stock === "out";
  return (
    <div className="product-card">
      <div className="product-card-image">
        <span className={`stock-badge ${meta.cls}`}>{meta.label}</span>
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="tyre-img"
            width={200}
            height={200}
            loading="lazy"
            draggable={false}
            style={out ? { opacity: 0.55 } : undefined}
          />
        ) : (
          <GenericTyreSvg />
        )}
        <WishButton name={product.name} />
      </div>
      <div className="product-card-body">
        <div className="product-cat">{product.category}</div>
        <div className="product-name">{product.name}</div>
        <div className="product-spec">{product.spec}</div>
        <div className="product-footer">
          <a
            className="product-price quote-btn"
            href={whatsappInquiryUrl(product.name, product.spec, product.category)}
            target="_blank"
            rel="noopener"
            style={{ background: "none", border: "none", padding: 0, ...(out ? { color: "var(--text-secondary)" } : {}) }}
            aria-label={`Get a quote for ${product.name} on WhatsApp`}
          >
            Get a quote
          </a>
          <button
            className="add-to-cart-btn"
            aria-label={out ? "Out of stock" : "Add to cart"}
            disabled={out}
            style={out ? { background: "#ccc", cursor: "not-allowed" } : undefined}
            onClick={() => toast(`${product.brand} ${product.category === "Tyre" ? product.name.replace(/^(Bridgestone|Michelin|Continental|Pirelli|Goodyear)\s+/, "") : product.name} added to cart`.slice(0, 80))}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: LandingService }) {
  return (
    <div className="product-card">
      <div className="product-card-image" style={{ background: "#EEF3FA" }}>
        {service.image ? (
          <img src={service.image} alt={service.name} className="tyre-img" width={200} height={200} loading="lazy" draggable={false} />
        ) : (
          <GenericServiceSvg />
        )}
      </div>
      <div className="product-card-body">
        <div className="product-cat">{service.category}</div>
        <div className="product-name">{service.name}</div>
        <div className="product-spec">{service.spec}</div>
        <div className="product-footer">
          <a
            className="product-price quote-btn"
            href={whatsappInquiryUrl(service.name, service.spec, service.category)}
            target="_blank"
            rel="noopener"
            style={{ background: "none", border: "none", padding: 0 }}
            aria-label={`Get a quote for ${service.name} on WhatsApp`}
          >
            {service.cta}
          </a>
          <button
            className="add-to-cart-btn"
            style={{ background: "var(--navy)" }}
            aria-label="Book service"
            onClick={() => toast(`${service.name} booking started`)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero (roll-in & settle, ported) ────────────────────── */
function Hero({ heroProduct }: { heroProduct: { name: string; spec: string } | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLImageElement>(null);
  const sharpRef = useRef<HTMLImageElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const rig = rigRef.current;
    const wheel = wheelRef.current;
    const blur = blurRef.current;
    const sharp = sharpRef.current;
    const shadow = shadowRef.current;
    const card = cardRef.current;
    if (!stage || !rig || !wheel || !blur || !sharp || !shadow) return;

    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let R = 0;
    let x0 = 0;
    let prev: number | null = null;
    let v = 0;
    let cardOn = false;
    let stop: (() => void) | null = null;
    let started = false;

    const measure = () => {
      W = rig.offsetWidth;
      R = W * TYRE_R;
      x0 = stage.offsetWidth - rig.offsetLeft + 14;
    };
    const D1 = 1.15;
    const xAt = (t: number) => {
      const OV = -W * 0.05;
      if (t < D1) return x0 + (OV - x0) * easeOutCubic(t / D1);
      const s = t - D1;
      return OV * Math.exp(-6.5 * s) * Math.cos(11 * s);
    };
    const draw = (x: number, dt: number) => {
      if (prev !== null && dt > 0) v = v * 0.6 + ((x - prev) / dt) * 0.4;
      prev = x;
      wheel.style.transform = `rotate(${(x / R) * DEG}deg)`;
      rig.style.transform = `translate3d(${x}px,0,0)`;
      blur.style.opacity = String(clamp((Math.abs((v / R) * DEG) - 250) / 900, 0, 0.95));
      shadow.style.transform = `translate3d(${x}px,0,0) scaleX(${1 + Math.min(0.25, Math.abs(v) / 6000)})`;
    };
    const show = () => {
      rig.classList.add("ready");
      shadow.style.opacity = "1";
    };
    measure();
    if (RM) {
      draw(0, 0);
      blur.style.opacity = "0";
      show();
      card?.classList.add("on");
      return;
    }
    draw(x0, 0);
    show();
    const go = () => {
      let t = 0;
      stop = loop((dt) => {
        t += dt;
        draw(xAt(t), dt);
        if (!cardOn && t > 0.85) {
          cardOn = true;
          card?.classList.add("on");
        }
        if (t > D1 + 1.7) {
          draw(0, dt);
          blur.style.opacity = "0";
          return false;
        }
      });
    };
    const start = () => {
      if (started) return;
      started = true;
      measure();
      go();
    };
    const sharpImg = sharp as HTMLImageElement & { decode?: () => Promise<void> };
    if (sharpImg.decode) sharpImg.decode().then(start, start);
    else start();
    const fallback = window.setTimeout(start, 1500);
    const onResize = () => {
      measure();
      if (started) draw(0, 0);
      else draw(x0, 0);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("resize", onResize);
      if (stop) stop();
    };
  }, []);

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="hero">
      <div className="hero-content">
        <h1 className="hero-headline">
          Nairobi&apos;s tyres.<br />
          Fitted right.
        </h1>
        <p className="hero-body">
          Two branches, genuine brands, qualified technicians. Parts and garage care for every road ahead.
        </p>
        <div className="hero-ctas">
          <a href="#catalog" className="btn-primary" onClick={scrollTo("catalog")}>
            Shop Products
          </a>
          <a href="#booking" className="btn-secondary" onClick={scrollTo("booking")}>
            Book a Service
          </a>
        </div>
        <div className="hero-trust">
          <span className="hero-trust-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Genuine brands stocked</span>
          </span>
          <span className="hero-trust-dot" aria-hidden="true">·</span>
          <span className="hero-trust-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Two Nairobi branches</span>
          </span>
          <span className="hero-trust-dot" aria-hidden="true">·</span>
          <span className="hero-trust-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Fitting included</span>
          </span>
        </div>
      </div>

      <div className="hero-visual"></div>

      <div className="hero-stage" id="heroStage" ref={stageRef}>
        <div className="hero-shadow" id="heroShadow" ref={shadowRef}></div>
        <div className="hero-rig" id="heroRig" ref={rigRef}>
          <div className="hero-wheel" id="heroWheel" ref={wheelRef}>
            <img
              className="hw-sharp"
              ref={sharpRef}
              src="/images/hero-wheel.webp"
              alt="Well Lups premium automotive wheel and tyre"
              width={720}
              height={720}
              decoding="async"
            />
            <img
              className="hw-blur"
              ref={blurRef}
              src="/images/hero-wheel-blur.webp"
              alt=""
              aria-hidden="true"
              width={512}
              height={512}
              decoding="async"
            />
          </div>
        </div>
        {heroProduct ? (
          <div className="hero-card" id="heroCard" ref={cardRef}>
            <div className="hc-row" style={{ "--i": 0 } as CSSProperties}>
              <span className="hc-badge">In Stock</span>
            </div>
            <div className="hc-row" style={{ "--i": 1 } as CSSProperties}>
              <div className="product-name">{heroProduct.name}</div>
            </div>
            <div className="hc-row" style={{ "--i": 2 } as CSSProperties}>
              <div className="product-spec">{heroProduct.spec}</div>
            </div>
            <div className="hc-row hc-foot" style={{ "--i": 3 } as CSSProperties}>
              <a
                className="product-price quote-btn"
                href={whatsappInquiryUrl(heroProduct.name, heroProduct.spec, "Tyres")}
                target="_blank"
                rel="noopener"
                style={{ background: "none", border: "none", padding: 0 }}
                aria-label={`Inquire about ${heroProduct.name} on WhatsApp`}
              >
                Get a quote
              </a>
              <button className="add-to-cart-btn" onClick={() => toast(`${heroProduct.name} added to cart`)} aria-label="Add to cart">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ─── Fit finder (shared Select, prototype styling) ─────── */
function FitFinder({
  makes,
  modelsByMake,
  years,
  resultCount,
}: {
  makes: string[];
  modelsByMake: Record<string, string[]>;
  years: string[];
  resultCount: number;
}) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const makeList = makes.length ? makes : Object.keys(STATIC_VEHICLE_MODELS);
  const modelMap = Object.keys(modelsByMake).length ? modelsByMake : STATIC_VEHICLE_MODELS;
  const yearList = years.length ? years : STATIC_YEARS;
  const models = make ? modelMap[make] ?? [] : [];

  return (
    <div className="fit-finder" id="fitFinder">
      <div className="fit-finder-inner">
        <div>
          <h2 className="fit-finder-heading">Find tyres that fit your car.</h2>
          <p className="fit-finder-sub">Select your vehicle and we&apos;ll show you compatible stock.</p>
        </div>
        <div className="fit-finder-form">
          <div className="fit-field">
            <span className="fit-label" id="fitMakeLabel">Make</span>
            <Select
              value={make}
              onValueChange={(v) => {
                setMake(v);
                setModel("");
              }}
            >
              <SelectTrigger id="fitMake" aria-labelledby="fitMakeLabel fitMake" className="fit-trigger">
                <SelectValue placeholder="Select Make" />
              </SelectTrigger>
              <SelectContent>
                {makeList.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="fit-field">
            <span className="fit-label" id="fitModelLabel">Model</span>
            <Select value={model} onValueChange={setModel} disabled={!make}>
              <SelectTrigger id="fitModel" aria-labelledby="fitModelLabel fitModel" className="fit-trigger">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="fit-field">
            <span className="fit-label" id="fitYearLabel">Year</span>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger id="fitYear" aria-labelledby="fitYearLabel fitYear" className="fit-trigger">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {yearList.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            className="fit-finder-btn"
            id="fitSubmitBtn"
            type="button"
            onClick={() => {
              if (!make) {
                toast("Please select your vehicle make first");
                document.getElementById("fitMake")?.focus();
                return;
              }
              const label = model ? `${make} ${model}` : make;
              if (resultCount > 0) {
                toast(`Found ${resultCount} matching genuine ${resultCount === 1 ? "tyre" : "tyres"} for ${label}`);
              } else {
                toast(`No matching stock yet for ${label} — chat to us on WhatsApp`);
              }
              document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span>Find my fit</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Featured wheel carousel (ported) ───────────────────── */
function Featured({ items }: { items: LandingProduct[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pivotRef = useRef<HTMLDivElement>(null);
  const ticksRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const spokeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imgRefs = useRef<(HTMLImageElement | SVGSVGElement | null)[]>([]);

  useEffect(() => {
    const track = trackRef.current;
    const pivot = pivotRef.current;
    const ticks = ticksRef.current;
    const prevB = prevRef.current;
    const nextB = nextRef.current;
    if (!track || !pivot || !ticks || !prevB || !nextB) return;
    const N = items.length;
    if (!N) return;
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let STEP = 14;
    let RR = 1300;
    let CW = 264;
    let PPC = 290;
    let CH = 0;
    let pos = 0;
    let target = Math.min(1, N - 1);
    let vel = 0;
    let dragging = false;
    let moved = 0;
    let sx = 0;
    let sp0 = 0;
    let lastX = 0;
    let lastT = 0;
    let dv = 0;
    let stopLoop: (() => void) | null = null;

    const holders = cardRefs.current;
    const spokes = spokeRefs.current;
    const imgs = imgRefs.current;

    function render() {
      pivot!.style.transform = `rotate(${-pos * STEP}deg)`;
      holders.forEach((holder, i) => {
        if (!holder) return;
        const d = Math.min(1, Math.abs(i - pos));
        holder.style.transform = `scale(${1 - 0.09 * d})`;
        holder.style.opacity = String(1 - 0.32 * d);
        const img = imgs[i];
        if (img) img.style.transform = `rotate(${(pos - i) * 70 + i * 17}deg)`;
      });
      const cur = Math.round(clamp(pos, 0, N - 1));
      [...ticks!.children].forEach((t, i) => t.classList.toggle("on", i === cur));
      prevB!.disabled = target <= 0;
      nextB!.disabled = target >= N - 1;
    }
    function layout() {
      const mobile = track!.clientWidth < 640;
      STEP = mobile ? 21 : 14;
      RR = mobile ? 760 : 1300;
      CW = mobile ? 224 : 264;
      PPC = mobile ? 230 : 290;
      holders.forEach((holder) => {
        if (holder) holder.style.width = `${CW}px`;
      });
      const first = holders[0];
      CH = first ? first.offsetHeight : 0;
      const top = mobile ? 14 : 24;
      track!.style.height = `${top + CH + (mobile ? 60 : 72)}px`;
      pivot!.style.top = `${top + CH / 2 + RR}px`;
      spokes.forEach((spoke, i) => {
        if (!spoke) return;
        spoke.style.transform = `rotate(${i * STEP}deg)`;
      });
      holders.forEach((holder) => {
        if (!holder) return;
        holder.style.left = `${-CW / 2}px`;
        holder.style.top = `${-RR - CH / 2}px`;
      });
      render();
    }
    function kick() {
      if (stopLoop) return;
      stopLoop = loop((dt) => {
        if (!dragging) {
          vel += ((target - pos) * 130 - vel * 17) * dt;
          pos += vel * dt;
        }
        render();
        if (!dragging && Math.abs(target - pos) < 0.0008 && Math.abs(vel) < 0.003) {
          pos = target;
          vel = 0;
          render();
          stopLoop = null;
          return false;
        }
      });
    }
    function go(i: number) {
      target = clamp(i, 0, N - 1);
      kick();
    }
    const onPrev = () => go(target - 1);
    const onNext = () => go(target + 1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        go(target + 1);
        e.preventDefault();
      }
      if (e.key === "ArrowLeft") {
        go(target - 1);
        e.preventDefault();
      }
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      dragging = true;
      moved = 0;
      sx = lastX = e.clientX;
      sp0 = pos;
      lastT = performance.now();
      dv = 0;
      vel = 0;
      try {
        track!.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      pos = clamp(sp0 - dx / PPC, -0.35, N - 1 + 0.35);
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      if (dt > 0) dv = dv * 0.6 + (-(e.clientX - lastX) / PPC / dt) * 0.4;
      lastX = e.clientX;
      lastT = now;
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      target = clamp(Math.round(pos + dv * 0.18), 0, N - 1);
      vel = dv * 0.6;
      kick();
      window.setTimeout(() => {
        moved = 0;
      }, 0);
    };

    prevB.addEventListener("click", onPrev);
    nextB.addEventListener("click", onNext);
    track.addEventListener("keydown", onKey);
    track.addEventListener("pointerdown", onDown);
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);

    let rt: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(layout, 120);
    };
    window.addEventListener("resize", onResize);

    pos = RM ? target : target + 0.9;
    layout();
    let io: IntersectionObserver | null = null;
    if (!RM && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (es) => {
          if (es[0].isIntersecting) {
            io?.disconnect();
            kick();
          }
        },
        { threshold: 0.25 }
      );
      io.observe(track);
    } else {
      pos = target;
      render();
    }
    return () => {
      prevB.removeEventListener("click", onPrev);
      nextB.removeEventListener("click", onNext);
      track.removeEventListener("keydown", onKey);
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", end);
      track.removeEventListener("pointercancel", end);
      window.removeEventListener("resize", onResize);
      io?.disconnect();
      if (stopLoop) stopLoop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  return (
    <section className="featured" id="featured" aria-label="Featured tyres">
      <div className="featured-head">
        <h2 className="featured-heading reveal-heading">Top picks, on a roll.</h2>
        <p className="featured-sub">Drag, swipe or use the arrows.</p>
      </div>
      <div
        className="featured-track"
        id="fcTrack"
        ref={trackRef}
        tabIndex={0}
        aria-roledescription="carousel"
        aria-label="Featured tyres, use the left and right arrow keys"
      >
        <div className="fc-pivot" id="fcPivot" ref={pivotRef}>
          {items.map((p, i) => (
            <div
              key={p.id}
              className="fc-spoke"
              ref={(el) => {
                spokeRefs.current[i] = el;
              }}
            >
              <div
                className="fc-card"
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
              >
                <div className="product-card">
                  <div className="product-card-image">
                    <span className={`stock-badge ${STOCK_META[p.stock].cls}`}>{STOCK_META[p.stock].label}</span>
                    {p.image ? (
                      <img
                        ref={(el) => {
                          imgRefs.current[i] = el;
                        }}
                        src={p.image}
                        alt={p.name}
                        className="tyre-img"
                        width={200}
                        height={200}
                        draggable={false}
                      />
                    ) : (
                      <GenericTyreSvg
                        extraRef={(el) => {
                          imgRefs.current[i] = el;
                        }}
                      />
                    )}
                    <WishButton name={p.name} />
                  </div>
                  <div className="product-card-body">
                    <div className="product-cat">{p.category}</div>
                    <div className="product-name">{p.name}</div>
                    <div className="product-spec">{p.spec}</div>
                    <div className="product-footer">
                      <a
                        className="product-price quote-btn"
                        href={whatsappInquiryUrl(p.name, p.spec, p.category)}
                        target="_blank"
                        rel="noopener"
                        style={{ background: "none", border: "none", padding: 0 }}
                        aria-label={`Get a quote for ${p.name} on WhatsApp`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Get a quote
                      </a>
                      <button
                        className="add-to-cart-btn"
                        aria-label="Add to cart"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast(`${p.name} added to cart`);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="fc-ctl">
        <button className="fc-arrow" id="fcPrev" ref={prevRef} type="button" aria-label="Previous tyre">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="fc-ticks" id="fcTicks" ref={ticksRef} aria-hidden="true">
          {items.map((p) => (
            <i key={p.id} />
          ))}
        </div>
        <button className="fc-arrow" id="fcNext" ref={nextRef} type="button" aria-label="Next tyre">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

/* ─── Catalogue ──────────────────────────────────────────── */
function Catalog({
  products,
  services,
  productCount,
  serviceCount,
}: {
  products: LandingProduct[];
  services: LandingService[];
  productCount: number;
  serviceCount: number;
}) {
  const [tab, setTab] = useState<"products" | "services">("products");

  useEffect(() => {
    const onSwitch = (e: Event) => setTab((e as CustomEvent<string>).detail === "services" ? "services" : "products");
    window.addEventListener("wl:switch-tab", onSwitch);
    return () => window.removeEventListener("wl:switch-tab", onSwitch);
  }, []);

  return (
    <section className="catalog" id="catalog">
      <div className="wl-container">
        <div className="catalog-header">
          <h2 className="catalog-heading reveal-heading">
            Everything you need<br />
            to keep moving.
          </h2>
          <div className="catalog-tabs">
            <button className={`catalog-tab${tab === "products" ? " active" : ""}`} onClick={() => setTab("products")}>
              Products <span className="count">{productCount}</span>
            </button>
            <button className={`catalog-tab${tab === "services" ? " active" : ""}`} onClick={() => setTab("services")}>
              Services <span className="count">{String(serviceCount).padStart(2, "0")}</span>
            </button>
          </div>
        </div>

        <div className="product-grid active" id="tab-products" style={{ display: tab === "products" ? "grid" : "none" }}>
          {products.length ? (
            products.map((p) => <ProductCard key={p.id} product={p} />)
          ) : (
            <div style={{ gridColumn: "1 / -1", padding: "48px 24px", textAlign: "center" }}>
              <div className="product-name">Fresh stock landing soon.</div>
              <div className="product-spec" style={{ marginTop: 8 }}>
                Chat to us on WhatsApp and we&apos;ll confirm availability for your vehicle.
              </div>
            </div>
          )}
        </div>

        <div className="product-grid" id="tab-services" style={{ display: tab === "services" ? "grid" : "none" }}>
          {services.length ? (
            services.map((s) => <ServiceCard key={s.id} service={s} />)
          ) : (
            <div style={{ gridColumn: "1 / -1", padding: "48px 24px", textAlign: "center" }}>
              <div className="product-name">Service menu coming together.</div>
              <div className="product-spec" style={{ marginTop: 8 }}>
                Call or WhatsApp either branch to book fitting, balancing, and alignment.
              </div>
            </div>
          )}
        </div>

        <div className="catalog-footer">
          <Link href={tab === "products" ? "/products" : "/services"} className="view-all-link" id="viewAllLink">
            {tab === "products" ? "View all products" : "View all services"}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Road scene (ported) ────────────────────────────────── */
function RoadScene() {
  const sceneRef = useRef<HTMLElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLImageElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const dashesRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const scene = sceneRef.current;
    const rig = rigRef.current;
    const wheel = wheelRef.current;
    const blur = blurRef.current;
    const shadow = shadowRef.current;
    const dashes = dashesRef.current;
    if (!scene || !rig || !wheel || !blur || !shadow || !dashes) return;
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const layers = layerRefs.current
      .filter((el): el is HTMLDivElement => !!el)
      .map((el) => ({ el, f: Number(el.dataset.f), h: Number(el.dataset.h), tile: 1400 }));
    const DASH = 120;
    const TILE = 1400;
    const BASE = 150;
    let dist = 0;
    let boost = 0;
    let lastY = window.scrollY;
    let R = 90;
    let stop: (() => void) | null = null;

    function size() {
      const k = window.innerWidth < 700 ? 0.72 : 1;
      layers.forEach((l) => {
        l.tile = TILE * k;
        l.el.style.height = `${l.h * k}px`;
        l.el.style.width = `calc(100% + ${l.tile}px)`;
        l.el.style.backgroundSize = `${l.tile}px ${l.h * k}px`;
      });
      R = rig!.offsetWidth * TYRE_R;
    }
    function apply(speed: number) {
      for (const l of layers) l.el.style.transform = `translate3d(${-((dist * l.f) % l.tile)}px,0,0)`;
      dashes!.style.transform = `translate3d(${-(dist % DASH)}px,0,0)`;
      wheel!.style.transform = `rotate(${(dist / R) * DEG}deg)`;
      const bob = Math.sin(dist * 0.045) * Math.min(1, speed / 400) * 1.6;
      rig!.style.transform = `translate3d(0,${bob}px,0)`;
      blur!.style.opacity = String(clamp(((((speed / R) * DEG) - 300) / 900), 0, 0.9));
      shadow!.style.transform = `scaleX(${1 + Math.min(0.12, speed / 12000)})`;
    }
    size();
    apply(0);
    const onResize = () => {
      size();
      apply(BASE);
    };
    window.addEventListener("resize", onResize);
    if (RM) {
      dist = 420;
      apply(0);
      return () => window.removeEventListener("resize", onResize);
    }
    const run = () => {
      if (stop) return;
      lastY = window.scrollY;
      stop = loop((dt) => {
        const y = window.scrollY;
        const inst = Math.abs(y - lastY) / Math.max(dt, 0.001);
        lastY = y;
        boost += (Math.min(inst, 1500) * 0.7 - boost) * (1 - Math.exp(-dt * 6));
        const speed = BASE + boost;
        dist += speed * dt;
        apply(speed);
      });
    };
    const halt = () => {
      if (stop) {
        stop();
        stop = null;
      }
    };
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (es) => {
          if (es[0].isIntersecting) run();
          else halt();
        },
        { rootMargin: "120px" }
      );
      io.observe(scene);
    } else run();
    const onVis = () => {
      if (document.hidden) halt();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
      halt();
    };
  }, []);

  return (
    <section className="roadscene" id="roadScene" ref={sceneRef} aria-label="Fitted right, ready for the road ahead">
      <div className="rs-sky">
        <div className="rs-copy">
          <div className="wl-container">
            <h2 className="rs-heading reveal-heading">
              Fitted right.<br />
              Ready for every road ahead.
            </h2>
          </div>
        </div>
        <div
          className="rs-layer rs-far"
          data-f="0.12"
          data-h="200"
          ref={(el) => {
            layerRefs.current[0] = el;
          }}
        ></div>
        <div
          className="rs-layer rs-mid"
          data-f="0.32"
          data-h="150"
          ref={(el) => {
            layerRefs.current[1] = el;
          }}
        ></div>
        <div
          className="rs-layer rs-near"
          data-f="0.7"
          data-h="150"
          ref={(el) => {
            layerRefs.current[2] = el;
          }}
        ></div>
      </div>
      <div className="rs-road">
        <div className="rs-dashes" id="rsDashes" ref={dashesRef}></div>
      </div>
      <div className="rs-shadow" id="rsShadow" ref={shadowRef}></div>
      <div className="rs-rig" id="rsRig" ref={rigRef}>
        <div className="rs-wheel" id="rsWheel" ref={wheelRef}>
          <img
            className="rs-sharp"
            src="/images/hero-wheel.webp"
            alt=""
            aria-hidden="true"
            width={720}
            height={720}
            loading="lazy"
            decoding="async"
          />
          <img
            className="rs-blur"
            ref={blurRef}
            src="/images/hero-wheel-blur.webp"
            alt=""
            aria-hidden="true"
            width={512}
            height={512}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}

/* ─── WhatsApp FAB ───────────────────────────────────────── */
function WhatsAppFab() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <a
      href={whatsappInquiryUrl()}
      className={`whatsapp-fab${visible ? " visible" : ""}`}
      id="whatsappFab"
      target="_blank"
      rel="noopener"
      aria-label="Chat on WhatsApp"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
      </svg>
    </a>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export function LandingPage({ content }: { content: LandingContent }) {
  useReveal();
  const rm = useReducedMotion();

  const scrollTo = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: rm ? "auto" : "smooth" });
    },
    [rm]
  );

  return (
    <main>
      <Hero heroProduct={content.heroProduct} />

      <FitFinder
        makes={content.makes}
        modelsByMake={content.modelsByMake}
        years={content.years}
        resultCount={content.productCount}
      />

      {content.featured.length ? <Featured items={content.featured} /> : null}

      <Catalog
        products={content.products}
        services={content.services}
        productCount={content.productCount}
        serviceCount={content.serviceCount}
      />

      <section className="dark-band" id="booking">
        <div className="dark-band-inner">
          <div>
            <h2 className="dark-band-heading">Good parts need expert hands.</h2>
            <p className="dark-band-body">
              Our technicians handle fitting, balancing, alignment, and repairs. Book ahead or drop in at either branch.
            </p>
            <Link href="/services" className="btn-ghost">
              Book a service
            </Link>
          </div>
          <div className="dark-band-stats">
            <div className="stat-item">
              <div className="stat-number">15+</div>
              <div className="stat-label">years on<br />the road</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">2</div>
              <div className="stat-label">branches in<br />Nairobi</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">4.8</div>
              <div className="stat-label">average<br />customer rating</div>
            </div>
          </div>
        </div>
      </section>

      <section className="why">
        <div className="wl-container">
          <h2 className="why-heading reveal-heading">We know these roads.</h2>
          <div className="why-grid">
            <div className="why-item">
              <div className="why-item-heading">Right fit, first time</div>
              <p className="why-item-body">
                We match every part to your vehicle, not just your budget. Incompatible parts don&apos;t leave this shop.
              </p>
            </div>
            <div className="why-item">
              <div className="why-item-heading">Technicians who show up</div>
              <p className="why-item-body">
                Qualified team across both branches. No waiting for a specialist who isn&apos;t there.
              </p>
            </div>
            <div className="why-item">
              <div className="why-item-heading">Honest about what you need</div>
              <p className="why-item-body">
                Clear pricing, genuine warranties, no surprises at the counter. We tell you what&apos;s needed and what can
                wait.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="branches" id="branches">
        <div className="wl-container">
          <h2 className="branches-heading reveal-heading">
            Two branches.<br />
            One standard.
          </h2>
          <div className="branches-grid">
            {content.branches.length ? (
              content.branches.map((b) => (
              <div className="branch-card" key={b.name}>
                <div className="branch-num">{b.num}</div>
                <div className="branch-name">{b.name}</div>
                <div className="branch-address">
                  {b.address[0]}
                  {b.address[1] ? <br /> : null}
                  {b.address[1]}
                </div>
                <div>
                  <a href={b.phoneHref} className="branch-phone">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    {b.phone}
                  </a>
                </div>
                <a
                  className="branch-map-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Well Lups Auto Tyres ${b.name} Nairobi`)}`}
                  target="_blank"
                  rel="noopener"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Get directions
                </a>
              </div>
            ))
            ) : (
              <div className="branch-card">
                <div className="branch-name">Branch details coming soon.</div>
                <div className="branch-address">
                  Chat to us on WhatsApp for directions to your nearest branch.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <RoadScene />

      <WhatsAppFab />

      <noscript>
        <style>{`.hero-rig{opacity:1}.hero-shadow{opacity:1}.hero-card,.hc-row{opacity:1;transform:none}`}</style>
      </noscript>
      {/* keep section anchors working from the site header */}
      <span hidden>
        <a href="#catalog" onClick={scrollTo("catalog")}>catalog</a>
      </span>
    </main>
  );
}
