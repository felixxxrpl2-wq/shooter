const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: true, antialias: false, willReadFrequently: false });
ctx.imageSmoothingEnabled = false;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let gameRunning = false;
let gamePaused = false;
let gameMode = 'classic';
let score = 0;
let lives = 5;
let maxLives = 10;
let wave = 1;
let gameTime = 0;
let enemiesKilled = 0;
let bossesKilled = 0;

let endlessDifficulty = 1;
let bossRushBossIndex = 0;
let nightmareIntensity = 1;
let animationFrameId = null;
let mobileFireInterval = null;
const isTouchDevice = (() => {
    try {
        return window.matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    } catch (e) {
        return 'ontouchstart' in window;
    }
})();

let player = {
    x: canvas.width / 2,
    y: canvas.height - 150,
    width: 150,
    height: 150,
    speed: 8,
    weaponLevel: 1,
    invincible: false,
    invincibleTimer: 0
};

function getPlayerHorizontalPadding() {
    return Math.max(28, Math.round(player.width * 0.35));
}

function clampPlayerX(x) {
    const padding = getPlayerHorizontalPadding();
    return Math.max(padding, Math.min(canvas.width - padding, x));
}

function applyResponsivePlayerSettings() {
    const shortEdge = Math.min(canvas.width, canvas.height);
    let scale = 1;
    if (isTouchDevice) {
        if (shortEdge <= 430) scale = 0.62;
        else if (shortEdge <= 560) scale = 0.72;
        else if (shortEdge <= 760) scale = 0.82;
        else scale = 0.9;
    }

    player.width = Math.round(150 * scale);
    player.height = Math.round(150 * scale);
    player.speed = isTouchDevice ? Math.max(6, 7.5 * scale + 1) : 8;

    const bottomOffset = isTouchDevice ? Math.max(95, player.height * 0.62) : 150;
    player.y = canvas.height - bottomOffset;
    player.x = clampPlayerX(player.x || canvas.width / 2);
}

const weaponLevels = {
    1: { name: 'BASIC GUN', bullets: 1, damage: 1, speed: 10, spread: 0, color: '#00a8ff' },
    2: { name: 'DUAL GUN', bullets: 2, damage: 1, speed: 12, spread: 12, color: '#00a8ff' },
    3: { name: 'TRIPLE GUN', bullets: 3, damage: 1, speed: 14, spread: 15, color: '#00a8ff' },
    4: { name: 'SPREAD GUN', bullets: 5, damage: 2, speed: 12, spread: 20, color: '#ffaa00' },
    5: { name: 'LASER CANNON', bullets: 3, damage: 3, speed: 30, spread: 8, color: '#ff5500' }
};

let bullets = [];
const MAX_BULLETS = 100;
let enemies = [];
const MAX_ENEMIES = 5;
let alienBullets = [];
const MAX_ALIEN_BULLETS = 50;
let items = [];
const MAX_ITEMS = 50;
let bloodParticles = [];
const MAX_BLOOD = 50;
let fxParticles = [];
const MAX_FX_PARTICLES = 180;
let boss = null;
let bossActive = false;

let inventory = { health: 0, shield: 0, rapid: 0, upgrade: 0 };
let rapidFireActive = false;
let rapidFireTimer = 0;
let shieldActive = false;
let shieldTimer = 0;
let keys = {};
let settings = { bloodEnabled: true, particlesEnabled: true };
let enemySpawnTimer = 0;
let lastShootTime = 0;
const SHOOT_COOLDOWN = 150;
const BULLET_TRAIL_POINTS = 6;
const ENEMY_BULLET_HOMING_STRENGTH = 0.2;
const ENEMY_BULLET_SPREAD = 0.05;

const playerImage = new Image();
playerImage.src = 'assets/images/player.png';
playerImage.onload = () => console.log('Player image loaded');
playerImage.onerror = () => console.warn('Player image failed, fallback enabled');

const enemyImages = {};
const enemyFiles = ['alien1.png', 'alien2.png', 'alien3.png', 'alien1.png', 'alien2.png'];
enemyFiles.forEach((file, index) => {
    const img = new Image();
    img.src = `assets/images/${file}`;
    img.onload = () => console.log(`Enemy image ${file} loaded`);
    img.onerror = () => console.warn(`Enemy image ${file} failed`);
    enemyImages[index] = img;
});

const bossImage = new Image();
bossImage.src = 'assets/images/boss.png';
bossImage.onload = () => console.log('Boss image loaded');
bossImage.onerror = () => console.warn('Boss image failed');

if (typeof Galaxy === 'undefined') {
    window.Galaxy = { init: function() {}, update: function() {}, draw: function() {} };
    console.warn('Galaxy module not loaded, using empty fallback');
}

const enemyTypes = [
    { size: 75, speed: 1.0, color: '#ff4444', pattern: 0, points: 10, health: 1, canShoot: true, bulletColor: '#ff4444', bulletSize: 8, bulletWidth: 4, bulletDamage: 1, bulletSpeed: 4, bulletCount: 2, bulletSpread: 0.1, bulletShape: 'bullet' },
    { size: 70, speed: 1.8, color: '#ff8844', pattern: 1, points: 15, health: 1, canShoot: true, bulletColor: '#ff8844', bulletSize: 10, bulletWidth: 3, bulletDamage: 1, bulletSpeed: 5, bulletCount: 3, bulletSpread: 0.2, bulletShape: 'bullet' },
    { size: 80, speed: 0.7, color: '#ff2222', pattern: 2, points: 25, health: 2, canShoot: true, bulletColor: '#ff8800', bulletSize: 12, bulletWidth: 5, bulletDamage: 2, bulletSpeed: 3, bulletCount: 1, bulletSpread: 0, bulletShape: 'missile' },
    { size: 90, speed: 0.6, color: '#8b0000', pattern: 3, points: 40, health: 2, canShoot: true, bulletColor: '#ff6666', bulletSize: 14, bulletWidth: 4, bulletDamage: 1, bulletSpeed: 4, bulletCount: 4, bulletSpread: 0.3, bulletShape: 'bullet' },
    { size: 100, speed: 0.9, color: '#ff00ff', pattern: 4, points: 50, health: 2, canShoot: true, bulletColor: '#ff00ff', bulletSize: 16, bulletWidth: 6, bulletDamage: 2, bulletSpeed: 5, bulletCount: 5, bulletSpread: 0.4, bulletShape: 'missile' }
];

const bossTypes = [
    { name: 'XENOMORPH QUEEN', size: 250, health: 200, maxHealth: 200, speed: 1, color: '#8b0000', pattern: 0, points: 500 },
    { name: 'SPACE DRAGON', size: 280, health: 300, maxHealth: 300, speed: 0.8, color: '#ff4500', pattern: 1, points: 800 },
    { name: 'DEATH BRINGER', size: 320, health: 500, maxHealth: 500, speed: 0.5, color: '#4b0082', pattern: 2, points: 1200 }
];

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ') {
        e.preventDefault();
        if (gameRunning && !gamePaused) shoot();
    }
    if (e.key === '1') { e.preventDefault(); if (gameRunning && !gamePaused) useItem('health'); }
    if (e.key === '2') { e.preventDefault(); if (gameRunning && !gamePaused) useItem('shield'); }
    if (e.key === '3') { e.preventDefault(); if (gameRunning && !gamePaused) useItem('rapid'); }
    if (e.key === '4') { e.preventDefault(); if (gameRunning && !gamePaused) useItem('upgrade'); }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); useFirstAvailableItem(); }
    if (e.key === 'Escape') { togglePause(); }
});

