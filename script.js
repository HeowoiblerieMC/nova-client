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
    "Touch controls, Inventory, Chat, Sneak, and Rush are enabled.";
} else {
  deviceMessageElement.textContent =
    "WASD Move, Shift Sneak, R Rush, E Inventory, T Chat.";
}

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x88c9ef);
scene.fog = new THREE.Fog(0xa8d6ed, 45, 150);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  280
);

camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance"
});

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

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

container.appendChild(renderer.domElement);

const controls = new THREE.PointerLockControls(
  camera,
  document.body
);

const SAVE_KEY = "nova-client-infinite-world-v2";

const CHUNK_SIZE = 16;
const TOUCH_RENDER_DISTANCE = 2;
const DESKTOP_RENDER_DISTANCE = 3;

const RENDER_DISTANCE = isTouchDevice
  ? TOUCH_RENDER_DISTANCE
  : DESKTOP_RENDER_DISTANCE;

const VERTICAL_BUILD_LIMIT = 64;
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

const cloudGroups = [];
const chatHistory = [];

let worldSeed = Math.floor(
  Math.random() * 1000000000
);

let selectedBlockIndex = 0;

let canJump = false;
let isSneaking = false;
let isRushing = false;

let gameStarted = false;
let gamePaused = false;
let inventoryOpen = false;
let chatOpen = false;

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

let worldTime = 0.25;
let sunMesh = null;
let hemisphereLight = null;
let sunlight = null;

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

function hashNoise(x, z, seedOffset = 0) {
  const value = Math.sin(
    x * 127.1 +
    z * 311.7 +
    (worldSeed + seedOffset) * 0.000731
  ) * 43758.5453123;

  return value - Math.floor(value);
}

function createPixelTexture(
  colors,
  pattern = "noise"
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = 16;
  canvas.height = 16;

  context.fillStyle = colors[0];
  context.fillRect(0, 0, 16, 16);

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const randomValue = hashNoise(
        x,
        y,
        colors.length * 131
      );

      let colorIndex = Math.floor(
        randomValue * colors.length
      ) % colors.length;

      context.fillStyle = colors[colorIndex];

      if (
        pattern === "planks" &&
        y % 5 === 0
      ) {
        context.fillStyle = "#5d4127";
      }

      if (pattern === "bricks") {
        const horizontalLine = y % 5 === 0;

        const offset =
          Math.floor(y / 5) % 2 === 0
            ? 0
            : 4;

        const verticalLine =
          (x + offset) % 8 === 0;

        if (horizontalLine || verticalLine) {
          context.fillStyle = "#5a302a";
        }
      }

      if (
        randomValue > 0.42 ||
        pattern !== "noise"
      ) {
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
  let pattern = "noise";

  if (blockType.key === "planks") {
    pattern = "planks";
  }

  if (blockType.key === "bricks") {
    pattern = "bricks";
  }

  return new THREE.MeshLambertMaterial({
    map: createPixelTexture(
      blockType.colors,
      pattern
    ),
    transparent: blockType.transparent ?? false,
    opacity: blockType.opacity ?? 1,
    alphaTest:
      blockType.key === "leaves"
        ? 0.15
        : 0,
    depthWrite: blockType.key !== "glass"
  });
}

const blockMaterials = {};

for (const blockType of blockTypes) {
  blockMaterials[blockType.key] =
    createBlockMaterial(blockType);
}

function smoothNoise(
  x,
  z,
  scale,
  seedOffset
) {
  const scaledX = x / scale;
  const scaledZ = z / scale;

  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);

  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const fractionX = scaledX - x0;
  const fractionZ = scaledZ - z0;

  const fadeX =
    fractionX *
    fractionX *
    (3 - 2 * fractionX);

  const fadeZ =
    fractionZ *
    fractionZ *
    (3 - 2 * fractionZ);

  const n00 = hashNoise(
    x0,
    z0,
    seedOffset
  );

  const n10 = hashNoise(
    x1,
    z0,
    seedOffset
  );

  const n01 = hashNoise(
    x0,
    z1,
    seedOffset
  );

  const n11 = hashNoise(
    x1,
    z1,
    seedOffset
  );

  const nx0 = THREE.MathUtils.lerp(
    n00,
    n10,
    fadeX
  );

  const nx1 = THREE.MathUtils.lerp(
    n01,
    n11,
    fadeX
  );

  return THREE.MathUtils.lerp(
    nx0,
    nx1,
    fadeZ
  );
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
    return height <= 7
      ? "sand"
      : "grass";
  }

  if (y >= height - 3) {
    return height <= 7
      ? "sand"
      : "dirt";
  }

  const oreNoise = hashNoise(
    x * 17 + y * 37,
    z * 23 - y * 13,
    700
  );

  if (
    y < 8 &&
    oreNoise > 0.993
  ) {
    return "diamond";
  }

  if (
    y < 12 &&
    oreNoise > 0.985
  ) {
    return "gold";
  }

  if (
    y < 18 &&
    oreNoise > 0.965
  ) {
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

function addGeneratedBlock(
  chunkBlocks,
  x,
  y,
  z,
  generatedType
) {
  const key = positionKey(x, y, z);

  if (removedBlocks.has(key)) {
    return;
  }

  const editedType =
    editedBlocks.get(key);

  chunkBlocks.push({
    x,
    y,
    z,
    type: editedType ?? generatedType
  });
}

function createTreeBlocks(
  x,
  groundY,
  z,
  chunkBlocks
) {
  const trunkHeight =
    4 +
    Math.floor(
      hashNoise(x, z, 900) * 3
    );

  for (
    let y = 1;
    y <= trunkHeight;
    y += 1
  ) {
    addGeneratedBlock(
      chunkBlocks,
      x,
      groundY + y,
      z,
      "wood"
    );
  }

  const leafCenterY =
    groundY + trunkHeight;

  for (
    let offsetX = -2;
    offsetX <= 2;
    offsetX += 1
  ) {
    for (
      let offsetY = -2;
      offsetY <= 2;
      offsetY += 1
    ) {
      for (
        let offsetZ = -2;
        offsetZ <= 2;
        offsetZ += 1
      ) {
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
          addGeneratedBlock(
            chunkBlocks,
            x + offsetX,
            leafCenterY + offsetY,
            z + offsetZ,
            "leaves"
          );
        }
      }
    }
  }
}

