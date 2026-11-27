/**
 * Original line drawings used on the model cards.
 *
 * These are drawn here from scratch: generic motorcycle body styles (classic
 * roadster, cruiser, street, adventure, café racer, parallel twin), not copies
 * of any manufacturer's photography or styling. They stand in until the shop
 * uploads its own photographs, which then replace the drawing.
 *
 * Geometry: viewBox 240 x 120, axle line at y = 82, front wheel at x = 50.
 */

type Art = {
  /** Rear axle position: a cruiser is longer, a street bike shorter. */
  rearX: number;
  wheelR: number;
  /** Vertical shift of everything above the wheels. */
  lift: number;
  tank: string;
  seat: string;
  engine: string;
  frame: string;
  fork: string;
  /** Steering column from the top of the fork up to the handlebar. */
  stem: string;
  bars: string;
  lamp: { cx: number; cy: number; r: number };
  frontFender: string;
  rearFender: string;
  exhaust: string;
  /** Rack, beak, cowl — whatever makes the style read. */
  extra?: string;
  knobbly?: boolean;
};

const FRONT_X = 50;
const AXLE_Y = 82;

const CLASSIC: Art = {
  rearX: 190,
  wheelR: 26,
  lift: 0,
  tank: 'M96 63c0-13 14-20 34-18l16 2c7 2 7 14 0 17h-44c-5 0-6-1-6-1Z',
  seat: 'M148 50c12-4 28-4 38 1l2 7h-28c-8 0-11-3-12-8Z',
  engine: 'M102 64h34l6 18h-44Z',
  frame: 'M88 42 148 53M88 46 104 68',
  fork: 'M50 82 86 50',
  stem: 'M86 50 88 32',
  bars: 'M76 32h26',
  lamp: { cx: 74, cy: 43, r: 9 },
  frontFender: 'M22 80A28 28 0 0 1 78 80',
  rearFender: 'M162 80A28 28 0 0 1 218 80',
  exhaust: 'M140 78c24 3 48 2 70-3',
};

const CRUISER: Art = {
  rearX: 198,
  wheelR: 26,
  lift: 2,
  tank: 'M94 64c0-15 16-23 38-20l16 2c8 2 8 16 0 19h-48c-5 0-6-1-6-1Z',
  // Low, stepped seat.
  seat: 'M150 54c14-6 32-5 42 1l2 7h-30c-9 0-13-3-14-8Z',
  engine: 'M100 65h36l7 17h-48Z',
  frame: 'M86 44 150 57M86 48 102 69',
  fork: 'M50 82 84 50',
  stem: 'M84 50 86 32',
  // Pulled-back bars.
  bars: 'M72 30q16-6 30 2',
  lamp: { cx: 71, cy: 42, r: 10 },
  frontFender: 'M20 80A30 30 0 0 1 80 80',
  rearFender: 'M166 80A32 32 0 0 1 230 80',
  exhaust: 'M142 79c26 4 52 2 76-3',
};

const STREET: Art = {
  rearX: 184,
  wheelR: 25,
  lift: 0,
  tank: 'M100 62c0-11 12-17 30-15l14 2c6 2 6 12 0 15h-38c-4 0-6-1-6-2Z',
  seat: 'M146 49c11-3 24-3 32 1l2 7h-24c-7 0-9-3-10-8Z',
  engine: 'M104 63h30l5 19h-40Z',
  frame: 'M90 42 146 52M90 45 106 67',
  fork: 'M50 82 88 50',
  stem: 'M88 50 90 31',
  bars: 'M78 31h24',
  lamp: { cx: 77, cy: 43, r: 8 },
  frontFender: 'M26 80A24 24 0 0 1 74 80',
  rearFender: 'M160 80A24 24 0 0 1 208 80',
  exhaust: 'M136 78c22 3 44 2 64-2',
};

const ADVENTURE: Art = {
  rearX: 190,
  wheelR: 27,
  lift: -8,
  tank: 'M98 62c0-13 14-20 32-18l16 2c7 2 7 14 0 16h-42c-5 0-6-1-6 0Z',
  seat: 'M148 48c13-3 28-2 38 2l2 7h-28c-8 0-11-4-12-9Z',
  engine: 'M104 62h32l6 18h-42Z',
  frame: 'M90 40 148 50M90 44 106 66',
  fork: 'M50 82 88 46',
  stem: 'M88 46 90 26',
  // Tall, wide bars.
  bars: 'M74 26h30',
  lamp: { cx: 77, cy: 38, r: 9 },
  // Mudguard held high, clear of the tyre.
  frontFender: 'M24 68A26 26 0 0 1 76 68',
  rearFender: 'M162 78A28 28 0 0 1 218 78',
  exhaust: 'M140 76c22 2 44 0 64-4',
  // Luggage rack and front beak.
  extra: 'M162 46h34v5h-34ZM92 48q14 2 20 10',
  knobbly: true,
};

