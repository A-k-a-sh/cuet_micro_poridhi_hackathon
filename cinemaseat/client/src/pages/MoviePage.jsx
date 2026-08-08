import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Clock, Tag } from 'lucide-react';
import api from '../lib/api';
import ShowtimeList from '../components/movies/ShowtimeList';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function MoviePage() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/movies/${id}`).catch(() => ({
        id,
        title: 'Spider-Man: Brand New Day',
        genre: 'Action • Sci-Fi • Thriller',
        duration_mins: 152,
        rating: '9.8',
        description: 'The midnight premiere seats just went live. Thousands rush the same showtimes at the same second. Grab your seat before it vanishes!',
        poster_url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=800&auto=format&fit=crop',
      })),
      api.get(`/movies/${id}/shows`).catch(() => [
        {
          show_id: 'show-spiderman-01',
          show_time: new Date(Date.now() + 3600000).toISOString(),
          theatre_name: 'Hall A • Central Screen',
          available_seats: 54,
        },
        {
          show_id: 'show-spiderman-02',
          show_time: new Date(Date.now() + 10800000).toISOString(),
          theatre_name: 'Hall B • Dolby Atmos',
          available_seats: 60,
        }
      ]),
    ])
      .then(([movieRes, showRes]) => {
        setMovie(movieRes.movie || movieRes);
        setShowtimes(Array.isArray(showRes) ? showRes : showRes.shows || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner label="Loading movie details..." />;
  if (!movie) return <div className="p-8 text-center text-[#8888AA]">Movie not found.</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Movie Details Hero */}
      <div className="bg-[#12121A] border border-[#2A2A40] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-start">
        <div className="w-full md:w-64 aspect-[2/3] rounded-2xl overflow-hidden bg-[#1C1C2E] border border-[#2A2A40] shrink-0">
          <img
            src={movie.poster_url || 'https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=800&auto=format&fit=crop'}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] text-xs font-mono font-semibold">
              Now Showing
            </span>
            {movie.rating && (
              <span className="flex items-center gap-1 text-xs font-bold text-[#F5A623]">
                <Star className="w-4 h-4 fill-[#F5A623]" />
                {movie.rating}
              </span>
            )}
          </div>

          <h1 className="font-['Syne'] font-extrabold text-3xl sm:text-4xl text-[#F0F0FF]">
            {movie.title}
          </h1>

          <div className="flex flex-wrap gap-4 text-xs text-[#8888AA] font-mono">
            {movie.duration_mins && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-[#555570]" />
                {movie.duration_mins} mins
              </span>
            )}
            {movie.genre && (
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4 text-[#555570]" />
                {movie.genre}
              </span>
            )}
          </div>

          <p className="text-sm text-[#8888AA] leading-relaxed pt-2">
            {movie.description}
          </p>
        </div>
      </div>

      {/* Showtimes List */}
      <div className="space-y-4">
        <h2 className="font-['Syne'] font-bold text-xl text-[#F0F0FF]">Select Showtime</h2>
        <ShowtimeList showtimes={showtimes} />
      </div>
    </div>
  );
}