function generateChunkData(
  chunkX,
  chunkZ
) {
  const chunkBlocks = [];

  const startX =
    chunkX * CHUNK_SIZE;

  const startZ =
    chunkZ * CHUNK_SIZE;

  for (
    let localX = 0;
    localX < CHUNK_SIZE;
    localX += 1
  ) {
    for (
      let localZ = 0;
      localZ < CHUNK_SIZE;
      localZ += 1
    ) {
      const x = startX + localX;
      const z = startZ + localZ;

      const height =
        getTerrainHeight(x, z);

      const minimumY = Math.max(
        0,
        height - 7
      );

      for (
        let y = minimumY;
        y <= height;
        y += 1
      ) {
        const key = positionKey(x, y, z);

        if (removedBlocks.has(key)) {
          continue;
        }

        const editedType =
          editedBlocks.get(key);

        const generatedType =
          getGeneratedBlockType(x, y, z);

        const type =
          editedType ?? generatedType;

        if (type) {
          chunkBlocks.push({
            x,
            y,
            z,
            type
          });
        }
      }

      const treeChance =
        hashNoise(x, z, 850);

      if (
        treeChance > 0.988 &&
        height > 8 &&
        localX >= 2 &&
        localX <= CHUNK_SIZE - 3 &&
        localZ >= 2 &&
        localZ <= CHUNK_SIZE - 3
      ) {
        createTreeBlocks(
          x,
          height,
          z,
          chunkBlocks
        );
      }
    }
  }

  for (
    const [key, type]
    of editedBlocks.entries()
  ) {
    const coordinates =
      key.split(",").map(Number);

    const x = coordinates[0];
    const y = coordinates[1];
    const z = coordinates[2];

    if (
      worldToChunk(x) === chunkX &&
      worldToChunk(z) === chunkZ
    ) {
      const existingBlock =
        chunkBlocks.some((block) => {
          return (
            block.x === x &&
            block.y === y &&
            block.z === z
          );
        });

      if (!existingBlock) {
        chunkBlocks.push({
          x,
          y,
          z,
          type
        });
      }
    }
  }

  return chunkBlocks;
}

function createChunkMesh(
  chunkX,
  chunkZ
) {
  const key = chunkKey(
    chunkX,
    chunkZ
  );

  if (loadedChunks.has(key)) {
    return;
  }

  const blocks =
    generateChunkData(
      chunkX,
      chunkZ
    );

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
      positionKey(
        block.x,
        block.y,
        block.z
      ),
      block.type
    );
  }

  const temporaryMatrix =
    new THREE.Matrix4();

  for (
    const [type, typeBlocks]
    of Object.entries(blocksByType)
  ) {
    const mesh =
      new THREE.InstancedMesh(
        blockGeometry,
        blockMaterials[type],
        typeBlocks.length
      );

    mesh.userData.blockType = type;
    mesh.userData.blocks = typeBlocks;

    typeBlocks.forEach(
      (block, index) => {
        temporaryMatrix.makeTranslation(
          block.x,
          block.y,
          block.z
        );

        mesh.setMatrixAt(
          index,
          temporaryMatrix
        );
      }
    );

    mesh.instanceMatrix.needsUpdate = true;

    group.add(mesh);
  }

  scene.add(group);

  loadedChunks.set(key, {
    group,
    blocks
  });
}

function unloadChunk(
  chunkX,
  chunkZ
) {
  const key = chunkKey(
    chunkX,
    chunkZ
  );

  const chunk =
    loadedChunks.get(key);

  if (!chunk) {
    return;
  }

  for (const block of chunk.blocks) {
    blockLookup.delete(
      positionKey(
        block.x,
        block.y,
        block.z
      )
    );
  }

  scene.remove(chunk.group);

  for (
    const child
    of chunk.group.children
  ) {
    if (typeof child.dispose === "function") {
      child.dispose();
    }
  }

  loadedChunks.delete(key);
}

function reloadChunkAtWorldPosition(
  x,
  z
) {
  const chunkX = worldToChunk(x);
  const chunkZ = worldToChunk(z);

  unloadChunk(chunkX, chunkZ);
  createChunkMesh(chunkX, chunkZ);
  updateBlockCounter();
}

function updateLoadedChunks(force = false) {
  const playerChunkX =
    worldToChunk(camera.position.x);

  const playerChunkZ =
    worldToChunk(camera.position.z);

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
      const chunkX =
        playerChunkX + offsetX;

      const chunkZ =
        playerChunkZ + offsetZ;

      const key =
        chunkKey(chunkX, chunkZ);

      requiredChunks.add(key);
      createChunkMesh(chunkX, chunkZ);
    }
  }

  const chunksToUnload = [];

  for (
    const [key, chunk]
    of loadedChunks.entries()
  ) {
    if (!requiredChunks.has(key)) {
      chunksToUnload.push([
        chunk.group.userData.chunkX,
        chunk.group.userData.chunkZ
      ]);
    }
  }

  for (
    const [chunkX, chunkZ]
    of chunksToUnload
  ) {
    unloadChunk(chunkX, chunkZ);
  }

  updateBlockCounter();
}

function updateBlockCounter() {
  let loadedBlockCount = 0;

  for (
    const chunk
    of loadedChunks.values()
  ) {
    loadedBlockCount +=
      chunk.blocks.length;
  }

  blockCountElement.textContent =
    `LOADED: ${loadedBlockCount} | CHUNKS: ${loadedChunks.size}`;
}

function createSunTexture() {
  const canvas =
    document.createElement("canvas");

  const context =
    canvas.getContext("2d");

  canvas.width = 16;
  canvas.height = 16;

  context.fillStyle = "#fff1a0";
  context.fillRect(0, 0, 16, 16);

  context.fillStyle = "#ffe166";
  context.fillRect(2, 2, 12, 12);

  context.fillStyle = "#fffbcf";
  context.fillRect(4, 4, 8, 8);

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.generateMipmaps = false;
  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}

function createCloud(index) {
  const cloud = new THREE.Group();

  const material =
    new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    });

  const cloudParts = [
    {
      x: 0,
      z: 0,
      width: 8,
      depth: 3
    },
    {
      x: 5,
      z: 0,
      width: 5,
      depth: 4
    },
    {
      x: -5,
      z: 1,
      width: 5,
      depth: 3
    },
    {
      x: 1,
      z: 3,
      width: 6,
      depth: 3
    }
  ];

  for (const part of cloudParts) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        part.width,
        0.8,
        part.depth
      ),
      material
    );

    mesh.position.set(
      part.x,
      0,
      part.z
    );

    cloud.add(mesh);
  }

  const columns = 4;

  const row =
    Math.floor(index / columns);

  const column =
    index % columns;

  cloud.position.set(
    column * 58 - 87,
    46 + (index % 3) * 3,
    row * 58 - 85
  );

  cloud.userData.speed =
    1.1 + (index % 3) * 0.18;

  scene.add(cloud);
  cloudGroups.push(cloud);
}