const CAFE: Art = {
  rearX: 186,
  wheelR: 25,
  lift: 1,
  // Long, slim tank.
  tank: 'M94 62c0-14 16-21 38-19l18 2c7 2 7 14 0 17h-50c-5 0-6-1-6 0Z',
  // Seat with a rear hump.
  seat: 'M152 54c12-9 26-11 34-4 6 5 5 12 2 15h-24c-7 0-11-4-12-11Z',
  engine: 'M100 63h34l6 19h-44Z',
  frame: 'M88 44 152 57M88 47 104 68',
  fork: 'M50 82 86 56',
  stem: 'M86 56 87 48',
  // Low clip-on bars.
  bars: 'M76 48h22',
  lamp: { cx: 74, cy: 54, r: 9 },
  frontFender: 'M26 80A24 24 0 0 1 74 80',
  rearFender: 'M162 80A24 24 0 0 1 210 80',
  exhaust: 'M138 78c22 4 46 3 66-2',
};

const TWIN: Art = {
  rearX: 192,
  wheelR: 26,
  lift: 0,
  tank: 'M94 63c0-14 16-21 36-19l16 2c7 2 7 14 0 17h-46c-5 0-6-1-6 0Z',
  seat: 'M148 50c13-4 29-3 39 1l2 7h-29c-8 0-11-3-12-8Z',
  // Wider engine for the parallel twin.
  engine: 'M100 64h38l6 18h-48Z',
  frame: 'M88 43 148 53M88 46 102 68',
  fork: 'M50 82 86 51',
  stem: 'M86 51 88 33',
  bars: 'M76 33h26',
  lamp: { cx: 74, cy: 44, r: 9 },
  frontFender: 'M22 80A28 28 0 0 1 78 80',
  rearFender: 'M164 80A28 28 0 0 1 220 80',
  // Two pipes.
  exhaust: 'M142 76c24 3 48 2 70-3M142 84c24 3 46 2 68-3',
};

const ART_BY_STYLE = {
  classic: CLASSIC,
  cruiser: CRUISER,
  street: STREET,
  adventure: ADVENTURE,
  cafe: CAFE,
  twin: TWIN,
} as const;

export type ModelArtStyle = keyof typeof ART_BY_STYLE;

/** Which drawing suits each model; anything unknown gets the classic. */
const STYLE_BY_SLUG: Record<string, ModelArtStyle> = {
  bullet: 'classic',
  classic: 'classic',
  electra: 'classic',
  standard: 'classic',
  thunderbird: 'cruiser',
  'meteor-350': 'cruiser',
  'super-meteor-650': 'cruiser',
  'shotgun-650': 'cruiser',
  'hunter-350': 'street',
  himalayan: 'adventure',
  scram: 'adventure',
  'guerrilla-450': 'adventure',
  'interceptor-650': 'twin',
  'continental-gt-650': 'cafe',
  'other-newer-models': 'street',
};

export function modelArtStyle(slug: string): ModelArtStyle {
  return STYLE_BY_SLUG[slug] ?? 'classic';
}

/**
 * The drawing itself. Decorative: the card already names the model, so it is
 * hidden from screen readers.
 */
export function ModelArt({ slug, className = '' }: { slug: string; className?: string }) {
  const art = ART_BY_STYLE[modelArtStyle(slug)];

  return (
    <svg
      viewBox="0 0 240 120"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-model-art={modelArtStyle(slug)}
    >
      {[FRONT_X, art.rearX].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={AXLE_Y} r={art.wheelR} strokeWidth={5} />
          {art.knobbly && (
            <circle cx={cx} cy={AXLE_Y} r={art.wheelR} strokeWidth={8} opacity={0.3} strokeDasharray="3 8" />
          )}
          <circle cx={cx} cy={AXLE_Y} r={art.wheelR - 10} strokeWidth={1.5} opacity={0.5} />
          <circle cx={cx} cy={AXLE_Y} r={2.5} strokeWidth={1.5} opacity={0.7} />
        </g>
      ))}

      <g transform={`translate(0 ${art.lift})`}>
        <path d={art.frontFender} strokeWidth={3} opacity={0.6} />
        <path d={art.rearFender} strokeWidth={3} opacity={0.6} />
        <path d={art.frame} strokeWidth={2.5} opacity={0.7} />
        <path d={art.engine} strokeWidth={2.5} fill="currentColor" fillOpacity={0.14} />
        <path d={art.exhaust} strokeWidth={3.5} opacity={0.8} />
        <path d={art.fork} strokeWidth={3.5} />
        <path d={art.stem} strokeWidth={3} opacity={0.85} />
        <path d={art.bars} strokeWidth={3.5} />
        <circle cx={art.lamp.cx} cy={art.lamp.cy} r={art.lamp.r} strokeWidth={3} fill="currentColor" fillOpacity={0.1} />
        <path d={art.tank} strokeWidth={3} fill="currentColor" fillOpacity={0.18} />
        <path d={art.seat} strokeWidth={3} fill="currentColor" fillOpacity={0.18} />
        {art.extra && <path d={art.extra} strokeWidth={2.5} opacity={0.75} />}
      </g>
    </svg>
  );
}
