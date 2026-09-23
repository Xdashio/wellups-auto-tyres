import Link from "next/link";
import { buildWhatsappInquiryUrl } from "./landing-data";

// Footer columns link only to real destinations. Shop and Services list
// the catalogue roots (never invented category names); Contact renders
// the WhatsApp action only when a branch number is configured.
export function SiteFooter({ whatsapp = null }: { whatsapp?: string | null }) {
  const waUrl = buildWhatsappInquiryUrl(whatsapp);
  const year = new Date().getFullYear();
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
            Tyres, parts, and garage care for the road ahead.
          </p>
        </div>
        <div>
          <div className="footer-col-heading">Shop</div>
          <ul className="footer-links">
            <li><Link href="/products">All products</Link></li>
          </ul>
        </div>
        <div>
          <div className="footer-col-heading">Services</div>
          <ul className="footer-links">
            <li><Link href="/services">All services</Link></li>
          </ul>
        </div>
        <div>
          <div className="footer-col-heading">Company</div>
          <ul className="footer-links">
            <li><a href="#branches">Our Branches</a></li>
            <li><Link href="/warranty">Warranty &amp; Returns</Link></li>
            {waUrl ? (
              <li>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener"
                >
                  Contact Us
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="footer-copy">© {year} Well Lups Auto Tyres Limited. All rights reserved.</span>
      </div>
    </footer>
  );
}
