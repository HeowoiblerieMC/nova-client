import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const container = document.getElementById("game-container");
const startScreen = document.getElementById("start-screen");
const pauseScreen = document.getElementById("pause-screen");
const hud = document.getElementById("hud");

const playButton = document.getElementById("play-button");
const resumeButton = document.getElementById("resume-button");
const restartButton = document.getElementById("restart-button");

const fpsElement = document.getElementById("fps");
const positionElement = document.getElementById("position");
const selectedBlockNameElement = document.getElementById("selected-block-name");

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x8ac9f2);
scene.fog = new THREE.Fog(0x9bccea, 32, 92);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  180
);

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

container.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

const WORLD_SIZE = 40;
const HALF_WORLD = WORLD_SIZE / 2;
const MAX_BUILD_HEIGHT = 28;

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const EYE_HEIGHT = 1.62;
const WALK_SPEED = 4.8;
const SPRINT_SPEED = 7.2;
const JUMP_SPEED = 7.4;
const GRAVITY = 20;
const BLOCK_REACH = 6;

const keys = {};
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const centerScreen = new THREE.Vector2(0, 0);

const blocks = new Map();
const blockMeshes = [];
const clouds = [];

let canJump = false;
let selectedBlockIndex = 0;
let previousTime = performance.now();
let fpsFrames = 0;
let fpsTimer = 0;

const blockTypes = [
  {
    key: "grass",
    name: "Grass Block"
  },
  {
    key: "dirt",
    name: "Dirt"
  },
  {
    key: "stone",
    name: "Stone"
  },
  {
    key: "wood",
    name: "Oak Log"
  },
  {
    key: "leaves",
    name: "Oak Leaves"
  }
];

function seededRandom(x, y, seed = 0) {
  const value = Math.sin(
    x * 127.1 +
    y * 311.7 +
    seed * 74.7
  ) * 43758.5453123;

  return value - Math.floor(value);
}

