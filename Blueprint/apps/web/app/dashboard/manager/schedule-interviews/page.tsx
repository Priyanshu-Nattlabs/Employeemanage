import { redirect } from "next/navigation";

/** Legacy route — hub lives under `/dashboard/manager/interviews`. */
export default function LegacyScheduleInterviewsRedirect() {
  // Do not prepend getAssetPrefix(): with next.config `basePath`, Next would emit `/base/base/...` and 404.
  redirect("/dashboard/manager/interviews/");
}