document.addEventListener('keyup', (e) => { keys[e.key] = false; });

function handleCanvasTouchMove(e) {
    if (!isTouchDevice) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const rect = canvas.getBoundingClientRect();
    player.x = clampPlayerX(touch.clientX - rect.left);
}

function handleCanvasTouchStart(e) {
    if (!isTouchDevice) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
        const rect = canvas.getBoundingClientRect();
        player.x = clampPlayerX(touch.clientX - rect.left);
    }
    if (gameRunning && !gamePaused) shoot();
}

canvas.addEventListener('touchmove', handleCanvasTouchMove, { passive: false });
canvas.addEventListener('touchstart', handleCanvasTouchStart, { passive: false });

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    Galaxy.init(canvas.width, canvas.height);
    resetGame();
    gameRunning = true;
    if (window.SoundManager) {
        if (typeof SoundManager.initialize === 'function') SoundManager.initialize();
        if (typeof SoundManager.unlock === 'function') SoundManager.unlock();
        if (typeof SoundManager.flushPending === 'function') SoundManager.flushPending();
        if (typeof SoundManager.setVolume === 'function') SoundManager.setVolume('backsound', 0.4);
        SoundManager.play('gameStart');
        SoundManager.playMusic('backsound');
    }
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameLoop();
}

function resetGame() {
    player.x = canvas.width / 2;
    applyResponsivePlayerSettings();
    player.weaponLevel = 1;
    player.invincible = false;
    player.invincibleTimer = 0;
    bullets = [];
    enemies = [];
    items = [];
    bloodParticles = [];
    fxParticles = [];
    alienBullets = [];
    boss = null;
    bossActive = false;
    score = 0;
    wave = 1;
    gameTime = 0;
    enemiesKilled = 0;
    bossesKilled = 0;
    endlessDifficulty = 1;
    bossRushBossIndex = 0;
    nightmareIntensity = 1;
    gameMode = localStorage.getItem('selectedMode') || 'classic';
    switch(gameMode) {
        case 'nightmare': lives = 1; break;
        case 'bossrush': lives = 5; break;
        default: lives = 3;
    }
    inventory = { health: 0, shield: 0, rapid: 0, upgrade: 0 };
    rapidFireActive = false;
    shieldActive = false;
    rapidFireTimer = 0;
    shieldTimer = 0;
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
    stopMobileFire();
    enemySpawnTimer = 0;
    lastShootTime = 0;
    const elements = {
        bossWarning: document.getElementById('bossWarning'),
        bossHealthContainer: document.getElementById('bossHealthContainer'),
        shieldIndicator: document.getElementById('shieldIndicator'),
        rapidIndicator: document.getElementById('rapidIndicator')
    };
    Object.values(elements).forEach(el => { if (el) el.style.display = 'none'; });
    const modeName = document.getElementById('modeName');
    const selectedModeDisplay = document.getElementById('selectedModeDisplay');
    if (modeName) modeName.textContent = gameMode.toUpperCase();
    if (selectedModeDisplay) selectedModeDisplay.textContent = gameMode.toUpperCase();
    updateHUD();
    updateInventory();
    updateWeaponDisplay();
}

function restartGame() {
    gameRunning = false;
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    const overlays = ['gameOverScreen', 'pauseScreen', 'menuConfirmDialog'];
    overlays.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    resetGame();
    if (window.SoundManager) SoundManager.play('buttonClick');
    setTimeout(() => { gameRunning = true; gameLoop(); }, 50);
}

function gameLoop() {
    if (!gameRunning) { animationFrameId = null; return; }
    try {
        if (!gamePaused) { gameTime++; update(); draw(); }
    } catch (e) { console.error('Game error:', e); restartGame(); return; }
    animationFrameId = requestAnimationFrame(gameLoop);
}

function createEnemyBulletVelocity(originX, originY, baseAngle, speed) {
    const spread = (Math.random() * 2 - 1) * ENEMY_BULLET_SPREAD;
    const forwardX = Math.sin(baseAngle + spread);
    const forwardY = Math.cos(baseAngle + spread);

    const toPlayerX = player.x - originX;
    const toPlayerY = player.y - originY;
    const toPlayerLength = Math.hypot(toPlayerX, toPlayerY) || 1;
    const playerDirX = toPlayerX / toPlayerLength;
    const playerDirY = toPlayerY / toPlayerLength;

    let directionX = (forwardX * (1 - ENEMY_BULLET_HOMING_STRENGTH)) + (playerDirX * ENEMY_BULLET_HOMING_STRENGTH);
    let directionY = (forwardY * (1 - ENEMY_BULLET_HOMING_STRENGTH)) + (playerDirY * ENEMY_BULLET_HOMING_STRENGTH);
    const directionLength = Math.hypot(directionX, directionY) || 1;
    directionX /= directionLength;
    directionY /= directionLength;

    return {
        vx: directionX * speed,
        vy: directionY * speed
    };
}

function alienShoot(alien) {
    if (!gameRunning || gamePaused) return;
    if (!alien || alien.isProjectile) return;
    if (gameMode === 'bossrush') return;

    const type = enemyTypes[alien.type] || enemyTypes[0];
    if (!type.canShoot) return;

    const bulletCount = type.bulletCount || 1;
    if (alienBullets.length + bulletCount > MAX_ALIEN_BULLETS) return;

    const speed = type.bulletSpeed + (wave * 0.1);
    const baseAngle = 0;

    for (let i = 0; i < bulletCount; i++) {
        let angle = baseAngle;
        if (type.bulletSpread > 0 && bulletCount > 1) {
            const offset = (i - (bulletCount - 1) / 2) * type.bulletSpread;
            angle = baseAngle + offset;
        }

        const velocity = createEnemyBulletVelocity(alien.x, alien.y, angle, speed);

        alienBullets.push({
            x: alien.x,
            y: alien.y,
            vx: velocity.vx,
            vy: velocity.vy,
            width: type.bulletWidth || 4,
            height: type.bulletSize || 8,
            damage: type.bulletDamage,
            color: type.bulletColor,
            shape: type.bulletShape || 'bullet',
            fromAlien: true,
            createdAt: Date.now(),
            trail: []
        });
    }

    if (window.SoundManager) SoundManager.play('shoot');
}

function updateAlienBullets() {
    for (let i = alienBullets.length - 1; i >= 0; i--) {
        const bullet = alienBullets[i];
        updateBulletTrail(bullet);
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        emitBulletFireTrail(bullet, true);

        if (Date.now() - bullet.createdAt > 5000) { alienBullets.splice(i, 1); continue; }
        if (bullet.x < -50 || bullet.x > canvas.width + 50 || bullet.y < -50 || bullet.y > canvas.height + 50) {
            alienBullets.splice(i, 1); continue;
        }

        const dx = player.x - bullet.x;
        const dy = player.y - bullet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const threshold = Math.max(bullet.width, bullet.height) * 0.8;

        if (distance < threshold + 20) {
            if (!player.invincible && !shieldActive) {
                takeDamage(bullet.damage || 1);
                createBloodEffect(player.x, player.y, 10);
                showFloatingText(`-${bullet.damage || 1}`, '#ff4444');
                alienBullets.splice(i, 1);
            } else {
                alienBullets.splice(i, 1);
                createSparkEffect(bullet.x, bullet.y);
            }
        }
    }
}

