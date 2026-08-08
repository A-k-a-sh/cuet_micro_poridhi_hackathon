import { motion } from 'framer-motion';

const statusConfig = {
  available:       { bg: 'bg-[#22C55E]', hover: 'hover:bg-[#4ADE80]', cursor: 'cursor-pointer' },
  held:            { bg: 'bg-[#F5A623] seat-pulse', hover: '', cursor: 'cursor-not-allowed' },
  mine:            { bg: 'bg-[#3B82F6] shadow-lg shadow-[#3B82F6]/50 ring-2 ring-white', hover: '', cursor: 'cursor-default' },
  confirmed:       { bg: 'bg-[#3F3F5A] opacity-70', hover: '', cursor: 'cursor-not-allowed' },
  taken:           { bg: 'bg-[#3F3F5A] opacity-70', hover: '', cursor: 'cursor-not-allowed' },
  pending_payment: { bg: 'bg-[#F5A623] opacity-60', hover: '', cursor: 'cursor-not-allowed' },
  otp_pending:     { bg: 'bg-[#3F3F5A] opacity-70', hover: '', cursor: 'cursor-not-allowed' },
  refund_pending:  { bg: 'bg-[#3F3F5A] opacity-70', hover: '', cursor: 'cursor-not-allowed' },
};

export default function Seat({ seat, isSelected, onClick }) {
  const status = isSelected ? 'mine' : seat.status;
  const config = statusConfig[status] || statusConfig.available;

  return (
    <motion.button
      whileHover={seat.status === 'available' ? { scale: 1.15 } : {}}
      whileTap={seat.status === 'available' ? { scale: 0.95 } : {}}
      onClick={() => onClick(seat)}
      title={`${seat.label || seat.seat_id} — ${seat.category || 'Standard'} — BDT ${seat.price || 450}`}
      className={`
        w-8 h-8 rounded-t-lg text-[11px] font-mono font-medium text-white
        transition-all duration-200 flex items-center justify-center shadow-sm
        ${config.bg} ${config.hover} ${config.cursor}
        ${seat.category === 'vip' ? 'ring-1 ring-[#A855F7]' : ''}
      `}
    >
      {seat.number || seat.label || seat.seat_id}
    </motion.button>
  );
}
