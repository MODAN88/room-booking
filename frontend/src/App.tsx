import React, { useState } from 'react';
import axios from 'axios';

const ROOMS = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'King Suite Tel Aviv', price: '$350/night' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Studio Haifa', price: '$150/night' }
];
const API_BASE_URL = 'http://localhost:3000';

const RoomBookingApp: React.FC = () => {
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0].id);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'CONFLICT' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');

  const currentRoom = ROOMS.find(r => r.id === selectedRoom);

  const handleBooking = async () => {
    setStatus('LOADING');
    setMessage('');

    // Validate dates
    if (startDate === endDate) {
      setStatus('ERROR');
      setMessage('Check-out date must be after check-in date');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setStatus('ERROR');
      setMessage('Check-out date must be after check-in date');
      return;
    }

    try {
      // API Call to Backend
      await axios.post(`${API_BASE_URL}/api/v1/bookings`, {
        roomId: selectedRoom,
        startDate,
        endDate
      }, {
        headers: { 'Content-Type': 'application/json' } 
      });

      setStatus('SUCCESS');
      setMessage('Room successfully booked!');
      setStartDate('');
      setEndDate('');
    } catch (error: any) {
      if (error.response && error.response.status === 409) {
        setStatus('CONFLICT');
        setMessage('Error: This room was just booked by another user. Please choose different dates or a different room.');
      } else if (error.response && error.response.status === 400) {
        setStatus('ERROR');
        setMessage(error.response.data?.error || 'Invalid booking request');
      } else {
        setStatus('ERROR');
        setMessage(`An error occurred: ${error.message}`);
      }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', border: '1px solid #ccc', margin: '50px auto' }}>
      <h1>Room Booking System</h1>
      
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <label style={{ fontWeight: 'bold' }}>Select Room:</label>
        <select 
          value={selectedRoom} 
          onChange={e => setSelectedRoom(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '8px' }}
        >
          {ROOMS.map(room => (
            <option key={room.id} value={room.id}>
              {room.name} - {room.price}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p><strong>{currentRoom?.name}</strong></p>
        <p>{currentRoom?.price} per night</p>
      </div>
      
      <label>Check-in Date:</label>
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '8px' }} /><br/><br/>
      
      <label>Check-out Date:</label>
      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '8px' }} /><br/><br/>
      
      <button 
        onClick={handleBooking} 
        disabled={status === 'LOADING' || !startDate || !endDate || new Date(endDate) <= new Date(startDate)}
        style={{ 
          width: '100%',
          padding: '10px', 
          backgroundColor: (status === 'LOADING' || new Date(endDate) <= new Date(startDate)) ? '#ccc' : (status === 'CONFLICT' ? 'orange' : 'green'), 
          color: 'white', 
          border: 'none', 
          cursor: 'pointer',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        {status === 'LOADING' ? 'Processing...' : 'Book Now'}
      </button>

      {message && (
        <p style={{ marginTop: '20px', color: status === 'SUCCESS' ? 'green' : status === 'CONFLICT' ? 'orange' : 'red', fontWeight: 'bold', padding: '10px', backgroundColor: status === 'SUCCESS' ? '#d4edda' : status === 'CONFLICT' ? '#fff3cd' : '#f8d7da', borderRadius: '4px' }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default function App() {
  return <RoomBookingApp />;
}