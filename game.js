// ============================================
// Snake Game – Full Game Engine
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
    const GRID_SIZE = 20;             // cells per row/col
    const SPEEDS = { slow: 150, normal: 100, fast: 60 };

    // ---- Colors ----
    const COLORS = {
        bg: '#12121a',
        gridLine: 'rgba(255,255,255,0.02)',
        snakeHead: '#6c5ce7',
        snakeBody: '#7c6cf0',
        snakeTail: '#9b8ff5',
        snakeGlow: 'rgba(108,92,231,0.35)',
        food: '#ff6b6b',
        foodGlow: 'rgba(255,107,107,0.45)',
        bonus: '#feca57',
        bonusGlow: 'rgba(254,202,87,0.45)',
        eyes: '#fff',
    };

    // ---- State ----
    let cellSize, snake, direction, nextDirection, food, bonusFood;
    let score, highScore, speed, gameLoop, isRunning, isPaused, isGameOver;
    let bonusTimer, particles, screenShake, eatenAnimations;

    // ---- Init ----
    highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
    highEl.textContent = highScore;
    speed = 'normal';

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

    // Mobile d-pad
    const dpadMap = { btnUp: 'UP', btnDown: 'DOWN', btnLeft: 'LEFT', btnRight: 'RIGHT' };
    Object.entries(dpadMap).forEach(([id, dir]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); setDirection(dir); });
            btn.addEventListener('click', () => setDirection(dir));
        }
    });

    // Speed buttons
    speedBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            speedBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            speed = btn.dataset.speed;
            if (isRunning && !isPaused) {
                clearInterval(gameLoop);
                gameLoop = setInterval(tick, SPEEDS[speed]);
            }
        });
    });

    // Touch swipe support
    let touchStartX, touchStartY;
    canvas.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        if (!touchStartX) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < 20) return; // too small
        if (absDx > absDy) {
            setDirection(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
            setDirection(dy > 0 ? 'DOWN' : 'UP');
        }
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

        direction = 'RIGHT';
        nextDirection = 'RIGHT';
        score = 0;
        isRunning = true;
        isPaused = false;
        isGameOver = false;
        particles = [];
        eatenAnimations = [];
        screenShake = 0;
        bonusFood = null;
        clearTimeout(bonusTimer);

        updateUI();
        spawnFood();
        scheduleBonusFood();

        overlay.classList.add('hidden');
        removePauseBadge();

        clearInterval(gameLoop);
        gameLoop = setInterval(tick, SPEEDS[speed]);
    }

    // ---- Game Tick ----
    function tick() {
        if (isPaused) return;

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

        let ate = false;
        // Food collision
        if (head.x === food.x && head.y === food.y) {
            score += 10;
            ate = true;
            spawnParticles(food.x, food.y, COLORS.food, 8);
            eatenAnimations.push({ x: food.x, y: food.y, t: 1, color: COLORS.food });
            screenShake = 4;
            spawnFood();
        }
        // Bonus food
        else if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
            score += 30;
            ate = true;
            spawnParticles(bonusFood.x, bonusFood.y, COLORS.bonus, 12);
            eatenAnimations.push({ x: bonusFood.x, y: bonusFood.y, t: 1, color: COLORS.bonus });
            screenShake = 6;
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

        draw();
    }

    // ---- Drawing ----
    function draw() {
        const size = canvas.width / window.devicePixelRatio;
        ctx.save();

        // Screen shake
        if (screenShake > 0) {
            const sx = (Math.random() - 0.5) * screenShake;
            const sy = (Math.random() - 0.5) * screenShake;
            ctx.translate(sx, sy);
            screenShake *= 0.7;
            if (screenShake < 0.5) screenShake = 0;
        }

        // Background
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, size, size);

        // Grid
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 0.5;
        for (let i = 1; i < GRID_SIZE; i++) {
            const pos = i * cellSize;
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(size, pos);
            ctx.stroke();
        }

        // Eaten animations (ripple)
        for (let i = eatenAnimations.length - 1; i >= 0; i--) {
            const ea = eatenAnimations[i];
            ea.t -= 0.04;
            if (ea.t <= 0) { eatenAnimations.splice(i, 1); continue; }
            const cx = ea.x * cellSize + cellSize / 2;
            const cy = ea.y * cellSize + cellSize / 2;
            const radius = cellSize * (1 - ea.t) * 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = ea.color;
            ctx.globalAlpha = ea.t * 0.5;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Food glow
        drawGlow(food.x, food.y, COLORS.foodGlow, cellSize * 1.8);

        // Food
        drawRoundedCell(food.x, food.y, COLORS.food, 0.7);

        // Bonus food
        if (bonusFood) {
            drawGlow(bonusFood.x, bonusFood.y, COLORS.bonusGlow, cellSize * 2.2);
            const pulse = 0.65 + Math.sin(Date.now() / 200) * 0.08;
            drawRoundedCell(bonusFood.x, bonusFood.y, COLORS.bonus, pulse);
            // star shape indicator
            const bcx = bonusFood.x * cellSize + cellSize / 2;
            const bcy = bonusFood.y * cellSize + cellSize / 2;
            ctx.fillStyle = '#fff';
            ctx.font = `${cellSize * 0.5}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', bcx, bcy);
        }

        // Snake body (from tail to head)
        for (let i = snake.length - 1; i >= 0; i--) {
            const seg = snake[i];
            const t = i / Math.max(snake.length - 1, 1);
            const color = lerpColor(COLORS.snakeTail, COLORS.snakeHead, 1 - t);
            const padding = i === 0 ? 0.75 : 0.68;
            drawRoundedCell(seg.x, seg.y, color, padding);
        }

        // Snake head glow
        drawGlow(snake[0].x, snake[0].y, COLORS.snakeGlow, cellSize * 1.5);

        // Eyes on head
        drawEyes(snake[0]);

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
            p.vy += 0.08; // gravity
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // Continue animating particles even between ticks
        if (particles.length || eatenAnimations.length || screenShake > 0) {
            requestAnimationFrame(draw);
        }
    }

    function drawStaticGrid() {
        const size = canvas.width / window.devicePixelRatio;
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 0.5;
        for (let i = 1; i < GRID_SIZE; i++) {
            const pos = i * cellSize;
            ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, size); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(size, pos); ctx.stroke();
        }
    }

    function drawRoundedCell(gx, gy, color, sizeFactor) {
        const pad = cellSize * (1 - sizeFactor) / 2;
        const x = gx * cellSize + pad;
        const y = gy * cellSize + pad;
        const s = cellSize * sizeFactor;
        const r = s * 0.3;
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
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }

    function drawEyes(head) {
        const cx = head.x * cellSize + cellSize / 2;
        const cy = head.y * cellSize + cellSize / 2;
        const eyeR = cellSize * 0.1;
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
        ctx.fillStyle = COLORS.eyes;
        ctx.beginPath(); ctx.arc(e1.x, e1.y, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x, e2.y, eyeR, 0, Math.PI * 2); ctx.fill();
    }

    // ---- Particles ----
    function spawnParticles(gx, gy, color, count) {
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                size: 2 + Math.random() * 3,
                life: 1,
                color,
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
            // Remove bonus after 5 seconds
            setTimeout(() => { bonusFood = null; if (isRunning) draw(); }, 5000);
            // Schedule next
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

        // Flash effect
        screenShake = 10;
        draw();

        setTimeout(() => {
            overlayIcon.textContent = '💀';
            overlayTitle.textContent = 'Game Over';
            overlayMessage.textContent = `Score: ${score} · Length: ${snake.length}`;
            playBtn.querySelector('span').textContent = 'PLAY AGAIN';
            overlay.classList.remove('hidden');
        }, 400);
    }

    // ---- UI ----
    function updateUI() {
        animateValue(scoreEl, score);
        lenEl.textContent = snake.length;
    }

    function animateValue(el, value) {
        el.textContent = value;
        el.classList.remove('pop');
        void el.offsetWidth; // reflow
        el.classList.add('pop');
    }

    // ---- Helpers ----
    function rand(max) {
        return Math.floor(Math.random() * max);
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
