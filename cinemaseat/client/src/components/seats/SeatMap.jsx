import Seat from './Seat';
import SeatLegend from './SeatLegend';

export default function SeatMap({ seatMap = {}, selectedSeatId, onSeatClick }) {
  // Normalize seatMap into row object structure: { "A": [...], "B": [...] }
  let rowsObj = {};
  if (Array.isArray(seatMap)) {
    seatMap.forEach((seat) => {
      const row = seat.row || seat.label?.charAt(0) || 'A';
      if (!rowsObj[row]) rowsObj[row] = [];
      rowsObj[row].push(seat);
    });
  } else if (typeof seatMap === 'object' && seatMap !== null) {
    rowsObj = seatMap;
  }

  const rowKeys = Object.keys(rowsObj).sort();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Screen Visual */}
      <div className="relative mb-12 text-center">
        <div className="w-4/5 h-2 mx-auto bg-gradient-to-r from-transparent via-[#F5A623] to-transparent rounded-full opacity-70 shadow-lg shadow-[#F5A623]/30" />
        <div className="w-3/4 h-8 mx-auto bg-gradient-to-b from-[#F5A623]/10 to-transparent rounded-t-full opacity-30" />
        <p className="mt-2 text-[10px] uppercase font-mono tracking-widest text-[#555570]">
          Screen (All eyes here)
        </p>
      </div>

      {/* Seat Grid */}
      <div className="overflow-x-auto pb-6">
        <div className="min-w-[400px] flex flex-col items-center gap-3">
          {rowKeys.map((rowKey) => (
            <div key={rowKey} className="flex items-center gap-3">
              <span className="w-6 text-center font-mono font-bold text-xs text-[#8888AA]">
                {rowKey}
              </span>
              
              <div className="flex items-center gap-2">
                {rowsObj[rowKey].map((seat) => (
                  <Seat
                    key={seat.seat_id || `${rowKey}-${seat.number}`}
                    seat={seat}
                    isSelected={selectedSeatId === seat.seat_id}
                    onClick={onSeatClick}
                  />
                ))}
              </div>

              <span className="w-6 text-center font-mono font-bold text-xs text-[#8888AA]">
                {rowKey}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <SeatLegend />
    </div>
  );
}
