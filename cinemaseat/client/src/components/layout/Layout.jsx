import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0F] text-[#F0F0FF] font-sans antialiased">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-[#12121A] border-t border-[#2A2A40] py-6 mt-12 text-center text-xs text-[#555570]">
        <p>CinemaSeat Realtime Ticketing Engine • Hackathon Phase 2</p>
      </footer>
    </div>
  );
}
