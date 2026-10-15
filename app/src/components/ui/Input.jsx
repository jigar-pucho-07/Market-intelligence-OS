import React from 'react';
import { cn } from '../../utils/cn';

const Input = ({ label, type = 'text', icon, placeholder, value, onChange, error }) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <img
            src={icon}
            alt=""
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"
          />
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            'input',
            icon && 'pl-10',
            error && 'border-intent-danger-border focus:ring-[color:var(--bad-edge)] focus:border-bad'
          )}
        />
      </div>
      {error && <p className="text-xs text-intent-danger-text">{error}</p>}
    </div>
  );
};

export default Input;
