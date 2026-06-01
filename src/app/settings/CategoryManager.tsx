"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createCategory, deleteCategory, updateCategoryName } from "../categories/actions";

interface Category {
  id: string;
  name: string;
}

export default function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      await createCategory(newName);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateCategoryName(editingId, editName.trim());
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update category");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await deleteCategory(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  return (
    <div className="category-manager">
      <form onSubmit={handleAdd} className="add-category-form">
        <div className="flex-row">
          <Input 
            placeholder="New Category Name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={isSubmitting}
          />
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add"}
          </Button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </form>

      <div className="category-list">
        {initialCategories.map((cat) => (
          <div key={cat.id} className="category-item glass">
            {editingId === cat.id ? (
              <div className="edit-container">
                <Input 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)}
                  className="edit-input"
                />
                <div className="edit-actions">
                  <button onClick={handleSaveEdit} className="save-btn">Check</button>
                  <button onClick={() => setEditingId(null)} className="cancel-btn">X</button>
                </div>
              </div>
            ) : (
              <>
                <span className="cat-name">{cat.name}</span>
                <div className="cat-actions">
                  <button 
                    className="action-btn" 
                    onClick={() => handleEdit(cat.id, cat.name)}
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button 
                    className="action-btn delete" 
                    onClick={() => handleDelete(cat.id, cat.name)}
                    title="Delete Category"
                  >
                    🗑️
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .category-manager {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .flex-row {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
        }
        .error-text {
          color: var(--danger);
          font-size: 0.85rem;
          margin-top: 0.5rem;
        }
        .category-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.75rem;
        }
        .category-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          min-height: 50px;
        }
        .edit-container {
          display: flex;
          gap: 0.5rem;
          width: 100%;
          align-items: center;
        }
        .cat-actions {
          display: flex;
          gap: 0.5rem;
        }
        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .action-btn:hover {
          opacity: 1;
        }
        .action-btn.delete:hover {
          color: var(--danger);
        }
        .edit-actions {
          display: flex;
          gap: 0.25rem;
        }
        .save-btn, .cancel-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          border-radius: 4px;
          padding: 0.25rem 0.5rem;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .save-btn:hover { background: var(--primary); }
      `}</style>
    </div>
  );
}
