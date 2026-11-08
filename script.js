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
const selectedBlockNameElement = document.getElementById("selected-block-name");
const deviceMessageElement = document.getElementById("device-message");

const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
document.body.classList.toggle("touch-device", isTouchDevice);
deviceMessageElement.textContent = isTouchDevice
  ? "Touch controls, Inventory, Chat, Sneak, and Rush are enabled."
  : "WASD Move, Shift Sneak, R Rush, E Inventory, T Chat.";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88c9ef);
scene.fog = new THREE.Fog(0xa8d6ed, 48, 155);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 280);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice ? 1.25 : 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const controls = new THREE.PointerLockControls(camera, document.body);
const SAVE_KEY = "nova-client-survival-world-v4";
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = isTouchDevice ? 2 : 3;
const BASE_GROUND_LEVEL = 8;
const BUILD_LIMIT = 64;
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
const center = new THREE.Vector2(0, 0);
const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const keys = {};
const loadedChunks = new Map();
const blockLookup = new Map();
const editedBlocks = new Map();
const removedBlocks = new Set();
const inventory = new Map();
const hotbar = new Array(9).fill(null);
const clouds = [];
const chatHistory = [];

let worldSeed = Math.floor(Math.random() * 1e9);
let selectedSlot = 0;
let gameMode = "survival";
let canJump = false;
let sneaking = false;
let rushing = false;
let started = false;
let paused = false;
let inventoryOpen = false;
let chatOpen = false;
let eyeHeight = STANDING_EYE_HEIGHT;
let playerHeight = PLAYER_HEIGHT;
let lastChunkX = NaN;
let lastChunkZ = NaN;
let previousTime = performance.now();
let fpsTime = 0;
let fpsFrames = 0;
let noticeTimer = null;
let touchPointer = null;
let lastTouchX = 0;
let lastTouchY = 0;
let worldTime = 0.25;
let sun = null;
let hemisphereLight = null;
let sunlight = null;

const blocks = [
  { key: "grass", name: "Grass Block", colors: ["#559b42", "#79bd59", "#3e7d34"], placeable: true },
  { key: "dirt", name: "Dirt", colors: ["#765039", "#936746", "#5f3e2d"], placeable: true },
  { key: "stone", name: "Stone", colors: ["#7d7d7d", "#9a9a9a", "#626262"], placeable: true },
  { key: "cobblestone", name: "Cobblestone", colors: ["#6d6d6d", "#8b8b8b", "#515151"], placeable: true },
  { key: "sand", name: "Sand", colors: ["#d8c37f", "#ead99a", "#baa663"], placeable: true },
  { key: "gravel", name: "Gravel", colors: ["#74716d", "#928c84", "#55524f"], placeable: true },
  { key: "wood", name: "Oak Log", colors: ["#76502d", "#9a7041", "#55371f"], placeable: true },
  { key: "planks", name: "Oak Planks", colors: ["#b0834f", "#cf9e60", "#896136"], placeable: true, pattern: "planks" },
  { key: "leaves", name: "Oak Leaves", colors: ["#32703a", "#478d4a", "#24572f"], placeable: true, transparent: true },
  { key: "bricks", name: "Bricks", colors: ["#8c4638", "#ad5e4c", "#6c332d"], placeable: true, pattern: "bricks" },
  { key: "glass", name: "Glass", colors: ["#b5e8ec", "#d8f7f8", "#84cbd2"], placeable: true, transparent: true, opacity: 0.55 },
  { key: "coal_ore", name: "Coal Ore", colors: ["#737373", "#252525", "#555555"], placeable: true },
  { key: "iron_ore", name: "Iron Ore", colors: ["#7b7b7b", "#b68b68", "#d2a27b"], placeable: true },
  { key: "gold_ore", name: "Gold Ore", colors: ["#797979", "#e2b92e", "#f4d54d"], placeable: true },
  { key: "diamond_ore", name: "Diamond Ore", colors: ["#737373", "#31c6c4", "#62efea"], placeable: true },
  { key: "emerald_block", name: "Emerald Block", colors: ["#139f55", "#3fe987", "#087139"], placeable: true },
  { key: "bedrock", name: "Bedrock", colors: ["#303030", "#555555", "#171717"], unbreakable: true }
];
const items = [...blocks.filter(b => !b.unbreakable),
  { key: "coal", name: "Coal", colors: ["#181818", "#343434", "#080808"] },
  { key: "raw_iron", name: "Raw Iron", colors: ["#b88768", "#d7a481", "#805e4a"] },
  { key: "raw_gold", name: "Raw Gold", colors: ["#d49f23", "#f1cd4b", "#9a6a12"] },
  { key: "diamond", name: "Diamond", colors: ["#2db7ba", "#61f4ef", "#187f82"] },
  { key: "stick", name: "Stick", colors: ["#75502d", "#a67843", "#4c321c"] },
  { key: "apple", name: "Apple", colors: ["#a51d28", "#e23e45", "#5e1018"] }
];
const drops = { grass: "dirt", dirt: "dirt", stone: "cobblestone", cobblestone: "cobblestone", sand: "sand", gravel: "gravel", wood: "wood", planks: "planks", leaves: "leaves", bricks: "bricks", glass: null, coal_ore: "coal", iron_ore: "raw_iron", gold_ore: "raw_gold", diamond_ore: "diamond", emerald_block: "emerald_block" };
const blockByKey = key => blocks.find(b => b.key === key);
const itemByKey = key => items.find(i => i.key === key);

