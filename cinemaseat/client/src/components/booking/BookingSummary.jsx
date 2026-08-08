import { formatCurrency } from '../../lib/utils';
import { Armchair, Film, Receipt } from 'lucide-react';

export default function BookingSummary({ booking, seat }) {
  if (!booking) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#1C1C2E] border border-[#2A2A40] rounded-xl my-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#F5A623]/10 border border-[#F5A623]/20 flex items-center justify-center text-[#F5A623]">
          <Armchair className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#F0F0FF]">Seat {seat?.label || booking.seat_id}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[#12121A] text-[#8888AA] font-mono border border-[#2A2A40]">
              Ref: {booking.booking_ref || booking.ref}
            </span>
          </div>
          <p className="text-xs text-[#8888AA] mt-0.5">
            Hold status: <span className="text-[#F5A623] font-semibold uppercase">{booking.status || 'HELD'}</span>
          </p>
        </div>
      </div>

      <div className="text-right">
        <span className="text-xs text-[#8888AA]">Total Amount</span>
        <div className="text-lg font-bold font-mono text-[#F5A623]">
          {formatCurrency(booking.amount || seat?.price || 450)}
        </div>
      </div>
    </div>
  );
}
