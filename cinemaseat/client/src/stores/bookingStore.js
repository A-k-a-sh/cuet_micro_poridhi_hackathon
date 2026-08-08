import { create } from 'zustand';

export const useBookingStore = create((set) => ({
  currentBooking: null,
  selectedSeat: null,
  setBooking: (booking) => set({ currentBooking: booking }),
  setSelectedSeat: (seat) => set({ selectedSeat: seat }),
  clearBooking: () => set({ currentBooking: null, selectedSeat: null })
}));
