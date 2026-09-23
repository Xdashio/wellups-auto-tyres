import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand-logo">
            <img
              src="/images/wellups_logo_no_bg.png"
              alt="Well Lups Auto Tyres"
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
            />
            <span className="footer-brand-name">WELL LUPS AUTO TYRES</span>
          </div>
          <p className="footer-brand-tagline">
            Tyres, parts, and garage care for the road ahead. Two branches in Nairobi.
          </p>
        </div>
        <div>
          <div className="footer-col-heading">Shop</div>
          <ul className="footer-links">
            <li><Link href="/products">Tyres</Link></li>
            <li><Link href="/products">Engine Oil</Link></li>
            <li><Link href="/products">Batteries</Link></li>
            <li><Link href="/products">Brake Parts</Link></li>
            <li><Link href="/products">All products</Link></li>
          </ul>
        </div>
        <div>
          <div className="footer-col-heading">Services</div>
          <ul className="footer-links">
            <li><Link href="/services">Wheel Balancing</Link></li>
            <li><Link href="/services">Wheel Alignment</Link></li>
            <li><Link href="/services">Tyre Fitting</Link></li>
            <li><Link href="/services">Tyre Repair</Link></li>
            <li><Link href="/services">Book a service</Link></li>
          </ul>
        </div>
        <div>
          <div className="footer-col-heading">Company</div>
          <ul className="footer-links">
            <li><a href="#branches">Our Branches</a></li>
            <li><a href="#booking">About Well Lups</a></li>
            <li><Link href="/warranty">Warranty &amp; Returns</Link></li>
            <li>
              <a
                href="https://wa.me/254748088741?text=Hello%20Well%20Lups!%20I%20would%20like%20to%20inquire%20about%20your%20tyres%2C%20products%2C%20and%20garage%20services."
                target="_blank"
                rel="noopener"
              >
                Contact Us
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="footer-copy">© 2025 Well Lups Auto Tyres Limited. All rights reserved.</span>
        <span className="footer-copy">Nairobi, Kenya</span>
      </div>
    </footer>
  );
}
