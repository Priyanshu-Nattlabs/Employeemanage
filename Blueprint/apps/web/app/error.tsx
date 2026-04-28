"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: "24px", maxWidth: 560 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Something went wrong</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          border: "none",
          background: "#0b5fe8",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
