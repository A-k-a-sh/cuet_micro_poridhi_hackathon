import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Clock, Ticket } from 'lucide-react';

export default function MovieCard({ movie }) {
  const posterUrl = movie.poster_url || 'https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=800&auto=format&fit=crop';

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="group bg-[#12121A] border border-[#2A2A40] rounded-2xl overflow-hidden shadow-xl hover:border-[#F5A623]/50 transition-all flex flex-col h-full"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-[#1C1C2E]">
        <img
          src={posterUrl}
          alt={movie.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121A] via-transparent to-transparent opacity-90" />
        
        {movie.rating && (
          <div className="absolute top-3 right-3 bg-[#0A0A0F]/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#2A2A40] flex items-center gap-1.5 text-xs font-semibold text-[#F5A623]">
            <Star className="w-3.5 h-3.5 fill-[#F5A623]" />
            <span>{movie.rating}</span>
          </div>
        )}

        {movie.is_premiere && (
          <div className="absolute top-3 left-3 bg-[#F5A623] text-[#0A0A0F] px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono tracking-wider uppercase shadow-md shadow-[#F5A623]/30">
            Premiere
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-['Syne'] font-bold text-lg text-[#F0F0FF] group-hover:text-[#F5A623] transition-colors line-clamp-1">
            {movie.title}
          </h3>

          <div className="flex items-center gap-3 text-xs text-[#8888AA] mt-2 font-mono">
            {movie.duration_mins && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#555570]" />
                {movie.duration_mins} mins
              </span>
            )}
            {movie.genre && (
              <span className="px-2 py-0.5 rounded bg-[#1C1C2E] text-[#8888AA] border border-[#2A2A40]">
                {movie.genre}
              </span>
            )}
          </div>

          {movie.description && (
            <p className="text-xs text-[#8888AA] mt-3 line-clamp-2 leading-relaxed">
              {movie.description}
            </p>
          )}
        </div>

        <Link
          to={`/movies/${movie.movie_id || movie.id}`}
          className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1C1C2E] border border-[#2A2A40] text-[#F0F0FF] hover:bg-[#F5A623] hover:text-[#0A0A0F] font-semibold text-xs transition-all group-hover:border-[#F5A623]"
        >
          <Ticket className="w-4 h-4" />
          View Showtimes
        </Link>
      </div>
    </motion.div>
  );
}
