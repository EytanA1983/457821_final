import { ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  title?: string;
  isOpen?: boolean;
}

export const Modal = ({ children, onClose, title, isOpen = true }: ModalProps) => {
  const { i18n } = useTranslation();
  const isEnglish = (i18n.resolvedLanguage || i18n.language || "he").startsWith("en");
  const modalTitle = title ?? (isEnglish ? "Choose one small task and keep moving" : "בוחרות משימה אחת וממשיכות בקטנה");
  const modalSubtitle = isEnglish
    ? "Calm home = calm mind. Just 5 more focused minutes."
    : "שקט בבית = שקט בראש. רק עוד 5 דקות וסיימנו.";
  const closeLabel = isEnglish ? "Close" : "סגור";

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="wowModalOverlay"
      onClick={onClose}
    >
      <div
        className="wowModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wowModalInner">
          {/* Header with title and close button */}
          <div className="wowModalHeader">
            <div>
              <h2 className="wowModalTitle">{modalTitle}</h2>
              <p className="wow-muted" style={{ marginTop: 6, marginBottom: 0 }}>
                {modalSubtitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="wowModalClose"
              aria-label={closeLabel}
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="wowModalBody">{children}</div>
        </div>
      </div>
    </div>
  );
};
