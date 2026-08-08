import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(persist(
  (set) => ({
    token: null,
    phone: null,
    setAuth: (token, phone) => set({ token, phone }),
    logout: () => set({ token: null, phone: null })
  }),
  { name: 'cinema-auth' }
));