function noise(x, z, offset = 0) {
  const v = Math.sin(x * 127.1 + z * 311.7 + (worldSeed + offset) * 0.000731) * 43758.5453123;
  return v - Math.floor(v);
}
function smoothNoise(x, z, scale, offset) {
  const sx = x / scale, sz = z / scale;
  const x0 = Math.floor(sx), z0 = Math.floor(sz), x1 = x0 + 1, z1 = z0 + 1;
  const fx = sx - x0, fz = sz - z0;
  const ax = fx * fx * (3 - 2 * fx), az = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(noise(x0, z0, offset), noise(x1, z0, offset), ax),
    THREE.MathUtils.lerp(noise(x0, z1, offset), noise(x1, z1, offset), ax), az
  );
}
function terrainHeight(x, z) {
  return Math.max(4, Math.floor(BASE_GROUND_LEVEL + smoothNoise(x, z, 80, 10) * 8 + smoothNoise(x, z, 28, 20) * 7 + smoothNoise(x, z, 9, 30) * 2.5));
}
function posKey(x, y, z) { return `${x},${y},${z}`; }
function chunkKey(x, z) { return `${x},${z}`; }
function toChunk(v) { return Math.floor(v / CHUNK_SIZE); }
function generatedType(x, y, z) {
  const height = terrainHeight(x, z);
  if (y < 0 || y > height) return null;
  if (y === 0) return "bedrock";
  if (y === height) return height <= 7 ? "sand" : "grass";
  if (y >= height - 3) return height <= 7 ? "sand" : "dirt";
  const ore = noise(x * 17 + y * 37, z * 23 - y * 13, 700);
  if (y < 8 && ore > 0.993) return "diamond_ore";
  if (y < 12 && ore > 0.985) return "gold_ore";
  if (y < 18 && ore > 0.965) return "iron_ore";
  if (ore > 0.94) return "coal_ore";
  if (ore > 0.9 && ore < 0.92) return "gravel";
  return "stone";
}
function worldBlock(x, y, z) {
  const key = posKey(x, y, z);
  if (removedBlocks.has(key)) return null;
  if (editedBlocks.has(key)) return editedBlocks.get(key);
  if (blockLookup.has(key)) return blockLookup.get(key);
  return generatedType(x, y, z);
}

