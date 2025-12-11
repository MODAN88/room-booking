# Room Booking Platform
Demo video - https://fileport.io/K5E6xJNaHHWv

Enterprise-grade room booking system with **ACID transaction guarantees** and **pessimistic locking** to prevent double-bookings. The platform implements concurrent-safe booking operations using PostgreSQL's row-level locks (FOR UPDATE) within transaction boundaries.

**Key Features:**
- ✅ ACID-compliant booking transactions with conflict detection
- ✅ Pessimistic locking (FOR UPDATE) for race condition prevention
- ✅ JWT-based authentication with bcrypt password hashing
- ✅ Email notifications via SMTP (Gmail) with Ethereal test fallback
- ✅ RESTful API with comprehensive error handling
- ✅ Horizontal scalability with stateless backend design

-----

## 1\. Technical Architecture

### High-Level Components

  * **Frontend (UI):** React 18 + TypeScript SPA served by Nginx on port 8080
  * **Backend (BE):** Express.js + Node.js (TypeScript) - Stateless API with transaction-based concurrency control on port 3000
  * **Database:** PostgreSQL 15 with UUID support - Master database for ACID transactional consistency
  * **Cache:** Redis Alpine - Optional caching layer for read-heavy queries
  * **Orchestration:** Docker Compose with 4 containerized services
  * **Email:** Nodemailer with configurable SMTP (Gmail app password) + Ethereal fallback

### 

-----

## 2\. Concurrency Control & ACID Transactions

The booking system uses **ACID transactions** with **pessimistic locking** to guarantee data consistency under concurrent load.

### Double-Booking Prevention Algorithm

```
1. Client sends POST /api/v1/bookings with (roomId, startDate, endDate)
2. Backend validates:
   - Date format: ISO 8601 (YYYY-MM-DD)
   - Date logic: endDate > startDate
   - Authentication: JWT token required (401 if missing)
3. Backend initiates transaction: BEGIN
4. Query with FOR UPDATE lock:
   SELECT id FROM bookings 
   WHERE room_id = $1 
   AND start_date < $2          [new endDate]
   AND end_date > $3            [new startDate]
   AND status != 'CANCELLED'
   FOR UPDATE                   [blocks concurrent transactions]
5. Conflict detection:
   - If row exists: ROLLBACK and return 409 Conflict
   - If no conflict: INSERT booking and COMMIT
6. Upon success: Send confirmation email with booking details
```

**Why FOR UPDATE?**
- Pessimistic locking acquires exclusive locks on conflicting rows
- Other transactions block until current transaction completes
- Prevents phantom reads and lost updates
- Guarantees serializable isolation level for this operation

### Transaction Flow Diagram

```
Time →
T1: BEGIN                    T2: BEGIN
    SELECT ... FOR UPDATE ─→ (waits for lock release)
    INSERT booking
    COMMIT ──────────────→ (acquires lock)
                            SELECT finds no conflict
                            INSERT booking  
                            COMMIT
```

### Key Design Decisions

  * **Pessimistic Locking:** Chose FOR UPDATE over optimistic locking because booking conflicts are likely in high-demand periods
  * **Composite Index:** `bookings(room_id, start_date, end_date, status)` for efficient range queries
  * **Transaction Rollback:** Automatic ROLLBACK on any error ensures no partial bookings
  * **HTTP Status Codes:**
    - `201 Created` - Booking successful
    - `400 Bad Request` - Invalid date format or logic
    - `401 Unauthorized` - Missing/invalid JWT token
    - `409 Conflict` - Room already booked for dates

-----

## 3\. API Specification

RESTful API with JWT Bearer token authentication for protected endpoints.

### Authentication

**JWT Token Generation:**
- Algorithm: HS256
- Payload: `{ userId, email }`
- Expiration: 7 days
- Usage: `Authorization: Bearer <token>`

**Password Security:**
- Algorithm: bcrypt with 10 salt rounds
- Hash comparison: constant-time algorithm (timing attack resistant)

