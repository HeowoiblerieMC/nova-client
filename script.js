const container = document.getElementById("game-container");
const startScreen = document.getElementById("start-screen");
const pauseScreen = document.getElementById("pause-screen");
const hud = document.getElementById("hud");

const playButton = document.getElementById("play-button");
const loadButton = document.getElementById("load-button");
const resumeButton = document.getElementById("resume-button");
const saveButton = document.getElementById("save-button");
const newWorldButton = document.getElementById("new-world-button");
const mobilePauseButton = document.getElementById("mobile-pause-button");

const fpsElement = document.getElementById("fps");
const positionElement = document.getElementById("position");
const blockCountElement = document.getElementById("block-count");
const notificationElement = document.getElementById("notification");
const selectedBlockNameElement = document.getElementById(
  "selected-block-name"
);
const deviceMessageElement = document.getElementById("device-message");

const isTouchDevice =
  window.matchMedia("(pointer: coarse)").matches ||
  navigator.maxTouchPoints > 0;

if (isTouchDevice) {
  document.body.classList.add("touch-device");
  deviceMessageElement.textContent =
    "Touch controls, Sneak, and Rush are enabled.";
} else {
  deviceMessageElement.textContent =
    "WASD Move, Shift Rush, C Sneak, Space Jump.";
}

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x89c8ef);
scene.fog = new THREE.Fog(0xa8d6ed, 45, 150);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  260
);

camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, isTouchDevice ? 1.25 : 1.8)
);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

container.appendChild(renderer.domElement);

const controls = new THREE.PointerLockControls(
  camera,
  document.body
);

const SAVE_KEY = "nova-client-infinite-world-v1";

const CHUNK_SIZE = 16;
const TOUCH_RENDER_DISTANCE = 2;
const DESKTOP_RENDER_DISTANCE = 3;
const RENDER_DISTANCE = isTouchDevice
  ? TOUCH_RENDER_DISTANCE
  : DESKTOP_RENDER_DISTANCE;

const VERTICAL_BUILD_LIMIT = 48;
const BASE_GROUND_LEVEL = 8;

const STANDING_EYE_HEIGHT = 1.62;
const SNEAKING_EYE_HEIGHT = 1.32;
const PLAYER_HEIGHT = 1.75;
const SNEAK_PLAYER_HEIGHT = 1.45;
const PLAYER_RADIUS = 0.3;

const WALK_SPEED = 4.6;
const RUSH_SPEED = 7.4;
const SNEAK_SPEED = 2.1;
const JUMP_SPEED = 7.2;
const GRAVITY = 20;
const BLOCK_REACH = 6;

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
const movementDirection = new THREE.Vector3();
const velocity = new THREE.Vector3();

const keyState = {};
const loadedChunks = new Map();
const blockLookup = new Map();
const editedBlocks = new Map();
const removedBlocks = new Set();

let worldSeed = Math.floor(Math.random() * 1000000000);
let selectedBlockIndex = 0;
let canJump = false;
let isSneaking = false;
let isRushing = false;
let gameStarted = false;
let gamePaused = false;

let currentEyeHeight = STANDING_EYE_HEIGHT;
let currentPlayerHeight = PLAYER_HEIGHT;

let previousTime = performance.now();
let fpsTimer = 0;
let fpsFrames = 0;
let notificationTimer = null;

let touchLookPointerId = null;
let previousPointerX = 0;
let previousPointerY = 0;

let lastChunkX = Number.NaN;
let lastChunkZ = Number.NaN;

