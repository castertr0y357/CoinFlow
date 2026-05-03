import Card from "@/components/ui/Card";
import TransactionRow from "@/app/transactions/TransactionRow";
import { Category, Transaction } from "@/types";

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  suggestions?: Record<string, string>;
  onCategorized?: () => void;
}

export default function TransactionList({ 
  transactions, 
  categories, 
  suggestions = {},
  onCategorized 
}: TransactionListProps) {
  return (
    <Card className="transactions-list animate-fade-in" delay="0.2s">
      <div className="tx-list-header">
        <div className="tx-header-main">
          <span style={{ flex: 1 }}>Date</span>
          <span style={{ flex: 2 }}>Payee</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Amount</span>
        </div>
        <div className="tx-header-splits">
          Categorization
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">
          <p className="text-muted">No transactions found. Sync your bank to get started.</p>
        </div>
      ) : (
        <div className="tx-items">
          {transactions.map(tx => (
            <TransactionRow 
              key={tx.id} 
              tx={tx} 
              categories={categories} 
              suggestion={suggestions[tx.id]}
              onCategorized={onCategorized}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