function createPixelTexture(baseColor, variants, pattern = "noise") {
  const size = 16;
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  context.fillStyle = baseColor;
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const randomValue = seededRandom(x, y, variants.length);

      let colorIndex = Math.floor(randomValue * variants.length);

      if (pattern === "vertical") {
        colorIndex = Math.floor(
          seededRandom(Math.floor(x / 2), 1, y % 3) *
          variants.length
        );
      }

      if (pattern === "rings") {
        const distance = Math.abs(x - 7.5) + Math.abs(y - 7.5);
        colorIndex = Math.floor(distance / 2) % variants.length;
      }

      if (randomValue > 0.48 || pattern !== "noise") {
        context.fillStyle = variants[colorIndex];
        context.fillRect(x, y, 1, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;

  return texture;
}

function createGrassSideTexture() {
  const size = 16;
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  context.fillStyle = "#765038";
  context.fillRect(0, 0, size, size);

  const dirtColors = [
    "#69442f",
    "#80593d",
    "#5d3c2c",
    "#8a6244"
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const randomValue = seededRandom(x, y, 21);

      if (randomValue > 0.42) {
        context.fillStyle = dirtColors[
          Math.floor(randomValue * dirtColors.length)
        ];

        context.fillRect(x, y, 1, 1);
      }
    }
  }

  const grassColors = [
    "#4c913c",
    "#5ca947",
    "#397d35",
    "#68b64e"
  ];

  for (let x = 0; x < size; x += 1) {
    const depth = 3 + Math.floor(seededRandom(x, 4, 9) * 4);

    for (let y = 0; y < depth; y += 1) {
      const colorIndex = Math.floor(
        seededRandom(x, y, 12) * grassColors.length
      );

      context.fillStyle = grassColors[colorIndex];
      context.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;

  return texture;
}

const textures = {
  grassTop: createPixelTexture(
    "#50913e",
    ["#3f7f35", "#65aa4c", "#477f34", "#72b653"]
  ),

  grassSide: createGrassSideTexture(),

  dirt: createPixelTexture(
    "#775139",
    ["#65422f", "#8b6243", "#5b3b2b", "#966c49"]
  ),

  stone: createPixelTexture(
    "#7d7d7d",
    ["#666666", "#909090", "#717171", "#9b9b9b"]
  ),

  bedrock: createPixelTexture(
    "#3d3d3d",
    ["#242424", "#555555", "#303030", "#666666"]
  ),

  woodSide: createPixelTexture(
    "#76502d",
    ["#5b3b22", "#8a6238", "#684526", "#9b7041"],
    "vertical"
  ),

  woodTop: createPixelTexture(
    "#9a7445",
    ["#664421", "#7d592e", "#b08855", "#5b3b1d"],
    "rings"
  ),

  leaves: createPixelTexture(
    "#326f3a",
    ["#245a31", "#3d8042", "#2b6636", "#4b904d"]
  ),

  sand: createPixelTexture(
    "#d8c582",
    ["#cabb78", "#e4d394", "#bea964", "#efdca0"]
  )
};

function createMaterial(texture, options = {}) {
  return new THREE.MeshLambertMaterial({
    map: texture,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    alphaTest: options.alphaTest ?? 0,
    side: THREE.FrontSide
  });
}

const grassSideMaterial = createMaterial(textures.grassSide);
const grassTopMaterial = createMaterial(textures.grassTop);
const dirtMaterial = createMaterial(textures.dirt);
const stoneMaterial = createMaterial(textures.stone);
const bedrockMaterial = createMaterial(textures.bedrock);
const woodSideMaterial = createMaterial(textures.woodSide);
const woodTopMaterial = createMaterial(textures.woodTop);
const sandMaterial = createMaterial(textures.sand);

const leavesMaterial = createMaterial(textures.leaves, {
  transparent: true,
  alphaTest: 0.12
});

const blockMaterials = {
  grass: [
    grassSideMaterial,
    grassSideMaterial,
    grassTopMaterial,
    dirtMaterial,
    grassSideMaterial,
    grassSideMaterial
  ],

  dirt: dirtMaterial,
  stone: stoneMaterial,
  bedrock: bedrockMaterial,

  wood: [
    woodSideMaterial,
    woodSideMaterial,
    woodTopMaterial,
    woodTopMaterial,
    woodSideMaterial,
    woodSideMaterial
  ],

  leaves: leavesMaterial,
  sand: sandMaterial
};

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function addBlock(x, y, z, type, updateArray = true) {
  const key = blockKey(x, y, z);

  if (
    blocks.has(key) ||
    y < 0 ||
    y > MAX_BUILD_HEIGHT
  ) {
    return null;
  }

  const mesh = new THREE.Mesh(
    blockGeometry,
    blockMaterials[type]
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = type !== "leaves";
  mesh.receiveShadow = true;

  mesh.userData = {
    type,
    x,
    y,
    z
  };

  scene.add(mesh);
  blocks.set(key, mesh);

  if (updateArray) {
    blockMeshes.push(mesh);
  }

  return mesh;
}

function removeBlock(mesh) {
  if (!mesh || mesh.userData.type === "bedrock") {
    return;
  }

  const { x, y, z } = mesh.userData;
  const key = blockKey(x, y, z);

  scene.remove(mesh);
  blocks.delete(key);

  const index = blockMeshes.indexOf(mesh);

  if (index !== -1) {
    blockMeshes.splice(index, 1);
  }
}

function smoothNoise(x, z, scale, seed) {
  const scaledX = x / scale;
  const scaledZ = z / scale;

  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const sx = scaledX - x0;
  const sz = scaledZ - z0;

  const fadeX = sx * sx * (3 - 2 * sx);
  const fadeZ = sz * sz * (3 - 2 * sz);

  const n00 = seededRandom(x0, z0, seed);
  const n10 = seededRandom(x1, z0, seed);
  const n01 = seededRandom(x0, z1, seed);
  const n11 = seededRandom(x1, z1, seed);

  const nx0 = THREE.MathUtils.lerp(n00, n10, fadeX);
  const nx1 = THREE.MathUtils.lerp(n01, n11, fadeX);

  return THREE.MathUtils.lerp(nx0, nx1, fadeZ);
}

function getTerrainHeight(x, z) {
  const largeHills = smoothNoise(x, z, 15, 4) * 5;
  const smallHills = smoothNoise(x, z, 6, 18) * 2;
  const waves = Math.sin(x * 0.14) * 0.65 +
    Math.cos(z * 0.12) * 0.55;

  return Math.floor(3 + largeHills + smallHills + waves);
}

function addTree(x, groundY, z) {
  const trunkHeight = 4 + Math.floor(
    seededRandom(x, z, 30) * 2
  );

  for (let y = 1; y <= trunkHeight; y += 1) {
    addBlock(x, groundY + y, z, "wood");
  }

  const leafCenterY = groundY + trunkHeight;

  for (let ox = -2; ox <= 2; ox += 1) {
    for (let oy = -2; oy <= 2; oy += 1) {
      for (let oz = -2; oz <= 2; oz += 1) {
        const distance =
          Math.abs(ox) +
          Math.abs(oy) +
          Math.abs(oz);

        const randomValue = seededRandom(
          x + ox,
          z + oz,
          oy + 57
        );

        if (
          distance <= 4 &&
          randomValue > 0.13
        ) {
          const leafX = x + ox;
          const leafY = leafCenterY + oy;
          const leafZ = z + oz;

          if (!blocks.has(blockKey(leafX, leafY, leafZ))) {
            addBlock(leafX, leafY, leafZ, "leaves");
          }
        }
      }
    }
  }

  addBlock(x, leafCenterY + 2, z, "leaves");
}

function generateWorld() {
  const treeCandidates = [];

  for (let x = -HALF_WORLD; x < HALF_WORLD; x += 1) {
    for (let z = -HALF_WORLD; z < HALF_WORLD; z += 1) {
      const height = getTerrainHeight(x, z);
      const beachLevel = 5;

      for (let y = 0; y <= height; y += 1) {
        let type = "stone";

        if (y === 0) {
          type = "bedrock";
        } else if (y === height) {
          type = height <= beachLevel ? "sand" : "grass";
        } else if (y >= height - 3) {
          type = height <= beachLevel ? "sand" : "dirt";
        }

        addBlock(x, y, z, type);
      }

      const treeChance = seededRandom(x, z, 88);
      const distanceFromSpawn = Math.sqrt(x * x + z * z);

      if (
        treeChance > 0.965 &&
        height > beachLevel &&
        distanceFromSpawn > 5 &&
        x > -HALF_WORLD + 3 &&
        x < HALF_WORLD - 3 &&
        z > -HALF_WORLD + 3 &&
        z < HALF_WORLD - 3
      ) {
        treeCandidates.push({
          x,
          y: height,
          z
        });
      }
    }
  }

  for (const tree of treeCandidates) {
    let tooClose = false;

    for (const other of treeCandidates) {
      if (other === tree) {
        break;
      }

      const dx = tree.x - other.x;
      const dz = tree.z - other.z;

      if (Math.sqrt(dx * dx + dz * dz) < 4) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      addTree(tree.x, tree.y, tree.z);
    }
  }
}

function createSky() {
  const skyGeometry = new THREE.SphereGeometry(130, 24, 16);

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: {
        value: new THREE.Color(0x3b94dd)
      },

      bottomColor: {
        value: new THREE.Color(0xcbeafa)
      },

      offset: {
        value: 8
      },

      exponent: {
        value: 0.7
      }
    },

    vertexShader: `
      varying vec3 worldPosition;

      void main() {
        vec4 worldPositionValue = modelMatrix * vec4(position, 1.0);
        worldPosition = worldPositionValue.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;

      varying vec3 worldPosition;

      void main() {
        float heightFactor = normalize(worldPosition + offset).y;
        float gradient = max(pow(max(heightFactor, 0.0), exponent), 0.0);

        gl_FragColor = vec4(
          mix(bottomColor, topColor, gradient),
          1.0
        );
      }
    `
  });

  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);
}

