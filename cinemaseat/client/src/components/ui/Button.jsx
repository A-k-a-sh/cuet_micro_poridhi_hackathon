export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
  ...props
}) {
  const baseStyles = 'font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#F5A623] text-[#0A0A0F] hover:bg-[#C47D10] shadow-md shadow-[#F5A623]/20',
    secondary: 'bg-[#1C1C2E] text-[#F0F0FF] hover:bg-[#2A2A40] border border-[#2A2A40]',
    outline: 'border border-[#F5A623] text-[#F5A623] hover:bg-[#F5A623]/10',
    danger: 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  };

  return (
    <button
      disabled={disabled}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
