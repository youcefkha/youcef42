/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- Game Setup ---
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const scoreEl = document.getElementById('score')!;
const gameOverEl = document.getElementById('game-over')!;
const restartButton = document.getElementById('restart-button')!;
const startMenuEl = document.getElementById('start-menu')!;
const startButton = document.getElementById('start-button')!;

let canvasWidth = window.innerWidth;
let canvasHeight = window.innerHeight;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

window.addEventListener('resize', () => {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
});


// --- Game Constants ---
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const PLAYER_SPEED = 7;
const PLATFORM_HEIGHT = 20;
const PLATFORM_MIN_WIDTH = 100;
const PLATFORM_MAX_WIDTH = 300;
const PLATFORM_MIN_GAP = 80; // Closer platforms
const PLATFORM_MAX_GAP = 250; // Closer platforms
const PLATFORM_MAX_Y_DIFF = 150;
const ENEMY_SPEED = 2;
const ENEMY_WIDTH = 30;
const ENEMY_HEIGHT = 30;
const JETPACK_FORCE = -0.8;
const MAX_JETPACK_FUEL = 120; // 2 seconds of continuous flight at 60fps
const JETPACK_REGEN_RATE = 1;


// --- Type Definitions ---
type Player = {
    x: number;
    y: number;
    width: number;
    height: number;
    velocityX: number;
    velocityY: number;
    isJumping: boolean;
    jetpackFuel: number;
};

type Platform = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type Enemy = {
    x: number;
    y: number;
    width: number;
    height: number;
    velocityX: number;
    platformX: number;
    platformWidth: number;
};

// --- Game State ---
let player: Player;
let platforms: Platform[];
let enemies: Enemy[];
let keys: { [key: string]: boolean };
let cameraX: number;
let score: number;
let gameOver: boolean;
let lastPlatformX: number;
let lastPlatformY: number;

// --- Game Logic ---
function init() {
    player = {
        x: 100,
        y: canvasHeight / 2,
        width: 40,
        height: 40,
        velocityX: 0,
        velocityY: 0,
        isJumping: true,
        jetpackFuel: MAX_JETPACK_FUEL,
    };

    platforms = [];
    enemies = [];
    keys = {};
    cameraX = 0;
    score = 0;
    gameOver = false;
    
    const startPlatform = {
        x: 50,
        y: canvasHeight - 100,
        width: 300,
        height: PLATFORM_HEIGHT,
    };
    platforms.push(startPlatform);
    lastPlatformX = startPlatform.x + startPlatform.width;
    lastPlatformY = startPlatform.y;
    
    generatePlatforms(canvasWidth * 2);

    scoreEl.textContent = 'النتيجة: 0';
    gameOverEl.classList.add('hidden');

    if (!restartButton.onclick) {
        // Keyboard controls
        document.addEventListener('keydown', (e) => (keys[e.key] = true));
        document.addEventListener('keyup', (e) => (keys[e.key] = false));
        
        // Restart button
        restartButton.onclick = () => {
             init();
             gameLoop();
        };

        // Mobile controls
        const leftButton = document.getElementById('left-button')!;
        const rightButton = document.getElementById('right-button')!;
        const jumpButton = document.getElementById('jump-button')!;

        const addTouchControls = (button: HTMLElement, key: string) => {
            const press = (e: Event) => {
                e.preventDefault();
                keys[key] = true;
            };
            const release = (e: Event) => {
                e.preventDefault();
                keys[key] = false;
            };

            button.addEventListener('touchstart', press, { passive: false });
            button.addEventListener('touchend', release, { passive: false });
            button.addEventListener('mousedown', press);
            button.addEventListener('mouseup', release);
            button.addEventListener('mouseleave', release);
        };

        addTouchControls(leftButton, 'ArrowLeft');
        addTouchControls(rightButton, 'ArrowRight');
        addTouchControls(jumpButton, ' '); // Use space for jump/jetpack
    }
}

function generatePlatforms(untilX: number) {
    while (lastPlatformX < untilX) {
        const width = Math.random() * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH) + PLATFORM_MIN_WIDTH;
        const gap = Math.random() * (PLATFORM_MAX_GAP - PLATFORM_MIN_GAP) + PLATFORM_MIN_GAP;
        const x = lastPlatformX + gap;
        
        let y = lastPlatformY + (Math.random() - 0.5) * 2 * PLATFORM_MAX_Y_DIFF;
        y = Math.max(150, Math.min(canvasHeight - 150, y));

        const newPlatform = { x, y, width, height: PLATFORM_HEIGHT };
        platforms.push(newPlatform);

        // Chance to spawn an enemy
        if (Math.random() < 0.25 && width > ENEMY_WIDTH * 2) { // 25% chance for an enemy
            enemies.push({
                x: x + width / 2 - ENEMY_WIDTH / 2,
                y: y - ENEMY_HEIGHT,
                width: ENEMY_WIDTH,
                height: ENEMY_HEIGHT,
                velocityX: ENEMY_SPEED,
                platformX: x,
                platformWidth: width,
            });
        }
        
        lastPlatformX = x + width;
        lastPlatformY = y;
    }
}


