"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import Button from "./Button";
import "./Notification.css";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface NotificationContextProps {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  confirm: (options: ConfirmOptions) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const confirm = (options: ConfirmOptions) => {
    setConfirmModal(options);
  };

  return (
    <NotificationContext.Provider value={{ showToast, confirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type} animate-slide-in`}>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>&times;</button>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-content glassmorphic animate-scale-up">
            <h3>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
