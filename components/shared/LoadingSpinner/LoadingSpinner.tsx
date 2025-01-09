import React from 'react';
import { cn } from '@/utils/cn';
import { sizeClasses, variantClasses } from './constants';
import type { LoadingSpinnerProps } from './types';

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  function LoadingSpinner({ 
    size = 'md', 
    message, 
    variant = 'primary',
    overlay = false,
    className,
    ...props 
  }, ref) {
    console.log('Rendering LoadingSpinner with message:', message);

    const spinnerClasses = cn(
      'animate-spin rounded-full border-4 border-t-transparent',
      sizeClasses[size],
      variantClasses[variant],
      'transition-all duration-200'
    );

    const messageClasses = cn(
      'mt-2 text-sm font-bold',
      {
        'text-gray-600': variant === 'primary' || variant === 'secondary',
        'text-gray-200': variant === 'light',
      }
    );

    const Spinner = () => (
      <div 
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center p-4 bg-transparent",
        className
      )}
      {...props}
  >  
        <div className={spinnerClasses} />
        {message && <p className={messageClasses}>{message}</p>}
      </div>
    );

    if (overlay) {
      console.log('Rendering LoadingSpinner in overlay mode');
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <Spinner />
        </div>
      );
    }

    console.log('Rendering LoadingSpinner in non-overlay mode');
    return <Spinner />;
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';