function createClouds() {
  const cloudCount =
    isTouchDevice ? 8 : 14;

  for (
    let index = 0;
    index < cloudCount;
    index += 1
  ) {
    createCloud(index);
  }
}

function createSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(
      230,
      24,
      16
    ),
    new THREE.MeshBasicMaterial({
      color: 0x88c9ef,
      side: THREE.BackSide,
      fog: false
    })
  );

  scene.add(sky);

  sunMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 15),
    new THREE.MeshBasicMaterial({
      map: createSunTexture(),
      transparent: true,
      side: THREE.DoubleSide,
      fog: false
    })
  );

  scene.add(sunMesh);

  createClouds();
}

function createLighting() {
  hemisphereLight =
    new THREE.HemisphereLight(
      0xe4f6ff,
      0x46613d,
      1.55
    );

  scene.add(hemisphereLight);

  sunlight =
    new THREE.DirectionalLight(
      0xfff2ce,
      1.7
    );

  sunlight.position.set(
    40,
    70,
    30
  );

  scene.add(sunlight);
}

function updateSky(delta) {
  worldTime =
    (worldTime + delta * 0.0025) % 1;

  const angle =
    worldTime *
    Math.PI *
    2;

  const sunDistance = 150;

  sunMesh.position.set(
    camera.position.x +
      Math.cos(angle) *
      sunDistance,
    Math.sin(angle) *
      sunDistance,
    camera.position.z - 110
  );

  sunMesh.lookAt(camera.position);

  sunlight.position.copy(
    sunMesh.position
  );

  const sunHeight =
    Math.sin(angle);

  const daylight =
    THREE.MathUtils.clamp(
      sunHeight * 0.7 + 0.4,
      0.06,
      1
    );

  const dayColor =
    new THREE.Color(0x88c9ef);

  const sunsetColor =
    new THREE.Color(0xe89962);

  const nightColor =
    new THREE.Color(0x071024);

  let skyColor;

  if (daylight > 0.45) {
    const sunsetAmount =
      THREE.MathUtils.clamp(
        (0.8 - daylight) * 2,
        0,
        1
      );

    skyColor =
      dayColor.clone().lerp(
        sunsetColor,
        sunsetAmount
      );
  } else {
    const nightAmount =
      THREE.MathUtils.clamp(
        1 - daylight * 2,
        0,
        1
      );

    skyColor =
      sunsetColor.clone().lerp(
        nightColor,
        nightAmount
      );
  }

  scene.background.copy(skyColor);
  scene.fog.color.copy(skyColor);

  hemisphereLight.intensity =
    0.25 + daylight * 1.3;

  sunlight.intensity =
    0.1 + daylight * 1.6;

  for (const cloud of cloudGroups) {
    cloud.position.x +=
      cloud.userData.speed *
      delta;

    const maximumX =
      camera.position.x + 150;

    const minimumX =
      camera.position.x - 150;

    if (
      cloud.position.x >
      maximumX
    ) {
      cloud.position.x = minimumX;
    }

    if (
      cloud.position.z >
      camera.position.z + 150
    ) {
      cloud.position.z =
        camera.position.z - 150;
    }

    if (
      cloud.position.z <
      camera.position.z - 150
    ) {
      cloud.position.z =
        camera.position.z + 150;
    }
  }
}

function addInterfaceStyles() {
  const style =
    document.createElement("style");

  style.textContent = `
    #inventory-screen,
    #chat-screen {
      position: fixed;
      inset: 0;
      z-index: 220;
      display: none;
      pointer-events: auto;
    }

    #inventory-screen.open {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.62);
      backdrop-filter: blur(8px);
    }

    #inventory-panel {
      width: min(780px, 100%);
      max-height: 84vh;
      overflow-y: auto;
      padding: 24px;
      border: 2px solid rgba(255, 255, 255, 0.22);
      border-radius: 12px;
      background: rgba(16, 22, 18, 0.97);
      box-shadow:
        0 25px 80px rgba(0, 0, 0, 0.7),
        0 0 45px rgba(67, 239, 136, 0.09);
    }

    #inventory-panel h2 {
      margin: 0 0 18px;
      color: white;
      font-size: 22px;
      text-align: center;
      letter-spacing: 5px;
    }

    #inventory-grid {
      display: grid;
      grid-template-columns:
        repeat(auto-fill, minmax(110px, 1fr));
      gap: 9px;
    }

    .inventory-item {
      min-height: 108px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 9px;
      padding: 12px 8px;
      border: 2px solid rgba(255, 255, 255, 0.11);
      border-radius: 7px;
      color: white;
      background: rgba(255, 255, 255, 0.05);
      cursor: pointer;
      touch-action: manipulation;
    }

    .inventory-item:hover,
    .inventory-item.selected {
      border-color: #43ef88;
      background: rgba(67, 239, 136, 0.15);
      box-shadow: 0 0 18px rgba(67, 239, 136, 0.12);
    }

    .inventory-block-icon {
      width: 49px;
      height: 49px;
      border: 2px solid rgba(0, 0, 0, 0.28);
      box-shadow:
        inset -8px -8px rgba(0, 0, 0, 0.16),
        inset 5px 5px rgba(255, 255, 255, 0.1);
      image-rendering: pixelated;
    }

    .inventory-item-name {
      color: #effff4;
      font-size: 10px;
      font-weight: 900;
      text-align: center;
    }

    #inventory-close-button {
      width: 100%;
      margin-top: 18px;
      padding: 13px;
      border: 1px solid rgba(67, 239, 136, 0.45);
      border-radius: 7px;
      color: #031009;
      background: #43ef88;
      font-size: 11px;
      font-weight: 900;
      cursor: pointer;
      touch-action: manipulation;
    }

    #chat-screen.open {
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      padding:
        0
        16px
        max(24px, env(safe-area-inset-bottom));
      background: transparent;
    }

    #chat-panel {
      width: min(720px, 100%);
    }

    #chat-history {
      max-height: 230px;
      overflow-y: auto;
      margin-bottom: 8px;
      padding: 10px 12px;
      border-radius: 5px;
      color: white;
      background: rgba(0, 0, 0, 0.52);
      font-family: monospace;
      font-size: 13px;
      line-height: 1.55;
      text-shadow: 1px 1px black;
    }

    #chat-input {
      width: 100%;
      padding: 13px;
      border: 2px solid rgba(255, 255, 255, 0.62);
      border-radius: 4px;
      outline: none;
      color: white;
      background: rgba(0, 0, 0, 0.78);
      font-family: monospace;
      font-size: 15px;
      user-select: text;
      touch-action: auto;
    }

    #chat-input:focus {
      border-color: #43ef88;
    }

    #sneak-button,
    #rush-button,
    #inventory-mobile-button,
    #chat-mobile-button {
      width: 72px;
      height: 43px;
      font-size: 9px;
    }

    #sneak-button.active,
    #rush-button.active {
      color: #031009;
      background: #43ef88;
      box-shadow:
        0 0 18px rgba(67, 239, 136, 0.42);
    }

    @media (max-width: 700px) {
      #inventory-panel {
        padding: 16px;
      }

      #inventory-grid {
        grid-template-columns:
          repeat(4, minmax(65px, 1fr));
      }

      .inventory-item {
        min-height: 90px;
      }

      .inventory-block-icon {
        width: 39px;
        height: 39px;
      }

      #sneak-button,
      #rush-button,
      #inventory-mobile-button,
      #chat-mobile-button {
        width: 63px;
      }
    }
  `;

  document.head.appendChild(style);
}

