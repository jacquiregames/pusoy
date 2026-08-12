import { useEffect } from "react";
import "./Toast.css";

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export default function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 3800);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="toast" role="alert">
      <span className="toast__dot" />
      {message}
      <button className="toast__close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
