import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Share2, Ticket, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBookingStore } from '../stores/bookingStore';
import QRCode from '../components/shared/QRCode';
import { formatDate, formatCurrency } from '../lib/utils';

export default function ConfirmationPage() {
  const { ref } = useParams();
  const { currentBooking, selectedSeat } = useBookingStore();

  const ticketRef = ref || currentBooking?.booking_ref || `bk_${Date.now()}`;
  const seatLabel = selectedSeat?.label || currentBooking?.seat_id || 'F12';
  const amountPaid = currentBooking?.amount || 450;

  const handleDownload = () => {
    toast.success('Downloading digital ticket SVG...');
    const svgElement = document.querySelector('#ticket-qr-code svg');
    if (!svgElement) {
      toast.error('Failed to locate QR code.');
      return;
    }
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket-${ticketRef}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'CinemaSeat Booking Confirmation',
        text: `I just reserved seat ${seatLabel} for Spider-Man: Brand New Day on CinemaSeat! Ref: ${ticketRef}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Ticket link copied to clipboard!');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-[#12121A] border border-[#2A2A40] rounded-3xl p-8 shadow-2xl text-center space-y-6"
      >
        <div className="w-16 h-16 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] flex items-center justify-center mx-auto shadow-lg shadow-[#22C55E]/20 animate-bounce">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#22C55E] bg-[#22C55E]/10 px-3 py-1 rounded-full border border-[#22C55E]/20">
            Booking Confirmed
          </span>
          <h1 className="font-['Syne'] font-extrabold text-2xl sm:text-3xl text-[#F0F0FF] mt-3">
            You're Going to the Movies!
          </h1>
          <p className="text-xs text-[#8888AA] mt-1">
            Show this QR ticket code at the theatre entrance
          </p>
        </div>

        {/* QR Code Container */}
        <div id="ticket-qr-code" className="py-2">
          <QRCode value={`CINEMASEAT-CONFIRMED-${ticketRef}-${seatLabel}`} size={180} />
        </div>

        {/* Ticket Metadata Card */}
        <div className="bg-[#1C1C2E] border border-[#2A2A40] rounded-2xl p-5 text-left space-y-3 text-xs font-mono">
          <div className="flex justify-between border-b border-[#2A2A40] pb-2">
            <span className="text-[#8888AA]">Booking Reference</span>
            <span className="font-bold text-[#F5A623]">{ticketRef}</span>
          </div>

          <div className="flex justify-between border-b border-[#2A2A40] pb-2">
            <span className="text-[#8888AA]">Movie</span>
            <span className="text-[#F0F0FF]">Spider-Man: Brand New Day</span>
          </div>

          <div className="flex justify-between border-b border-[#2A2A40] pb-2">
            <span className="text-[#8888AA]">Reserved Seat</span>
            <span className="font-bold text-[#3B82F6]">{seatLabel}</span>
          </div>

          <div className="flex justify-between border-b border-[#2A2A40] pb-2">
            <span className="text-[#8888AA]">Theatre</span>
            <span className="text-[#F0F0FF]">Hall A • Central Screen</span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#8888AA]">Amount Paid</span>
            <span className="font-bold text-[#22C55E]">{formatCurrency(amountPaid)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleDownload}
            className="flex-1 py-3 rounded-xl bg-[#F5A623] text-[#0A0A0F] font-semibold text-xs hover:bg-[#C47D10] transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#F5A623]/20"
          >
            <Download className="w-4 h-4" />
            Download Ticket
          </button>

          <button
            onClick={handleShare}
            className="px-4 py-3 rounded-xl bg-[#1C1C2E] border border-[#2A2A40] text-[#F0F0FF] hover:bg-[#2A2A40] font-semibold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4 text-[#8888AA]" />
            Share
          </button>
        </div>
      </motion.div>

      <div className="text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-[#8888AA] hover:text-[#F5A623] transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Homepage
        </Link>
      </div>
    </div>
  );
}
