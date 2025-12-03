import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  room_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at?: string;
  room_name?: string;
  location?: string;
}

const API_BASE_URL = 'http://localhost:3000';

interface BookingStatus {
  status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'CONFLICT' | 'ERROR';
  message: string;
}

const RoomBookingApp = () => {
  const [view, setView] = useState<'rooms' | 'booking' | 'reservations'>('rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>({ status: 'IDLE', message: '' });

  useEffect(() => {
    // fetch rooms from backend
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/rooms`);
        const data = res.data;
        // support either { rooms: [...] } or raw array
        setRooms(Array.isArray(data) ? data : data.rooms || []);
        if ((Array.isArray(data) ? data : data.rooms || []).length > 0) {
          setSelectedRoom((Array.isArray(data) ? data : data.rooms || [])[0]);
        }
      } catch (err) {
        console.warn('Failed loading rooms', err);
      }
    };
    load();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/bookings`);
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

  const countries = ['All', ...Array.from(new Set(rooms.map(r => r.country)))];
  const filteredRooms = selectedCountry === 'All' ? rooms : rooms.filter(r => r.country === selectedCountry);

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
      await axios.post(`${API_BASE_URL}/api/v1/bookings`, {
        roomId: selectedRoom.id,
        startDate,
        endDate
      }, {
        headers: { 'Content-Type': 'application/json' } 
      });

      setBookingStatus({ status: 'SUCCESS', message: '✓ Room successfully booked!' });
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
        <h1>🏨 Room Booking System</h1>
        <p>Book your perfect stay</p>
      </header>

      {view === 'rooms' ? (
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
            {filteredRooms.map(room => (
              <div key={room.id} className="room-card" onClick={() => handleRoomSelect(room)}>
                <div className="room-emoji">{room.emoji}</div>
                <h3>{room.name}</h3>
                <p className="location">📍 {room.location} — {room.country}</p>
                <p className="capacity">👥 {room.capacity} {room.capacity === 1 ? 'guest' : 'guests'}</p>
                <div className="price-section">
                  <span className="price">${room.price}</span>
                  <span className="per-night">per night</span>
                </div>
                <button className="book-btn">Book Now</button>
              </div>
            ))}
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
                    <div><strong>{b.room_name || b.room_id}</strong> — {b.location}</div>
                    <div>{new Date(b.start_date).toLocaleDateString()} → {new Date(b.end_date).toLocaleDateString()}</div>
                    <div>Status: {b.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <p>© 2025 Room Booking System. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default function App() {
  return <RoomBookingApp />;
}