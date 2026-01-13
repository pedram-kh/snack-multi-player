# Snake Multiplayer - Architecture & Development Guide

## 📋 Project Overview

An online multiplayer Snake game where **2 players** compete in real-time. Only one game room is available at a time - if a game is in progress, other players must wait.

---

## 🏗️ Architecture

```
┌─────────────────┐          ┌─────────────────┐
│   Player 1      │          │   Player 2      │
│   (Browser)     │          │   (Browser)     │
│   Mobile/PC     │          │   Mobile/PC     │
└────────┬────────┘          └────────┬────────┘
         │                            │
         │      WebSocket             │
         └──────────┬─────────────────┘
                    │
           ┌────────▼────────┐
           │   Node.js       │
           │   Server        │
           │   (Socket.io)   │
           │                 │
           │   Hosted on     │
           │   Railway.app   │
           └─────────────────┘
```

---

## 📁 Project Structure

```
snack-multi-player/
├── ARCHITECTURE.md      # This file
├── index.html           # Main game page
├── style.css            # Game styles
├── script.js            # Frontend game logic
└── server/
    ├── package.json     # Node.js dependencies
    ├── server.js        # Backend server code
    └── .gitignore       # Git ignore file
```

---

## 🎮 Game Rules

### Multiplayer Mode
- **2 players only** compete at a time
- Third player sees "Room Taken" message
- Both snakes start on opposite corners
- Snakes can pass through each other (immune)
- **One food item** - both compete for it
- Player who survives longest wins
- Game ends when one snake hits a wall

### Single Player Mode
- Same as original game
- Choose difficulty (Easy/Normal/Hard)

---

## 🔄 Game Flow

```
[Main Menu]
     │
     ├── [1 Player] → [Select Difficulty] → [Play Alone]
     │
     └── [2 Player] 
            │
            ├── Room Available → [Waiting Room] → [Game Starts]
            │                         │
            │                         └── 5 min timeout → Back to Menu
            │
            └── Room Taken → Button Disabled + Message
```

---

## 🖥️ Server Responsibilities

### 1. Room Management
- Track if game room is available or occupied
- Maximum 2 players at a time
- Broadcast room status to all connected clients

### 2. Matchmaking
- First player waits in queue
- Second player joins → Game starts
- 5-minute timeout for waiting player

### 3. Game State Sync (Input Sync Method)
- Only sync direction changes (not full positions)
- Both clients calculate positions locally
- Reduces bandwidth and latency issues

### 4. Events Handled
| Event | Description |
|-------|-------------|
| `check-room` | Check if room is available |
| `join-queue` | Player wants to join 2P mode |
| `leave-queue` | Player leaves waiting room |
| `direction-change` | Player changed snake direction |
| `player-died` | Player hit wall |
| `food-eaten` | Player ate food |
| `rematch` | Request rematch |
| `disconnect` | Player disconnected |

---

## 🎨 Visual Design

### Player Colors
- **Player 1**: Blue (#4169e1) - Top-left start
- **Player 2**: Pink (#ff69b4) - Bottom-right start

### Snake Features (Both Players)
- Semicircle head in movement direction
- Two white eyes
- Body with stripe pattern (after 3 segments)
- Tapered tail (60% → 30%)

---

## 📡 WebSocket Events

### Client → Server

```javascript
// Check room availability
socket.emit('check-room');

// Join multiplayer queue
socket.emit('join-queue');

// Leave queue
socket.emit('leave-queue');

// Send direction change
socket.emit('direction-change', { dx: 1, dy: 0 });

// Player died
socket.emit('player-died');

// Food eaten
socket.emit('food-eaten', { x: 5, y: 10 });

// Request rematch
socket.emit('rematch-request');
```

### Server → Client

```javascript
// Room status update
socket.emit('room-status', { available: true/false });

// Waiting for opponent
socket.emit('waiting');

// Game starting
socket.emit('game-start', { 
  playerNumber: 1, 
  food: { x: 10, y: 10 },
  difficulty: 'normal'
});

// Opponent direction change
socket.emit('opponent-direction', { dx: -1, dy: 0 });

// Opponent died - you win!
socket.emit('opponent-died');

// New food position
socket.emit('food-update', { x: 15, y: 20 });

// Opponent wants rematch
socket.emit('rematch-requested');

// Opponent disconnected
socket.emit('opponent-disconnected');
```

---

## 🚀 Deployment

### Frontend (GitHub Pages)
1. Push to GitHub repository
2. Enable GitHub Pages in settings
3. URL: `https://username.github.io/snack-multi-player/`

### Backend (Railway.app)
1. Create account at railway.app
2. Connect GitHub repository
3. Deploy `server/` folder
4. Get server URL (e.g., `https://snack-server.railway.app`)
5. Update `SOCKET_URL` in `script.js`

---

## ⚙️ Configuration

### Environment Variables (Server)
```
PORT=3000                    # Server port (Railway sets this)
```

### Frontend Config (script.js)
```javascript
const SOCKET_URL = 'https://your-server.railway.app';
const WAIT_TIMEOUT = 300000; // 5 minutes in ms
```

---

## 🔧 Development Commands

### Run Server Locally
```bash
cd server
npm install
npm start
```

### Test Locally
1. Start server: `npm start` (runs on localhost:3000)
2. Open `index.html` in browser
3. Open another browser tab for Player 2

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Sound not working on mobile | Audio context must be initialized on user tap |
| WebSocket connection failed | Check SOCKET_URL is correct |
| Players out of sync | Both clients must use same game tick rate |
| Room stuck as "taken" | Server restart clears state |

---

## 📝 Future Improvements

- [ ] Spectator mode for waiting players
- [ ] Multiple game rooms
- [ ] Player names/avatars
- [ ] Leaderboard system
- [ ] Power-ups
- [ ] Different game modes

---

## 📄 License

MIT License - Feel free to modify and distribute.
