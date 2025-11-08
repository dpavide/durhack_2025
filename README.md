# DurHack 2025 Project

## Overview
This project is a full-stack web application designed for collaborative map-based decision making, such as group event planning or location voting. It combines a Next.js frontend with a FastAPI backend, integrating real-time features, Google Maps routing, and Supabase authentication/storage.

## Features
- **User Authentication:** Secure login and session management via Supabase.
- **Room System:** Users can create or join rooms for collaborative sessions.
- **Map Pinning:** Participants select and pin locations on an interactive map.
- **Voting:** Users vote for their favorite locations; votes are updated in real-time.
- **Route Calculation:** Backend uses Google Maps (Routes API) to compute and display optimal routes between selected points.
- **Results Page:** Visualizes the winning location and the best route for the group.
- **Real-Time Updates:** Leveraging Supabase channels for live voting and selection updates.

## Tech Stack
- **Frontend:** Next.js (React, TypeScript, Tailwind CSS)
- **Backend:** FastAPI (Python)
- **Database & Auth:** Supabase
- **Maps & Routing:** Google Maps API (Routes API)
- **Deployment:** Vercel (monorepo setup)

## Folder Structure
- `frontend/` — Next.js app (UI, pages, components)
- `api/` — FastAPI backend (routers, Google Maps integration)
- `public/` — Static assets

## Setup Instructions
1. **Clone the repository:**
   ```sh
   git clone https://github.com/dpavide/durhack_2025.git
   cd durhack_2025
   ```
2. **Install dependencies:**
   - Backend:
     ```sh
     cd api
     pip install -r requirements.txt
     ```
   - Frontend:
     ```sh
     cd ../frontend
     npm install
     ```
3. **Environment Variables:**
   - Set up `.env.local` in `frontend/` for Next.js (see `.env.example` if available).
   - Set up environment variables for Google Maps API keys and Supabase in both frontend and backend as needed.
4. **Run locally:**
   - Backend:
     ```sh
     cd api
     uvicorn main:app --reload
     ```
   - Frontend:
     ```sh
     cd frontend
     npm run dev
     ```
5. **Deployment:**
   - The project is configured for Vercel monorepo deployment. See `vercel.json` for details.

## API Endpoints (Backend)
- `POST /api/gmap/compute-routes` — Compute routes using Google Maps Routes API.
- `POST /api/gemini/ask` — (Optional) Interact with Gemini AI.
- `POST /api/map/overpass` — Query Overpass API for map data.

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License
MIT License
