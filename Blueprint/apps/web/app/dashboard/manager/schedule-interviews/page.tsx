import { redirect } from "next/navigation";
import { getAssetPrefix } from "@/lib/apiBase";

/** Legacy route — hub lives under `/dashboard/manager/interviews`. */
export default function LegacyScheduleInterviewsRedirect() {
  const base = getAssetPrefix().replace(/\/$/, "");
  redirect(`${base}/dashboard/manager/interviews/`);
}