function pixelTexture(type) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.height = 16;
  ctx.fillStyle = type.colors[0]; ctx.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = noise(x, y, type.colors.length * 131);
    ctx.fillStyle = type.colors[Math.floor(n * type.colors.length) % type.colors.length];
    if (type.pattern === "planks" && y % 5 === 0) ctx.fillStyle = "#5d4127";
    if (type.pattern === "bricks" && (y % 5 === 0 || (x + (Math.floor(y / 5) % 2 ? 4 : 0)) % 8 === 0)) ctx.fillStyle = "#5a302a";
    if (n > 0.42 || type.pattern) ctx.fillRect(x, y, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const materials = {};
for (const type of blocks) materials[type.key] = new THREE.MeshLambertMaterial({ map: pixelTexture(type), transparent: !!type.transparent, opacity: type.opacity ?? 1, alphaTest: type.key === "leaves" ? 0.15 : 0, depthWrite: type.key !== "glass" });

function addTree(x, y, z, list) {
  const h = 4 + Math.floor(noise(x, z, 900) * 3);
  for (let i = 1; i <= h; i++) list.push({ x, y: y + i, z, type: "wood" });
  for (let ox = -2; ox <= 2; ox++) for (let oy = -2; oy <= 2; oy++) for (let oz = -2; oz <= 2; oz++) {
    if (Math.abs(ox) + Math.abs(oy) + Math.abs(oz) <= 4 && noise(x + ox, z + oz, oy + 300) > 0.12) list.push({ x: x + ox, y: y + h + oy, z: z + oz, type: "leaves" });
  }
}
function generateChunk(cx, cz) {
  const list = [], sx = cx * CHUNK_SIZE, sz = cz * CHUNK_SIZE;
  for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const x = sx + lx, z = sz + lz, h = terrainHeight(x, z);
    for (let y = Math.max(0, h - 7); y <= h; y++) {
      const key = posKey(x, y, z);
      if (!removedBlocks.has(key)) list.push({ x, y, z, type: editedBlocks.get(key) ?? generatedType(x, y, z) });
    }
    if (noise(x, z, 850) > 0.988 && h > 8 && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13) addTree(x, h, z, list);
  }
  for (const [key, type] of editedBlocks) {
    const [x, y, z] = key.split(",").map(Number);
    if (toChunk(x) === cx && toChunk(z) === cz && !list.some(b => b.x === x && b.y === y && b.z === z)) list.push({ x, y, z, type });
  }
  return list.filter(b => b.type && !removedBlocks.has(posKey(b.x, b.y, b.z)));
}
function createChunk(cx, cz) {
  const key = chunkKey(cx, cz); if (loadedChunks.has(key)) return;
  const chunkBlocks = generateChunk(cx, cz), group = new THREE.Group(), grouped = {};
  group.userData.chunkX = cx; group.userData.chunkZ = cz;
  for (const b of chunkBlocks) { (grouped[b.type] ??= []).push(b); blockLookup.set(posKey(b.x, b.y, b.z), b.type); }
  const matrix = new THREE.Matrix4();
  for (const [type, list] of Object.entries(grouped)) {
    if (!materials[type]) continue;
    const mesh = new THREE.InstancedMesh(blockGeometry, materials[type], list.length);
    mesh.userData.blocks = list;
    list.forEach((b, i) => { matrix.makeTranslation(b.x, b.y, b.z); mesh.setMatrixAt(i, matrix); });
    mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  }
  scene.add(group); loadedChunks.set(key, { group, blocks: chunkBlocks });
}
function unloadChunk(cx, cz) {
  const key = chunkKey(cx, cz), chunk = loadedChunks.get(key); if (!chunk) return;
  for (const b of chunk.blocks) blockLookup.delete(posKey(b.x, b.y, b.z));
  scene.remove(chunk.group); loadedChunks.delete(key);
}
function reloadChunk(x, z) { const cx = toChunk(x), cz = toChunk(z); unloadChunk(cx, cz); createChunk(cx, cz); updateCounter(); }
function updateChunks(force = false) {
  const cx = toChunk(camera.position.x), cz = toChunk(camera.position.z);
  if (!force && cx === lastChunkX && cz === lastChunkZ) return;
  lastChunkX = cx; lastChunkZ = cz;
  const required = new Set();
  for (let ox = -RENDER_DISTANCE; ox <= RENDER_DISTANCE; ox++) for (let oz = -RENDER_DISTANCE; oz <= RENDER_DISTANCE; oz++) { required.add(chunkKey(cx + ox, cz + oz)); createChunk(cx + ox, cz + oz); }
  for (const [key, chunk] of [...loadedChunks]) if (!required.has(key)) unloadChunk(chunk.group.userData.chunkX, chunk.group.userData.chunkZ);
  updateCounter();
}
function updateCounter() { let count = 0; for (const c of loadedChunks.values()) count += c.blocks.length; blockCountElement.textContent = `LOADED: ${count} | CHUNKS: ${loadedChunks.size}`; }

function createSky() {
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(230, 24, 16), new THREE.MeshBasicMaterial({ color: 0x88c9ef, side: THREE.BackSide, fog: false })));
  const c = document.createElement("canvas"), ctx = c.getContext("2d"); c.width = c.height = 16;
  ctx.fillStyle = "#fff1a0"; ctx.fillRect(0, 0, 16, 16); ctx.fillStyle = "#ffe166"; ctx.fillRect(2, 2, 12, 12); ctx.fillStyle = "#fffbcf"; ctx.fillRect(4, 4, 8, 8);
  const tex = new THREE.CanvasTexture(c); tex.magFilter = tex.minFilter = THREE.NearestFilter;
  sun = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, fog: false })); scene.add(sun);
  const cloudCount = isTouchDevice ? 8 : 14;
  for (let i = 0; i < cloudCount; i++) {
    const group = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthWrite: false });
    for (const p of [[0,0,8,3],[5,0,5,4],[-5,1,5,3],[1,3,6,3]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(p[2], 0.8, p[3]), mat); m.position.set(p[0], 0, p[1]); group.add(m); }
    group.position.set((i % 4) * 58 - 87, 46 + (i % 3) * 3, Math.floor(i / 4) * 58 - 85); group.userData.speed = 1.1 + (i % 3) * 0.18; scene.add(group); clouds.push(group);
  }
}
function createLighting() { hemisphereLight = new THREE.HemisphereLight(0xe4f6ff, 0x46613d, 1.55); sunlight = new THREE.DirectionalLight(0xfff2ce, 1.7); scene.add(hemisphereLight, sunlight); }
function updateSky(delta) {
  worldTime = (worldTime + delta * 0.0025) % 1;
  const angle = worldTime * Math.PI * 2, daylight = THREE.MathUtils.clamp(Math.sin(angle) * 0.7 + 0.4, 0.06, 1);
  sun.position.set(camera.position.x + Math.cos(angle) * 150, Math.sin(angle) * 150, camera.position.z - 110); sun.lookAt(camera.position); sunlight.position.copy(sun.position);
  const day = new THREE.Color(0x88c9ef), sunset = new THREE.Color(0xe89962), night = new THREE.Color(0x071024);
  const color = daylight > 0.45 ? day.clone().lerp(sunset, THREE.MathUtils.clamp((0.8 - daylight) * 2, 0, 1)) : sunset.clone().lerp(night, THREE.MathUtils.clamp(1 - daylight * 2, 0, 1));
  scene.background.copy(color); scene.fog.color.copy(color); hemisphereLight.intensity = 0.25 + daylight * 1.3; sunlight.intensity = 0.1 + daylight * 1.6;
  for (const cloud of clouds) { cloud.position.x += cloud.userData.speed * delta; if (cloud.position.x > camera.position.x + 150) cloud.position.x = camera.position.x - 150; }
}

