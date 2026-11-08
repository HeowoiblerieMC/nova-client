import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

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
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0;

if (isTouchDevice) {
  document.body.classList.add("touch-device");
  deviceMessageElement.textContent =
    "Touch controls and drag-to-look are enabled.";
} else {
  deviceMessageElement.textContent =
    "Click Play, then use the mouse to look around.";
}

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x8fcff4);
scene.fog = new THREE.Fog(0xa8d7ee, 30, 82);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  160
);

camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, isTouchDevice ? 1.4 : 2)
);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !isTouchDevice;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

container.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

const WORLD_SIZE = isTouchDevice ? 26 : 34;
const HALF_WORLD = Math.floor(WORLD_SIZE / 2);
const MAX_BUILD_HEIGHT = 24;
const SAVE_KEY = "nova-client-world-v2";

const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.3;
const EYE_HEIGHT = 1.62;

const WALK_SPEED = 4.7;
const SPRINT_SPEED = 7.1;
const JUMP_SPEED = 7.2;
const GRAVITY = 20;
const BLOCK_REACH = 6;

const keys = {};
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const blockMap = new Map();
const blockMeshes = new Map();
const instancePositions = new Map();
const clouds = [];

let selectedBlockIndex = 0;
let canJump = false;
let gameStarted = false;
let mobilePaused = false;
let previousTime = performance.now();

let fpsFrames = 0;
let fpsTimer = 0;
let notificationTimer = null;

let touchLookActive = false;
let touchLookIdentifier = null;
let previousTouchX = 0;
let previousTouchY = 0;

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
  },
  {
    key: "sand",
    name: "Sand"
  }
];

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function seededRandom(x, y, seed = 0) {
  const value = Math.sin(
    x * 127.1 +
    y * 311.7 +
    seed * 74.7
  ) * 43758.5453123;

  return value - Math.floor(value);
}

