# 🖥️ RemoteView

**Professional Android Remote Screen Sharing Platform**

A secure, real-time platform for remote Android screen sharing. Generate an invitation link, share it with an Android device owner, and view their screen live from anywhere in the world.

![RemoteView](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![WebRTC](https://img.shields.io/badge/WebRTC-enabled-orange)

---

## ✨ Features

- **🔗 Invitation System** — Generate unique shareable links for screen sharing sessions
- **📱 Android Integration** — Native MediaProjection API support via companion app + browser fallback
- **🎥 Real-time Streaming** — Low-latency WebRTC-based screen streaming
- **🔒 Security First** — JWT auth, encrypted connections, one-time session tokens
- **🌐 Works Anywhere** — Share screens across different networks worldwide
- **🎨 Premium UI** — Dark-themed SaaS dashboard with modern glass-morphism design
- **📊 Session Management** — Track active sessions, devices, and connection history

---

## 🏗️ Architecture

```
┌─────────────────┐     HTTPS/WSS      ┌──────────────────┐     HTTPS/WSS      ┌──────────────────┐
│                 │◄───────────────────►│                  │◄───────────────────►│                  │
│  Web Dashboard  │     WebRTC P2P      │   Node.js Server │     WebRTC P2P      │  Android Device  │
│  (Next.js)      │◄──────────────────────────────────────────────────────────►│  (Companion App) │
│                 │                     │  - REST API      │                     │  - MediaProject  │
│  - Auth Pages   │                     │  - WebSocket     │                     │  - WebRTC Client │
│  - Dashboard    │                     │  - JWT Auth      │                     │  - Screen Capture│
│  - Screen View  │                     │  - PostgreSQL    │                     │                  │
└─────────────────┘                     └──────────────────┘                     └──────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+
- **Git**

### 1. Clone & Install

```bash
# Clone the repository
git clone <repo-url> remoteview
cd remoteview

# Install all dependencies
npm run setup
```

### 2. Configure Environment

```bash
# Server configuration
cp server/.env.example server/.env
# Edit server/.env with your database credentials and JWT secret
```

**Required environment variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/remoteview` |
| `JWT_SECRET` | Secret key for JWT tokens | *must change* |
| `JWT_EXPIRY` | Token expiration | `7d` |
| `CLIENT_URL` | Frontend URL (for CORS) | `http://localhost:3000` |
| `NODE_ENV` | Environment | `development` |

### 3. Set Up Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE remoteview;"

# Run migrations
npm run db:setup
```

### 4. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:server  # Backend on http://localhost:5000
npm run dev:client  # Frontend on http://localhost:3000
```

### 5. Open the App

Navigate to **http://localhost:3000** in your browser.

---

## 📱 Android Setup

The platform supports two methods for Android screen sharing:

### Option A: Browser-Based (Quick Setup)
1. Generate an invitation link from the dashboard
2. Share the link with the Android device owner
3. They open the link in Chrome/Firefox on their Android device
4. Grant screen sharing permission through the browser
5. Screen sharing begins immediately

### Option B: Native Companion App (Recommended)
See the [Android Companion App Guide](docs/ANDROID_COMPANION.md) for building and installing the native app, which provides:
- Better performance and lower latency
- Persistent foreground notification
- Background screen sharing support
- Native Android permission handling

---

## 📂 Project Structure

```
remoteview/
├── package.json              # Root package with workspace scripts
├── server/                   # Node.js backend
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js          # Express + WebSocket server entry
│       ├── config/
│       │   └── database.js   # Sequelize configuration
│       ├── middleware/
│       │   └── auth.js       # JWT authentication middleware
│       ├── models/
│       │   ├── index.js      # Model associations
│       │   ├── User.js       # User model
│       │   ├── Device.js     # Device model
│       │   └── Session.js    # Session model
│       ├── routes/
│       │   ├── auth.js       # Auth endpoints
│       │   ├── devices.js    # Device management
│       │   ├── sessions.js   # Session management
│       │   └── invite.js     # Invitation handling
│       ├── websocket/
│       │   └── signaling.js  # WebRTC signaling server
│       └── scripts/
│           └── setupDb.js    # Database setup script
├── client/                   # Next.js frontend
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.js     # Root layout
│       │   ├── page.js       # Landing page
│       │   ├── globals.css   # Global styles
│       │   ├── login/        # Login page
│       │   ├── register/     # Register page
│       │   ├── dashboard/    # Main dashboard
│       │   ├── session/[id]/ # Live screen viewer
│       │   └── invite/[token]/ # Invitation page
│       ├── components/       # Reusable components
│       ├── contexts/         # React contexts
│       ├── hooks/            # Custom hooks
│       └── lib/              # Utilities
└── docs/                     # Documentation
    └── ANDROID_COMPANION.md  # Android app guide
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Get current user |

### Devices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List user's devices |
| POST | `/api/devices` | Register device |
| PUT | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Remove device |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create new session |
| GET | `/api/sessions/:id` | Get session details |
| POST | `/api/sessions/:id/end` | End session |

### Invitations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invite/:token` | Get invitation info |
| POST | `/api/invite/:token/accept` | Accept invitation |

### WebSocket (Signaling)
Connect to `ws://localhost:5000` with query params `?sessionId=<id>&role=<viewer|sharer>`

| Event | Direction | Description |
|-------|-----------|-------------|
| `join` | Client → Server | Join session room |
| `offer` | Peer → Peer | SDP offer |
| `answer` | Peer → Peer | SDP answer |
| `ice-candidate` | Peer → Peer | ICE candidate |
| `peer-connected` | Server → Client | Peer joined |
| `peer-disconnected` | Server → Client | Peer left |

---

## 🔒 Security

- **JWT Authentication** — Stateless token-based auth with configurable expiry
- **Password Hashing** — bcrypt with salt rounds
- **HTTPS/WSS** — Encrypted transport (configure TLS in production)
- **SRTP** — WebRTC media streams are encrypted by default
- **Rate Limiting** — API endpoint protection against abuse
- **CORS** — Configured allowed origins
- **Helmet** — Security headers
- **Session Tokens** — Unique, one-time invitation tokens with 24h expiry
- **Explicit Consent** — Android permission dialog required before sharing

---

## 🌐 Production Deployment

### TURN Server (Required for NAT Traversal)

For connections across different networks, you need a TURN server:

```bash
# Install coturn
sudo apt install coturn

# Configure /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
realm=your-domain.com
server-name=your-domain.com
fingerprint
lt-cred-mech
user=remoteview:your-turn-password
```

### Docker Deployment

```dockerfile
# Server Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --production
COPY server/src ./src
EXPOSE 5000
CMD ["node", "src/index.js"]
```

### Environment Checklist
- [ ] Set strong `JWT_SECRET`
- [ ] Configure PostgreSQL with SSL
- [ ] Set up TURN server
- [ ] Enable HTTPS with valid certificate
- [ ] Configure CORS for production domain
- [ ] Set `NODE_ENV=production`
- [ ] Set up database backups
- [ ] Configure rate limiting for production load

---

## 🛠️ Development

```bash
# Run backend only
cd server && npm run dev

# Run frontend only
cd client && npm run dev

# Run both
npm run dev
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