function addUI() {
  const style = document.createElement("style"); style.textContent = `
  #hotbar{max-width:calc(100vw - 12px)}#hotbar .hotbar-slot{position:relative}.slot-count{position:absolute;right:3px;bottom:1px;color:#fff;font:900 12px monospace;text-shadow:1px 1px #000}
  #inventory-screen,#chat-screen{position:fixed;inset:0;z-index:220;display:none;pointer-events:auto}#inventory-screen.open{display:flex;align-items:center;justify-content:center;padding:20px;background:#000a;backdrop-filter:blur(8px)}
  #inventory-panel{width:min(780px,100%);max-height:84vh;overflow:auto;padding:22px;border:2px solid #ffffff38;border-radius:12px;background:#101612fa}#inventory-panel h2{text-align:center;letter-spacing:5px}.inventory-mode{text-align:center;color:#43ef88;margin:6px 0 16px}
  #inventory-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}.inventory-item{position:relative;min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:2px solid #ffffff1c;border-radius:7px;color:#fff;background:#ffffff0d}.inventory-item:hover{border-color:#43ef88}.inventory-icon{width:45px;height:45px;border:2px solid #0005;box-shadow:inset -7px -7px #0002}.inventory-count{position:absolute;right:7px;bottom:5px;font:900 12px monospace}#inventory-close{width:100%;margin-top:16px;padding:12px;border:0;border-radius:7px;background:#43ef88;font-weight:900}
  #chat-screen.open{display:flex;align-items:flex-end;padding:0 16px 24px}#chat-panel{width:min(720px,100%)}#chat-history{max-height:220px;overflow:auto;margin-bottom:7px;padding:10px;background:#0009;color:#fff;font:13px/1.5 monospace}#chat-input{width:100%;padding:12px;border:2px solid #fff9;background:#000d;color:#fff;font:15px monospace;user-select:text;touch-action:auto}
  #sneak-button,#rush-button,#inventory-mobile-button,#chat-mobile-button{width:72px;height:43px;font-size:9px}#sneak-button.active,#rush-button.active{color:#031009;background:#43ef88}
  @media(max-width:800px),(pointer:coarse){#hotbar{gap:1px;padding:2px}#hotbar .hotbar-slot{width:clamp(31px,8.5vw,45px);height:clamp(31px,8.5vw,45px)}#hotbar .block-icon{width:clamp(19px,5.2vw,27px);height:clamp(19px,5.2vw,27px)}.slot-number{font-size:8px}.slot-count{font-size:9px}}
  `; document.head.appendChild(style);
  const inv = document.createElement("section"); inv.id = "inventory-screen"; inv.innerHTML = `<div id="inventory-panel"><h2>INVENTORY</h2><div class="inventory-mode" id="inventory-mode">SURVIVAL</div><div id="inventory-grid"></div><div id="inventory-empty">Inventory is empty</div><button id="inventory-close" type="button">CLOSE INVENTORY</button></div>`; document.body.appendChild(inv);
  const chat = document.createElement("section"); chat.id = "chat-screen"; chat.innerHTML = `<div id="chat-panel"><div id="chat-history"></div><input id="chat-input" maxlength="180" autocomplete="off" spellcheck="false" placeholder="Press Enter to send"></div>`; document.body.appendChild(chat);
  document.getElementById("inventory-close").addEventListener("click", closeInventory);
  document.getElementById("chat-input").addEventListener("keydown", e => { e.stopPropagation(); if (e.code === "Enter") { e.preventDefault(); submitChat(); } else if (e.code === "Escape") { e.preventDefault(); closeChat(); } });
}
function createHotbar() {
  const bar = document.getElementById("hotbar"); bar.innerHTML = "";
  for (let i = 0; i < 9; i++) { const slot = document.createElement("button"); slot.type = "button"; slot.className = "hotbar-slot"; slot.innerHTML = `<span class="slot-number">${i + 1}</span><span class="block-icon"></span><span class="slot-count"></span>`; slot.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); selectSlot(i); }); bar.appendChild(slot); }
  updateHotbar();
}
function countItem(key) { return inventory.get(key) ?? 0; }
function addItem(key, amount = 1) { inventory.set(key, countItem(key) + amount); if (!hotbar.includes(key)) { const slot = hotbar.indexOf(null); if (slot >= 0) hotbar[slot] = key; } updateHotbar(); buildInventory(); }
function removeItem(key, amount = 1) { if (gameMode === "creative") return true; const n = countItem(key); if (n < amount) return false; if (n === amount) { inventory.delete(key); for (let i = 0; i < 9; i++) if (hotbar[i] === key) hotbar[i] = null; } else inventory.set(key, n - amount); updateHotbar(); buildInventory(); return true; }
function resetInventory() { inventory.clear(); hotbar.fill(null); selectedSlot = 0; updateHotbar(); buildInventory(); }
function selectSlot(i) { selectedSlot = (i + 9) % 9; updateHotbar(); }
function updateHotbar() {
  document.querySelectorAll("#hotbar .hotbar-slot").forEach((slot, i) => {
    const key = hotbar[i], icon = slot.querySelector(".block-icon"), count = slot.querySelector(".slot-count"); slot.classList.toggle("selected", i === selectedSlot);
    if (!key) { icon.style.background = "transparent"; icon.style.borderColor = "transparent"; count.textContent = ""; return; }
    const type = itemByKey(key); icon.style.borderColor = "#0004"; icon.style.background = `linear-gradient(135deg,${type.colors[1]},${type.colors[0]},${type.colors[2]})`; count.textContent = gameMode === "creative" ? "â" : countItem(key);
  });
  selectedBlockNameElement.textContent = hotbar[selectedSlot] ? itemByKey(hotbar[selectedSlot])?.name ?? hotbar[selectedSlot] : "Empty Slot";
}
function buildInventory() {
  const grid = document.getElementById("inventory-grid"), empty = document.getElementById("inventory-empty"), mode = document.getElementById("inventory-mode"); if (!grid) return;
  mode.textContent = gameMode.toUpperCase(); grid.innerHTML = "";
  const available = gameMode === "creative" ? items.filter(i => i.placeable) : [...inventory].filter(([,n]) => n > 0).map(([k]) => itemByKey(k)).filter(Boolean);
  empty.style.display = available.length ? "none" : "block";
  for (const type of available) { const button = document.createElement("button"); button.type = "button"; button.className = "inventory-item"; button.innerHTML = `<span class="inventory-icon" style="background:linear-gradient(135deg,${type.colors[1]},${type.colors[0]},${type.colors[2]})"></span><span>${type.name}</span><span class="inventory-count">${gameMode === "creative" ? "â" : countItem(type.key)}</span>`; button.addEventListener("pointerdown", e => { e.preventDefault(); let slot = hotbar.indexOf(type.key); if (slot < 0) slot = hotbar.indexOf(null); if (slot < 0) slot = selectedSlot; hotbar[slot] = type.key; selectSlot(slot); closeInventory(); }); grid.appendChild(button); }
}
function clearKeys() { for (const k of Object.keys(keys)) keys[k] = false; document.querySelectorAll(".mobile-control.active").forEach(b => b.classList.remove("active")); }
function openInventory() { if (!started || chatOpen) return; inventoryOpen = paused = true; clearKeys(); buildInventory(); document.getElementById("inventory-screen").classList.add("open"); if (controls.isLocked) controls.unlock(); }
function closeInventory() { if (!inventoryOpen) return; inventoryOpen = paused = false; document.getElementById("inventory-screen").classList.remove("open"); if (!isTouchDevice && started) controls.lock(); }
function renderChat() { const box = document.getElementById("chat-history"); box.innerHTML = ""; for (const entry of chatHistory) { const line = document.createElement("div"); line.textContent = entry.message; line.style.color = entry.type === "error" ? "#ff8585" : entry.type === "system" ? "#a5ffbd" : "#fff"; box.appendChild(line); } box.scrollTop = box.scrollHeight; }
function chatMessage(message, type = "normal") { chatHistory.push({ message, type }); if (chatHistory.length > 40) chatHistory.shift(); renderChat(); }
function openChat(text = "") { if (!started || inventoryOpen) return; chatOpen = paused = true; clearKeys(); renderChat(); const screen = document.getElementById("chat-screen"), input = document.getElementById("chat-input"); screen.classList.add("open"); if (controls.isLocked) controls.unlock(); input.value = text; setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 20); }
function closeChat() { if (!chatOpen) return; chatOpen = paused = false; document.getElementById("chat-screen").classList.remove("open"); document.getElementById("chat-input").blur(); if (!isTouchDevice && started) controls.lock(); }
function setMode(mode) { if (!['survival','creative'].includes(mode)) return false; gameMode = mode; if (mode === 'creative') { blocks.filter(b => b.placeable).slice(0,9).forEach((b,i) => hotbar[i] = b.key); } else hotbar.forEach((k,i) => { if (k && countItem(k) <= 0) hotbar[i] = null; }); updateHotbar(); buildInventory(); return true; }
function runCommand(text) {
  const p = text.slice(1).trim().split(/\s+/), cmd = p[0]?.toLowerCase();
  if (cmd === "help") chatMessage("/spawn /tp x y z /seed /save /time day|sunset|night /gamemode survival|creative /give item amount", "system");
  else if (cmd === "spawn") { respawn(); chatMessage("Teleported to spawn.", "system"); }
  else if (cmd === "seed") chatMessage(`Seed: ${worldSeed}`, "system");
  else if (cmd === "save") { saveWorld(); chatMessage("World saved.", "system"); }
  else if (cmd === "gamemode") chatMessage(setMode(p[1]?.toLowerCase()) ? `Game mode set to ${p[1]}.` : "Usage: /gamemode survival|creative", setMode ? "system" : "error");
  else if (cmd === "give") { const key = p[1], amount = Math.max(1, Math.min(999, Number(p[2]) || 1)); if (!itemByKey(key)) chatMessage(`Unknown item: ${key ?? ''}`, "error"); else { addItem(key, amount); chatMessage(`Given ${key} x${amount}.`, "system"); } }
  else if (cmd === "tp") { const [x,y,z] = p.slice(1,4).map(Number); if (![x,y,z].every(Number.isFinite)) chatMessage("Usage: /tp x y z", "error"); else { camera.position.set(x,y,z); velocity.set(0,0,0); updateChunks(true); chatMessage(`Teleported to ${x} ${y} ${z}.`, "system"); } }
  else if (cmd === "time") { const map = { day:0.25, sunset:0.48, night:0.75 }; if (!(p[1] in map)) chatMessage("Usage: /time day|sunset|night", "error"); else { worldTime = map[p[1]]; chatMessage(`Time set to ${p[1]}.`, "system"); } }
  else chatMessage(`Unknown command: /${cmd ?? ''}`, "error");
}
function submitChat() { const input = document.getElementById("chat-input"), text = input.value.trim(); if (!text) return closeChat(); chatMessage(text.startsWith("/") ? text : `<Player> ${text}`); if (text.startsWith("/")) runCommand(text); input.value = ""; closeChat(); }
function notify(text) { notificationElement.textContent = text; notificationElement.classList.add("visible"); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => notificationElement.classList.remove("visible"), 1500); }

