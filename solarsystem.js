// galaxy.js
// Background galaksi dengan bintang dan nebula

let galaxyParticles = [];

function initGalaxy(canvasWidth, canvasHeight) {
    galaxyParticles = [];
    // Bintang kecil (200)
    for (let i = 0; i < 200; i++) {
        galaxyParticles.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 0.3 + 0.2,
            brightness: Math.random() * 0.5 + 0.5,
            twinkleSpeed: Math.random() * 0.02 + 0.01,
            phase: Math.random() * Math.PI * 2,
            color: 'white'
        });
    }
    // Bintang besar (30) dengan warna kebiruan
    for (let i = 0; i < 30; i++) {
        galaxyParticles.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            size: Math.random() * 4 + 2,
            speed: Math.random() * 0.2 + 0.1,
            brightness: Math.random() * 0.7 + 0.3,
            twinkleSpeed: Math.random() * 0.01 + 0.005,
            phase: Math.random() * Math.PI * 2,
            color: `hsl(${Math.random() * 60 + 180}, 80%, 70%)`
        });
    }
}

function drawGalaxy(ctx, canvasWidth, canvasHeight, gameTime) {
    // Latar belakang gelap
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Nebula 1 (biru)
    ctx.globalAlpha = 0.3;
    const grd1 = ctx.createRadialGradient(
        canvasWidth * 0.3, canvasHeight * 0.4, 50,
        canvasWidth * 0.3, canvasHeight * 0.4, 400
    );
    grd1.addColorStop(0, 'rgba(0, 100, 255, 0.2)');
    grd1.addColorStop(1, 'transparent');
    ctx.fillStyle = grd1;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Nebula 2 (merah muda)
    const grd2 = ctx.createRadialGradient(
        canvasWidth * 0.7, canvasHeight * 0.6, 100,
        canvasWidth * 0.7, canvasHeight * 0.6, 500
    );
    grd2.addColorStop(0, 'rgba(255, 80, 120, 0.15)');
    grd2.addColorStop(1, 'transparent');
    ctx.fillStyle = grd2;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Nebula 3 (hijau) bergerak lambat
    const grd3 = ctx.createRadialGradient(
        canvasWidth * (0.5 + Math.sin(gameTime * 0.001) * 0.1),
        canvasHeight * (0.3 + Math.cos(gameTime * 0.001) * 0.1), 80,
        canvasWidth * 0.5, canvasHeight * 0.3, 450
    );
    grd3.addColorStop(0, 'rgba(50, 255, 150, 0.1)');
    grd3.addColorStop(1, 'transparent');
    ctx.fillStyle = grd3;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.globalAlpha = 1;
    
    // Gambar bintang
    for (let star of galaxyParticles) {
        const twinkle = Math.sin(gameTime * star.twinkleSpeed + star.phase) * 0.3 + 0.7;
        ctx.globalAlpha = star.brightness * twinkle;
        ctx.fillStyle = star.color || 'white';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Tambahkan beberapa bintang terang statis
    ctx.globalAlpha = 0.8 + Math.sin(gameTime * 0.02) * 0.2;
    ctx.fillStyle = 'white';
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(100 + i * 150, 80, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.globalAlpha = 1;
}

function updateGalaxy(canvasHeight) {
    for (let star of galaxyParticles) {
        star.y += star.speed;
        if (star.y > canvasHeight) {
            star.y = 0;
            // Update x agar tidak selalu muncul di tempat sama
            star.x = Math.random() * (window.innerWidth || canvasWidth); 
        }
    }
}

// Ekspos ke global
window.Galaxy = {
    init: initGalaxy,
    draw: drawGalaxy,
    update: updateGalaxy
};