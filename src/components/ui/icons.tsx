import type { SVGProps } from 'react';

/** Small hand-drawn inline icon set (24px grid, 1.75 stroke). No icon library. */
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Base({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconPhone = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  </Base>
);

export const IconWhatsApp = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6Z" />
    <path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.4.5c-.1.1-.1.3 0 .5a5 5 0 0 0 2.3 2.1c.2.1.4.1.5-.1l.5-.6c.1-.2.4-.2.6-.1l1.4.7c.2.1.3.3.3.5 0 .7-.5 1.5-1.4 1.6-1.2.2-2.7-.3-4.2-1.6s-2.2-2.8-2.1-3.9c0-.6.2-1.1.2-1.2Z" />
  </Base>
);

export const IconMapPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="m15 6-6 6 6 6" />
  </Base>
);

export const IconChevronUp = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 15 6-6 6 6" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.2 4.2L19 7" />
  </Base>
);

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Base>
);

export const IconGear = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    <circle cx="12" cy="12" r="6.5" />
  </Base>
);

export const IconWrench = (p: IconProps) => (
  <Base {...p}>
    <path d="M14.7 6.3a4 4 0 0 0 5 5L13 18a2.1 2.1 0 1 1-3-3l6.7-6.7Z" />
    <path d="M14.7 6.3 17 4l3 3-2.3 2.3" />
  </Base>
);

export const IconBox = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" />
    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
  </Base>
);

export const IconImage = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 16-5-5-8.5 8.5" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  </Base>
);

export const IconStar = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8Z" />
  </Base>
);

export const IconExternal = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />
  </Base>
);

export const IconLogout = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14M10 16.5 5.5 12 10 7.5M5.5 12H15" />
  </Base>
);

export const IconDashboard = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="7" height="9" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1" />
    <rect x="3.5" y="15.5" width="7" height="5" rx="1" />
  </Base>
);

export const IconMotorcycle = (p: IconProps) => (
  <Base {...p}>
    <circle cx="5.5" cy="16" r="3.5" />
    <circle cx="18.5" cy="16" r="3.5" />
    <path d="M5.5 16 9 10h5l2.5 6M14 10l1-3h3M9 10l-1.5-2.5H5" />
  </Base>
);

export const IconTag = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.4 1.4 0 0 1 0 2l-7.1 7.1a1.4 1.4 0 0 1-2 0Z" />
    <circle cx="8" cy="8" r="1.4" />
  </Base>
);

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4 2.8 19.5h18.4Z" />
    <path d="M12 10v4M12 17v.01" />
  </Base>
);

export const IconFilter = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Base>
);

export const IconCart = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 4h2.2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2" />
    <circle cx="9.5" cy="19.5" r="1.3" />
    <circle cx="17" cy="19.5" r="1.3" />
  </Base>
);
