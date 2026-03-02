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
    const mapSize = 15; // 增加地图尺寸让迷宫更有挑战性
    const cellSize = 30;
    const rotationSensitivity = 0.04; 
    const movementSpeed = 1.5; 
    
    let gameWon = false;

    // --- 迷宫生成算法 (递归回溯) ---
    function generateMaze(size) {
        // 初始化全部为墙 (1)
        let maze = Array.from({ length: size }, () => Array(size).fill(1));
        
        function carve(x, y) {
            const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
            
            maze[y][x] = 0; // 设置当前点为通路

            for (let [dx, dy] of dirs) {
                let nx = x + dx, ny = y + dy;
                if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 1) {
                    maze[y + dy / 2][x + dx / 2] = 0; // 打通中间的墙
                    carve(nx, ny);
                }
            }
        }

        carve(1, 1);
        
        // 设置终点 (地图右下角附近的空地)
        maze[size - 2][size - 2] = 0;
        return maze;
    }

    let worldMap = generateMaze(mapSize);
    const goal = { x: (mapSize - 2) * cellSize + cellSize / 2, y: (mapSize - 2) * cellSize + cellSize / 2 };

    // --- 玩家初始状态 (放在起点 1,1) ---
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

        // 碰撞检测
        const gridX = Math.floor(newX / cellSize);
        const gridY = Math.floor(newY / cellSize);
        
        if (gridY >= 0 && gridY < mapSize && gridX >= 0 && gridX < mapSize) {
            if (worldMap[gridY][gridX] === 0) {
                player.x = newX;
                player.y = newY;
            }
        }

        // 检查是否到达终点
        const distToGoal = Math.sqrt((player.x - goal.x)**2 + (player.y - goal.y)**2);
        if (distToGoal < cellSize / 2) {
            gameWon = true;
        }
    }

    function draw() {
        // 清空背景
        mCtx.fillStyle = '#000';
        mCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
        
        // 绘制 3D 视野
        vCtx.fillStyle = '#111'; // 天空
        vCtx.fillRect(0, 0, viewCanvas.width, viewCanvas.height / 2);
        vCtx.fillStyle = '#222'; // 地面
        vCtx.fillRect(0, viewCanvas.height / 2, viewCanvas.width, viewCanvas.height / 2);

        // 绘制 2D 地图
        for (let r = 0; r < mapSize; r++) {
            for (let c = 0; c < mapSize; c++) {
                if (worldMap[r][c] === 1) {
                    mCtx.fillStyle = '#555';
                    mCtx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1);
                }
            }
        }

        // 绘制地图上的终点标志
        mCtx.fillStyle = '#0f0';
        mCtx.fillRect(goal.x - 5, goal.y - 5, 10, 10);

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

            while (!hitWall && distance < 600) {
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
            
            // 距离感着色
            const brightness = Math.min(255, 255 * (1 - correctedDist / 500));
            
            // 终点颜色特殊处理：如果在终点附近，墙壁变绿
            const isGoalArea = Math.floor(rayX/cellSize) === mapSize-2 && Math.floor(rayY/cellSize) === mapSize-2;
            vCtx.fillStyle = isGoalArea 
                ? `rgb(0, ${brightness}, 0)` 
                : `rgb(${brightness}, ${brightness * 0.8}, ${brightness * 0.5})`;
            
            vCtx.fillRect(i, (viewCanvas.height - wallHeight) / 2, 1, wallHeight);
        }

        // 2D 玩家图标
        mCtx.fillStyle = '#ff0000';
        mCtx.beginPath();
        mCtx.arc(player.x, player.y, 4, 0, Math.PI * 2);
        mCtx.fill();

        // 胜利提示
        if (gameWon) {
            vCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
            vCtx.fillRect(0, 0, viewCanvas.width, viewCanvas.height);
            vCtx.fillStyle = "#0f0";
            vCtx.font = "30px Arial";
            vCtx.textAlign = "center";
            vCtx.fillText("🎉 成功逃离迷宫！", viewCanvas.width / 2, viewCanvas.height / 2);
            vCtx.font = "16px Arial";
            vCtx.fillText("刷新页面重新生成迷宫", viewCanvas.width / 2, viewCanvas.height / 2 + 40);
        }
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    gameLoop();
}
