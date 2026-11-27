"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useNotification } from "@/components/ui/NotificationProvider";
import {
  createCategory,
  deleteCategory,
  updateCategoryName,
  archiveCategoryAction,
  getCategoryMergePreviewAction,
  mergeCategoriesAction,
} from "../categories/actions";

interface Category {
  id: string;
  name: string;
  isArchived?: boolean;
}

interface MergePreview {
  sourceId: string;
  sourceName: string;
  splitCount: number;
  commitmentCount: number;
  goalCount: number;
  yearlyConfigCount: number;
}

export default function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const { showToast, confirm } = useNotification();
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Merge state
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [isMerging, setIsMerging] = useState(false);

  const activeCategories = initialCategories.filter((c) => !c.isArchived);
  const archivedCategories = initialCategories.filter((c) => !!c.isArchived);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      await createCategory(newName);
      setNewName("");
      showToast(`Category "${newName.trim()}" created`, "success");
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
      showToast("Category renamed", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update category", "error");
    }
  };

  const handleToggleArchive = async (cat: Category) => {
    setBusyId(cat.id);
    try {
      const nextArchived = !cat.isArchived;
      await archiveCategoryAction(cat.id, nextArchived);
      showToast(
        nextArchived
          ? `Archived "${cat.name}" (hidden from active budget, preserved in history)`
          : `Restored "${cat.name}" to active budget`,
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update category", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleStartMerge = async (cat: Category) => {
    setBusyId(cat.id);
    try {
      const preview = await getCategoryMergePreviewAction(cat.id);
      setMergePreview(preview);
      const firstTarget = activeCategories.find((c) => c.id !== cat.id) || initialCategories.find((c) => c.id !== cat.id);
      setMergeTargetId(firstTarget?.id || "");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load merge preview", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergePreview || !mergeTargetId) return;
    setIsMerging(true);
    try {
      const res = await mergeCategoriesAction(mergePreview.sourceId, mergeTargetId);
      showToast(
        `Merged "${res.sourceName}" into "${res.targetName}" (${res.splitsMoved} transactions moved)`,
        "success"
      );
      setMergePreview(null);
      setMergeTargetId("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to merge categories", "error");
    } finally {
      setIsMerging(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    confirm({
      title: "Delete Category",
      message: `Are you sure you want to permanently delete "${name}"? Categories with transactions cannot be deleted — use Archive or Merge instead.`,
      onConfirm: async () => {
        setBusyId(id);
        try {
          await deleteCategory(id);
          showToast(`Deleted "${name}"`, "success");
        } catch (err) {
          showToast(err instanceof Error ? err.message : "Failed to delete category", "error");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const renderCategoryCard = (cat: Category) => (
    <div key={cat.id} className={`category-item glass ${cat.isArchived ? "archived-item" : ""}`}>
      {editingId === cat.id ? (
        <div className="edit-container">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="edit-input"
          />
          <div className="edit-actions">
            <button onClick={handleSaveEdit} className="save-btn">✓</button>
            <button onClick={() => setEditingId(null)} className="cancel-btn">✕</button>
          </div>
        </div>
      ) : (
        <>
          <span className="cat-name" title={cat.name}>{cat.name}</span>
          <div className="cat-actions">
            <button
              className="action-btn"
              onClick={() => handleEdit(cat.id, cat.name)}
              disabled={busyId === cat.id}
              title="Rename"
            >
              ✏️
            </button>
            <button
              className="action-btn"
              onClick={() => handleStartMerge(cat)}
              disabled={busyId === cat.id || initialCategories.length < 2}
              title="Merge into another category"
            >
              🔀
            </button>
            <button
              className="action-btn"
              onClick={() => handleToggleArchive(cat)}
              disabled={busyId === cat.id}
              title={cat.isArchived ? "Restore to active budget" : "Archive (hide from current year, keep history)"}
            >
              {cat.isArchived ? "♻️" : "📦"}
            </button>
            <button
              className="action-btn delete"
              onClick={() => handleDelete(cat.id, cat.name)}
              disabled={busyId === cat.id}
              title="Delete Category"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );

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

      {mergePreview && (
        <div className="merge-panel glass animate-fade-in">
          <div className="merge-panel-header">
            <strong>🔀 Merge &ldquo;{mergePreview.sourceName}&rdquo; into another category</strong>
            <button type="button" className="cancel-btn" onClick={() => setMergePreview(null)}>✕</button>
          </div>
          <p className="merge-summary">
            This will move <strong>{mergePreview.splitCount}</strong> transaction splits,{" "}
            <strong>{mergePreview.commitmentCount}</strong> commitments,{" "}
            <strong>{mergePreview.goalCount}</strong> goals, and sum{" "}
            <strong>{mergePreview.yearlyConfigCount}</strong> yearly budget configs, then delete{" "}
            <strong>{mergePreview.sourceName}</strong>.
          </p>
          <div className="merge-controls">
            <select
              className="settings-select"
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              disabled={isMerging}
            >
              {initialCategories
                .filter((c) => c.id !== mergePreview.sourceId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.isArchived ? " (Archived)" : ""}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmMerge}
              disabled={isMerging || !mergeTargetId}
            >
              {isMerging ? "Merging..." : "Confirm Merge"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMergePreview(null)} disabled={isMerging}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="category-list">
        {activeCategories.map(renderCategoryCard)}
      </div>

      {archivedCategories.length > 0 && (
        <details className="archived-section">
          <summary>
            📦 Archived / Past-Year Categories ({archivedCategories.length})
          </summary>
          <div className="category-list" style={{ marginTop: "0.9rem" }}>
            {archivedCategories.map(renderCategoryCard)}
          </div>
        </details>
      )}

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
        .merge-panel {
          padding: 1.15rem 1.25rem;
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.4);
          background: rgba(99, 102, 241, 0.08);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .merge-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.95rem;
          color: var(--text-main);
        }
        .merge-summary {
          font-size: 0.85rem;
          color: var(--text-dim);
          margin: 0;
          line-height: 1.45;
        }
        .merge-controls {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .merge-controls select {
          flex: 1;
          min-width: 220px;
        }
        .category-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 0.75rem;
        }
        .category-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 0.9rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          min-height: 48px;
          overflow: hidden;
        }
        .category-item.archived-item {
          opacity: 0.72;
          border-style: dashed;
        }
        .cat-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.92rem;
          font-weight: 500;
        }
        .edit-container {
          display: flex;
          gap: 0.5rem;
          width: 100%;
          align-items: center;
        }
        .cat-actions {
          display: flex;
          gap: 0.35rem;
          flex-shrink: 0;
        }
        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.95rem;
          opacity: 0.65;
          transition: opacity 0.2s;
          padding: 2px;
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
        .archived-section {
          border-top: 1px dashed var(--glass-border);
          padding-top: 1rem;
        }
        .archived-section summary {
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-dim);
          user-select: none;
        }
      `}</style>
    </div>
  );
}
