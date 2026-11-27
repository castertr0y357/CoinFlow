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
          <div className="cat-edit-container">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="edit-input"
            />
            <div className="cat-edit-actions">
              <button type="button" onClick={handleSaveEdit} className="cat-save-btn" title="Save">✓</button>
              <button type="button" onClick={() => setEditingId(null)} className="cat-cancel-btn" title="Cancel">✕</button>
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
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
        <div className="category-merge-panel glass animate-fade-in">
          <div className="category-merge-header">
            <strong>🔀 Merge &ldquo;{mergePreview.sourceName}&rdquo; into another category</strong>
            <button type="button" className="cat-cancel-btn" onClick={() => setMergePreview(null)}>✕</button>
          </div>
          <p className="category-merge-summary">
            This will move <strong>{mergePreview.splitCount}</strong> transaction splits,{" "}
            <strong>{mergePreview.commitmentCount}</strong> commitments,{" "}
            <strong>{mergePreview.goalCount}</strong> goals, and sum{" "}
            <strong>{mergePreview.yearlyConfigCount}</strong> yearly budget configs, then delete{" "}
            <strong>{mergePreview.sourceName}</strong>.
          </p>
          <div className="category-merge-controls">
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
    </div>
  );
}
