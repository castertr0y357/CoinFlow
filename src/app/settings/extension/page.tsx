import { redirect } from "next/navigation";

export default function ExtensionSettingsRedirectPage() {
  redirect("/settings/integrations");
}
