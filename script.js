// ============================================
// CONFIGURATION
// ============================================
// Server URL - Railway production
const SOCKET_URL = 'https://snack-multi-player-production.up.railway.app';

const WAIT_TIMEOUT = 300000; // 5 minutes in ms

// ============================================
// DOM ELEMENTS
// ============================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const soundBtn = document.getElementById('soundBtn');
const difficultyDisplay = document.getElementById('difficultyDisplay');
const swipeGuide = document.getElementById('swipeGuide');

// Menu elements
const mainMenu = document.getElementById('mainMenu');
const difficultyMenu = document.getElementById('difficultyMenu');
const waitingRoom = document.getElementById('waitingRoom');
const gameOverScreen = document.getElementById('gameOver');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverMessage = document.getElementById('gameOverMessage');
const multiplayerButtons = document.getElementById('multiplayerButtons');

// Buttons
const onePlayerBtn = document.getElementById('onePlayerBtn');
const twoPlayerBtn = document.getElementById('twoPlayerBtn');
const roomStatusText = document.getElementById('roomStatus');
const difficultyButtons = document.querySelectorAll('.difficulty-btn');
const backToMainFromDifficulty = document.getElementById('backToMainFromDifficulty');
const leaveQueueBtn = document.getElementById('leaveQueue');
const waitingTimer = document.getElementById('waitingTimer');
const rematchBtn = document.getElementById('rematchBtn');
const menuBtn = document.getElementById('menuBtn');

// ============================================
// CANVAS SETUP
// ============================================
function resizeCanvas() {
    const size = Math.min(window.innerWidth - 20, 800);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
}

canvas.width = 800;
canvas.height = 800;
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================
// GAME SETTINGS
// ============================================
const gridSize = 20;
const tileCount = canvas.width / gridSize;

// ============================================
// GAME STATE
// ============================================
let gameMode = 'single'; // 'single' or 'multi'
let playerNumber = 1; // 1 or 2 in multiplayer

// Player 1 Snake (Blue)
let snake1 = [{ x: 5, y: 5 }];
let dx1 = 0;
let dy1 = 0;

// Player 2 Snake (Pink)
let snake2 = [{ x: tileCount - 6, y: tileCount - 6 }];
let dx2 = 0;
let dy2 = 0;

let food = {};
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
let gameRunning = false;
let soundEnabled = true;
let hasStarted = false;
let difficulty = 'normal';
let gameInterval = null;

// Waiting room timer
let waitingStartTime = null;
let waitingTimerInterval = null;

// ============================================
// COLORS
// ============================================
const lightGreen = '#90ee90';
const darkGreen = '#7cc87c';
const player1Color = '#4169e1'; // Blue
const player2Color = '#ff69b4'; // Pink
const foodColor = '#ff0000';

// ============================================
// SOCKET CONNECTION
// ============================================
let socket = null;
let roomAvailable = true;

function connectSocket() {
    socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('check-room');
    });
    
    socket.on('room-status', (data) => {
        roomAvailable = data.available;
        updateRoomStatus();
    });
    
    socket.on('waiting', () => {
        showWaitingRoom();
    });
    
    socket.on('wait-timeout', () => {
        hideWaitingRoom();
        showMainMenu();
        alert('No opponent found. Please try again later.');
    });
    
    socket.on('game-start', (data) => {
        playerNumber = data.playerNumber;
        food = data.food;
        difficulty = data.difficulty;
        hideWaitingRoom();
        startMultiplayerGame();
    });
    
    socket.on('opponent-direction', (data) => {
        if (playerNumber === 1) {
            dx2 = data.dx;
            dy2 = data.dy;
        } else {
            dx1 = data.dx;
            dy1 = data.dy;
        }
    });
    
    socket.on('food-update', (data) => {
        food = data;
    });
    
    socket.on('opponent-died', (data) => {
        gameRunning = false;
        showGameOver(true, data.winner, data.scores);
    });
    
    socket.on('you-died', (data) => {
        gameRunning = false;
        showGameOver(false, data.winner, data.scores);
    });
    
    socket.on('rematch-requested', () => {
        rematchBtn.textContent = 'REMATCH!';
        rematchBtn.style.borderColor = '#ffff00';
        rematchBtn.style.color = '#ffff00';
    });
    
    socket.on('opponent-disconnected', () => {
        gameRunning = false;
        gameOverTitle.textContent = 'YOU WIN!';
        gameOverMessage.textContent = 'Opponent disconnected';
        showScreen(gameOverScreen);
        multiplayerButtons.classList.remove('hidden');
        rematchBtn.classList.add('hidden');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        roomAvailable = true;
        updateRoomStatus();
    });
}

