import { forwardRef, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, showCount, maxLength, value, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            ref={ref}
            id={inputId}
            value={value}
            maxLength={maxLength}
            className={clsx(
              'block w-full rounded-lg border px-4 py-3 text-gray-900 shadow-sm transition-colors resize-none',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'font-serif leading-relaxed',
              {
                'border-gray-300 focus:border-primary-500 focus:ring-primary-500': !error,
                'border-red-500 focus:border-red-500 focus:ring-red-500': error,
              },
              className
            )}
            {...props}
          />
          {showCount && maxLength && (
            <div
              className={clsx('absolute bottom-2 right-2 text-xs', {
                'text-gray-400': charCount < maxLength * 0.9,
                'text-yellow-600': charCount >= maxLength * 0.9 && charCount < maxLength,
                'text-red-600': charCount >= maxLength,
              })}
            >
              {charCount}/{maxLength}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
