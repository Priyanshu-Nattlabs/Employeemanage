import Link from "next/link";
import "./SiteFooter.css";

function sxBase(): string {
  return (process.env.NEXT_PUBLIC_SAARTHIX_URL || "https://saarthix.com").replace(/\/$/, "");
}

const PLATFORM_LINKS: [string, string][] = [
  ["/", "Home"],
  ["/students", "For Students"],
  ["/institutes", "For Institutes"],
  ["/industry", "For Industry"],
];

const COMPANY_LINKS: [string, string][] = [
  ["/about-us", "About Us"],
  ["/contact", "Contact"],
  ["/blog", "Blog"],
  ["/resources", "Resources"],
];

/** Same markup as SomethingX `components/layout/SiteFooter.jsx`; links target the main SaarthiX site. */
export function SiteFooter() {
  const base = sxBase();
  const logoSrc = `${base}/assets/logo_png.png`;
  const to = (path: string) => (path.startsWith("/") ? `${base}${path}` : `${base}/${path}`);

  return (
    <footer className="site-footer" aria-label="Site footer">
      <div className="site-footer__body">
        <div className="site-footer__inner">
          <div className="site-footer__grid">
            <div className="site-footer__col site-footer__col--brand">
              <div className="site-footer__logo-row">
                <img src={logoSrc} alt="SaarthiX" className="site-footer__logo-img" width={40} height={40} />
                <span className="site-footer__logo-name">SaarthiX</span>
              </div>
              <p className="site-footer__brand-desc">
                Connecting students, institutes, and industry in one smart space. Learn, grow, and create opportunities
                together.
              </p>
              <p className="site-footer__tagline">Empowering Dreams, Building Futures!</p>
              <div className="site-footer__socials">
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  className="site-footer__social"
                  aria-label="LinkedIn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="site-footer__social"
                  aria-label="X (Twitter)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="site-footer__social"
                  aria-label="Instagram"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  className="site-footer__social"
                  aria-label="YouTube"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#fff" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="site-footer__col">
              <p className="site-footer__heading">Platform</p>
              <ul className="site-footer__links">
                {PLATFORM_LINKS.map(([path, label]) => (
                  <li key={path + label}>
                    <Link href={to(path)} className="site-footer__link">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="site-footer__col">
              <p className="site-footer__heading">Explore</p>
              <ul className="site-footer__links">
                {COMPANY_LINKS.map(([path, label]) => (
                  <li key={path + label}>
                    <Link href={to(path)} className="site-footer__link">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="site-footer__col">
              <p className="site-footer__heading">Contact</p>
              <ul className="site-footer__contact">
                <li>
                  <span className="site-footer__contact-icon" aria-hidden>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <span>1705, 19th Main Road, HSR Layout, Bengaluru 560102</span>
                </li>
                <li>
                  <span className="site-footer__contact-icon" aria-hidden>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.28h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.09a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 15.43v1.49z" />
                    </svg>
                  </span>
                  <span>+91 779 550 0937</span>
                </li>
                <li>
                  <span className="site-footer__contact-icon" aria-hidden>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <span>support@nattlabs.com</span>
                </li>
                <li>
                  <span className="site-footer__contact-icon" aria-hidden>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                  <span>
                    Mon–Fri: 9 AM–6 PM
                    <br />
                    Sat: 10 AM–4 PM
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="site-footer__bar">
        <div className="site-footer__bar-inner">
          <span className="site-footer__copy">&copy; 2026 SaarthiX. All rights reserved.</span>
          <div className="site-footer__bar-links">
            <Link href={to("/about-us#privacy")} className="site-footer__bar-link">
              Privacy Policy
            </Link>
            <Link href={to("/about-us#privacy")} className="site-footer__bar-link">
              Terms of Service
            </Link>
            <Link href={to("/contact")} className="site-footer__bar-link">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
