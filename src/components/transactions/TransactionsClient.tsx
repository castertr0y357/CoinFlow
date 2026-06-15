"use client";

import { useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import TransactionList from "./TransactionList";
import Button from "@/components/ui/Button";
import { Category, Transaction } from "@/types";
import { applyTransactionSplits, bulkCategorizeTransactions } from "@/app/transactions/actions";

export default function TransactionsClient({ 
  categories, 
  aiEnabled 
}: { 
  categories: Category[]; 
  aiEnabled: boolean; 
}) {
  const [view, setView] = useState<'inbox' | 'all' | 'hidden'>('inbox');
  const { transactions, isLoading, refresh } = useTransactions(
    view === 'inbox', 
    view === 'all' || view === 'hidden', 
    view === 'hidden'
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isNormalizeLoading, setIsNormalizeLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("floating");
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'payee'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleNormalizePayees = async () => {
    if (!transactions) return;

    const targetIds = selectedIds.size > 0 
      ? Array.from(selectedIds)
      : (transactions as Transaction[]).map(tx => tx.id);

    if (targetIds.length === 0) return;

    if (selectedIds.size === 0) {
      const confirmAll = confirm(`Are you sure you want to run AI payee normalization on all ${targetIds.length} transactions in this view?`);
      if (!confirmAll) return;
    }

    setIsNormalizeLoading(true);
    try {
      const res = await fetch('/api/v1/ai/normalize-payees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({ transactionIds: targetIds })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully normalized ${data.count} payee names!`);
        setSelectedIds(new Set());
        refresh();
      } else {
        alert("Normalization failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Payee Normalization Error:", error);
      alert("Error running normalization");
    } finally {
      setIsNormalizeLoading(false);
    }
  };

  const handleAiCategorize = async () => {
    if (!transactions) return;
    
    const unassignedIds = (transactions as Transaction[])
      .filter(tx => tx.splits.some(s => !s.categoryId))
      .map(tx => tx.id);

    if (unassignedIds.length === 0) return;

    setIsAiLoading(true);
    try {
      const res = await fetch('/api/v1/ai/categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({ transactionIds: unassignedIds })
      });
      const data = await res.json();
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error("AI Fetch Error:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApplyAllSuggestions = async () => {
    if (!transactions || Object.keys(suggestions).length === 0) return;

    setIsBulkLoading(true);
    try {
      for (const txId in suggestions) {
        const categoryId = suggestions[txId];
        const tx = (transactions as Transaction[]).find(t => t.id === txId);
        if (tx && tx.splits.length === 1 && !tx.splits[0].categoryId) {
          await applyTransactionSplits(txId, [{
            categoryId,
            amount: Number(tx.amount),
            memo: tx.payee
          }]);
        }
      }
      setSuggestions({});
      refresh();
    } catch (error) {
      console.error("Bulk Categorize Error:", error);
    } finally {
      setIsBulkLoading(false);
    }
  };
  
  const handleSelectionToggle = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && filteredTransactions) {
      setSelectedIds(new Set(filteredTransactions.map(tx => tx.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkCategorize = async () => {
    if (selectedIds.size === 0) return;
    
    setIsBulkLoading(true);
    try {
      await bulkCategorizeTransactions(
        Array.from(selectedIds), 
        bulkCategoryId === "floating" ? null : bulkCategoryId
      );
      setSelectedIds(new Set());
      refresh();
    } catch (error) {
      console.error("Bulk Categorize Error:", error);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleSort = (field: 'date' | 'amount' | 'payee') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredTransactions = (transactions as Transaction[])?.filter(tx => 
    tx.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.amount.toString().includes(searchQuery) ||
    tx.splits.some(s => s.memo?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedTransactions = filteredTransactions ? [...filteredTransactions].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'date') {
      comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortBy === 'amount') {
      comparison = Number(a.amount) - Number(b.amount);
    } else if (sortBy === 'payee') {
      comparison = a.payee.localeCompare(b.payee);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  }) : null;

  return (
    <>
      <div className="transactions-actions animate-fade-in sticky-header" style={{ animationDelay: '0.15s', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="search-box glass" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', borderRadius: '12px', flex: 1, minWidth: '250px' }}>
          <span style={{ marginRight: '0.5rem' }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search payees, amounts, or memos..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'white', padding: '0.75rem 0', width: '100%', outline: 'none' }}
          />
          {filteredTransactions && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
              {filteredTransactions.length} items
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button 
            variant={view === 'inbox' ? "primary" : "glass"} 
            onClick={() => setView('inbox')}
          >
            📥 Inbox
          </Button>
          <Button 
            variant={view === 'all' ? "primary" : "glass"} 
            onClick={() => setView('all')}
          >
            📜 History
          </Button>
          <Button 
            variant={view === 'hidden' ? "primary" : "glass"} 
            onClick={() => setView('hidden')}
          >
            👁️ Hidden
          </Button>
          
          {aiEnabled && Object.keys(suggestions).length > 0 && (
            <Button 
              variant="glass" 
              onClick={handleApplyAllSuggestions}
              disabled={isBulkLoading}
            >
              {isBulkLoading ? "✅ Applying..." : "✅ Apply All AI"}
            </Button>
          )}
          {aiEnabled && (
            <Button 
              variant="glass" 
              onClick={handleNormalizePayees} 
              disabled={isNormalizeLoading || isLoading}
            >
              {isNormalizeLoading ? "🧹 Normalizing..." : "🧹 Normalize Payees"}
            </Button>
          )}
          {aiEnabled && (
            <Button 
              variant="glass" 
              onClick={handleAiCategorize} 
              disabled={isAiLoading || isLoading}
            >
              {isAiLoading ? "✨ Thinking..." : "✨ Suggest Categories"}
            </Button>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-actions-bar glass">
          <div className="bulk-actions-info">
            <span>📦 {selectedIds.size} selected</span>
          </div>
          <select 
            className="bulk-category-select"
            value={bulkCategoryId}
            onChange={(e) => setBulkCategoryId(e.target.value)}
            disabled={isBulkLoading}
          >
            <option value="floating">🌊 Floating (Uncategorized)</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
                {cat.balance !== undefined ? ` ($${cat.balance < 0 ? '-' : ''}${Math.abs(cat.balance).toFixed(2)})` : ''}
              </option>
            ))}
          </select>
          <Button 
            variant="primary" 
            onClick={handleBulkCategorize}
            disabled={isBulkLoading}
          >
            {isBulkLoading ? "Applying..." : "Categorize Selected"}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setSelectedIds(new Set())}
            disabled={isBulkLoading}
          >
            Cancel
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="transactions-list glass skeleton animate-fade-in" style={{ minHeight: '400px' }}></div>
      ) : (
        <TransactionList 
          transactions={sortedTransactions || []}
          categories={categories}
          suggestions={suggestions}
          onCategorized={() => {
            refresh();
          }}
          selectedIds={selectedIds}
          onSelectionToggle={handleSelectionToggle}
          onSelectAll={handleSelectAll}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          aiEnabled={aiEnabled}
        />
      )}
    </>
  );
}
