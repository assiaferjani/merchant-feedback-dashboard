import { useEffect, useRef } from "react";

export default function Dialog({
  open,
  onClose,
  title,
  children,
  className = "",
}) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`app-dialog ${className}`}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const elements = [
          ...event.currentTarget.querySelectorAll(
            'button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]',
          ),
        ].filter((element) => element.getClientRects().length);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClose={() => onCloseRef.current()}
      onClick={(event) => {
        if (event.target === event.currentTarget && event.clientX) {
          const rect = event.target.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            event.target.close();
        }
      }}
    >
      <button
        type="button"
        className="dialog-close"
        aria-label={`Fermer ${title}`}
        onClick={() => ref.current.close()}
      >
        ×
      </button>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
