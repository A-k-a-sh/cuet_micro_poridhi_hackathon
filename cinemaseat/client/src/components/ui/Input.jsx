export default function Input({
  label,
  error,
  className = '',
  ...props
}) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-[#8888AA]">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-2.5 bg-[#12121A] border border-[#2A2A40] focus:border-[#F5A623] rounded-xl text-sm text-[#F0F0FF] outline-none transition-all placeholder-[#555570] ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
    </div>
  );
}
