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
  const trendColorClasses = {
    emerald: "text-emerald-500 bg-emerald-50",
    blue: "text-blue-500 bg-blue-50",
    red: "text-red-500 bg-red-50"
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined text-[24px]">{icon}</span>
        </div>
        {trendValue && (
          <span className={`text-sm font-medium flex items-center gap-1 px-2 py-1 rounded-full ${trendColorClasses[trendColor]}`}>
            <span className="material-symbols-outlined text-[16px]">{trendIcon}</span>
            {trendValue}
          </span>
        )}
      </div>
      <h3 className="text-3xl font-display font-bold text-slate-900 mb-1">{value}</h3>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
    </div>
  );
}
