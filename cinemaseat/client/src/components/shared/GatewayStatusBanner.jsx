import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function GatewayStatusBanner() {
  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-[#F5A623]/10 border-b border-[#F5A623]/30 text-[#F5A623] text-xs text-center py-2.5 px-4 flex items-center justify-center gap-2 font-medium"
    >
      <AlertTriangle className="w-4 h-4 text-[#F5A623] shrink-0" />
      <span>
        Payment systems are experiencing delays. Your booking is safe — we'll process it automatically.
      </span>
    </motion.div>
  );
}
