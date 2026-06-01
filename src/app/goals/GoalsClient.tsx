"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { 
  addGoalAction, 
  updateGoalAction, 
  deleteGoalAction, 
  adjustManualGoalAmountAction 
} from "./actions";
import { GoalPayload } from "@/lib/services/goalService";
import "./Goals.css";

interface GoalsClientProps {
  initialGoals: GoalPayload[];
  categories: { id: string; name: string }[];
  unassignedSurplus?: number;
  totalCategoryBalances?: number;
}

export default function GoalsClient({ 
  initialGoals, 
  categories,
  unassignedSurplus = 0,
  totalCategoryBalances = 0
}: GoalsClientProps) {
  const [goals, setGoals] = useState<GoalPayload[]>(initialGoals);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [isAdding, setIsAdding] = useState(false);
  
  // Add Goal Form State
  const [addForm, setAddForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
    categoryId: "",
    createCategory: false
  });

  // Edit Goal Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    targetAmount: "",
    targetDate: "",
    categoryId: ""
  });

  // Manual Funding Adjustment Inputs state
  const [adjustAmounts, setAdjustAmounts] = useState<Record<string, string>>({});

  // Dynamic state syncing after server actions
  const refreshState = async () => {
    try {
      const res = await fetch("/api/v1/goals");
      if (res.ok) {
        const data = await res.json();
        if (data.goals) setGoals(data.goals);
      }
    } catch {
      // Fallback: window refresh
      window.location.reload();
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.targetAmount) return;

    const targetDate = addForm.targetDate ? new Date(addForm.targetDate) : null;
    await addGoalAction({
      name: addForm.name,
      targetAmount: Number(addForm.targetAmount),
      currentAmount: addForm.categoryId ? 0 : Number(addForm.currentAmount || 0),
      targetDate,
      categoryId: addForm.categoryId || null,
      createCategory: addForm.createCategory
    });

    setAddForm({
      name: "",
      targetAmount: "",
      currentAmount: "",
      targetDate: "",
      categoryId: "",
      createCategory: false
    });
    setIsAdding(false);
    await refreshState();
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.name || !editForm.targetAmount) return;

    const targetDate = editForm.targetDate ? new Date(editForm.targetDate) : null;
    await updateGoalAction(id, {
      name: editForm.name,
      targetAmount: Number(editForm.targetAmount),
      targetDate,
      categoryId: editForm.categoryId || null
    });

    setEditingId(null);
    await refreshState();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this savings goal?")) {
      await deleteGoalAction(id);
      await refreshState();
    }
  };

  const handleToggleComplete = async (goal: GoalPayload) => {
    await updateGoalAction(goal.id, {
      isCompleted: !goal.isCompleted
    });
    await refreshState();
  };

  const handleAdjustManual = async (id: string, isAddingFunds: boolean) => {
    const inputVal = adjustAmounts[id] || "";
    const amount = Number(inputVal);
    if (isNaN(amount) || amount <= 0) return;

    const signedAmount = isAddingFunds ? amount : -amount;
    await adjustManualGoalAmountAction(id, signedAmount);
    
    setAdjustAmounts(prev => ({ ...prev, [id]: "" }));
    await refreshState();
  };

  const startEditing = (goal: GoalPayload) => {
    setEditingId(goal.id);
    let formattedDate = "";
    if (goal.targetDate) {
      const d = new Date(goal.targetDate);
      formattedDate = d.toISOString().split("T")[0];
    }

    setEditForm({
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      targetDate: formattedDate,
      categoryId: goal.categoryId || ""
    });
  };

  // Tallies
  const activeGoalsList = goals.filter(g => !g.isCompleted);
  const completedGoalsList = goals.filter(g => g.isCompleted);

  const totalTarget = activeGoalsList.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalSaved = activeGoalsList.reduce((acc, g) => acc + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 
    ? Math.min(100, Math.round((totalSaved / totalTarget) * 100))
    : 0;

  // Filtered list to display in cards grid
  const displayedGoals = goals.filter(g => {
    if (filter === "active") return !g.isCompleted;
    if (filter === "completed") return g.isCompleted;
    return true;
  });

  // Timeline Roadmap Goals: Filter items with target dates and sort chronologically
  const roadmapGoals = goals
    .filter(g => g.targetDate)
    .sort((a, b) => {
      const dateA = a.targetDate ? new Date(a.targetDate).getTime() : 0;
      const dateB = b.targetDate ? new Date(b.targetDate).getTime() : 0;
      return dateA - dateB;
    });

  // Helper to format date nicely
  const formatDate = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  // Helper to get remaining text
  const getTimelineText = (goal: GoalPayload) => {
    if (goal.isCompleted) return "🎉 Goal Reached!";
    if (!goal.targetDate) return "∞ No Timeline";
    
    if (goal.monthsRemaining === 0) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const target = new Date(goal.targetDate);
      target.setHours(0, 0, 0, 0);
      if (target.getTime() < now.getTime()) {
        return "⚠️ Overdue";
      }
      return "📅 Due this month";
    }
    
    return `📅 ${goal.monthsRemaining} ${goal.monthsRemaining === 1 ? 'month' : 'months'} left`;
  };

  // Helper to get progress bar style based on percentage
  const getProgressStyles = (percent: number, completed: boolean) => {
    if (completed) {
      return {
        color: "var(--accent)",
        background: "linear-gradient(90deg, var(--accent) 0%, #34d399 100%)"
      };
    }
    if (percent < 30) {
      return {
        color: "var(--danger)",
        background: "linear-gradient(90deg, var(--danger) 0%, var(--warning) 100%)"
      };
    }
    if (percent < 75) {
      return {
        color: "var(--warning)",
        background: "linear-gradient(90deg, var(--warning) 0%, var(--primary) 100%)"
      };
    }
    return {
      color: "var(--primary)",
      background: "linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)"
    };
  };

  return (
    <div className="goals-workspace">
      
      {/* 1. Statistics Overview Cards */}
      <div className="goals-stats">
        <Card className="stat-card glass" animate={true}>
          <span className="stat-label">Active Savings Progress</span>
          <div className="stat-value accent">${totalSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <p className="text-muted text-sm mt-2">Saved out of a total target of ${totalTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}.</p>
        </Card>

        <Card className="stat-card savings glass" animate={true} delay="0.1s">
          <span className="stat-label">Total Saving Rate</span>
          <div className="stat-value">{overallProgress}%</div>
          <div className="goal-progress-bar-container" style={{ height: "6px", marginTop: "0.25rem", background: "rgba(255,255,255,0.03)" }}>
            <div className="goal-progress-bar-fill" style={{ width: `${overallProgress}%`, background: "linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)" }}></div>
          </div>
          <p className="text-muted text-sm mt-2">Combined progress across all active goals.</p>
        </Card>

        <Card className="stat-card glass" animate={true} delay="0.2s">
          <span className="stat-label">Total Category Balances</span>
          <div className="stat-value" style={{ color: "var(--primary)" }}>
            ${totalCategoryBalances.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-muted text-sm mt-2">Combined balance across all your budget categories.</p>
        </Card>

        <Card className="stat-card glass" animate={true} delay="0.3s">
          <span className="stat-label">Available to Fund</span>
          <div className={`stat-value ${unassignedSurplus > 0 ? 'accent' : ''}`}>
            ${unassignedSurplus.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-muted text-sm mt-2">Unassigned money ready to be allocated to your goals.</p>
        </Card>

        <Card className="stat-card glass" animate={true} delay="0.4s">
          <span className="stat-label">Milestone Tracking</span>
          <div className="stat-value">{activeGoalsList.length} / {goals.length}</div>
          <p className="text-muted text-sm mt-2">{completedGoalsList.length} goal(s) reached and archived.</p>
        </Card>
      </div>

      {/* 2. Timeline Roadmap */}
      {roadmapGoals.length > 0 && (
        <Card className="timeline-roadmap-section glass animate-fade-in">
          <div className="roadmap-header">
            <h2>Timeline & Upcoming Milestones 🗺️</h2>
            <span className="text-muted text-sm">{roadmapGoals.length} scheduled purchase(s)</span>
          </div>
          <div className="roadmap-track-container">
            <div className="roadmap-track">
              {roadmapGoals.map((g) => {
                const dateObj = g.targetDate ? new Date(g.targetDate) : null;
                const dateLabel = dateObj 
                  ? dateObj.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: 'UTC' }) 
                  : "";
                return (
                  <div key={g.id} className={`roadmap-node ${g.isCompleted ? "completed" : ""}`}>
                    <span className="node-date">{dateLabel}</span>
                    <div className="node-point">
                      {g.isCompleted ? "✓" : g.icon}
                    </div>
                    <div className="node-info">
                      <div className="node-title" title={g.name}>{g.name}</div>
                      <div className="node-cost">${g.targetAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* 3. Action Filters & Add Goal Action Bar */}
      <div className="goals-actions">
        <div className="filters-group">
          <button 
            className={`filter-btn ${filter === "active" ? "active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active Goals ({activeGoalsList.length})
          </button>
          <button 
            className={`filter-btn ${filter === "completed" ? "active" : ""}`}
            onClick={() => setFilter("completed")}
          >
            Completed ({completedGoalsList.length})
          </button>
          <button 
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Goals ({goals.length})
          </button>
        </div>

        <Button variant="primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "✕ Close Form" : "＋ Add Savings Goal"}
        </Button>
      </div>

      {/* 4. Sleek Creator Form Card */}
      {isAdding && (
        <Card className="add-goal-card glass animate-slide-up">
          <h3>Create a New Savings Goal</h3>
          <form onSubmit={handleAdd} className="goal-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Goal Name</label>
                <input 
                  type="text" 
                  value={addForm.name} 
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })} 
                  placeholder="e.g. Hawaii Trip, New Gaming PC" 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label>Target Amount ($)</label>
                <input 
                  type="number" 
                  step="1"
                  min="1"
                  value={addForm.targetAmount} 
                  onChange={e => setAddForm({ ...addForm, targetAmount: e.target.value })} 
                  placeholder="e.g. 1500" 
                  required 
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Target Timeline Date (Optional)</label>
                <input 
                  type="date" 
                  value={addForm.targetDate} 
                  onChange={e => setAddForm({ ...addForm, targetDate: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label>Link to Budget Category</label>
                <select 
                  value={addForm.categoryId} 
                  onChange={e => setAddForm({ ...addForm, categoryId: e.target.value, createCategory: false })}
                >
                  <option value="">Manually Tracked (No linked category)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {!addForm.categoryId && (
              <div className="form-grid" style={{ alignItems: "center" }}>
                <div className="form-group">
                  <label>Initial Saved Amount ($)</label>
                  <input 
                    type="number" 
                    step="1"
                    min="0"
                    value={addForm.currentAmount} 
                    onChange={e => setAddForm({ ...addForm, currentAmount: e.target.value })} 
                    placeholder="e.g. 200" 
                  />
                </div>

                <div className="form-group" style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={addForm.createCategory} 
                      onChange={e => setAddForm({ ...addForm, createCategory: e.target.checked })} 
                    />
                    Auto-create a budget category for this goal
                  </label>
                </div>
              </div>
            )}

            <div className="form-actions">
              <Button type="submit" variant="primary">Add Goal</Button>
              <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* 5. Goals Card Grid */}
      {displayedGoals.length === 0 ? (
        <Card className="empty-state glass">
          <div className="icon">🎯</div>
          <h3>No goals found</h3>
          <p className="text-muted mt-1">
            {filter === "active" 
              ? "You've crushed all your savings goals! Time to add another?" 
              : filter === "completed" 
                ? "Goals you mark as completed will show up here to showcase your achievements." 
                : "Get started by adding a purchase, project, or trip above."}
          </p>
        </Card>
      ) : (
        <div className="goals-grid">
          {displayedGoals.map((goal) => {
            const isEditing = editingId === goal.id;
            const progressMeta = getProgressStyles(goal.progressPercentage, goal.isCompleted);
            const isOverdue = goal.targetDate && goal.monthsRemaining === 0 && new Date(goal.targetDate).getTime() < new Date().getTime();

            return (
              <Card 
                key={goal.id} 
                className={`goal-card glass ${goal.isCompleted ? "completed" : ""}`}
                animate={true}
              >
                {/* Visual Bottom Border Progress Indicator */}
                <div className="goal-card-glow">
                  <div 
                    className="goal-card-glow-fill" 
                    style={{ 
                      width: `${goal.progressPercentage}%`, 
                      background: progressMeta.background 
                    }}
                  ></div>
                </div>

                {isEditing ? (
                  /* INLINE EDIT MODE */
                  <form onSubmit={(e) => { e.preventDefault(); handleUpdate(goal.id); }} className="goal-edit-form">
                    <h4>Edit Goal Details</h4>
                    
                    <div className="form-group">
                      <label>Goal Name</label>
                      <input 
                        type="text" 
                        value={editForm.name} 
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label>Target Amount ($)</label>
                      <input 
                        type="number" 
                        value={editForm.targetAmount} 
                        onChange={e => setEditForm({ ...editForm, targetAmount: e.target.value })} 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label>Target Date</label>
                      <input 
                        type="date" 
                        value={editForm.targetDate} 
                        onChange={e => setEditForm({ ...editForm, targetDate: e.target.value })} 
                      />
                    </div>

                    <div className="form-group">
                      <label>Category Map</label>
                      <select 
                        value={editForm.categoryId} 
                        onChange={e => setEditForm({ ...editForm, categoryId: e.target.value })}
                      >
                        <option value="">Manually Tracked</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="form-actions">
                      <Button type="submit" variant="primary">Save</Button>
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  /* STANDARD CARD VIEW */
                  <>
                    <div className="goal-card-header">
                      <div className="goal-icon-title">
                        <div className="goal-avatar" style={{ color: progressMeta.color }}>
                          {goal.icon}
                        </div>
                        <div className="goal-details">
                          <span className="goal-title">{goal.name}</span>
                          <span className={`goal-timeline-badge ${isOverdue ? "overdue" : ""}`}>
                            {getTimelineText(goal)}
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        className={`goal-checkbox-complete ${goal.isCompleted ? "checked" : ""}`}
                        onClick={() => handleToggleComplete(goal)}
                        title={goal.isCompleted ? "Mark Goal Active" : "Mark Goal Reached!"}
                      >
                        ✓
                      </button>
                    </div>

                    {/* Progress Meter */}
                    <div className="goal-progress-section">
                      <div className="progress-header-values">
                        <div>
                          <span className="progress-current-amount">${goal.currentAmount.toLocaleString()}</span>
                          <span className="progress-target-amount"> of ${goal.targetAmount.toLocaleString()}</span>
                        </div>
                        <span className="progress-percentage-label" style={{ color: progressMeta.color }}>
                          {goal.progressPercentage}%
                        </span>
                      </div>
                      
                      <div className="goal-progress-bar-container">
                        <div 
                          className="goal-progress-bar-fill" 
                          style={{ 
                            width: `${goal.progressPercentage}%`, 
                            background: progressMeta.background 
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Timeline Rates & Mappings */}
                    <div className="goal-funding-section">
                      <div className="funding-row">
                        <span>Timeline Date:</span>
                        <span className="funding-value">
                          {goal.targetDate ? formatDate(goal.targetDate) : "None (Flexible)"}
                        </span>
                      </div>
                      
                      {!goal.isCompleted && goal.targetDate && goal.recommendedMonthlyRate > 0 && (
                        <div className="funding-row">
                          <span>Recommend Saving:</span>
                          <span className="funding-value recommendation">
                            ${goal.recommendedMonthlyRate.toLocaleString()}/mo
                          </span>
                        </div>
                      )}

                      <div className="funding-row">
                        <span>Funding Source:</span>
                        <span className={`funding-badge ${goal.categoryId ? "linked" : ""}`}>
                          {goal.categoryId 
                            ? `🔗 Category: ${goal.categoryName || 'Linked'}` 
                            : "📥 Manually Funded"}
                        </span>
                      </div>
                    </div>

                    {/* Actions and Manual Funding adjustments */}
                    <div className="goal-card-actions">
                      {!goal.categoryId && !goal.isCompleted ? (
                        <div className="manual-adjustments">
                          <button 
                            className="adjust-btn minus" 
                            onClick={() => handleAdjustManual(goal.id, false)}
                            title="Withdraw Funds"
                          >
                            －
                          </button>
                          <input 
                            type="text" 
                            className="adjust-input" 
                            placeholder="$0"
                            value={adjustAmounts[goal.id] || ""}
                            onChange={e => setAdjustAmounts({ ...adjustAmounts, [goal.id]: e.target.value })}
                          />
                          <button 
                            className="adjust-btn plus" 
                            onClick={() => handleAdjustManual(goal.id, true)}
                            title="Add Funds"
                          >
                            ＋
                          </button>
                        </div>
                      ) : (
                        <div style={{ flex: 1 }}></div> /* placeholder for aligned flex */
                      )}

                      <div className="card-control-btns">
                        <button className="control-btn" onClick={() => startEditing(goal)}>Edit</button>
                        <button className="control-btn delete" onClick={() => handleDelete(goal.id)}>Delete</button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
