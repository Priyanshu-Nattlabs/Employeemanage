import type { Metadata } from "next";
import { NavBar } from "./components/NavBar";

export const metadata: Metadata = {
  title: "Job Blueprint",
  description: "Career roadmap and learning plan"
};

const globalCss = `
  *, *::before, *::after { box-sizing: border-box; }
  html { overflow-x: hidden; }
  body { margin: 0; padding: 0; font-family: Inter, "Segoe UI", system-ui, sans-serif; background: #f8fafc; color: #0f172a; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  a { color: inherit; }
  button { font-family: inherit; }
  table { border-spacing: 0; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  /* Manager dashboard: minmax(0,1fr) + min-width 0 lets grids shrink inside max-width main (avoids right-edge clip). */
  .manager-kpi-grid {
    display: grid;
    gap: 12px;
    min-width: 0;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  @media (max-width: 900px) {
    .manager-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .manager-kpi-grid { grid-template-columns: minmax(0, 1fr); }
  }
  .manager-two-col {
    display: grid;
    gap: 16px;
    min-width: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 760px) {
    .manager-two-col { grid-template-columns: minmax(0, 1fr); }
  }
  .manager-engagement-grid {
    display: grid;
    gap: 12px;
    min-width: 0;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  @media (max-width: 900px) {
    .manager-engagement-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .manager-engagement-grid { grid-template-columns: minmax(0, 1fr); }
  }
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
        <NavBar />
        <main style={{ width: "100%", maxWidth: 1280, margin: "0 auto", padding: "18px clamp(12px, 3vw, 20px) 0", boxSizing: "border-box", minWidth: 0 }}>{children}</main>
      </body>
    </html>
  );
}
