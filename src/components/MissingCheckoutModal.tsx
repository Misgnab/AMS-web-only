import React, { useEffect } from "react";
import { MissingCheckoutManagement } from "./MissingCheckoutManagement.js";

interface MissingCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRecordId?: number | null;
  initialTab?: "requests" | "unclosed" | "payroll" | "audit" | "my-unclosed" | "my-requests" | null;
}

export const MissingCheckoutModal: React.FC<MissingCheckoutModalProps> = ({
  isOpen,
  onClose,
  initialRecordId = null,
  initialTab = null
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <MissingCheckoutManagement
          isModal={true}
          onClose={onClose}
          initialRecordId={initialRecordId}
          initialTab={initialTab}
        />
      </div>
    </div>
  );
};

