"use client";

import { useEffect, useRef, useState } from "react";
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Merge state
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [isMerging, setIsMerging] = useState(false);

  const activeCategories = initialCategories.filter((c) => !c.isArchived);
  const archivedCategories = initialCategories.filter((c) => !!c.isArchived);

  // Close kebab menu on outside click or Escape
  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

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
    setOpenMenuId(null);
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
    setOpenMenuId(null);
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
    setOpenMenuId(null);
    setBusyId(cat.id);
    try {
      const preview = await getCategoryMergePreviewAction(cat.id);
      setMergePreview(preview);
      const firstTarget =
        activeCategories.find((c) => c.id !== cat.id) ||
        initialCategories.find((c) => c.id !== cat.id);
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
    setOpenMenuId(null);
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

  const renderCategoryCard = (cat: Category) => {
    const isMenuOpen = openMenuId === cat.id;

    return (
      <div
        key={cat.id}
        className={`category-item glass ${cat.isArchived ? "archived-item" : ""} ${isMenuOpen ? "menu-open" : ""}`}
        ref={isMenuOpen ? menuContainerRef : undefined}
      >
        {editingId === cat.id ? (
          <div className="edit-container">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="edit-input"
            />
            <div className="edit-actions">
              <button onClick={handleSaveEdit} className="save-btn" title="Save">✓</button>
              <button onClick={() => setEditingId(null)} className="cancel-btn" title="Cancel">✕</button>
            </div>
          </div>
        ) : (
          <>
            <span className="cat-name" title={cat.name}>{cat.name}</span>
            <div className="kebab-wrapper">
              <button
                type="button"
                className="kebab-btn"
                onClick={() => setOpenMenuId(isMenuOpen ? null : cat.id)}
                disabled={busyId === cat.id}
                aria-label={`Actions for ${cat.name}`}
                aria-expanded={isMenuOpen}
                title="Category actions"
              >
                ⋮
              </button>

              {isMenuOpen && (
                <div className="kebab-menu glass animate-fade-in" role="menu">
                  <button type="button" className="kebab-item" onClick={() => handleEdit(cat.id, cat.name)}>
                    <span>✏️</span> Rename
                  </button>
                  <button
                    type="button"
                    className="kebab-item"
                    onClick={() => handleStartMerge(cat)}
                    disabled={initialCategories.length < 2}
                  >
                    <span>🔀</span> Merge into…
                  </button>
                  <button type="button" className="kebab-item" onClick={() => handleToggleArchive(cat)}>
                    <span>{cat.isArchived ? "♻️" : "📦"}</span>
                    {cat.isArchived ? "Restore" : "Archive"}
                  </button>
                  <div className="kebab-divider" />
                  <button
                    type="button"
                    className="kebab-item danger"
                    onClick={() => handleDelete(cat.id, cat.name)}
                  >
                    <span>🗑️</span> Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
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
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.75rem;
        }
        .category-item {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 0.85rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          min-height: 44px;
          overflow: visible;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .category-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .category-item.menu-open {
          z-index: 40;
          border-color: rgba(99, 102, 241, 0.45);
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
        .kebab-wrapper {
          position: relative;
          flex-shrink: 0;
        }
        .kebab-btn {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-dim);
          font-size: 1.15rem;
          line-height: 1;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .kebab-btn:hover,
        .category-item.menu-open .kebab-btn {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-main);
        }
        .kebab-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          min-width: 155px;
          padding: 0.35rem;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 50;
        }
        .kebab-item {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          width: 100%;
          padding: 0.45rem 0.65rem;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-main);
          font-size: 0.84rem;
          text-align: left;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .kebab-item:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
        }
        .kebab-item:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .kebab-item.danger {
          color: var(--danger);
        }
        .kebab-item.danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.14);
        }
        .kebab-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 3px 4px;
        }
        .edit-container {
          display: flex;
          gap: 0.5rem;
          width: 100%;
          align-items: center;
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
          outline: none;
        }
        .archived-section summary:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 4px;
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}
