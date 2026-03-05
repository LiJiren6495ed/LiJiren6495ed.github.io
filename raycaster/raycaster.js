// 1. 握手信号
window.jsLoaded = true;

const mapCanvas = document.getElementById('mapCanvas');
const viewCanvas = document.getElementById('viewCanvas');

if (!mapCanvas || !viewCanvas) {
    console.error("无法找到画布，请检查 HTML 结构");
} else {
    const mCtx = mapCanvas.getContext('2d');
    const vCtx = viewCanvas.getContext('2d');

    // --- 配置参数 (按照要求调整) ---
    const mapSize = 21; 
    const cellSize = 30;
    const rotationSensitivity = 0.01; 
    const movementSpeed = 0.3;     
    
    let gameWon = false;
    let tick = 0; 
    
    // 镜头晃动相关变量
    let walkPhase = 0;    
    let bobOffset = 0;    

    // --- 改进的迷宫生成算法 ---
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
        
        const gx = size - 2;
        const gy = size - 2;
        maze[gy][gx] = 0; 

        if (maze[gy - 1][gx] === 1 && maze[gy][gx - 1] === 1) {
            if (Math.random() > 0.5) {
                maze[gy - 1][gx] = 0; 
            } else {
                maze[gy][gx - 1] = 0; 
            }
        }

        for (let i = 0; i < 15; i++) {
            let rx = Math.floor(Math.random() * (size - 2)) + 1;
            let ry = Math.floor(Math.random() * (size - 2)) + 1;
            maze[ry][rx] = 0;
        }

        return maze;
    }

    let worldMap = generateMaze(mapSize);
    const goal = { 
        gridX: mapSize - 2, 
        gridY: mapSize - 2,
        x: (mapSize - 2) * cellSize + cellSize / 2, 
        y: (mapSize - 2) * cellSize + cellSize / 2 
    };

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
        tick++; 

        if (keys.a) player.angle -= rotationSensitivity;
        if (keys.d) player.angle += rotationSensitivity;

        let moveStep = 0;
        if (keys.w) moveStep = movementSpeed;
        if (keys.s) moveStep = -movementSpeed;

        if (moveStep !== 0) {
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
            
            // 调整步伐频率，让步伐更慢
            walkPhase += 0.06; 
        } else {
            walkPhase *= 0.9; 
        }
        
        bobOffset = Math.sin(walkPhase) * 6; 

        // --- 修复：更鲁棒的胜利检测 ---
        // 只要玩家当前的格子坐标等于终点的格子坐标，即视为通关
        const currentPlayerGridX = Math.floor(player.x / cellSize);
        const currentPlayerGridY = Math.floor(player.y / cellSize);
        
        if (currentPlayerGridX === goal.gridX && currentPlayerGridY === goal.gridY) {
            gameWon = true;
        }
    }

    function draw() {
        mCtx.fillStyle = '#050505'; 
        mCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

        mCtx.save(); 
        mCtx.translate(mapCanvas.width / 2 - player.x, mapCanvas.height / 2 - player.y);

        for (let r = 0; r < mapSize; r++) {
            for (let c = 0; c < mapSize; c++) {
                if (worldMap[r][c] === 1) {
                    mCtx.fillStyle = '#3a3a3a'; 
                    mCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                } else {
                    mCtx.fillStyle = '#1a1a1a'; 
                    mCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                }
            }
        }

        const goalAlpha = 0.5 + Math.sin(tick * 0.1) * 0.5;
        mCtx.fillStyle = `rgba(0, 255, 0, ${goalAlpha})`;
        mCtx.shadowBlur = 15;
        mCtx.shadowColor = '#0f0';
        mCtx.fillRect(goal.x - 8, goal.y - 8, 16, 16);
        mCtx.shadowBlur = 0;

        mCtx.fillStyle = '#ff0000';
        mCtx.beginPath();
        mCtx.arc(player.x, player.y, 5, 0, Math.PI * 2);
        mCtx.fill();
        mCtx.restore(); 

        vCtx.fillStyle = '#0a0a0a'; 
        vCtx.fillRect(0, 0, viewCanvas.width, viewCanvas.height / 2 + bobOffset); 
        vCtx.fillStyle = '#151515'; 
        vCtx.fillRect(0, viewCanvas.height / 2 + bobOffset, viewCanvas.width, viewCanvas.height / 2 - bobOffset);

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
            let hitGoal = false;

            while (!hitWall && distance < 800) {
                rayX += cosA;
                rayY += sinA;
                distance += stepSize;
                const mapX = Math.floor(rayX / cellSize);
                const mapY = Math.floor(rayY / cellSize);
                
                if (mapY >= 0 && mapY < mapSize && mapX >= 0 && mapX < mapSize) {
                    if (mapX === goal.gridX && mapY === goal.gridY) {
                        hitGoal = true;
                        hitWall = true;
                    } else if (worldMap[mapY][mapX] === 1) {
                        hitWall = true;
                    }
                } else {
                    hitWall = true;
                }
            }

            const correctedDist = distance * Math.cos(rayAngle - player.angle);
            const wallHeight = (cellSize * 350) / Math.max(correctedDist, 1);
            let brightness = Math.min(255, 255 * (1 - correctedDist / 600));
            
            if (hitGoal) {
                const pulse = Math.sin(tick * 0.1) * 30;
                vCtx.fillStyle = `rgb(0, ${Math.min(255, brightness + 100 + pulse)}, 0)`;
            } else {
                const hitX = rayX % cellSize;
                if (Math.abs(hitX) < 1 || Math.abs(hitX - cellSize) < 1) {
                    brightness *= 0.7; 
                }
                vCtx.fillStyle = `rgb(${brightness}, ${brightness * 0.9}, ${brightness * 0.7})`;
            }
            
            vCtx.fillRect(i, (viewCanvas.height - wallHeight) / 2 + bobOffset, 1, wallHeight);
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