function createPixelTexture(baseColor, variants, style = "noise") {
  const size = 16;
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  context.fillStyle = baseColor;
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const randomValue = seededRandom(x, y, variants.length + 3);

      let colorIndex = Math.floor(
        randomValue * variants.length
      );

      if (style === "vertical") {
        colorIndex = Math.floor(
          seededRandom(Math.floor(x / 2), y, 13) *
          variants.length
        );
      }

      if (style === "rings") {
        const distance =
          Math.abs(x - 7.5) +
          Math.abs(y - 7.5);

        colorIndex =
          Math.floor(distance / 2) %
          variants.length;
      }

      if (randomValue > 0.43 || style !== "noise") {
        context.fillStyle = variants[colorIndex];
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

function createGrassSideTexture() {
  const canvas = document.createElement("canvas");

  canvas.width = 16;
  canvas.height = 16;

  const context = canvas.getContext("2d");

  context.fillStyle = "#79543a";
  context.fillRect(0, 0, 16, 16);

  const dirtColors = [
    "#65432f",
    "#8a6244",
    "#5b3b2b",
    "#956b49"
  ];

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const randomValue = seededRandom(x, y, 32);

      if (randomValue > 0.42) {
        const colorIndex = Math.floor(
          randomValue * dirtColors.length
        );

        context.fillStyle = dirtColors[colorIndex];
        context.fillRect(x, y, 1, 1);
      }
    }
  }

  const grassColors = [
    "#4d913c",
    "#62ae49",
    "#397d34",
    "#70bc52"
  ];

  for (let x = 0; x < 16; x += 1) {
    const grassDepth =
      3 + Math.floor(seededRandom(x, 3, 9) * 4);

    for (let y = 0; y < grassDepth; y += 1) {
      const colorIndex = Math.floor(
        seededRandom(x, y, 11) *
        grassColors.length
      );

      context.fillStyle = grassColors[colorIndex];
      context.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

const textures = {
  grassTop: createPixelTexture(
    "#579b41",
    ["#3b7931", "#68ae4c", "#4a8938", "#76bd55"]
  ),

  grassSide: createGrassSideTexture(),

  dirt: createPixelTexture(
    "#79533a",
    ["#65432f", "#8b6243", "#5b3b2b", "#996f4b"]
  ),

  stone: createPixelTexture(
    "#818181",
    ["#656565", "#989898", "#717171", "#a1a1a1"]
  ),

  bedrock: createPixelTexture(
    "#3d3d3d",
    ["#242424", "#555555", "#303030", "#686868"]
  ),

  woodSide: createPixelTexture(
    "#79532f",
    ["#5b3b22", "#8c6338", "#684526", "#9d7242"],
    "vertical"
  ),

  woodTop: createPixelTexture(
    "#a07949",
    ["#664421", "#7d592e", "#ba8f59", "#5b3b1d"],
    "rings"
  ),

  leaves: createPixelTexture(
    "#34723a",
    ["#245a31", "#438a47", "#2b6636", "#4c994f"]
  ),

  sand: createPixelTexture(
    "#dbc886",
    ["#c8b46e", "#ead99a", "#baa35e", "#f0dfa4"]
  )
};

function createMaterial(texture, options = {}) {
  return new THREE.MeshLambertMaterial({
    map: texture,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    alphaTest: options.alphaTest ?? 0
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
  alphaTest: 0.1
});

const materials = {
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

const outlineGeometry = new THREE.EdgesGeometry(
  new THREE.BoxGeometry(1.015, 1.015, 1.015)
);

const outlineMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.9
});

const targetOutline = new THREE.LineSegments(
  outlineGeometry,
  outlineMaterial
);

targetOutline.visible = false;
scene.add(targetOutline);

function setBlock(x, y, z, type) {
  if (
    y < 0 ||
    y > MAX_BUILD_HEIGHT
  ) {
    return;
  }

  blockMap.set(
    blockKey(x, y, z),
    {
      x,
      y,
      z,
      type
    }
  );
}

function deleteBlock(x, y, z) {
  const block = blockMap.get(blockKey(x, y, z));

  if (!block || block.type === "bedrock") {
    return false;
  }

  blockMap.delete(blockKey(x, y, z));
  rebuildBlockMeshes();

  return true;
}

function smoothNoise(x, z, scale, seed) {
  const scaledX = x / scale;
  const scaledZ = z / scale;

  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const factorX = scaledX - x0;
  const factorZ = scaledZ - z0;

  const fadeX =
    factorX * factorX * (3 - 2 * factorX);

  const fadeZ =
    factorZ * factorZ * (3 - 2 * factorZ);

  const n00 = seededRandom(x0, z0, seed);
  const n10 = seededRandom(x1, z0, seed);
  const n01 = seededRandom(x0, z1, seed);
  const n11 = seededRandom(x1, z1, seed);

  const nx0 = THREE.MathUtils.lerp(n00, n10, fadeX);
  const nx1 = THREE.MathUtils.lerp(n01, n11, fadeX);

  return THREE.MathUtils.lerp(nx0, nx1, fadeZ);
}

function getTerrainHeight(x, z) {
  const largeHills =
    smoothNoise(x, z, 13, 4) * 4.5;

  const smallHills =
    smoothNoise(x, z, 5, 18) * 1.7;

  const waves =
    Math.sin(x * 0.15) * 0.55 +
    Math.cos(z * 0.13) * 0.5;

  return Math.floor(
    3 + largeHills + smallHills + waves
  );
}

function addTree(x, groundY, z) {
  const trunkHeight =
    4 + Math.floor(seededRandom(x, z, 39) * 2);

  for (let y = 1; y <= trunkHeight; y += 1) {
    setBlock(x, groundY + y, z, "wood");
  }

  const leafY = groundY + trunkHeight;

  for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      for (let offsetZ = -2; offsetZ <= 2; offsetZ += 1) {
        const distance =
          Math.abs(offsetX) +
          Math.abs(offsetY) +
          Math.abs(offsetZ);

        const randomValue = seededRandom(
          x + offsetX,
          z + offsetZ,
          offsetY + 62
        );

        if (
          distance <= 4 &&
          randomValue > 0.12
        ) {
          const leafX = x + offsetX;
          const finalLeafY = leafY + offsetY;
          const leafZ = z + offsetZ;
          const key = blockKey(leafX, finalLeafY, leafZ);

          if (!blockMap.has(key)) {
            setBlock(
              leafX,
              finalLeafY,
              leafZ,
              "leaves"
            );
          }
        }
      }
    }
  }

  setBlock(x, leafY + 2, z, "leaves");
}

function generateWorld() {
  blockMap.clear();

  const treePositions = [];

  for (
    let x = -HALF_WORLD;
    x < HALF_WORLD;
    x += 1
  ) {
    for (
      let z = -HALF_WORLD;
      z < HALF_WORLD;
      z += 1
    ) {
      const height = getTerrainHeight(x, z);
      const beachHeight = 5;

      for (let y = 0; y <= height; y += 1) {
        let type = "stone";

        if (y === 0) {
          type = "bedrock";
        } else if (y === height) {
          type =
            height <= beachHeight
              ? "sand"
              : "grass";
        } else if (y >= height - 3) {
          type =
            height <= beachHeight
              ? "sand"
              : "dirt";
        }

        setBlock(x, y, z, type);
      }

      const treeChance = seededRandom(x, z, 88);
      const distanceFromSpawn = Math.sqrt(
        x * x + z * z
      );

      if (
        treeChance > 0.962 &&
        height > beachHeight &&
        distanceFromSpawn > 5 &&
        x > -HALF_WORLD + 3 &&
        x < HALF_WORLD - 3 &&
        z > -HALF_WORLD + 3 &&
        z < HALF_WORLD - 3
      ) {
        treePositions.push({
          x,
          y: height,
          z
        });
      }
    }
  }

  const acceptedTrees = [];

  for (const tree of treePositions) {
    const tooClose = acceptedTrees.some((otherTree) => {
      const differenceX = tree.x - otherTree.x;
      const differenceZ = tree.z - otherTree.z;

      return Math.sqrt(
        differenceX * differenceX +
        differenceZ * differenceZ
      ) < 4.5;
    });

    if (!tooClose) {
      acceptedTrees.push(tree);
      addTree(tree.x, tree.y, tree.z);
    }
  }

  rebuildBlockMeshes();
}

function rebuildBlockMeshes() {
  for (const mesh of blockMeshes.values()) {
    scene.remove(mesh);
    mesh.dispose?.();
  }

  blockMeshes.clear();
  instancePositions.clear();

  const groupedBlocks = {};

  for (const block of blockMap.values()) {
    if (!groupedBlocks[block.type]) {
      groupedBlocks[block.type] = [];
    }

    groupedBlocks[block.type].push(block);
  }

  const temporaryMatrix = new THREE.Matrix4();

  for (const [type, blocks] of Object.entries(groupedBlocks)) {
    const mesh = new THREE.InstancedMesh(
      blockGeometry,
      materials[type],
      blocks.length
    );

    mesh.name = `blocks-${type}`;
    mesh.userData.blockType = type;
    mesh.receiveShadow = true;
    mesh.castShadow =
      !isTouchDevice &&
      type !== "leaves";

    blocks.forEach((block, index) => {
      temporaryMatrix.makeTranslation(
        block.x,
        block.y,
        block.z
      );

      mesh.setMatrixAt(index, temporaryMatrix);
    });

    mesh.instanceMatrix.needsUpdate = true;

    scene.add(mesh);
    blockMeshes.set(type, mesh);
    instancePositions.set(type, blocks);
  }

  blockCountElement.textContent =
    `BLOCKS: ${blockMap.size}`;
}

function createSky() {
  const skyGeometry = new THREE.SphereGeometry(
    125,
    24,
    16
  );

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,

    uniforms: {
      topColor: {
        value: new THREE.Color(0x3c96de)
      },

      bottomColor: {
        value: new THREE.Color(0xd5f0ff)
      }
    },

    vertexShader: `
      varying vec3 worldPosition;

      void main() {
        vec4 currentWorldPosition =
          modelMatrix * vec4(position, 1.0);

        worldPosition = currentWorldPosition.xyz;

        gl_Position =
          projectionMatrix *
          modelViewMatrix *
          vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;

      varying vec3 worldPosition;

      void main() {
        float heightValue =
          normalize(worldPosition).y;

        float gradient =
          max(pow(max(heightValue, 0.0), 0.7), 0.0);

        gl_FragColor = vec4(
          mix(bottomColor, topColor, gradient),
          1.0
        );
      }
    `
  });

  scene.add(
    new THREE.Mesh(skyGeometry, skyMaterial)
  );
}

