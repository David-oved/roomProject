/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** מוזרק ע"י vite.config.ts מתוך public/version.json בזמן ה-build. */
declare const __APP_VERSION__: string;
/** חותמת זמן ה-build (ISO). */
declare const __BUILD_TIME__: string;
/** מזהה בנייה ייחודי (git SHA) — מזהה פריסה גם בלי שינוי מספר גרסה. */
declare const __BUILD_ID__: string;
/** המפתח הציבורי של VAPID — אינו סוד. */
declare const __VAPID_PUBLIC_KEY__: string;

interface ImportMetaEnv {
  readonly VITE_FB_API_KEY?: string;
  readonly VITE_FB_AUTH_DOMAIN?: string;
  readonly VITE_FB_DATABASE_URL?: string;
  readonly VITE_FB_PROJECT_ID?: string;
  readonly VITE_FB_STORAGE_BUCKET?: string;
  readonly VITE_FB_MSG_SENDER_ID?: string;
  readonly VITE_FB_APP_ID?: string;
  readonly VITE_USE_EMULATORS?: string;
  /** כתובת ה-Worker לשליחה מיידית. ריק = רק המשימה המתוזמנת. */
  readonly VITE_PUSH_ENDPOINT?: string;
  /** Cloudinary — אחסון תמונות פרופיל. אינו סוד, ראו avatarService.ts */
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  /** שם ה-unsigned upload preset בחשבון Cloudinary */
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * VirtualKeyboard API — כרגע רק בדפדפני Chromium (אנדרואיד/דסקטופ עם מגע).
 * כשמופעל, המקלדת "צפה" מעל התוכן במקום לכווץ את ה-layout viewport.
 * ראו שימוש ב-ChatConversationPage.
 */
interface Navigator {
  virtualKeyboard?: {
    overlaysContent: boolean;
    boundingRect: DOMRect;
    addEventListener(type: 'geometrychange', listener: () => void): void;
    removeEventListener(type: 'geometrychange', listener: () => void): void;
  };
}
