let selectedMode = 'classic';
let homeMusicStarted = false;

function tryStartHomeMusic() {
    if (!window.SoundManager) return;
    if (homeMusicStarted && SoundManager.looping === 'backsound') return;
    if (typeof SoundManager.initialize === 'function') SoundManager.initialize();
    if (typeof SoundManager.unlock === 'function') SoundManager.unlock();
    if (typeof SoundManager.flushPending === 'function') SoundManager.flushPending();

    if (typeof SoundManager.setVolume === 'function') {
        SoundManager.setVolume('backsound', 0.32);
    }
    const started = SoundManager.playMusic('backsound');
    homeMusicStarted = !!started || SoundManager.looping === 'backsound';
}

function showModeSelection() {
    document.getElementById('modePanel').style.display = 'block';
}

function closeModeSelection() {
    document.getElementById('modePanel').style.display = 'none';
}

function selectMode(mode, evt) {
    selectedMode = mode;
    localStorage.setItem('selectedMode', mode);
    if (window.SoundManager && typeof SoundManager.stopMusic === 'function') {
        SoundManager.stopMusic();
    }
    
    document.querySelectorAll('.mode-card').forEach(card => {
        card.style.borderColor = 'transparent';
        card.style.background = 'rgba(0,168,255,0.1)';
    });
    
    const trigger = (evt && evt.currentTarget) || (window.event && window.event.currentTarget);
    if (trigger) {
        trigger.style.borderColor = '#00a8ff';
        trigger.style.background = 'rgba(0,168,255,0.3)';
    }
    
    setTimeout(() => {
        closeModeSelection();
        window.location.href = 'game.html';
    }, 500);
}

function openSettings() {
    document.getElementById('settingsPanel').style.display = 'block';
    loadSettings();
}

function closeSettings() {
    document.getElementById('settingsPanel').style.display = 'none';
}

function showHighscore() {
    const panel = document.getElementById('highscorePanel');
    
    if (panel) {
        panel.classList.add('active');
        panel.style.display = 'block';
    }
    
    displayHighscores();
}

function closeHighscore() {
    const panel = document.getElementById('highscorePanel');
    
    if (panel) {
        panel.classList.remove('active');
        panel.style.display = 'none';
    }
    
    const confirmDialog = document.getElementById('deleteConfirmDialog');
    if (confirmDialog) confirmDialog.style.display = 'none';
}

function displayHighscores() {
    const highscores = JSON.parse(localStorage.getItem('highscores')) || [];
    const list = document.getElementById('highscoreList');
    
    if (!list) return;
    
    list.innerHTML = '';
    
    if (highscores.length === 0) {
        list.innerHTML = '<div class="highscore-empty">Belum ada highscore</div>';
        return;
    }
    
    highscores.sort((a, b) => b.score - a.score);
    
    highscores.forEach((score, index) => {
        const item = document.createElement('div');
        item.className = 'highscore-item';
        
        let rankText = '';
        if (index === 0) rankText = '#1';
        else if (index === 1) rankText = '#2';
        else if (index === 2) rankText = '#3';
        else rankText = `#${index + 1}`;
        
        item.innerHTML = `
            <span class="highscore-rank">${rankText}</span>
            <span class="highscore-name">${score.name || 'PLAYER'}</span>
            <span class="highscore-score">${score.score} pts</span>
            <span class="highscore-wave">Wave ${score.wave || 1}</span>
        `;
        
        list.appendChild(item);
    });
}

function deleteAllHighscores() {
    const dialog = document.getElementById('deleteConfirmDialog');
    if (dialog) dialog.style.display = 'block';
}

function confirmDeleteHighscores() {
    localStorage.removeItem('highscores');
    
    const dialog = document.getElementById('deleteConfirmDialog');
    if (dialog) dialog.style.display = 'none';
    
    displayHighscores();
    
    alert('Semua highscore telah dihapus.');
}

function cancelDeleteHighscores() {
    const dialog = document.getElementById('deleteConfirmDialog');
    if (dialog) dialog.style.display = 'none';
}

function showAbout() {
    document.getElementById('aboutPanel').style.display = 'block';
}

function closeAbout() {
    document.getElementById('aboutPanel').style.display = 'none';
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('gameSettings')) || {
        graphicQuality: 'medium',
        sfxEnabled: true,
        musicEnabled: true,
        bloodEnabled: true,
        particlesEnabled: true
    };
    
    document.getElementById('graphicQuality').value = settings.graphicQuality;
    document.getElementById('sfxEnabled').checked = settings.sfxEnabled;
    document.getElementById('musicEnabled').checked = settings.musicEnabled;
    document.getElementById('bloodEnabled').checked = settings.bloodEnabled;
    document.getElementById('particlesEnabled').checked = settings.particlesEnabled;
}

function saveSettings() {
    const settings = {
        graphicQuality: document.getElementById('graphicQuality').value,
        sfxEnabled: document.getElementById('sfxEnabled').checked,
        musicEnabled: document.getElementById('musicEnabled').checked,
        bloodEnabled: document.getElementById('bloodEnabled').checked,
        particlesEnabled: document.getElementById('particlesEnabled').checked
    };
    
    localStorage.setItem('gameSettings', JSON.stringify(settings));
    if (window.SoundManager) {
        SoundManager.sfxEnabled = settings.sfxEnabled;
        SoundManager.musicEnabled = settings.musicEnabled;
        if (settings.musicEnabled) {
            homeMusicStarted = false;
            tryStartHomeMusic();
        } else if (typeof SoundManager.stopMusic === 'function') {
            SoundManager.stopMusic();
        }
    }
    alert('Pengaturan disimpan!');
    closeSettings();
}

function closeAllPanels() {
    closeModeSelection();
    closeSettings();
    closeHighscore();
    closeAbout();
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAllPanels();
    }
});

let audioUnlocked = false;

function unlockAudio() {
    if (audioUnlocked) return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        ctx.resume();
    } catch (e) {}

    audioUnlocked = true;
}

document.addEventListener('click', unlockAudio, { once: true });

document.addEventListener('DOMContentLoaded', () => {
    if (window.SoundManager && typeof SoundManager.initialize === 'function') {
        SoundManager.initialize();
    }
    tryStartHomeMusic();
});

document.addEventListener('pointerdown', tryStartHomeMusic, { passive: true });
document.addEventListener('click', tryStartHomeMusic, { passive: true });
document.addEventListener('touchstart', tryStartHomeMusic, { passive: true });
document.addEventListener('keydown', tryStartHomeMusic, { passive: true });