function createCloud() {
  const cloudGroup = new THREE.Group();

  const cloudMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.88
  });

  const pieces = 4 + Math.floor(Math.random() * 4);

  for (let i = 0; i < pieces; i += 1) {
    const width = 3 + Math.random() * 4;
    const depth = 1.5 + Math.random() * 2;

    const geometry = new THREE.BoxGeometry(
      width,
      0.7,
      depth
    );

    const piece = new THREE.Mesh(geometry, cloudMaterial);

    piece.position.set(
      i * 2.5,
      Math.random() * 0.25,
      (Math.random() - 0.5) * 2
    );

    cloudGroup.add(piece);
  }

  cloudGroup.position.set(
    -70 + Math.random() * 140,
    22 + Math.random() * 9,
    -70 + Math.random() * 140
  );

  cloudGroup.userData.speed = 0.45 + Math.random() * 0.3;

  scene.add(cloudGroup);
  clouds.push(cloudGroup);
}

function createClouds() {
  for (let i = 0; i < 12; i += 1) {
    createCloud();
  }
}

function createLighting() {
  const ambientLight = new THREE.HemisphereLight(
    0xdff3ff,
    0x49633e,
    1.55
  );

  scene.add(ambientLight);

  const sunlight = new THREE.DirectionalLight(
    0xfff3cf,
    2.1
  );

  sunlight.position.set(35, 55, 25);
  sunlight.castShadow = true;

  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.camera.left = -38;
  sunlight.shadow.camera.right = 38;
  sunlight.shadow.camera.top = 38;
  sunlight.shadow.camera.bottom = -38;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 130;
  sunlight.shadow.bias = -0.0006;

  scene.add(sunlight);

  const sunGeometry = new THREE.BoxGeometry(7, 7, 1);
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff2a6,
    fog: false
  });

  const sun = new THREE.Mesh(sunGeometry, sunMaterial);

  sun.position.set(-45, 52, -80);
  sun.lookAt(0, 10, 0);

  scene.add(sun);
}

