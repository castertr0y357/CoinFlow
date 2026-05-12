import { ReactNode } from "react";
import SettingsNav from "./SettingsNav";
import "./Settings.css";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="settings-layout">
      <header className="page-header">
        <h1 className="animate-fade-in">Settings</h1>
        <p className="text-dim animate-fade-in" style={{ animationDelay: '0.1s', fontSize: '1.1rem' }}>
          Configure your budget targets, integrations, and system preferences.
        </p>
      </header>

      <div className="settings-grid-container">
        <aside className="settings-sidebar animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <SettingsNav />
        </aside>

        <main className="settings-content animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
