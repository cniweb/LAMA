import { useEffect, useRef } from 'react';

/**
 * Barrierefreiheit für Modals: setzt den Initialfokus in den Dialog,
 * hält den Tab-Fokus innerhalb des Dialogs (Fokus-Falle) und schließt
 * per Escape, sofern `onClose` übergeben wurde (blockierende Dialoge
 * ohne onClose lassen sich per Esc bewusst nicht schließen).
 */
export function useModalDialog<T extends HTMLElement>(active: boolean, onClose?: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    const node = ref.current;
    node?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (event.key !== 'Tab' || !node) {
        return;
      }
      const focusables = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, onClose]);

  return ref;
}
