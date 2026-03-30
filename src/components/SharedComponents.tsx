import React from 'react';
import type { DecisionLevel } from '../types';
import { DECISION_BG_COLORS, DECISION_TEXT_COLORS, DECISION_BORDER_COLORS } from '../types';

interface DecisionLevelBadgeProps {
  level: DecisionLevel;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const DecisionLevelBadge: React.FC<DecisionLevelBadgeProps> = ({
  level,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-md border ${DECISION_BG_COLORS[level]} ${DECISION_TEXT_COLORS[level]} ${DECISION_BORDER_COLORS[level]} font-semibold inline-flex items-center gap-2 transition-all ${className}`}
    >
      <span>{level}</span>
      <span className="sr-only">{`Decision Level: ${level}`}</span>
    </div>
  );
};

interface ProgressBarProps {
  value: number;
  min?: number;
  max?: number;
  color?: string;
  height?: string;
  showValue?: boolean;
  valueFormatter?: (v: number) => string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  min = 0,
  max = 1,
  color,
  height = '0.5rem',
  showValue = false,
  valueFormatter,
}) => {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  
  let bgColor = color;
  if (!bgColor) {
    if (percentage < 33) bgColor = '#00ff41';
    else if (percentage < 66) bgColor = '#ffd700';
    else bgColor = '#ff4444';
  }

  const displayValue = valueFormatter ? valueFormatter(value) : `${percentage.toFixed(0)}%`;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-full" style={{ height }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            backgroundColor: bgColor,
          }}
        />
      </div>
      {showValue && <p className="text-xs text-gray-400 w-12 text-right">{displayValue}</p>}
    </div>
  );
};

interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'error' | 'success';
  label?: string;
  pulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  pulse = false,
}) => {
  const statusColors = {
    active: '#00ff41',
    warning: '#ffa500',
    error: '#ff4444',
    success: '#00ff41',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full ${pulse ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: statusColors[status] }}
      />
      {label && <p className="text-xs text-gray-400">{label}</p>}
    </div>
  );
};

interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  size?: number;
}

export const Gauge: React.FC<GaugeProps> = ({
  value,
  min = 0,
  max = 100,
  label,
  unit,
  size = 120,
}) => {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  let color = '#00ff41';
  if (percentage > 66) color = '#ff4444';
  else if (percentage > 33) color = '#ffa500';

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }} className="relative">
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 0 10px rgba(0, 217, 255, 0.2))' }}
        >
          {/* Background arc */}
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="#1a2332"
            strokeWidth="8"
            pathLength="100"
            strokeDasharray={`${(percentage / 100) * 235.62} 235.62`}
          />
          {/* Value arc */}
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={color}
            strokeWidth="6"
            pathLength="100"
            strokeDasharray={`${(percentage / 100) * 235.62} 235.62`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold" style={{ color }}>
            {value.toFixed(0)}
          </p>
          {unit && <p className="text-xs text-gray-500">{unit}</p>}
        </div>
      </div>
      {label && <p className="text-sm text-gray-400">{label}</p>}
    </div>
  );
};

interface StatsCardProps {
  icon?: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`glass rounded-lg p-4 cursor-pointer hover:bg-dark-700 hover:bg-opacity-50 transition-all ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-100">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <div className="text-neon-cyan ml-4">{icon}</div>}
      </div>
    </div>
  );
};