function getBounds(x, y, z) { const feet = y - eyeHeight; return { minX:x-PLAYER_RADIUS,maxX:x+PLAYER_RADIUS,minY:feet,maxY:feet+playerHeight,minZ:z-PLAYER_RADIUS,maxZ:z+PLAYER_RADIUS }; }
function intersects(b, x, y, z) { return b.maxX > x-.5 && b.minX < x+.5 && b.maxY > y-.5 && b.minY < y+.5 && b.maxZ > z-.5 && b.minZ < z+.5; }
function collides(x, y, z) { const b = getBounds(x,y,z); for (let bx=Math.floor(b.minX-.5); bx<=Math.floor(b.maxX+.5); bx++) for (let by=Math.floor(b.minY-.5); by<=Math.floor(b.maxY+.5); by++) for (let bz=Math.floor(b.minZ-.5); bz<=Math.floor(b.maxZ+.5); bz++) if (worldBlock(bx,by,bz) && intersects(b,bx,by,bz)) return true; return false; }
function supported(x,z) { const y = camera.position.y - eyeHeight - .12, r=.2; return [[0,0],[-r,-r],[r,-r],[-r,r],[r,r]].some(([ox,oz]) => worldBlock(Math.floor(x+ox+.5),Math.floor(y),Math.floor(z+oz+.5))); }
function moveAxis(axis, distance) { const steps=Math.max(1,Math.ceil(Math.abs(distance)/.06)), d=distance/steps; for(let i=0;i<steps;i++){ const nx=axis==='x'?camera.position.x+d:camera.position.x, nz=axis==='z'?camera.position.z+d:camera.position.z; if(collides(nx,camera.position.y,nz)) return; if(sneaking&&canJump&&velocity.y<=0&&!supported(nx,nz)) return; camera.position[axis]+=d; } }
function moveVertical(distance) { const steps=Math.max(1,Math.ceil(Math.abs(distance)/.06)), d=distance/steps; for(let i=0;i<steps;i++){ const ny=camera.position.y+d; if(collides(camera.position.x,ny,camera.position.z)){ if(velocity.y<=0)canJump=true; velocity.y=0; return; } camera.position.y=ny; canJump=false; } }
function updatePlayer(delta) {
  if(!started||paused||inventoryOpen||chatOpen||(!isTouchDevice&&!controls.isLocked))return;
  sneaking=!!(keys.ShiftLeft||keys.ShiftRight); rushing=!!keys.KeyR;
  const targetEye=sneaking?SNEAKING_EYE_HEIGHT:STANDING_EYE_HEIGHT, oldEye=eyeHeight; eyeHeight=THREE.MathUtils.lerp(eyeHeight,targetEye,.24); camera.position.y+=eyeHeight-oldEye; playerHeight=sneaking?SNEAK_PLAYER_HEIGHT:PLAYER_HEIGHT;
  const speed=sneaking?SNEAK_SPEED:rushing?RUSH_SPEED:WALK_SPEED, ix=(keys.KeyD?1:0)-(keys.KeyA?1:0), iz=(keys.KeyW?1:0)-(keys.KeyS?1:0), len=Math.hypot(ix,iz)||1;
  camera.getWorldDirection(forward); forward.y=0; forward.normalize(); right.set(-forward.z,0,forward.x);
  moveAxis('x',(right.x*ix/len+forward.x*iz/len)*speed*delta); moveAxis('z',(right.z*ix/len+forward.z*iz/len)*speed*delta);
  velocity.y-=GRAVITY*delta; moveVertical(velocity.y*delta); if(camera.position.y<-20)respawn(); updateChunks();
}
function targetBlock() { raycaster.setFromCamera(center,camera); raycaster.far=BLOCK_REACH; const meshes=[]; for(const c of loadedChunks.values())meshes.push(...c.group.children); const hit=raycaster.intersectObjects(meshes,false)[0]; if(!hit)return null; const block=hit.object.userData.blocks?.[hit.instanceId]; return block?{hit,block}:null; }
function breakBlock() { if(paused)return; const t=targetBlock(); if(!t)return; const type=blockByKey(t.block.type); if(type?.unbreakable)return notify("Bedrock cannot be broken"); const drop=drops[t.block.type]; if(gameMode==='survival'&&drop)addItem(drop,1); const key=posKey(t.block.x,t.block.y,t.block.z); editedBlocks.delete(key); removedBlocks.add(key); reloadChunk(t.block.x,t.block.z); notify(drop&&gameMode==='survival'?`Collected ${itemByKey(drop)?.name??drop}`:`Broke ${type?.name??'Block'}`); }
function placeBlock() { if(paused)return; const t=targetBlock(); if(!t||!t.hit.face)return; const n=t.hit.face.normal,x=t.block.x+Math.round(n.x),y=t.block.y+Math.round(n.y),z=t.block.z+Math.round(n.z),key=posKey(x,y,z); if(y<0||y>BUILD_LIMIT||worldBlock(x,y,z))return; const item=hotbar[selectedSlot],type=blockByKey(item); if(!item)return notify("This slot is empty"); if(!type?.placeable)return notify("This item cannot be placed"); if(gameMode==='survival'&&countItem(item)<=0)return notify("No blocks available"); editedBlocks.set(key,item); removedBlocks.delete(key); reloadChunk(x,z); if(collides(camera.position.x,camera.position.y,camera.position.z)){editedBlocks.delete(key);removedBlocks.add(key);reloadChunk(x,z);return notify("Cannot place a block here");} removeItem(item,1); notify(`Placed ${type.name}`); }
function jump(){if(canJump&&!paused){velocity.y=JUMP_SPEED;canJump=false;}}
function respawn(){const y=terrainHeight(0,0);eyeHeight=STANDING_EYE_HEIGHT;playerHeight=PLAYER_HEIGHT;camera.position.set(0,y+eyeHeight+2,0);camera.rotation.set(0,0,0);velocity.set(0,0,0);updateChunks(true);notify("Player respawned");}