### Endpoints

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/register` | POST | None | Register user with email/password, returns JWT token (201) |
| `/api/v1/auth/login` | POST | None | Authenticate with email/password, returns JWT token (200) |
| `/api/v1/rooms` | GET | Optional | List all rooms with emoji icons and pricing (200) |
| `/api/v1/bookings` | GET | Optional | Retrieve all bookings (200) |
| `/api/v1/bookings` | POST | **Required** | Create booking with conflict detection, returns 201/409 |
| `/api/v1/bookings/:id/close` | POST | **Required** | Mark booking as CLOSED, owner-only (200) |
| `/api/v1/admin/reset` | POST | Optional | Truncate all tables for clean state (200) |
| `/health` | GET | None | Health check endpoint (200) |

### POST /api/v1/bookings Request/Response

**Request:**
```json
{
  "roomId": "00000000-0000-0000-0000-000000000001",
  "startDate": "2025-01-15",
  "endDate": "2025-01-18",
  "email": "guest@example.com"
}
```

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Success Response (201):**
```json
{
  "message": "Booking successful",
  "bookingId": "12345678-1234-5678-1234-567812345678",
  "emailSent": true,
  "emailPreviewUrl": null
}
```

**Conflict Response (409):**
```json
{
  "error": "Room is already booked for these dates",
  "conflictingBookings": [
    { "id": "existing-booking-id" }
  ]
}
```

**Validation Error (400):**
```json
{
  "error": "Invalid date format. Use YYYY-MM-DD"
}
```

**Authentication Error (401):**
```json
{
  "error": "Authentication required",
  "message": "You must be logged in to make a booking"
}
```

-----

## 4\. Database Schema & Indexing

PostgreSQL schema designed for concurrent transactional consistency.

### Tables

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  capacity INT NOT NULL,
  price_per_night DECIMAL(10,2) NOT NULL,
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'CONFIRMED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Critical Indexes

```sql
-- Users: email lookup
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Rooms: location/capacity search
CREATE INDEX idx_rooms_location ON rooms(location);
CREATE INDEX idx_rooms_capacity ON rooms(capacity);

-- Bookings: critical for conflict detection
CREATE INDEX idx_bookings_room_dates 
  ON bookings(room_id, start_date, end_date, status)
  WHERE status != 'CANCELLED';
```

### Overlap Detection Query

Finds all bookings that conflict with proposed [start_date, end_date):

```sql
SELECT id FROM bookings 
WHERE room_id = $1 
AND start_date < $2              -- proposed end_date
AND end_date > $3                -- proposed start_date
AND status != 'CANCELLED'
FOR UPDATE;                       -- pessimistic lock
```

**Overlap Logic:** Two date ranges overlap if:
- `rangeA.start < rangeB.end AND rangeA.end > rangeB.start`

-----

## 5\. Installation & Setup

### Prerequisites

- Docker & Docker Compose (Docker Desktop on macOS/Windows)
- Git
- Curl (for testing API endpoints)

### Quick Start

```bash
# Clone repository
git clone https://github.com/MODAN88/room-booking.git
cd room-booking

# Start all services
docker compose up --build

# Wait for PostgreSQL to be ready (~10 seconds)
# Services will be available at:
```

| Service | URL | Port |
| :--- | :--- | :--- |
| Frontend | http://localhost:8080 | 8080 |
| Backend API | http://localhost:3000 | 3000 |
| PostgreSQL | localhost:5432 | 5432 |
| Redis | localhost:6379 | 6379 |

### Database Initialization

The `db/init.sql` script automatically:
1. Creates schema with UUID support
2. Drops and recreates tables (clean slate on each restart)
3. Seeds 48 rooms across 13 countries
4. Inserts 1 test user

**Reset database:**
```bash
# Via API
curl -X POST http://localhost:3000/api/v1/admin/reset

# Or restart Docker
docker compose down -v
docker compose up --build
```

-----

## 6\. Testing Concurrency & Conflict Detection

### Manual Concurrency Test

Test the pessimistic locking mechanism by attempting simultaneous bookings:

```bash
# 1. Register a test user and get JWT token
REGISTER_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')

# 2. Define booking parameters
ROOM_ID="00000000-0000-0000-0000-000000000001"
PAYLOAD='{"roomId":"'$ROOM_ID'","startDate":"2025-02-01","endDate":"2025-02-05"}'

# 3. Send two simultaneous booking requests
(curl -s -X POST "http://localhost:3000/api/v1/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$PAYLOAD" | jq '.') &

sleep 0.1

(curl -s -X POST "http://localhost:3000/api/v1/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$PAYLOAD" | jq '.') &

wait
```

**Expected Behavior:**
- Request 1: `201 Created` with bookingId
- Request 2: `409 Conflict` with error message

### Validation Tests

```bash
TOKEN="<your_jwt_token>"

# Test 1: Invalid date format
curl -X POST "http://localhost:3000/api/v1/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"roomId":"...","startDate":"01-02-2025","endDate":"05-02-2025"}'
# Expected: 400 Bad Request

# Test 2: End date before start date
curl -X POST "http://localhost:3000/api/v1/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"roomId":"...","startDate":"2025-02-05","endDate":"2025-02-01"}'
# Expected: 400 Bad Request

# Test 3: Missing authentication
curl -X POST "http://localhost:3000/api/v1/bookings" \
  -d '{"roomId":"...","startDate":"2025-02-01","endDate":"2025-02-05"}'
# Expected: 401 Unauthorized

# Test 4: Valid booking
curl -X POST "http://localhost:3000/api/v1/bookings" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"roomId":"...","startDate":"2025-03-01","endDate":"2025-03-05"}'
# Expected: 201 Created with bookingId
```
