import "./StatCard.css";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  type?: 'primary' | 'secondary' | 'accent' | 'danger' | 'warning';
  icon?: React.ReactNode;
}

export default function StatCard({ title, value, subtitle, type = 'primary', icon }: StatCardProps) {
  return (
    <div className={`stat-card glass animate-fade-in ${type}`}>
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        {icon && <div className="stat-icon">{icon}</div>}
      </div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );
}
