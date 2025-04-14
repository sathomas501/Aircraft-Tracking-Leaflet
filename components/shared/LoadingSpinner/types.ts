// components/shared/LoadingSpinner/types.ts
import { sizeClasses, variantClasses } from './constants';

export type SpinnerSize = keyof typeof sizeClasses;
export type SpinnerVariant = keyof typeof variantClasses;

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  message?: string;
  variant?: SpinnerVariant;
  overlay?: boolean;
}