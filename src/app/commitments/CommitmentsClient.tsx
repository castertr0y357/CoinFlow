"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { addCommitment, deleteCommitment, updateCommitment } from "./actions";
import "./Commitments.css";

interface Commitment {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  type: string;
  categoryId: string | null;
  category?: { name: string } | null;
}

interface CommitmentsClientProps {
  initialCommitments: Commitment[];
  categories: { id: string, name: string }[];
}

export default function CommitmentsClient({ initialCommitments, categories }: CommitmentsClientProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    amount: 0,
    frequency: "MONTHLY",
    type: "SUBSCRIPTION",
    categoryId: ""
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await addCommitment(formData);
    setFormData({ name: "", amount: 0, frequency: "MONTHLY", type: "SUBSCRIPTION", categoryId: "" });
    setIsAdding(false);
  };


  const handleUpdate = async () => {
    if (!editingId) return;
    await updateCommitment(editingId, {
      name: editFormData.name,
      amount: Number(editFormData.amount),
      frequency: editFormData.frequency,
      categoryId: editFormData.categoryId || null
    });
    setEditingId(null);
  };

  const startEditing = (item: Commitment) => {
    setEditingId(item.id);
    setEditFormData({
      name: item.name,
      amount: item.amount,
      frequency: item.frequency,
      categoryId: item.categoryId || ""
    });
  };

  const calculateMonthly = (amount: number, freq: string) => {
    let monthly = amount;
    if (freq === "YEARLY") monthly = amount / 12;
    if (freq === "SEMI_ANNUAL") monthly = amount / 6;
    if (freq === "QUARTERLY") monthly = amount / 3;
    return monthly;
  };

  const groups = {
    SUBSCRIPTION: initialCommitments.filter(c => c.type === "SUBSCRIPTION"),
    INSURANCE: initialCommitments.filter(c => c.type === "INSURANCE"),
    TAX: initialCommitments.filter(c => c.type === "TAX"),
    REGISTRATION: initialCommitments.filter(c => c.type === "REGISTRATION"),
  };

  const groupTotals = Object.fromEntries(
    Object.entries(groups).map(([type, items]) => [
      type,
      Math.ceil(items.reduce((acc, c) => acc + calculateMonthly(c.amount, c.frequency), 0))
    ])
  );

  const totalMonthly = Object.values(groupTotals).reduce((acc, val) => acc + val, 0);

  return (
    <div className="commitments-workspace">
      <div className="commitments-stats">
        <Card className="stat-card glass" animate={true}>
          <span className="stat-label">Total Monthly Needed</span>
          <div className="stat-value">${totalMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <p className="text-muted text-sm mt-2">Sum of all recurring monthly-equivalent costs.</p>
        </Card>
        
        <Card className="stat-card glass" animate={true} delay="0.1s">
          <span className="stat-label">Fixed Commitments</span>
          <div className="stat-value">{initialCommitments.length}</div>
          <p className="text-muted text-sm mt-2">Across {Object.keys(groups).length} categories.</p>
        </Card>
      </div>

      <div className="commitments-actions">
         <Button variant="primary" onClick={() => setIsAdding(true)}>+ Add New Commitment</Button>
      </div>

      {isAdding && (
        <Card className="add-commitment-card glass animate-slide-up">
           <h3>New Fixed Cost</h3>
           <form onSubmit={handleAdd} className="commitment-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Netflix, Car Tax" required />
                </div>
                <div className="form-group">
                  <label>Amount</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} required />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Frequency</label>
                  <select value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="SEMI_ANNUAL">Semi-Annual</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="SUBSCRIPTION">Subscription</option>
                    <option value="INSURANCE">Insurance</option>
                    <option value="TAX">Tax</option>
                    <option value="REGISTRATION">Registration</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Tied to Budget Category (Optional)</label>
                <select value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}>
                  <option value="">Select category...</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="form-actions">
                <Button type="submit" variant="primary">Add Commitment</Button>
                <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
              </div>
           </form>
        </Card>
      )}

      <div className="commitments-grid">
        {Object.entries(groups).map(([type, items]) => {
          const groupMonthlyTotal = groupTotals[type];
          const typeDisplay = type === 'TAX' ? 'TAXES' : `${type}S`;

          return (
            <div key={type} className="commitment-group">
              <div className="group-header">
                <h2 className="group-title">{typeDisplay}</h2>
                <span className="group-total">${groupMonthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
              </div>
              <div className="items-list">
                {items.length === 0 ? (
                  <p className="text-muted p-4 text-center glass rounded-xl">No {type.toLowerCase()}s added yet.</p>
                ) : (
                  items.map(item => (
                    <div key={item.id} className={`commitment-item glass ${editingId === item.id ? 'editing' : ''}`}>
                      {editingId === item.id ? (
                        <div className="edit-commitment-inline" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.5rem' }}>
                              <input 
                                type="text" 
                                value={editFormData.name} 
                                onChange={e => setEditFormData({...editFormData, name: e.target.value})} 
                                className="edit-input name-input"
                                style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '4px', width: '100%' }}
                              />
                              <input 
                                type="number" 
                                step="0.01" 
                                value={editFormData.amount} 
                                onChange={e => setEditFormData({...editFormData, amount: Number(e.target.value)})} 
                                className="edit-input amount-input"
                                style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '4px', width: '100%' }}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                              <select 
                                value={editFormData.frequency} 
                                onChange={e => setEditFormData({...editFormData, frequency: e.target.value})}
                                className="edit-select"
                                style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '4px', width: '100%', cursor: 'pointer' }}
                              >
                                <option value="MONTHLY">Monthly</option>
                                <option value="QUARTERLY">Quarterly</option>
                                <option value="SEMI_ANNUAL">Semi-Annual</option>
                                <option value="YEARLY">Yearly</option>
                              </select>
                              <select 
                                value={editFormData.categoryId} 
                                onChange={e => setEditFormData({...editFormData, categoryId: e.target.value})}
                                className="edit-select"
                                style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '4px', width: '100%', cursor: 'pointer' }}
                              >
                                <option value="">No Category</option>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                              </select>
                            </div>
                            <div className="edit-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                              <Button variant="primary" onClick={handleUpdate}>Save</Button>
                              <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="item-info" onClick={() => startEditing(item)} style={{ cursor: 'pointer' }}>
                             <span className="item-name">{item.name}</span>
                             <span className="item-cat">{item.category?.name || 'Unlinked'}</span>
                          </div>
                          <div className="item-math" onClick={() => startEditing(item)} style={{ cursor: 'pointer' }}>
                             <span className="item-amount">${item.amount.toLocaleString()} <small>({item.frequency.replace('_', ' ')})</small></span>
                             <span className="item-monthly-needed">Needed: ${calculateMonthly(item.amount, item.frequency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</span>
                          </div>
                          <button className="delete-btn" onClick={() => deleteCommitment(item.id)}>✖</button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