const blockTypes = [
  {
    key: "grass",
    name: "Grass Block",
    colors: ["#559b42", "#79bd59", "#3e7d34"]
  },
  {
    key: "dirt",
    name: "Dirt",
    colors: ["#765039", "#936746", "#5f3e2d"]
  },
  {
    key: "stone",
    name: "Stone",
    colors: ["#7d7d7d", "#9a9a9a", "#626262"]
  },
  {
    key: "cobblestone",
    name: "Cobblestone",
    colors: ["#6d6d6d", "#8b8b8b", "#515151"]
  },
  {
    key: "sand",
    name: "Sand",
    colors: ["#d8c37f", "#ead99a", "#baa663"]
  },
  {
    key: "wood",
    name: "Oak Log",
    colors: ["#76502d", "#9a7041", "#55371f"]
  },
  {
    key: "planks",
    name: "Oak Planks",
    colors: ["#b0834f", "#cf9e60", "#896136"]
  },
  {
    key: "leaves",
    name: "Oak Leaves",
    colors: ["#32703a", "#478d4a", "#24572f"],
    transparent: true
  },
  {
    key: "bricks",
    name: "Bricks",
    colors: ["#8c4638", "#ad5e4c", "#6c332d"]
  },
  {
    key: "glass",
    name: "Glass",
    colors: ["#b5e8ec", "#d8f7f8", "#84cbd2"],
    transparent: true,
    opacity: 0.55
  },
  {
    key: "coal",
    name: "Coal Ore",
    colors: ["#737373", "#252525", "#555555"]
  },
  {
    key: "iron",
    name: "Iron Ore",
    colors: ["#7b7b7b", "#b68b68", "#d2a27b"]
  },
  {
    key: "gold",
    name: "Gold Ore",
    colors: ["#797979", "#e2b92e", "#f4d54d"]
  },
  {
    key: "diamond",
    name: "Diamond Ore",
    colors: ["#737373", "#31c6c4", "#62efea"]
  },
  {
    key: "emerald",
    name: "Emerald Block",
    colors: ["#139f55", "#3fe987", "#087139"]
  },
  {
    key: "bedrock",
    name: "Bedrock",
    colors: ["#303030", "#555555", "#171717"],
    unbreakable: true
  }
];

function createPixelTexture(colors, pattern = "noise") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = 16;
  canvas.height = 16;

  context.fillStyle = colors[0];
  context.fillRect(0, 0, 16, 16);

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const randomValue = hashNoise(x, y, colors.length * 131);

      if (randomValue > 0.42) {
        const index = Math.floor(
          randomValue * colors.length
        ) % colors.length;

        context.fillStyle = colors[index];

        if (pattern === "planks" && y % 5 === 0) {
          context.fillStyle = "#5d4127";
        }

        if (pattern === "bricks") {
          const horizontalLine = y % 5 === 0;
          const offset = Math.floor(y / 5) % 2 === 0 ? 0 : 4;
          const verticalLine = (x + offset) % 8 === 0;

          if (horizontalLine || verticalLine) {
            context.fillStyle = "#5a302a";
          }
        }

        context.fillRect(x, y, 1, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function createBlockMaterial(blockType) {
  const pattern =
    blockType.key === "planks"
      ? "planks"
      : blockType.key === "bricks"
        ? "bricks"
        : "noise";

  return new THREE.MeshLambertMaterial({
    map: createPixelTexture(blockType.colors, pattern),
    transparent: blockType.transparent ?? false,
    opacity: blockType.opacity ?? 1,
    alphaTest: blockType.key === "leaves" ? 0.15 : 0,
    depthWrite: blockType.key !== "glass"
  });
}

const blockMaterials = {};

for (const blockType of blockTypes) {
  blockMaterials[blockType.key] =
    createBlockMaterial(blockType);
}

function hashNoise(x, z, seedOffset = 0) {
  const value = Math.sin(
    x * 127.1 +
    z * 311.7 +
    (worldSeed + seedOffset) * 0.000731
  ) * 43758.5453123;

  return value - Math.floor(value);
}

function smoothNoise(x, z, scale, seedOffset) {
  const scaledX = x / scale;
  const scaledZ = z / scale;

  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const fractionX = scaledX - x0;
  const fractionZ = scaledZ - z0;

  const fadeX =
    fractionX * fractionX * (3 - 2 * fractionX);

  const fadeZ =
    fractionZ * fractionZ * (3 - 2 * fractionZ);

  const n00 = hashNoise(x0, z0, seedOffset);
  const n10 = hashNoise(x1, z0, seedOffset);
  const n01 = hashNoise(x0, z1, seedOffset);
  const n11 = hashNoise(x1, z1, seedOffset);

  const nx0 = THREE.MathUtils.lerp(n00, n10, fadeX);
  const nx1 = THREE.MathUtils.lerp(n01, n11, fadeX);

  return THREE.MathUtils.lerp(nx0, nx1, fadeZ);
}

function getTerrainHeight(x, z) {
  const continent =
    smoothNoise(x, z, 80, 10) * 8;

  const hills =
    smoothNoise(x, z, 28, 20) * 7;

  const detail =
    smoothNoise(x, z, 9, 30) * 2.5;

  return Math.max(
    4,
    Math.floor(
      BASE_GROUND_LEVEL +
      continent +
      hills +
      detail
    )
  );
}

function positionKey(x, y, z) {
  return `${x},${y},${z}`;
}

function chunkKey(chunkX, chunkZ) {
  return `${chunkX},${chunkZ}`;
}

function worldToChunk(value) {
  return Math.floor(value / CHUNK_SIZE);
}

function getGeneratedBlockType(x, y, z) {
  const height = getTerrainHeight(x, z);

  if (y < 0 || y > height) {
    return null;
  }

  if (y === 0) {
    return "bedrock";
  }

  if (y === height) {
    return height <= 7 ? "sand" : "grass";
  }

  if (y >= height - 3) {
    return height <= 7 ? "sand" : "dirt";
  }

  const oreNoise = hashNoise(
    x * 17 + y * 37,
    z * 23 - y * 13,
    700
  );

  if (y < 8 && oreNoise > 0.993) {
    return "diamond";
  }

  if (y < 12 && oreNoise > 0.985) {
    return "gold";
  }

  if (y < 18 && oreNoise > 0.965) {
    return "iron";
  }

  if (oreNoise > 0.94) {
    return "coal";
  }

  return "stone";
}

function getWorldBlock(x, y, z) {
  const key = positionKey(x, y, z);

  if (removedBlocks.has(key)) {
    return null;
  }

  if (editedBlocks.has(key)) {
    return editedBlocks.get(key);
  }

  return getGeneratedBlockType(x, y, z);
}

function createTreeBlocks(x, groundY, z, chunkBlocks) {
  const trunkHeight =
    4 + Math.floor(hashNoise(x, z, 900) * 3);

  for (let y = 1; y <= trunkHeight; y += 1) {
    chunkBlocks.push({
      x,
      y: groundY + y,
      z,
      type: "wood"
    });
  }

  const leafCenterY = groundY + trunkHeight;

  for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      for (let offsetZ = -2; offsetZ <= 2; offsetZ += 1) {
        const distance =
          Math.abs(offsetX) +
          Math.abs(offsetY) +
          Math.abs(offsetZ);

        if (
          distance <= 4 &&
          hashNoise(
            x + offsetX,
            z + offsetZ,
            offsetY + 300
          ) > 0.12
        ) {
          chunkBlocks.push({
            x: x + offsetX,
            y: leafCenterY + offsetY,
            z: z + offsetZ,
            type: "leaves"
          });
        }
      }
    }
  }
}

