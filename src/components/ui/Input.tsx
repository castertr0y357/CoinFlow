import { InputHTMLAttributes } from "react";
import "./Input.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export default function Input({ 
  label, 
  error, 
  helpText, 
  className = "", 
  ...props 
}: InputProps) {
  return (
    <div className={`input-group ${error ? 'has-error' : ''} ${className}`}>
      {label && <label htmlFor={props.id}>{label}</label>}
      <input className="input-field" {...props} />
      {helpText && !error && <p className="help-text">{helpText}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