function createInterfacePanels() {
  const inventoryScreen =
    document.createElement("section");

  inventoryScreen.id =
    "inventory-screen";

  inventoryScreen.innerHTML = `
    <div id="inventory-panel">
      <h2>INVENTORY</h2>

      <div id="inventory-grid"></div>

      <button
        id="inventory-close-button"
        type="button"
      >
        CLOSE INVENTORY
      </button>
    </div>
  `;

  document.body.appendChild(
    inventoryScreen
  );

  const chatScreen =
    document.createElement("section");

  chatScreen.id = "chat-screen";

  chatScreen.innerHTML = `
    <div id="chat-panel">
      <div id="chat-history"></div>

      <input
        id="chat-input"
        type="text"
        maxlength="180"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="Press Enter to send"
      >
    </div>
  `;

  document.body.appendChild(
    chatScreen
  );

  document
    .getElementById(
      "inventory-close-button"
    )
    .addEventListener(
      "click",
      closeInventory
    );

  document
    .getElementById("chat-input")
    .addEventListener(
      "keydown",
      handleChatInputKeydown
    );

  buildInventory();
}

function buildInventory() {
  const inventoryGrid =
    document.getElementById(
      "inventory-grid"
    );

  if (!inventoryGrid) {
    return;
  }

  inventoryGrid.innerHTML = "";

  blockTypes.forEach(
    (blockType, index) => {
      if (blockType.unbreakable) {
        return;
      }

      const item =
        document.createElement("button");

      item.type = "button";
      item.className =
        "inventory-item";

      if (index === selectedBlockIndex) {
        item.classList.add("selected");
      }

      const colors =
        blockType.colors;

      item.innerHTML = `
        <span
          class="inventory-block-icon"
          style="
            background:
              linear-gradient(
                135deg,
                ${colors[1]},
                ${colors[0]},
                ${colors[2]}
              );
          "
        ></span>

        <span class="inventory-item-name">
          ${blockType.name}
        </span>
      `;

      item.addEventListener(
        "pointerdown",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          selectBlock(index);
          closeInventory();
        }
      );

      inventoryGrid.appendChild(item);
    }
  );
}

function renderChatHistory() {
  const historyElement =
    document.getElementById(
      "chat-history"
    );

  if (!historyElement) {
    return;
  }

  historyElement.innerHTML = "";

  for (
    const entry
    of chatHistory
  ) {
    const line =
      document.createElement("div");

    line.textContent = entry.message;

    if (entry.type === "system") {
      line.style.color = "#a5ffbd";
    }

    if (entry.type === "error") {
      line.style.color = "#ff8585";
    }

    historyElement.appendChild(line);
  }

  historyElement.scrollTop =
    historyElement.scrollHeight;
}

function addChatMessage(
  message,
  type = "normal"
) {
  chatHistory.push({
    message,
    type
  });

  if (chatHistory.length > 40) {
    chatHistory.shift();
  }

  renderChatHistory();
}

function clearMovementKeys() {
  for (
    const key
    of Object.keys(keyState)
  ) {
    keyState[key] = false;
  }

  document
    .querySelectorAll(
      ".mobile-control.active"
    )
    .forEach((button) => {
      button.classList.remove("active");
    });
}

function openInventory() {
  if (
    !gameStarted ||
    chatOpen
  ) {
    return;
  }

  inventoryOpen = true;
  gamePaused = true;

  clearMovementKeys();
  buildInventory();

  document
    .getElementById(
      "inventory-screen"
    )
    .classList.add("open");

  if (controls.isLocked) {
    controls.unlock();
  }
}

function closeInventory() {
  if (!inventoryOpen) {
    return;
  }

  inventoryOpen = false;
  gamePaused = false;

  document
    .getElementById(
      "inventory-screen"
    )
    .classList.remove("open");

  if (
    !isTouchDevice &&
    gameStarted
  ) {
    controls.lock();
  }
}

function openChat(initialText = "") {
  if (
    !gameStarted ||
    inventoryOpen
  ) {
    return;
  }

  chatOpen = true;
  gamePaused = true;

  clearMovementKeys();
  renderChatHistory();

  const chatScreen =
    document.getElementById(
      "chat-screen"
    );

  const chatInput =
    document.getElementById(
      "chat-input"
    );

  chatScreen.classList.add("open");

  if (controls.isLocked) {
    controls.unlock();
  }

  chatInput.value = initialText;

  window.setTimeout(() => {
    chatInput.focus();

    chatInput.setSelectionRange(
      chatInput.value.length,
      chatInput.value.length
    );
  }, 20);
}

function closeChat() {
  if (!chatOpen) {
    return;
  }

  chatOpen = false;
  gamePaused = false;

  document
    .getElementById("chat-screen")
    .classList.remove("open");

  document
    .getElementById("chat-input")
    .blur();

  if (
    !isTouchDevice &&
    gameStarted
  ) {
    controls.lock();
  }
}

