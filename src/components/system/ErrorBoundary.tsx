import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '../ui/EmptyState';

/**
 * ═══════════════════════════════════════════════════════════════
 *  גבול שגיאה — הרשת האחרונה לפני מסך לבן
 * ═══════════════════════════════════════════════════════════════
 *
 *  ‼️ בלי זה, כל חריגה בזמן רינדור מפילה את כל עץ React, ומה שנשאר
 *  למשתמש הוא מסך לבן לגמרי — בלי טקסט, בלי כפתור, בלי דרך לצאת.
 *
 *  פתח המילוט שב-index.html לא עוזר כאן: הוא מוצג רק כל עוד
 *  #boot-splash עדיין קיים ב-DOM, וברגע ש-React הצליח לעלות פעם
 *  אחת הוא כבר הוסר. כלומר בדיוק במקרה הנפוץ — קריסה *אחרי* טעינה
 *  מוצלחת — אין שום מנגנון שתופס את הנפילה.
 *
 *  מכאן גם השימוש ב-ErrorState הקיים ולא בעיצוב חדש: המשתמש מקבל את
 *  אותה שפה ואת אותו כפתור "נסה שוב" שהוא מכיר משאר האפליקציה.
 */

interface Props {
  children: ReactNode;
  /** מה לעשות ב"נסה שוב". ברירת מחדל: לאפס את הגבול ולנסות לרנדר שוב. */
  onReset?: () => void;
  /** משתנה בכל מעבר מסך — איפוס אוטומטי כך שניווט מוציא מהמצב התקוע */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // אין שירות ניטור באפליקציה; בפיתוח לפחות שהשגיאה תהיה קריאה בקונסול
    if (import.meta.env.DEV) console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // ניווט למסך אחר מנקה את השגיאה — אחרת מסך שקרס נשאר קרוס לנצח
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="mx-auto max-w-md px-5 py-10">
        <ErrorState
          message={
            'המסך הזה נתקל בתקלה בלתי צפויה ולא הצליח להיטען. ' +
            'אפשר לנסות שוב — שאר האפליקציה ממשיכה לעבוד.'
          }
          onRetry={this.reset}
        />
      </div>
    );
  }
}

/** גבול הגג של האפליקציה: אין לאן לנווט חזרה, ולכן "נסה שוב" = רענון. */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('RootErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5"
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      >
        <ErrorState
          message="האפליקציה נתקלה בתקלה בלתי צפויה. רענון הדף אמור לפתור את זה."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
}
