// --- Engine Initialization ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Solid Sky Blue
scene.fog = new THREE.Fog(0x87CEEB, 10, 80); // Smooth depth fading

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 0; 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Bright ambient daylight
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6); // Sunlight vector
dirLight.position.set(20, 50, 20);
scene.add(dirLight);

// --- Environment ---
// Ground plane to provide depth perception without visual clutter
const groundGeo = new THREE.PlaneGeometry(200, 200);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x55aa55 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -20;
scene.add(ground);

// --- Game State & Physics Constants ---
let state = 'START'; 
let score = 0;
let velocity = 0;

// Recalculated physics parameters
const gravity = -0.012;      // Reduced downward acceleration
const jumpStrength = 0.22;   // Reduced vertical impulse
const gameSpeed = 0.25;      // Reduced forward Z-axis translation
const pipeSpawnZ = -80;
const pipeDespawnZ = 15;
const pipeGap = 16;          // Increased gap margin for error

const clock = new THREE.Clock(); // Framerate independence controller

// --- Object Pooling (Pipes) ---
const pipes = [];
const pipeMaterial = new THREE.MeshLambertMaterial({ color: 0x2ecc71 }); // Classic Flappy Green
const pipeGeo = new THREE.BoxGeometry(5, 50, 5);

// Create subtle edges for the pipes to distinguish depth
const edgeGeo = new THREE.EdgesGeometry(pipeGeo);
const edgeMat = new THREE.LineBasicMaterial({ color: 0x186a3b, linewidth: 2 });

function createPipePair(zOffset) {
    const topPipe = new THREE.Mesh(pipeGeo, pipeMaterial);
    const bottomPipe = new THREE.Mesh(pipeGeo, pipeMaterial);

    topPipe.add(new THREE.LineSegments(edgeGeo, edgeMat));
    bottomPipe.add(new THREE.LineSegments(edgeGeo, edgeMat));

    const pair = new THREE.Group();
    pair.add(topPipe);
    pair.add(bottomPipe);
    
    resetPipePosition(pair, zOffset);
    scene.add(pair);
    pipes.push(pair);
}

function resetPipePosition(pipeGroup, zPos) {
    // Constrain random height to keep pipes within playable view
    const centerHeight = (Math.random() * 14) - 7; 
    pipeGroup.children[0].position.y = centerHeight + (pipeGap / 2) + 25; // Top Pipe
    pipeGroup.children[1].position.y = centerHeight - (pipeGap / 2) - 25; // Bottom Pipe
    pipeGroup.position.z = zPos;
    pipeGroup.passed = false; 
}

for(let i=0; i<5; i++) {
    createPipePair(pipeSpawnZ + (i * 20));
}

// --- UI DOM Elements ---
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');

// --- Input Handling ---
function jump() {
    if (state === 'START') {
        state = 'PLAYING';
        startScreen.classList.add('hidden');
        scoreDisplay.classList.remove('hidden');
        clock.start(); // Reset delta clock on start
    } else if (state === 'PLAYING') {
        velocity = jumpStrength; // Apply instantaneous positive Y impulse
    } else if (state === 'GAMEOVER') {
        resetGame();
    }
}

window.addEventListener('mousedown', jump);
window.addEventListener('touchstart', jump);
window.addEventListener('keydown', (e) => { if(e.code === 'Space') jump(); });

function resetGame() {
    camera.position.y = 0;
    velocity = 0;
    score = 0;
    scoreDisplay.innerText = score;
    
    for(let i=0; i<pipes.length; i++) {
        resetPipePosition(pipes[i], pipeSpawnZ + (i * 20));
    }
    
    state = 'PLAYING';
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    clock.start();
}

function triggerGameOver() {
    state = 'GAMEOVER';
    gameOverScreen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');
}

// --- Main Game Loop ---
const playerBox = new THREE.Box3(); 
const pipeBox = new THREE.Box3();

function animate() {
    requestAnimationFrame(animate);

    // Delta time ensures the game speed is identical on 60Hz and 144Hz monitors
    const delta = clock.getDelta();
    // Normalization factor (assuming baseline 60FPS where delta is ~0.016)
    const timeScale = delta * 60; 

    if (state === 'PLAYING') {
        // Apply physics with time scaling
        velocity += gravity * timeScale;
        camera.position.y += velocity * timeScale;

        // Player hitbox engineered to be slightly smaller than physical camera space for forgiving collisions
        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(0.6, 0.6, 0.6));

        // Pipe Translation & Collision Algorithm
        for(let i=0; i<pipes.length; i++) {
            let p = pipes[i];
            p.position.z += gameSpeed * timeScale; 

            for(let child of p.children) {
                // Generate exact mathematical bounds of the current pipe
                pipeBox.setFromObject(child);
                // Reduce strictness of pipe hitbox slightly
                pipeBox.expandByScalar(-0.2); 

                // Intersection test
                if (playerBox.intersectsBox(pipeBox)) {
                    triggerGameOver();
                }
            }

            // Scoring logic
            if (!p.passed && p.position.z > camera.position.z) {
                score++;
                scoreDisplay.innerText = score;
                p.passed = true;
            }

            // Recycling logic (Object Pooling)
            if (p.position.z > pipeDespawnZ) {
                let minZ = 0;
                pipes.forEach(pipe => { if(pipe.position.z < minZ) minZ = pipe.position.z; });
                resetPipePosition(p, minZ - 20);
            }
        }

        // Terminal boundaries (Floor and Sky limit)
        if (camera.position.y < -19 || camera.position.y > 25) {
            triggerGameOver();
        }
    }

    renderer.render(scene, camera);
}

// Window resizing adjustments
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

animate();