function generateChunkData(chunkX, chunkZ) {
  const chunkBlocks = [];
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;

  for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
    for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
      const x = startX + localX;
      const z = startZ + localZ;
      const height = getTerrainHeight(x, z);

      const minimumY = Math.max(0, height - 6);

      for (let y = minimumY; y <= height; y += 1) {
        const key = positionKey(x, y, z);

        if (removedBlocks.has(key)) {
          continue;
        }

        const editedType = editedBlocks.get(key);
        const type =
          editedType ?? getGeneratedBlockType(x, y, z);

        if (type) {
          chunkBlocks.push({
            x,
            y,
            z,
            type
          });
        }
      }

      const treeChance = hashNoise(x, z, 850);

      if (
        treeChance > 0.988 &&
        height > 8 &&
        localX >= 2 &&
        localX <= CHUNK_SIZE - 3 &&
        localZ >= 2 &&
        localZ <= CHUNK_SIZE - 3
      ) {
        createTreeBlocks(x, height, z, chunkBlocks);
      }
    }
  }

  for (const [key, type] of editedBlocks.entries()) {
    const [x, y, z] = key.split(",").map(Number);

    if (
      worldToChunk(x) === chunkX &&
      worldToChunk(z) === chunkZ &&
      !chunkBlocks.some(
        (block) =>
          block.x === x &&
          block.y === y &&
          block.z === z
      )
    ) {
      chunkBlocks.push({
        x,
        y,
        z,
        type
      });
    }
  }

  return chunkBlocks;
}