function runCommand(commandText) {
  const parts = commandText
    .trim()
    .slice(1)
    .split(/\s+/);

  const command =
    parts[0]?.toLowerCase();

  if (command === "help") {
    addChatMessage(
      "/help, /spawn, /tp x y z, /seed, /save, /time day, /time sunset, /time night",
      "system"
    );

    return;
  }

  if (command === "spawn") {
    respawnPlayer();

    addChatMessage(
      "Teleported to spawn.",
      "system"
    );

    return;
  }

  if (command === "seed") {
    addChatMessage(
      `Seed: ${worldSeed}`,
      "system"
    );

    return;
  }

  if (command === "save") {
    saveWorld();

    addChatMessage(
      "World saved.",
      "system"
    );

    return;
  }

  if (command === "tp") {
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    const z = Number(parts[3]);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z)
    ) {
      addChatMessage(
        "Usage: /tp <x> <y> <z>",
        "error"
      );

      return;
    }

    camera.position.set(x, y, z);
    velocity.set(0, 0, 0);

    updateLoadedChunks(true);

    addChatMessage(
      `Teleported to ${x} ${y} ${z}.`,
      "system"
    );

    return;
  }

  if (command === "time") {
    const timeName =
      parts[1]?.toLowerCase();

    if (timeName === "day") {
      worldTime = 0.25;

      addChatMessage(
        "Time set to day.",
        "system"
      );

      return;
    }

    if (timeName === "sunset") {
      worldTime = 0.48;

      addChatMessage(
        "Time set to sunset.",
        "system"
      );

      return;
    }

    if (timeName === "night") {
      worldTime = 0.75;

      addChatMessage(
        "Time set to night.",
        "system"
      );

      return;
    }

    addChatMessage(
      "Usage: /time day, /time sunset, or /time night",
      "error"
    );

    return;
  }

  addChatMessage(
    `Unknown command: /${command ?? ""}`,
    "error"
  );
}

function submitChat() {
  const input =
    document.getElementById(
      "chat-input"
    );

  const message =
    input.value.trim();

  if (!message) {
    closeChat();
    return;
  }

  if (message.startsWith("/")) {
    addChatMessage(message);
    runCommand(message);
  } else {
    addChatMessage(
      `<Player> ${message}`
    );
  }

  input.value = "";
  closeChat();
}

function handleChatInputKeydown(event) {
  event.stopPropagation();

  if (event.code === "Enter") {
    event.preventDefault();
    submitChat();
    return;
  }

  if (event.code === "Escape") {
    event.preventDefault();
    closeChat();
  }
}

function addMobileActionButtons() {
  const actionControls =
    document.getElementById(
      "action-controls"
    );

  if (!actionControls) {
    return {};
  }

  const jumpButton =
    document.getElementById(
      "jump-button"
    );

  const sneakButton =
    document.createElement("button");

  sneakButton.id = "sneak-button";
  sneakButton.type = "button";
  sneakButton.className =
    "mobile-control action-button";
  sneakButton.textContent = "SNEAK";

  const rushButton =
    document.createElement("button");

  rushButton.id = "rush-button";
  rushButton.type = "button";
  rushButton.className =
    "mobile-control action-button";
  rushButton.textContent = "RUSH";

  const inventoryButton =
    document.createElement("button");

  inventoryButton.id =
    "inventory-mobile-button";

  inventoryButton.type = "button";
  inventoryButton.className =
    "mobile-control action-button";
  inventoryButton.textContent =
    "INVENTORY";

  const chatButton =
    document.createElement("button");

  chatButton.id =
    "chat-mobile-button";

  chatButton.type = "button";
  chatButton.className =
    "mobile-control action-button";
  chatButton.textContent = "CHAT";

  actionControls.insertBefore(
    sneakButton,
    jumpButton
  );

  actionControls.insertBefore(
    rushButton,
    jumpButton
  );

  actionControls.insertBefore(
    inventoryButton,
    jumpButton
  );

  actionControls.insertBefore(
    chatButton,
    jumpButton
  );

  return {
    sneakButton,
    rushButton,
    inventoryButton,
    chatButton
  };
}

function updateSneakState() {
  isSneaking =
    Boolean(keyState.ShiftLeft) ||
    Boolean(keyState.ShiftRight);

  const targetEyeHeight =
    isSneaking
      ? SNEAKING_EYE_HEIGHT
      : STANDING_EYE_HEIGHT;

  const previousEyeHeight =
    currentEyeHeight;

  currentEyeHeight =
    THREE.MathUtils.lerp(
      currentEyeHeight,
      targetEyeHeight,
      0.24
    );

  camera.position.y +=
    currentEyeHeight -
    previousEyeHeight;

  currentPlayerHeight =
    isSneaking
      ? SNEAK_PLAYER_HEIGHT
      : PLAYER_HEIGHT;
}

function getPlayerFeetY() {
  return (
    camera.position.y -
    currentEyeHeight
  );
}

function playerIntersectsBlock(
  x,
  y,
  z
) {
  const feetY =
    getPlayerFeetY();

  const headY =
    feetY +
    currentPlayerHeight;

  return (
    camera.position.x +
      PLAYER_RADIUS >
      x - 0.5 &&
    camera.position.x -
      PLAYER_RADIUS <
      x + 0.5 &&
    headY > y - 0.5 &&
    feetY < y + 0.5 &&
    camera.position.z +
      PLAYER_RADIUS >
      z - 0.5 &&
    camera.position.z -
      PLAYER_RADIUS <
      z + 0.5
  );
}

