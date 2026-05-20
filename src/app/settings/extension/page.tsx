"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function ExtensionSettingsPage() {
  return (
    <div className="subpage-container animate-fade-in">
      <Card className="settings-form">
        <div className="form-section">
          <h2>CoinFlow Purchase Sync</h2>
          <p className="text-muted">
            The CoinFlow browser extension allows you to automatically sync your purchase history from Amazon, Walmart, and Lowe&apos;s directly into your budget.
          </p>

          <div className="extension-status-card glass p-8 rounded-2xl border border-primary/20 mt-4">
            <div className="flex items-center gap-6 mb-6">
              <div className="text-5xl bg-primary/10 w-16 h-16 flex items-center justify-center rounded-2xl">🧩</div>
              <div>
                <h3 className="text-2xl font-bold text-main">Extension v1.9</h3>
                <p className="text-sm text-primary font-semibold uppercase tracking-wider">Status: Ready for Manual Installation</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <p className="text-dim leading-relaxed">
                Since browsers do not allow automatic installation of extensions from websites for security reasons, you must load the extension manually using Chrome&apos;s Developer Mode.
              </p>
              <div className="flex flex-wrap gap-4 mt-2">
                <Button variant="primary" onClick={() => window.location.href = '/coinflow-extension.zip'}>Download Extension Zip</Button>
                <Button variant="glass" onClick={() => window.open('chrome://extensions')}>Open Chrome Extensions</Button>
              </div>
            </div>
          </div>

          <div className="instructions-section mt-12">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Installation Instructions
            </h3>
            <div className="steps-grid">
              <div className="step-card glass p-6 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="step-num-badge">1</span>
                <h4 className="font-bold text-main">Download & Extract</h4>
                <p className="text-sm text-dim leading-relaxed">Download the extension zip file and extract it to a folder on your computer.</p>
              </div>
              <div className="step-card glass p-6 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="step-num-badge">2</span>
                <h4 className="font-bold text-main">Enable Developer Mode</h4>
                <p className="text-sm text-dim leading-relaxed">Open Chrome and navigate to <code>chrome://extensions/</code>. Toggle <strong>Developer mode</strong> in the top right.</p>
              </div>
              <div className="step-card glass p-6 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="step-num-badge">3</span>
                <h4 className="font-bold text-main">Load Unpacked</h4>
                <p className="text-sm text-dim leading-relaxed">Click <strong>Load unpacked</strong> and select the extracted extension folder.</p>
              </div>
              <div className="step-card glass p-6 rounded-xl border border-white/5 flex flex-col gap-3">
                <span className="step-num-badge">4</span>
                <h4 className="font-bold text-main">Configure API Key</h4>
                <p className="text-sm text-dim leading-relaxed">Open the extension popup and enter your internal API key found in the <strong>API & Security</strong> tab.</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <style jsx>{`
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
        }
        .step-num-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--primary-glow);
          color: var(--primary);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 800;
        }
        code {
          background: rgba(255,255,255,0.05);
          padding: 0.15rem 0.4rem;
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
          color: var(--primary);
        }
      `}</style>
    </div>
  );
}
