-- db/init.sql

-- Ensure UUID generation function is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    price_per_night DECIMAL(10, 2) NOT NULL,
    capacity INT NOT NULL,
    location VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'CONFIRMED',
    created_at TIMESTAMP DEFAULT NOW(),
    -- Constraint to ensure checkout date is after checkin date
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Critical composite index for availability check and concurrency handling
CREATE INDEX idx_bookings_room_dates ON bookings (room_id, start_date, end_date);

-- Seed Data: test user and two rooms
INSERT INTO users (id, email, password_hash) 
VALUES ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'test@example.com', 'hashedpassword');

INSERT INTO rooms (id, name, price_per_night, capacity, location) 
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'King Suite Tel Aviv', 350.00, 2, 'Tel Aviv'),
    ('00000000-0000-0000-0000-000000000002', 'Studio Haifa', 150.00, 1, 'Haifa');