function getNearbyBlocks() {
  const blocks = [];

  const feetY =
    getPlayerFeetY();

  const minimumX =
    Math.floor(
      camera.position.x -
      PLAYER_RADIUS -
      1
    );

  const maximumX =
    Math.ceil(
      camera.position.x +
      PLAYER_RADIUS +
      1
    );

  const minimumY =
    Math.floor(feetY - 1);

  const maximumY =
    Math.ceil(
      feetY +
      currentPlayerHeight +
      1
    );

  const minimumZ =
    Math.floor(
      camera.position.z -
      PLAYER_RADIUS -
      1
    );

  const maximumZ =
    Math.ceil(
      camera.position.z +
      PLAYER_RADIUS +
      1
    );

  for (
    let x = minimumX;
    x <= maximumX;
    x += 1
  ) {
    for (
      let y = minimumY;
      y <= maximumY;
      y += 1
    ) {
      for (
        let z = minimumZ;
        z <= maximumZ;
        z += 1
      ) {
        const type =
          getWorldBlock(x, y, z);

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

function resolveHorizontalCollision(
  axis,
  previousValue
) {
  for (
    const block
    of getNearbyBlocks()
  ) {
    if (
      playerIntersectsBlock(
        block.x,
        block.y,
        block.z
      )
    ) {
      camera.position[axis] =
        previousValue;

      return true;
    }
  }

  return false;
}

function resolveVerticalCollision(
  previousY
) {
  let collided = false;

  for (
    const block
    of getNearbyBlocks()
  ) {
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
        block.y +
        0.5 +
        currentEyeHeight;

      velocity.y = 0;
      canJump = true;
    } else {
      camera.position.y =
        previousY;

      velocity.y = 0;
    }

    break;
  }

  if (!collided) {
    canJump = false;
  }
}

function isSolidAtPoint(
  x,
  y,
  z
) {
  const blockX =
    Math.floor(x + 0.5);

  const blockY =
    Math.floor(y);

  const blockZ =
    Math.floor(z + 0.5);

  return Boolean(
    getWorldBlock(
      blockX,
      blockY,
      blockZ
    )
  );
}

function hasSafeSneakSupport(x, z) {
  const feetY =
    getPlayerFeetY();

  const supportY =
    feetY - 0.12;

  const edgeRadius = 0.18;

  const points = [
    [0, 0],
    [-edgeRadius, -edgeRadius],
    [edgeRadius, -edgeRadius],
    [-edgeRadius, edgeRadius],
    [edgeRadius, edgeRadius]
  ];

  let supportedPoints = 0;

  for (
    const [offsetX, offsetZ]
    of points
  ) {
    if (
      isSolidAtPoint(
        x + offsetX,
        supportY,
        z + offsetZ
      )
    ) {
      supportedPoints += 1;
    }
  }

  return supportedPoints >= 1;
}

function updatePlayer(delta) {
  if (
    !gameStarted ||
    gamePaused ||
    inventoryOpen ||
    chatOpen ||
    (
      !isTouchDevice &&
      !controls.isLocked
    )
  ) {
    return;
  }

  updateSneakState();

  isRushing =
    Boolean(keyState.KeyR);

  let speed = WALK_SPEED;

  if (isSneaking) {
    speed = SNEAK_SPEED;
  } else if (isRushing) {
    speed = RUSH_SPEED;
  }

  movementDirection.set(
    0,
    0,
    0
  );

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

  if (
    movementDirection.lengthSq() > 0
  ) {
    movementDirection.normalize();
  }

  velocity.y -=
    GRAVITY * delta;

  const sidewaysMovement =
    movementDirection.x *
    speed *
    delta;

  const forwardMovement =
    movementDirection.z *
    speed *
    delta;

  const previousX =
    camera.position.x;

  controls.moveRight(
    sidewaysMovement
  );

  if (
    isSneaking &&
    velocity.y <= 0 &&
    !hasSafeSneakSupport(
      camera.position.x,
      camera.position.z
    )
  ) {
    camera.position.x =
      previousX;
  } else {
    resolveHorizontalCollision(
      "x",
      previousX
    );
  }

  const previousZ =
    camera.position.z;

  controls.moveForward(
    forwardMovement
  );

  if (
    isSneaking &&
    velocity.y <= 0 &&
    !hasSafeSneakSupport(
      camera.position.x,
      camera.position.z
    )
  ) {
    camera.position.z =
      previousZ;
  } else {
    resolveHorizontalCollision(
      "z",
      previousZ
    );
  }

  const previousY =
    camera.position.y;

  camera.position.y +=
    velocity.y * delta;

  resolveVerticalCollision(
    previousY
  );

  if (
    camera.position.y < -20
  ) {
    respawnPlayer();
  }

  updateLoadedChunks();
}

function getTargetedBlock() {
  raycaster.setFromCamera(
    screenCenter,
    camera
  );

  raycaster.far = BLOCK_REACH;

  const chunkMeshes = [];

  for (
    const chunk
    of loadedChunks.values()
  ) {
    for (
      const child
      of chunk.group.children
    ) {
      chunkMeshes.push(child);
    }
  }

  const intersections =
    raycaster.intersectObjects(
      chunkMeshes,
      false
    );

  if (
    intersections.length === 0
  ) {
    return null;
  }

  const intersection =
    intersections[0];

  const blocks =
    intersection.object
      .userData.blocks;

  const block =
    blocks?.[
      intersection.instanceId
    ];

  if (!block) {
    return null;
  }

  return {
    intersection,
    block
  };
}

function breakTargetedBlock() {
  if (
    gamePaused ||
    inventoryOpen ||
    chatOpen
  ) {
    return;
  }

  const target =
    getTargetedBlock();

  if (!target) {
    return;
  }

  const blockType =
    blockTypes.find((type) => {
      return (
        type.key ===
        target.block.type
      );
    });

  if (blockType?.unbreakable) {
    showNotification(
      "Bedrock cannot be broken"
    );

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

  showNotification(
    `Broke ${blockType?.name ?? "Block"}`
  );
}

function placeTargetedBlock() {
  if (
    gamePaused ||
    inventoryOpen ||
    chatOpen
  ) {
    return;
  }

  const target =
    getTargetedBlock();

  if (
    !target ||
    !target.intersection.face
  ) {
    return;
  }

  const normal =
    target.intersection.face.normal;

  const x =
    target.block.x +
    Math.round(normal.x);

  const y =
    target.block.y +
    Math.round(normal.y);

  const z =
    target.block.z +
    Math.round(normal.z);

  if (
    y < 0 ||
    y > VERTICAL_BUILD_LIMIT ||
    getWorldBlock(x, y, z) ||
    playerIntersectsBlock(x, y, z)
  ) {
    return;
  }

  const type =
    blockTypes[
      selectedBlockIndex
    ].key;

  const key =
    positionKey(x, y, z);

  removedBlocks.delete(key);
  editedBlocks.set(key, type);

  reloadChunkAtWorldPosition(
    x,
    z
  );

  showNotification(
    `Placed ${blockTypes[selectedBlockIndex].name}`
  );
}

function jump() {
  if (
    canJump &&
    !isSneaking &&
    !gamePaused
  ) {
    velocity.y = JUMP_SPEED;
    canJump = false;
  }
}

function respawnPlayer() {
  const spawnX = 0;
  const spawnZ = 0;

  const groundY =
    getTerrainHeight(
      spawnX,
      spawnZ
    );

  currentEyeHeight =
    STANDING_EYE_HEIGHT;

  currentPlayerHeight =
    PLAYER_HEIGHT;

  camera.position.set(
    spawnX,
    groundY +
      STANDING_EYE_HEIGHT +
      2,
    spawnZ
  );

  camera.rotation.set(
    0,
    0,
    0
  );

  velocity.set(
    0,
    0,
    0
  );

  updateLoadedChunks(true);

  showNotification(
    "Player respawned"
  );
}

function selectBlock(index) {
  const selectableCount =
    blockTypes.length - 1;

  const normalizedIndex =
    (
      index +
      selectableCount
    ) % selectableCount;

  selectedBlockIndex =
    normalizedIndex;

  selectedBlockNameElement.textContent =
    blockTypes[
      selectedBlockIndex
    ].name;

  const visibleSlots =
    document.querySelectorAll(
      ".hotbar-slot"
    );

  const pageStart =
    Math.floor(
      selectedBlockIndex /
      visibleSlots.length
    ) *
    visibleSlots.length;

  visibleSlots.forEach(
    (slot, slotIndex) => {
      const assignedIndex =
        (
          pageStart +
          slotIndex
        ) % selectableCount;

      slot.dataset.blockIndex =
        assignedIndex;

      const icon =
        slot.querySelector(
          ".block-icon"
        );

      if (icon) {
        const colors =
          blockTypes[
            assignedIndex
          ].colors;

        icon.style.background =
          `linear-gradient(135deg, ${colors[1]}, ${colors[0]}, ${colors[2]})`;
      }

      slot.classList.toggle(
        "selected",
        assignedIndex ===
          selectedBlockIndex
      );
    }
  );
}

function showNotification(message) {
  notificationElement.textContent =
    message;

  notificationElement.classList.add(
    "visible"
  );

  window.clearTimeout(
    notificationTimer
  );

  notificationTimer =
    window.setTimeout(() => {
      notificationElement.classList.remove(
        "visible"
      );
    }, 1500);
}

function saveWorld() {
  const worldData = {
    version: 2,
    seed: worldSeed,
    worldTime,

    player: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      rotationX:
        camera.rotation.x,
      rotationY:
        camera.rotation.y
    },

    editedBlocks:
      Array.from(
        editedBlocks.entries()
      ),

    removedBlocks:
      Array.from(removedBlocks)
  };

  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify(worldData)
  );

  showNotification(
    "Infinite world saved"
  );
}

function loadWorld() {
  const savedWorld =
    localStorage.getItem(SAVE_KEY);

  if (!savedWorld) {
    showNotification(
      "No saved world found"
    );

    return false;
  }

  try {
    const worldData =
      JSON.parse(savedWorld);

    worldSeed =
      worldData.seed ??
      worldSeed;

    worldTime =
      worldData.worldTime ??
      0.25;

    editedBlocks.clear();
    removedBlocks.clear();

    for (
      const [key, type]
      of worldData.editedBlocks ?? []
    ) {
      editedBlocks.set(
        key,
        type
      );
    }

    for (
      const key
      of worldData.removedBlocks ?? []
    ) {
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

    showNotification(
      "World loaded"
    );

    return true;
  } catch (error) {
    console.error(error);

    showNotification(
      "Saved world could not be loaded"
    );

    return false;
  }
}

function clearLoadedChunks() {
  const chunkCoordinates = [];

  for (
    const chunk
    of loadedChunks.values()
  ) {
    chunkCoordinates.push([
      chunk.group.userData.chunkX,
      chunk.group.userData.chunkZ
    ]);
  }

  for (
    const [chunkX, chunkZ]
    of chunkCoordinates
  ) {
    unloadChunk(
      chunkX,
      chunkZ
    );
  }

  blockLookup.clear();

  lastChunkX = Number.NaN;
  lastChunkZ = Number.NaN;
}

function createNewWorld() {
  worldSeed = Math.floor(
    Math.random() * 1000000000
  );

  worldTime = 0.25;

  editedBlocks.clear();
  removedBlocks.clear();

  localStorage.removeItem(
    SAVE_KEY
  );

  clearLoadedChunks();
  respawnPlayer();
  updateLoadedChunks(true);

  showNotification(
    `New seed: ${worldSeed}`
  );
}

function startGame() {
  gameStarted = true;
  gamePaused = false;
  inventoryOpen = false;
  chatOpen = false;

  startScreen.classList.add(
    "hidden"
  );

  pauseScreen.classList.add(
    "hidden"
  );

  hud.classList.remove(
    "hidden"
  );

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

  clearMovementKeys();

  pauseScreen.classList.remove(
    "hidden"
  );

  if (controls.isLocked) {
    controls.unlock();
  }
}

function resumeGame() {
  gamePaused = false;

  pauseScreen.classList.add(
    "hidden"
  );

  if (!isTouchDevice) {
    controls.lock();
  }
}

function bindHoldButton(
  button,
  keyCode
) {
  if (!button) {
    return;
  }

  const press = (event) => {
    event.preventDefault();
    event.stopPropagation();

    keyState[keyCode] = true;

    button.classList.add(
      "active"
    );

    if (button.setPointerCapture) {
      button.setPointerCapture(
        event.pointerId
      );
    }
  };

  const release = (event) => {
    event.preventDefault();
    event.stopPropagation();

    keyState[keyCode] = false;

    button.classList.remove(
      "active"
    );
  };

  button.addEventListener(
    "pointerdown",
    press
  );

  button.addEventListener(
    "pointerup",
    release
  );

  button.addEventListener(
    "pointercancel",
    release
  );

  button.addEventListener(
    "lostpointercapture",
    release
  );
}

function bindActionButton(
  button,
  action
) {
  if (!button) {
    return;
  }

  button.addEventListener(
    "pointerdown",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      action();
    }
  );
}

function configureInput() {
  bindHoldButton(
    document.getElementById(
      "move-forward"
    ),
    "KeyW"
  );

  bindHoldButton(
    document.getElementById(
      "move-backward"
    ),
    "KeyS"
  );

  bindHoldButton(
    document.getElementById(
      "move-left"
    ),
    "KeyA"
  );

  bindHoldButton(
    document.getElementById(
      "move-right"
    ),
    "KeyD"
  );

  const extraButtons =
    addMobileActionButtons();

  bindHoldButton(
    extraButtons.sneakButton,
    "ShiftLeft"
  );

  bindHoldButton(
    extraButtons.rushButton,
    "KeyR"
  );

  bindActionButton(
    extraButtons.inventoryButton,
    openInventory
  );

  bindActionButton(
    extraButtons.chatButton,
    () => {
      openChat("");
    }
  );

  bindActionButton(
    document.getElementById(
      "jump-button"
    ),
    jump
  );

  bindActionButton(
    document.getElementById(
      "break-button"
    ),
    breakTargetedBlock
  );

  bindActionButton(
    document.getElementById(
      "place-button"
    ),
    placeTargetedBlock
  );
}

renderer.domElement.addEventListener(
  "pointerdown",
  (event) => {
    if (
      !isTouchDevice ||
      !gameStarted ||
      gamePaused ||
      inventoryOpen ||
      chatOpen
    ) {
      return;
    }

    event.preventDefault();

    touchLookPointerId =
      event.pointerId;

    previousPointerX =
      event.clientX;

    previousPointerY =
      event.clientY;

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
      event.pointerId !==
        touchLookPointerId ||
      gamePaused ||
      inventoryOpen ||
      chatOpen
    ) {
      return;
    }

    event.preventDefault();

    const movementX =
      event.clientX -
      previousPointerX;

    const movementY =
      event.clientY -
      previousPointerY;

    previousPointerX =
      event.clientX;

    previousPointerY =
      event.clientY;

    camera.rotation.y -=
      movementX * 0.004;

    camera.rotation.x -=
      movementY * 0.004;

    camera.rotation.x =
      THREE.MathUtils.clamp(
        camera.rotation.x,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05
      );
  }
);

renderer.domElement.addEventListener(
  "pointerup",
  (event) => {
    if (
      event.pointerId ===
      touchLookPointerId
    ) {
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

playButton.addEventListener(
  "click",
  startGame
);

loadButton.addEventListener(
  "click",
  () => {
    if (loadWorld()) {
      startGame();
    }
  }
);

resumeButton.addEventListener(
  "click",
  resumeGame
);

saveButton.addEventListener(
  "click",
  saveWorld
);

newWorldButton.addEventListener(
  "click",
  () => {
    createNewWorld();
    resumeGame();
  }
);

mobilePauseButton.addEventListener(
  "click",
  pauseGame
);

controls.addEventListener(
  "unlock",
  () => {
    if (
      gameStarted &&
      !isTouchDevice &&
      !gamePaused &&
      !inventoryOpen &&
      !chatOpen
    ) {
      gamePaused = true;

      pauseScreen.classList.remove(
        "hidden"
      );
    }
  }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (chatOpen) {
      return;
    }

    if (inventoryOpen) {
      if (
        (
          event.code === "KeyE" ||
          event.code === "Escape"
        ) &&
        !event.repeat
      ) {
        event.preventDefault();
        closeInventory();
      }

      return;
    }

    if (!gameStarted) {
      return;
    }

    if (
      event.code === "KeyE" &&
      !event.repeat
    ) {
      event.preventDefault();
      openInventory();
      return;
    }

    if (
      event.code === "KeyT" &&
      !event.repeat
    ) {
      event.preventDefault();
      openChat("");
      return;
    }

    if (
      event.code === "Slash" &&
      !event.repeat
    ) {
      event.preventDefault();
      openChat("/");
      return;
    }

    keyState[event.code] = true;

    if (
      event.code === "Space" &&
      !event.repeat
    ) {
      event.preventDefault();
      jump();
    }

    if (
      event.code.startsWith(
        "Digit"
      )
    ) {
      const number = Number(
        event.code.replace(
          "Digit",
          ""
        )
      );

      if (
        number >= 1 &&
        number <= 9
      ) {
        selectBlock(
          number - 1
        );
      }
    }

    if (
      event.code === "KeyQ" &&
      !event.repeat
    ) {
      selectBlock(
        selectedBlockIndex - 1
      );
    }
  }
);

document.addEventListener(
  "keyup",
  (event) => {
    keyState[event.code] = false;
  }
);

document.addEventListener(
  "mousedown",
  (event) => {
    if (
      isTouchDevice ||
      !gameStarted ||
      gamePaused ||
      inventoryOpen ||
      chatOpen ||
      !controls.isLocked
    ) {
      return;
    }

    if (event.button === 0) {
      breakTargetedBlock();
    } else if (
      event.button === 2
    ) {
      placeTargetedBlock();
    }
  }
);

document.addEventListener(
  "contextmenu",
  (event) => {
    event.preventDefault();
  }
);

document.addEventListener(
  "wheel",
  (event) => {
    if (
      !gameStarted ||
      gamePaused ||
      inventoryOpen ||
      chatOpen
    ) {
      return;
    }

    const direction =
      Math.sign(event.deltaY);

    selectBlock(
      selectedBlockIndex +
      direction
    );
  },
  {
    passive: true
  }
);

document
  .querySelectorAll(
    ".hotbar-slot"
  )
  .forEach((slot) => {
    slot.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        const index = Number(
          slot.dataset.blockIndex ??
          slot.dataset.slot ??
          0
        );

        selectBlock(index);
      }
    );
  });

window.addEventListener(
  "resize",
  () => {
    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        isTouchDevice
          ? 1.25
          : 1.8
      )
    );
  }
);

