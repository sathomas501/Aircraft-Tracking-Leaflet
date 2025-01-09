// components/shared/LoadingSpinner/constants.ts
export const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-3',
  lg: 'h-12 w-12 border-4',
  xl: 'h-16 w-16 border-4'
} as const;

export const variantClasses = {
  primary: 'border-gray-200 border-t-gray-600', // Changed from blue to gray
  secondary: 'border-gray-200 border-t-gray-600',
  light: 'border-gray-100 border-t-white'
} as const;
