import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  /** תוכן שמוצג בקצה השדה, למשל ₪ או אייקון */
  suffix?: ReactNode;
}

const fieldBase =
  'w-full rounded-xl border bg-white px-3.5 text-[16px] text-ink-900 ' +
  'placeholder:text-ink-400 transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 ' +
  'disabled:bg-ink-50 disabled:text-ink-400';

export const Input = forwardRef<
  HTMLInputElement,
  FieldProps & InputHTMLAttributes<HTMLInputElement>
>(function Input({ label, error, hint, suffix, className = '', id, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700">
        {label}
      </label>

      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={[
            fieldBase,
            'h-12',
            suffix ? 'pe-11' : '',
            error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30' : 'border-ink-200',
            className,
          ].join(' ')}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-ink-400">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <p id={`${fieldId}-err`} role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/**
 * שדה סיסמה עם כפתור הצגה/הסתרה.
 *
 * במובייל זה לא נוחות בלבד: הקלדת סיסמה במקלדת נייד בלי לראות אותה היא
 * מקור עיקרי לניסיונות התחברות כושלים, במיוחד כשמערבבים אותיות ומספרים.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<FieldProps, 'suffix'> & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function PasswordInput({ label, error, hint, className = '', id, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700">
        {label}
      </label>

      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          className={[
            fieldBase,
            'h-12 pe-12',
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30'
              : 'border-ink-200',
            className,
          ].join(' ')}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'הסתר סיסמה' : 'הצג סיסמה'}
          aria-pressed={visible}
          tabIndex={-1}
          className="tap absolute inset-y-0 end-0 grid w-12 place-items-center
                     rounded-e-xl text-ink-400 transition hover:text-ink-600"
        >
          {visible ? <EyeOffIcon width={19} height={19} /> : <EyeIcon width={19} height={19} />}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ label, error, hint, className = '', id, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        rows={3}
        aria-invalid={!!error}
        className={[
          fieldBase,
          'resize-none py-3 leading-relaxed',
          error ? 'border-rose-400' : 'border-ink-200',
          className,
        ].join(' ')}
        {...rest}
      />
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
});
