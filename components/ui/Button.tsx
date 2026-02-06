import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantClass = variant === 'primary' ? 'pw-btn-primary' : 'pw-btn-secondary';

  return (
    <button
      className={`pw-btn ${variantClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="pw-spinner" />}
      {children}
    </button>
  );
}
