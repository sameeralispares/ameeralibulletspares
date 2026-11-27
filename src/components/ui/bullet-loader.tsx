/**
 * Loading indicator for route transitions: a Royal Enfield Bullet-style
 * motorcycle with a gear turning over the engine. Built from the same 24px
 * geometry as the icon set (IconGear, IconMotorcycle). The gear only spins when
 * the visitor has not asked for reduced motion.
 */
export function BulletGearLoader({ label, tone = 'light' }: { label: string; tone?: 'light' | 'dark' }) {
  const ink = tone === 'dark' ? 'text-ivory-50' : 'text-graphite-900';
  const muted = tone === 'dark' ? 'text-ivory-200/85' : 'text-stone-600';
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center gap-3 ${muted}`}>
      <svg
        viewBox="0 0 48 32"
        className={`h-16 w-24 ${ink}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {/* wheels */}
        <circle cx="10" cy="23" r="6" />
        <circle cx="38" cy="23" r="6" />
        {/* frame, tank and handlebar */}
        <path d="M10 23 16 14h11l6 9M27 14l2-6h5M16 14l-2.5-4H9" />
        {/* the gear over the engine, turning */}
        <svg x="19" y="5" width="12" height="12" viewBox="0 0 24 24" className="motion-safe:animate-spin">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
          <circle cx="12" cy="12" r="6.5" />
        </svg>
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
