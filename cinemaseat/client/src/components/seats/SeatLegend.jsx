export default function SeatLegend() {
  const legendItems = [
    { label: 'Available', color: 'bg-[#22C55E]' },
    { label: 'Held', color: 'bg-[#F5A623] seat-pulse' },
    { label: 'Your Seat', color: 'bg-[#3B82F6]' },
    { label: 'Taken', color: 'bg-[#3F3F5A]' },
    { label: 'VIP Row', color: 'bg-[#1C1C2E] ring-1 ring-[#A855F7]' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-4 px-6 bg-[#12121A] border border-[#2A2A40] rounded-2xl max-w-2xl mx-auto my-6 text-xs text-[#8888AA]">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`w-4 h-4 rounded-t ${item.color}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
