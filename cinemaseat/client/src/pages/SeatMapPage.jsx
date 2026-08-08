import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../lib/api';
import SeatMap from '../components/seats/SeatMap';
import HoldTimer from '../components/seats/HoldTimer';
import BookingSummary from '../components/booking/BookingSummary';
import GatewayStatusBanner from '../components/shared/GatewayStatusBanner';
import MetricsDashboard from '../components/shared/MetricsDashboard';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useShowRoom } from '../hooks/useShowRoom';
import { useBookingStore } from '../stores/bookingStore';
import { useAuthStore } from '../stores/authStore';

// Default mock generator for premiere seat map (6 rows A-F x 10 seats)
const generateDefaultSeatMap = () => {
  const map = {};
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
  rows.forEach((row) => {
    map[row] = Array.from({ length: 10 }, (_, i) => ({
      seat_id: `${row}${i + 1}`,
      label: `${row}${i + 1}`,
      row,
      number: i + 1,
      category: row === 'A' || row === 'B' ? 'vip' : 'standard',
      price: row === 'A' || row === 'B' ? 650 : 450,
      status: 'available',
    }));
  });
  return map;
};

export default function SeatMapPage() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { setBooking, currentBooking, selectedSeat, setSelectedSeat, clearBooking } = useBookingStore();

  const [seatMap, setSeatMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [gatewayDown, setGatewayDown] = useState(false);

  // Load initial seat map
  useEffect(() => {
    setLoading(true);
    api.get(`/shows/${showId}/seats`)
      .then((data) => {
        if (data.seat_map && Object.keys(data.seat_map).length > 0) {
          setSeatMap(data.seat_map);
        } else {
          setSeatMap(generateDefaultSeatMap());
        }
      })
      .catch(() => {
        setSeatMap(generateDefaultSeatMap());
      })
      .finally(() => setLoading(false));
  }, [showId]);

  // Real-time seat updates and system metrics via WebSockets
  const handleSeatUpdate = useCallback((event) => {
    setSeatMap((prev) => {
      const updated = { ...prev };
      for (const row of Object.keys(updated)) {
        updated[row] = updated[row].map((seat) =>
          seat.seat_id === event.seat_id
            ? { ...seat, status: event.status, expires_at: event.expires_at }
            : seat
        );
      }
      return updated;
    });

    if (event.status === 'held' && event.seat_id !== selectedSeat?.seat_id) {
      toast('Someone just grabbed a seat!', { icon: '⚡' });
    }
  }, [selectedSeat]);

  const handleSystemEvent = useCallback((event) => {
    if (event.type === 'SYSTEM_METRICS') {
      setMetrics(event);
      setGatewayDown(event.gateway_status === 'down');
    }
    if (event.type === 'HOLD_EXPIRED' && event.booking_ref === currentBooking?.booking_ref) {
      toast.error('Your hold expired. Please select a seat again.');
      clearBooking();
    }
  }, [currentBooking, clearBooking]);

  useShowRoom(showId, handleSeatUpdate, handleSystemEvent);

  const handleSeatClick = async (seat) => {
    if (seat.status !== 'available') return;
    if (!token) {
      toast.error('Please login to hold seats');
      navigate('/login');
      return;
    }
    if (currentBooking) {
      toast.error('You already have an active hold!');
      return;
    }

    try {
      const result = await api.post('/bookings/hold', {
        show_id: showId,
        seat_id: seat.seat_id,
      });

      const bookingData = {
        booking_ref: result.booking_ref || result.ref || `bk_${Date.now()}`,
        seat_id: seat.seat_id,
        show_id: showId,
        amount: result.amount || seat.price || 450,
        status: 'HELD',
        expires_at: result.expires_at || new Date(Date.now() + (result.ttl_seconds || 120) * 1000).toISOString(),
        ttl_seconds: result.ttl_seconds || 120,
      };

      setBooking(bookingData);
      setSelectedSeat(seat);
      toast.success(`Seat ${seat.label} held for ${Math.floor((result.ttl_seconds || 120) / 60)} minutes!`);
    } catch (err) {
      toast.error(err.message || err.error || 'Seat no longer available');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0A0A0F] pb-32">
      {gatewayDown && <GatewayStatusBanner />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 border-b border-[#2A2A40] pb-4">
          <div>
            <h1 className="font-['Syne'] font-bold text-2xl text-[#F0F0FF]">
              Select Seats
            </h1>
            <p className="text-xs text-[#8888AA] font-mono mt-1">
              Showtime ID: {showId} • Live seat availability active
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading live seat map..." />
        ) : (
          <SeatMap
            seatMap={seatMap}
            selectedSeatId={selectedSeat?.seat_id}
            onSeatClick={handleSeatClick}
          />
        )}
      </div>

      {/* Hold timer + summary bottom bar */}
      {currentBooking && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#1C1C2E]/95 backdrop-blur-md border-t border-[#2A2A40] p-4 shadow-2xl"
        >
          <div className="max-w-3xl mx-auto space-y-3">
            <HoldTimer
              expiresAt={currentBooking.expires_at}
              onExpire={() => {
                clearBooking();
                toast.error('Hold expired!');
              }}
            />
            <BookingSummary booking={currentBooking} seat={selectedSeat} />

            <button
              onClick={() => navigate(`/bookings/${currentBooking.booking_ref}/pay`)}
              className="w-full py-3.5 rounded-xl bg-[#F5A623] text-[#0A0A0F] font-bold text-sm hover:bg-[#C47D10] transition-colors shadow-lg shadow-[#F5A623]/25 flex items-center justify-center gap-2"
            >
              Proceed to Payment — BDT {currentBooking.amount}
            </button>
          </div>
        </motion.div>
      )}

      {/* Live telemetry metrics drawer */}
      {metrics && <MetricsDashboard metrics={metrics} />}
    </div>
  );
}
