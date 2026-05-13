import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { getSidebarData } from "@/lib/services/budgetService";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CoinFlow | Flexible Zero-Based Budgeting",
  description: "A premium, flexible zero-based budgeting app for modern financial tracking.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CoinFlow",
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sidebarData = await getSidebarData();

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="layout-wrapper">
          <Sidebar accounts={sidebarData} />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
