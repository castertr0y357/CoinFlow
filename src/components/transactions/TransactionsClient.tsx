"use client";

import { useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import TransactionList from "./TransactionList";
import Button from "@/components/ui/Button";
import { Category, Transaction } from "@/types";
import { applyTransactionSplits } from "@/app/transactions/actions";

export default function TransactionsClient({ categories }: { categories: Category[] }) {
  const [showAll, setShowAll] = useState(false);
  const { transactions, isLoading, refresh } = useTransactions(!showAll, showAll);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isBulkLoading, setIsBulkLoading] = useState(false);

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

  const filteredTransactions = (transactions as Transaction[])?.filter(tx => 
    tx.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.amount.toString().includes(searchQuery) ||
    tx.splits.some(s => s.memo?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <div className="transactions-actions animate-fade-in" style={{ animationDelay: '0.15s', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
            variant={showAll ? "primary" : "glass"} 
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "📜 All History" : "📥 Inbox (Uncategorized)"}
          </Button>
          
          {Object.keys(suggestions).length > 0 && (
            <Button 
              variant="glass" 
              onClick={handleApplyAllSuggestions}
              disabled={isBulkLoading}
            >
              {isBulkLoading ? "✅ Applying..." : "✅ Apply All AI"}
            </Button>
          )}
          <Button 
            variant="glass" 
            onClick={handleAiCategorize} 
            disabled={isAiLoading || isLoading}
          >
            {isAiLoading ? "✨ Thinking..." : "✨ Suggest Categories"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="transactions-list glass skeleton animate-fade-in" style={{ minHeight: '400px' }}></div>
      ) : (
        <TransactionList 
          transactions={filteredTransactions || []}
          categories={categories}
          suggestions={suggestions}
          onCategorized={() => {
            refresh();
          }}
        />
      )}
    </>
  );
}