function createSparkEffect(x, y) {
    for (let i = 0; i < 5; i++) {
        bloodParticles.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, size: Math.random() * 3 + 1, color: '#ffff00', life: 10 });
    }
}

function addFxParticle(x, y, vx, vy, size, color, life) {
    if (!settings.particlesEnabled) return;
    if (fxParticles.length >= MAX_FX_PARTICLES) {
        fxParticles.shift();
    }
    fxParticles.push({
        x,
        y,
        vx,
        vy,
        size,
        color,
        life,
        maxLife: life
    });
}

function updateFxParticles() {
    for (let i = fxParticles.length - 1; i >= 0; i--) {
        const p = fxParticles[i];
        if (!p) {
            fxParticles.splice(i, 1);
            continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.size *= 0.96;
        p.life--;
        if (p.life <= 0 || p.size < 0.2) fxParticles.splice(i, 1);
    }
}

function updateBulletTrail(bullet) {
    bullet.trail = bullet.trail || [];
    bullet.trail.push({ x: bullet.x, y: bullet.y });
    const speed = bullet.speed || Math.hypot(bullet.vx || 0, bullet.vy || 0);
    const targetLength = Math.max(3, Math.min(16, Math.floor((speed || BULLET_TRAIL_POINTS) * 0.5)));
    if (bullet.trail.length > targetLength) bullet.trail.shift();
}

function emitBulletFireTrail(bullet, isEnemy) {
    if (!settings.particlesEnabled || !bullet) return;
    if (Math.random() > 0.3) return;
    const color = isEnemy ? '#ff7a33' : '#ffb347';
    addFxParticle(
        bullet.x + (Math.random() - 0.5) * 2,
        bullet.y + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2 + (isEnemy ? -0.3 : 0.3),
        Math.random() * 1.4 + 1.1,
        color,
        8 + Math.random() * 5
    );
}

function drawTracerBullet(bullet, isEnemy) {
    if (!bullet) return;
    const coreColor = isEnemy ? '#ffd9c2' : '#cfffff';
    const glowColor = isEnemy ? '#ff5b2f' : '#00d9ff';
    const heatColor = isEnemy ? 'rgba(255, 120, 60, 0.25)' : 'rgba(0, 195, 255, 0.2)';
    const trailWidth = Math.max(2, (bullet.width || 4) * 0.6);

    ctx.save();

    if (bullet.trail && bullet.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
        for (let i = 1; i < bullet.trail.length; i++) {
            ctx.lineTo(bullet.trail[i].x, bullet.trail[i].y);
        }
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = trailWidth;
        ctx.globalAlpha = 0.65;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = heatColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, Math.max(4, (bullet.width || 4)), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = coreColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, Math.max(1.8, (bullet.width || 4) * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawEngineFlame(x, y, scale, seed = 0, direction = 'down') {
    const flicker = 1 + Math.sin((gameTime * 0.35) + seed) * 0.2 + (Math.random() - 0.5) * 0.1;
    const length = (22 * scale) * flicker;
    const width = 6 * scale;
    const dir = direction === 'up' ? -1 : 1;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const outer = ctx.createLinearGradient(x, y, x, y + (dir * length));
    outer.addColorStop(0, 'rgba(120, 225, 255, 0.95)');
    outer.addColorStop(0.45, 'rgba(255, 190, 90, 0.85)');
    outer.addColorStop(1, 'rgba(255, 80, 20, 0)');

    ctx.fillStyle = outer;
    ctx.shadowColor = 'rgba(120, 225, 255, 0.85)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x - width, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x, y + (dir * length));
    ctx.closePath();
    ctx.fill();

    const inner = ctx.createLinearGradient(x, y, x, y + (dir * length * 0.8));
    inner.addColorStop(0, 'rgba(210, 255, 255, 1)');
    inner.addColorStop(0.5, 'rgba(90, 220, 255, 0.95)');
    inner.addColorStop(1, 'rgba(255, 140, 60, 0.2)');

    ctx.fillStyle = inner;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.45, y);
    ctx.lineTo(x + width * 0.45, y);
    ctx.lineTo(x, y + (dir * length * 0.75));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function spawnRandomItem() {
    if (items.length >= MAX_ITEMS) return;
    let spawnRate = 300, itemCount = 1;
    switch(gameMode) {
        case 'endless': spawnRate = 200; itemCount = Math.random() < 0.3 ? 2 : 1; break;
        case 'nightmare': spawnRate = 600; itemCount = 1; break;
        case 'bossrush': return;
    }
    if (gameTime % spawnRate !== 0) return;
    for (let n = 0; n < itemCount; n++) {
        if (items.length >= MAX_ITEMS) return;
        const x = Math.random() * (canvas.width - 100) + 50;
        const y = Math.random() * 200 + 50;
        const types = [
            { type: 'health', icon: 'HP', color: '#ff69b4' },
            { type: 'shield', icon: 'SH', color: '#00a8ff' },
            { type: 'rapid', icon: 'RF', color: '#ffd700' },
            { type: 'upgrade', icon: 'UP', color: '#ffaa00' }
        ];
        let probs = [0.4, 0.25, 0.2, 0.15];
        if (gameMode === 'endless') probs = [0.3, 0.3, 0.25, 0.15];
        else if (gameMode === 'nightmare') probs = [0.2, 0.2, 0.3, 0.3];
        const random = Math.random();
        let selectedType;
        if (random < probs[0]) selectedType = types[0];
        else if (random < probs[0] + probs[1]) selectedType = types[1];
        else if (random < probs[0] + probs[1] + probs[2]) selectedType = types[2];
        else selectedType = types[3];
        items.push({ ...selectedType, x: x + (n * 30), y, bobOffset: Math.random() * Math.PI * 2 });
    }
}

function modeSpecificUpdate() {
    switch(gameMode) {
        case 'endless':
            endlessDifficulty = 1 + (gameTime / 3000);
            if (!bossActive && gameTime % 600 === 0 && Math.random() < 0.3) spawnBoss(Math.floor(Math.random() * bossTypes.length));
            break;
        case 'nightmare':
            nightmareIntensity = 1 + (wave * 0.2);
            break;
        case 'bossrush':
            if (!bossActive && bossesKilled < 3) spawnBoss(bossesKilled);
            break;
    }
}

function update() {
    if (keys['a'] || keys['A'] || keys['ArrowLeft']) player.x = clampPlayerX(player.x - player.speed);
    if (keys['d'] || keys['D'] || keys['ArrowRight']) player.x = clampPlayerX(player.x + player.speed);

    if (player.invincible) {
        player.invincibleTimer--;
        if (player.invincibleTimer <= 0) player.invincible = false;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!bullets[i]) { bullets.splice(i, 1); continue; }
        updateBulletTrail(bullets[i]);
        bullets[i].y -= bullets[i].speed;
        emitBulletFireTrail(bullets[i], false);
        if (bullets[i].y < 0 || bullets[i].x < -10 || bullets[i].x > canvas.width + 10) bullets.splice(i, 1);
    }

    updateAlienBullets();
    modeSpecificUpdate();

    if (bossActive && boss) {
        updateBoss();
    } else if (gameMode !== 'bossrush') {
        enemySpawnTimer++;
        let baseSpawnRate = 40;
        if (gameMode === 'nightmare') baseSpawnRate = 30;
        if (gameMode === 'endless') baseSpawnRate = 35 - Math.floor(endlessDifficulty);
        let spawnRate = Math.max(20, baseSpawnRate - wave);
        if (enemySpawnTimer > spawnRate && enemies.length < MAX_ENEMIES) { spawnEnemy(); enemySpawnTimer = 0; }

        if (gameMode === 'classic' && wave % 5 === 0 && enemies.length === 0 && !bossActive) spawnBoss(0);
        if (gameMode === 'nightmare' && wave % 3 === 0 && enemies.length < 5 && !bossActive) {
            if (Math.random() < 0.3) spawnBoss(Math.floor(Math.random() * bossTypes.length));
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy) { enemies.splice(i, 1); continue; }

        let speedMultiplier = 1;
        if (gameMode === 'nightmare') speedMultiplier = nightmareIntensity;
        if (gameMode === 'endless') speedMultiplier = endlessDifficulty;
        speedMultiplier *= 0.8;

        switch(enemy.pattern) {
            case 1: enemy.y += enemy.speed * 1.5 * speedMultiplier; break;
            case 2: enemy.y += enemy.speed * 0.8 * speedMultiplier; break;
            case 3: enemy.y += enemy.speed * speedMultiplier; enemy.x += Math.sin(gameTime * 0.03) * 2; break;
            case 4: enemy.y += enemy.speed * speedMultiplier; enemy.x += Math.cos(gameTime * 0.02 + (enemy.index || 0)) * 3; break;
            case 5: enemy.x += enemy.vx; enemy.y += enemy.vy; break;
            default: enemy.y += enemy.speed * speedMultiplier;
        }
        enemy.x = Math.max(30, Math.min(canvas.width - 30, enemy.x));

        const STOP_DISTANCE = 200;
        if (enemy.y > player.y - STOP_DISTANCE) {
            enemy.y = player.y - STOP_DISTANCE;
        }

        let shootFrame = gameMode === 'nightmare' ? 8 : 12;
        if (gameTime % shootFrame === 0 && !enemy.isProjectile) {
            alienShoot(enemy);
        }

        if (enemy.y > canvas.height + 100) { enemies.splice(i, 1); continue; }

        if (!player.invincible && !shieldActive && checkCollision(player, enemy, 30)) {
            if (enemy.isProjectile) {
                takeDamage(enemy.damage || 1);
                showFloatingText(`-${enemy.damage || 1}`, '#ff0000');
                createBloodEffect(enemy.x, enemy.y, 8);
            } else {
                takeDamage(1);
                createBloodEffect(enemy.x, enemy.y, 10);
            }
            enemies.splice(i, 1);
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!bullets[i]) { bullets.splice(i, 1); continue; }
        let bulletUsed = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (!enemy) continue;
            if (checkCollision(bullets[i], enemy, 30)) {
                enemy.health = (enemy.health || 1) - (bullets[i].damage || 1);
                if (enemy.health <= 0) {
                    let scoreMultiplier = 1;
                    if (gameMode === 'nightmare') scoreMultiplier = 2;
                    if (gameMode === 'bossrush') scoreMultiplier = 3;
                    score += enemy.points * scoreMultiplier;
                    enemiesKilled++;
                    
                    createExplosionEffect(enemy.x, enemy.y);
                    if (window.SoundManager) SoundManager.play('explosion');
                    
                    let dropRate = 0.05;
                    if (gameMode === 'endless') dropRate = 0.1;
                    if (gameMode === 'nightmare') dropRate = 0.02;
                    if (Math.random() < dropRate && items.length < MAX_ITEMS) spawnItem(enemy.x, enemy.y);
                    enemies.splice(j, 1);
                } else {
                    if (window.SoundManager) SoundManager.play('enemyHit');
                }
                bullets.splice(i, 1);
                bulletUsed = true;
                updateHUD();
                break;
            }
        }
        if (bulletUsed) continue;
        if (bossActive && boss && checkCollision(bullets[i], boss, boss.size/2)) {
            boss.health -= (bullets[i].damage || 1);
            bullets.splice(i, 1);
            if (settings.bloodEnabled) createBloodEffect(boss.x + (Math.random() - 0.5) * 50, boss.y + (Math.random() - 0.5) * 50, 5);
            if (boss.health > 0) {
                const healthPercent = (boss.health / boss.maxHealth) * 100;
                const bossHealthFill = document.getElementById('bossHealthFill');
                if (bossHealthFill) bossHealthFill.style.width = Math.max(0, healthPercent) + '%';
            }
            if (boss.health <= 0) defeatBoss();
        }
    }

    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item) { items.splice(i, 1); continue; }
        item.y += 3;
        if (item.bobOffset) item.x += Math.sin(gameTime * 0.05 + item.bobOffset) * 0.5;
        if (checkCollision(player, item, 35)) { collectItem(item.type); items.splice(i, 1); continue; }
        if (item.y > canvas.height + 100) items.splice(i, 1);
    }

    for (let i = bloodParticles.length - 1; i >= 0; i--) {
        const blood = bloodParticles[i];
        if (!blood) { bloodParticles.splice(i, 1); continue; }
        blood.x += blood.vx;
        blood.y += blood.vy;
        blood.life--;
        if (blood.life <= 0) bloodParticles.splice(i, 1);
    }
    updateFxParticles();

    if (rapidFireActive) {
        rapidFireTimer--;
        if (rapidFireTimer <= 0) {
            rapidFireActive = false;
            const rapidIndicator = document.getElementById('rapidIndicator');
            if (rapidIndicator) rapidIndicator.style.display = 'none';
        }
    }
    if (shieldActive) {
        shieldTimer--;
        if (shieldTimer <= 0) {
            shieldActive = false;
            const shieldIndicator = document.getElementById('shieldIndicator');
            if (shieldIndicator) shieldIndicator.style.display = 'none';
        }
    }

    spawnRandomItem();

    if (!bossActive && gameMode !== 'bossrush' && gameTime % 300 === 0) {
        if (gameMode === 'endless') wave++;
        else if (gameMode === 'classic' && wave % 5 !== 0) wave++;
        else if (gameMode === 'nightmare') wave++;
        updateHUD();
    }

    Galaxy.update(canvas.height);
}

