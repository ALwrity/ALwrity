import { createPortal } from "react-dom";

interface TransformedPhotoPreviewProps {
  photoUrl: string;
  visible: boolean;
  onDownload: () => void;
  onDismiss: () => void;
}

export const TransformedPhotoPreview: React.FC<TransformedPhotoPreviewProps> = ({
  photoUrl,
  visible,
  onDownload,
  onDismiss,
}) => {
  if (!visible || !photoUrl) return null;

  return createPortal(
    <div
      className="linkedin-profile-optimization-overlay"
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 13000,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 520,
          width: "90vw",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ padding: "24px 24px 16px", textAlign: "center" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
            Your Enhanced Profile Photo
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
            AI has transformed your photo into a professional headshot.
          </p>
        </div>

        <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "center" }}>
          <img
            src={photoUrl}
            alt="Transformed profile"
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          />
        </div>

        <div
          style={{
            padding: "16px 24px 24px",
            display: "flex",
            gap: 12,
            justifyContent: "center",
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <button
            type="button"
            onClick={onDownload}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#334155",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Download
          </button>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: "#0a66c2",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Keep &amp; Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