function createLighting() {
  const hemisphereLight = new THREE.HemisphereLight(
    0xe3f5ff,
    0x47613e,
    1.55
  );

  scene.add(hemisphereLight);

  const sunlight = new THREE.DirectionalLight(
    0xfff1c7,
    2
  );

  sunlight.position.set(32, 52, 24);
  sunlight.castShadow = !isTouchDevice;

  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -35;
  sunlight.shadow.camera.right = 35;
  sunlight.shadow.camera.top = 35;
  sunlight.shadow.camera.bottom = -35;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 110;
  sunlight.shadow.bias = -0.0005;

  scene.add(sunlight);

  const sun = new THREE.Mesh(
    new THREE.BoxGeometry(7, 7, 1),
    new THREE.MeshBasicMaterial({
      color: 0xfff2a6,
      fog: false
    })
  );

  sun.position.set(-46, 52, -78);
  sun.lookAt(0, 10, 0);

  scene.add(sun);
}

function createCloud() {
  const cloudGroup = new THREE.Group();

  const cloudMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.88
  });

  const pieceCount =
    4 + Math.floor(Math.random() * 4);

  for (let index = 0; index < pieceCount; index += 1) {
    const piece = new THREE.Mesh(
      new THREE.BoxGeometry(
        3 + Math.random() * 4,
        0.65,
        1.5 + Math.random() * 2
      ),
      cloudMaterial
    );

    piece.position.set(
      index * 2.5,
      Math.random() * 0.2,
      (Math.random() - 0.5) * 2
    );

    cloudGroup.add(piece);
  }

  cloudGroup.position.set(
    -65 + Math.random() * 130,
    22 + Math.random() * 8,
    -65 + Math.random() * 130
  );

  cloudGroup.userData.speed =
    0.4 + Math.random() * 0.25;

  scene.add(cloudGroup);
  clouds.push(cloudGroup);
}

