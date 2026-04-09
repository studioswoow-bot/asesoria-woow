import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  trendValue?: string;
  trendIcon?: string;
  trendColor?: "emerald" | "blue" | "red";
  subtext?: string;
}

export default function MetricCard({
  title,
  value,
  icon,
  trendValue,
  trendIcon = "trending_up",
  trendColor = "emerald",
  subtext
}: MetricCardProps) {
  const getTrendColorClass = () => {
    switch (trendColor) {
      case "blue": return "text-blue-500";
      case "red": return "text-red-500";
      default: return "text-emerald-500";
    }
  };

  return (
    <div className="bg-panel-dark border border-text-main/5 p-6 rounded-2xl shadow-lg shadow-black/10 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
        </div>
        {(trendValue || trendColor) && (
          <div className={`flex items-center gap-1 ${getTrendColorClass()} px-2 py-1 bg-current/5 rounded-full`}>
            {trendValue && <span className="text-[11px] font-bold">{trendValue}</span>}
            <span className="material-symbols-outlined text-sm">trending_up</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-bold text-text-muted mb-1">{title}</p>
        <h3 className="text-3xl font-display font-black text-text-main">{value}</h3>
        {subtext && <p className="text-[10px] text-text-muted mt-2 font-medium uppercase tracking-wider">{subtext}</p>}
      </div>
    </div>
  );
}
