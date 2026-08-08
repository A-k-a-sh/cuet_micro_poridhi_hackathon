import { Link } from 'react-router-dom';
import { Calendar, MapPin, Armchair } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function ShowtimeList({ showtimes = [] }) {
  if (!showtimes.length) {
    return (
      <div className="p-8 text-center bg-[#12121A] border border-[#2A2A40] rounded-2xl text-[#8888AA]">
        No showtimes available for this movie yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showtimes.map((show) => (
        <div
          key={show.show_id || show.id}
          className="bg-[#12121A] border border-[#2A2A40] hover:border-[#F5A623]/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#F5A623] font-semibold text-sm">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(show.start_time || show.show_time)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#8888AA]">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#555570]" />
                {show.theatre_name || 'Hall A • Central Screen'}
              </span>
              <span className="flex items-center gap-1 font-mono text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/20">
                <Armchair className="w-3.5 h-3.5" />
                {show.available_seats ?? '60'} seats available
              </span>
            </div>
          </div>

          <Link
            to={`/shows/${show.show_id || show.id}/seats`}
            className="px-5 py-2.5 rounded-xl bg-[#F5A623] text-[#0A0A0F] font-semibold text-xs hover:bg-[#C47D10] transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#F5A623]/20"
          >
            Select Seats
          </Link>
        </div>
      ))}
    </div>
  );
}
