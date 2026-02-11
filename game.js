// ============================================
// Snake Game – Full Game Engine (Enhanced)
// ============================================

(function () {
    'use strict';

    // ---- DOM References ----
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('gameOverlay');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayMessage = document.getElementById('overlayMessage');
    const overlayIcon = document.getElementById('overlayIcon');
    const playBtn = document.getElementById('playBtn');
    const scoreEl = document.getElementById('score');
    const highEl = document.getElementById('highScore');
    const lenEl = document.getElementById('snakeLength');
    const speedBtns = document.querySelectorAll('.speed-btn');

    // ---- Game Constants ----
    const GRID_SIZE = 20;
    const SPEEDS = { slow: 150, normal: 100, fast: 60 };

    // ---- Colors ----
    const COLORS = {
        bg: '#12121a',
        gridDot: 'rgba(255,255,255,0.06)',
        snakeHead: '#6c5ce7',
        snakeBody: '#7c6cf0',
        snakeTail: '#9b8ff5',
        snakeGlow: 'rgba(108,92,231,0.4)',
        trailGlow: 'rgba(108,92,231,0.08)',
        food: '#ff6b6b',
        foodGlow: 'rgba(255,107,107,0.4)',
        bonus: '#feca57',
        bonusGlow: 'rgba(254,202,87,0.4)',
        eyes: '#fff',
        eyePupil: '#2d1b69',
    };

    // ---- Sound System (Web Audio API) ----
    let audioCtx;
    function getAudioCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    const SFX = {
        // Rising sweep — game start
        start() {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.35);

            // Second harmonic layer
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(600, ctx.currentTime + 0.05);
            osc2.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.3);
            gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc2.start(ctx.currentTime + 0.05);
            osc2.stop(ctx.currentTime + 0.4);
        },

        // Bright coin chime — food pickup
        pickup(isBonus) {
            const ctx = getAudioCtx();
            const baseFreq = isBonus ? 880 : 660;

            // Main tone
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);

            // Second note (octave up, delayed)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'sine';
            const note2 = isBonus ? baseFreq * 2 : baseFreq * 1.5;
            osc2.frequency.setValueAtTime(note2, ctx.currentTime + 0.08);
            gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc2.start(ctx.currentTime + 0.08);
            osc2.stop(ctx.currentTime + 0.3);

            // Bonus gets a third sparkle note
            if (isBonus) {
                const osc3 = ctx.createOscillator();
                const gain3 = ctx.createGain();
                osc3.connect(gain3);
                gain3.connect(ctx.destination);
                osc3.type = 'triangle';
                osc3.frequency.setValueAtTime(baseFreq * 3, ctx.currentTime + 0.14);
                gain3.gain.setValueAtTime(0.08, ctx.currentTime + 0.14);
                gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc3.start(ctx.currentTime + 0.14);
                osc3.stop(ctx.currentTime + 0.4);
            }
        },

        // Low rumble/buzz — collision/death
        collide() {
            const ctx = getAudioCtx();

            // Noise burst via oscillator detuning
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);

            // Sub bass hit
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(80, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.35);
            gain2.gain.setValueAtTime(0.25, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.45);
        },
    };

    // ---- State ----
    let cellSize, snake, direction, nextDirection, food, bonusFood;
    let score, highScore, speed, gameLoop, isRunning, isPaused, isGameOver;
    let bonusTimer, particles, screenShake, eatenAnimations;
    let animFrameId, lastTickTime, tickProgress;
    let prevSnake; // previous snake positions for interpolation
    let trail; // fading trail positions

    // ---- Init ----
    highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
    highEl.textContent = highScore;
    speed = 'normal';
    trail = [];

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function resizeCanvas() {
        const container = canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight);
        canvas.width = size * window.devicePixelRatio;
        canvas.height = size * window.devicePixelRatio;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        cellSize = size / GRID_SIZE;
        if (!isRunning) drawStaticGrid();
    }

    // ---- Event Listeners ----
    playBtn.addEventListener('click', startGame);

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === ' ' || key === 'enter') {
            e.preventDefault();
            if (isGameOver || !isRunning) startGame();
            return;
        }
        if (key === 'p') {
            if (isRunning && !isGameOver) togglePause();
            return;
        }
        const dirMap = {
            arrowup: 'UP', arrowdown: 'DOWN', arrowleft: 'LEFT', arrowright: 'RIGHT',
            w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
        };
        if (dirMap[key]) {
            e.preventDefault();
            setDirection(dirMap[key]);
        }
    });

    // Mobile difficulty buttons
    const mobileDiffBtns = document.querySelectorAll('.mobile-diff-btn');
    mobileDiffBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            mobileDiffBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Also sync desktop speed buttons
            speedBtns.forEach(b => b.classList.remove('active'));
            const matching = document.querySelector(`.speed-btn[data-speed="${btn.dataset.speed}"]`);
            if (matching) matching.classList.add('active');
            speed = btn.dataset.speed;
            if (isRunning && !isPaused) {
                clearInterval(gameLoop);
                gameLoop = setInterval(tick, SPEEDS[speed]);
            }
        });
    });

    // Speed buttons (also sync mobile)
    speedBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            speedBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mobileDiffBtns.forEach(b => b.classList.remove('active'));
            const matching = document.querySelector(`.mobile-diff-btn[data-speed="${btn.dataset.speed}"]`);
            if (matching) matching.classList.add('active');
            speed = btn.dataset.speed;
            if (isRunning && !isPaused) {
                clearInterval(gameLoop);
                gameLoop = setInterval(tick, SPEEDS[speed]);
            }
        });
    });

    // ---- Swipe Controls (full document, not just canvas) ----
    const swipeIndicator = document.getElementById('swipeIndicator');
    let touchStartX, touchStartY, touchStartTime;
    const SWIPE_THRESHOLD = 15; // px minimum swipe distance
    const SWIPE_MAX_TIME = 500; // ms max time for a swipe

    const dirRotations = {
        UP: 'rotate(0deg)',
        RIGHT: 'rotate(90deg)',
        DOWN: 'rotate(180deg)',
        LEFT: 'rotate(270deg)',
    };

    function showSwipeIndicator(dir) {
        if (!swipeIndicator) return;
        swipeIndicator.style.setProperty('--swipe-rotate', dirRotations[dir]);
        swipeIndicator.classList.remove('show');
        void swipeIndicator.offsetWidth; // reflow to restart animation
        swipeIndicator.classList.add('show');
    }

    document.addEventListener('touchstart', (e) => {
        // Don't capture touches on buttons/controls
        if (e.target.closest('.mobile-diff-btn, .play-btn, .speed-btn')) return;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!touchStartX || !isRunning || isPaused) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Trigger direction as soon as threshold is met (more responsive)
        if (Math.max(absDx, absDy) >= SWIPE_THRESHOLD) {
            let dir;
            if (absDx > absDy) {
                dir = dx > 0 ? 'RIGHT' : 'LEFT';
            } else {
                dir = dy > 0 ? 'DOWN' : 'UP';
            }
            setDirection(dir);
            showSwipeIndicator(dir);
            // Reset start point for continuous swiping
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchend', () => {
        touchStartX = touchStartY = null;
    }, { passive: true });

    // ---- Direction Logic ----
    function setDirection(dir) {
        if (!isRunning || isPaused) return;
        const opposites = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
        if (dir !== opposites[direction]) {
            nextDirection = dir;
        }
    }

    // ---- Start Game ----
    function startGame() {
        snake = [];
        const startX = Math.floor(GRID_SIZE / 2);
        const startY = Math.floor(GRID_SIZE / 2);
        for (let i = 0; i < 3; i++) snake.push({ x: startX - i, y: startY });

        prevSnake = snake.map(s => ({ ...s }));
        direction = 'RIGHT';
        nextDirection = 'RIGHT';
        score = 0;
        isRunning = true;
        isPaused = false;
        isGameOver = false;
        particles = [];
        eatenAnimations = [];
        trail = [];
        screenShake = 0;
        bonusFood = null;
        tickProgress = 0;
        lastTickTime = performance.now();
        clearTimeout(bonusTimer);

        updateUI();
        spawnFood();
        scheduleBonusFood();

        overlay.classList.add('hidden');
        removePauseBadge();

        SFX.start();

        clearInterval(gameLoop);
        gameLoop = setInterval(tick, SPEEDS[speed]);

        // Start continuous render loop
        cancelAnimationFrame(animFrameId);
        renderLoop();
    }

    // ---- Game Tick (logic only) ----
    function tick() {
        if (isPaused) return;

        // Save previous positions for interpolation
        prevSnake = snake.map(s => ({ ...s }));

        direction = nextDirection;
        const head = { ...snake[0] };

        switch (direction) {
            case 'UP': head.y--; break;
            case 'DOWN': head.y++; break;
            case 'LEFT': head.x--; break;
            case 'RIGHT': head.x++; break;
        }

        // Wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
            return gameOver();
        }

        // Self collision
        if (snake.some(s => s.x === head.x && s.y === head.y)) {
            return gameOver();
        }

        snake.unshift(head);

        // Add trail from tail before it moves
        if (snake.length > 1) {
            const tailPos = snake[snake.length - 1];
            trail.push({ x: tailPos.x, y: tailPos.y, life: 1.0 });
        }

        let ate = false;
        if (head.x === food.x && head.y === food.y) {
            score += 10;
            ate = true;
            SFX.pickup(false);
            spawnParticles(food.x, food.y, COLORS.food, 12);
            spawnParticles(food.x, food.y, '#ff9f9f', 6);
            eatenAnimations.push({ x: food.x, y: food.y, t: 1, color: COLORS.food });
            eatenAnimations.push({ x: food.x, y: food.y, t: 1, color: 'rgba(255,255,255,0.6)', speed: 2 });
            screenShake = 5;
            spawnFood();
        } else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
            score += 30;
            ate = true;
            SFX.pickup(true);
            spawnParticles(bonusFood.x, bonusFood.y, COLORS.bonus, 16);
            spawnParticles(bonusFood.x, bonusFood.y, '#fff', 8);
            eatenAnimations.push({ x: bonusFood.x, y: bonusFood.y, t: 1, color: COLORS.bonus });
            eatenAnimations.push({ x: bonusFood.x, y: bonusFood.y, t: 1, color: 'rgba(255,255,255,0.7)', speed: 2.5 });
            screenShake = 8;
            bonusFood = null;
        } else {
            snake.pop();
        }

        if (ate) {
            updateUI();
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('snakeHighScore', highScore);
                highEl.textContent = highScore;
            }
        }

        lastTickTime = performance.now();
        tickProgress = 0;
    }

    // ---- Continuous Render Loop ----
    function renderLoop() {
        if (!isRunning && !isGameOver) return;

        // Calculate interpolation progress between ticks
        if (!isPaused && isRunning) {
            const elapsed = performance.now() - lastTickTime;
            tickProgress = Math.min(elapsed / SPEEDS[speed], 1);
        }

        draw();
        animFrameId = requestAnimationFrame(renderLoop);
    }

    // ---- Drawing ----
    function draw() {
        const size = canvas.width / window.devicePixelRatio;
        const now = Date.now();
        ctx.save();

        // Smooth screen shake
        if (screenShake > 0) {
            const angle = Math.random() * Math.PI * 2;
            const sx = Math.cos(angle) * screenShake;
            const sy = Math.sin(angle) * screenShake;
            ctx.translate(sx, sy);
            screenShake *= 0.85;
            if (screenShake < 0.3) screenShake = 0;
        }

        // Background
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, size, size);

        // ---- Dot Grid (non-obstructive) ----
        ctx.fillStyle = COLORS.gridDot;
        for (let i = 1; i < GRID_SIZE; i++) {
            for (let j = 1; j < GRID_SIZE; j++) {
                const x = i * cellSize;
                const y = j * cellSize;
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ---- Trail (fading ghost cells) ----
        for (let i = trail.length - 1; i >= 0; i--) {
            const t = trail[i];
            t.life -= 0.035;
            if (t.life <= 0) { trail.splice(i, 1); continue; }
            const alpha = t.life * 0.15;
            ctx.globalAlpha = alpha;
            drawRoundedCell(t.x, t.y, COLORS.snakeTail, 0.55);
            ctx.globalAlpha = 1;
        }

        // ---- Eaten animations (expanding ripple rings) ----
        for (let i = eatenAnimations.length - 1; i >= 0; i--) {
            const ea = eatenAnimations[i];
            const spd = ea.speed || 1;
            ea.t -= 0.025 * spd;
            if (ea.t <= 0) { eatenAnimations.splice(i, 1); continue; }
            const cx = ea.x * cellSize + cellSize / 2;
            const cy = ea.y * cellSize + cellSize / 2;
            const radius = cellSize * (1 - ea.t) * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = ea.color;
            ctx.globalAlpha = ea.t * 0.6;
            ctx.lineWidth = 1.5 * ea.t;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // ---- Food ----
        const foodPulse = Math.sin(now / 400) * 0.06;
        const foodBob = Math.sin(now / 500) * cellSize * 0.04;
        const foodSize = 0.6 + foodPulse;

        // Soft outer glow
        drawGlow(food.x, food.y, COLORS.foodGlow, cellSize * (2 + foodPulse * 3));

        // Food body with bob
        ctx.save();
        ctx.translate(0, foodBob);
        drawRoundedCell(food.x, food.y, COLORS.food, foodSize);
        // Inner highlight
        const fCx = food.x * cellSize + cellSize / 2;
        const fCy = food.y * cellSize + cellSize / 2;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath();
        ctx.arc(fCx - cellSize * 0.08, fCy - cellSize * 0.1, cellSize * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        // ---- Bonus food ----
        if (bonusFood) {
            const bPulse = Math.sin(now / 250) * 0.08;
            const bBob = Math.sin(now / 350) * cellSize * 0.06;
            const bRotate = now / 800;

            drawGlow(bonusFood.x, bonusFood.y, COLORS.bonusGlow, cellSize * (2.5 + bPulse * 4));

            ctx.save();
            ctx.translate(0, bBob);
            drawRoundedCell(bonusFood.x, bonusFood.y, COLORS.bonus, 0.6 + bPulse);

            // Rotating star
            const bcx = bonusFood.x * cellSize + cellSize / 2;
            const bcy = bonusFood.y * cellSize + cellSize / 2;
            ctx.save();
            ctx.translate(bcx, bcy);
            ctx.rotate(bRotate);
            ctx.fillStyle = '#fff';
            ctx.font = `${cellSize * 0.4}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);
            ctx.restore();
            ctx.restore();
        }

        // ---- Snake ----
        // Draw from tail to head with interpolation
        const interpT = easeOutQuad(tickProgress);

        for (let i = snake.length - 1; i >= 0; i--) {
            const seg = snake[i];
            const prev = prevSnake[i] || seg;

            // Interpolated position
            const ix = prev.x + (seg.x - prev.x) * interpT;
            const iy = prev.y + (seg.y - prev.y) * interpT;

            // Gradient color from tail to head
            const t = i / Math.max(snake.length - 1, 1);
            const color = lerpColor(COLORS.snakeTail, COLORS.snakeHead, 1 - t);

            // Size: head is slightly bigger, tail tapers
            const sizeFactor = i === 0 ? 0.78 : (0.72 - t * 0.08);

            // Subtle shadow under each segment
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#000';
            drawRoundedCellAt(ix * cellSize + 1.5, iy * cellSize + 1.5, cellSize, color, sizeFactor);
            ctx.globalAlpha = 1;

            // Actual segment
            drawRoundedCellAt(ix * cellSize, iy * cellSize, cellSize, color, sizeFactor);

            // Segment connector (fill gaps between segments)
            if (i < snake.length - 1) {
                const next = snake[i + 1];
                const prevNext = prevSnake[i + 1] || next;
                const nx = prevNext.x + (next.x - prevNext.x) * interpT;
                const ny = prevNext.y + (next.y - prevNext.y) * interpT;

                const midX = (ix + nx) / 2;
                const midY = (iy + ny) / 2;
                const connSize = sizeFactor * 0.55;
                ctx.fillStyle = color;
                const cpad = cellSize * (1 - connSize) / 2;
                ctx.fillRect(midX * cellSize + cpad, midY * cellSize + cpad, cellSize * connSize, cellSize * connSize);
            }
        }

        // Snake head glow (interpolated)
        const headPrev = prevSnake[0] || snake[0];
        const headIx = headPrev.x + (snake[0].x - headPrev.x) * interpT;
        const headIy = headPrev.y + (snake[0].y - headPrev.y) * interpT;
        drawGlowAt(headIx * cellSize + cellSize / 2, headIy * cellSize + cellSize / 2, COLORS.snakeGlow, cellSize * 1.6);

        // Eyes on head (interpolated)
        drawEyesAt(headIx, headIy);

        // ---- Particles ----
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            p.vy += 0.06; // softer gravity
            p.vx *= 0.98; // air resistance
            if (p.life <= 0) { particles.splice(i, 1); continue; }

            ctx.globalAlpha = p.life * p.life; // quadratic fade for smoother look
            ctx.fillStyle = p.color;

            if (p.shape === 'square') {
                const s = p.size * p.life;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation + p.life * 4);
                ctx.fillRect(-s / 2, -s / 2, s, s);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    function drawStaticGrid() {
        const size = canvas.width / window.devicePixelRatio;
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = COLORS.gridDot;
        for (let i = 1; i < GRID_SIZE; i++) {
            for (let j = 1; j < GRID_SIZE; j++) {
                ctx.beginPath();
                ctx.arc(i * cellSize, j * cellSize, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Draw rounded cell at grid coordinates
    function drawRoundedCell(gx, gy, color, sizeFactor) {
        drawRoundedCellAt(gx * cellSize, gy * cellSize, cellSize, color, sizeFactor);
    }

    // Draw rounded cell at pixel coordinates
    function drawRoundedCellAt(px, py, cs, color, sizeFactor) {
        const pad = cs * (1 - sizeFactor) / 2;
        const x = px + pad;
        const y = py + pad;
        const s = cs * sizeFactor;
        const r = s * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + s - r, y);
        ctx.quadraticCurveTo(x + s, y, x + s, y + r);
        ctx.lineTo(x + s, y + s - r);
        ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
        ctx.lineTo(x + r, y + s);
        ctx.quadraticCurveTo(x, y + s, x, y + s - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }

    function drawGlow(gx, gy, color, radius) {
        drawGlowAt(gx * cellSize + cellSize / 2, gy * cellSize + cellSize / 2, color, radius);
    }

    function drawGlowAt(cx, cy, color, radius) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }

    function drawEyesAt(gx, gy) {
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        const eyeR = cellSize * 0.11;
        const pupilR = cellSize * 0.055;
        const offset = cellSize * 0.18;
        let e1, e2;
        switch (direction) {
            case 'UP':
                e1 = { x: cx - offset, y: cy - offset };
                e2 = { x: cx + offset, y: cy - offset };
                break;
            case 'DOWN':
                e1 = { x: cx - offset, y: cy + offset };
                e2 = { x: cx + offset, y: cy + offset };
                break;
            case 'LEFT':
                e1 = { x: cx - offset, y: cy - offset };
                e2 = { x: cx - offset, y: cy + offset };
                break;
            case 'RIGHT':
                e1 = { x: cx + offset, y: cy - offset };
                e2 = { x: cx + offset, y: cy + offset };
                break;
        }
        // White of eye
        ctx.fillStyle = COLORS.eyes;
        ctx.beginPath(); ctx.arc(e1.x, e1.y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x, e2.y, eyeR, 0, Math.PI * 2); ctx.fill();
        // Pupils
        ctx.fillStyle = COLORS.eyePupil;
        ctx.beginPath(); ctx.arc(e1.x, e1.y, pupilR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x, e2.y, pupilR, 0, Math.PI * 2); ctx.fill();
    }

    // ---- Particles ----
    function spawnParticles(gx, gy, color, count) {
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 1.5 + Math.random() * 3.5;
            const shape = Math.random() > 0.5 ? 'circle' : 'square';
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 1.5,
                size: 1.5 + Math.random() * 3,
                life: 1,
                color,
                shape,
                rotation: Math.random() * Math.PI * 2,
            });
        }
    }

    // ---- Food ----
    function spawnFood() {
        let pos;
        do {
            pos = { x: rand(GRID_SIZE), y: rand(GRID_SIZE) };
        } while (isOccupied(pos));
        food = pos;
    }

    function scheduleBonusFood() {
        bonusTimer = setTimeout(() => {
            if (!isRunning || isGameOver) return;
            let pos;
            do {
                pos = { x: rand(GRID_SIZE), y: rand(GRID_SIZE) };
            } while (isOccupied(pos) || (food.x === pos.x && food.y === pos.y));
            bonusFood = pos;
            setTimeout(() => { bonusFood = null; }, 5000);
            scheduleBonusFood();
        }, 10000 + Math.random() * 10000);
    }

    function isOccupied(pos) {
        return snake.some(s => s.x === pos.x && s.y === pos.y);
    }

    // ---- Pause ----
    function togglePause() {
        isPaused = !isPaused;
        if (isPaused) {
            showPauseBadge();
        } else {
            removePauseBadge();
            lastTickTime = performance.now(); // reset interpolation
        }
    }

    function showPauseBadge() {
        let badge = document.querySelector('.pause-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'pause-badge';
            badge.textContent = 'PAUSED';
            canvas.parentElement.appendChild(badge);
        }
        badge.classList.add('show');
    }

    function removePauseBadge() {
        const badge = document.querySelector('.pause-badge');
        if (badge) badge.classList.remove('show');
    }

    // ---- Game Over ----
    function gameOver() {
        isGameOver = true;
        isRunning = false;
        clearInterval(gameLoop);
        clearTimeout(bonusTimer);

        // Death burst particles from head
        SFX.collide();
        spawnParticles(snake[0].x, snake[0].y, '#ff4757', 20);
        spawnParticles(snake[0].x, snake[0].y, '#fff', 10);
        screenShake = 12;

        // Keep rendering for death animation
        setTimeout(() => {
            cancelAnimationFrame(animFrameId);
            overlayIcon.textContent = '💀';
            overlayTitle.textContent = 'Game Over';
            overlayMessage.textContent = `Score: ${score} · Length: ${snake.length}`;
            playBtn.querySelector('span').textContent = 'PLAY AGAIN';
            overlay.classList.remove('hidden');
        }, 600);
    }

    // ---- UI ----
    function updateUI() {
        animateValue(scoreEl, score);
        lenEl.textContent = snake.length;
    }

    function animateValue(el, value) {
        el.textContent = value;
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
    }

    // ---- Helpers ----
    function rand(max) {
        return Math.floor(Math.random() * max);
    }

    function easeOutQuad(t) {
        return t * (2 - t);
    }

    function lerpColor(a, b, t) {
        const parse = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
        const [ar, ag, ab] = parse(a);
        const [br, bg, bb] = parse(b);
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const bv = Math.round(ab + (bb - ab) * t);
        return `rgb(${r},${g},${bv})`;
    }

})();