function createClouds() {
  const cloudCount = isTouchDevice ? 7 : 12;

  for (let index = 0; index < cloudCount; index += 1) {
    createCloud();
  }
}

function getHighestGroundBlock(x, z) {
  const roundedX = Math.round(x);
  const roundedZ = Math.round(z);

  for (
    let y = MAX_BUILD_HEIGHT;
    y >= 0;
    y -= 1
  ) {
    const block = blockMap.get(
      blockKey(roundedX, y, roundedZ)
    );

    if (
      block &&
      block.type !== "leaves" &&
      block.type !== "wood"
    ) {
      return y;
    }
  }

  return 0;
}

function resetPlayerPosition() {
  const spawnX = 0;
  const spawnZ = 0;

  const groundY = getHighestGroundBlock(
    spawnX,
    spawnZ
  );

  camera.position.set(
    spawnX,
    groundY + EYE_HEIGHT + 1,
    spawnZ
  );

  camera.rotation.set(0, 0, 0);
  velocity.set(0, 0, 0);
}

function playerIntersectsBlock(x, y, z) {
  const playerFeetY =
    camera.position.y - EYE_HEIGHT;

  const playerHeadY =
    playerFeetY + PLAYER_HEIGHT;

  return (
    camera.position.x + PLAYER_RADIUS > x - 0.5 &&
    camera.position.x - PLAYER_RADIUS < x + 0.5 &&
    playerHeadY > y - 0.5 &&
    playerFeetY < y + 0.5 &&
    camera.position.z + PLAYER_RADIUS > z - 0.5 &&
    camera.position.z - PLAYER_RADIUS < z + 0.5
  );
}

