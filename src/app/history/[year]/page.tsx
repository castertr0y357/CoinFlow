import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const parsed = parseInt(year, 10);
  if (isNaN(parsed)) {
    redirect("/");
  }

  const currentYear = new Date().getFullYear();
  const allYears = await prisma.budgetYear.findMany({
    orderBy: { year: "desc" },
    select: { year: true },
  });

  const pastYears = allYears
    .map((y) => y.year)
    .filter((y) => y < currentYear);

  const availableYears = pastYears.includes(parsed)
    ? pastYears
    : [parsed, ...pastYears].sort((a, b) => b - a);

  return <HistoryClient year={parsed} availableYears={availableYears} />;
}
