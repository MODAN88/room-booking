import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MdHotel, MdLocationOn, MdPeople, MdAttachMoney, MdCalendarToday, MdCheckCircle, MdCancel } from 'react-icons/md';
import './App.css';

interface Room {
  id: string;
  name: string;
  price: number;
  location: string;
  capacity: number;
  emoji: string;
  country: string;
}

interface Booking {
  id: string;
  user_id?: string;
  room_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at?: string;
  room_name?: string;
  location?: string;
}

// Use relative path /api that will be proxied by nginx to backend
const API_BASE_URL = '/api';

interface BookingStatus {
  status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'CONFLICT' | 'ERROR';
  message: string;
}

// Format date as dd/mm/yyyy
const formatDateDDMMYYYY = (dateStr: string): string => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const RoomBookingApp = () => {
  const [view, setView] = useState('auth' as 'rooms' | 'booking' | 'reservations' | 'auth');
  const [authMode, setAuthMode] = useState('login' as 'login' | 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null as { id: string; email: string } | null);
  const [token, setToken] = useState(null as string | null);
  
  const [rooms, setRooms] = useState([] as Room[]);
  const [bookings, setBookings] = useState([] as Booking[]);
  const [selectedRoom, setSelectedRoom] = useState(null as Room | null);
  const [selectedCountry, setSelectedCountry] = useState('All' as string);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bookingStatus, setBookingStatus] = useState({ status: 'IDLE', message: '' } as BookingStatus);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setCurrentUser(JSON.parse(savedUser));
      setView('rooms');
    }
  }, []);

  useEffect(() => {
    // fetch rooms and bookings from backend
    const load = async () => {
      try {
        const [roomsRes, bookingsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/v1/rooms`),
          axios.get(`${API_BASE_URL}/v1/bookings`)
        ]);

        const roomsData = roomsRes.data;
        const bookingsData = bookingsRes.data;

        const roomsArr: Room[] = Array.isArray(roomsData) ? roomsData : roomsData.rooms || [];
        const bookingsArr: Booking[] = Array.isArray(bookingsData) ? bookingsData : bookingsData.bookings || [];

        setRooms(roomsArr);
        setBookings(bookingsArr);

        if (roomsArr.length > 0) setSelectedRoom(roomsArr[0]);
      } catch (err) {
        console.warn('Failed loading rooms or bookings', err);
      }
    };
    load();
  }, []);

  const handleAuth = async () => {
    if (!email || !password) {
      setAuthError('Email and password required');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = authMode === 'login' ? '/v1/auth/login' : '/v1/auth/register';
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, { email, password });
      
      const { token: newToken, user } = response.data;
      
      setToken(newToken);
      setCurrentUser(user);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      setEmail('');
      setPassword('');
      setView('rooms');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Authentication failed';
      setAuthError(errorMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setEmail('');
    setPassword('');
    setAuthError('');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setView('auth');
  };

  const fetchBookings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/v1/bookings`);
      const data = res.data;
      setBookings(Array.isArray(data) ? data : data.bookings || []);
    } catch (err) {
      console.warn('Failed loading bookings', err);
    }
  };

  // Helper: ISO date (yyyy-mm-dd)
  const toISODate = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const minStart = toISODate(tomorrow);
  const minEnd = startDate ? toISODate(new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000)) : toISODate(new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000));

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setView('booking');
    setStartDate('');
    setEndDate('');
    setBookingStatus({ status: 'IDLE', message: '' });
  };

  const countries = ['All', ...Array.from(new Set(rooms.map((r: Room) => r.country)))];
  const filteredRooms = selectedCountry === 'All' ? rooms : rooms.filter((r: Room) => r.country === selectedCountry);

  // helper: compute next upcoming booking for a room
  const getNextBookingForRoom = (roomId: string) => {
    const now = new Date();
    const upcoming = bookings
      .filter((b: Booking) => b.room_id === roomId)
      .map((b: Booking) => ({ ...b, start: new Date(b.start_date), end: new Date(b.end_date) }))
      .filter((b: any) => b.end > now)
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());
    return upcoming.length > 0 ? upcoming[0] : null;
  };

  const handleBooking = async () => {
    setBookingStatus({ status: 'LOADING', message: '' });

    if (startDate === endDate) {
      setBookingStatus({ status: 'ERROR', message: 'Check-out date must be after check-in date' });
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setBookingStatus({ status: 'ERROR', message: 'Check-out date must be after check-in date' });
      return;
    }

    try {
      const authToken = token || localStorage.getItem('token') || '';
      const res = await axios.post(`${API_BASE_URL}/v1/bookings`, {
        roomId: selectedRoom!.id,
        startDate,
        endDate
      }, {
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }
      });

      const previewUrl = res.data?.emailPreviewUrl;

      setBookingStatus({ status: 'SUCCESS', message: previewUrl ? `✓ Room booked! Preview email: ${previewUrl}` : '✓ Room successfully booked!' });
      setStartDate('');
      setEndDate('');
      
      setTimeout(() => {
        setView('rooms');
        setBookingStatus({ status: 'IDLE', message: '' });
      }, 2000);
    } catch (error: any) {
      if (error.response && error.response.status === 409) {
        setBookingStatus({ status: 'CONFLICT', message: '⚠️ This room was just booked! Choose different dates or another room.' });
      } else if (error.response && error.response.status === 400) {
        setBookingStatus({ status: 'ERROR', message: error.response.data?.error || 'Invalid booking request' });
      } else {
        setBookingStatus({ status: 'ERROR', message: `Error: ${error.message}` });
      }
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setView('rooms')}>
            <img src="/logo.svg" alt="RoomBook" style={{ height: 56 }} />
            <div>
              <h1 style={{ display: 'inline', verticalAlign: 'middle' }}>Room Booking System</h1>
              <p style={{ marginTop: 4 }}>Book your perfect stay</p>
            </div>
          </div>
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <span style={{ color: 'white', fontSize: '0.95em' }}>👤 {currentUser.email}</span>
              <button 
                onClick={handleLogout}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '2px solid white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.3s ease'
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {view === 'auth' ? (
        <div className="auth-view">
          <div className="auth-card">
            <h2 style={{ color: '#333', marginBottom: 20, textAlign: 'center' }}>
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  padding: '12px 15px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '1em',
                  fontFamily: 'inherit'
                }}
              />
              
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAuth()}
                style={{
                  padding: '12px 15px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '1em',
                  fontFamily: 'inherit'
                }}
              />

              {authError && (
                <div style={{
                  background: '#f8d7da',
                  color: '#721c24',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.9em',
                  border: '1px solid #f5c6cb'
                }}>
                  {authError}
                </div>
              )}

              <button
                onClick={handleAuth}
                disabled={authLoading}
                style={{
                  padding: '12px',
                  background: authLoading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1em',
                  fontWeight: 'bold',
                  cursor: authLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                {authLoading ? '⏳ Processing...' : (authMode === 'login' ? 'Login' : 'Register')}
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setAuthError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.95em',
                    fontWeight: 600
                  }}
                >
                  {authMode === 'login' ? "Don't have an account? Register" : 'Already have an account? Login'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : view === 'rooms' ? (
        <div className="rooms-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ color: 'white' }}>Available Rooms</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <div>
                <label style={{ color: 'white', marginRight: 10, fontWeight: 600 }}>Country:</label>
                <select value={selectedCountry} onChange={(e: any) => setSelectedCountry(e.target.value)} style={{ padding: '8px', borderRadius: 6 }}>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <button onClick={() => { setView('reservations'); fetchBookings(); }} style={{ padding: '8px 12px', borderRadius: 6 }}>Show Reservations</button>
              </div>
            </div>
          </div>
          <div className="rooms-grid">
            {filteredRooms.map(room => {
              const next = getNextBookingForRoom(room.id);
              return (
                <div key={room.id} className="room-card" onClick={() => handleRoomSelect(room)}>
                  <div className="room-emoji">{room.emoji}</div>
                  <h3>{room.name}</h3>
                  <p className="location">📍 {room.location} — {room.country}</p>
                  <p className="capacity">👥 {room.capacity} {room.capacity === 1 ? 'guest' : 'guests'}</p>
                  <div className="price-section">
                    <span className="price">${room.price}</span>
                    <span className="per-night">per night</span>
                  </div>
                  {next ? (
                    <div style={{ marginBottom: 12, color: '#b00020', fontWeight: 600 }}>
                      Booked: {formatDateDDMMYYYY(next.start_date)} → {formatDateDDMMYYYY(next.end_date)}
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12, color: '#0a8a0a', fontWeight: 600 }}>Available</div>
                  )}
                  <button className="book-btn">Book Now</button>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === 'booking' ? (
        <div className="booking-view">
          <button className="back-btn" onClick={() => setView('rooms')}>← Back to Rooms</button>

          <div className="booking-card">
            <div className="selected-room">
              <div className="room-header">
                <span className="room-emoji-large">{selectedRoom?.emoji}</span>
                <div className="room-info">
                  <h2>{selectedRoom?.name}</h2>
                  <p className="location">📍 {selectedRoom?.location}</p>
                </div>
              </div>
              <div className="room-details">
                <span className="detail">👥 {selectedRoom?.capacity} {selectedRoom?.capacity === 1 ? 'guest' : 'guests'}</span>
                <span className="detail price-highlight">${selectedRoom?.price}/night</span>
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="start-date">Check-in Date</label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  min={minStart}
                  className="date-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="end-date">Check-out Date</label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={minEnd}
                  className="date-input"
                />
              </div>

              <p style={{ fontSize: '0.9em', color: '#555' }}>Bookings are only allowed for future dates. A confirmation email will be sent after successful booking (if configured).</p>

              {startDate && endDate && new Date(endDate) > new Date(startDate) && (
                <div className="nights-info">
                  {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} nights 
                  <span className="total-price">
                    = ${Number(selectedRoom?.price || 0) * Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))}
                  </span>
                </div>
              )}

              <button
                onClick={handleBooking}
                disabled={
                  bookingStatus.status === 'LOADING' ||
                  !startDate ||
                  !endDate ||
                  new Date(endDate) <= new Date(startDate)
                }
                className={`book-button ${bookingStatus.status}`}
              >
                {bookingStatus.status === 'LOADING' ? '⏳ Processing...' : '✓ Confirm Booking'}
              </button>

              {bookingStatus.message && (
                <div className={`message message-${bookingStatus.status}`}>
                  {bookingStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="reservations-view">
          <button className="back-btn" onClick={() => setView('rooms')}>← Back to Rooms</button>
          <h2 style={{ color: 'white', marginTop: 12 }}>Reservations</h2>
          <div style={{ marginTop: 12 }}>
            {bookings.length === 0 ? (
              <p style={{ color: '#ddd' }}>No reservations found.</p>
            ) : (
              <div className="bookings-list">
                {bookings.map(b => (
                  <div key={b.id} className="booking-row">
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}><strong>{b.room_name || b.room_id}</strong> — {b.location}</div>
                      <div style={{ minWidth: 220 }}>{formatDateDDMMYYYY(b.start_date)} → {formatDateDDMMYYYY(b.end_date)}</div>
                      <div style={{ minWidth: 140 }}>Status: {b.status}</div>
                      {token && currentUser && b.user_id === currentUser.id && b.status !== 'CLOSED' && (
                        <button onClick={async () => {
                          try {
                            const res = await axios.post(`${API_BASE_URL}/v1/bookings/${b.id}/close`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            const preview = res.data?.emailPreviewUrl;
                            alert(preview ? `Booking closed. Email preview: ${preview}` : 'Booking closed.');
                            fetchBookings();
                          } catch (err: any) {
                            alert(err.response?.data?.error || 'Failed to close booking');
                          }
                        }} style={{ marginLeft: 12 }}>Close</button>
                      )}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {formatDateDDMMYYYY(b.start_date)} → {formatDateDDMMYYYY(b.end_date)}
                    </div>
                    <div style={{ marginTop: 6 }}>Status: {b.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <p>© 2025 Room Booking System by Modan Baron.</p>
      </footer>
    </div>
  );
};

export default function App() {
  return <RoomBookingApp />;
}