interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  color?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, color = '#00e676', disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/40 ${
      disabled ? 'opacity-40' : ''}`
      }
      style={{ backgroundColor: checked ? color : '#2a2a2a' }}>
      
      <span
        className="inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(26px)' : 'translateX(4px)' }} />
      
    </button>);

}