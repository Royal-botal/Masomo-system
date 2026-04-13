# Masomo Backend

## Setup

1. Copy `.env.example` to `.env` and update DB credentials.
2. Run the SQL script in `../Database/masomo.sq`.
3. Install dependencies:
   - `npm install`
4. Start server:
   - `npm run dev`

The API runs on `http://localhost:8080`.

## Default seeded institution

- Institution: `KCA University` (`KCAU`)
- Admin email: `admin@kcau.ac.ke`
- Admin password: `kcau123`
- Seeded sessions:
  - `Web Development`
  - `Programming`
  - `Java`
  - `Statistics`
  - `Database Systems`
  - `Data Structures`
  - `Operating Systems`
  - `Computer Networks`
  - `Software Engineering`
  - `Mobile App Development`
  - `Artificial Intelligence`
  - `Cyber Security`

## Main Endpoints

- `GET /health`
- `GET /api/v1/auth/staff/:staffId/lessons`
- `GET /api/v1/students`
- `POST /api/v1/students`
- `POST /api/v1/attendance/start-session`
- `POST /api/v1/attendance/verify`
- `POST /api/v1/attendance/close-session`
- `GET /api/v1/attendance/sessions`
- `GET /api/v1/attendance/report/:sessionId`
