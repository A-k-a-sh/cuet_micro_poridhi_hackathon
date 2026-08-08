import { Link, useNavigate } from 'react-router-dom';
import { Film, User, LogOut, Ticket } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function Navbar() {
  const { phone, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-[#12121A]/80 backdrop-blur-md border-b border-[#2A2A40]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F5A623] to-[#C47D10] flex items-center justify-center shadow-lg shadow-[#F5A623]/20 group-hover:scale-105 transition-transform">
            <Film className="w-5 h-5 text-[#0A0A0F]" />
          </div>
          <div>
            <span className="font-['Syne'] font-extrabold text-xl tracking-tight text-[#F0F0FF]">
              Cinema<span className="text-[#F5A623]">Seat</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-[#1C1C2E] text-[#8888AA] border border-[#2A2A40]">
              Realtime
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {phone ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1C1C2E] border border-[#2A2A40]">
                <User className="w-4 h-4 text-[#F5A623]" />
                <span className="text-xs font-mono text-[#F0F0FF]">{phone}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-[#1C1C2E] text-[#8888AA] hover:text-[#F0F0FF] hover:bg-[#2A2A40] transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5A623] text-[#0A0A0F] font-semibold text-sm hover:bg-[#C47D10] transition-all shadow-md shadow-[#F5A623]/20 hover:shadow-[#F5A623]/30"
            >
              <User className="w-4 h-4" />
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
