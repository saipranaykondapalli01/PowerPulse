import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { scrollToHash } from '../ui';
import { NAV_LINKS } from './SiteHeader';

const linkCls = 'text-paper/75 transition-colors hover:text-paper';

export function SiteFooter() {
  const reduce = useReducedMotion();
  const year = new Date().getFullYear();
  const onAnchor = (e: React.MouseEvent<HTMLAnchorElement>) => scrollToHash(e, reduce);

  return (
    <footer id="about" aria-labelledby="about-title" className="border-t border-paper/15 bg-ink text-paper">
      <div className="container-content grid grid-cols-1 gap-12 py-20 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <h2 id="about-title" className="font-display text-display-sm font-semibold tracking-tight">
            PowerPulse
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-paper/70">
            A transformer monitoring, fault detection and maintenance platform. Faults are detected with transparent,
            rule-based thresholds on simulated sensor readings. There is no machine learning, and no real field devices
            are connected.
          </p>
        </div>

        <nav aria-label="Footer: product" className="md:col-span-2 md:col-start-7">
          <p className="pp-label mb-4 text-paper/50">Product</p>
          <ul className="space-y-2 text-sm">
            {NAV_LINKS.filter((l) => l.href !== '#about').map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={onAnchor} className={linkCls}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer: network" className="md:col-span-2">
          <p className="pp-label mb-4 text-paper/50">Network</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/grid" className={linkCls}>
                3D grid
              </Link>
            </li>
            <li>
              <Link to="/transformers" className={linkCls}>
                Transformers
              </Link>
            </li>
            <li>
              <Link to="/demo" className={linkCls}>
                Live demo
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Footer: access" className="md:col-span-2">
          <p className="pp-label mb-4 text-paper/50">Access</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/login" className={linkCls}>
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className={linkCls}>
                Dashboard
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="container-content flex flex-col gap-3 border-t border-paper/15 py-6 text-paper/50 sm:flex-row sm:justify-between">
        <p className="pp-label">© {year} PowerPulse</p>
        <p className="pp-label">Project build · All readings simulated · Rule-based detection</p>
        <a href="#top" onClick={onAnchor} className="pp-label hover:text-paper">
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}