function getNearbyBlocks() {
  const nearbyBlocks = [];

  const playerFeetY =
    camera.position.y - EYE_HEIGHT;

  const minimumX = Math.floor(
    camera.position.x - PLAYER_RADIUS - 1
  );

  const maximumX = Math.ceil(
    camera.position.x + PLAYER_RADIUS + 1
  );

  const minimumY = Math.floor(playerFeetY - 1);

  const maximumY = Math.ceil(
    playerFeetY + PLAYER_HEIGHT + 1
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
        const block = blockMap.get(blockKey(x, y, z));

        if (block) {
          nearbyBlocks.push(block);
        }
      }
    }
  }

  return nearbyBlocks;
}

function resolveHorizontalCollision(axis, oldValue) {
  const nearbyBlocks = getNearbyBlocks();

  for (const block of nearbyBlocks) {
    if (
      playerIntersectsBlock(
        block.x,
        block.y,
        block.z
      )
    ) {
      camera.position[axis] = oldValue;
      return;
    }
  }
}

function resolveVerticalCollision(oldY) {
  const nearbyBlocks = getNearbyBlocks();
  let collided = false;

  for (const block of nearbyBlocks) {
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
        block.y + 0.5 + EYE_HEIGHT;

      velocity.y = 0;
      canJump = true;
    } else {
      camera.position.y = oldY;
      velocity.y = 0;
    }

    break;
  }

  if (!collided) {
    canJump = false;
  }
}

function updatePlayer(delta) {
  const active =
    gameStarted &&
    !mobilePaused &&
    (isTouchDevice || controls.isLocked);

  if (!active) {
    return;
  }

  const sprinting =
    keys.ShiftLeft ||
    keys.ShiftRight;

  const currentSpeed =
    sprinting
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

  const sidewaysMovement =
    direction.x * currentSpeed * delta;

  const forwardMovement =
    direction.z * currentSpeed * delta;

  const oldX = camera.position.x;

  controls.moveRight(sidewaysMovement);
  resolveHorizontalCollision("x", oldX);

  const oldZ = camera.position.z;

  controls.moveForward(forwardMovement);
  resolveHorizontalCollision("z", oldZ);

  const oldY = camera.position.y;

  camera.position.y += velocity.y * delta;
  resolveVerticalCollision(oldY);

  if (camera.position.y < -10) {
    resetPlayerPosition();
    showNotification("Player respawned");
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
  raycaster.setFromCamera(screenCenter, camera);
  raycaster.far = BLOCK_REACH;

  const meshes = Array.from(blockMeshes.values());

  const intersections = raycaster.intersectObjects(
    meshes,
    false
  );

  if (intersections.length === 0) {
    return null;
  }

  const intersection = intersections[0];
  const blockType = intersection.object.userData.blockType;
  const positions = instancePositions.get(blockType);
  const block = positions?.[intersection.instanceId];

  if (!block) {
    return null;
  }

  return {
    intersection,
    block
  };
}

function updateTargetOutline() {
  if (
    !gameStarted ||
    mobilePaused
  ) {
    targetOutline.visible = false;
    return;
  }

  const target = getTargetedBlock();

  if (!target) {
    targetOutline.visible = false;
    return;
  }

  targetOutline.position.set(
    target.block.x,
    target.block.y,
    target.block.z
  );

  targetOutline.visible = true;
}

function breakTargetedBlock() {
  const target = getTargetedBlock();

  if (!target) {
    return;
  }

  const removed = deleteBlock(
    target.block.x,
    target.block.y,
    target.block.z
  );

  if (removed) {
    showNotification(`Broke ${target.block.type}`);
  }
}

function placeTargetedBlock() {
  const target = getTargetedBlock();

  if (
    !target ||
    !target.intersection.face
  ) {
    return;
  }

  const normal =
    target.intersection.face.normal;

  const x = target.block.x + Math.round(normal.x);
  const y = target.block.y + Math.round(normal.y);
  const z = target.block.z + Math.round(normal.z);

  if (
    y < 0 ||
    y > MAX_BUILD_HEIGHT ||
    blockMap.has(blockKey(x, y, z)) ||
    playerIntersectsBlock(x, y, z)
  ) {
    return;
  }

  const selectedType =
    blockTypes[selectedBlockIndex].key;

  setBlock(x, y, z, selectedType);
  rebuildBlockMeshes();

  showNotification(
    `Placed ${blockTypes[selectedBlockIndex].name}`
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

  document
    .querySelectorAll(".hotbar-slot")
    .forEach((slot, slotIndex) => {
      slot.classList.toggle(
        "selected",
        slotIndex === selectedBlockIndex
      );
    });

  selectedBlockNameElement.textContent =
    blockTypes[selectedBlockIndex].name;
}

function showNotification(message) {
  notificationElement.textContent = message;
  notificationElement.classList.add("visible");

  window.clearTimeout(notificationTimer);

  notificationTimer = window.setTimeout(() => {
    notificationElement.classList.remove("visible");
  }, 1700);
}

function updateClouds(delta) {
  for (const cloud of clouds) {
    cloud.position.x +=
      cloud.userData.speed * delta;

    if (cloud.position.x > 70) {
      cloud.position.x = -70;
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

    fpsElement.textContent =
      `FPS: ${currentFps}`;

    fpsFrames = 0;
    fpsTimer = 0;
  }

  positionElement.textContent =
    `XYZ: ${camera.position.x.toFixed(1)} / ` +
    `${camera.position.y.toFixed(1)} / ` +
    `${camera.position.z.toFixed(1)}`;
}

function saveWorld() {
  const worldData = {
    version: 2,
    player: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      rotationX: camera.rotation.x,
      rotationY: camera.rotation.y
    },

    blocks: Array.from(blockMap.values())
  };

  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify(worldData)
  );

  showNotification("World saved");
}

function loadWorld() {
  const savedData = localStorage.getItem(SAVE_KEY);

  if (!savedData) {
    showNotification("No saved world found");
    return false;
  }

  try {
    const worldData = JSON.parse(savedData);

    if (
      !Array.isArray(worldData.blocks) ||
      worldData.blocks.length === 0
    ) {
      throw new Error("Invalid world data");
    }

    blockMap.clear();

    for (const block of worldData.blocks) {
      setBlock(
        block.x,
        block.y,
        block.z,
        block.type
      );
    }

    rebuildBlockMeshes();

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
      resetPlayerPosition();
    }

    showNotification("Saved world loaded");
    return true;
  } catch (error) {
    console.error(error);
    localStorage.removeItem(SAVE_KEY);
    showNotification("Saved world was invalid");
    return false;
  }
}

