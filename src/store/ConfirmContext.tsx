import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';

/**
 * ═══════════════════════════════════════════════════════════════
 *  דיאלוגים בתוך האפליקציה — במקום confirm() ו-prompt() נייטיביים
 * ═══════════════════════════════════════════════════════════════
 *
 *  למה זה נבנה: confirm() ו-prompt() של הדפדפן חוסמים את כל הדף,
 *  אי אפשר לעצב אותם, והם נראים כמו תקלה בתוך PWA מותקנת. באייפון
 *  הם אף מציגים את כתובת האתר בכותרת — מה שהורס לגמרי את התחושה
 *  שמדובר באפליקציה.
 *
 *  שימוש:
 *    const confirm = useConfirm();
 *    if (await confirm({ title: 'למחוק?', danger: true })) { ... }
 *
 *    const reason = await confirm.prompt({ title: 'סיבת הדחייה' });
 *    if (reason !== null) { ... }   // null = המשתמש ביטל
 * ═══════════════════════════════════════════════════════════════
 */

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** דורש הקלדת המחרוזת הזו בדיוק לפני שהאישור נפתח — לפעולות הרסניות */
  requireTyping?: string;
}

interface PromptOptions {
  title: string;
  body?: ReactNode;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  /** אפשר לאשר גם בלי טקסט */
  optional?: boolean;
  maxLength?: number;
}

type ConfirmFn = ((opts: ConfirmOptions) => Promise<boolean>) & {
  prompt: (opts: PromptOptions) => Promise<string | null>;
};

const noop: ConfirmFn = Object.assign(() => Promise.resolve(false), {
  prompt: () => Promise.resolve<string | null>(null),
});

const Ctx = createContext<ConfirmFn>(noop);
export const useConfirm = () => useContext(Ctx);

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState('');
  const [typed, setTyped] = useState('');
  const pendingRef = useRef<Pending | null>(null);

  pendingRef.current = pending;

  const close = useCallback((result: boolean | string | null) => {
    const p = pendingRef.current;
    setPending(null);
    setText('');
    setTyped('');
    if (!p) return;
    if (p.kind === 'confirm') p.resolve(result === true);
    else p.resolve(typeof result === 'string' ? result : null);
  }, []);

  const ask = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setText('');
        setTyped('');
        setPending({ kind: 'confirm', opts, resolve });
      }),
    []
  );

  const askText = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setText('');
        setTyped('');
        setPending({ kind: 'prompt', opts, resolve });
      }),
    []
  );

  // Object.assign ולא cast — כך TypeScript מאמת שהחוזה באמת מתקיים
  const api = useMemo<ConfirmFn>(
    () => Object.assign(ask, { prompt: askText }),
    [ask, askText]
  );

  const isConfirm = pending?.kind === 'confirm';
  const confirmOpts = isConfirm ? (pending.opts as ConfirmOptions) : null;
  const promptOpts = pending?.kind === 'prompt' ? (pending.opts as PromptOptions) : null;

  const typingSatisfied =
    !confirmOpts?.requireTyping || typed.trim() === confirmOpts.requireTyping.trim();

  const promptSatisfied = !!promptOpts?.optional || text.trim().length > 0;

  return (
    <Ctx.Provider value={api}>
      {children}

      <Sheet
        open={!!pending}
        onClose={() => close(pending?.kind === 'prompt' ? null : false)}
        title={pending?.opts.title ?? ''}
        footer={
          <div className="flex gap-2">
            <Button
              size="lg"
              variant={confirmOpts?.danger ? 'danger' : 'primary'}
              fullWidth
              disabled={isConfirm ? !typingSatisfied : !promptSatisfied}
              onClick={() => close(isConfirm ? true : text.trim())}
            >
              {pending?.opts.confirmLabel ??
                (confirmOpts?.danger ? 'מחיקה' : 'אישור')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => close(pending?.kind === 'prompt' ? null : false)}
            >
              {confirmOpts?.cancelLabel ?? 'ביטול'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-2">
          {pending?.opts.body && (
            <div className="text-sm leading-relaxed text-ink-600">{pending.opts.body}</div>
          )}

          {confirmOpts?.requireTyping && (
            <Input
              label={`להמשך, הקלידו: ${confirmOpts.requireTyping}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
            />
          )}

          {promptOpts && (
            <Textarea
              label={promptOpts.label}
              placeholder={promptOpts.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={promptOpts.maxLength ?? 300}
              hint={promptOpts.optional ? 'אפשר להשאיר ריק' : undefined}
              autoFocus
            />
          )}
        </div>
      </Sheet>
    </Ctx.Provider>
  );
}
