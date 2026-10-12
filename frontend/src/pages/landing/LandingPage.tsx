import { MotionConfig } from 'framer-motion';
import '@/styles/landing.css';
import { ScrollProgress } from './motion/ScrollProgress';
import { SiteHeader } from './sections/SiteHeader';
import { Hero } from './sections/Hero';
import { Intro } from './sections/Intro';
import { NetworkSection } from './sections/NetworkSection';
import { Monitoring } from './sections/Monitoring';
import { FaultSequence } from './sections/FaultSequence';
import { Maintenance } from './sections/Maintenance';
import { Capabilities } from './sections/Capabilities';
import { Product } from './sections/Product';
import { FinalCta } from './sections/FinalCta';
import { SiteFooter } from './sections/SiteFooter';

/**
 * Public landing page. Editorial layout, original line-art, motion bound to scroll.
 * Every number on the page comes from the public (simulated) network preview feed.
 * `reducedMotion="user"` makes Framer Motion honour the OS setting globally; components
 * also branch on useReducedMotion() to drop reveals, parallax and scroll pinning.
 */
export default function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="pp-landing min-h-screen">
        <a href="#main" className="pp-skip pp-label">
          Skip to content
        </a>
        <ScrollProgress />
        <SiteHeader />
        <main id="main" tabIndex={-1} className="outline-none">
          <Hero />
          <Intro />
          <NetworkSection />
          <Monitoring />
          <FaultSequence />
          <Maintenance />
          <Capabilities />
          <Product />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
