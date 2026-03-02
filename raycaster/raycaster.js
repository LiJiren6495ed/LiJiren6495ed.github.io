// 获取 DOM 元素
const mapCanvas = document.getElementById('mapCanvas');
const viewCanvas = document.getElementById('viewCanvas');
const mCtx = mapCanvas.getContext('2d');
const vCtx = viewCanvas.getContext('2d');

// --- 1. 地图配置 ---
const mapSize = 10;
const cellSize = 30;
const worldMap = [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,0,0,0,1],
    [1,0,1,1,0,0,0,0,0,1],
    [1,0,1,0,0,0,1,1,0,1],
    [1,0,0,0,0,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,0,0,0,1],
    [1,0,1,0,0,0,0,1,0,1],
    [1,0,0,0,0,0,0,1,0,1],
    [1,1,1,1,1,1,1,1,1,1]
];

// --- 2. 玩家状态 ---
const player = {
    x: 150,
    y: 150,
    angle: 0,
    fov: Math.PI / 3 // 60 度视野
};

// --- 3. 键盘交互逻辑 ---
const keys = { w: false, s: false, a: false, d: false };

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// --- 4. 逻辑更新 ---
function update() {
    if (keys.a) player.angle -= 0.02;
    if (keys.d) player.angle += 0.02;

    let moveStep = 0;
    if (keys.w) moveStep = 0.5;
    if (keys.s) moveStep = -0.5;

    const newX = player.x + Math.cos(player.angle) * moveStep;
    const newY = player.y + Math.sin(player.angle) * moveStep;

    // 碰撞检测：检查新坐标是否在空地（0）上
    if (worldMap[Math.floor(newY / cellSize)][Math.floor(newX / cellSize)] === 0) {
        player.x = newX;
        player.y = newY;
    }
}

// --- 5. 画面渲染 ---
function draw() {
    // 清空背景
    mCtx.fillStyle = '#000';
    mCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    
    vCtx.fillStyle = '#111'; // 天空
    vCtx.fillRect(0, 0, viewCanvas.width, viewCanvas.height / 2);
    vCtx.fillStyle = '#222'; // 地面
    vCtx.fillRect(0, viewCanvas.height / 2, viewCanvas.width, viewCanvas.height / 2);

    // 绘制 2D 地图格子
    for (let r = 0; r < mapSize; r++) {
        for (let c = 0; c < mapSize; c++) {
            if (worldMap[r][c] === 1) {
                mCtx.fillStyle = '#555';
                mCtx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
            }
        }
    }

    // 射线投射核心算法
    const numRays = viewCanvas.width;
    const rayStep = player.fov / numRays;

    for (let i = 0; i < numRays; i++) {
        const rayAngle = player.angle - (player.fov / 2) + (i * rayStep);
        let rayX = player.x;
        let rayY = player.y;
        
        const stepSize = 1;
        const cosA = Math.cos(rayAngle) * stepSize;
        const sinA = Math.sin(rayAngle) * stepSize;

        let distance = 0;
        let hitWall = false;

        // 步进直到撞墙
        while (!hitWall && distance < 500) {
            rayX += cosA;
            rayY += sinA;
            distance += stepSize;
            if (worldMap[Math.floor(rayY / cellSize)][Math.floor(rayX / cellSize)] === 1) {
                hitWall = true;
            }
        }

        // 修正鱼眼效应
        const correctedDist = distance * Math.cos(rayAngle - player.angle);

        // 绘制 3D 墙壁列
        const wallHeight = (cellSize * 350) / correctedDist;
        const brightness = Math.min(255, 255 * (1 - correctedDist / 400));
        vCtx.fillStyle = `rgb(${brightness}, ${brightness * 0.8}, ${brightness * 0.5})`;
        vCtx.fillRect(i, (viewCanvas.height - wallHeight) / 2, 1, wallHeight);

        // 辅助：在 2D 地图画射线（每隔 20 条画一条）
        if (i % 20 === 0) {
            mCtx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
            mCtx.beginPath();
            mCtx.moveTo(player.x, player.y);
            mCtx.lineTo(rayX, rayY);
            mCtx.stroke();
        }
    }

    // 画 2D 玩家点
    mCtx.fillStyle = '#ff0000';
    mCtx.beginPath();
    mCtx.arc(player.x, player.y, 4, 0, Math.PI * 2);
    mCtx.fill();
}

// 游戏主循环
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 启动
gameLoop();
