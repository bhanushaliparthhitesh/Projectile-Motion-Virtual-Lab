document.addEventListener('DOMContentLoaded', () => {
    // --- JAVASCRIPT LOGIC ---

    // 1. Setup & Constants
    const canvas = document.getElementById('simCanvas');
    const ctx = canvas.getContext('2d');

    // Default size
    canvas.width = 1000;
    canvas.height = 600;

    // Coordinate System Config
    const PADDING_LEFT = 80;
    const PADDING_BOTTOM = 80;
    const GROUND_Y = canvas.height - PADDING_BOTTOM;

    // Initial Scale Factor (4px per meter)
    let pixelsPerMeter = 4;
    let targetScale = 4;

    // DOM Elements
    const angleInput = document.getElementById('angle');
    const velocityInput = document.getElementById('velocity');
    const gravityInput = document.getElementById('gravity');
    const angleVal = document.getElementById('angleValue');
    const velocityVal = document.getElementById('velocityValue');
    const gravityVal = document.getElementById('gravityValue');

    const timeStat = document.getElementById('timeStat');
    const heightStat = document.getElementById('heightStat');
    const rangeStat = document.getElementById('rangeStat');

    const launchBtn = document.getElementById('launchBtn');
    const resetBtn = document.getElementById('resetBtn');

    // State Variables
    let isAnimating = false;
    let animationId = null;
    let startTime = null;

    // Physics Initial Conditions
    let v0, angleDeg, angleRad, g;
    let vx, vy;

    // Trajectory History
    let path = [];

    // --- ASSETS ---
    // define cannon image locally for now or draw it as path
    // We will draw it procedurally for scalable crispness

    // 2. Logic Functions

    function calculateStats() {
        v0 = parseFloat(velocityInput.value);
        angleDeg = parseFloat(angleInput.value);
        g = parseFloat(gravityInput.value);
        angleRad = angleDeg * (Math.PI / 180);

        vx = v0 * Math.cos(angleRad);
        vy = v0 * Math.sin(angleRad);

        const maxH = (vy * vy) / (2 * g);
        const range = (v0 * v0 * Math.sin(2 * angleRad)) / g;

        return { maxH, range };
    }

    function autoZoom(maxH, range) {
        // We want the trajectory to fit within the canvas.
        // Available width: canvas.width - PADDING_LEFT - 50 (margin)
        // Available height: canvas.height - PADDING_BOTTOM - 50 (margin)

        const availWidth = canvas.width - PADDING_LEFT - 100;
        const availHeight = canvas.height - PADDING_BOTTOM - 100;

        // Ideal scale for Width
        // If range is very small, don't zoom in infinitely. Min range we care about ~10m?
        const safeRange = Math.max(range, 10);
        const scaleX = availWidth / safeRange;

        // Ideal scale for Height
        const safeH = Math.max(maxH, 5);
        const scaleY = availHeight / safeH;

        // Choose the smaller scale to fit BOTH (contain)
        // Clamp max scale to default (4) so we don't zoom in too much on small shots
        // Clamp min scale so we don't disappear
        let newScale = Math.min(scaleX, scaleY);
        newScale = Math.min(newScale, 10); // Max zoom in (10px per meter)
        newScale = Math.max(newScale, 0.5); // Max zoom out (0.5px per meter)

        targetScale = newScale;
    }

    // Smooth zooming loop? For simplicity, we snap to scale on Launch for now, 
    // or lerp every frame. Let's lerp for "High Quality".

    function updateScale() {
        // Simple lerp: 10% towards target per frame
        if (Math.abs(pixelsPerMeter - targetScale) > 0.01) {
            pixelsPerMeter += (targetScale - pixelsPerMeter) * 0.1;
        }
    }

    // 3. Drawing Functions

    function drawCannon(scale) {
        ctx.save();
        ctx.translate(PADDING_LEFT, GROUND_Y);
        ctx.rotate(-angleRad); // Rotate UP (counter-clockwise)

        // Cannon Barrel (Cyberpunk/Lab Style)
        // Scale the drawing by the zoom level? 
        // Realistically, the cannon is a physical object (e.g. 2m long).
        // So it should scale with pixelsPerMeter.
        const length = 2 * scale;  // 2 meters long
        const width = 0.5 * scale; // 0.5 meters wide

        // Draw Barrel
        ctx.fillStyle = "#334155"; // Dark Slate
        ctx.beginPath();
        ctx.rect(0, -width / 2, length, width);
        ctx.fill();
        ctx.strokeStyle = "#94a3b8"; // Light metallic edge
        ctx.lineWidth = 2;
        ctx.stroke();

        // Barrel Band/Detail
        ctx.fillStyle = "#0ea5e9"; // Blue glow ring
        ctx.fillRect(length * 0.8, -width / 2 - 2, width / 2, width + 4);

        ctx.restore();

        // Draw Base (Fixed, doesn't rotate)
        ctx.save();
        ctx.translate(PADDING_LEFT, GROUND_Y);
        ctx.fillStyle = "#1e293b"; // Dark Base
        ctx.beginPath();
        ctx.arc(0, 0, 0.8 * scale, 0, Math.PI, true); // Semicircle
        ctx.fill();
        ctx.restore();
    }

    function drawCoordinateSystem() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update Zoom
        updateScale();

        // Draw Grid
        ctx.strokeStyle = '#e2e8f0'; // Very light slate
        ctx.lineWidth = 1;
        const gridSize = 10 * pixelsPerMeter; // 10m grid lines?

        ctx.beginPath();
        // Dynamic grid: if grid gets too small, double the step
        // Not implementing complex dynamic grid yet, just simple logic
        // Draw standard axes

        // Draw Ground (X-axis)
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, GROUND_Y);
        ctx.lineTo(canvas.width, GROUND_Y);
        ctx.stroke();

        // Draw Height (Y-axis)
        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, GROUND_Y);
        ctx.lineTo(PADDING_LEFT, 0);
        ctx.stroke();

        // Distance Markers (every 10m)
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";

        // Optimize loop: only visible area
        const maxVisibleMeters = (canvas.width - PADDING_LEFT) / pixelsPerMeter;

        for (let m = 0; m <= maxVisibleMeters; m += 10) {
            const x = PADDING_LEFT + (m * pixelsPerMeter);
            ctx.beginPath();
            ctx.arc(x, GROUND_Y, 2, 0, Math.PI * 2);
            ctx.fill();
            if (m % 50 === 0) { // Text every 50m
                ctx.fillText(m + "m", x, GROUND_Y + 20);
            }
        }
    }

    function drawScene(currentX, currentY) {
        drawCoordinateSystem();
        drawCannon(pixelsPerMeter);

        // 1. Draw Trajectory Trace
        if (path.length > 0) {
            ctx.strokeStyle = "#0284c7"; // Primary Blue
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(PADDING_LEFT, GROUND_Y);

            path.forEach(pt => {
                const screenX = PADDING_LEFT + (pt.x * pixelsPerMeter);
                const screenY = GROUND_Y - (pt.y * pixelsPerMeter);
                ctx.lineTo(screenX, screenY);
            });
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Landing Mark (X) if finished
            if (!isAnimating && path.length > 2) {
                const last = path[path.length - 1];
                const lx = PADDING_LEFT + (last.x * pixelsPerMeter);
                const ly = GROUND_Y - (last.y * pixelsPerMeter);
                ctx.fillStyle = "#ef4444";
                ctx.font = "14px Inter";
                ctx.fillText("Land: " + last.x.toFixed(1) + "m", lx, ly - 10);
            }
        }

        // 2. Draw Projectile (Ball)
        if (currentX !== undefined) {
            const screenX = PADDING_LEFT + (currentX * pixelsPerMeter);
            const screenY = GROUND_Y - (currentY * pixelsPerMeter);

            // Ball shadow
            ctx.shadowBlur = 5;
            ctx.shadowColor = "rgba(0,0,0,0.3)";

            ctx.fillStyle = "#ef4444"; // Red Ball
            ctx.beginPath();
            ctx.arc(screenX, screenY, 6, 0, Math.PI * 2); // Constant size ball? Or scale?
            // Constant size is better for visibility
            ctx.fill();

            ctx.shadowBlur = 0;
        }
    }

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000;

        let x = vx * elapsed;
        let y = (vy * elapsed) - (0.5 * g * elapsed * elapsed);

        timeStat.textContent = elapsed.toFixed(2) + " s";

        if (y < 0) {
            y = 0;
            isAnimating = false;
            const totalFlightTime = (2 * vy) / g;
            x = vx * totalFlightTime;
            timeStat.textContent = totalFlightTime.toFixed(2) + " s";
            // Final path point
            path.push({ x: x, y: 0 });
            drawScene(x, y);
            return;
        }

        path.push({ x, y });
        drawScene(x, y); // Auto-Zoom happens inside drawScene via updateScale()

        if (isAnimating) {
            animationId = requestAnimationFrame(animate);
        }
    }

    function launch() {
        if (isAnimating) return;

        // 1. Calc Physics
        const stats = calculateStats(); // updates globals, returns maxH/Range

        heightStat.textContent = stats.maxH.toFixed(2) + " m";
        rangeStat.textContent = stats.range.toFixed(2) + " m";

        // 2. Trigger Auto-Zoom
        // The camera should zoom to fit the PREDICTED path immediately or smoothly?
        // Let's set the target scale immediately so it zooms during flight?
        // Or set it before flight?
        autoZoom(stats.maxH, stats.range);

        // 3. Reset
        path = [];
        isAnimating = true;
        startTime = null;

        cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(animate);
    }

    function reset() {
        isAnimating = false;
        cancelAnimationFrame(animationId);
        path = [];
        targetScale = 4; // Reset Zoom

        timeStat.textContent = "0.00 s";
        heightStat.textContent = "0.00 m";
        rangeStat.textContent = "0.00 m";

        // Redraw initial state
        const stats = calculateStats(); // just to get angle
        drawScene(0, 0);
    }

    function updateValues() {
        angleVal.textContent = angleInput.value;
        velocityVal.textContent = velocityInput.value;
        gravityVal.textContent = parseFloat(gravityInput.value).toFixed(1);

        // Live update cannon rotation
        if (!isAnimating) {
            calculateStats();
            drawScene(0, 0);
        }
    }

    // Listeners
    if (angleInput) {
        angleInput.addEventListener('input', updateValues);
        velocityInput.addEventListener('input', updateValues);
        gravityInput.addEventListener('input', updateValues);
    }

    if (launchBtn) launchBtn.addEventListener('click', launch);
    if (resetBtn) resetBtn.addEventListener('click', reset);

    // Loop for smooth zoom even when not animating physics?
    // No, we can just run a loop or let events trigger it. 
    // Ideally we need a game loop for smooth zoom interpolation if we want it to animate 
    // while the ball is NOT flying (e.g. user changes slider -> trajectory range changes -> zoom changes?)
    // For now: Zoom only changes on Launch or Reset to keep it stable.

    // Initial Draw
    updateValues();
});