function createChunkMesh(chunkX, chunkZ) {
  const key = chunkKey(chunkX, chunkZ);

  if (loadedChunks.has(key)) {
    return;
  }

  const blocks = generateChunkData(chunkX, chunkZ);
  const group = new THREE.Group();

  group.userData.chunkX = chunkX;
  group.userData.chunkZ = chunkZ;

  const blocksByType = {};

  for (const block of blocks) {
    if (!blocksByType[block.type]) {
      blocksByType[block.type] = [];
    }

    blocksByType[block.type].push(block);
    blockLookup.set(
      positionKey(block.x, block.y, block.z),
      block.type
    );
  }

  const temporaryMatrix = new THREE.Matrix4();

  for (const [type, typeBlocks] of Object.entries(blocksByType)) {
    const mesh = new THREE.InstancedMesh(
      blockGeometry,
      blockMaterials[type],
      typeBlocks.length
    );

    mesh.userData.blockType = type;
    mesh.userData.blocks = typeBlocks;

    typeBlocks.forEach((block, index) => {
      temporaryMatrix.makeTranslation(
        block.x,
        block.y,
        block.z
      );

      mesh.setMatrixAt(index, temporaryMatrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  scene.add(group);

  loadedChunks.set(key, {
    group,
    blocks
  });
}

function unloadChunk(chunkX, chunkZ) {
  const key = chunkKey(chunkX, chunkZ);
  const chunk = loadedChunks.get(key);

  if (!chunk) {
    return;
  }

  for (const block of chunk.blocks) {
    blockLookup.delete(
      positionKey(block.x, block.y, block.z)
    );
  }

  scene.remove(chunk.group);

  for (const child of chunk.group.children) {
    child.dispose?.();
  }

  loadedChunks.delete(key);
}

function reloadChunkAtWorldPosition(x, z) {
  const chunkX = worldToChunk(x);
  const chunkZ = worldToChunk(z);

  unloadChunk(chunkX, chunkZ);
  createChunkMesh(chunkX, chunkZ);
}

function updateLoadedChunks(force = false) {
  const playerChunkX = worldToChunk(camera.position.x);
  const playerChunkZ = worldToChunk(camera.position.z);

  if (
    !force &&
    playerChunkX === lastChunkX &&
    playerChunkZ === lastChunkZ
  ) {
    return;
  }

  lastChunkX = playerChunkX;
  lastChunkZ = playerChunkZ;

  const requiredChunks = new Set();

  for (
    let offsetX = -RENDER_DISTANCE;
    offsetX <= RENDER_DISTANCE;
    offsetX += 1
  ) {
    for (
      let offsetZ = -RENDER_DISTANCE;
      offsetZ <= RENDER_DISTANCE;
      offsetZ += 1
    ) {
      const chunkX = playerChunkX + offsetX;
      const chunkZ = playerChunkZ + offsetZ;
      const key = chunkKey(chunkX, chunkZ);

      requiredChunks.add(key);
      createChunkMesh(chunkX, chunkZ);
    }
  }

  for (const [key, chunk] of loadedChunks.entries()) {
    if (!requiredChunks.has(key)) {
      unloadChunk(
        chunk.group.userData.chunkX,
        chunk.group.userData.chunkZ
      );
    }
  }

  updateBlockCounter();
}

function updateBlockCounter() {
  let loadedBlockCount = 0;

  for (const chunk of loadedChunks.values()) {
    loadedBlockCount += chunk.blocks.length;
  }

  blockCountElement.textContent =
    `LOADED: ${loadedBlockCount} | CHUNKS: ${loadedChunks.size}`;
}

function createSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0x88c9ef,
      side: THREE.BackSide,
      fog: false
    })
  );

  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.BoxGeometry(8, 8, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffef9e,
      fog: false
    })
  );

  sun.position.set(-70, 80, -120);
  sun.lookAt(0, 20, 0);

  scene.add(sun);
}

function createLighting() {
  scene.add(
    new THREE.HemisphereLight(
      0xe4f6ff,
      0x46613d,
      1.55
    )
  );

  const sunlight = new THREE.DirectionalLight(
    0xfff2ce,
    1.7
  );

  sunlight.position.set(40, 70, 30);
  scene.add(sunlight);
}

function addMobileControlStyles() {
  const style = document.createElement("style");

  style.textContent = `
    #extra-action-controls {
      display: contents;
    }

    #sneak-button,
    #rush-button {
      width: 72px;
      height: 48px;
      font-size: 10px;
    }

    #sneak-button.active,
    #rush-button.active {
      color: #031009;
      background: #43ef88;
      box-shadow: 0 0 18px rgba(67, 239, 136, 0.42);
    }

    @media (max-width: 600px) {
      #sneak-button,
      #rush-button {
        width: 63px;
      }
    }
  `;

  document.head.appendChild(style);
}

function addMobileActionButtons() {
  const actionControls = document.getElementById(
    "action-controls"
  );

  if (!actionControls) {
    return;
  }

  const sneakButton = document.createElement("button");

  sneakButton.id = "sneak-button";
  sneakButton.type = "button";
  sneakButton.className = "mobile-control action-button";
  sneakButton.textContent = "SNEAK";

  const rushButton = document.createElement("button");

  rushButton.id = "rush-button";
  rushButton.type = "button";
  rushButton.className = "mobile-control action-button";
  rushButton.textContent = "RUSH";

  const jumpButton = document.getElementById("jump-button");

  actionControls.insertBefore(sneakButton, jumpButton);
  actionControls.insertBefore(rushButton, jumpButton);

  return {
    sneakButton,
    rushButton
  };
}

