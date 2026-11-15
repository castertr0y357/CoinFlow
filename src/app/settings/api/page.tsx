import { redirect } from "next/navigation";

export default function ApiSettingsRedirectPage() {
  redirect("/settings/integrations");
}
