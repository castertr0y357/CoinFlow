import { redirect } from "next/navigation";

export default async function HistoryPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const parsed = parseInt(year, 10);
  if (isNaN(parsed)) {
    redirect("/");
  }
  redirect(`/?year=${parsed}`);
}
