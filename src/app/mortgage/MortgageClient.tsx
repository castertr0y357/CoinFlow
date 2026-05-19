"use client";

import { useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { calculateAmortization } from "@/lib/services/mortgageService";
import { updateMortgageDetails, addValuationProvider, removeValuationProvider, syncValuations } from "./actions";
import "./Mortgage.css";

interface Provider {
  id: string;
  name: string;
  url: string;
  lastValue: number | null;
  lastSync: string | null;
}

interface MortgageClientProps {
  initialData: any;
  accounts: { id: string, name: string }[];
}

export default function MortgageClient({ initialData, accounts }: MortgageClientProps) {
  const [extraPayment, setExtraPayment] = useState(0);
  const [isEditing, setIsEditing] = useState(!initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const formatInitialDate = (date: any) => {
    if (!date) return new Date().toISOString().split('T')[0];
    if (date instanceof Date) return date.toISOString().split('T')[0];
    if (typeof date === 'string') return date.split('T')[0];
    return new Date().toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    accountId: initialData?.accountId || "",
    interestRate: initialData?.interestRate || 6.5,
    monthlyPayment: initialData?.monthlyPayment || 2000,
    startDate: formatInitialDate(initialData?.startDate),
    termMonths: initialData?.termMonths || 360,
    homeValue: initialData?.homeValue || 400000,
  });

  const [newProvider, setNewProvider] = useState({ name: "Zillow", url: "" });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateMortgageDetails(formData);
      setIsEditing(false);
    } catch (error) {
      alert("Failed to save mortgage details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider.url) return;
    setIsSaving(true);
    try {
      await addValuationProvider(initialData.id, newProvider.name, newProvider.url);
      setNewProvider({ ...newProvider, url: "" });
    } catch (error) {
      alert("Failed to add provider.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveProvider = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    setIsSaving(true);
    try {
      await removeValuationProvider(id);
    } catch (error) {
      alert("Failed to remove provider.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncValuations = async () => {
    setIsSyncing(true);
    try {
      await syncValuations(initialData.id);
    } catch (error) {
      alert("Failed to sync valuations.");
    } finally {
      setIsSyncing(false);
    }
  };

  const schedule = useMemo(() => {
    if (!initialData) return [];
    return calculateAmortization(
      initialData.currentBalance,
      initialData.interestRate,
      initialData.monthlyPayment,
      0
    );
  }, [initialData]);

  const optimizedSchedule = useMemo(() => {
    if (!initialData) return [];
    return calculateAmortization(
      initialData.currentBalance,
      initialData.interestRate,
      initialData.monthlyPayment,
      extraPayment
    );
  }, [initialData, extraPayment]);

  if (isEditing) {
    return (
      <Card className="mortgage-setup glass">
        <h2>Mortgage Setup</h2>
        <form onSubmit={handleSave} className="setup-form">
          <div className="form-group">
            <label>Linked Account</label>
            <select value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} required>
              <option value="">Select account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Interest Rate (%)</label>
              <input type="number" step="0.01" value={formData.interestRate} onChange={e => setFormData({...formData, interestRate: Number(e.target.value)})} required />
            </div>
            <div className="form-group">
              <label>Monthly P&I Payment</label>
              <input type="number" value={formData.monthlyPayment} onChange={e => setFormData({...formData, monthlyPayment: Number(e.target.value)})} required />
            </div>
          </div>
          <div className="form-group">
            <label>Manual Home Value (Fallback)</label>
            <input type="number" value={formData.homeValue} onChange={e => setFormData({...formData, homeValue: Number(e.target.value)})} />
          </div>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Mortgage Details"}
          </Button>
          {initialData && <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>}
        </form>
      </Card>
    );
  }

  const baseTotalInterest = schedule[schedule.length - 1]?.totalInterest || 0;
  const optimizedTotalInterest = optimizedSchedule[optimizedSchedule.length - 1]?.totalInterest || 0;
  const interestSaved = baseTotalInterest - optimizedTotalInterest;
  const monthsSaved = schedule.length - optimizedSchedule.length;

  return (
    <div className="mortgage-dashboard">
      <div className="mortgage-stats-grid">
        <Card className="stat-card accent" animate={true}>
          <span className="stat-label">Current Balance</span>
          <div className="stat-value">${initialData.currentBalance.toLocaleString()}</div>
          <span className="stat-sub">Estimated Equity: ${((initialData.homeValue || 0) - initialData.currentBalance).toLocaleString()}</span>
        </Card>
        
        <Card className="stat-card secondary" animate={true} delay="0.1s">
          <span className="stat-label">Avg. Home Value</span>
          <div className="stat-value">${(initialData.homeValue || 0).toLocaleString()}</div>
          <span className="stat-sub">From {initialData.providers?.length || 0} Sources</span>
        </Card>

        <Card className="stat-card danger" animate={true} delay="0.2s">
          <span className="stat-label">Interest Saved</span>
          <div className="stat-value text-accent">${interestSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <span className="stat-sub">{monthsSaved} months shaved off</span>
        </Card>
      </div>

      <div className="mortgage-tools">
        <Card className="payoff-calculator glass">
          <h3>Payoff Accelerator</h3>
          <p className="text-muted">How much extra can you pay each month?</p>
          
          <div className="calculator-ui">
            <div className="slider-container">
              <input 
                type="range" 
                min="0" 
                max="2000" 
                step="50" 
                value={extraPayment} 
                onChange={(e) => setExtraPayment(Number(e.target.value))}
                className="payment-slider"
              />
              <div className="slider-labels">
                <span>$0</span>
                <span className="current-extra">${extraPayment} / mo</span>
                <span>$2,000</span>
              </div>
            </div>

            <div className="results-grid">
              <div className="result-item">
                <span className="label">New Payoff Date</span>
                <span className="value">{optimizedSchedule[optimizedSchedule.length - 1]?.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
              </div>
              <div className="result-item">
                <span className="label">Interest Savings</span>
                <span className="value accent">${interestSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="mortgage-side-tools">
          <Card className="equity-viz glass">
            <h3>Home Valuation Sources</h3>
            <div className="providers-list">
              {initialData.providers?.length === 0 ? (
                <p className="text-muted py-4">No live sources linked. Add Zillow, Redfin, or Realtor to track live value.</p>
              ) : (
                initialData.providers?.map((p: Provider) => (
                  <div key={p.id} className="provider-item">
                    <div className="provider-header">
                      <span className="provider-name">{p.name}</span>
                      <button 
                        onClick={() => handleRemoveProvider(p.id)} 
                        className="delete-provider-btn"
                        title="Delete source"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="provider-body">
                      <span className="provider-value">
                        {p.lastValue !== null ? `$${Number(p.lastValue).toLocaleString()}` : "—"}
                      </span>
                      <span className="provider-sync">
                        Last synced: {p.lastSync ? new Date(p.lastSync).toLocaleDateString(undefined, { timeZone: 'UTC' }) : 'Never'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="add-provider mt-4">
              <div className="provider-form">
                <select value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})}>
                  <option>Zillow</option>
                  <option>Redfin</option>
                  <option>Realtor</option>
                </select>
                <input 
                  type="text" 
                  placeholder="Paste URL here..." 
                  value={newProvider.url} 
                  onChange={e => setNewProvider({...newProvider, url: e.target.value})} 
                />
                <Button variant="secondary" size="sm" onClick={handleAddProvider} disabled={isSaving}>
                   {isSaving ? "..." : "Add"}
                </Button>
              </div>
            </div>

            <Button 
              variant="ghost" 
              className="mt-4 w-full" 
              onClick={handleSyncValuations}
              disabled={isSyncing || initialData.providers?.length === 0}
            >
              {isSyncing ? "⏳ Syncing Estimations..." : "🔄 Refresh All Valuations"}
            </Button>
          </Card>

          <Card className="equity-viz glass mt-4">
            <h3>Payoff Progress</h3>
            <div className="equity-bar-container">
               <div className="equity-bar">
                  <div className="bar-fill principal" style={{ width: `${(initialData.currentBalance / (initialData.homeValue || 1)) * 100}%` }}></div>
               </div>
               <div className="bar-labels">
                  <span>Debt: {((initialData.currentBalance / (initialData.homeValue || 1)) * 100).toFixed(1)}%</span>
                  <span>Equity: {(((initialData.homeValue || 0) - initialData.currentBalance) / (initialData.homeValue || 1) * 100).toFixed(1)}%</span>
               </div>
            </div>
            <Button variant="ghost" onClick={() => setIsEditing(true)} className="mt-4">Edit Core Details</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
