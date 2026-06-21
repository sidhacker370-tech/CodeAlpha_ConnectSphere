# 🌌 ConnectSphere

ConnectSphere is a premium, real-time video conferencing and collaboration platform designed with a high-fidelity glassmorphic dark-mode interface. It combines mesh WebRTC video streams, a shared whiteboard, live chat, and a secure workspace file manager into a single workspace.

The project is structured with a modern, reactive **React 19 + Vite** frontend and a stateless **Node.js + Express + TypeScript** backend, connected by **Socket.io** and verified cryptographically by **Firebase Authentication**.

---

## ✨ Features

### 🎥 WebRTC Multi-User Video & Screen Sharing
* **Mesh WebRTC Protocol**: Peer-to-peer audio and video transmission with sub-second latency.
* **Screen Sharing**: Live screen capture injection replacing media tracks without renegotiation.
* **Active Speaker Focus**: Dynamic audio analyzer tracking microphone volumes to visually highlight active participants.
* **Headless Media Fallback**: Simulated animated canvas video feeds and silent audio oscillators to allow full meeting operations in virtual or headless environments.

### 🎨 Collaborative whiteboard Canvas
* **Real-Time Synergy**: Relays drawing commands globally via Socket.io.
* **Responsive Scaling**: Utilizes relative coordinate conversion (percentage-based) to ensure drawing scales perfectly on screens of any resolution.
* **Tools Palette**: Adjustable brush thickness, color picker, pencil, eraser, and an option to clear the canvas.

### 💬 In-Room Chat Drawer
* **Auto-Scrolling Bubble Feed**: Instant text messages organized into groups with timestamps.
* **Active Sync**: Relays incoming chat events instantly while simultaneously storing logs in the SQL database.

### 📁 Meeting Workspace File Sharing
* **Secure Storage Layer**: Uses Multer with custom validation constraints on the backend.
* **Rules & Guardrails**: Enforces a 25MB file size limit and restricts uploads to PDF, DOCX, PPTX, and standard image formats.

### 🔑 Secure Firebase Auth & Auto-Sync Middleware
* **Multi-Provider Authentication**: Email/password registration, password resets, and Google OAuth popup sign-ins.
* **Cryptographic Token Verification**: Backend middleware intercepts requests and verifies the Firebase ID Token signature via modular `firebase-admin` subpaths.
* **Database Auto-Synchronization**: Automatically finds or creates a matching record in the local database (SQLite/PostgreSQL) upon verifying a Firebase token.
* **Developer Bypass Mode**: Graceful local demo mode that lets developers login offline using mock accounts if Firebase environment variables are missing.

### 🤖 Weekly Self-Testing & Self-Healing Cron
* **Automated Diagnosis**: Includes a test runner (`scripts/test-app.js`) performing compilation checks, server pings, and database validation.
* **Weekly Scheduler**: A registered cron schedule triggers testing and automatically applies fixes to code errors every week.

---

## 🛠️ Technology Stack

* **Frontend**: React 19, Vite, Zustand, Tailwind CSS, Lucide React, Framer Motion, Axios.
* **Backend**: Node.js, Express, TypeScript, Socket.io, Multer, Helmet, Express Rate Limit.
* **Database & ORM**: Prisma ORM, SQLite (local development), PostgreSQL (production-ready).
* **Security & Auth**: Firebase Client SDK, Firebase Admin SDK.

---

## 📂 Project Structure

```bash
ConnectSphere/
├── src/                    # Frontend React 19 Application
│   ├── config/             # Firebase Client initialization
│   ├── store/              # Zustand state stores (authStore, roomStore)
│   ├── hooks/              # useWebRTC media and peer connection layer
│   ├── components/         # ProtectedRoute, whiteboard, chat, file sharing
│   └── pages/              # Login, Register, Dashboard, Meeting Room
├── server/                 # Backend Node.js Signaling & API Server
│   ├── src/
│   │   ├── config/         # App credentials & Firebase Admin setup
│   │   ├── middleware/     # Firebase token verification & auto-sync
│   │   ├── controllers/    # API endpoint handlers (Auth history, Room code, Uploads)
│   │   ├── routes/         # Express endpoints definitions
│   │   ├── socket/         # Socket.io signaling coordinator
│   │   └── services/       # Prisma database service client
│   └── prisma/             # Schema definitions and migrations
└── scripts/                # Weekly self-testing node scripts
```

---

## 🚀 Local Development Setup

### 1. Database Initialization
Inside the `/server` folder, install backend packages, generate the Prisma client, and run migrations:
```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate
```

### 2. Configure Environment Variables

Create `.env` in the root workspace directory for the frontend:
```env
VITE_API_URL="http://localhost:5000"
VITE_FIREBASE_API_KEY="your-firebase-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-firebase-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-firebase-project"
VITE_FIREBASE_STORAGE_BUCKET="your-firebase-project.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"
```

Create `server/.env` in the `/server` directory for the backend:
```env
DATABASE_URL="file:./dev.db"
PORT=5000
NODE_ENV="development"
CLIENT_URL="http://localhost:5173"
FIREBASE_PROJECT_ID="your-firebase-project"
```

*Note: If no Firebase configuration is provided, the application will automatically prompt you to use **Developer Bypass Mode** to test the whiteboard and video conferencing capabilities offline.*

### 3. Launch Development Servers

Start the backend API and Socket signaling server:
```bash
# Inside /server
npm run dev
```
*Signaling server runs on `http://localhost:5000`.*

In another terminal, start the Vite frontend server:
```bash
# Inside root directory
npm run dev
```
*React app opens on `http://localhost:5173/`.*

---

## 🌐 Production Deployment Guide

### 1. Switch Database to PostgreSQL
1. Change the provider in `server/prisma/schema.prisma` from `"sqlite"` to `"postgresql"`.
2. Configure `DATABASE_URL` in your server environment variables:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
   ```
3. Push migrations to your live instance:
   ```bash
   npx prisma db push
   ```

### 2. Secure Firebase Admin
On your hosting platform, set the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable pointing to your downloaded Firebase Service Account credentials JSON file to disable fallback mode and strictly verify token signatures.

### 3. Configure NAT Traversal (STUN/TURN)
Mesh WebRTC requires a TURN server to route traffic between computers behind symmetric NAT firewalls. Update the `VITE_ICE_SERVERS` environment variable on your hosting dashboard:
```json
VITE_ICE_SERVERS='{"iceServers":[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:your-turn-domain.com","username":"xxx","credential":"xxx"}]}'
```