function createExplosionEffect(x, y) {
    for (let i = 0; i < 20; i++) {
        bloodParticles.push({
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            size: Math.random() * 6 + 3,
            color: `hsl(${20 + Math.random() * 30}, 100%, 60%)`,
            life: 30 + Math.random() * 20
        });
    }
    for (let i = 0; i < 10; i++) {
        bloodParticles.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 1,
            size: Math.random() * 4 + 2,
            color: '#ffff00',
            life: 20 + Math.random() * 15
        });
    }
}

function updateBoss() {
    if (!boss) return;
    let speedMultiplier = 1;
    if (gameMode === 'nightmare') speedMultiplier = 1.5;
    if (gameMode === 'bossrush') speedMultiplier = 1.2;
    switch(boss.pattern) {
        case 0: boss.x += Math.sin(gameTime * 0.02) * 3 * speedMultiplier; break;
        case 1: boss.x += Math.cos(gameTime * 0.03) * 4 * speedMultiplier; boss.y += Math.sin(gameTime * 0.02) * 2 * speedMultiplier; break;
        case 2: boss.x += Math.sin(gameTime * 0.01) * 5 * speedMultiplier; boss.y += Math.cos(gameTime * 0.02) * 2 * speedMultiplier; break;
    }
    boss.x = Math.max(boss.size, Math.min(canvas.width - boss.size, boss.x));
    boss.y = Math.max(100, Math.min(300, boss.y));
    let attackRate = 60;
    if (gameMode === 'nightmare') attackRate = 45;
    if (gameMode === 'bossrush') attackRate = 50;
    if (gameTime % attackRate === 0) bossAttack();
    if (!player.invincible && !shieldActive && checkCollision(player, boss, boss.size/2)) {
        takeDamage(2);
        createBloodEffect(player.x, player.y, 20);
    }
}

