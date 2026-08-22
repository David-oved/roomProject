/**
 * אייקונים כ-SVG מוטבע.
 * ספריית אייקונים שלמה שוקלת 40–80KB; כאן משלמים רק על מה שמשתמשים בו.
 */
import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean };

const base = (p: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: p.filled ? 2.4 : 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8" />
  </svg>
);

export const CartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3.5h2.2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h9a1.5 1.5 0 0 0 1.5-1.2l1.4-7.2H6" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const WalletIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v1.5" />
    <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
    <path d="M16.5 13.5h.01" />
  </svg>
);

export const UsersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 20a6 6 0 0 0-2.2-4.6" />
  </svg>
);

export const CheckDoubleIcon = (p: IconProps) => (
  <svg {...base(p)} viewBox="0 0 28 24">
    <path d="M2 12.5l4.5 4.5L15 8" />
    <path d="M11 12.5l4.5 4.5L26 6" />
  </svg>
);

export const ChatIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    <path d="M8 8.5h8M8 11.5h5" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </svg>
);

export const ChevronIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={2.4}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const OfflineIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18" />
    <path d="M8.6 15.4a5 5 0 0 1 6.8 0" />
    <path d="M5 12a10 10 0 0 1 3.4-2.3M19 12a10 10 0 0 0-6.6-2.9" />
    <path d="M12 19h.01" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);

export const LogoutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </svg>
);

export const CopyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </svg>
);

export const ShareIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v13" />
    <path d="M8 7l4-4 4 4" />
    <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </svg>
);

export const RefreshIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4.5h-4.5" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.4 5.9A9.3 9.3 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7" />
    <path d="M6.3 7.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.8-.5" />
  </svg>
);

export const CameraIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h2.5l1.3-2h8.4l1.3 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.3" />
  </svg>
);

export const ExchangeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 10 3 6l4-4" />
    <path d="M3 6h12a4 4 0 0 1 4 4" />
    <path d="M17 14l4 4-4 4" />
    <path d="M21 18H9a4 4 0 0 1-4-4" />
  </svg>
);

/** אייקוני קטגוריה — קו דק, לשימוש במקומות שמבקשים חלופה לאימוג'י (למשל לוח הבית) */
export const KitchenIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 3s.5 5.5 4.5 5.5S13 3 13 3" />
    <path d="M8.5 8.5V21" />
    <path d="M17 3v8a3 3 0 0 0 6 0V3M20 3v18" />
  </svg>
);

export const BathroomIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 21V9a5 5 0 0 1 10 0v12" />
    <path d="M7 14h10" />
  </svg>
);

export const CleaningIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 3s1 6 5 6 5-6 5-6" />
    <path d="M8 9v12" />
    <path d="M17 3v18M14 3v6a3 3 0 0 0 6 0V3" />
  </svg>
);

export const BoxIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="8" width="16" height="12" rx="1.5" />
    <path d="M8 8V6a4 4 0 0 1 8 0v2" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16" />
    <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    <path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const ChecklistIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6l1.3 1.3L7.5 5" />
    <path d="M4 12l1.3 1.3 2.2-2.3" />
    <path d="M4 18l1.3 1.3 2.2-2.3" />
  </svg>
);

export const MegaphoneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 10v4a1 1 0 0 0 1 1h2l1 5h2l-1-5h1l9 4V6l-9 4H4a1 1 0 0 0-1 1v0Z" />
    <path d="M19 9.5a3.5 3.5 0 0 1 0 5" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════
   אייקוני החלפה לאימוג'י — קו דק בלבד, בלי מילוי צבע, כדי שכל
   הסמלים באפליקציה יהיו עקביים (currentColor, אותו סגנון).
   ═══════════════════════════════════════════════════════════ */

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <path d="M12 7.5h.01" />
  </svg>
);

export const WarningIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4 3 20h18L12 4Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const StopIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z" />
    <path d="M12 8v5" />
    <path d="M12 16h.01" />
  </svg>
);

export const WrenchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6Z" />
  </svg>
);

export const MailIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

export const SunIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
  </svg>
);

export const ContrastIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
  </svg>
);

export const DeviceIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </svg>
);

export const DesktopIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);

export const KeyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M11 12 20 3M17 6l2 2M14 9l2 2" />
  </svg>
);

export const DoorIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="18" rx="1" />
    <path d="M14.5 12h.01" />
  </svg>
);

export const BanIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.5 5.5l13 13" />
  </svg>
);

export const CompassIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.5 9.5 13 13l-3.5 1.5L11 11l3.5-1.5Z" />
  </svg>
);

export const BasketIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 10h16l-1.5 9a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 10Z" />
    <path d="M8 10 9 5h6l1 5" />
    <path d="M9 13.5v3M12 13.5v3M15 13.5v3" />
  </svg>
);

export const SparklesIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 2c.6 3.6 2.4 6 6 6.6-3.6.6-5.4 3-6 6.6-.6-3.6-2.4-6-6-6.6 3.6-.6 5.4-3 6-6.6Z" />
  </svg>
);

export const WaveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 13V6a1.5 1.5 0 0 1 3 0v5" />
    <path d="M10 11V4.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M13 11V6a1.5 1.5 0 0 1 3 0v7" />
    <path d="M16 12V9a1.5 1.5 0 0 1 3 0v6c0 3.5-2.5 6-6 6h-1c-2 0-3-.7-4.2-2.2L4 14.5c-.6-.8-.4-1.8.4-2.2.7-.4 1.5-.2 2 .4L8 14" />
  </svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z" />
  </svg>
);

export const HeartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 20s-7-4.4-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z" />
  </svg>
);

export const BugIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="7" y="8" width="10" height="9" rx="4" />
    <path d="M12 8V5M9 5l1.5 2M15 5l-1.5 2" />
    <path d="M4 11h3M4 15h3M17 11h3M17 15h3" />
    <path d="M9 17.5 8 21M15 17.5l1 3.5" />
  </svg>
);

export const QuestionIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.2 1-1.2 2" />
    <path d="M12 17h.01" />
  </svg>
);

export const LightbulbIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
  </svg>
);

export const NoteIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v4h5" />
    <path d="M8 12h7M8 15.5h7" />
  </svg>
);

export const ArchiveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="4.5" rx="1" />
    <path d="M4.5 8.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V8.5" />
    <path d="M10 13h4" />
  </svg>
);

export const GraduationCapIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4 2 9l10 5 10-5-10-5Z" />
    <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
  </svg>
);

export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20 20l-4.8-4.8" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
