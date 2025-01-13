import * as React from 'react';
import type { SelectOption } from '@/types/base';

export interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  isLoading?: boolean;
  isInitialLoad?: boolean;
  showCounts?: boolean;
}

export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  error,
  isLoading = false,
  isInitialLoad = false,
  showCounts = false
}: SelectProps): JSX.Element {
  const selectId = React.useId();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    onChange(e.target.value);
  };

  const formatOptionLabel = (option: SelectOption): string => {
    if (!showCounts) return option.label;
    
    const counts = [];
    if (typeof option.activeCount === 'number') {
      counts.push(`${option.activeCount.toLocaleString()} active`);
    }
    if (typeof option.count === 'number') {
      counts.push(`${option.count.toLocaleString()} total`);
    }
    
    return counts.length > 0
      ? `${option.label} (${counts.join(' / ')})`
      : option.label;
  };

  return React.createElement('div', {
    className: 'flex flex-col gap-1',
    role: 'group',
    'aria-labelledby': `${selectId}-label`
  }, [
    React.createElement('label', {
      key: 'label',
      id: `${selectId}-label`,
      htmlFor: selectId,
      className: 'text-sm font-medium text-gray-700'
    }, label),
    
    React.createElement('select', {
      key: 'select',
      id: selectId,
      name: label.toLowerCase().replace(/\s+/g, '-'),
      value,
      onChange: handleChange,
      disabled: disabled || isLoading,
      'aria-label': label,
      className: `w-full px-4 py-2 border rounded-md bg-white disabled:bg-gray-100
                 focus:outline-none focus:ring-2 focus:ring-blue-500
                 ${error ? 'border-red-500' : 'border-gray-300'}
                 ${(disabled || isLoading) ? 'cursor-not-allowed' : 'cursor-pointer'}`
    }, [
      React.createElement('option', {
        key: 'placeholder',
        value: ''
      }, isLoading ? "Loading..." : isInitialLoad ? "Loading initial data..." : placeholder),
      
      ...options.map(option => 
        React.createElement('option', {
          key: option.value,
          value: option.value
        }, formatOptionLabel(option))
      )
    ]),
    
    error && React.createElement('p', {
      key: 'error',
      className: 'mt-1 text-sm text-red-600',
      role: 'alert'
    }, error)
  ]);
}

export default React.memo(Select);