import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './PasswordInput.scss';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  leftIcon?: React.ReactNode;
  showLabel?: string;
  hideLabel?: string;
  wrapperClassName?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      leftIcon,
      showLabel = 'Show password',
      hideLabel = 'Hide password',
      wrapperClassName = '',
      className = '',
      disabled,
      ...inputProps
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false);

    return (
      <div
        className={`password-input-wrapper ${leftIcon ? 'has-left-icon' : ''} ${wrapperClassName}`.trim()}
      >
        {leftIcon && <span className="password-left-icon">{leftIcon}</span>}

        <input
          ref={ref}
          {...inputProps}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={`password-input-field ${className}`.trim()}
        />

        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setVisible((prev) => !prev)}
          disabled={disabled}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          title={visible ? hideLabel : showLabel}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