function getHighestSolidBlock(x, z) {
  const roundedX = Math.round(x);
  const roundedZ = Math.round(z);

  for (let y = MAX_BUILD_HEIGHT; y >= 0; y -= 1) {
    const block = blocks.get(
      blockKey(roundedX, y, roundedZ)
    );

    if (
      block &&
      block.userData.type !== "leaves" &&
      block.userData.type !== "wood"
    ) {
      return y;
    }
  }

  return 0;
}

function resetPlayerPosition() {
  const spawnX = 0;
  const spawnZ = 0;
  const spawnGroundY = getHighestSolidBlock(
    spawnX,
    spawnZ
  );

  camera.position.set(
    spawnX,
    spawnGroundY + EYE_HEIGHT + 1,
    spawnZ
  );

  velocity.set(0, 0, 0);
}

function playerIntersectsBlock(x, y, z) {
  const playerFeetY = camera.position.y - EYE_HEIGHT;
  const playerHeadY = playerFeetY + PLAYER_HEIGHT;

  const blockMinX = x - 0.5;
  const blockMaxX = x + 0.5;
  const blockMinY = y - 0.5;
  const blockMaxY = y + 0.5;
  const blockMinZ = z - 0.5;
  const blockMaxZ = z + 0.5;

  return (
    camera.position.x + PLAYER_RADIUS > blockMinX &&
    camera.position.x - PLAYER_RADIUS < blockMaxX &&
    playerHeadY > blockMinY &&
    playerFeetY < blockMaxY &&
    camera.position.z + PLAYER_RADIUS > blockMinZ &&
    camera.position.z - PLAYER_RADIUS < blockMaxZ
  );
}

