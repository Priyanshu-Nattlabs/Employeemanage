import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "24px", maxWidth: 560 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Page not found</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>Check the URL or return home.</p>
      <Link href="/" style={{ color: "#2563eb", fontWeight: 700 }}>
        Home
      </Link>
    </div>
  );
}