function updateRoomStatus() {
    if (roomAvailable) {
        twoPlayerBtn.disabled = false;
        roomStatusText.textContent = '';
    } else {
        twoPlayerBtn.disabled = true;
        roomStatusText.textContent = 'Room is taken. Wait until the game is over.';
    }
}

// ============================================
// AUDIO
// ============================================
let audioContext;
let audioInitialized = false;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            audioInitialized = true;
        });
    } else {
        audioInitialized = true;
    }
}

function playEatSound() {
    if (!soundEnabled || !audioContext) return;
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.log('Audio error:', error);
    }
}

function playGameOverSound() {
    if (!soundEnabled || !audioContext) return;
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('Audio error:', error);
    }
}

function playMoveSound() {
    if (!soundEnabled || !audioContext) return;
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);
    } catch (error) {
        console.log('Audio error:', error);
    }
}

function playWinSound() {
    if (!soundEnabled || !audioContext) return;
    try {
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            }, i * 150);
        });
    } catch (error) {
        console.log('Audio error:', error);
    }
}

// ============================================
// SCREEN MANAGEMENT
// ============================================
function hideAllScreens() {
    mainMenu.classList.add('hidden');
    difficultyMenu.classList.add('hidden');
    waitingRoom.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
}

function showScreen(screen) {
    hideAllScreens();
    screen.classList.remove('hidden');
}

function showMainMenu() {
    showScreen(mainMenu);
    if (socket) {
        socket.emit('check-room');
    }
}

function showWaitingRoom() {
    showScreen(waitingRoom);
    waitingStartTime = Date.now();
    waitingTimerInterval = setInterval(updateWaitingTimer, 1000);
}

function hideWaitingRoom() {
    if (waitingTimerInterval) {
        clearInterval(waitingTimerInterval);
        waitingTimerInterval = null;
    }
}