function getNearbyBlocks() {
  const blocksNearby = [];

  const minX = Math.floor(
    camera.position.x - PLAYER_RADIUS - 1
  );

  const maxX = Math.ceil(
    camera.position.x + PLAYER_RADIUS + 1
  );

  const playerFeetY = camera.position.y - EYE_HEIGHT;

  const minY = Math.floor(playerFeetY - 1);
  const maxY = Math.ceil(playerFeetY + PLAYER_HEIGHT + 1);

  const minZ = Math.floor(
    camera.position.z - PLAYER_RADIUS - 1
  );

  const maxZ = Math.ceil(
    camera.position.z + PLAYER_RADIUS + 1
  );

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const block = blocks.get(blockKey(x, y, z));

        if (block) {
          blocksNearby.push(block);
        }
      }
    }
  }

  return blocksNearby;
}

function resolveHorizontalCollision(axis, previousValue) {
  const nearbyBlocks = getNearbyBlocks();

  for (const block of nearbyBlocks) {
    const { x, y, z } = block.userData;

    if (playerIntersectsBlock(x, y, z)) {
      camera.position[axis] = previousValue;
      return true;
    }
  }

  return false;
}

function resolveVerticalCollision(previousY) {
  const nearbyBlocks = getNearbyBlocks();
  let collided = false;

  for (const block of nearbyBlocks) {
    const { x, y, z } = block.userData;

    if (!playerIntersectsBlock(x, y, z)) {
      continue;
    }

    collided = true;

    if (velocity.y <= 0) {
      const blockTop = y + 0.5;

      camera.position.y = blockTop + EYE_HEIGHT;
      velocity.y = 0;
      canJump = true;
    } else {
      camera.position.y = previousY;
      velocity.y = 0;
    }

    break;
  }

  if (!collided) {
    canJump = false;
  }
}

function updatePlayer(delta) {
  if (!controls.isLocked) {
    return;
  }

  const sprinting =
    keys.ShiftLeft ||
    keys.ShiftRight;

  const currentSpeed = sprinting
    ? SPRINT_SPEED
    : WALK_SPEED;

  direction.set(0, 0, 0);

  if (keys.KeyW) {
    direction.z += 1;
  }

  if (keys.KeyS) {
    direction.z -= 1;
  }

  if (keys.KeyA) {
    direction.x -= 1;
  }

  if (keys.KeyD) {
    direction.x += 1;
  }

  if (direction.lengthSq() > 0) {
    direction.normalize();
  }

  velocity.y -= GRAVITY * delta;

  const moveX = direction.x * currentSpeed * delta;
  const moveZ = direction.z * currentSpeed * delta;

  const previousX = camera.position.x;
  controls.moveRight(moveX);
  resolveHorizontalCollision("x", previousX);

  const previousZ = camera.position.z;
  controls.moveForward(moveZ);
  resolveHorizontalCollision("z", previousZ);

  const previousY = camera.position.y;
  camera.position.y += velocity.y * delta;
  resolveVerticalCollision(previousY);

  if (camera.position.y < -10) {
    resetPlayerPosition();
  }

  const worldLimit = HALF_WORLD + 1;

  camera.position.x = THREE.MathUtils.clamp(
    camera.position.x,
    -worldLimit,
    worldLimit
  );

  camera.position.z = THREE.MathUtils.clamp(
    camera.position.z,
    -worldLimit,
    worldLimit
  );
}

function getTargetedBlock() {
  raycaster.setFromCamera(centerScreen, camera);
  raycaster.far = BLOCK_REACH;

  const intersections = raycaster.intersectObjects(
    blockMeshes,
    false
  );

  if (intersections.length === 0) {
    return null;
  }

  return intersections[0];
}

