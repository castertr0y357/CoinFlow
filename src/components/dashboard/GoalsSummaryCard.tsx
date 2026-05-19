"use client";

import useSWR from 'swr';
import Card from "@/components/ui/Card";
import Link from "next/link";
import { GoalPayload } from "@/lib/services/goalService";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function GoalsSummaryCard() {
  const { data, error, isLoading } = useSWR("/api/v1/goals", fetcher);

  if (isLoading) {
    return (
      <Card className="dashboard-goals-summary glass skeleton">
        <div style={{ height: "140px" }}></div>
      </Card>
    );
  }

  if (error || !data || !data.goals) {
    return null;
  }

  const activeGoals: GoalPayload[] = data.goals.filter((g: GoalPayload) => !g.isCompleted);
  if (activeGoals.length === 0) {
    return (
      <Card className="dashboard-goals-summary glass">
        <div className="summary-header">
          <h3>Savings Goals 🎯</h3>
        </div>
        <p className="text-muted text-sm mt-4 text-center">No active savings goals. Set a timeline to stay motivated!</p>
        <div className="summary-footer">
          <Link href="/goals" className="view-all-link">Create Goal →</Link>
        </div>
      </Card>
    );
  }

  // Get top 3 active goals
  const topGoals = activeGoals.slice(0, 3);
  
  // Calculate total active progress
  const totalTarget = activeGoals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalSaved = activeGoals.reduce((acc, g) => acc + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 
    ? Math.min(100, Math.round((totalSaved / totalTarget) * 100))
    : 0;

  // Helper for progress bar color
  const getProgressBarColor = (percent: number) => {
    if (percent < 30) return "var(--danger)";
    if (percent < 75) return "var(--warning)";
    return "var(--accent)";
  };

  return (
    <Card className="dashboard-goals-summary glass">
      <div className="summary-header">
        <h3>Savings Goals 🎯</h3>
        <span className="text-muted text-xs" style={{ opacity: 0.8 }}>{activeGoals.length} active</span>
      </div>

      <div className="summary-progress-section mt-4" style={{ marginBottom: "1rem" }}>
        <div className="summary-progress-row">
          <span className="text-dim text-xs font-semibold" style={{ letterSpacing: "0.05em" }}>OVERALL PROGRESS</span>
          <span className="font-bold text-xs" style={{ color: "var(--accent)" }}>{overallProgress}%</span>
        </div>
        <div className="summary-goal-progress-bar" style={{ width: "100%", height: "8px", marginTop: "0.25rem" }}>
          <div 
            className="summary-goal-progress-fill" 
            style={{ 
              width: `${overallProgress}%`, 
              background: "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)" 
            }}
          ></div>
        </div>
      </div>

      <div className="summary-items-list" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {topGoals.map(goal => (
          <div key={goal.id} className="summary-goal-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem" }}>
            <div className="summary-goal-info" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "1.1rem" }}>{goal.icon}</span>
              <span className="summary-goal-name" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={goal.name}>
                {goal.name}
              </span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              <div className="summary-goal-progress-bar" style={{ width: "60px", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                <div 
                  className="summary-goal-progress-fill" 
                  style={{ 
                    height: "100%",
                    width: `${goal.progressPercentage}%`, 
                    backgroundColor: getProgressBarColor(goal.progressPercentage) 
                  }}
                ></div>
              </div>
              <span className="summary-goal-percent" style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: "0.8rem", width: "32px", textAlign: "right" }}>
                {goal.progressPercentage}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="summary-footer" style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
        <Link href="/goals" className="view-all-link" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--primary)", transition: "var(--transition-fast)" }}>
          Manage Goals & Timelines →
        </Link>
      </div>
    </Card>
  );
}
