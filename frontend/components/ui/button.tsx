import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

const variants = {
  primary: 'bg-emerald-300 text-slate-950 shadow-glow hover:bg-emerald-200',
  secondary: 'premium-border text-slate-100 hover:border-emerald-300/50 hover:bg-slate-900/80',
  ghost: 'text-slate-300 hover:bg-white/[.08] hover:text-white',
  danger: 'bg-red-500/[.15] text-red-200 border border-red-400/20 hover:bg-red-500/[.25]'
};

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base'
};

export function Button({ className, variant = 'secondary', size = 'md', ...props }: ButtonProps) {
  return <button className={cn('focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-60', variants[variant], sizes[size], className)} {...props} />;
}
