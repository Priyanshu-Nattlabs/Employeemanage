"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Application error</h2>
        <p style={{ color: "#64748b", marginBottom: 16 }}>{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
