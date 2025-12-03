import React, { useState } from 'react';
import axios from 'axios';

// Room ID from init.sql for testing
const TEST_ROOM_ID = '00000000-0000-0000-0000-000000000001'; 
const API_BASE_URL = 'http://localhost:3000'; // BE is accessible via port 3000

const RoomBookingApp: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'CONFLICT' | 'ERROR'>('IDLE');
  const [message, setMessage] = useState('');

  const handleBooking = async () => {
    setStatus('LOADING');
    setMessage('');

    try {
      // API Call to Backend
      await axios.post(`${API_BASE_URL}/api/v1/bookings`, {
        roomId: TEST_ROOM_ID,
        startDate,
        endDate
      }, {
        // Headers here would include the actual JWT token in a real app
        headers: { 'Content-Type': 'application/json' } 
      });

      setStatus('SUCCESS');
      setMessage('Room successfully booked!');
    } catch (error: any) {
      if (error.response && error.response.status === 409) {
        // Handles the Concurrency failure (Double Booking)
        setStatus('CONFLICT');
        setMessage('Error: This room was just booked by another user. Please choose different dates or a different room.');
      } else {
        setStatus('ERROR');
        setMessage(`An error occurred: ${error.message}`);
      }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', border: '1px solid #ccc', margin: '50px auto' }}>
      <h2>Book King Suite Tel Aviv</h2>
      <p>Room ID: {TEST_ROOM_ID}</p>
      
      <label>Check-in:</label>
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /><br/><br/>
      
      <label>Check-out:</label>
      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /><br/><br/>
      
      <button 
        onClick={handleBooking} 
        disabled={status === 'LOADING' || !startDate || !endDate}
        style={{ padding: '10px', backgroundColor: status === 'LOADING' ? '#ccc' : (status === 'CONFLICT' ? 'orange' : 'green'), color: 'white', border: 'none', cursor: 'pointer' }}
      >
        {status === 'LOADING' ? 'Processing...' : 'Book Now'}
      </button>

      {message && (
        <p style={{ color: status === 'SUCCESS' ? 'green' : 'red', fontWeight: 'bold' }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default function App() {
  return <RoomBookingApp />;
}