window.addEventListener(
  "beforeunload",
  () => {
    if (gameStarted) {
      saveWorld();
    }
  }
);

function updateDebug(delta) {
  fpsFrames += 1;
  fpsTimer += delta;

  if (fpsTimer >= 0.5) {
    fpsElement.textContent =
      `FPS: ${Math.round(
        fpsFrames / fpsTimer
      )}`;

    fpsFrames = 0;
    fpsTimer = 0;
  }

  let movementState = "WALK";

  if (isSneaking) {
    movementState = "SNEAK";
  } else if (isRushing) {
    movementState = "RUSH";
  }

  positionElement.textContent =
    `XYZ: ${camera.position.x.toFixed(1)} / ` +
    `${camera.position.y.toFixed(1)} / ` +
    `${camera.position.z.toFixed(1)} | ` +
    movementState;
}

function animate() {
  requestAnimationFrame(animate);

  const currentTime =
    performance.now();

  const delta = Math.min(
    (
      currentTime -
      previousTime
    ) / 1000,
    0.05
  );

  previousTime = currentTime;

  updatePlayer(delta);
  updateSky(delta);
  updateDebug(delta);

  renderer.render(
    scene,
    camera
  );
}

addInterfaceStyles();
createInterfacePanels();
configureInput();
createSky();
createLighting();
respawnPlayer();
updateLoadedChunks(true);
selectBlock(0);
animate();
