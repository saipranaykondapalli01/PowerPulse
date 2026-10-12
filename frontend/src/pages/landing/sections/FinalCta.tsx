import { RevealLines } from '../motion/RevealLines';
import { Reveal } from '../motion/Reveal';
import { Cta } from '../ui';

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="pp-section bg-ink text-paper">
      <div className="container-content grid grid-cols-1 gap-y-14 md:grid-cols-12 md:gap-x-8">
        <p className="pp-label flex items-center gap-3 text-paper/60 md:col-span-12">
          <span aria-hidden="true" className="h-1.5 w-1.5 bg-accent" />
          End of transmission
        </p>
        <RevealLines
          id="final-title"
          className="pp-display text-display-xl md:col-span-12"
          lines={['SEE WHAT IS', 'HAPPENING OUT THERE.']}
          lineClassNames={[undefined, 'md:pl-[8%]']}
        />
        <Reveal className="flex flex-col gap-10 md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-8">
          <p className="pp-lead text-paper/80">
            <span className="block">One network. Clearer signals.</span>
            <span className="block">Better-informed maintenance decisions.</span>
          </p>
          <div>
            <Cta to="/dashboard" tone="inverse" className="w-full sm:w-auto">
              ENTER POWERPULSE
            </Cta>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
