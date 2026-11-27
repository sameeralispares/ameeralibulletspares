import { ImageResponse } from 'next/og';
import { BADGE_OG_DATA_URI } from '@/lib/brand-badge-og';

export const alt = 'S Ameer Ali Bullet Spare Parts — genuine Royal Enfield spare parts, Pudupet, Chennai';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Default social-share image with the shop's badge. The badge is embedded, so
 * rendering needs no file read (Workers has no filesystem) and no network call.
 */
export default async function OpengraphImage() {
  const badge = BADGE_OG_DATA_URI;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#17181b',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          padding: '72px',
          color: '#f5f0e6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={badge} width={150} height={168} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '2px' }}>S AMEER ALI</div>
            <div style={{ fontSize: '22px', color: '#d8b886', letterSpacing: '5px' }}>BULLET SPARE PARTS · CHENNAI</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '76px', fontWeight: 700, lineHeight: 1.05 }}>Genuine Royal Enfield</div>
          <div style={{ fontSize: '76px', fontWeight: 700, lineHeight: 1.05, color: '#c49a5f' }}>spare parts</div>
          <div style={{ marginTop: '28px', fontSize: '28px', color: '#ebe3d3' }}>
            Venkatachalan Naicken Street, Pudupet, Chennai · +91 96770 93315
          </div>
        </div>
      </div>
    ),
    size,
  );
}
