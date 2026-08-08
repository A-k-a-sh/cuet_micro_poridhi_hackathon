import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Server, Shield, Users, Lock } from 'lucide-react';

export default function MetricsDashboard({ metrics }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!metrics) return null;

  const isGatewayHealthy = metrics.gateway_status !== 'down';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-[#12121A]/95 backdrop-blur-md border border-[#2A2A40] rounded-2xl shadow-2xl overflow-hidden min-w-[260px] text-xs">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between bg-[#1C1C2E] hover:bg-[#2A2A40] transition-colors text-[#F0F0FF] font-semibold"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#F5A623]" />
            <span>System Telemetry</span>
          </div>
          {isOpen ? <ChevronDown className="w-4 h-4 text-[#8888AA]" /> : <ChevronUp className="w-4 h-4 text-[#8888AA]" />}
        </button>

        {isOpen && (
          <div className="p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between text-[#8888AA]">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#F5A623]" /> Active Holds
              </span>
              <span className="font-bold text-[#F0F0FF]">{metrics.active_holds ?? 0}</span>
            </div>

            <div className="flex items-center justify-between text-[#8888AA]">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#22C55E]" /> Bookings (60s)
              </span>
              <span className="font-bold text-[#F0F0FF]">{metrics.bookings_last_60s ?? 0}</span>
            </div>

            <div className="flex items-center justify-between text-[#8888AA]">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#3B82F6]" /> Duplicate Callbacks Blocked
              </span>
              <span className="font-bold text-[#F0F0FF]">{metrics.duplicate_callbacks_intercepted ?? 0}</span>
            </div>

            <div className="flex items-center justify-between text-[#8888AA]">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#A855F7]" /> Connected Sockets
              </span>
              <span className="font-bold text-[#F0F0FF]">{metrics.connected_clients ?? 1}</span>
            </div>

            <div className="pt-2 border-t border-[#2A2A40] flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#8888AA]">
                <Server className="w-3.5 h-3.5" /> Gateway
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isGatewayHealthy ? 'bg-[#22C55E]' : 'bg-red-500 animate-ping'}`} />
                <span className={`font-semibold uppercase text-[10px] ${isGatewayHealthy ? 'text-[#22C55E]' : 'text-red-400'}`}>
                  {metrics.gateway_status || 'HEALTHY'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
