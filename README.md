# 🏨 Room Booking Platform

This project implements a scalable and fault-tolerant Room Booking Platform designed around a **Microservices Architecture**. It fulfills the requirements of supporting user registration, room search, and booking capabilities, with a strong focus on **data consistency** and **concurrency handling**.

-----

## 1\. Architecture and Tech Stack

The system is designed with two core microservices (UI and BE), orchestrated by Docker Compose, and built on best-practice technologies for scalability and maintainability.

### High-Level Components

  * **Frontend (UI):** A Single Page Application (SPA) built with **React** and **TypeScript**, served by Nginx.
  * **Backend (BE):** A Stateless API service built with **Node.js** and **TypeScript** (Express), handling all business logic and concurrency control.
  * **Database:** **PostgreSQL** (Master/Replica model for scaling), chosen for its strong support for **ACID transactions** essential for booking integrity.
  * **Cache:** **Redis**, used for caching frequent search queries and potentially session management.
  * **Orchestration:** **Docker Compose** for local development setup.

### 

-----

## 2\. Key Design Decisions

### A. Concurrency Handling (Preventing Double Booking)

The most critical challenge is ensuring only one booking is confirmed for the same room and date range.

  * **Mechanism:** **Pessimistic Locking** via Database Transactions.
  * **Process:**
    1.  The Backend starts a **DB Transaction**.
    2.  It executes a query to check for overlapping bookings using date ranges and `room_id`.
    3.  The critical step is appending **`FOR UPDATE`** to the SELECT query, which locks any found rows (or the relevant index range) until the transaction commits.
    4.  If no conflict is found, the new booking is inserted.
    5.  The transaction is committed.
  * **Failure Mode:** If a concurrent request attempts to access the same resource, it either waits or fails the transaction, resulting in a **`409 Conflict`** response.

### B. Scalability Strategies

  * **Read/Write Splitting:** All high-volume **Search** (`GET /rooms`) requests are designed to hit **Read Replicas** and **Redis Cache** to offload the Database Master.
  * **Horizontal Scaling:** The Node.js Backend is **Stateless** and can be easily scaled horizontally (adding more instances) behind a Load Balancer (e.g., in Kubernetes/ECS).
  * **Asynchronous Processing:** Booking confirmations are handled by sending messages to a **Message Queue** (e.g., RabbitMQ), preventing the API response time from being tied to the email sending service.

-----

## 3\. API Endpoints

The API is RESTful, uses JSON, and requires authentication for booking.

| Endpoint | Method | Description | Authentication |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/register` | `POST` | User registration (returns JWT). | None |
| `/api/v1/rooms` | `GET` | **Search** for available rooms (requires `startDate`, `endDate` query params). | Optional |
| `/api/v1/bookings` | `POST` | Creates a new room booking (critical, concurrent operation). | Required (Mocked) |

-----

## 4\. Database Schema

Uses PostgreSQL with key indexes for performance and concurrency.

| Table | Primary Columns | Key Indexes |
| :--- | :--- | :--- |
| `users` | `id`, `email`, `password_hash` | `email` (UNIQUE) |
| `rooms` | `id`, `name`, `capacity`, `location` | `location`, `capacity` |
| **`bookings`** | `id`, `user_id` (FK), `room_id` (FK), `start_date`, `end_date` | **`idx_bookings_room_dates` (Composite)** |

-----

## 5\. Getting Started (Installation and Setup)

### Prerequisites

  * **Docker** (Docker Desktop on Mac/Windows) installed and running.
  * **Git** (for cloning the repository).

### Setup Instructions

1.  **Clone the repository and navigate to the root directory:**

    ```bash
    git clone [your-repo-link] room-booking-system
    cd room-booking-system
    ```

2.  **Build and Run the entire application using Docker Compose:**

    This command builds the Node.js and React images and starts all four containers (`db`, `cache`, `backend`, `frontend`).

    ```bash
    docker compose up --build
    ```

### Accessing the System

| Component | URL (Local) |
| :--- | :--- |
| **Frontend UI** | `http://localhost:8080` |
| **Backend API** | `http://localhost:3000` |
| **PostgreSQL DB** | `localhost:5432` |
| **Redis Cache** | `localhost:6379` |

-----

## 6\. Testing Concurrency (Double Booking Test)

You can manually test the concurrency mechanism using the terminal while the services are running. This test attempts to book the same room (`00000000-0000-0000-0000-000000000001`) simultaneously.

1.  **Define Variables:**

    ```bash
    ROOM_ID="00000000-0000-0000-0000-000000000001" 
    PAYLOAD='{"roomId": "'$ROOM_ID'", "startDate": "2025-01-01", "endDate": "2025-01-05"}'
    ```

2.  **Run Concurrent Requests:**

    ```bash
    (curl -s -X POST "http://localhost:3000/api/v1/bookings" -H "Content-Type: application/json" -d "$PAYLOAD" -w "\nRequest 1 Status: %{http_code}\n") &

    (curl -s -X POST "http://localhost:3000/api/v1/bookings" -H "Content-Type: application/json" -d "$PAYLOAD" -w "Request 2 Status: %{http_code}\n") &

    wait
    ```

3.  **Expected Output:** One request must return **`201`** (Created), and the other must return **`409`** (Conflict), proving that the concurrency lock successfully prevented double booking.