function saveWorld(){localStorage.setItem(SAVE_KEY,JSON.stringify({version:4,seed:worldSeed,worldTime,gameMode,player:{x:camera.position.x,y:camera.position.y,z:camera.position.z,rx:camera.rotation.x,ry:camera.rotation.y},edited:[...editedBlocks],removed:[...removedBlocks],inventory:[...inventory],hotbar:[...hotbar],selectedSlot}));notify("World saved");}
function loadWorld(){const raw=localStorage.getItem(SAVE_KEY);if(!raw){notify("No saved world found");return false;}try{const d=JSON.parse(raw);worldSeed=d.seed??worldSeed;worldTime=d.worldTime??.25;gameMode=d.gameMode??'survival';editedBlocks.clear();removedBlocks.clear();inventory.clear();for(const e of d.edited??[])editedBlocks.set(...e);for(const k of d.removed??[])removedBlocks.add(k);for(const e of d.inventory??[])inventory.set(...e);for(let i=0;i<9;i++)hotbar[i]=d.hotbar?.[i]??null;selectedSlot=d.selectedSlot??0;clearChunks();if(d.player){camera.position.set(d.player.x,d.player.y,d.player.z);camera.rotation.set(d.player.rx??0,d.player.ry??0,0);}else respawn();updateChunks(true);updateHotbar();buildInventory();notify("World loaded");return true;}catch(e){console.error(e);notify("Saved world could not be loaded");return false;}}
function clearChunks(){for(const c of [...loadedChunks.values()])unloadChunk(c.group.userData.chunkX,c.group.userData.chunkZ);blockLookup.clear();lastChunkX=lastChunkZ=NaN;}
function newWorld(){worldSeed=Math.floor(Math.random()*1e9);worldTime=.25;gameMode='survival';editedBlocks.clear();removedBlocks.clear();localStorage.removeItem(SAVE_KEY);resetInventory();clearChunks();respawn();updateChunks(true);notify(`New survival world: ${worldSeed}`);}
function startGame(){started=true;paused=inventoryOpen=chatOpen=false;startScreen.classList.add("hidden");pauseScreen.classList.add("hidden");hud.classList.remove("hidden");updateChunks(true);updateHotbar();if(!isTouchDevice)controls.lock();}
function pauseGame(){if(!started)return;paused=true;clearKeys();pauseScreen.classList.remove("hidden");if(controls.isLocked)controls.unlock();}
function resumeGame(){paused=false;pauseScreen.classList.add("hidden");if(!isTouchDevice)controls.lock();}

