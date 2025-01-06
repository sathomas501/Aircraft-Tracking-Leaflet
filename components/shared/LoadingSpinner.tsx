// components/shared/LoadingSpinnert.tsx
import React from 'react';
import { cn } from '@/utils/cn';

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-3',
  lg: 'h-12 w-12 border-4',
  xl: 'h-16 w-16 border-4'
} as const;

const variantClasses = {
  primary: 'border-blue-200 border-t-blue-600',
  secondary: 'border-gray-200 border-t-gray-600',
  light: 'border-gray-100 border-t-white'
} as const;

type SpinnerSize = keyof typeof sizeClasses;
type SpinnerVariant = keyof typeof variantClasses;

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  message?: string;
  variant?: SpinnerVariant;
  overlay?: boolean;
}

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  function LoadingSpinner({ 
    size = 'md', 
    message, 
    variant = 'primary',
    overlay = false,
    className,
    ...props 
  }, ref) {
    const spinnerClasses = cn(
      'animate-spin rounded-full',
      sizeClasses[size],
      variantClasses[variant],
      'transition-all duration-200'
    );

    const messageClasses = cn(
      'mt-2 text-sm',
      {
        'text-gray-600': variant === 'primary' || variant === 'secondary',
        'text-gray-200': variant === 'light'
      }
    );

    const Spinner = () => (
      <div 
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center p-4",
          className
        )}
        {...props}
      >
        <div className={spinnerClasses} />
        {message && (
          <p className={messageClasses}>{message}</p>
        )}
      </div>
    );

    if (overlay) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <Spinner />
        </div>
      );
    }

    return <Spinner />;
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;