"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Budget & Income", href: "/settings/general", icon: "💰" },
  { label: "Categories", href: "/settings/categories", icon: "🏷️" },
  { label: "Years & Import", href: "/settings/years", icon: "📅" },
  { label: "Integrations & API", href: "/settings/integrations", icon: "🔌" },
  { label: "AI Assistant", href: "/settings/ai", icon: "✨" },
  { label: "Backups & Recovery", href: "/settings/maintenance", icon: "🗄️" },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="settings-nav">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`settings-nav-item ${pathname === item.href ? "active" : ""}`}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
