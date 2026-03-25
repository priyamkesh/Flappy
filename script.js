// --- Engine Initialization ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3b207a, 0.02); 

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 0; 

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// --- Game State & Constants ---
let state = 'START'; 
let score = 0;
let velocity = 0;
const gravity = -0.018;
const jumpStrength = 0.25;
const gameSpeed = 0.4;
const pipeSpawnZ = -60;
const pipeDespawnZ = 5;
const pipeGap = 12; 

// --- Object Pooling (Pipes) ---
const pipes = [];
const pipeMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x00ff66, 
    emissive: 0x004411,
    shininess: 100
});
const pipeGeo = new THREE.BoxGeometry(6, 40, 6);

function createPipePair(zOffset) {
    const topPipe = new THREE.Mesh(pipeGeo, pipeMaterial);
    const bottomPipe = new THREE.Mesh(pipeGeo, pipeMaterial);
    
    const edges = new THREE.EdgesGeometry(pipeGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffaa, linewidth: 2 });
    topPipe.add(new THREE.LineSegments(edges, lineMat));
    bottomPipe.add(new THREE.LineSegments(edges, lineMat));

    const pair = new THREE.Group();
    pair.add(topPipe);
    pair.add(bottomPipe);
    
    resetPipePosition(pair, zOffset);
    scene.add(pair);
    pipes.push(pair);
}

function resetPipePosition(pipeGroup, zPos) {
    const centerHeight = (Math.random() * 16) - 8; 
    pipeGroup.children[0].position.y = centerHeight + (pipeGap / 2) + 20; 
    pipeGroup.children[1].position.y = centerHeight - (pipeGap / 2) - 20; 
    pipeGroup.position.z = zPos;
    pipeGroup.passed = false; 
}

for(let i=0; i<4; i++) {
    createPipePair(pipeSpawnZ + (i * 20));
}

// --- Particle System ---
const particlesGeo = new THREE.BufferGeometry();
const particlesCount = 200;
const posArray = new Float32Array(particlesCount * 3);
for(let i=0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 50;
}
particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMat = new THREE.PointsMaterial({ size: 0.2, color: 0x00ffff });
const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
scene.add(particlesMesh);

// --- UI DOM Elements ---
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const reticle = document.getElementById('reticle');

// --- Input Handling ---
function jump() {
    if (state === 'START') {
        state = 'PLAYING';
        startScreen.classList.add('hidden');
        scoreDisplay.classList.remove('hidden');
        reticle.classList.remove('hidden');
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
    reticle.style.borderColor = "rgba(255,255,255,0.8)";
    reticle.style.boxShadow = "0 0 10px #00ff66, inset 0 0 10px #00ff66";
}

function triggerGameOver() {
    state = 'GAMEOVER';
    gameOverScreen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');
    reticle.style.borderColor = "rgba(255,0,0,0.8)";
    reticle.style.boxShadow = "0 0 10px #ff0000, inset 0 0 10px #ff0000";
}

// --- Main Game Loop ---
const playerBox = new THREE.Box3(); 
const pipeBox = new THREE.Box3();

function animate() {
    requestAnimationFrame(animate);

    particlesMesh.position.z += gameSpeed * 0.5;
    if(particlesMesh.position.z > 20) particlesMesh.position.z = 0;

    if (state === 'PLAYING') {
        velocity += gravity;
        camera.position.y += velocity;

        playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(1, 1, 1));

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

        if (camera.position.y < -15 || camera.position.y > 15) {
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
