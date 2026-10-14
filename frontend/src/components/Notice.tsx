import React from "react";

interface NoticeProps {
  type?: "info" | "success" | "warning" | "danger";
  message: string;
  onClose?: () => void;
}

export function Notice({ type = "info", message, onClose }: NoticeProps) {
  const iconMap = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    danger: "⛔",
  };

  return (
    <div className={`notice notice-${type}`}>
      <span style={{ fontSize: "1.2rem" }}>{iconMap[type]}</span>
      <div style={{ flex: 1 }}>{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            fontSize: "1.1rem",
            padding: "0 4px",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