function breakTargetedBlock() {
  const target = getTargetedBlock();

  if (!target) {
    return;
  }

  removeBlock(target.object);
}

function placeTargetedBlock() {
  const target = getTargetedBlock();

  if (!target || !target.face) {
    return;
  }

  const normal = target.face.normal.clone();
  const position = target.object.position.clone().add(normal);

  const x = Math.round(position.x);
  const y = Math.round(position.y);
  const z = Math.round(position.z);

  if (
    blocks.has(blockKey(x, y, z)) ||
    y < 0 ||
    y > MAX_BUILD_HEIGHT
  ) {
    return;
  }

  if (playerIntersectsBlock(x, y, z)) {
    return;
  }

  addBlock(
    x,
    y,
    z,
    blockTypes[selectedBlockIndex].key
  );
}

function selectHotbarSlot(index) {
  if (
    index < 0 ||
    index >= blockTypes.length
  ) {
    return;
  }

  selectedBlockIndex = index;

  document.querySelectorAll(".hotbar-slot").forEach(
    (slot, slotIndex) => {
      slot.classList.toggle(
        "selected",
        slotIndex === selectedBlockIndex
      );
    }
  );

  selectedBlockNameElement.textContent =
    blockTypes[selectedBlockIndex].name;
}

function updateClouds(delta) {
  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.speed * delta;

    if (cloud.position.x > 75) {
      cloud.position.x = -75;
    }
  }
}

function updateDebug(delta) {
  fpsFrames += 1;
  fpsTimer += delta;

  if (fpsTimer >= 0.5) {
    const currentFps = Math.round(
      fpsFrames / fpsTimer
    );

    fpsElement.textContent = `FPS: ${currentFps}`;

    fpsFrames = 0;
    fpsTimer = 0;
  }

  positionElement.textContent =
    `XYZ: ${camera.position.x.toFixed(1)} / ` +
    `${camera.position.y.toFixed(1)} / ` +
    `${camera.position.z.toFixed(1)}`;
}

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const delta = Math.min(
    (currentTime - previousTime) / 1000,
    0.05
  );

  previousTime = currentTime;

  updatePlayer(delta);
  updateClouds(delta);
  updateDebug(delta);

  renderer.render(scene, camera);
}

playButton.addEventListener("click", () => {
  controls.lock();
});

resumeButton.addEventListener("click", () => {
  controls.lock();
});

restartButton.addEventListener("click", () => {
  window.location.reload();
});

controls.addEventListener("lock", () => {
  startScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  hud.classList.remove("hidden");
});

controls.addEventListener("unlock", () => {
  if (!startScreen.classList.contains("hidden")) {
    return;
  }

  pauseScreen.classList.remove("hidden");
});

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (
    event.code === "Space" &&
    controls.isLocked &&
    canJump
  ) {
    velocity.y = JUMP_SPEED;
    canJump = false;
  }

  if (
    event.code.startsWith("Digit") &&
    controls.isLocked
  ) {
    const index = Number(
      event.code.replace("Digit", "")
    ) - 1;

    selectHotbarSlot(index);
  }
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

document.addEventListener("mousedown", (event) => {
  if (!controls.isLocked) {
    return;
  }

  if (event.button === 0) {
    breakTargetedBlock();
  }

  if (event.button === 2) {
    placeTargetedBlock();
  }
});

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

document.addEventListener("wheel", (event) => {
  if (!controls.isLocked) {
    return;
  }

  const directionValue = Math.sign(event.deltaY);

  selectedBlockIndex =
    (
      selectedBlockIndex +
      directionValue +
      blockTypes.length
    ) %
    blockTypes.length;

  selectHotbarSlot(selectedBlockIndex);
});

window.addEventListener("resize", () => {
  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );
});

createSky();
createLighting();
generateWorld();
createClouds();
resetPlayerPosition();
selectHotbarSlot(0);
animate();
