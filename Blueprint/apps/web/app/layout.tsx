import type { Metadata } from "next";
import { NavBar } from "./components/NavBar";
import { SomethingXBridge } from "./SomethingXBridge";
import { SomethingXProfileSync } from "./SomethingXProfileSync";

export const metadata: Metadata = {
  title: "Job Blueprint",
  description: "Career roadmap and learning plan"
};

const globalCss = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: Inter, "Segoe UI", system-ui, sans-serif; background: #f8fafc; color: #0f172a; -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  button { font-family: inherit; }
  table { border-spacing: 0; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: globalCss }} />
      </head>
      <body>
        <SomethingXBridge />
        <SomethingXProfileSync />
        <NavBar />
        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 20px 0" }}>{children}</main>
      </body>
    </html>
  );
}