function updateSneakState() {
  isSneaking =
    Boolean(keyState.ControlLeft) ||
    Boolean(keyState.ControlRight) ||
    Boolean(keyState.KeyC);

  const targetEyeHeight = isSneaking
    ? SNEAKING_EYE_HEIGHT
    : STANDING_EYE_HEIGHT;

  currentEyeHeight = THREE.MathUtils.lerp(
    currentEyeHeight,
    targetEyeHeight,
    0.25
  );

  currentPlayerHeight = isSneaking
    ? SNEAK_PLAYER_HEIGHT
    : PLAYER_HEIGHT;
}

function getPlayerFeetY() {
  return camera.position.y - currentEyeHeight;
}

function playerIntersectsBlock(x, y, z) {
  const feetY = getPlayerFeetY();
  const headY = feetY + currentPlayerHeight;

  return (
    camera.position.x + PLAYER_RADIUS > x - 0.5 &&
    camera.position.x - PLAYER_RADIUS < x + 0.5 &&
    headY > y - 0.5 &&
    feetY < y + 0.5 &&
    camera.position.z + PLAYER_RADIUS > z - 0.5 &&
    camera.position.z - PLAYER_RADIUS < z + 0.5
  );
}

function getNearbyBlocks() {
  const blocks = [];
  const feetY = getPlayerFeetY();

  const minimumX = Math.floor(
    camera.position.x - PLAYER_RADIUS - 1
  );

  const maximumX = Math.ceil(
    camera.position.x + PLAYER_RADIUS + 1
  );

  const minimumY = Math.floor(feetY - 1);

  const maximumY = Math.ceil(
    feetY + currentPlayerHeight + 1
  );

  const minimumZ = Math.floor(
    camera.position.z - PLAYER_RADIUS - 1
  );

  const maximumZ = Math.ceil(
    camera.position.z + PLAYER_RADIUS + 1
  );

  for (let x = minimumX; x <= maximumX; x += 1) {
    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let z = minimumZ; z <= maximumZ; z += 1) {
        const type = getWorldBlock(x, y, z);

        if (type) {
          blocks.push({
            x,
            y,
            z,
            type
          });
        }
      }
    }
  }

  return blocks;
}

function resolveHorizontalCollision(axis, previousValue) {
  for (const block of getNearbyBlocks()) {
    if (
      playerIntersectsBlock(
        block.x,
        block.y,
        block.z
      )
    ) {
      camera.position[axis] = previousValue;
      return true;
    }
  }

  return false;
}