function update() {
    // --- Handle Input ---
    player.velocityX = 0;
    if (keys['ArrowLeft'] || keys['a']) {
        player.velocityX = -PLAYER_SPEED;
    }
    if (keys['ArrowRight'] || keys['d']) {
        player.velocityX = PLAYER_SPEED;
    }

    // --- Jumping and Gravity ---
    if ((keys[' '] || keys['ArrowUp'] || keys['w']) && !player.isJumping) {
        player.velocityY = JUMP_FORCE;
        player.isJumping = true;
    }
    
    // Apply gravity
    player.velocityY += GRAVITY;

    // --- Jetpack Logic ---
    if ((keys[' '] || keys['ArrowUp'] || keys['w']) && player.isJumping && player.jetpackFuel > 0) {
        player.velocityY += JETPACK_FORCE; // Apply upward thrust
        player.jetpackFuel -= 1;
    }

    // --- Update Player Position ---
    player.x += player.velocityX;
    player.y += player.velocityY;

    // --- Collision Detection ---
    // Platform collision
    let onPlatform = false;
    platforms.forEach(platform => {
        if (player.velocityY > 0 &&
            player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height > platform.y &&
            player.y + player.height < platform.y + platform.height + player.velocityY) {
            player.y = platform.y - player.height;
            player.velocityY = 0;
            player.isJumping = false;
            onPlatform = true;
        }
    });
    
    if (onPlatform) {
        // Regenerate fuel when on a platform
        player.jetpackFuel = Math.min(MAX_JETPACK_FUEL, player.jetpackFuel + JETPACK_REGEN_RATE);
    }

    // Enemy collision
    enemies.forEach(enemy => {
        if (player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            gameOver = true;
        }
    });

    // --- Update Enemies ---
    enemies.forEach(enemy => {
        enemy.x += enemy.velocityX;
        if (enemy.x <= enemy.platformX || enemy.x + enemy.width >= enemy.platformX + enemy.platformWidth) {
            enemy.velocityX *= -1;
        }
    });

    // --- Update Camera & Score ---
    cameraX = player.x - canvasWidth / 4;
    score = Math.floor(player.x / 10);
    scoreEl.textContent = `النتيجة: ${score}`;

    // --- Generate & Prune ---
    if (player.x + canvasWidth > lastPlatformX) {
        generatePlatforms(player.x + canvasWidth * 2);
    }
    platforms = platforms.filter(p => p.x + p.width > cameraX);
    enemies = enemies.filter(e => e.x + e.width > cameraX);

    // --- Check Game Over ---
    if (player.y > canvasHeight) {
        gameOver = true;
        gameOverEl.classList.remove('hidden');
    }
}

/**
 * Draws a rectangle with rounded corners.
 * @param {CanvasRenderingContext2D} ctx The canvas rendering context.
 * @param {number} x The top left x coordinate
 * @param {number} y The top left y coordinate
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @param {number} radius The corner radius.
 */
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}


function draw() {
    ctx.fillStyle = '#222831';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Draw Player
    const isUsingJetpack = (keys[' '] || keys['ArrowUp'] || keys['w']) && player.isJumping;
    ctx.fillStyle = isUsingJetpack ? '#FFD700' : '#00ADB5';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw Platforms
    ctx.fillStyle = '#EEEEEE';
    platforms.forEach(platform => {
        drawRoundRect(ctx, platform.x, platform.y, platform.width, platform.height, 5);
    });

    // Draw Enemies
    ctx.fillStyle = '#e63946';
    enemies.forEach(enemy => {
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    });

    ctx.restore();

    // --- Draw UI Elements (on top of everything) ---
    // Draw Jetpack Fuel Bar
    const fuelBarWidth = 150;
    const fuelBarHeight = 15;
    const fuelBarX = 20;
    const fuelBarY = 55; // Below the score
    
    // Background
    ctx.fillStyle = 'rgba(85, 85, 85, 0.8)';
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, fuelBarX - 2, fuelBarY - 2, fuelBarWidth + 4, fuelBarHeight + 4, 4);

    // Fuel
    const currentFuelWidth = (player.jetpackFuel / MAX_JETPACK_FUEL) * fuelBarWidth;
    ctx.fillStyle = '#FFD700';
    if (currentFuelWidth > 0) {
        drawRoundRect(ctx, fuelBarX, fuelBarY, currentFuelWidth, fuelBarHeight, 3);
    }
}

function gameLoop() {
    if (gameOver) {
        gameOverEl.classList.remove('hidden');
        return;
    }
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- Start Game ---
// Draw initial static background
ctx.fillStyle = '#222831';
ctx.fillRect(0, 0, canvasWidth, canvasHeight);

// Start the game when the button is clicked
startButton.onclick = () => {
    startMenuEl.classList.add('hidden');
    init();
    gameLoop();
};