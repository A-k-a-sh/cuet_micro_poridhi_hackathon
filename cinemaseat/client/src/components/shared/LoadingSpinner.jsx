export default function LoadingSpinner({ label = 'Loading CinemaSeat...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <div className="w-10 h-10 border-4 border-[#1C1C2E] border-t-[#F5A623] rounded-full animate-spin" />
      <p className="text-xs text-[#8888AA] font-mono animate-pulse">{label}</p>
    </div>
  );
}
