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
    gap: 18px;
    min-width: 0;
    align-items: stretch;
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
  .manager-dash-card {
    position: relative;
    transition: box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease;
  }
  .manager-dash-card:hover {
    box-shadow: 0 12px 40px -18px rgba(15, 23, 42, 0.14), 0 4px 12px -6px rgba(15, 23, 42, 0.08);
    border-color: #e2e8f0;
  }
  @media (prefers-reduced-motion: reduce) {
    .manager-dash-card { transition: none; }
    .manager-dash-card:hover { transform: none; }
  }
  .manager-file-zone {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px dashed #cbd5e1;
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  .manager-file-zone:hover {
    border-color: #10b981;
    background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
  }
  .manager-file-zone:focus-within {
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.2);
    outline: none;
  }
  .manager-file-zone input[type="file"] {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .manager-cta-link {
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
  }
  .manager-cta-link:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 28px -12px rgba(14, 165, 233, 0.45);
    filter: brightness(1.02);
  }
  .manager-cta-link:active {
    transform: translateY(0);
  }
  .manager-toolbar-field {
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .manager-toolbar-field:focus {
    outline: none;
    border-color: #818cf8 !important;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.22);
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
