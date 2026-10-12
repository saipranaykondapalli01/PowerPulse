import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { RevealLines } from '../motion/RevealLines';
import { TransformerIllustration } from '../illustrations/TransformerIllustration';
import { Cta, scrollToHash } from '../ui';
import { DUR_SLOW, EASE_REVEAL } from '../motion/tokens';

const SUPPORT = ['Intelligent transformer monitoring.', 'A clearer view of network health.', 'Maintenance before the unexpected.'];

export function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  // Subtle parallax: the drawing drifts up slower than the page. Disabled with reduced motion.
  const y = useTransform(scrollY, [0, 900], [0, reduce ? 0 : -90]);
  const fadeIn = (delay: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: DUR_SLOW, ease: EASE_REVEAL, delay } };

  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden pb-16 pt-[calc(var(--header-h)+2.5rem)] md:pb-24">
      <div className="container-content">
        <motion.div
          {...fadeIn(0.1)}
          className="pp-label mb-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-ink/15 pb-4 text-muted md:mb-14"
        >
          <span>PowerPulse / Transformer monitoring</span>
          <span className="hidden sm:inline">Rule-based fault detection</span>
          <span>Simulated sensor network</span>
        </motion.div>

        <RevealLines
          as="h1"
          id="hero-title"
          onMount
          delay={0.15}
          className="pp-display text-display-xl"
          lines={['SEE THE FAULT.', 'BEFORE THE FAILURE.']}
          lineClassNames={[undefined, 'md:pl-[14%]']}
        />

        <div className="mt-12 grid grid-cols-1 gap-12 md:mt-16 md:grid-cols-12 md:gap-8">
          <div className="flex flex-col gap-10 md:col-span-5 lg:col-span-4">
            <motion.p {...fadeIn(0.6)} className="pp-lead max-w-[26rem] text-ink">
              {SUPPORT.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </motion.p>
            <motion.div {...fadeIn(0.75)} className="flex flex-col items-stretch gap-3 sm:flex-row md:flex-col md:items-start 2xl:flex-row">
              <Cta href="#network" onClick={(e) => scrollToHash(e, reduce)} tone="solid">
                EXPLORE THE NETWORK
              </Cta>
              <Cta to="/demo" tone="outline">
                VIEW LIVE DEMO
              </Cta>
            </motion.div>
          </div>

          <motion.figure style={{ y }} className="relative md:col-span-7 md:col-start-6 lg:col-span-8 lg:col-start-5">
            <TransformerIllustration className="h-auto w-full text-ink" />
            <figcaption className="pp-label mt-3 flex justify-between text-muted">
              <span>Fig. 01 — Pole-mounted distribution transformer</span>
              <span className="hidden sm:inline">Original line drawing</span>
            </figcaption>
          </motion.figure>
        </div>
      </div>
    </section>
  );
}
