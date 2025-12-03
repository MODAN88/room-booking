import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

interface Room {
  id: string;
  name: string;
  price: number;
  location: string;
  capacity: number;
  emoji: string;
}

const ROOMS: Room[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'King Suite', price: 350, location: 'Tel Aviv', capacity: 2, emoji: '👑' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Studio', price: 150, location: 'Haifa', capacity: 1, emoji: '🏢' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Beachfront Luxury', price: 550, location: 'Tel Aviv', capacity: 4, emoji: '🏖️' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Modern Apartment', price: 220, location: 'Jerusalem', capacity: 3, emoji: '🏢' },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Garden Villa', price: 400, location: 'Jaffa', capacity: 5, emoji: '🏡' },
  { id: '00000000-0000-0000-0000-000000000006', name: 'City Center Suite', price: 280, location: 'Tel Aviv', capacity: 2, emoji: '🏙️' },
  { id: '00000000-0000-0000-0000-000000000007', name: 'Boutique Hotel', price: 190, location: 'Haifa', capacity: 2, emoji: '✨' }
];

const API_BASE_URL = 'http://localhost:3000';

interface BookingStatus {
  status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'CONFLICT' | 'ERROR';
  message: string;
}

const RoomBookingApp: React.FC = () => {
  const [view, setView] = useState<'rooms' | 'booking'>('rooms');
  const [selectedRoom, setSelectedRoom] = useState<Room>(ROOMS[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>({ status: 'IDLE', message: '' });

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setView('booking');
    setStartDate('');
    setEndDate('');
    setBookingStatus({ status: 'IDLE', message: '' });
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
          <div className="rooms-grid">
            {ROOMS.map(room => (
              <div key={room.id} className="room-card" onClick={() => handleRoomSelect(room)}>
                <div className="room-emoji">{room.emoji}</div>
                <h3>{room.name}</h3>
                <p className="location">📍 {room.location}</p>
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
      ) : (
        <div className="booking-view">
          <button className="back-btn" onClick={() => setView('rooms')}>← Back to Rooms</button>
          
          <div className="booking-card">
            <div className="selected-room">
              <div className="room-header">
                <span className="room-emoji-large">{selectedRoom.emoji}</span>
                <div className="room-info">
                  <h2>{selectedRoom.name}</h2>
                  <p className="location">📍 {selectedRoom.location}</p>
                </div>
              </div>
              <div className="room-details">
                <span className="detail">👥 {selectedRoom.capacity} {selectedRoom.capacity === 1 ? 'guest' : 'guests'}</span>
                <span className="detail price-highlight">${selectedRoom.price}/night</span>
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
                  className="date-input"
                />
              </div>

              {startDate && endDate && new Date(endDate) > new Date(startDate) && (
                <div className="nights-info">
                  {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} nights 
                  <span className="total-price">
                    = ${selectedRoom.price * Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))}
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