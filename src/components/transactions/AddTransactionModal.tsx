"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { addManualTransaction } from "@/app/transactions/manual-action";

interface AddTransactionModalProps {
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddTransactionModal({ 
  categoryId, 
  categoryName, 
  onClose, 
  onSuccess 
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    payee: "",
    amount: "",
    memo: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.payee || !formData.amount) return;

    setIsSubmitting(true);
    try {
      await addManualTransaction({
        ...formData,
        amount: parseFloat(formData.amount) * -1, // Spending is negative
        categoryId
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <Card className="modal-card glass animate-scale-in">
        <h3>Add Transaction to {categoryName}</h3>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Date</label>
            <Input 
              type="date" 
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Payee</label>
            <Input 
              placeholder="e.g. Starbucks" 
              value={formData.payee}
              onChange={e => setFormData({...formData, payee: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Amount (Positive Number)</label>
            <Input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Memo (Optional)</label>
            <Input 
              placeholder="Notes..." 
              value={formData.memo}
              onChange={e => setFormData({...formData, memo: e.target.value})}
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Transaction"}
            </Button>
          </div>
        </form>
      </Card>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .modal-card {
          width: 100%;
          max-width: 450px;
        }
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          margin-top: 1.5rem;
        }
        .form-group label {
          display: block;
          font-size: 0.8rem;
          color: var(--text-dim);
          margin-bottom: 0.5rem;
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}
