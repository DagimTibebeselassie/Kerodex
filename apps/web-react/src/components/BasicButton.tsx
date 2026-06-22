import type { ButtonHTMLAttributes } from 'react';

interface BasicButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export function BasicButton({ variant = 'default', size: _size, className = '', type = 'button', ...props }: BasicButtonProps) {
  const variantClass = variant === 'outline'
    ? 'border border-border bg-background text-foreground hover:bg-muted'
    : variant === 'ghost'
      ? 'bg-transparent text-foreground hover:bg-muted'
      : 'border border-foreground bg-foreground text-background hover:opacity-90';
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${className}`}
      {...props}
    />
  );
}
