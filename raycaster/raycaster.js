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
    const mapSize = 20; 
    const cellSize = 30;
    const rotationSensitivity = 0.02; 
    const movementSpeed = 0.5; 
    
    let gameWon = false;

    // --- 改进的迷宫生成算法 ---
    function generateMaze(size) {
        // 初始化：奇数行奇数列的点作为“种子”
        let maze = Array.from({ length: size }, () => Array(size).fill(1));
        
        function carve(x, y) {
            // 随机化移动方向
            const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
            maze[y][x] = 0; 

            for (let [dx, dy] of dirs) {
                let nx = x + dx, ny = y + dy;
                // 确保在边界内且目标点是墙
                if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 1) {
                    maze[y + dy / 2][x + dx / 2] = 0; // 打通中间的墙
                    carve(nx, ny);
                }
            }
        }

        carve(1, 1);
        
        // 增加额外的随机打通，减少出现尴尬形状的概率
        for (let i = 0; i < 10; i++) {
            let rx = Math.floor(Math.random() * (size - 2)) + 1;
            let ry = Math.floor(Math.random() * (size - 2)) + 1;
            if (maze[ry][rx] === 1) maze[ry][rx] = 0;
        }

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
        // --- 绘制 2D 小地图 ---
        mCtx.fillStyle = '#050505'; // 更深的底色，遮盖边缘黑块
        mCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

        mCtx.save(); 
        mCtx.translate(mapCanvas.width / 2 - player.x, mapCanvas.height / 2 - player.y);

        // 绘制迷宫主体
        for (let r = 0; r < mapSize; r++) {
            for (let c = 0; c < mapSize; c++) {
                if (worldMap[r][c] === 1) {
                    mCtx.fillStyle = '#3a3a3a'; // 墙体颜色
                    mCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                } else {
                    mCtx.fillStyle = '#1a1a1a'; // 道路颜色
                    mCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                }
            }
        }

        // 绘制终点标志 (发光的绿点)
        mCtx.fillStyle = '#0f0';
        mCtx.shadowBlur = 10;
        mCtx.shadowColor = '#0f0';
        mCtx.fillRect(goal.x - 8, goal.y - 8, 16, 16);
        mCtx.shadowBlur = 0;

        // 绘制玩家
        mCtx.fillStyle = '#ff0000';
        mCtx.beginPath();
        mCtx.arc(player.x, player.y, 5, 0, Math.PI * 2);
        mCtx.fill();

        mCtx.restore(); 

        // --- 绘制 3D 视野 ---
        vCtx.fillStyle = '#0a0a0a'; // 顶部天空
        vCtx.fillRect(0, 0, viewCanvas.width, viewCanvas.height / 2);
        vCtx.fillStyle = '#151515'; // 底部地面
        vCtx.fillRect(0, viewCanvas.height / 2, viewCanvas.width, viewCanvas.height / 2);

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
            
            // 基础亮度
            let brightness = Math.min(255, 255 * (1 - correctedDist / 600));
            
            // 区分横墙和纵墙（简单阴影效果）
            const hitX = rayX % cellSize;
            const hitY = rayY % cellSize;
            if (Math.abs(hitX) < 1 || Math.abs(hitX - cellSize) < 1) {
                brightness *= 0.7; // 侧面墙壁稍微暗一点，增加立体感
            }

            const isGoalArea = Math.floor(rayX/cellSize) === mapSize-2 && Math.floor(rayY/cellSize) === mapSize-2;
            vCtx.fillStyle = isGoalArea 
                ? `rgb(0, ${brightness}, 0)` 
                : `rgb(${brightness}, ${brightness * 0.9}, ${brightness * 0.7})`;
            
            vCtx.fillRect(i, (viewCanvas.height - wallHeight) / 2, 1, wallHeight);
        }

        if (gameWon) {
            vCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
            vCtx.fillRect(0, 0, viewCanvas.width, viewCanvas.height);
            vCtx.fillStyle = "#0f0";
            vCtx.font = "bold 24px 'Microsoft YaHei'";
            vCtx.textAlign = "center";
            vCtx.fillText("🎉 逃出生天！", viewCanvas.width / 2, viewCanvas.height / 2);
            vCtx.font = "14px 'Microsoft YaHei'";
            vCtx.fillText("按下 F5 键再次进入循环", viewCanvas.width / 2, viewCanvas.height / 2 + 40);
        }
    }

    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    gameLoop();
}