function bossAttack() {
    if (!boss) return;
    if (window.SoundManager) SoundManager.play('bossAttack');
    const attackVariant = Math.floor(Math.random() * 10);
    let damageMultiplier = 1, speedMultiplier = 1, countMultiplier = 1;
    if (gameMode === 'nightmare') { damageMultiplier = 2; speedMultiplier = 1.3; countMultiplier = 1.5; }
    if (gameMode === 'bossrush') { damageMultiplier = 1.5; speedMultiplier = 1.2; countMultiplier = 1.3; }
    for (let i = 0; i < 5 * countMultiplier; i++) {
        setTimeout(() => {
            if (!boss) return;
            for (let j = 0; j < 3; j++) {
                const angle = (j / 3) * Math.PI * 2 + Math.random() * 0.5;
                const velocity = createEnemyBulletVelocity(boss.x, boss.y, angle, 3 * speedMultiplier);
                alienBullets.push({
                    x: boss.x,
                    y: boss.y,
                    vx: velocity.vx,
                    vy: velocity.vy,
                    width: 8,
                    height: 12,
                    damage: 1 * damageMultiplier,
                    color: '#ff0000',
                    shape: 'missile',
                    fromAlien: true,
                    createdAt: Date.now(),
                    trail: []
                });
            }
        }, i * 200);
    }
}

function defeatBoss() {
    bossesKilled++;
    let scoreMultiplier = 1;
    if (gameMode === 'nightmare') scoreMultiplier = 3;
    if (gameMode === 'bossrush') scoreMultiplier = 2;
    score += boss.points * scoreMultiplier;
    bossActive = false;
    boss = null;
    if (window.SoundManager) SoundManager.play('bossDie');
    let itemCount = 3;
    if (gameMode === 'endless') itemCount = 5;
    if (gameMode === 'bossrush') itemCount = 7;
    if (gameMode === 'nightmare') itemCount = 1;
    for (let i = 0; i < itemCount; i++) spawnItem(player.x + (Math.random() - 0.5) * 200, player.y - 100);
    if (settings.bloodEnabled && bloodParticles.length < MAX_BLOOD * 0.8) {
        const maxParticles = gameMode === 'nightmare' ? 10 : 20;
        for (let i = 0; i < maxParticles; i++) createBloodEffect(player.x + (Math.random() - 0.5) * 200, player.y - 50, 2);
    }
    const bossHealthContainer = document.getElementById('bossHealthContainer');
    const bossWarning = document.getElementById('bossWarning');
    if (bossHealthContainer) bossHealthContainer.style.display = 'none';
    if (bossWarning) bossWarning.style.display = 'none';
    if (gameMode === 'bossrush' && bossesKilled >= 3) gameOver(true);
    else { wave++; updateHUD(); }
}

