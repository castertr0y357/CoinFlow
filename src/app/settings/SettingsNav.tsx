"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "General", href: "/settings/general", icon: "⚙️" },
  { label: "AI Assistant", href: "/settings/ai", icon: "✨" },
  { label: "Categories", href: "/settings/categories", icon: "🏷️" },
  { label: "API & Security", href: "/settings/api", icon: "🔑" },
  { label: "Maintenance", href: "/settings/maintenance", icon: "🛠️" },
  { label: "Browser Extension", href: "/settings/extension", icon: "🧩" },
  { label: "Tools & Archives", href: "/settings/tools", icon: "🧰" },
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
