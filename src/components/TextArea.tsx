import React, { useId } from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, resize = 'vertical', className = '', ...props }, ref) => {
    const generatedId = useId();
    const textareaId = props.id || props.name || `textarea-${generatedId}`;
    
    const resizeClass = {
      'none': 'resize-none',
      'vertical': 'resize-y',
      'horizontal': 'resize-x',
      'both': 'resize'
    }[resize];

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-3 py-2 text-sm border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-purple-500
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${resizeClass}
            ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}
            ${className}
          `}
          {...props}
        />

        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
        
        {helperText && !error && (
          <p className="mt-1 text-xs text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default TextArea;
