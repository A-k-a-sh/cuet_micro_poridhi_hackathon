import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Ticket, Sparkles } from 'lucide-react';
import api from '../lib/api';
import MovieCard from '../components/movies/MovieCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const MOCK_PREMIERE = {
  id: 'show-spiderman-01',
  movie_id: 'mov-spiderman',
  title: 'Spider-Man: Brand New Day',
  genre: 'Action • Sci-Fi • Thriller',
  duration_mins: 152,
  rating: '9.8',
  is_premiere: true,
  description: 'The midnight premiere seats just went live. Thousands rush the same showtimes at the same second. Grab your seat before it vanishes!',
  poster_url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=1200&auto=format&fit=crop',
};

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/movies')
      .then((data) => {
        const list = Array.isArray(data) ? data : data.movies || [];
        setMovies(list.length > 0 ? list : [MOCK_PREMIERE]);
      })
      .catch(() => {
        setMovies([MOCK_PREMIERE]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Hero Premiere Banner */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden border border-[#2A2A40] bg-[#12121A] shadow-2xl"
      >
        <div className="absolute inset-0 z-0">
          <img
            src={MOCK_PREMIERE.poster_url}
            alt={MOCK_PREMIERE.title}
            className="w-full h-full object-cover opacity-20 filter blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F] via-[#0A0A0F]/90 to-transparent" />
        </div>

        <div className="relative z-10 p-8 sm:p-12 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] text-xs font-mono font-bold uppercase tracking-wider">
            <Flame className="w-4 h-4 fill-[#F5A623]" />
            Tonight's Premiere Spotlight
          </div>

          <h1 className="font-['Syne'] font-extrabold text-3xl sm:text-5xl text-[#F0F0FF] tracking-tight leading-tight">
            {MOCK_PREMIERE.title}
          </h1>

          <p className="text-sm sm:text-base text-[#8888AA] leading-relaxed">
            {MOCK_PREMIERE.description}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/shows/show-spiderman-01/seats"
              className="px-6 py-3.5 rounded-xl bg-[#F5A623] text-[#0A0A0F] font-bold text-sm hover:bg-[#C47D10] transition-all flex items-center gap-2 shadow-xl shadow-[#F5A623]/25 hover:scale-105"
            >
              <Ticket className="w-5 h-5" />
              Book Premiere Seats
            </Link>

            <span className="text-xs text-[#555570] font-mono">
              Live seat map • Atomic hold enabled
            </span>
          </div>
        </div>
      </motion.section>

      {/* Movie Catalogue Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#2A2A40] pb-4">
          <h2 className="font-['Syne'] font-bold text-xl sm:text-2xl text-[#F0F0FF] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#F5A623]" />
            Now Showing
          </h2>
          <span className="text-xs font-mono text-[#8888AA]">
            {movies.length} Movies Available
          </span>
        </div>

        {loading ? (
          <LoadingSpinner label="Fetching cinema listings..." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie.movie_id || movie.id} movie={movie} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