function updateWaitingTimer() {
    const elapsed = Date.now() - waitingStartTime;
    const remaining = Math.max(0, WAIT_TIMEOUT - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    waitingTimer.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showGameOver(isWinner, winner, scores) {
    if (gameMode === 'multi') {
        // Determine if current player won based on scores
        const myScore = playerNumber === 1 ? scores.p1 : scores.p2;
        const opponentScore = playerNumber === 1 ? scores.p2 : scores.p1;
        
        let didWin = winner === playerNumber;
        
        if (didWin) {
            playWinSound();
            gameOverTitle.textContent = 'YOU WIN!';
        } else if (scores.p1 === scores.p2) {
            playGameOverSound();
            gameOverTitle.textContent = 'YOU LOSE';
        } else {
            playGameOverSound();
            gameOverTitle.textContent = 'YOU LOSE';
        }
        
        gameOverMessage.textContent = `Final Score - You: ${myScore} | Opponent: ${opponentScore}`;
        multiplayerButtons.classList.remove('hidden');
        rematchBtn.classList.remove('hidden');
        rematchBtn.textContent = 'REMATCH';
        rematchBtn.style.borderColor = '#00ff00';
        rematchBtn.style.color = '#00ff00';
    } else {
        playGameOverSound();
        gameOverTitle.textContent = 'GAME OVER';
        gameOverMessage.textContent = 'Press SPACE to return to menu';
        multiplayerButtons.classList.add('hidden');
    }
    
    showScreen(gameOverScreen);
    
    if (swipeGuide) {
        swipeGuide.style.display = 'none';
    }
}

// ============================================
// DRAWING FUNCTIONS
// ============================================

// Draw heart shape
function drawHeart(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const topX = x;
    const topY = y + size * 0.3;
    
    ctx.moveTo(topX, topY);
    // Left curve
    ctx.bezierCurveTo(
        topX - size * 0.5, topY - size * 0.5,
        topX - size * 0.5, topY + size * 0.3,
        topX, topY + size * 0.6
    );
    // Right curve
    ctx.moveTo(topX, topY);
    ctx.bezierCurveTo(
        topX + size * 0.5, topY - size * 0.5,
        topX + size * 0.5, topY + size * 0.3,
        topX, topY + size * 0.6
    );
    ctx.fill();
}

function drawGrid() {
    for (let row = 0; row < tileCount; row++) {
        for (let col = 0; col < tileCount; col++) {
            const x = col * gridSize;
            const y = row * gridSize;
            ctx.fillStyle = (row + col) % 2 === 0 ? lightGreen : darkGreen;
            ctx.fillRect(x, y, gridSize, gridSize);
        }
    }
}

function drawSnake(snake, color, dirX, dirY) {
    snake.forEach((segment, index) => {
        const x = segment.x * gridSize;
        const y = segment.y * gridSize;
        
        ctx.fillStyle = color;
        
        if (index === 0) {
            // Head
            const centerX = x + gridSize / 2;
            const centerY = y + gridSize / 2;
            const radius = gridSize / 2;

            ctx.fillRect(x, y, gridSize, gridSize);

            // Leading semicircle
            ctx.beginPath();
            if (dirX === 1) {
                ctx.arc(x + gridSize, centerY, radius, -Math.PI / 2, Math.PI / 2, false);
            } else if (dirX === -1) {
                ctx.arc(x, centerY, radius, Math.PI / 2, -Math.PI / 2, false);
            } else if (dirY === 1) {
                ctx.arc(centerX, y + gridSize, radius, 0, Math.PI, false);
            } else if (dirY === -1) {
                ctx.arc(centerX, y, radius, Math.PI, 0, false);
            } else {
                ctx.arc(x + gridSize, centerY, radius, -Math.PI / 2, Math.PI / 2, false);
            }
            ctx.fill();

            // Eyes
            ctx.fillStyle = 'white';
            const eyeSize = 3;
            const eyeOffset = 5;
            let eye1X, eye1Y, eye2X, eye2Y;

            if (dirX === 1) {
                eye1X = x + gridSize - 3; eye2X = x + gridSize - 3;
                eye1Y = centerY - eyeOffset; eye2Y = centerY + eyeOffset;
            } else if (dirX === -1) {
                eye1X = x + 3; eye2X = x + 3;
                eye1Y = centerY - eyeOffset; eye2Y = centerY + eyeOffset;
            } else if (dirY === 1) {
                eye1X = centerX - eyeOffset; eye2X = centerX + eyeOffset;
                eye1Y = y + gridSize - 3; eye2Y = y + gridSize - 3;
            } else if (dirY === -1) {
                eye1X = centerX - eyeOffset; eye2X = centerX + eyeOffset;
                eye1Y = y + 3; eye2Y = y + 3;
            } else {
                eye1X = x + gridSize - 3; eye2X = x + gridSize - 3;
                eye1Y = centerY - eyeOffset; eye2Y = centerY + eyeOffset;
            }

            ctx.beginPath();
            ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        } else if (index === snake.length - 1) {
            // Tail
            if (snake.length >= 3) {
                const tipWidth = gridSize * 0.3;
                const tipHeight = gridSize * 0.3;
                const tipOffsetX = (gridSize - tipWidth) / 2;
                const tipOffsetY = (gridSize - tipHeight) / 2;
                ctx.fillStyle = color;
                ctx.fillRect(x + tipOffsetX, y + tipOffsetY, tipWidth, tipHeight);
            } else {
                const tailWidth = gridSize * 0.6;
                const tailHeight = gridSize * 0.6;
                const tailOffsetX = (gridSize - tailWidth) / 2;
                const tailOffsetY = (gridSize - tailHeight) / 2;
                ctx.fillRect(x + tailOffsetX, y + tailOffsetY, tailWidth, tailHeight);
            }
        } else if (index === snake.length - 2 && snake.length >= 3) {
            // Second to last (60% tail)
            const tailWidth = gridSize * 0.6;
            const tailHeight = gridSize * 0.6;
            const tailOffsetX = (gridSize - tailWidth) / 2;
            const tailOffsetY = (gridSize - tailHeight) / 2;
            ctx.fillRect(x + tailOffsetX, y + tailOffsetY, tailWidth, tailHeight);
        } else {
            // Body
            ctx.fillRect(x, y, gridSize, gridSize);
            
            // Decorations on body segments
            const isBodySegment = snake.length >= 3 && index > 0 && index < snake.length - 2;
            if (isBodySegment) {
                const centerX = x + gridSize / 2;
                const centerY = y + gridSize / 2;
                
                // Pink snake (player 2) gets hearts, blue snake gets stripes
                if (color === player2Color) {
                    // Draw red heart for pink snake
                    drawHeart(ctx, centerX, centerY - 2, gridSize * 0.5, '#ff0000');
                } else {
                    // Draw white stripes for blue snake
                    let segmentDx = 0, segmentDy = 0;
                    if (index > 0) {
                        const prevSegment = snake[index - 1];
                        segmentDx = segment.x - prevSegment.x;
                        segmentDy = segment.y - prevSegment.y;
                    }
                    
                    const eyeOffset = 5;
                    const lineLength = gridSize;
                    const lineThickness = 2;
                    
                    ctx.fillStyle = 'white';
                    
                    if (segmentDx === 1 || segmentDx === -1) {
                        const lineX = x;
                        ctx.fillRect(lineX, centerY - eyeOffset - lineThickness / 2, lineLength, lineThickness);
                        ctx.fillRect(lineX, centerY + eyeOffset - lineThickness / 2, lineLength, lineThickness);
                    } else if (segmentDy === 1 || segmentDy === -1) {
                        const lineY = y;
                        ctx.fillRect(centerX - eyeOffset - lineThickness / 2, lineY, lineThickness, lineLength);
                        ctx.fillRect(centerX + eyeOffset - lineThickness / 2, lineY, lineThickness, lineLength);
                    }
                }
            }
        }
    });
}

function drawFood() {
    const x = food.x * gridSize;
    const y = food.y * gridSize;
    
    ctx.fillStyle = foodColor;
    ctx.beginPath();
    ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#228b22';
    ctx.fillRect(x + gridSize / 2 - 2, y + 2, 4, 6);
}

// ============================================
// GAME LOGIC
// ============================================
function generateFood() {
    food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
    };
    
    // Don't spawn on snakes
    const allSegments = [...snake1, ...snake2];
    for (let segment of allSegments) {
        if (segment.x === food.x && segment.y === food.y) {
            generateFood();
            return;
        }
    }
}

function moveSnake(snake, dx, dy, isPlayer) {
    if (dx === 0 && dy === 0) return true;
    
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    // Wall collision
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        return false;
    }
    
    // Self collision
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return false;
        }
    }
    
    snake.unshift(head);
    
    // Food collision
    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreElement.textContent = score;
        playEatSound();
        
        if (gameMode === 'single') {
            if (score > highScore) {
                highScore = score;
                highScoreElement.textContent = highScore;
                localStorage.setItem('snakeHighScore', highScore);
            }
            generateFood();
        } else {
            // In multiplayer, server generates new food
            socket.emit('food-eaten', { x: food.x, y: food.y });
        }
    } else {
        snake.pop();
    }
    
    return true;
}