function mobileButtons(){const a=document.getElementById("action-controls"),jump=document.getElementById("jump-button"),out={};for(const [id,label] of [["sneak-button","SNEAK"],["rush-button","RUSH"],["inventory-mobile-button","INVENTORY"],["chat-mobile-button","CHAT"]]){const b=document.createElement("button");b.id=id;b.type="button";b.className="mobile-control action-button";b.textContent=label;a.insertBefore(b,jump);out[id]=b;}return out;}
function bindHold(button,key){if(!button)return;const down=e=>{e.preventDefault();e.stopPropagation();keys[key]=true;button.classList.add("active");button.setPointerCapture?.(e.pointerId);},up=e=>{e.preventDefault();e.stopPropagation();keys[key]=false;button.classList.remove("active");};button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up);button.addEventListener("lostpointercapture",up);}
function bindAction(button,action){button?.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();action();});}
function configureInput(){bindHold(document.getElementById("move-forward"),"KeyW");bindHold(document.getElementById("move-backward"),"KeyS");bindHold(document.getElementById("move-left"),"KeyA");bindHold(document.getElementById("move-right"),"KeyD");const b=mobileButtons();bindHold(b["sneak-button"],"ShiftLeft");bindHold(b["rush-button"],"KeyR");bindAction(b["inventory-mobile-button"],openInventory);bindAction(b["chat-mobile-button"],()=>openChat(""));bindAction(document.getElementById("jump-button"),jump);bindAction(document.getElementById("break-button"),breakBlock);bindAction(document.getElementById("place-button"),placeBlock);}

