// --- Engine Initialization ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a0b3c, 0.025); 

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 0; 

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0x00ffaa, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);
const pointLight = new THREE.PointLight(0xff0055, 1, 50);
pointLight.position.set(0, 0, -10);
scene.add(pointLight);

// --- Procedural Textures ---
function createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#002208';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.moveTo(128, 0); ctx.lineTo(128, 256);
    ctx.moveTo(0, 128); ctx.lineTo(256, 128);
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 6);
    return texture;
}

// --- Environment ---
const gridMat = new THREE.LineBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.3 });
const floorGrid = new THREE.GridHelper(200, 40, 0x00ff66, 0x00ff66);
floorGrid.position.y = -25;
floorGrid.material = gridMat;
scene.add(floorGrid);

const ceilingGrid = new THREE.GridHelper(200, 40, 0x00ffff, 0x00ffff);
ceilingGrid.position.y = 25;
ceilingGrid.material = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 });
scene.add(ceilingGrid);

// --- Game State & Constants ---
let state = 'START'; 
let score = 0;
let velocity = 0;
const gravity = -0.018;
const jumpStrength = 0.28;
const gameSpeed = 0.45;
const pipeSpawnZ = -80;
const pipeDespawnZ = 10;
const pipeGap = 13; 

// --- Object Pooling (Pipes) ---
const pipes = [];
const pipeTexture = createGridTexture();
const pipeMaterial = new THREE.MeshStandardMaterial({ 
    map: pipeTexture,
    roughness: 0.1,
    metalness: 0.8,
    emissive: 0x002208,
    emissiveIntensity: 0.5
});
const pipeGeo = new THREE.BoxGeometry(6, 50, 6);

function createPipePair(zOffset) {
    const topPipe = new THREE.Mesh(pipeGeo, pipeMaterial);
    const bottomPipe = new THREE.Mesh(pipeGeo, pipeMaterial);

    const pair = new THREE.Group();
    pair.add(topPipe);
    pair.add(bottomPipe);
    
    resetPipePosition(pair, zOffset);
    scene.add(pair);
    pipes.push(pair);
}

function resetPipePosition(pipeGroup, zPos) {
    const centerHeight = (Math.random() * 20) - 10; 
    pipeGroup.children[0].position.y = centerHeight + (pipeGap / 2) + 25; 
    pipeGroup.children[1].position.y = centerHeight - (pipeGap / 2) - 25; 
    pipeGroup.position.z = zPos;
    pipeGroup.passed = false; 
}

for(let i=0; i<5; i++) {
    createPipePair(pipeSpawnZ + (i * 20));
}

// --- Particle System ---
const particlesGeo = new THREE.BufferGeometry();
const particlesCount = 400;
const posArray = new Float32Array(particlesCount * 3);
for(let i=0; i < particlesCount * 3; i++) {
    posArray[i * 3] = (Math.random() - 0.5) * 60;
    posArray[i * 3 + 1] = (Math.random() - 0.5) * 60;
    posArray[i * 3 + 2] = (Math.random() - 0.5) * 100;
}
particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMat = new THREE.PointsMaterial({ size: 0.15, color: 0x00ffff, transparent: true, opacity: 0.8 });
const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
scene.add(particlesMesh);

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
    } else if (state === 'PLAYING') {
        velocity = jumpStrength;
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

    // Environment animation
    particlesMesh.position.z += gameSpeed * 1.5;
    if(particlesMesh.position.z > 50) particlesMesh.position.z = 0;

    floorGrid.position.z += gameSpeed;
    if(floorGrid.position.z > 10) floorGrid.position.z = 0;
    
    ceilingGrid.position.z += gameSpeed;
    if(ceilingGrid.position.z > 10) ceilingGrid.position.z = 0;

    if (state === 'PLAYING') {
        velocity += gravity;
        camera.position.y += velocity;

        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(1.2, 1.2, 1.2));

        for(let i=0; i<pipes.length; i++) {
            let p = pipes[i];
            p.position.z += gameSpeed; 

            for(let child of p.children) {
                pipeBox.setFromObject(child);
                if (playerBox.intersectsBox(pipeBox)) {
                    triggerGameOver();
                }
            }

            if (!p.passed && p.position.z > camera.position.z) {
                score++;
                scoreDisplay.innerText = score;
                p.passed = true;
            }

            if (p.position.z > pipeDespawnZ) {
                let minZ = 0;
                pipes.forEach(pipe => { if(pipe.position.z < minZ) minZ = pipe.position.z; });
                resetPipePosition(p, minZ - 20);
            }
        }

        if (camera.position.y < -24 || camera.position.y > 24) {
            triggerGameOver();
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

animate();
  