function getGameSpeed() {
    switch(difficulty) {
        case 'easy': return 150 * 1.3;
        case 'hard': return 150 / 2;
        default: return 150;
    }
}

// ============================================
// GAME LOOP
// ============================================
function gameLoop() {
    if (!gameRunning) return;
    
    if (gameMode === 'single') {
        // Single player
        if (!moveSnake(snake1, dx1, dy1, true)) {
            gameRunning = false;
            showGameOver(false, 0, { p1: score, p2: 0 });
            return;
        }
    } else {
        // Multiplayer
        const mySnake = playerNumber === 1 ? snake1 : snake2;
        const myDx = playerNumber === 1 ? dx1 : dx2;
        const myDy = playerNumber === 1 ? dy1 : dy2;
        
        const opponentSnake = playerNumber === 1 ? snake2 : snake1;
        const opDx = playerNumber === 1 ? dx2 : dx1;
        const opDy = playerNumber === 1 ? dy2 : dy1;
        
        // Move my snake
        if (!moveSnake(mySnake, myDx, myDy, true)) {
            gameRunning = false;
            socket.emit('player-died');
            return;
        }
        
        // Move opponent snake (locally for display)
        moveSnake(opponentSnake, opDx, opDy, false);
    }
    
    // Draw
    drawGrid();
    drawFood();
    drawSnake(snake1, player1Color, dx1, dy1);
    
    if (gameMode === 'multi') {
        drawSnake(snake2, player2Color, dx2, dy2);
    }
}