function startGame() {
  gameStarted = true;
  mobilePaused = false;

  startScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  hud.classList.remove("hidden");

  if (!isTouchDevice) {
    controls.lock();
  }
}

function pauseGame() {
  if (!gameStarted) {
    return;
  }

  mobilePaused = true;
  pauseScreen.classList.remove("hidden");

  if (controls.isLocked) {
    controls.unlock();
  }

  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
}

function resumeGame() {
  mobilePaused = false;
  pauseScreen.classList.add("hidden");
  hud.classList.remove("hidden");

  if (!isTouchDevice) {
    controls.lock();
  }
}

function jump() {
  if (canJump) {
    velocity.y = JUMP_SPEED;
    canJump = false;
  }
}

function bindHoldButton(buttonId, keyCode) {
  const button = document.getElementById(buttonId);

  const press = (event) => {
    event.preventDefault();
    event.stopPropagation();

    keys[keyCode] = true;
    button.classList.add("pressed");
  };

  const release = (event) => {
    event.preventDefault();
    event.stopPropagation();

    keys[keyCode] = false;
    button.classList.remove("pressed");
  };

  button.addEventListener("touchstart", press, {
    passive: false
  });

  button.addEventListener("touchend", release, {
    passive: false
  });

  button.addEventListener("touchcancel", release, {
    passive: false
  });

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
}

function bindActionButton(buttonId, action) {
  const button = document.getElementById(buttonId);

  const runAction = (event) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  button.addEventListener("touchstart", runAction, {
    passive: false
  });

  button.addEventListener("pointerdown", runAction);
}

function findTouchByIdentifier(touches, identifier) {
  for (const touch of touches) {
    if (touch.identifier === identifier) {
      return touch;
    }
  }

  return null;
}

