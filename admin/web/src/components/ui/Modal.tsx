import { useEffect, type ReactNode } from 'react';

/**
 * חלונית. נסגרת ב-Escape ובלחיצה על הרקע.
 *
 * ‼️ הגלילה של הרקע ננעלת כל עוד היא פתוחה — בלי זה, גלגלת העכבר
 *    מזיזה את הטבלה שמאחור בזמן שקוראים פרטים, וזה מבלבל.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  size,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'narrow' | 'wide';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${size ? ` ${size}` : ''}`} role="dialog" aria-modal="true">
        <header className="modal__head">
          <h2>{title}</h2>
          <button className="btn ghost sm" style={{ marginInlineStart: 'auto' }} onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'אישור',
  danger,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      title={title}
      size="narrow"
      onClose={onCancel}
      footer={
        <>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'מבצע…' : confirmLabel}
          </button>
          <button className="btn" onClick={onCancel} disabled={busy}>
            ביטול
          </button>
        </>
      }
    >
      <p style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
      {children}
    </Modal>
  );
}