// ============================================
// GAME START FUNCTIONS
// ============================================
function resetSinglePlayerGame() {
    snake1 = [{ x: 20, y: 20 }];
    dx1 = 0;
    dy1 = 0;
    score = 0;
    scoreElement.textContent = score;
    generateFood();
    gameRunning = true;
    hasStarted = false;
}

function startSinglePlayerGame(selectedDifficulty) {
    gameMode = 'single';
    difficulty = selectedDifficulty;
    difficultyDisplay.textContent = difficulty.toUpperCase();
    
    hideAllScreens();
    resetSinglePlayerGame();
    
    initAudio();
    
    if (swipeGuide && window.innerWidth <= 850) {
        swipeGuide.style.display = 'block';
    }
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, getGameSpeed());
}

function startMultiplayerGame() {
    gameMode = 'multi';
    difficultyDisplay.textContent = difficulty.toUpperCase() + ' (2P)';
    
    // Reset positions
    snake1 = [{ x: 5, y: 5 }];
    snake2 = [{ x: tileCount - 6, y: tileCount - 6 }];
    dx1 = 0; dy1 = 0;
    dx2 = 0; dy2 = 0;
    score = 0;
    scoreElement.textContent = score;
    
    hideAllScreens();
    gameRunning = true;
    hasStarted = false;
    
    initAudio();
    
    if (swipeGuide && window.innerWidth <= 850) {
        swipeGuide.style.display = 'block';
    }
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, getGameSpeed());
}

// ============================================
// EVENT LISTENERS
// ============================================

// Main menu buttons
onePlayerBtn.addEventListener('click', () => {
    initAudio();
    showScreen(difficultyMenu);
});

twoPlayerBtn.addEventListener('click', () => {
    if (!roomAvailable) return;
    initAudio();
    socket.emit('join-queue', { difficulty: 'normal' });
});

// Back buttons
backToMainFromDifficulty.addEventListener('click', () => {
    showMainMenu();
});

leaveQueueBtn.addEventListener('click', () => {
    socket.emit('leave-queue');
    hideWaitingRoom();
    showMainMenu();
});

// Difficulty buttons
difficultyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const selectedDifficulty = btn.getAttribute('data-difficulty');
        setTimeout(() => {
            startSinglePlayerGame(selectedDifficulty);
        }, 100);
    });
});

// Game over buttons
rematchBtn.addEventListener('click', () => {
    socket.emit('rematch-request');
    rematchBtn.textContent = 'WAITING...';
    rematchBtn.disabled = true;
    setTimeout(() => {
        rematchBtn.disabled = false;
    }, 1000);
});

menuBtn.addEventListener('click', () => {
    socket.emit('return-to-menu');
    showMainMenu();
});

