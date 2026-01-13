const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Game state
let gameRoom = {
    players: [],          // Array of socket IDs [player1, player2]
    isPlaying: false,     // Is a game currently in progress
    food: null,           // Current food position
    difficulty: 'normal', // Game difficulty
    scores: { p1: 0, p2: 0 },
    rematchRequests: []   // Players requesting rematch
};

// Waiting queue
let waitingPlayer = null;
let waitingTimeout = null;
const WAIT_TIMEOUT = 300000; // 5 minutes

// Grid settings (must match client)
const TILE_COUNT = 40;

// Generate random food position
function generateFood() {
    return {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT)
    };
}

// Reset game room
function resetGameRoom() {
    gameRoom = {
        players: [],
        isPlaying: false,
        food: null,
        difficulty: 'normal',
        scores: { p1: 0, p2: 0 },
        rematchRequests: []
    };
    // Notify all clients that room is available
    io.emit('room-status', { available: true });
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'Snake Multiplayer Server Running',
        roomAvailable: !gameRoom.isPlaying && gameRoom.players.length < 2,
        playersInRoom: gameRoom.players.length,
        isPlaying: gameRoom.isPlaying
    });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Send current room status to newly connected client
    socket.emit('room-status', { 
        available: !gameRoom.isPlaying && gameRoom.players.length < 2 
    });

    // Check room availability
    socket.on('check-room', () => {
        socket.emit('room-status', { 
            available: !gameRoom.isPlaying && gameRoom.players.length < 2 
        });
    });

    // Player wants to join 2-player mode
    socket.on('join-queue', (data) => {
        const difficulty = data?.difficulty || 'normal';
        
        // Room is full/playing
        if (gameRoom.isPlaying || gameRoom.players.length >= 2) {
            socket.emit('room-status', { available: false });
            return;
        }

        // First player joins
        if (gameRoom.players.length === 0) {
            gameRoom.players.push(socket.id);
            gameRoom.difficulty = difficulty;
            waitingPlayer = socket.id;
            
            socket.emit('waiting');
            io.emit('room-status', { available: false }); // Room now taken
            
            // Set timeout for waiting
            waitingTimeout = setTimeout(() => {
                if (waitingPlayer === socket.id && gameRoom.players.length === 1) {
                    socket.emit('wait-timeout');
                    gameRoom.players = [];
                    waitingPlayer = null;
                    io.emit('room-status', { available: true });
                }
            }, WAIT_TIMEOUT);
            
            console.log('Player 1 waiting:', socket.id);
        }
        // Second player joins - start game!
        else if (gameRoom.players.length === 1 && gameRoom.players[0] !== socket.id) {
            // Clear waiting timeout
            if (waitingTimeout) {
                clearTimeout(waitingTimeout);
                waitingTimeout = null;
            }
            
            gameRoom.players.push(socket.id);
            gameRoom.isPlaying = true;
            gameRoom.food = generateFood();
            gameRoom.scores = { p1: 0, p2: 0 };
            waitingPlayer = null;
            
            // Notify both players
            const player1Socket = io.sockets.sockets.get(gameRoom.players[0]);
            const player2Socket = io.sockets.sockets.get(gameRoom.players[1]);
            
            if (player1Socket) {
                player1Socket.emit('game-start', {
                    playerNumber: 1,
                    food: gameRoom.food,
                    difficulty: gameRoom.difficulty
                });
            }
            
            if (player2Socket) {
                player2Socket.emit('game-start', {
                    playerNumber: 2,
                    food: gameRoom.food,
                    difficulty: gameRoom.difficulty
                });
            }
            
            io.emit('room-status', { available: false });
            console.log('Game started! Players:', gameRoom.players);
        }
    });

    // Player leaves queue
    socket.on('leave-queue', () => {
        if (waitingPlayer === socket.id) {
            if (waitingTimeout) {
                clearTimeout(waitingTimeout);
                waitingTimeout = null;
            }
            gameRoom.players = gameRoom.players.filter(id => id !== socket.id);
            waitingPlayer = null;
            io.emit('room-status', { available: true });
            console.log('Player left queue:', socket.id);
        }
    });

    // Direction change during game
    socket.on('direction-change', (data) => {
        if (!gameRoom.isPlaying) return;
        
        const playerIndex = gameRoom.players.indexOf(socket.id);
        if (playerIndex === -1) return;
        
        // Send to opponent
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponentId = gameRoom.players[opponentIndex];
        const opponentSocket = io.sockets.sockets.get(opponentId);
        
        if (opponentSocket) {
            opponentSocket.emit('opponent-direction', {
                dx: data.dx,
                dy: data.dy
            });
        }
    });

    // Food eaten
    socket.on('food-eaten', (data) => {
        if (!gameRoom.isPlaying) return;
        
        const playerIndex = gameRoom.players.indexOf(socket.id);
        if (playerIndex === -1) return;
        
        // Update score
        if (playerIndex === 0) {
            gameRoom.scores.p1++;
        } else {
            gameRoom.scores.p2++;
        }
        
        // Generate new food
        gameRoom.food = generateFood();
        
        // Broadcast new food position to both players
        gameRoom.players.forEach(playerId => {
            const playerSocket = io.sockets.sockets.get(playerId);
            if (playerSocket) {
                playerSocket.emit('food-update', gameRoom.food);
            }
        });
    });

    // Player died
    socket.on('player-died', () => {
        if (!gameRoom.isPlaying) return;
        
        const playerIndex = gameRoom.players.indexOf(socket.id);
        if (playerIndex === -1) return;
        
        gameRoom.isPlaying = false;
        
        // Notify opponent they won
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponentId = gameRoom.players[opponentIndex];
        const opponentSocket = io.sockets.sockets.get(opponentId);
        
        if (opponentSocket) {
            opponentSocket.emit('opponent-died', {
                winner: opponentIndex + 1,
                scores: gameRoom.scores
            });
        }
        
        // Notify the player who died
        socket.emit('you-died', {
            winner: opponentIndex + 1,
            scores: gameRoom.scores
        });
        
        console.log('Player died:', socket.id, 'Winner: Player', opponentIndex + 1);
    });

    // Rematch request
    socket.on('rematch-request', () => {
        if (gameRoom.players.includes(socket.id)) {
            if (!gameRoom.rematchRequests.includes(socket.id)) {
                gameRoom.rematchRequests.push(socket.id);
            }
            
            // Both players want rematch
            if (gameRoom.rematchRequests.length === 2) {
                gameRoom.isPlaying = true;
                gameRoom.food = generateFood();
                gameRoom.scores = { p1: 0, p2: 0 };
                gameRoom.rematchRequests = [];
                
                // Notify both players
                gameRoom.players.forEach((playerId, index) => {
                    const playerSocket = io.sockets.sockets.get(playerId);
                    if (playerSocket) {
                        playerSocket.emit('game-start', {
                            playerNumber: index + 1,
                            food: gameRoom.food,
                            difficulty: gameRoom.difficulty
                        });
                    }
                });
                
                console.log('Rematch started!');
            } else {
                // Notify opponent about rematch request
                const opponentIndex = gameRoom.players.indexOf(socket.id) === 0 ? 1 : 0;
                const opponentId = gameRoom.players[opponentIndex];
                const opponentSocket = io.sockets.sockets.get(opponentId);
                
                if (opponentSocket) {
                    opponentSocket.emit('rematch-requested');
                }
            }
        }
    });

    // Return to menu (leave game)
    socket.on('return-to-menu', () => {
        handlePlayerLeave(socket);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        handlePlayerLeave(socket);
    });

    function handlePlayerLeave(socket) {
        // Clear waiting timeout if waiting player disconnects
        if (waitingPlayer === socket.id && waitingTimeout) {
            clearTimeout(waitingTimeout);
            waitingTimeout = null;
            waitingPlayer = null;
        }
        
        // Check if player was in game room
        const playerIndex = gameRoom.players.indexOf(socket.id);
        if (playerIndex !== -1) {
            // If game was in progress, notify opponent
            if (gameRoom.isPlaying || gameRoom.players.length === 2) {
                const opponentIndex = playerIndex === 0 ? 1 : 0;
                const opponentId = gameRoom.players[opponentIndex];
                const opponentSocket = io.sockets.sockets.get(opponentId);
                
                if (opponentSocket) {
                    opponentSocket.emit('opponent-disconnected');
                }
            }
            
            // Reset the game room
            resetGameRoom();
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Snake Multiplayer Server running on port ${PORT}`);
});