function draw() {
    Galaxy.draw(ctx, canvas.width, canvas.height, gameTime);

    if (settings.bloodEnabled && bloodParticles.length > 0) {
        for (let blood of bloodParticles) {
            if (!blood) continue;
            ctx.globalAlpha = blood.life / 20;
            ctx.fillStyle = blood.color;
            ctx.beginPath();
            ctx.arc(blood.x, blood.y, blood.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    if (settings.particlesEnabled && fxParticles.length > 0) {
        for (let i = 0; i < fxParticles.length; i++) {
            const p = fxParticles[i];
            if (!p) continue;
            ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 1));
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = p.size > 1.2 ? 8 : 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    if (!player.invincible || Math.floor(gameTime / 5) % 2 === 0) drawPlayer();

    for (let bullet of bullets) {
        if (!bullet) continue;
        drawTracerBullet(bullet, false);
    }

    for (let bullet of alienBullets) {
        if (!bullet) continue;
        drawTracerBullet(bullet, true);
    }

    for (let enemy of enemies) {
        if (!enemy) continue;
        if (enemy.isProjectile) {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            ctx.fill();
            continue;
        }
        const type = enemyTypes[enemy.type] || enemyTypes[0];
        const img = enemyImages[enemy.type];
        if (img && img.complete && img.naturalWidth > 0) {
            const size = type.size;
            ctx.drawImage(img, enemy.x - size/2, enemy.y - size/2, size, size);
        } else {
            ctx.fillStyle = type.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, type.size/2, 0, Math.PI * 2);
            ctx.fill();
        }
        drawEngineFlame(enemy.x, enemy.y - type.size * 0.35, Math.max(0.6, type.size / 95), enemy.index || 0, 'up');
        if (settings.particlesEnabled && gameTime % 3 === 0) {
            addFxParticle(
                enemy.x + (Math.random() - 0.5) * 5,
                enemy.y - type.size * 0.3,
                (Math.random() - 0.5) * 0.8,
                -1.6 - Math.random() * 1.2,
                Math.random() * 2 + 1,
                Math.random() < 0.5 ? '#66d9ff' : '#ff9b47',
                10 + Math.random() * 6
            );
        }
        if (enemy.health > 1) {
            const barWidth = type.size;
            const barHeight = 5;
            const barX = enemy.x - barWidth/2;
            const barY = enemy.y - type.size/2 - 10;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            const healthPercent = enemy.health / enemy.maxHealth;
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
        }
    }

    if (bossActive && boss) {
        if (bossImage.complete && bossImage.naturalWidth > 0) {
            const size = boss.size;
            ctx.drawImage(bossImage, boss.x - size/2, boss.y - size/2, size, size);
        } else {
            ctx.fillStyle = boss.color;
            ctx.beginPath();
            ctx.ellipse(boss.x, boss.y, boss.size/2, boss.size/2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(boss.x, boss.y - 40, 35, 0, Math.PI * 2);
            ctx.fill();
        }
        drawEngineFlame(boss.x - 35, boss.y - boss.size * 0.2, 1.25, 4.2, 'up');
        drawEngineFlame(boss.x + 35, boss.y - boss.size * 0.2, 1.25, 8.2, 'up');
        if (settings.particlesEnabled && gameTime % 2 === 0) {
            addFxParticle(boss.x - 35 + (Math.random() - 0.5) * 8, boss.y - boss.size * 0.18, (Math.random() - 0.5), -2.2 - Math.random(), Math.random() * 2.8 + 1.2, '#66d9ff', 12 + Math.random() * 8);
            addFxParticle(boss.x + 35 + (Math.random() - 0.5) * 8, boss.y - boss.size * 0.18, (Math.random() - 0.5), -2.2 - Math.random(), Math.random() * 2.8 + 1.2, '#ff9b47', 12 + Math.random() * 8);
        }
    }

    for (let item of items) {
        if (!item) continue;
        ctx.font = 'bold 14px Orbitron, Arial, sans-serif';
        ctx.fillStyle = item.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon, item.x, item.y);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    if (shieldActive) {
        ctx.strokeStyle = '#00a8ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function drawPlayer() {
    drawEngineFlame(player.x, player.y + player.height * 0.27, 1.2, 2.3);
    if (settings.particlesEnabled && gameTime % 2 === 0) {
        addFxParticle(
            player.x + (Math.random() - 0.5) * 6,
            player.y + player.height * 0.27,
            (Math.random() - 0.5) * 0.9,
            1.8 + Math.random() * 1.5,
            Math.random() * 2.2 + 1.3,
            Math.random() < 0.55 ? '#66d9ff' : '#ffb35a',
            12 + Math.random() * 8
        );
    }

    if (playerImage.complete && playerImage.naturalWidth > 0) {
        ctx.drawImage(playerImage, player.x - player.width/2, player.y - player.height/2, player.width, player.height);
    } else {
        ctx.fillStyle = '#00a8ff';
        ctx.beginPath();
        ctx.moveTo(player.x, player.y - 35);
        ctx.lineTo(player.x + 30, player.y + 15);
        ctx.lineTo(player.x + 15, player.y + 15);
        ctx.lineTo(player.x + 15, player.y + 30);
        ctx.lineTo(player.x - 15, player.y + 30);
        ctx.lineTo(player.x - 15, player.y + 15);
        ctx.lineTo(player.x - 30, player.y + 15);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(player.x, player.y + 30, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

function spawnEnemy() {
    const type = Math.floor(Math.random() * enemyTypes.length);
    const typeData = enemyTypes[type];
    let speedMultiplier = 1;
    if (gameMode === 'nightmare') speedMultiplier = 1.5;
    if (gameMode === 'endless') speedMultiplier = endlessDifficulty;
    speedMultiplier *= 0.7;
    let initialHealth = gameMode === 'nightmare' ? typeData.health * 1.5 : typeData.health;
    enemies.push({
        x: Math.random() * (canvas.width - 100) + 50,
        y: -50,
        type: type,
        speed: (typeData.speed + (wave * 0.05)) * speedMultiplier,
        size: typeData.size,
        pattern: typeData.pattern,
        points: typeData.points,
        health: initialHealth,
        maxHealth: initialHealth,
        index: Math.random() * 100
    });
    if (window.SoundManager) SoundManager.play('enemySpawn');
}

function spawnBoss(index) {
    const bossType = bossTypes[index % bossTypes.length];
    let healthMultiplier = 1;
    if (gameMode === 'nightmare') healthMultiplier = 2;
    if (gameMode === 'bossrush') healthMultiplier = 1.5;
    boss = {
        ...bossType,
        x: canvas.width / 2,
        y: 150,
        health: bossType.health * healthMultiplier,
        maxHealth: bossType.health * healthMultiplier
    };
    bossActive = true;
    const bossWarning = document.getElementById('bossWarning');
    if (bossWarning) {
        bossWarning.style.display = 'block';
        if (window.SoundManager) SoundManager.play('bossSpawn');
        setTimeout(() => {
            bossWarning.style.display = 'none';
            const bossHealthContainer = document.getElementById('bossHealthContainer');
            const bossName = document.getElementById('bossName');
            const bossHealthFill = document.getElementById('bossHealthFill');
            if (bossHealthContainer) bossHealthContainer.style.display = 'block';
            if (bossName) bossName.textContent = boss.name;
            if (bossHealthFill) bossHealthFill.style.width = '100%';
        }, 2000);
    }
}

function spawnItem(x, y) {
    if (items.length >= MAX_ITEMS) return;
    const types = [
        { type: 'health', icon: 'HP', color: '#ff69b4' },
        { type: 'shield', icon: 'SH', color: '#00a8ff' },
        { type: 'rapid', icon: 'RF', color: '#ffd700' },
        { type: 'upgrade', icon: 'UP', color: '#ffaa00' }
    ];
    const random = Math.random();
    let selectedType;
    if (random < 0.4) selectedType = types[0];
    else if (random < 0.65) selectedType = types[1];
    else if (random < 0.85) selectedType = types[2];
    else selectedType = types[3];
    items.push({ ...selectedType, x, y, bobOffset: Math.random() * Math.PI * 2 });
}

function createBloodEffect(x, y, amount) {
    if (!settings.bloodEnabled) return;
    if (bloodParticles.length > MAX_BLOOD) return;
    for (let i = 0; i < amount; i++) {
        if (bloodParticles.length >= MAX_BLOOD) break;
        bloodParticles.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 1,
            size: Math.random() * 3 + 1,
            color: `rgba(139, 0, 0, ${Math.random() * 0.8 + 0.2})`,
            life: 15 + Math.random() * 15
        });
    }
}

function createHealEffect() {
    for (let i = 0; i < 10; i++) {
        bloodParticles.push({
            x: player.x + (Math.random() - 0.5) * 50,
            y: player.y + (Math.random() - 0.5) * 50,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2 - 2,
            size: Math.random() * 5 + 2,
            color: `rgba(255, 105, 180, ${Math.random() * 0.8 + 0.2})`,
            life: 20 + Math.random() * 20
        });
    }
}

function createShieldEffect() {
    for (let i = 0; i < 20; i++) {
        bloodParticles.push({
            x: player.x + (Math.random() - 0.5) * 60,
            y: player.y + (Math.random() - 0.5) * 60,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3 - 1,
            size: Math.random() * 4 + 1,
            color: `rgba(0, 168, 255, ${Math.random() * 0.8 + 0.2})`,
            life: 15 + Math.random() * 15
        });
    }
}

function createUpgradeEffect() {
    for (let i = 0; i < 15; i++) {
        bloodParticles.push({
            x: player.x + (Math.random() - 0.5) * 70,
            y: player.y + (Math.random() - 0.5) * 70,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
            size: Math.random() * 5 + 2,
            color: `rgba(255, 170, 0, ${Math.random() * 0.8 + 0.2})`,
            life: 20 + Math.random() * 20
        });
    }
}

function collectItem(type) {
    inventory[type] = (inventory[type] || 0) + 1;
    showFloatingText(`+1 ${type}`, getItemColor(type));
    updateInventory();
    if (window.SoundManager) SoundManager.play('itemCollect');
}

function useItem(type) {
    if (!gameRunning || gamePaused) return;
    if (inventory[type] > 0) {
        inventory[type]--;
        switch(type) {
            case 'health':
                if (lives < maxLives) { 
                    lives++; 
                    showFloatingText('HEALTH +1', '#ff69b4'); 
                    createHealEffect();
                    if (window.SoundManager) SoundManager.play('itemUse');
                } else { inventory[type]++; showFloatingText('NYAWA SUDAH PENUH!', '#ff4444'); }
                break;
            case 'shield':
                shieldActive = true; shieldTimer = 300;
                const shieldIndicator = document.getElementById('shieldIndicator');
                if (shieldIndicator) shieldIndicator.style.display = 'block';
                showFloatingText('SHIELD ACTIVE', '#00a8ff');
                createShieldEffect();
                if (window.SoundManager) SoundManager.play('shield');
                break;
            case 'rapid':
                rapidFireActive = true; rapidFireTimer = 300;
                const rapidIndicator = document.getElementById('rapidIndicator');
                if (rapidIndicator) rapidIndicator.style.display = 'block';
                showFloatingText('RAPID FIRE', '#ffd700');
                if (window.SoundManager) SoundManager.play('rapid');
                break;
            case 'upgrade':
                if (player.weaponLevel < 5) { 
                    player.weaponLevel++; 
                    updateWeaponDisplay(); 
                    showFloatingText('WEAPON UPGRADE', '#ffaa00'); 
                    createUpgradeEffect();
                    if (window.SoundManager) SoundManager.play('upgrade');
                } else { inventory[type]++; showFloatingText('WEAPON SUDAH MAX!', '#ff4444'); }
                break;
        }
        updateHUD();
        updateInventory();
    } else {
        showFloatingText(`${type.toUpperCase()} TIDAK ADA!`, '#ff4444');
    }
}

function getItemColor(type) {
    const colors = { health: '#ff69b4', shield: '#00a8ff', rapid: '#ffd700', upgrade: '#ffaa00' };
    return colors[type] || '#ffffff';
}

function useFirstAvailableItem() {
    if (inventory.health > 0 && lives < maxLives) useItem('health');
    else if (inventory.shield > 0 && !shieldActive) useItem('shield');
    else if (inventory.rapid > 0 && !rapidFireActive) useItem('rapid');
    else if (inventory.upgrade > 0 && player.weaponLevel < 5) useItem('upgrade');
    else {
        if (inventory.health > 0) showFloatingText('NYAWA SUDAH PENUH!', '#ff4444');
        else if (inventory.shield > 0) showFloatingText('SHIELD SUDAH AKTIF!', '#ff4444');
        else if (inventory.rapid > 0) showFloatingText('RAPID SUDAH AKTIF!', '#ff4444');
        else if (inventory.upgrade > 0) showFloatingText('WEAPON SUDAH MAX!', '#ff4444');
        else showFloatingText('TIDAK ADA ITEM!', '#ff4444');
    }
}

function shoot() {
    const now = Date.now();
    let cooldown = rapidFireActive ? 50 : SHOOT_COOLDOWN;
    if (now - lastShootTime < cooldown) return;
    lastShootTime = now;
    if (bullets.length >= MAX_BULLETS) return;
    const weapon = weaponLevels[player.weaponLevel] || weaponLevels[1];
    const bulletCount = rapidFireActive ? weapon.bullets * 2 : weapon.bullets;
    for (let i = 0; i < bulletCount; i++) {
        let offsetX = 0;
        if (bulletCount > 1) {
            const index = i - (bulletCount - 1) / 2;
            offsetX = index * weapon.spread;
        }
        bullets.push({
            x: player.x + offsetX,
            y: player.y - 30,
            speed: weapon.speed,
            damage: weapon.damage,
            color: weapon.color,
            width: 4,
            height: 12,
            trail: []
        });
    }
    if (window.SoundManager) {
        const shootSounds = ['shoot2', 'shoot2', 'shoot2'];
        const randomShoot = shootSounds[Math.floor(Math.random() * shootSounds.length)];
        SoundManager.play(randomShoot);
    }
}

function takeDamage(amount) {
    if (player.invincible || shieldActive) return;
    lives -= amount;
    player.invincible = true;
    player.invincibleTimer = 60;
    createBloodEffect(player.x, player.y, 20);
    updateHUD();
    if (window.SoundManager) {
        if (lives <= 0) {
            SoundManager.play('playerDie');
        } else {
            SoundManager.play('playerHit');
        }
    }
    if (lives <= 0) gameOver();
}

function checkCollision(a, b, threshold = 30) {
    if (!a || !b) return false;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx < threshold && dy < threshold;
}

function showFloatingText(text, color) {
    const div = document.createElement('div');
    div.className = 'floating-text';
    div.textContent = text;
    div.style.left = player.x + 'px';
    div.style.top = player.y - 50 + 'px';
    div.style.color = color;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

function gameOver(victory = false) {
    gameRunning = false;
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
    stopMobileFire();
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    if (window.SoundManager) {
        if (victory) {
            SoundManager.play('victory');
        } else {
            SoundManager.play('gameOver');
        }
    }
    let highscores = JSON.parse(localStorage.getItem('highscores')) || [];
    highscores.push({ name: 'PLAYER', score, mode: gameMode, wave, bosses: bossesKilled });
    highscores.sort((a, b) => b.score - a.score);
    highscores = highscores.slice(0, 10);
    localStorage.setItem('highscores', JSON.stringify(highscores));
    const finalScore = document.getElementById('finalScore');
    const finalAliens = document.getElementById('finalAliens');
    const finalBosses = document.getElementById('finalBosses');
    const finalWave = document.getElementById('finalWave');
    const gameOverScreen = document.getElementById('gameOverScreen');
    if (finalScore) finalScore.textContent = score;
    if (finalAliens) finalAliens.textContent = enemiesKilled;
    if (finalBosses) finalBosses.textContent = bossesKilled;
    if (finalWave) finalWave.textContent = wave;
    if (gameOverScreen) gameOverScreen.style.display = 'flex';
}

function updateHUD() {
    const livesEl = document.getElementById('lives');
    const scoreEl = document.getElementById('score');
    const waveEl = document.getElementById('wave');
    if (livesEl) livesEl.textContent = lives;
    if (scoreEl) scoreEl.textContent = score;
    if (waveEl) waveEl.textContent = wave;
}

function updateInventory() {
    const healthCount = document.getElementById('healthCount');
    const shieldCount = document.getElementById('shieldCount');
    const rapidCount = document.getElementById('rapidCount');
    const upgradeCount = document.getElementById('upgradeCount');
    if (healthCount) healthCount.textContent = inventory.health;
    if (shieldCount) shieldCount.textContent = inventory.shield;
    if (rapidCount) rapidCount.textContent = inventory.rapid;
    if (upgradeCount) upgradeCount.textContent = inventory.upgrade;
}

function updateWeaponDisplay() {
    const weaponLevel = document.getElementById('weaponLevel');
    if (weaponLevel) weaponLevel.textContent = `Lv.${player.weaponLevel}`;
}

function togglePause() {
    gamePaused = !gamePaused;
    if (gamePaused) stopMobileFire();
    const pauseScreen = document.getElementById('pauseScreen');
    if (pauseScreen) pauseScreen.style.display = gamePaused ? 'flex' : 'none';
    if (window.SoundManager) SoundManager.play('buttonClick');
}

function resumeGame() {
    gamePaused = false;
    const pauseScreen = document.getElementById('pauseScreen');
    if (pauseScreen) pauseScreen.style.display = 'none';
    if (window.SoundManager) SoundManager.play('buttonClick');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
    if (window.SoundManager) SoundManager.play('buttonClick');
}

function showMenuConfirm() {
    if (!gamePaused) togglePause();
    const menuConfirmDialog = document.getElementById('menuConfirmDialog');
    if (menuConfirmDialog) menuConfirmDialog.style.display = 'flex';
    if (window.SoundManager) SoundManager.play('buttonClick');
}

function cancelGoToMenu() {
    const menuConfirmDialog = document.getElementById('menuConfirmDialog');
    const pauseScreen = document.getElementById('pauseScreen');
    if (menuConfirmDialog) menuConfirmDialog.style.display = 'none';
    if (pauseScreen) pauseScreen.style.display = 'flex';
    if (window.SoundManager) SoundManager.play('buttonClick');
}

function confirmGoToMenu() {
    gameRunning = false;
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
    stopMobileFire();
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    const menuConfirmDialog = document.getElementById('menuConfirmDialog');
    const pauseScreen = document.getElementById('pauseScreen');
    if (menuConfirmDialog) menuConfirmDialog.style.display = 'none';
    if (pauseScreen) pauseScreen.style.display = 'none';
    if (window.SoundManager) SoundManager.play('buttonClick');
    if (window.SoundManager && typeof SoundManager.stopMusic === 'function') {
        SoundManager.stopMusic();
    }
    window.location.href = 'index.html';
}

function showMenu() {
    if (gameRunning) showMenuConfirm();
    else goToMenu();
}

function goToMenu() {
    gameRunning = false;
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
    stopMobileFire();
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    if (window.SoundManager && typeof SoundManager.stopMusic === 'function') {
        SoundManager.stopMusic();
    }
    window.location.href = 'index.html';
}

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (key === 'p') { e.preventDefault(); togglePause(); highlightButton('pause'); }
    if (key === 'f') { e.preventDefault(); toggleFullscreen(); highlightButton('fullscreen'); }
    if (key === 'm') { e.preventDefault(); showMenu(); highlightButton('menu'); }
    if (key === 'r') { e.preventDefault(); restartGame(); highlightButton('restart'); }
});

function highlightButton(action) {
    let button;
    switch(action) {
        case 'pause': button = document.querySelector('.ctrl-btn-full[data-key="P"]'); break;
        case 'fullscreen': button = document.querySelector('.ctrl-btn-full[data-key="F"]'); break;
        case 'menu': button = document.querySelector('.ctrl-btn-full[data-key="M"]'); break;
        case 'restart': button = document.querySelector('.ctrl-btn-full[data-key="R"]'); break;
    }
    if (button) {
        button.style.transform = 'scale(1.2)';
        button.style.backgroundColor = '#00a8ff';
        button.style.boxShadow = '0 0 30px #00a8ff';
        setTimeout(() => {
            button.style.transform = '';
            button.style.backgroundColor = '';
            button.style.boxShadow = '';
        }, 200);
    }
}

function startMobileFire() {
    if (mobileFireInterval) return;
    if (gameRunning && !gamePaused) shoot();
    mobileFireInterval = setInterval(() => {
        if (gameRunning && !gamePaused) shoot();
    }, 120);
}

function stopMobileFire() {
    if (!mobileFireInterval) return;
    clearInterval(mobileFireInterval);
    mobileFireInterval = null;
}

function bindHoldControl(button, onStart, onEnd) {
    if (!button) return;
    const start = (e) => {
        e.preventDefault();
        onStart();
        button.classList.add('active');
    };
    const end = (e) => {
        e.preventDefault();
        onEnd();
        button.classList.remove('active');
    };

    if (window.PointerEvent) {
        button.addEventListener('pointerdown', start, { passive: false });
        button.addEventListener('pointerup', end, { passive: false });
        button.addEventListener('pointerleave', end, { passive: false });
        button.addEventListener('pointercancel', end, { passive: false });
        return;
    }

    button.addEventListener('touchstart', start, { passive: false });
    button.addEventListener('touchend', end, { passive: false });
    button.addEventListener('touchcancel', end, { passive: false });
    button.addEventListener('mousedown', start, { passive: false });
    button.addEventListener('mouseup', end, { passive: false });
    button.addEventListener('mouseleave', end, { passive: false });
}

function setupMobileControls() {
    const mobileControls = document.getElementById('mobileControls');
    if (!mobileControls) return;

    if (!isTouchDevice) {
        mobileControls.style.display = 'none';
        return;
    }

    document.body.classList.add('mobile-device');

    const leftBtn = document.getElementById('mobileLeftBtn');
    const rightBtn = document.getElementById('mobileRightBtn');
    const fireBtn = document.getElementById('mobileFireBtn');

    bindHoldControl(leftBtn, () => { keys['ArrowLeft'] = true; }, () => { keys['ArrowLeft'] = false; });
    bindHoldControl(rightBtn, () => { keys['ArrowRight'] = true; }, () => { keys['ArrowRight'] = false; });
    bindHoldControl(fireBtn, startMobileFire, stopMobileFire);

    window.addEventListener('blur', () => {
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
        stopMobileFire();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) return;
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
        stopMobileFire();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyResponsivePlayerSettings();
    Galaxy.init(canvas.width, canvas.height);
    updateHUD();
    updateInventory();
    updateWeaponDisplay();
    setupMobileControls();
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        try { settings = { ...settings, ...JSON.parse(savedSettings) }; } catch (e) { console.error('Error loading settings:', e); }
    }
    const buttons = document.querySelectorAll('.ctrl-btn-full');
    buttons.forEach(btn => {
        const key = btn.getAttribute('data-key');
        if (key) {
            const shortcutSpan = document.createElement('small');
            shortcutSpan.className = 'keyboard-shortcut';
            shortcutSpan.textContent = `[${key}]`;
            shortcutSpan.style.fontSize = '10px';
            shortcutSpan.style.opacity = '0.7';
            shortcutSpan.style.marginLeft = '5px';
            btn.appendChild(shortcutSpan);
        }
    });
});

window.addEventListener('resize', () => {
    applyResponsivePlayerSettings();
    if (gameRunning) player.x = clampPlayerX(player.x);
    Galaxy.init(canvas.width, canvas.height);
});

window.addEventListener('beforeunload', () => {
    stopMobileFire();
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
});

window.startGame = startGame;
window.togglePause = togglePause;
window.resumeGame = resumeGame;
window.toggleFullscreen = toggleFullscreen;
window.showMenu = showMenu;
window.showMenuConfirm = showMenuConfirm;
window.cancelGoToMenu = cancelGoToMenu;
window.confirmGoToMenu = confirmGoToMenu;
window.restartGame = restartGame;
window.useItem = useItem;
window.useFirstAvailableItem = useFirstAvailableItem;
