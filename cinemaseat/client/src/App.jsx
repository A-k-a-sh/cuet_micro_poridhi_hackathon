import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import MoviePage from './pages/MoviePage';
import SeatMapPage from './pages/SeatMapPage';
import BookingPage from './pages/BookingPage';
import ConfirmationPage from './pages/ConfirmationPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1C1C2E',
            color: '#F0F0FF',
            border: '1px solid #2A2A40',
            borderRadius: '12px'
          }
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="movies/:id" element={<MoviePage />} />
          <Route path="shows/:showId/seats" element={<SeatMapPage />} />
          <Route path="bookings/:ref/pay" element={<BookingPage />} />
          <Route path="bookings/:ref/confirm" element={<ConfirmationPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
