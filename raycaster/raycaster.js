// 1. 握手信号
window.jsLoaded = true;

const mapCanvas = document.getElementById('mapCanvas');
const viewCanvas = document.getElementById('viewCanvas');

if (!mapCanvas || !viewCanvas) {
    console.error("无法找到画布，请检查 HTML 结构");
} else {
    const mCtx = mapCanvas.getContext('2d');
    const vCtx = viewCanvas.getContext('2d');

    // --- 配置参数 ---
    const mapSize = 30; // 进一步增加尺寸，让迷宫更大
    const cellSize = 30;
    const rotationSensitivity = 0.02; 
    const movementSpeed = 0.5; 
    
    let gameWon = false;

    // --- 迷宫生成算法 (递归回溯) ---
    function generateMaze(size) {
        let maze = Array.from({ length: size }, () => Array(size).fill(1));
        
        function carve(x, y) {
            const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
            maze[y][x] = 0; 

            for (let [dx, dy] of dirs) {
                let nx = x + dx, ny = y + dy;
                if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 1) {
                    maze[y + dy / 2][x + dx / 2] = 0; 
                    carve(nx, ny);
                }
            }
        }

        carve(1, 1);
        maze[size - 2][size - 2] = 0; // 确保终点是通的
        return maze;
    }

    let worldMap = generateMaze(mapSize);
    const goal = { x: (mapSize - 2) * cellSize + cellSize / 2, y: (mapSize - 2) * cellSize + cellSize / 2 };

    // --- 玩家初始状态 ---
    const player = {
        x: cellSize * 1.5,
        y: cellSize * 1.5,
        angle: 0,
        fov: Math.PI / 3 
    };

    const keys = { w: false, s: false, a: false, d: false };
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = true;
    });
    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = false;
    });

    function update() {
        if (gameWon) return;

        if (keys.a) player.angle -= rotationSensitivity;
        if (keys.d) player.angle += rotationSensitivity;

        let moveStep = 0;
        if (keys.w) moveStep = movementSpeed;
        if (keys.s) moveStep = -movementSpeed;

        const newX = player.x + Math.cos(player.angle) * moveStep;
        const newY = player.y + Math.sin(player.angle) * moveStep;

        const gridX = Math.floor(newX / cellSize);
        const gridY = Math.floor(newY / cellSize);
        
        if (gridY >= 0 && gridY < mapSize && gridX >= 0 && gridX < mapSize) {
            if (worldMap[gridY][gridX] === 0) {
                player.x = newX;
                player.y = newY;
            }
        }

        const distToGoal = Math.sqrt((player.x - goal.x)**2 + (player.y - goal.y)**2);
        if (distToGoal < cellSize / 2) {
            gameWon = true;
        }
    }

    function draw() {
        // --- 绘制 2D 小地图 (跟随玩家) ---
        mCtx.fillStyle = '#111';
        mCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

        mCtx.save(); // 保存当前状态
        // 将画布中心平移到玩家位置，并反向移动地图，实现地图跟随效果
        mCtx.translate(mapCanvas.width / 2 - player.x, mapCanvas.height / 2 - player.y);

        // 绘制地图格子
        for (let r = 0; r < mapSize; r++) {
            for (let c = 0; c < mapSize; c++) {
                if (worldMap[r][c] === 1) {
                    mCtx.fillStyle = '#555';
                    mCtx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
                }
            }
        }

        // 绘制终点
        mCtx.fillStyle = '#0f0';
        mCtx.fillRect(goal.x - 8, goal.y - 8, 16, 16);

        // 绘制射线 (仅在 2D 地图显示)
        const numRays = viewCanvas.width;
        const rayStep = player.fov / numRays;

        for (let i = 0; i < numRays; i += 20) { // 每隔20条画一条，减少混乱
            const rayAngle = player.angle - (player.fov / 2) + (i * rayStep);
            let rayX = player.x;
            let rayY = player.y;
            const cosA = Math.cos(rayAngle);
            const sinA = Math.sin(rayAngle);
            let dist = 0;
            while(dist < 200) { // 2D 射线长度限制，避免过长
                dist += 2;
                let nx = rayX + cosA * dist;
                let ny = rayY + sinA * dist;
                if (worldMap[Math.floor(ny/cellSize)][Math.floor(nx/cellSize)] === 1) break;
                mCtx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
                mCtx.beginPath(); mCtx.moveTo(player.x, player.y); mCtx.lineTo(nx, ny); mCtx.stroke();
            }
        }

        // 绘制玩家图标 (始终在平移后的中心)
        mCtx.fillStyle = '#ff0000';
        mCtx.beginPath();
        mCtx.arc(player.x, player.y, 5, 0, Math.PI * 2);
        mCtx.fill();
        // 绘制视线方向
        mCtx.strokeStyle = '#ff0';
        mCtx.beginPath();
        mCtx.moveTo(player.x, player.y);
        mCtx.lineTo(player.x + Math.cos(player.angle) * 15, player.y + Math.sin(player.angle) * 15);
        mCtx.stroke();

        mCtx.restore(); // 恢复状态

        // --- 绘制 3D 视野 ---
        vCtx.fillStyle = '#111'; // 天空
        vCtx.fillRect(0, 0, viewCanvas.width, viewCanvas.height / 2);
        vCtx.fillStyle = '#222'; // 地面
        vCtx.fillRect(0, viewCanvas.height / 2, viewCanvas.width, viewCanvas.height / 2);

        for (let i = 0; i < numRays; i++) {
            const rayAngle = player.angle - (player.fov / 2) + (i * rayStep);
            let rayX = player.x;
            let rayY = player.y;
            const stepSize = 1;
            const cosA = Math.cos(rayAngle) * stepSize;
            const sinA = Math.sin(rayAngle) * stepSize;
            let distance = 0;
            let hitWall = false;

            while (!hitWall && distance < 800) {
                rayX += cosA;
                rayY += sinA;
                distance += stepSize;
                const mapX = Math.floor(rayX / cellSize);
                const mapY = Math.floor(rayY / cellSize);
                if (mapY >= 0 && mapY < mapSize && mapX >= 0 && mapX < mapSize) {
                    if (worldMap[mapY][mapX] === 1) hitWall = true;
                } else {
                    hitWall = true;
                }
            }

            const correctedDist = distance * Math.cos(rayAngle - player.angle);
            const wallHeight = (cellSize * 350) / Math.max(correctedDist, 1);
            const brightness = Math.min(255, 255 * (1 - correctedDist / 600));
            
            const isGoalArea = Math.floor(rayX/cellSize) === mapSize-2 && Math.floor(rayY/cellSize) === mapSize-2;
            vCtx.fillStyle = isGoalArea 
                ? `rgb(0, ${brightness}, 0)` 
                : `rgb(${brightness}, ${brightness * 0.8}, ${brightness * 0.5})`;
            
            vCtx.fillRect(i, (viewCanvas.height - wallHeight) / 2, 1, wallHeight);
        }

        if (gameWon) {
            vCtx.fillStyle = "rgba(0, 0, 0, 0.8)";
            vCtx.fillRect(0, 0, viewCanvas.width, viewCanvas.height);
            vCtx.fillStyle = "#0f0";
            vCtx.font = "bold 30px Arial";
            vCtx.textAlign = "center";
            vCtx.fillText("🎉 成功逃离迷宫！", viewCanvas.width / 2, viewCanvas.height / 2);
            vCtx.font = "16px Arial";
            vCtx.fillText("按 F5 刷新重新开始挑战", viewCanvas.width / 2, viewCanvas.height / 2 + 40);
        }
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    gameLoop();
}
