import React, { useEffect, useRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const variantClass = `btn-${variant}`;
  const sizeClass = size === 'sm' ? 'btn-sm' : '';
  return (
    <button className={`btn ${variantClass} ${sizeClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface1' | 'surface2' | 'surface3';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'surface1',
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`panel ${className}`.trim()} style={{ backgroundColor: `var(--color-${variant})` }} {...props}>
      {children}
    </div>
  );
};

export interface BadgeProps {
  variant?: 'teamA' | 'teamB' | 'core' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  const map: Record<string, string> = {
    teamA: 'badge-team-a',
    teamB: 'badge-team-b',
    core: 'badge-core',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };
  return <span className={`badge ${map[variant] ?? 'badge-neutral'} ${className}`.trim()}>{children}</span>;
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', id, ...props }) => {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div className="form-group">
      {label && <label htmlFor={inputId} className="form-label">{label}</label>}
      <input id={inputId} className={`form-control ${className}`.trim()} {...props} />
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
};

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: readonly SelectOption[];
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ label, options, error, className = '', id, ...props }) => {
  const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div className="form-group">
      {label && <label htmlFor={selectId} className="form-label">{label}</label>}
      <select id={selectId} className={`form-control ${className}`.trim()} {...props}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
};

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, error, className = '', id, ...props }) => {
  const textId = id ?? (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div className="form-group">
      {label && <label htmlFor={textId} className="form-label">{label}</label>}
      <textarea id={textId} className={`form-control ${className}`.trim()} {...props} />
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
};

export interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, title, onClose, children, actions }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" onClick={e => e.stopPropagation()} ref={modalRef}>
        <div className="modal-header">
          <h2 id="modal-title" className="panel-title">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Đóng">✕</Button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-footer">{actions}</div>}
      </div>
    </div>
  );
};

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeId, onChange }) => {
  return (
    <nav className="nav-tabs" role="tablist">
      {tabs.map(t => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            className={`nav-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.icon && <span>{t.icon}</span>}
            <span>{t.label}</span>
            {t.badge && <span className="badge badge-warning">{t.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
};

export interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  formatValue?: (val: number) => string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
  formatValue,
}) => {
  return (
    <div className="form-group">
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <label className="form-label" style={{ margin: 0 }}>{label}</label>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-core)' }}>
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--color-core)', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
    </div>
  );
};

export interface AlertBannerProps {
  variant?: 'info' | 'warning' | 'danger' | 'success';
  title?: string | undefined;
  children: React.ReactNode;
  onClose?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
}) => {
  const borderColor = `var(--color-${variant})`;
  return (
    <div
      role="alert"
      style={{
        backgroundColor: `rgba(var(--color-${variant}), 0.12)`,
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-field)',
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        {title && <div style={{ fontWeight: 650, marginBottom: 4 }}>{title}</div>}
        <div style={{ fontSize: 14 }}>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          aria-label="Đóng thông báo"
        >
          ✕
        </button>
      )}
    </div>
  );
};