renderer.domElement.addEventListener(
  "touchstart",
  (event) => {
    if (
      !isTouchDevice ||
      mobilePaused ||
      !gameStarted
    ) {
      return;
    }

    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    touchLookActive = true;
    touchLookIdentifier = touch.identifier;
    previousTouchX = touch.clientX;
    previousTouchY = touch.clientY;
  },
  {
    passive: false
  }
);

renderer.domElement.addEventListener(
  "touchmove",
  (event) => {
    if (
      !touchLookActive ||
      mobilePaused
    ) {
      return;
    }

    const touch = findTouchByIdentifier(
      event.touches,
      touchLookIdentifier
    );

    if (!touch) {
      return;
    }

    event.preventDefault();

    const movementX =
      touch.clientX - previousTouchX;

    const movementY =
      touch.clientY - previousTouchY;

    previousTouchX = touch.clientX;
    previousTouchY = touch.clientY;

    camera.rotation.y -= movementX * 0.004;
    camera.rotation.x -= movementY * 0.004;

    camera.rotation.x = THREE.MathUtils.clamp(
      camera.rotation.x,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05
    );
  },
  {
    passive: false
  }
);

renderer.domElement.addEventListener(
  "touchend",
  (event) => {
    const endedTouch = findTouchByIdentifier(
      event.changedTouches,
      touchLookIdentifier
    );

    if (endedTouch) {
      touchLookActive = false;
      touchLookIdentifier = null;
    }
  },
  {
    passive: true
  }
);

playButton.addEventListener("click", () => {
  startGame();
});

loadButton.addEventListener("click", () => {
  const loaded = loadWorld();

  if (loaded) {
    startGame();
  }
});

resumeButton.addEventListener("click", () => {
  resumeGame();
});

saveButton.addEventListener("click", () => {
  saveWorld();
});

newWorldButton.addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);

  generateWorld();
  resetPlayerPosition();

  showNotification("New world created");
  resumeGame();
});

mobilePauseButton.addEventListener("click", () => {
  pauseGame();
});

controls.addEventListener("lock", () => {
  if (!gameStarted) {
    return;
  }

  mobilePaused = false;
  startScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  hud.classList.remove("hidden");
});

controls.addEventListener("unlock", () => {
  if (
    gameStarted &&
    !isTouchDevice
  ) {
    mobilePaused = true;
    pauseScreen.classList.remove("hidden");
  }
});

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;

  if (
    event.code === "Space" &&
    gameStarted &&
    !mobilePaused
  ) {
    event.preventDefault();
    jump();
  }

  if (
    event.code.startsWith("Digit") &&
    gameStarted
  ) {
    const index =
      Number(event.code.replace("Digit", "")) - 1;

    selectHotbarSlot(index);
  }
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

document.addEventListener("mousedown", (event) => {
  if (
    !gameStarted ||
    mobilePaused ||
    isTouchDevice ||
    !controls.isLocked
  ) {
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

document.addEventListener(
  "wheel",
  (event) => {
    if (
      !gameStarted ||
      mobilePaused
    ) {
      return;
    }

    const wheelDirection = Math.sign(event.deltaY);

    const newIndex =
      (
        selectedBlockIndex +
        wheelDirection +
        blockTypes.length
      ) % blockTypes.length;

    selectHotbarSlot(newIndex);
  },
  {
    passive: true
  }
);

document
  .querySelectorAll(".hotbar-slot")
  .forEach((slot) => {
    slot.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const index = Number(slot.dataset.slot);
      selectHotbarSlot(index);
    });
  });

bindHoldButton("move-forward", "KeyW");
bindHoldButton("move-backward", "KeyS");
bindHoldButton("move-left", "KeyA");
bindHoldButton("move-right", "KeyD");

bindActionButton("jump-button", jump);
bindActionButton("break-button", breakTargetedBlock);
bindActionButton("place-button", placeTargetedBlock);

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
      isTouchDevice ? 1.4 : 2
    )
  );
});

window.addEventListener("beforeunload", () => {
  if (gameStarted) {
    saveWorld();
  }
});

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
  updateTargetOutline();
  updateDebug(delta);

  renderer.render(scene, camera);
}

createSky();
createLighting();
createClouds();
generateWorld();
resetPlayerPosition();
selectHotbarSlot(0);
animate();
