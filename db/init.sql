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

-- Seed Data: test user and multiple rooms
INSERT INTO users (id, email, password_hash) 
VALUES ('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'test@example.com', 'hashedpassword');

INSERT INTO rooms (id, name, price_per_night, capacity, location) 
VALUES 
    ('10000000-0000-0000-0000-000000000001', 'King Suite - Deluxe', 350.00, 2, 'Tel Aviv'),
    ('10000000-0000-0000-0000-000000000002', 'Family Suite', 450.00, 4, 'Tel Aviv'),
    ('10000000-0000-0000-0000-000000000003', 'Economy Studio', 120.00, 1, 'Tel Aviv'),
    ('10000000-0000-0000-0000-000000000004', 'Luxury Penthouse', 800.00, 6, 'Tel Aviv'),

    ('10000000-0000-0000-0000-000000000005', 'Cozy Studio', 150.00, 1, 'Haifa'),
    ('10000000-0000-0000-0000-000000000006', 'Harbor View Suite', 260.00, 2, 'Haifa'),
    ('10000000-0000-0000-0000-000000000007', 'Couple Retreat', 200.00, 2, 'Haifa'),
    ('10000000-0000-0000-0000-000000000008', 'Family Apartment', 320.00, 4, 'Haifa'),

    ('10000000-0000-0000-0000-000000000009', 'Beachfront Luxury', 550.00, 4, 'Miami Beach'),
    ('10000000-0000-0000-0000-000000000010', 'Ocean View Room', 420.00, 3, 'Miami Beach'),
    ('10000000-0000-0000-0000-000000000011', 'Budget Room', 110.00, 1, 'Miami Beach'),
    ('10000000-0000-0000-0000-000000000012', 'Family Beach House', 700.00, 6, 'Miami Beach'),

    ('10000000-0000-0000-0000-000000000013', 'Modern Apartment', 220.00, 3, 'Berlin'),
    ('10000000-0000-0000-0000-000000000014', 'Design Loft', 300.00, 2, 'Berlin'),
    ('10000000-0000-0000-0000-000000000015', 'Classic Suite', 260.00, 2, 'Berlin'),
    ('10000000-0000-0000-0000-000000000016', 'Apartment with Terrace', 340.00, 4, 'Berlin'),

    ('10000000-0000-0000-0000-000000000017', 'Garden Villa', 400.00, 5, 'Lisbon'),
    ('10000000-0000-0000-0000-000000000018', 'Historic Home', 380.00, 4, 'Lisbon'),
    ('10000000-0000-0000-0000-000000000019', 'Seaside Apartment', 270.00, 3, 'Lisbon'),
    ('10000000-0000-0000-0000-000000000020', 'Couple Suite', 190.00, 2, 'Lisbon'),

    ('10000000-0000-0000-0000-000000000021', 'City Center Suite', 280.00, 2, 'Tokyo'),
    ('10000000-0000-0000-0000-000000000022', 'Minimalist Room', 160.00, 1, 'Tokyo'),
    ('10000000-0000-0000-0000-000000000023', 'Family Home', 360.00, 4, 'Tokyo'),
    ('10000000-0000-0000-0000-000000000024', 'Ryokan Style Suite', 420.00, 3, 'Tokyo'),

    ('10000000-0000-0000-0000-000000000025', 'Boutique Hotel', 190.00, 2, 'Paris'),
    ('10000000-0000-0000-0000-000000000026', 'Loft Studio', 210.00, 2, 'Paris'),
    ('10000000-0000-0000-0000-000000000027', 'Historic Apartment', 260.00, 3, 'Paris'),
    ('10000000-0000-0000-0000-000000000028', 'Romantic Suite', 330.00, 2, 'Paris'),

    ('10000000-0000-0000-0000-000000000029', 'Alpine Cabin', 210.00, 4, 'Zermatt'),
    ('10000000-0000-0000-0000-000000000030', 'Mountain View Chalet', 380.00, 6, 'Zermatt'),
    ('10000000-0000-0000-0000-000000000031', 'Ski-in Studio', 190.00, 2, 'Zermatt'),
    ('10000000-0000-0000-0000-000000000032', 'Luxury Chalet', 620.00, 8, 'Zermatt'),

    ('10000000-0000-0000-0000-000000000033', 'Seaside Bungalow', 170.00, 3, 'Barcelona'),
    ('10000000-0000-0000-0000-000000000034', 'Designer Suite', 240.00, 2, 'Barcelona'),
    ('10000000-0000-0000-0000-000000000035', 'Penthouse', 520.00, 4, 'Barcelona'),
    ('10000000-0000-0000-0000-000000000036', 'Beachfront Studio', 200.00, 2, 'Barcelona'),

    ('10000000-0000-0000-0000-000000000037', 'Historic Loft', 160.00, 2, 'London'),
    ('10000000-0000-0000-0000-000000000038', 'Central Apartment', 220.00, 3, 'London'),
    ('10000000-0000-0000-0000-000000000039', 'Townhouse', 300.00, 4, 'London'),
    ('10000000-0000-0000-0000-000000000040', 'Canary Wharf Suite', 360.00, 2, 'London'),

    ('10000000-0000-0000-0000-000000000041', 'Outback Retreat', 130.00, 2, 'Melbourne'),
    ('10000000-0000-0000-0000-000000000042', 'Harbour View', 250.00, 3, 'Melbourne'),
    ('10000000-0000-0000-0000-000000000043', 'Designer Apartment', 210.00, 2, 'Melbourne'),
    ('10000000-0000-0000-0000-000000000044', 'Garden Cottage', 180.00, 2, 'Melbourne'),

    ('10000000-0000-0000-0000-000000000045', 'Rio Penthouse', 300.00, 4, 'Rio de Janeiro'),
    ('10000000-0000-0000-0000-000000000046', 'Copacabana Room', 190.00, 2, 'Rio de Janeiro'),
    ('10000000-0000-0000-0000-000000000047', 'Samba Suite', 260.00, 3, 'Rio de Janeiro'),
    ('10000000-0000-0000-0000-000000000048', 'Bayfront Villa', 450.00, 5, 'Rio de Janeiro');