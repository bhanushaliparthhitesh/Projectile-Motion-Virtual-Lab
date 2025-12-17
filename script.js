document.addEventListener('DOMContentLoaded', () => {
    // --- JAVASCRIPT LOGIC ---

    // 1. Setup & Constants
    const canvas = document.getElementById('simCanvas');
    const ctx = canvas.getContext('2d');

    // Default size
    canvas.width = 1200;
    canvas.height = 700;

    // Coordinate System Config
    const PADDING_LEFT = 60;
    const PADDING_BOTTOM = 60;
    const CANVAS_GROUND_Y = canvas.height - PADDING_BOTTOM;

    // Scale Factor
    let pixelsPerMeter = 4;
    let targetScale = 4;

    // DOM Elements - Sliders
    const angleInput = document.getElementById('angle');
    const velocityInput = document.getElementById('velocity');
    const gravityInput = document.getElementById('gravity');
    const heightInput = document.getElementById('height');

    // DOM Elements - Manual Inputs
    const angleNum = document.getElementById('angleNum');
    const velocityNum = document.getElementById('velocityNum');
    const gravityNum = document.getElementById('gravityNum');
    const heightNum = document.getElementById('heightNum');

    const timeStat = document.getElementById('timeStat');
    const heightStat = document.getElementById('heightStat');
    const rangeStat = document.getElementById('rangeStat');

    // Equation Elements
    const eqY = document.getElementById('eq-y');
    const eqVy = document.getElementById('eq-vy');
    const eqG = document.getElementById('eq-g');
    const eqVx = document.getElementById('eq-vx');

    const launchBtn = document.getElementById('launchBtn');
    const resetBtn = document.getElementById('resetBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stepBtn = document.getElementById('stepBtn');
    const launchText = document.getElementById('launchText');

    const showPredictionCheck = document.getElementById('showPrediction');
    const showVectorsCheck = document.getElementById('showVectors');

    // State Variables
    let isAnimating = false;
    let isPaused = false;
    let animationId = null;
    let accumulatedTime = 0;
    let lastFrameTime = 0;

    // Physics Inputs
    let v0, angleDeg, angleRad, g, h0;
    let vx, vy;         // Initial components
    let currentVx, currentVy; // Live components

    // Calculated Totals
    let totalFlightTime = 0;
    let maxAltitude = 0; // Relative to ground
    let maxRange = 0;

    // Trajectory History
    let path = [];
    let currentX = 0;
    let currentY = 0; // Relative to launch height (will adjust for h0)

    // 2. Logic Functions

    function calculateValues() {
        // Read from Slider (Primary Source for Physics)
        // But Slider and Number Input are synced
        v0 = parseFloat(velocityInput.value);
        angleDeg = parseFloat(angleInput.value);
        g = parseFloat(gravityInput.value);
        h0 = parseFloat(heightInput.value);
        angleRad = angleDeg * (Math.PI / 180);

        vx = v0 * Math.cos(angleRad);
        vy = v0 * Math.sin(angleRad);
    }

    function calculateTrajectoryStats() {
        calculateValues();

        // 1. Time of Flight (Quadratic if h0 > 0)
        // y(t) = h0 + vy*t - 0.5*g*t^2 = 0 (Impact)
        // 0.5*g*t^2 - vy*t - h0 = 0

        const a = 0.5 * g;
        const b = -vy;
        const c = -h0;

        // t = (-b ± sqrt(b^2 - 4ac)) / 2a
        const discriminator = Math.sqrt(b * b - 4 * a * c);
        const t1 = (-b + discriminator) / (2 * a);
        const t2 = (-b - discriminator) / (2 * a);

        // We want positive time
        totalFlightTime = Math.max(t1, t2);
        if (isNaN(totalFlightTime)) totalFlightTime = 0;

        // 2. Max Height
        const t_peak = vy / g;
        if (t_peak > 0) {
            maxAltitude = h0 + (vy * t_peak) - (0.5 * g * t_peak * t_peak);
        } else {
            maxAltitude = h0;
        }

        // 3. Range
        maxRange = vx * totalFlightTime;

        return { maxAltitude, maxRange, totalFlightTime };
    }

    function autoZoom(maxH, range) {
        const availWidth = canvas.width - PADDING_LEFT - 100;
        const availHeight = canvas.height - PADDING_BOTTOM - 100;

        const safeRange = Math.max(range, h0 + 5, 20);
        const scaleX = availWidth / safeRange;

        const safeH = Math.max(maxH, 10);
        const scaleY = availHeight / safeH;

        let newScale = Math.min(scaleX, scaleY);
        newScale = Math.min(newScale, 10);
        newScale = Math.max(newScale, 0.5);

        targetScale = newScale;
    }

    function updateScale() {
        if (Math.abs(pixelsPerMeter - targetScale) > 0.01) {
            pixelsPerMeter += (targetScale - pixelsPerMeter) * 0.1;
        }
    }

    // 3. Drawing Functions

    // Helper: Draw Arrow
    function drawArrow(fromX, fromY, vecX, vecY, color) {
        if (Math.abs(vecX) < 1 && Math.abs(vecY) < 1) return;

        if (Math.abs(vecX) < 1 && Math.abs(vecY) < 1) return;

        const headW = 8;  // Head width
        const headL = 12; // Head length
        const shaftW = 3; // Shaft width

        const angle = Math.atan2(vecY, vecX);
        const dist = Math.sqrt(vecX * vecX + vecY * vecY);

        ctx.save();
        ctx.translate(fromX, fromY);
        ctx.rotate(angle); // Rotate to arrow direction

        // Shadow for depth
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = color;
        // Draw Filled Arrow Shape
        ctx.beginPath();
        // Start at tail center (0,0) -> top tail -> shaft start -> head base -> tip -> head base -> shaft -> bot tail
        ctx.moveTo(0, -shaftW / 2);
        ctx.lineTo(dist - headL, -shaftW / 2);
        ctx.lineTo(dist - headL, -headW);
        ctx.lineTo(dist, 0); // Tip
        ctx.lineTo(dist - headL, headW);
        ctx.lineTo(dist - headL, shaftW / 2);
        ctx.lineTo(0, shaftW / 2);
        ctx.closePath();

        ctx.globalAlpha = 0.9; // Slight transparency
        ctx.fill();

        ctx.restore();
    }

    function drawCannon(scale) {
        const launchY = CANVAS_GROUND_Y - (h0 * scale);

        ctx.save();
        ctx.translate(PADDING_LEFT, launchY);
        ctx.rotate(-angleRad); // Rotate UP

        const length = 2 * scale;
        const width = 0.5 * scale;

        // Draw Barrel
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.rect(0, -width / 2, length, width);
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        // Draw Platform / Stand if h0 > 0
        if (h0 > 0) {
            ctx.save();
            ctx.strokeStyle = "#475569";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(PADDING_LEFT, CANVAS_GROUND_Y);
            ctx.lineTo(PADDING_LEFT, launchY);
            ctx.stroke();

            // Base
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(PADDING_LEFT - 10, CANVAS_GROUND_Y - 4, 20, 4);
            ctx.restore();
        }

        // Draw Pivot
        ctx.save();
        ctx.translate(PADDING_LEFT, launchY);
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(0, 0, 0.4 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawMarkers(stats) {
        // Peak Marker
        const t_peak = vy / g;
        if (t_peak > 0 && t_peak < totalFlightTime) {
            const peakX = vx * t_peak;
            const peakY = h0 + (vy * t_peak) - (0.5 * g * t_peak * t_peak);

            const sx = PADDING_LEFT + (peakX * pixelsPerMeter);
            const sy = CANVAS_GROUND_Y - (peakY * pixelsPerMeter);

            ctx.fillStyle = "#0ea5e9";
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0284c7";
            ctx.font = "bold 12px Inter";
            ctx.textAlign = "center";
            ctx.fillText("Max H", sx, sy - 10);
            ctx.fillText(peakY.toFixed(1) + "m", sx, sy - 22);
        }

        // Landing Marker
        if (totalFlightTime > 0) {
            const range = vx * totalFlightTime;
            const sx = PADDING_LEFT + (range * pixelsPerMeter);
            const sy = CANVAS_GROUND_Y; // Ground

            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.textAlign = "center";
            ctx.fillText("Impact", sx, sy + 15);
            ctx.fillText(range.toFixed(1) + "m", sx, sy + 27);
        }
    }

    function drawPrediction() {
        if (!showPredictionCheck.checked) return;

        ctx.save();
        ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();

        // Start at h0
        const startY = CANVAS_GROUND_Y - (h0 * pixelsPerMeter);
        ctx.moveTo(PADDING_LEFT, startY);

        let t = 0;
        const dt = 0.1;
        let px, py;

        while (true) {
            t += dt;
            px = vx * t;
            py = h0 + (vy * t) - (0.5 * g * t * t);

            if (py < 0) break;

            const sx = PADDING_LEFT + (px * pixelsPerMeter);
            const sy = CANVAS_GROUND_Y - (py * pixelsPerMeter);
            ctx.lineTo(sx, sy);

            if (px * pixelsPerMeter > canvas.width + 1000) break;
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawVectors(posX, posY, v_x, v_y) {
        if (!showVectorsCheck.checked) return;

        const screenX = PADDING_LEFT + (posX * pixelsPerMeter);
        const screenY = CANVAS_GROUND_Y - (posY * pixelsPerMeter);

        const vScale = 3;
        const aScale = 20;

        drawArrow(screenX, screenY, v_x * vScale, -v_y * vScale, "#22c55e");
        drawArrow(screenX, screenY, 0, g * aScale, "#f97316");
    }

    function drawCoordinateSystem() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        updateScale();

        // Ground Line
        ctx.beginPath();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.moveTo(0, CANVAS_GROUND_Y);
        ctx.lineTo(canvas.width, CANVAS_GROUND_Y);
        ctx.stroke();

        // Y-Axis
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.moveTo(PADDING_LEFT, CANVAS_GROUND_Y);
        ctx.lineTo(PADDING_LEFT, 0);
        ctx.stroke();

        // Grid & Markers
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";

        // Horizontal (X) Markers
        let step = 10;
        if (pixelsPerMeter < 1) step = 50;

        const maxVisibleMetersX = (canvas.width - PADDING_LEFT) / pixelsPerMeter;
        for (let m = 0; m <= maxVisibleMetersX; m += step) {
            const x = PADDING_LEFT + (m * pixelsPerMeter);
            ctx.beginPath();
            ctx.fillStyle = "#94a3b8";
            ctx.arc(x, CANVAS_GROUND_Y, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#64748b";
            ctx.fillText(m, x, CANVAS_GROUND_Y + 20);

            ctx.beginPath();
            ctx.strokeStyle = "rgba(203, 213, 225, 0.3)";
            ctx.moveTo(x, CANVAS_GROUND_Y);
            ctx.lineTo(x, 0);
            ctx.stroke();
        }

        // Vertical (Y) Markers
        const maxVisibleMetersY = CANVAS_GROUND_Y / pixelsPerMeter;
        for (let m = 0; m <= maxVisibleMetersY; m += step) {
            if (m === 0) continue;
            const y = CANVAS_GROUND_Y - (m * pixelsPerMeter);
            ctx.beginPath();
            ctx.fillStyle = "#94a3b8";
            ctx.arc(PADDING_LEFT, y, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#64748b";
            ctx.textAlign = "right";
            ctx.fillText(m, PADDING_LEFT - 10, y + 4);

            ctx.beginPath();
            ctx.strokeStyle = "rgba(203, 213, 225, 0.3)";
            ctx.moveTo(PADDING_LEFT, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Axis Labels
        ctx.save();
        ctx.font = "bold 14px Inter";
        ctx.fillStyle = "#1e293b";
        ctx.fillText("Distance (m)", canvas.width / 2, CANVAS_GROUND_Y + 45);

        ctx.translate(20, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("Height (m)", 0, 0);
        ctx.restore();
    }

    function drawScene(cx, cy) {
        drawCoordinateSystem();

        const stats = calculateTrajectoryStats();
        if (!isAnimating) {
            drawMarkers(stats);
        }

        drawPrediction();
        drawCannon(pixelsPerMeter);

        if (path.length > 0) {
            ctx.strokeStyle = "#0284c7";
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();

            const startY = CANVAS_GROUND_Y - (path[0].y * pixelsPerMeter);
            ctx.moveTo(PADDING_LEFT + (path[0].x * pixelsPerMeter), startY);

            path.forEach(pt => {
                const screenX = PADDING_LEFT + (pt.x * pixelsPerMeter);
                const screenY = CANVAS_GROUND_Y - (pt.y * pixelsPerMeter);
                ctx.lineTo(screenX, screenY);
            });
            ctx.stroke();
            ctx.setLineDash([]);

            if (!isAnimating && path.length > 2) {
                drawMarkers(stats);
            }
        }

        if (cx !== undefined) {
            const screenX = PADDING_LEFT + (cx * pixelsPerMeter);
            const screenY = CANVAS_GROUND_Y - (cy * pixelsPerMeter);

            // Premium 3D Object Styling
            const radius = 8; // Slightly larger

            // 1. Soft Drop Shadow
            ctx.shadowBlur = 10;
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowOffsetY = 4;

            // 2. Radial Gradient (3D Sphere Effect)
            const gradient = ctx.createRadialGradient(
                screenX - 2, screenY - 2, 1,   // Inner circle (Highlight)
                screenX, screenY, radius       // Outer circle
            );

            // Metallic/Glossy Blue Theme
            gradient.addColorStop(0, "#cbd5e1"); // Highlight
            gradient.addColorStop(0.3, "#0ea5e9"); // Base Blue 
            gradient.addColorStop(1, "#0369a1");   // Darker Edge

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Reset Shadow
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            let instantVy = vy - (g * accumulatedTime);
            drawVectors(cx, cy, vx, instantVy);
        }
    }

    function animate(timestamp) {
        if (!isAnimating) return;

        if (!lastFrameTime) lastFrameTime = timestamp;
        const dt = (timestamp - lastFrameTime) / 1000;
        lastFrameTime = timestamp;

        if (!isPaused) {
            accumulatedTime += dt;

            currentX = vx * accumulatedTime;
            currentY = h0 + (vy * accumulatedTime) - (0.5 * g * accumulatedTime * accumulatedTime);

            timeStat.textContent = accumulatedTime.toFixed(2) + " s";

            if (currentY < 0) {
                currentY = 0;
                isAnimating = false;
                togglePlaybackUI(false);

                const stats = calculateTrajectoryStats(); // Get exact flight time
                timeStat.textContent = stats.totalFlightTime.toFixed(2) + " s";
                currentX = vx * stats.totalFlightTime;

                path.push({ x: currentX, y: 0 });
                drawScene(currentX, currentY);
                return;
            }

            path.push({ x: currentX, y: currentY });
        }

        drawScene(currentX, currentY);
        animationId = requestAnimationFrame(animate);
    }

    // --- Input Locking Helper ---
    function toggleInputs(disabled) {
        // Sliders
        if (angleInput) angleInput.disabled = disabled;
        if (velocityInput) velocityInput.disabled = disabled;
        if (gravityInput) gravityInput.disabled = disabled;
        if (heightInput) heightInput.disabled = disabled;

        // Manual Inputs
        if (angleNum) angleNum.disabled = disabled;
        if (velocityNum) velocityNum.disabled = disabled;
        if (gravityNum) gravityNum.disabled = disabled;
        if (heightNum) heightNum.disabled = disabled;

        // Checkboxes
        if (showPredictionCheck) showPredictionCheck.disabled = disabled;
        if (showVectorsCheck) showVectorsCheck.disabled = disabled;

        // Add visual feedback class to sidebar if needed (optional)
        const sidebar = document.querySelector('.controls-section');
        if (sidebar) {
            if (disabled) sidebar.style.opacity = '0.7';
            else sidebar.style.opacity = '1';
        }
    }

    function togglePlaybackUI(isPlaying) {
        if (isPlaying) {
            launchText.textContent = "Restart";
            pauseBtn.disabled = false;
            stepBtn.disabled = false;
            launchBtn.onclick = launch;
        } else {
            launchText.textContent = "Launch";
            pauseBtn.disabled = true;
            stepBtn.disabled = true;
            // Reset to pause icon (Premium Filled)
            pauseBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>';
        }
    }

    function launch() {
        isAnimating = false;
        cancelAnimationFrame(animationId);

        // Lock Inputs
        toggleInputs(true);

        const stats = calculateTrajectoryStats();
        heightStat.textContent = stats.maxAltitude.toFixed(2) + " m";
        rangeStat.textContent = stats.maxRange.toFixed(2) + " m";

        autoZoom(stats.maxAltitude, stats.maxRange);

        path = [];
        path.push({ x: 0, y: h0 });
        accumulatedTime = 0;
        currentX = 0;
        currentY = h0;

        isAnimating = true;
        isPaused = false;
        lastFrameTime = 0;

        togglePlaybackUI(true);

        animationId = requestAnimationFrame(animate);
    }

    function togglePause() {
        if (!isAnimating) return;
        isPaused = !isPaused;

        if (isPaused) {
            // Play Icon (Premium Filled)
            pauseBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5.5 3.5a1.5 1.5 0 0 1 2.224-1.312l13 7a1.5 1.5 0 0 1 0 2.624l-13 7A1.5 1.5 0 0 1 5.5 17.5v-14z"></path></svg>';
        } else {
            // Pause Icon (Premium Filled)
            pauseBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>';
            lastFrameTime = performance.now();
        }
    }

    function stepForward() {
        if (!isAnimating) return;
        if (!isPaused) {
            togglePause();
        }

        const dt = 0.05;
        accumulatedTime += dt;

        currentX = vx * accumulatedTime;
        currentY = h0 + (vy * accumulatedTime) - (0.5 * g * accumulatedTime * accumulatedTime);

        timeStat.textContent = accumulatedTime.toFixed(2) + " s";

        if (currentY < 0) {
            currentY = 0;
            isAnimating = false;

            // Do NOT unlock inputs here, wait for Reset
            togglePlaybackUI(false);
        } else {
            path.push({ x: currentX, y: currentY });
        }

        drawScene(currentX, currentY);
    }

    function reset() {
        isAnimating = false;
        cancelAnimationFrame(animationId);
        path = [];
        accumulatedTime = 0;

        // Unlock Inputs
        toggleInputs(false);
        togglePlaybackUI(false);

        timeStat.textContent = "0.00 s";
        heightStat.textContent = "0.00 m";
        rangeStat.textContent = "0.00 m";

        const stats = calculateTrajectoryStats();
        drawScene(0, h0);
    }

    function updateEquationPanel() {
        if (eqY) {
            eqY.textContent = h0.toFixed(1);
            eqVy.textContent = vy.toFixed(1);
            eqG.textContent = g.toFixed(1);
            eqVx.textContent = vx.toFixed(1);
        }
    }

    // --- Inputs Handling ---
    // 1. Update from Slider -> Input
    function updateValuesFromSlider() {
        if (angleNum) angleNum.value = angleInput.value;
        if (velocityNum) velocityNum.value = velocityInput.value;
        if (gravityNum) gravityNum.value = parseFloat(gravityInput.value).toFixed(1);
        if (heightNum) heightNum.value = heightInput.value;

        updateSimulation();
    }

    // 2. Update from Input -> Slider
    function updateValuesFromInput(e) {
        const input = e.target;
        const val = parseFloat(input.value);

        if (input.id === 'angleNum') {
            angleInput.value = Math.min(Math.max(val, 0), 90);
        } else if (input.id === 'velocityNum') {
            velocityInput.value = Math.min(Math.max(val, 5), 100);
        } else if (input.id === 'gravityNum') {
            gravityInput.value = Math.min(Math.max(val, 1), 20);
        } else if (input.id === 'heightNum') {
            heightInput.value = Math.min(Math.max(val, 0), 100);
        }

        updateSimulation();
    }

    function updateSimulation() {
        calculateValues();
        updateEquationPanel();

        if (!isAnimating) {
            calculateTrajectoryStats();
            drawScene(0, h0);
        }
    }

    // Listeners
    if (angleInput) {
        // Sliders
        angleInput.addEventListener('input', updateValuesFromSlider);
        velocityInput.addEventListener('input', updateValuesFromSlider);
        gravityInput.addEventListener('input', updateValuesFromSlider);
        heightInput.addEventListener('input', updateValuesFromSlider);

        // Manual Inputs
        if (angleNum) angleNum.addEventListener('input', updateValuesFromInput);
        if (velocityNum) velocityNum.addEventListener('input', updateValuesFromInput);
        if (gravityNum) gravityNum.addEventListener('input', updateValuesFromInput);
        if (heightNum) heightNum.addEventListener('input', updateValuesFromInput);

        showPredictionCheck.addEventListener('change', () => drawScene(isAnimating ? currentX : 0, isAnimating ? currentY : h0));
        showVectorsCheck.addEventListener('change', () => drawScene(isAnimating ? currentX : 0, isAnimating ? currentY : h0));
    }

    if (launchBtn) launchBtn.addEventListener('click', launch);
    if (resetBtn) resetBtn.addEventListener('click', reset);
    if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
    if (stepBtn) stepBtn.addEventListener('click', stepForward);

    // Initial Draw
    updateValuesFromSlider();
});
