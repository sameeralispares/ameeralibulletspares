'use client';

import { ShopImage } from '@/components/shop-image';
import { useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';

type GalleryImage = { src: string; alt: string };

/**
 * Swipeable product gallery: scroll-snap on touch devices, arrow buttons and
 * thumbnails for everyone. No library.
 */
export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function go(i: number) {
    const idx = (i + images.length) % images.length;
    setActive(idx);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    if (idx !== active) setActive(idx);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="scrollbar-none flex aspect-square snap-x snap-mandatory overflow-x-auto sm:aspect-[4/3.4]"
          role="region"
          aria-roledescription="carousel"
          aria-label="Product photos"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(active + 1);
            if (e.key === 'ArrowLeft') go(active - 1);
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.src}
              className="relative h-full w-full shrink-0 snap-center"
              role="group"
              aria-roledescription="slide"
              aria-label={`Photo ${i + 1} of ${images.length}`}
            >
              <ShopImage
  src={img.src}
                alt={img.alt}
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-contain p-4"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(active - 1)}
              className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow ring-1 ring-graphite-900/10 hover:bg-white"
              aria-label="Previous photo"
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow ring-1 ring-graphite-900/10 hover:bg-white"
              aria-label="Next photo"
            >
              <IconChevronRight />
            </button>
            <p className="absolute bottom-2 right-3 rounded bg-ink/75 px-2 py-0.5 font-mono text-xs text-ivory-50">
              {active + 1} / {images.length}
            </p>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {images.map((img, i) => (
            <li key={img.src} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === active}
                className={`relative block h-16 w-16 overflow-hidden rounded border-2 bg-white sm:h-20 sm:w-20 ${
                  i === active ? 'border-bronze-500' : 'border-transparent ring-1 ring-graphite-900/10'
                }`}
              >
                <ShopImage src={img.src} alt="" fill sizes="80px" className="object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
