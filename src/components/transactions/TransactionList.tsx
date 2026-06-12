import Card from "@/components/ui/Card";
import TransactionRow from "@/app/transactions/TransactionRow";
import { Category, Transaction } from "@/types";

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  suggestions?: Record<string, string>;
  onCategorized?: () => void;
  selectedIds?: Set<string>;
  onSelectionToggle?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  sortBy?: 'date' | 'amount' | 'payee';
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: 'date' | 'amount' | 'payee') => void;
  aiEnabled?: boolean;
}

function SortIcon({ field, sortBy, sortOrder }: { field: 'date' | 'amount' | 'payee'; sortBy?: 'date' | 'amount' | 'payee'; sortOrder?: 'asc' | 'desc' }) {
  if (sortBy !== field) return <span className="sort-icon-placeholder">↕️</span>;
  return <span className="sort-icon active">{sortOrder === 'asc' ? '🔼' : '🔽'}</span>;
}

export default function TransactionList({ 
  transactions, 
  categories, 
  suggestions = {},
  onCategorized,
  selectedIds = new Set(),
  onSelectionToggle,
  onSelectAll,
  sortBy,
  sortOrder,
  onSort,
  aiEnabled = false
}: TransactionListProps) {
  const allSelected = transactions.length > 0 && transactions.every(tx => selectedIds.has(tx.id));

  return (
    <Card className="transactions-list animate-fade-in" delay="0.2s">
      <div className="tx-list-header">
        <div className="tx-checkbox-cell">
          <input 
            type="checkbox" 
            className="tx-checkbox" 
            checked={allSelected}
            onChange={(e) => onSelectAll?.(e.target.checked)}
          />
        </div>
        <div className="tx-header-main">
          <span 
            className={`sortable-header ${sortBy === 'date' ? 'active' : ''}`} 
            style={{ flex: 1, cursor: 'pointer' }}
            onClick={() => onSort?.('date')}
          >
            Date <SortIcon field="date" sortBy={sortBy} sortOrder={sortOrder} />
          </span>
          <span 
            className={`sortable-header ${sortBy === 'payee' ? 'active' : ''}`} 
            style={{ flex: 2, cursor: 'pointer' }}
            onClick={() => onSort?.('payee')}
          >
            Payee <SortIcon field="payee" sortBy={sortBy} sortOrder={sortOrder} />
          </span>
          <span 
            className={`sortable-header ${sortBy === 'amount' ? 'active' : ''}`} 
            style={{ flex: 1, textAlign: 'right', cursor: 'pointer' }}
            onClick={() => onSort?.('amount')}
          >
            Amount <SortIcon field="amount" sortBy={sortBy} sortOrder={sortOrder} />
          </span>
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
              isSelected={selectedIds.has(tx.id)}
              onSelectionToggle={onSelectionToggle}
              aiEnabled={aiEnabled}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
