class GameSoundManager {
    constructor() {
        this.registry = new Map();
        this.pools = new Map();
        this.cursor = new Map();
        this.lastPlayedAt = new Map();
        this.pending = [];
        this.looping = null;
        this.audioContext = null;
        this.masterVolume = 1;
        this.muted = false;
        this.initialized = false;
        this.unlocked = false;
        this.primed = false;
        this.sfxEnabled = true;
        this.musicEnabled = true;
        this._loadSavedSettings();
    }

    _loadSavedSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('gameSettings') || '{}');
            this.sfxEnabled = settings.sfxEnabled !== false;
            this.musicEnabled = settings.musicEnabled !== false;
        } catch (e) {
            this.sfxEnabled = true;
            this.musicEnabled = true;
        }
    }

    _createAudio(src) {
        let resolvedSrc = src;
        try {
            resolvedSrc = new URL(src, window.location.href).href;
        } catch (e) {}

        const audio = new Audio();
        audio.src = resolvedSrc;
        audio.preload = 'auto';
        audio.setAttribute('playsinline', 'true');
        audio.__failed = false;
        audio.addEventListener('error', () => {
            audio.__failed = true;
        });
        return audio;
    }

    _buildPool(name) {
        const config = this.registry.get(name);
        if (!config) return;
        if (this.pools.has(name)) return;

        const pool = [];
        const count = Math.max(1, config.pool || 1);
        for (let i = 0; i < count; i++) {
            const audio = this._createAudio(config.src);
            audio.volume = config.volume;
            pool.push(audio);
        }
        this.pools.set(name, pool);
        this.cursor.set(name, 0);
    }

    _ensureAudioContext() {
        if (this.audioContext) return this.audioContext;
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return null;
        try {
            this.audioContext = new AudioContextCtor();
            return this.audioContext;
        } catch (e) {
            return null;
        }
    }

    _playFallbackTone(name, volume = 0.2, duration = 0.08) {
        const ctx = this._ensureAudioContext();
        if (!ctx) return false;
        try {
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const toneMap = {
                shoot: 820,
                shoot2: 760,
                shoot3: 700,
                enemyShoot: 280,
                explosion: 110,
                playerHit: 180,
                playerDie: 90,
                itemCollect: 640,
                shield: 460,
                rapid: 520,
                upgrade: 720,
                buttonClick: 560,
                click: 560
            };
            osc.type = 'triangle';
            osc.frequency.value = toneMap[name] || 440;
            gain.gain.setValueAtTime(Math.min(0.3, volume), ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
            return true;
        } catch (e) {
            return false;
        }
    }

    initialize() {
        if (this.initialized) return;
        this.initialized = true;

        const assets = [
            { name: 'shoot', src: 'assets/sound/shoot.mp3', pool: 6, volume: 0.7, cooldown: 35 },
            { name: 'shoot2', src: 'assets/sound/shoot2.mp3', pool: 6, volume: 0.72, cooldown: 35 },
            { name: 'shoot3', src: 'assets/sound/shoot3.mp3', pool: 6, volume: 0.74, cooldown: 35 },
            { name: 'enemyShoot', src: 'assets/sound/shoot.mp3', pool: 4, volume: 0.45, cooldown: 70 },
            { name: 'enemySpawn', src: 'assets/sound/enemySpawn.mp3', pool: 3, volume: 0.75, cooldown: 120 },
            { name: 'enemyHit', src: 'assets/sound/enemyHit.mp3', pool: 4, volume: 0.65, cooldown: 25 },
            { name: 'explosion', src: 'assets/sound/explosion.mp3', pool: 4, volume: 0.82, cooldown: 50 },
            { name: 'playerHit', src: 'assets/sound/playerHit.mp3', pool: 3, volume: 0.85, cooldown: 120 },
            { name: 'playerDie', src: 'assets/sound/playerDie.mp3', pool: 2, volume: 0.95, cooldown: 250 },
            { name: 'bossSpawn', src: 'assets/sound/bossSpawn.mp3', pool: 2, volume: 0.9, cooldown: 400 },
            { name: 'bossAttack', src: 'assets/sound/bossAttack.mp3', pool: 3, volume: 0.78, cooldown: 120 },
            { name: 'bossDie', src: 'assets/sound/bossDie.mp3', pool: 2, volume: 0.95, cooldown: 350 },
            { name: 'itemCollect', src: 'assets/sound/itemCollect.mp3', pool: 3, volume: 0.75, cooldown: 70 },
            { name: 'itemUse', src: 'assets/sound/itemUse.mp3', pool: 3, volume: 0.8, cooldown: 90 },
            { name: 'shield', src: 'assets/sound/shield.mp3', pool: 2, volume: 0.8, cooldown: 90 },
            { name: 'rapid', src: 'assets/sound/rapid.mp3', pool: 2, volume: 0.8, cooldown: 90 },
            { name: 'upgrade', src: 'assets/sound/upgrade.mp3', pool: 2, volume: 0.85, cooldown: 120 },
            { name: 'buttonClick', src: 'assets/sound/click.mp3', pool: 4, volume: 0.6, cooldown: 55 },
            { name: 'click', src: 'assets/sound/click.mp3', pool: 4, volume: 0.6, cooldown: 55 },
            { name: 'gameStart', src: 'assets/sound/click.mp3', pool: 2, volume: 0.7, cooldown: 120 },
            { name: 'gameOver', src: 'assets/sound/playerDie.mp3', pool: 2, volume: 0.9, cooldown: 250 },
            { name: 'victory', src: 'assets/sound/upgrade.mp3', pool: 2, volume: 0.9, cooldown: 250 },
            { name: 'backsound', src: 'assets/sound/backsound.mp3', pool: 1, volume: 0.45, music: true, cooldown: 0 }
        ];

        for (const asset of assets) {
            this.load(asset.name, asset.src, asset);
        }
    }

    unlock() {
        if (this.unlocked) return;
        this.unlocked = true;

        for (const [name] of this.registry) {
            this._buildPool(name);
            const pool = this.pools.get(name) || [];
            for (const audio of pool) {
                if (!audio || audio.__failed) continue;
                try {
                    audio.load();
                } catch (e) {
                    audio.__failed = true;
                }
            }
        }

        this.prime();
    }

    prime() {
        if (this.primed) return;
        this.primed = true;
        const audio = this._pickAudio('click') || this._pickAudio('shoot');
        if (!audio || audio.__failed) return;
        const originalVolume = audio.volume;
        const originalLoop = audio.loop;

        try {
            audio.volume = 0.001;
            audio.loop = false;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.volume = originalVolume;
                    audio.loop = originalLoop;
                }).catch(() => {
                    audio.volume = originalVolume;
                    audio.loop = originalLoop;
                });
            }
        } catch (e) {
            audio.volume = originalVolume;
            audio.loop = originalLoop;
        }
    }

    _enqueuePending(name, options) {
        if (!name) return;
        if (this.pending.length >= 24) this.pending.shift();
        this.pending.push({ name, options: { ...options } });
    }

    flushPending() {
        if (this.pending.length === 0) return;
        const queued = this.pending.splice(0, this.pending.length);
        for (let i = 0; i < queued.length; i++) {
            const item = queued[i];
            this.play(item.name, item.options || {});
        }
    }

    load(name, src, options = {}) {
        const config = {
            src,
            pool: options.pool || 1,
            volume: typeof options.volume === 'number' ? options.volume : 1,
            cooldown: options.cooldown || 0,
            music: options.music === true
        };
        this.registry.set(name, config);
        if (this.unlocked) this._buildPool(name);
    }

    _pickAudio(name) {
        this._buildPool(name);
        const pool = this.pools.get(name);
        if (!pool || pool.length === 0) return null;

        const start = this.cursor.get(name) || 0;
        for (let i = 0; i < pool.length; i++) {
            const idx = (start + i) % pool.length;
            const audio = pool[idx];
            if (audio && !audio.__failed && (audio.paused || audio.ended)) {
                this.cursor.set(name, (idx + 1) % pool.length);
                return audio;
            }
        }

        const fallback = pool[start % pool.length];
        this.cursor.set(name, (start + 1) % pool.length);
        return fallback && !fallback.__failed ? fallback : null;
    }

    play(name, options = {}) {
        if (!name) return false;
        if (!this.initialized) this.initialize();
        if (!this.unlocked) this.unlock();

        this._loadSavedSettings();
        const config = this.registry.get(name);
        if (!config) return false;
        if (this.muted) return false;
        if (config.music && !this.musicEnabled) return false;
        if (!config.music && !this.sfxEnabled) return false;

        const now = performance.now();
        const last = this.lastPlayedAt.get(name) || 0;
        const cooldown = options.cooldown ?? config.cooldown;
        if (cooldown > 0 && now - last < cooldown) return false;
        this.lastPlayedAt.set(name, now);

        const audio = this._pickAudio(name);
        if (!audio || audio.__failed) return false;

        const volume = Math.max(0, Math.min(1, (options.volume ?? config.volume) * this.masterVolume));
        const loop = options.loop === true;

        try {
            audio.pause();
            audio.currentTime = 0;
            audio.loop = loop;
            audio.volume = volume;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch(() => {
                    if (!config.music) this._playFallbackTone(name, volume);
                    this._enqueuePending(name, options);
                });
            }
            return true;
        } catch (e) {
            if (!config.music) this._playFallbackTone(name, volume);
            this._enqueuePending(name, options);
            return false;
        }
    }

    stop(name) {
        if (!name || !this.pools.has(name)) return;
        const pool = this.pools.get(name);
        for (const audio of pool) {
            if (!audio) continue;
            try {
                audio.pause();
                audio.currentTime = 0;
                audio.loop = false;
            } catch (e) {}
        }
        if (this.looping === name) this.looping = null;
    }

    loop(name, options = {}) {
        if (!name) return false;
        this.stop(name);
        const ok = this.play(name, { ...options, loop: true });
        if (ok) this.looping = name;
        return ok;
    }

    setVolume(name, volume) {
        if (typeof name === 'number' && typeof volume === 'undefined') {
            this.setVolume(null, name);
            return;
        }

        const clamped = Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 1));
        if (name) {
            const config = this.registry.get(name);
            if (!config) return;
            config.volume = clamped;
            if (!this.pools.has(name)) return;
            for (const audio of this.pools.get(name)) {
                if (audio) audio.volume = clamped * this.masterVolume;
            }
            return;
        }

        this.masterVolume = clamped;
        for (const [soundName, pool] of this.pools) {
            const config = this.registry.get(soundName);
            if (!config) continue;
            for (const audio of pool) {
                if (audio) audio.volume = config.volume * this.masterVolume;
            }
        }
    }

    muteAll(muted = true) {
        this.muted = muted;
        if (this.muted) {
            for (const [name] of this.registry) this.stop(name);
        } else if (this.looping) {
            this.loop(this.looping);
        }
    }

    playMusic(name) {
        if (!name) return false;
        if (this.looping && this.looping !== name) this.stop(this.looping);
        return this.loop(name, { loop: true });
    }

    stopMusic() {
        if (!this.looping) return;
        this.stop(this.looping);
        this.looping = null;
    }
}

window.SoundManager = new GameSoundManager();

function initSoundSystem() {
    if (!window.SoundManager) return;
    window.SoundManager.initialize();
    window.SoundManager.unlock();
    if (typeof window.SoundManager._ensureAudioContext === 'function') {
        window.SoundManager._ensureAudioContext();
    }
    if (typeof window.SoundManager.flushPending === 'function') {
        window.SoundManager.flushPending();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!window.SoundManager) return;
    window.SoundManager.initialize();
});

document.addEventListener('pointerdown', initSoundSystem, { once: true, passive: true });
document.addEventListener('click', initSoundSystem, { once: true, passive: true });
document.addEventListener('keydown', initSoundSystem, { once: true, passive: true });
document.addEventListener('touchstart', initSoundSystem, { once: true, passive: true });