function resolveVerticalCollision(previousY) {
  let collided = false;

  for (const block of getNearbyBlocks()) {
    if (
      !playerIntersectsBlock(
        block.x,
        block.y,
        block.z
      )
    ) {
      continue;
    }

    collided = true;

    if (velocity.y <= 0) {
      camera.position.y =
        block.y + 0.5 + currentEyeHeight;

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

function hasGroundBelow(x, z) {
  const feetY = getPlayerFeetY();
  const checkY = Math.floor(feetY - 0.15);

  const offsets = [
    [-PLAYER_RADIUS, -PLAYER_RADIUS],
    [PLAYER_RADIUS, -PLAYER_RADIUS],
    [-PLAYER_RADIUS, PLAYER_RADIUS],
    [PLAYER_RADIUS, PLAYER_RADIUS]
  ];

  return offsets.some(([offsetX, offsetZ]) => {
    return Boolean(
      getWorldBlock(
        Math.floor(x + offsetX + 0.5),
        checkY,
        Math.floor(z + offsetZ + 0.5)
      )
    );
  });
}

function updatePlayer(delta) {
  if (
    !gameStarted ||
    gamePaused ||
    (!isTouchDevice && !controls.isLocked)
  ) {
    return;
  }

  updateSneakState();

  isRushing =
    Boolean(keyState.ShiftLeft) ||
    Boolean(keyState.ShiftRight);

  let speed = WALK_SPEED;

  if (isSneaking) {
    speed = SNEAK_SPEED;
  } else if (isRushing) {
    speed = RUSH_SPEED;
  }

  movementDirection.set(0, 0, 0);

  if (keyState.KeyW) {
    movementDirection.z += 1;
  }

  if (keyState.KeyS) {
    movementDirection.z -= 1;
  }

  if (keyState.KeyA) {
    movementDirection.x -= 1;
  }

  if (keyState.KeyD) {
    movementDirection.x += 1;
  }

  if (movementDirection.lengthSq() > 0) {
    movementDirection.normalize();
  }

  velocity.y -= GRAVITY * delta;

  const sidewaysMovement =
    movementDirection.x * speed * delta;

  const forwardMovement =
    movementDirection.z * speed * delta;

  const previousX = camera.position.x;

  controls.moveRight(sidewaysMovement);

  if (
    isSneaking &&
    canJump &&
    !hasGroundBelow(
      camera.position.x,
      camera.position.z
    )
  ) {
    camera.position.x = previousX;
  } else {
    resolveHorizontalCollision("x", previousX);
  }

  const previousZ = camera.position.z;

  controls.moveForward(forwardMovement);

  if (
    isSneaking &&
    canJump &&
    !hasGroundBelow(
      camera.position.x,
      camera.position.z
    )
  ) {
    camera.position.z = previousZ;
  } else {
    resolveHorizontalCollision("z", previousZ);
  }

  const previousY = camera.position.y;

  camera.position.y += velocity.y * delta;
  resolveVerticalCollision(previousY);

  if (camera.position.y < -20) {
    respawnPlayer();
  }

  updateLoadedChunks();
}

function getTargetedBlock() {
  raycaster.setFromCamera(screenCenter, camera);
  raycaster.far = BLOCK_REACH;

  const chunkMeshes = [];

  for (const chunk of loadedChunks.values()) {
    for (const child of chunk.group.children) {
      chunkMeshes.push(child);
    }
  }

  const intersections = raycaster.intersectObjects(
    chunkMeshes,
    false
  );

  if (intersections.length === 0) {
    return null;
  }

  const intersection = intersections[0];
  const blocks = intersection.object.userData.blocks;
  const block = blocks?.[intersection.instanceId];

  if (!block) {
    return null;
  }

  return {
    intersection,
    block
  };
}

function breakTargetedBlock() {
  const target = getTargetedBlock();

  if (!target) {
    return;
  }

  const blockType = blockTypes.find(
    (type) => type.key === target.block.type
  );

  if (blockType?.unbreakable) {
    showNotification("Bedrock cannot be broken");
    return;
  }

  const key = positionKey(
    target.block.x,
    target.block.y,
    target.block.z
  );

  editedBlocks.delete(key);
  removedBlocks.add(key);

  reloadChunkAtWorldPosition(
    target.block.x,
    target.block.z
  );

  showNotification(`Broke ${blockType?.name ?? "Block"}`);
}

function placeTargetedBlock() {
  const target = getTargetedBlock();

  if (!target || !target.intersection.face) {
    return;
  }

  const normal = target.intersection.face.normal;

  const x = target.block.x + Math.round(normal.x);
  const y = target.block.y + Math.round(normal.y);
  const z = target.block.z + Math.round(normal.z);

  if (
    y < 0 ||
    y > VERTICAL_BUILD_LIMIT ||
    getWorldBlock(x, y, z) ||
    playerIntersectsBlock(x, y, z)
  ) {
    return;
  }

  const type = blockTypes[selectedBlockIndex].key;
  const key = positionKey(x, y, z);

  removedBlocks.delete(key);
  editedBlocks.set(key, type);

  reloadChunkAtWorldPosition(x, z);

  showNotification(
    `Placed ${blockTypes[selectedBlockIndex].name}`
  );
}

function jump() {
  if (canJump && !isSneaking) {
    velocity.y = JUMP_SPEED;
    canJump = false;
  }
}

function respawnPlayer() {
  const spawnX = 0;
  const spawnZ = 0;
  const groundY = getTerrainHeight(spawnX, spawnZ);

  camera.position.set(
    spawnX,
    groundY + STANDING_EYE_HEIGHT + 2,
    spawnZ
  );

  camera.rotation.set(0, 0, 0);
  velocity.set(0, 0, 0);

  updateLoadedChunks(true);
  showNotification("Player respawned");
}

function selectBlock(index) {
  const normalizedIndex =
    (
      index +
      blockTypes.length
    ) % blockTypes.length;

  selectedBlockIndex = normalizedIndex;

  selectedBlockNameElement.textContent =
    blockTypes[selectedBlockIndex].name;

  const visibleSlots =
    document.querySelectorAll(".hotbar-slot");

  visibleSlots.forEach((slot, slotIndex) => {
    const assignedIndex =
      (
        selectedBlockIndex -
        (selectedBlockIndex % visibleSlots.length) +
        slotIndex
      ) % blockTypes.length;

    slot.dataset.blockIndex = assignedIndex;

    const icon = slot.querySelector(".block-icon");

    if (icon) {
      const colors = blockTypes[assignedIndex].colors;

      icon.style.background =
        `linear-gradient(135deg, ${colors[1]}, ${colors[0]}, ${colors[2]})`;
    }

    slot.classList.toggle(
      "selected",
      assignedIndex === selectedBlockIndex
    );
  });
}

function showNotification(message) {
  notificationElement.textContent = message;
  notificationElement.classList.add("visible");

  window.clearTimeout(notificationTimer);

  notificationTimer = window.setTimeout(() => {
    notificationElement.classList.remove("visible");
  }, 1500);
}

function saveWorld() {
  const worldData = {
    version: 1,
    seed: worldSeed,

    player: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      rotationX: camera.rotation.x,
      rotationY: camera.rotation.y
    },

    editedBlocks: Array.from(editedBlocks.entries()),
    removedBlocks: Array.from(removedBlocks)
  };

  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify(worldData)
  );

  showNotification("Infinite world saved");
}

function loadWorld() {
  const savedWorld = localStorage.getItem(SAVE_KEY);

  if (!savedWorld) {
    showNotification("No saved world found");
    return false;
  }

  try {
    const worldData = JSON.parse(savedWorld);

    worldSeed = worldData.seed ?? worldSeed;

    editedBlocks.clear();
    removedBlocks.clear();

    for (const [key, type] of worldData.editedBlocks ?? []) {
      editedBlocks.set(key, type);
    }

    for (const key of worldData.removedBlocks ?? []) {
      removedBlocks.add(key);
    }

    clearLoadedChunks();

    if (worldData.player) {
      camera.position.set(
        worldData.player.x,
        worldData.player.y,
        worldData.player.z
      );

      camera.rotation.set(
        worldData.player.rotationX ?? 0,
        worldData.player.rotationY ?? 0,
        0
      );
    } else {
      respawnPlayer();
    }

    updateLoadedChunks(true);
    showNotification("World loaded");

    return true;
  } catch (error) {
    console.error(error);
    showNotification("Saved world could not be loaded");
    return false;
  }
}

function clearLoadedChunks() {
  const chunkCoordinates = [];

  for (const chunk of loadedChunks.values()) {
    chunkCoordinates.push([
      chunk.group.userData.chunkX,
      chunk.group.userData.chunkZ
    ]);
  }

  for (const [chunkX, chunkZ] of chunkCoordinates) {
    unloadChunk(chunkX, chunkZ);
  }

  blockLookup.clear();
  lastChunkX = Number.NaN;
  lastChunkZ = Number.NaN;
}

function createNewWorld() {
  worldSeed = Math.floor(Math.random() * 1000000000);

  editedBlocks.clear();
  removedBlocks.clear();
  localStorage.removeItem(SAVE_KEY);

  clearLoadedChunks();
  respawnPlayer();
  updateLoadedChunks(true);

  showNotification(`New seed: ${worldSeed}`);
}

function startGame() {
  gameStarted = true;
  gamePaused = false;

  startScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  hud.classList.remove("hidden");

  updateLoadedChunks(true);

  if (!isTouchDevice) {
    controls.lock();
  }
}

function pauseGame() {
  if (!gameStarted) {
    return;
  }

  gamePaused = true;
  pauseScreen.classList.remove("hidden");

  if (controls.isLocked) {
    controls.unlock();
  }

  for (const key of Object.keys(keyState)) {
    keyState[key] = false;
  }
}

function resumeGame() {
  gamePaused = false;
  pauseScreen.classList.add("hidden");

  if (!isTouchDevice) {
    controls.lock();
  }
}

function bindHoldButton(button, keyCode) {
  if (!button) {
    return;
  }

  const press = (event) => {
    event.preventDefault();
    event.stopPropagation();

    keyState[keyCode] = true;
    button.classList.add("active");

    if (button.setPointerCapture) {
      button.setPointerCapture(event.pointerId);
    }
  };

  const release = (event) => {
    event.preventDefault();
    event.stopPropagation();

    keyState[keyCode] = false;
    button.classList.remove("active");
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

function bindActionButton(button, action) {
  if (!button) {
    return;
  }

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    action();
  });
}

function configureInput() {
  bindHoldButton(
    document.getElementById("move-forward"),
    "KeyW"
  );

  bindHoldButton(
    document.getElementById("move-backward"),
    "KeyS"
  );

  bindHoldButton(
    document.getElementById("move-left"),
    "KeyA"
  );

  bindHoldButton(
    document.getElementById("move-right"),
    "KeyD"
  );

  const extraButtons = addMobileActionButtons();

  bindHoldButton(
    extraButtons?.sneakButton,
    "KeyC"
  );

  bindHoldButton(
    extraButtons?.rushButton,
    "ShiftLeft"
  );

  bindActionButton(
    document.getElementById("jump-button"),
    jump
  );

  bindActionButton(
    document.getElementById("break-button"),
    breakTargetedBlock
  );

  bindActionButton(
    document.getElementById("place-button"),
    placeTargetedBlock
  );
}

renderer.domElement.addEventListener(
  "pointerdown",
  (event) => {
    if (
      !isTouchDevice ||
      !gameStarted ||
      gamePaused
    ) {
      return;
    }

    event.preventDefault();

    touchLookPointerId = event.pointerId;
    previousPointerX = event.clientX;
    previousPointerY = event.clientY;

    renderer.domElement.setPointerCapture(
      event.pointerId
    );
  }
);

renderer.domElement.addEventListener(
  "pointermove",
  (event) => {
    if (
      !isTouchDevice ||
      event.pointerId !== touchLookPointerId ||
      gamePaused
    ) {
      return;
    }

    event.preventDefault();

    const movementX =
      event.clientX - previousPointerX;

    const movementY =
      event.clientY - previousPointerY;

    previousPointerX = event.clientX;
    previousPointerY = event.clientY;

    camera.rotation.y -= movementX * 0.004;
    camera.rotation.x -= movementY * 0.004;

    camera.rotation.x = THREE.MathUtils.clamp(
      camera.rotation.x,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05
    );
  }
);

renderer.domElement.addEventListener(
  "pointerup",
  (event) => {
    if (event.pointerId === touchLookPointerId) {
      touchLookPointerId = null;
    }
  }
);

renderer.domElement.addEventListener(
  "pointercancel",
  () => {
    touchLookPointerId = null;
  }
);

playButton.addEventListener("click", startGame);

loadButton.addEventListener("click", () => {
  if (loadWorld()) {
    startGame();
  }
});

resumeButton.addEventListener("click", resumeGame);
saveButton.addEventListener("click", saveWorld);

newWorldButton.addEventListener("click", () => {
  createNewWorld();
  resumeGame();
});

mobilePauseButton.addEventListener("click", pauseGame);

controls.addEventListener("unlock", () => {
  if (gameStarted && !isTouchDevice && !gamePaused) {
    gamePaused = true;
    pauseScreen.classList.remove("hidden");
  }
});

document.addEventListener("keydown", (event) => {
  keyState[event.code] = true;

  if (event.code === "Space") {
    event.preventDefault();
    jump();
  }

  if (event.code.startsWith("Digit")) {
    const number = Number(
      event.code.replace("Digit", "")
    );

    if (number >= 1 && number <= 9) {
      selectBlock(number - 1);
    }
  }

  if (event.code === "KeyQ") {
    selectBlock(selectedBlockIndex - 1);
  }

  if (event.code === "KeyE") {
    selectBlock(selectedBlockIndex + 1);
  }
});

document.addEventListener("keyup", (event) => {
  keyState[event.code] = false;
});

document.addEventListener("mousedown", (event) => {
  if (
    isTouchDevice ||
    !gameStarted ||
    gamePaused ||
    !controls.isLocked
  ) {
    return;
  }

  if (event.button === 0) {
    breakTargetedBlock();
  } else if (event.button === 2) {
    placeTargetedBlock();
  }
});

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

document.addEventListener(
  "wheel",
  (event) => {
    if (!gameStarted || gamePaused) {
      return;
    }

    const direction = Math.sign(event.deltaY);

    selectBlock(
      selectedBlockIndex + direction
    );
  },
  {
    passive: true
  }
);

document
  .querySelectorAll(".hotbar-slot")
  .forEach((slot) => {
    slot.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const index = Number(
        slot.dataset.blockIndex ??
        slot.dataset.slot ??
        0
      );

      selectBlock(index);
    });
  });

window.addEventListener("resize", () => {
  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      isTouchDevice ? 1.25 : 1.8
    )
  );
});

window.addEventListener("beforeunload", () => {
  if (gameStarted) {
    saveWorld();
  }
});

function updateDebug(delta) {
  fpsFrames += 1;
  fpsTimer += delta;

  if (fpsTimer >= 0.5) {
    fpsElement.textContent =
      `FPS: ${Math.round(fpsFrames / fpsTimer)}`;

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
  updateDebug(delta);

  renderer.render(scene, camera);
}

addMobileControlStyles();
configureInput();
createSky();
createLighting();
respawnPlayer();
updateLoadedChunks(true);
selectBlock(0);
animate();
