// utils/styleUtils.ts
import { cn } from '@/utils/cn';

/**
 * Common interface for style options
 */
interface StyleOptions {
  isError?: boolean;
  isSuccess?: boolean;
  isDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * Aircraft status badge options
 */
export type AircraftStatus = 'airborne' | 'grounded' | 'tracking' | 'error';

/**
 * Get aircraft status badge styles
 */
export const getAircraftStatusStyles = (status: AircraftStatus) => {
  return cn(
    'px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1',
    {
      'bg-blue-100 text-blue-800': status === 'airborne',
      'bg-gray-100 text-gray-800': status === 'grounded',
      'bg-green-100 text-green-800': status === 'tracking',
      'bg-red-100 text-red-800': status === 'error'
    }
  );
};

/**
 * Get input field styles
 */
export const getInputStyles = ({ isError, isSuccess, isDisabled }: StyleOptions) => {
  return cn(
    'w-full px-4 py-2 border rounded-md',
    'focus:outline-none focus:ring-2',
    'transition duration-200',
    {
      'border-gray-300 focus:ring-blue-500 focus:border-blue-500': !isError && !isSuccess,
      'border-red-300 focus:ring-red-500 text-red-900': isError,
      'border-green-300 focus:ring-green-500 text-green-900': isSuccess,
      'bg-gray-50 opacity-50 cursor-not-allowed': isDisabled
    }
  );
};

/**
 * Get button styles
 */
export const getButtonStyles = ({ variant = 'primary', isDisabled, size = 'md' }: StyleOptions) => {
  return cn(
    'rounded-md font-medium transition-all duration-200',
    'inline-flex items-center justify-center gap-2',
    {
      // Size variations
      'px-2 py-1 text-sm': size === 'sm',
      'px-4 py-2': size === 'md',
      'px-6 py-3 text-lg': size === 'lg',
      
      // Variant styles
      'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700': variant === 'primary',
      'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400': variant === 'secondary',
      'bg-red-500 text-white hover:bg-red-600 active:bg-red-700': variant === 'danger',
      
      // Disabled state
      'opacity-50 cursor-not-allowed pointer-events-none': isDisabled
    }
  );
};

/**
 * Get loading spinner styles
 */
export const getSpinnerStyles = (size: 'sm' | 'md' | 'lg') => {
  return cn(
    'animate-spin rounded-full border-gray-300 border-t-blue-500',
    {
      'h-4 w-4 border-2': size === 'sm',
      'h-8 w-8 border-3': size === 'md',
      'h-12 w-12 border-4': size === 'lg'
    }
  );
};

/**
 * Get aircraft card styles
 */
export const getAircraftCardStyles = ({ isSelected = false }) => {
  return cn(
    'bg-white rounded-lg shadow transition-all duration-200',
    'hover:shadow-md',
    'p-4 space-y-2',
    {
      'ring-2 ring-blue-500 ring-offset-2': isSelected
    }
  );
};

/**
 * Get coordinate display styles
 */
export const getCoordinateStyles = () => {
  return cn(
    'font-mono text-xs text-gray-500',
    'tabular-nums tracking-wide'
  );
};

/**
 * Get data indicator styles
 */
export const getDataIndicatorStyles = (type: 'altitude' | 'speed' | 'heading') => {
  return cn(
    'inline-flex items-center gap-1 text-sm',
    {
      'text-blue-600': type === 'altitude',
      'text-green-600': type === 'speed',
      'text-purple-600': type === 'heading'
    }
  );
};