import React from 'react';

interface PasswordInputProps {
  id: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  show: boolean;
  onToggle: () => void;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  disabled,
  autoComplete,
  className,
  show,
  onToggle
}) => (
  <div className="password-field">
    <input
      type={show ? 'text' : 'password'}
      id={id}
      name={name}
      className={className}
      value={value}
      onChange={onChange}
      required={required}
      minLength={minLength}
      disabled={disabled}
      autoComplete={autoComplete}
      placeholder={placeholder}
    />
    <button
      type="button"
      className="password-toggle"
      onClick={onToggle}
      disabled={disabled}
      aria-label={show ? 'Hide password' : 'Show password'}
      aria-pressed={show}
    >
      {show ? (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M2.1 4.93l1.41-1.41 16.97 16.97-1.41 1.41-2.4-2.4A11.86 11.86 0 0112 19c-5 0-9.27-3.11-11-7.5a12.32 12.32 0 014.16-5.08L2.1 4.93zM12 7c5 0 9.27 3.11 11 7.5a12.4 12.4 0 01-3.53 4.48l-2.05-2.05A5 5 0 0012 9a4.93 4.93 0 00-1.66.29L8.12 7.07A10.7 10.7 0 0112 7zm0 4a3 3 0 012.83 4l-3.9-3.9c.34-.06.7-.1 1.07-.1z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 5c5 0 9.27 3.11 11 7.5C21.27 16.89 17 20 12 20S2.73 16.89 1 12.5C2.73 8.11 7 5 12 5zm0 2C8.24 7 4.94 9.17 3.54 12.5 4.94 15.83 8.24 18 12 18s7.06-2.17 8.46-5.5C19.06 9.17 15.76 7 12 7zm0 2.5A3 3 0 1112 15.5 3 3 0 0112 9.5zm0 2a1 1 0 100 2 1 1 0 000-2z"
          />
        </svg>
      )}
    </button>
  </div>
);

export default PasswordInput;