renderer.domElement.addEventListener("pointerdown",e=>{if(!isTouchDevice||!started||paused)return;e.preventDefault();touchPointer=e.pointerId;lastTouchX=e.clientX;lastTouchY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener("pointermove",e=>{if(!isTouchDevice||e.pointerId!==touchPointer||paused)return;const dx=e.clientX-lastTouchX,dy=e.clientY-lastTouchY;lastTouchX=e.clientX;lastTouchY=e.clientY;camera.rotation.y-=dx*.004;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.004,-Math.PI/2+.05,Math.PI/2-.05);});
renderer.domElement.addEventListener("pointerup",e=>{if(e.pointerId===touchPointer)touchPointer=null;});
playButton.addEventListener("click",startGame);loadButton.addEventListener("click",()=>{if(loadWorld())startGame();});resumeButton.addEventListener("click",resumeGame);saveButton.addEventListener("click",saveWorld);newWorldButton.addEventListener("click",()=>{newWorld();resumeGame();});mobilePauseButton.addEventListener("click",pauseGame);
controls.addEventListener("unlock",()=>{if(started&&!isTouchDevice&&!paused&&!inventoryOpen&&!chatOpen){paused=true;pauseScreen.classList.remove("hidden");}});
document.addEventListener("keydown",e=>{if(chatOpen)return;if(inventoryOpen){if((e.code==="KeyE"||e.code==="Escape")&&!e.repeat){e.preventDefault();closeInventory();}return;}if(!started)return;if(e.code==="KeyE"&&!e.repeat){e.preventDefault();return openInventory();}if(e.code==="KeyT"&&!e.repeat){e.preventDefault();return openChat("");}if(e.code==="Slash"&&!e.repeat){e.preventDefault();return openChat("/");}keys[e.code]=true;if(e.code==="Space"&&!e.repeat){e.preventDefault();jump();}if(e.code.startsWith("Digit")){const n=Number(e.code.slice(5));if(n>=1&&n<=9)selectSlot(n-1);}});
document.addEventListener("keyup",e=>keys[e.code]=false);
document.addEventListener("mousedown",e=>{if(isTouchDevice||!started||paused||!controls.isLocked)return;if(e.button===0)breakBlock();else if(e.button===2)placeBlock();});
document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("wheel",e=>{if(started&&!paused)selectSlot((selectedSlot+Math.sign(e.deltaY)+9)%9);},{passive:true});
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,isTouchDevice?1.25:1.8));});
window.addEventListener("beforeunload",()=>{if(started)saveWorld();});
function updateDebug(delta){fpsFrames++;fpsTime+=delta;if(fpsTime>=.5){fpsElement.textContent=`FPS: ${Math.round(fpsFrames/fpsTime)}`;fpsFrames=fpsTime=0;}positionElement.textContent=`XYZ: ${camera.position.x.toFixed(1)} / ${camera.position.y.toFixed(1)} / ${camera.position.z.toFixed(1)} | ${sneaking?'SNEAK':rushing?'RUSH':'WALK'} | ${gameMode.toUpperCase()}`;}
function animate(){requestAnimationFrame(animate);const now=performance.now(),delta=Math.min((now-previousTime)/1000,.05);previousTime=now;updatePlayer(delta);updateSky(delta);updateDebug(delta);renderer.render(scene,camera);}

addUI();createHotbar();configureInput();createSky();createLighting();resetInventory();respawn();updateChunks(true);animate();
