import { AlertCircle, Info, Loader2 } from 'lucide-react';
import React from 'react';

const ICONS = {
  loading: Loader2,
  error: AlertCircle,
  info: Info,
};

export default function StateMessage({ variant = 'info', children }) {
  const Icon = ICONS[variant] || ICONS.info;
  const color =
    variant === 'error'
      ? 'text-red-200'
      : variant === 'loading'
      ? 'text-white/80'
      : 'text-white/80';

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-sm">
      <Icon className={color} size={18} strokeWidth={2.2} />
      <span className={color}>{children}</span>
    </div>
  );
}