// Sound toggle
soundBtn.addEventListener('click', () => {
    if (!audioContext) initAudio();
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameOverScreen.classList.contains('hidden') === false && gameMode === 'single') {
            showMainMenu();
        }
        return;
    }
    
    if (!gameRunning) return;
    
    // Arrow keys (Player 1 or single player)
    if (gameMode === 'single' || playerNumber === 1) {
        if (e.key === 'ArrowUp' && dy1 !== 1) {
            e.preventDefault();
            dx1 = 0; dy1 = -1;
            hasStarted = true;
            if (gameMode === 'multi') socket.emit('direction-change', { dx: 0, dy: -1 });
        } else if (e.key === 'ArrowDown' && dy1 !== -1) {
            e.preventDefault();
            dx1 = 0; dy1 = 1;
            hasStarted = true;
            if (gameMode === 'multi') socket.emit('direction-change', { dx: 0, dy: 1 });
        } else if (e.key === 'ArrowLeft' && dx1 !== 1) {
            e.preventDefault();
            dx1 = -1; dy1 = 0;
            hasStarted = true;
            if (gameMode === 'multi') socket.emit('direction-change', { dx: -1, dy: 0 });
        } else if (e.key === 'ArrowRight' && dx1 !== -1) {
            e.preventDefault();
            dx1 = 1; dy1 = 0;
            hasStarted = true;
            if (gameMode === 'multi') socket.emit('direction-change', { dx: 1, dy: 0 });
        }
    }
    
    // WASD controls for Player 2 in multiplayer
    if (gameMode === 'multi' && playerNumber === 2) {
        if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && dy2 !== 1) {
            e.preventDefault();
            dx2 = 0; dy2 = -1;
            hasStarted = true;
            socket.emit('direction-change', { dx: 0, dy: -1 });
        } else if ((e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') && dy2 !== -1) {
            e.preventDefault();
            dx2 = 0; dy2 = 1;
            hasStarted = true;
            socket.emit('direction-change', { dx: 0, dy: 1 });
        } else if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && dx2 !== 1) {
            e.preventDefault();
            dx2 = -1; dy2 = 0;
            hasStarted = true;
            socket.emit('direction-change', { dx: -1, dy: 0 });
        } else if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && dx2 !== -1) {
            e.preventDefault();
            dx2 = 1; dy2 = 0;
            hasStarted = true;
            socket.emit('direction-change', { dx: 1, dy: 0 });
        }
    }
});

// Touch/Swipe controls
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    
    if (!gameRunning) return;
    
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 30;
    
    let newDx = 0, newDy = 0;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) { newDx = 1; newDy = 0; }
            else { newDx = -1; newDy = 0; }
        }
    } else {
        if (Math.abs(deltaY) > minSwipeDistance) {
            if (deltaY > 0) { newDx = 0; newDy = 1; }
            else { newDx = 0; newDy = -1; }
        }
    }
    
    if (newDx !== 0 || newDy !== 0) {
        if (gameMode === 'single' || playerNumber === 1) {
            if ((newDx === 1 && dx1 !== -1) || (newDx === -1 && dx1 !== 1) ||
                (newDy === 1 && dy1 !== -1) || (newDy === -1 && dy1 !== 1)) {
                dx1 = newDx; dy1 = newDy;
                hasStarted = true;
                if (gameMode === 'multi') socket.emit('direction-change', { dx: newDx, dy: newDy });
            }
        } else if (playerNumber === 2) {
            if ((newDx === 1 && dx2 !== -1) || (newDx === -1 && dx2 !== 1) ||
                (newDy === 1 && dy2 !== -1) || (newDy === -1 && dy2 !== 1)) {
                dx2 = newDx; dy2 = newDy;
                hasStarted = true;
                socket.emit('direction-change', { dx: newDx, dy: newDy });
            }
        }
    }
}, { passive: false });

// Game over tap handler for mobile
gameOverScreen.addEventListener('click', () => {
    if (gameMode === 'single') {
        showMainMenu();
    }
});

// Prevent scrolling on touch devices
document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// ============================================
// INITIALIZATION
// ============================================
highScoreElement.textContent = highScore;

// Initial draw
drawGrid();
generateFood();
drawFood();
drawSnake(snake1, player1Color, dx1, dy1);

// Connect to server
connectSocket();

// Show main menu
showMainMenu();
