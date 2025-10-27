import React, { useId } from 'react';

interface TextBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

export const TextBox = React.forwardRef<HTMLInputElement, TextBoxProps>(
  ({ label, error, icon, helperText, className = '', ...props }, ref) => {
    const generatedId = useId();
    const inputId = props.id || props.name || `textbox-${generatedId}`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full px-3 py-2 text-sm border rounded-lg
              focus:outline-none focus:ring-2 focus:ring-purple-500
              disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}
              ${className}
            `}
            {...props}
          />
        </div>

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

TextBox.displayName = 'TextBox';

export default TextBox;
