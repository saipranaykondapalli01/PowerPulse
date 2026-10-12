import { motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from '../motion/tokens';

/**
 * Original line-art drawing of a pole-mounted distribution transformer feeding a small
 * substation, annotated like an engineering sheet. The strokes draw in once on load.
 * Purely illustrative: no readings, no values.
 */

// Structural strokes, drawn in sequence (pole → tank → bushings → leads → network).
const STRUCTURE: string[] = [
  // ground + pole
  'M0 600 H720',
  'M250 36 V600 M262 36 V600',
  // crossarm
  'M150 78 H362 M150 88 H362 M206 88 L256 120 M306 88 L256 120',
  // pin insulators
  'M170 78 V58 M164 74 H176 M164 68 H176 M164 62 H176',
  'M256 78 V58 M250 74 H262 M250 68 H262 M250 62 H262',
  'M342 78 V58 M336 74 H348 M336 68 H348 M336 62 H348',
  // tank, lid, mounting brackets
  'M120 250 H240 V400 H120 Z',
  'M112 240 H248 V250 H112 Z',
  'M240 262 H250 M240 384 H250',
  // radiator fins
  'M92 262 H120 M92 388 H120 M95 262 V388 M100 262 V388 M105 262 V388 M110 262 V388 M115 262 V388',
  // HV bushings
  'M135 240 V214 H145 V240 M132 231 H148 M132 223 H148 M140 214 V204',
  'M175 240 V214 H185 V240 M172 231 H188 M172 223 H188 M180 214 V204',
  'M215 240 V214 H225 V240 M212 231 H228 M212 223 H228 M220 214 V204',
  // drop leads to insulators
  'M140 204 C140 150 166 120 170 58',
  'M180 204 C188 150 248 120 256 58',
  'M220 204 C236 150 334 120 342 58',
  // LV bushings + service cables
  'M146 400 V414 M180 400 V414 M214 400 V414',
  'M146 414 C146 470 110 500 30 512',
  'M180 414 C180 480 150 520 60 540',
  'M214 414 C214 500 190 548 96 566',
  // overhead line to the left
  'M0 52 C60 62 120 62 170 58',
  // overhead feeders to the substation
  'M342 58 C430 70 520 200 548 430',
  'M342 58 C450 64 560 190 604 430',
  'M342 58 C470 58 600 180 660 430',
  // substation gantry + busbar + equipment
  'M528 430 H680 M536 430 V600 M672 430 V600 M548 430 V444 M604 430 V444 M660 430 V444',
  'M536 470 H672',
  'M556 520 H596 V574 H556 Z M612 520 H652 V574 H612 Z M576 470 V520 M632 470 V520',
  // fence
  'M500 584 H708 M500 584 V600 M510 584 V600 M520 584 V600 M530 584 V600 M690 584 V600 M700 584 V600 M708 584 V600',
];

// Detail strokes on the tank: oil gauge, sensor, tap changer, nameplate.
const DETAIL: string[] = [
  'M166 300 A14 14 0 1 0 194 300 A14 14 0 1 0 166 300 M180 300 L188 292',
  'M222 256 H234 V266 H222 Z',
  'M222 366 A8 8 0 1 0 238 366 A8 8 0 1 0 222 366 M230 366 V359',
  'M130 266 H164 V290 H130 Z M134 274 H158 M134 282 H150',
];

interface Note {
  label: string;
  sub: string;
  /** Leader polyline from the anchor point on the drawing to the label. */
  d: string;
  x: number;
  y: number;
  anchor?: 'start' | 'end';
}

const NOTES: Note[] = [
  { label: 'OIL TEMP', sub: 'TOP-OIL SENSOR · °C', d: 'M234 258 L300 214 H420', x: 300, y: 206 },
  { label: 'OIL LEVEL', sub: 'GAUGE · %', d: 'M194 300 H420', x: 300, y: 292 },
  { label: 'TAP POS', sub: 'OFF-LOAD CHANGER', d: 'M238 366 L300 380 H420', x: 300, y: 372 },
  { label: 'kVA', sub: 'RATED · NAMEPLATE', d: 'M130 278 L70 214 H12', x: 12, y: 206 },
  { label: 'HV', sub: '3 × BUSHING', d: 'M128 223 L90 170 H12', x: 12, y: 162 },
  { label: 'LV', sub: 'SERVICE', d: 'M146 420 L70 452 H12', x: 12, y: 444 },
];

export function TransformerIllustration({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const draw = (i: number, base = 0.2) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: {
            pathLength: { duration: 1.4, ease: EASE_OUT, delay: base + i * 0.045 },
            opacity: { duration: 0.01, delay: base + i * 0.045 },
          },
        };
  const fade = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.6, delay } };

  return (
    <svg
      viewBox="0 0 720 640"
      className={className}
      role="img"
      aria-labelledby="fig-transformer-title fig-transformer-desc"
      fill="none"
    >
      <title id="fig-transformer-title">Technical drawing of a pole-mounted distribution transformer</title>
      <desc id="fig-transformer-desc">
        Line drawing of a transformer on a utility pole with high-voltage bushings, radiator fins, an oil-level gauge,
        a top-oil temperature sensor and a tap changer, connected by overhead feeders to a small substation.
      </desc>

      {/* Drafting grid */}
      <g stroke="currentColor" strokeOpacity="0.07" strokeWidth="1">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`v${i}`} d={`M${(i + 1) * 72} 0 V640`} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${(i + 1) * 80} H720`} />
        ))}
      </g>

      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" strokeLinejoin="miter">
        {STRUCTURE.map((d, i) => (
          <motion.path key={i} d={d} vectorEffect="non-scaling-stroke" {...draw(i)} />
        ))}
      </g>
      <g stroke="currentColor" strokeWidth="1.1">
        {DETAIL.map((d, i) => (
          <motion.path key={i} d={d} vectorEffect="non-scaling-stroke" {...draw(i, 1.1)} />
        ))}
      </g>

      {/* Energized marker: the one accent on the drawing */}
      <motion.rect x="224" y="258" width="8" height="6" fill="rgb(var(--accent))" stroke="currentColor" {...fade(1.6)} />

      {/* Annotations */}
      <motion.g {...fade(1.5)}>
        {NOTES.map((n) => (
          <g key={n.label}>
            <path d={n.d} stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={n.d.split(' ')[0].slice(1)} cy={n.d.split(' ')[1]} r="2.5" fill="currentColor" />
            <text x={n.x} y={n.y} className="pp-svg-label" fill="currentColor">
              {n.label}
            </text>
            <text x={n.x} y={n.y + 22} className="pp-svg-sub" fill="currentColor" fillOpacity="0.6">
              {n.sub}
            </text>
          </g>
        ))}
      </motion.g>

      {/* Title block */}
      <motion.g {...fade(1.8)} className="pp-svg-sub" fill="currentColor">
        <path d="M480 24 H708 V92 H480 Z M480 52 H708" fill="none" stroke="currentColor" strokeOpacity="0.4" vectorEffect="non-scaling-stroke" />
        <text x="490" y="43">FIG. 01 — DISTRIBUTION TX</text>
        <text x="490" y="72" fillOpacity="0.6">POLE MOUNT · FEEDER → SUBSTATION</text>
        <text x="490" y="86" fillOpacity="0.6">NOT TO SCALE</text>
      </motion.g>
    </svg>
  );
}
