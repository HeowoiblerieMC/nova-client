"use strict";

const q = (s) => document.querySelector(s);
const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
document.body.classList.toggle("touch-device", isTouch);

const PROFILE_KEY = "nova-profile-v1";
const SAVE_KEY = "nova-world-v17";
const profile = { name: "Player", skin: null };
const validName = (name) => /^[A-Za-z0-9_]{3,16}$/.test(name);

function makeDefaultSkin() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "#0b2115"; x.fillRect(0, 0, 64, 64);
  x.fillStyle = "#d6b187"; x.fillRect(8, 8, 8, 8);
  x.fillStyle = "#43ef88"; x.fillRect(20, 20, 24, 12); x.fillRect(4, 20, 12, 24); x.fillRect(48, 20, 12, 24);
  x.fillStyle = "#0c6b3b"; x.fillRect(20, 32, 10, 24); x.fillRect(34, 32, 10, 24);
  x.fillStyle = "#07110c"; x.fillRect(10, 11, 2, 2); x.fillRect(14, 11, 2, 2);
  return c.toDataURL("image/png");
}
function loadProfile() {
  try { Object.assign(profile, JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}); } catch {}
  if (!validName(profile.name)) profile.name = "Player";
  if (!profile.skin) profile.skin = makeDefaultSkin();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  updateProfileUI();
}
function drawSkin(canvas, source) {
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.onload = () => {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#04130b"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = canvas.width / 32;
    ctx.drawImage(img, 8, 8, 8, 8, 8*s, 1*s, 16*s, 16*s);
    ctx.drawImage(img, 20, 20, 8, 12, 8*s, 17*s, 16*s, 24*s);
    ctx.drawImage(img, 4, 20, 4, 12, 0*s, 17*s, 8*s, 24*s);
    ctx.drawImage(img, 44, 20, 4, 12, 24*s, 17*s, 8*s, 24*s);
    ctx.drawImage(img, 4, 20, 4, 12, 8*s, 41*s, 8*s, 23*s);
    ctx.drawImage(img, 20, 52, 4, 12, 16*s, 41*s, 8*s, 23*s);
  };
  img.src = source;
}
function updateProfileUI() {
  q("#start-player-name").value = profile.name;
  q("#pause-player-name").textContent = profile.name;
  q("#hud-player-name").textContent = profile.name;
  drawSkin(q("#start-skin-preview"), profile.skin);
  drawSkin(q("#pause-skin-preview"), profile.skin);
}
let pendingSkin = null;
q("#start-skin-file").addEventListener("change", () => {
  const file = q("#start-skin-file").files[0];
  if (!file || file.type !== "image/png") return q("#start-profile-status").textContent = "Select a PNG file.";
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      if (img.width !== 64 || img.height !== 64) return q("#start-profile-status").textContent = "Skin must be exactly 64x64 pixels.";
      pendingSkin = reader.result;
      drawSkin(q("#start-skin-preview"), pendingSkin);
      q("#start-profile-status").textContent = "Skin ready. Select SAVE PROFILE.";
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
q("#save-start-profile").addEventListener("click", () => {
  const name = q("#start-player-name").value.trim();
  if (!validName(name)) return q("#start-profile-status").textContent = "Use 3-16 letters, numbers, or underscore.";
  profile.name = name;
  if (pendingSkin) profile.skin = pendingSkin;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  updateProfileUI();
  q("#start-profile-status").textContent = "Profile saved.";
});

const progressSteps = ["Preparing renderer...", "Loading block textures...", "Generating inventory...", "Preparing world engine...", "Ready."];
let loadingProgress = 0;
const loadingTimer = setInterval(() => {
  loadingProgress = Math.min(100, loadingProgress + (loadingProgress < 70 ? 7 : 3));
  q("#progress-bar").style.width = `${loadingProgress}%`;
  q("#progress-percent").textContent = `${loadingProgress}%`;
  q("#progress-status").textContent = progressSteps[Math.min(4, Math.floor(loadingProgress / 24))];
  if (loadingProgress >= 100) {
    clearInterval(loadingTimer);
    loadProfile();
    setTimeout(() => {
      q("#loading-screen").classList.add("loading-done");
      q("#start-screen").classList.remove("hidden");
    }, 250);
  }
}, 75);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88c9ef);
scene.fog = new THREE.Fog(0xa8d6ed, 40, 145);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 260);
camera.rotation.order = "YXZ";
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.2 : 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
q("#game-container").appendChild(renderer.domElement);
const controls = new THREE.PointerLockControls(camera, document.body);

const CHUNK = 16, RENDER_DISTANCE = isTouch ? 2 : 3, REACH = 6;
const EYE = 1.62, SNEAK_EYE = 1.32, RADIUS = 0.3, HEIGHT = 1.75, SNEAK_HEIGHT = 1.45;
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2();
const velocity = new THREE.Vector3();
const keys = {};
const chunks = new Map(), lookup = new Map(), edits = new Map(), removed = new Set();
const inventory = new Map(), hotbar = new Array(9).fill(null), materials = {};
let seed = Math.floor(Math.random() * 1e9), selectedSlot = 0, gameMode = "survival";
let started = false, paused = false, inventoryOpen = false, chatOpen = false, canJump = false, sneaking = false, rushing = false;
let eyeHeight = EYE, playerHeight = HEIGHT, lastCX = NaN, lastCZ = NaN, lastTime = performance.now(), worldTime = 0.25;
let fpsFrames = 0, fpsTime = 0, noticeTimer = null, touchId = null, touchX = 0, touchY = 0;

const blockTypes = [
  ["grass","Grass Block",["#559b42","#79bd59","#3e7d34"]],["dirt","Dirt",["#765039","#936746","#5f3e2d"]],["stone","Stone",["#777","#999","#555"]],
  ["cobblestone","Cobblestone",["#666","#888","#444"]],["sand","Sand",["#d8c37f","#ead99a","#baa663"]],["red_sand","Red Sand",["#b65c32","#d97a43","#873d25"]],
  ["gravel","Gravel",["#74716d","#928c84","#55524f"]],["clay","Clay",["#8e9ba7","#aebbc5","#6e7d89"]],["snow","Snow Block",["#e8f4f6","#fff","#c7dfe5"]],
  ["ice","Ice",["#78bfe7","#bcecff","#4b9ed1"],true,.72],["wood","Oak Log",["#76502d","#9a7041","#55371f"]],["planks","Oak Planks",["#b0834f","#cf9e60","#896136"]],
  ["birch_log","Birch Log",["#d6d0b8","#eee8cf","#605b50"]],["birch_planks","Birch Planks",["#d8c78e","#f0dfa9","#b09d69"]],["spruce_log","Spruce Log",["#4e351f","#6d4b2d","#302014"]],
  ["spruce_planks","Spruce Planks",["#74502e","#91663c","#55381f"]],["leaves","Oak Leaves",["#32703a","#478d4a","#24572f"],true,1],["glass","Glass",["#b5e8ec","#d8f7f8","#84cbd2"],true,.55],
  ["bricks","Bricks",["#8c4638","#ad5e4c","#6c332d"]],["stone_bricks","Stone Bricks",["#73777a","#969b9e","#55595c"]],["mossy_stone_bricks","Mossy Stone Bricks",["#667260","#87927b","#465340"]],
  ["sandstone","Sandstone",["#d9bd79","#efd99a","#b59658"]],["deepslate","Deepslate",["#3f4548","#596064","#292e31"]],["obsidian","Obsidian",["#20152f","#3a2854","#0d0914"]],
  ["coal_ore","Coal Ore",["#737373","#252525","#555"]],["iron_ore","Iron Ore",["#777","#b68b68","#d2a27b"]],["copper_ore","Copper Ore",["#747575","#b76f4d","#d38a62"]],
  ["gold_ore","Gold Ore",["#777","#e2b92e","#f4d54d"]],["lapis_ore","Lapis Ore",["#6e7478","#2851a3","#17326d"]],["redstone_ore","Redstone Ore",["#747474","#b82626","#671313"]],
  ["diamond_ore","Diamond Ore",["#737373","#31c6c4","#62efea"]],["emerald_block","Emerald Block",["#139f55","#3fe987","#087139"]],["crafting_table","Crafting Table",["#8b592f","#bd7b43","#50321f"]],
  ["furnace","Furnace",["#686868","#898989","#333"]],["chest","Chest",["#9b6428","#c98a3d","#5d3919"]],["bookshelf","Bookshelf",["#7c4c28","#c04444","#315ca8"]],
  ["tnt","TNT",["#bd2525","#f03e3e","#f2e8cf"]],["bedrock","Bedrock",["#303030","#555","#171717"],false,1,true]
].map(([key,name,colors,transparent=false,opacity=1,unbreakable=false])=>({key,name,colors,transparent,opacity,unbreakable,placeable:!unbreakable}));
const itemTypes = [...blockTypes.filter(b=>!b.unbreakable),
  {key:"coal",name:"Coal",colors:["#181818","#343434","#080808"]},{key:"raw_iron",name:"Raw Iron",colors:["#b88768","#d7a481","#805e4a"]},
  {key:"copper_ingot",name:"Copper Ingot",colors:["#b76743","#e29a70","#81452f"]},{key:"raw_gold",name:"Raw Gold",colors:["#d49f23","#f1cd4b","#9a6a12"]},
  {key:"diamond",name:"Diamond",colors:["#2db7ba","#61f4ef","#187f82"]},{key:"emerald",name:"Emerald",colors:["#0c9c50","#47ef91","#086632"]},
  {key:"lapis_lazuli",name:"Lapis Lazuli",colors:["#224aa0","#4474d6","#10275d"]},{key:"redstone_dust",name:"Redstone Dust",colors:["#9e1111","#e12d2d","#5b0808"]},
  {key:"stick",name:"Stick",colors:["#75502d","#a67843","#4c321c"]},{key:"apple",name:"Apple",colors:["#a51d28","#e23e45","#5e1018"]},{key:"bread",name:"Bread",colors:["#b97725","#e0a44b","#805018"]},
  ...["wooden","stone","iron","diamond"].flatMap((t,i)=>[{key:`${t}_pickaxe`,name:`${t[0].toUpperCase()+t.slice(1)} Pickaxe`,colors:[["#75502d","#aa7844","#3d2918"],["#666","#999","#3d3d3d"],["#c7c5bd","#eee","#777"],["#22adaf","#61efeb","#12696b"]][i]},{key:`${t}_sword`,name:`${t[0].toUpperCase()+t.slice(1)} Sword`,colors:[["#75502d","#aa7844","#3d2918"],["#666","#999","#3d3d3d"],["#c7c5bd","#eee","#777"],["#22adaf","#61efeb","#12696b"]][i]}])
];
const drop = {grass:"dirt",dirt:"dirt",stone:"cobblestone",cobblestone:"cobblestone",sand:"sand",red_sand:"red_sand",gravel:"gravel",clay:"clay",snow:"snow",ice:null,wood:"wood",planks:"planks",birch_log:"birch_log",birch_planks:"birch_planks",spruce_log:"spruce_log",spruce_planks:"spruce_planks",leaves:"leaves",glass:null,bricks:"bricks",stone_bricks:"stone_bricks",mossy_stone_bricks:"mossy_stone_bricks",sandstone:"sandstone",deepslate:"deepslate",obsidian:"obsidian",coal_ore:"coal",iron_ore:"raw_iron",copper_ore:"copper_ingot",gold_ore:"raw_gold",lapis_ore:"lapis_lazuli",redstone_ore:"redstone_dust",diamond_ore:"diamond",emerald_block:"emerald",crafting_table:"crafting_table",furnace:"furnace",chest:"chest",bookshelf:"bookshelf",tnt:"tnt"};
const blockByKey = k => blockTypes.find(x=>x.key===k), itemByKey = k => itemTypes.find(x=>x.key===k);

function noise(x,z,o=0){const v=Math.sin(x*127.1+z*311.7+(seed+o)*.000731)*43758.5453123;return v-Math.floor(v)}
function smooth(x,z,s,o){const X=x/s,Z=z/s,x0=Math.floor(X),z0=Math.floor(Z),fx=X-x0,fz=Z-z0,ax=fx*fx*(3-2*fx),az=fz*fz*(3-2*fz);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(noise(x0,z0,o),noise(x0+1,z0,o),ax),THREE.MathUtils.lerp(noise(x0,z0+1,o),noise(x0+1,z0+1,o),ax),az)}
function height(x,z){return Math.max(4,Math.floor(8+smooth(x,z,80,10)*8+smooth(x,z,28,20)*7+smooth(x,z,9,30)*2.5))}
const posKey=(x,y,z)=>`${x},${y},${z}`, chunkKey=(x,z)=>`${x},${z}`, toChunk=v=>Math.floor(v/CHUNK);
function generated(x,y,z){const h=height(x,z);if(y<0||y>h)return null;if(y===0)return"bedrock";if(y===h)return h<=7?"sand":h>20?"snow":"grass";if(y>=h-3)return h<=7?"sand":"dirt";const n=noise(x*17+y*37,z*23-y*13,700);if(y<8&&n>.993)return"diamond_ore";if(y<10&&n>.988)return"redstone_ore";if(y<12&&n>.982)return"gold_ore";if(y<16&&n>.974)return"lapis_ore";if(y<18&&n>.96)return"iron_ore";if(n>.95)return"copper_ore";if(n>.92)return"coal_ore";return y<7?"deepslate":"stone"}
function worldBlock(x,y,z){const k=posKey(x,y,z);if(removed.has(k))return null;if(edits.has(k))return edits.get(k);if(lookup.has(k))return lookup.get(k);return generated(x,y,z)}
function texture(type){const c=document.createElement("canvas"),x=c.getContext("2d");c.width=c.height=16;x.fillStyle=type.colors[0];x.fillRect(0,0,16,16);for(let y=0;y<16;y++)for(let i=0;i<16;i++){const n=noise(i,y,type.colors.length*131);x.fillStyle=type.colors[Math.floor(n*type.colors.length)%type.colors.length];if(n>.42)x.fillRect(i,y,1,1)}const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.colorSpace=THREE.SRGBColorSpace;return t}
for(const type of blockTypes)materials[type.key]=new THREE.MeshLambertMaterial({map:texture(type),transparent:type.transparent,opacity:type.opacity,alphaTest:type.key==="leaves"?.15:0,depthWrite:type.key!=="glass"&&type.key!=="ice"});

function addTree(x,y,z,list){const h=4+Math.floor(noise(x,z,900)*3);for(let i=1;i<=h;i++)list.push({x,y:y+i,z,type:"wood"});for(let ox=-2;ox<=2;ox++)for(let oy=-2;oy<=2;oy++)for(let oz=-2;oz<=2;oz++)if(Math.abs(ox)+Math.abs(oy)+Math.abs(oz)<=4&&noise(x+ox,z+oz,oy+300)>.12)list.push({x:x+ox,y:y+h+oy,z:z+oz,type:"leaves"})}
function generateChunk(cx,cz){const list=[],sx=cx*CHUNK,sz=cz*CHUNK;for(let lx=0;lx<CHUNK;lx++)for(let lz=0;lz<CHUNK;lz++){const x=sx+lx,z=sz+lz,h=height(x,z);for(let y=Math.max(0,h-8);y<=h;y++){const k=posKey(x,y,z);if(!removed.has(k))list.push({x,y,z,type:edits.get(k)??generated(x,y,z)})}if(noise(x,z,850)>.988&&h>8&&h<20&&lx>1&&lx<14&&lz>1&&lz<14)addTree(x,h,z,list)}for(const[k,type]of edits){const[x,y,z]=k.split(",").map(Number);if(toChunk(x)===cx&&toChunk(z)===cz&&!list.some(b=>b.x===x&&b.y===y&&b.z===z))list.push({x,y,z,type})}return list.filter(b=>b.type&&!removed.has(posKey(b.x,b.y,b.z)))}
function createChunk(cx,cz){const key=chunkKey(cx,cz);if(chunks.has(key))return;const list=generateChunk(cx,cz),group=new THREE.Group(),grouped={};group.userData.cx=cx;group.userData.cz=cz;for(const b of list){(grouped[b.type]??=[]).push(b);lookup.set(posKey(b.x,b.y,b.z),b.type)}const m=new THREE.Matrix4();for(const[type,arr]of Object.entries(grouped)){const mesh=new THREE.InstancedMesh(blockGeometry,materials[type],arr.length);mesh.userData.blocks=arr;arr.forEach((b,i)=>{m.makeTranslation(b.x,b.y,b.z);mesh.setMatrixAt(i,m)});mesh.instanceMatrix.needsUpdate=true;group.add(mesh)}scene.add(group);chunks.set(key,{group,blocks:list})}
function unload(cx,cz){const key=chunkKey(cx,cz),c=chunks.get(key);if(!c)return;for(const b of c.blocks)lookup.delete(posKey(b.x,b.y,b.z));scene.remove(c.group);chunks.delete(key)}
function reload(x,z){const cx=toChunk(x),cz=toChunk(z);unload(cx,cz);createChunk(cx,cz)}
function updateChunks(force=false){const cx=toChunk(camera.position.x),cz=toChunk(camera.position.z);if(!force&&cx===lastCX&&cz===lastCZ)return;lastCX=cx;lastCZ=cz;const req=new Set();for(let x=-RENDER_DISTANCE;x<=RENDER_DISTANCE;x++)for(let z=-RENDER_DISTANCE;z<=RENDER_DISTANCE;z++){req.add(chunkKey(cx+x,cz+z));createChunk(cx+x,cz+z)}for(const[k,c]of[...chunks])if(!req.has(k))unload(c.group.userData.cx,c.group.userData.cz);let count=0;for(const c of chunks.values())count+=c.blocks.length;q("#block-count").textContent=`LOADED: ${count} | CHUNKS: ${chunks.size}`}

scene.add(new THREE.HemisphereLight(0xe4f6ff,0x46613d,1.55));const sunLight=new THREE.DirectionalLight(0xfff2ce,1.6);scene.add(sunLight);const sky=new THREE.Mesh(new THREE.SphereGeometry(220,24,16),new THREE.MeshBasicMaterial({color:0x88c9ef,side:THREE.BackSide,fog:false}));scene.add(sky);const sun=new THREE.Mesh(new THREE.PlaneGeometry(15,15),new THREE.MeshBasicMaterial({color:0xffef9e,side:THREE.DoubleSide,fog:false}));scene.add(sun);const clouds=[];for(let i=0;i<(isTouch?8:14);i++){const g=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.88,depthWrite:false});for(const p of[[0,0,8,3],[5,0,5,4],[-5,1,5,3],[1,3,6,3]]){const m=new THREE.Mesh(new THREE.BoxGeometry(p[2],.8,p[3]),mat);m.position.set(p[0],0,p[1]);g.add(m)}g.position.set((i%4)*58-87,46+(i%3)*3,Math.floor(i/4)*58-85);g.userData.speed=1.1+(i%3)*.18;scene.add(g);clouds.push(g)}
function updateSky(dt){worldTime=(worldTime+dt*.0025)%1;const a=worldTime*Math.PI*2,d=THREE.MathUtils.clamp(Math.sin(a)*.7+.4,.08,1);sun.position.set(camera.position.x+Math.cos(a)*150,Math.sin(a)*150,camera.position.z-110);sun.lookAt(camera.position);sunLight.position.copy(sun.position);const color=new THREE.Color(d>.45?0x88c9ef:0x1b2845);scene.background.copy(color);scene.fog.color.copy(color);sunLight.intensity=.1+d*1.5;for(const c of clouds){c.position.x+=c.userData.speed*dt;if(c.position.x>camera.position.x+150)c.position.x=camera.position.x-150}}

function createHotbar(){const bar=q("#hotbar");bar.innerHTML="";for(let i=0;i<9;i++){const s=document.createElement("button");s.className="hotbar-slot";s.innerHTML=`<span class="slot-number">${i+1}</span><span class="item-icon"></span><span class="slot-count"></span>`;s.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();selectedSlot=i;updateHotbar()});bar.appendChild(s)}updateHotbar()}
const count=k=>inventory.get(k)??0;
function addItem(k,n=1){inventory.set(k,count(k)+n);if(!hotbar.includes(k)){const i=hotbar.indexOf(null);if(i>=0)hotbar[i]=k}updateHotbar();buildInventory()}
function removeItem(k,n=1){if(gameMode==="creative")return true;if(count(k)<n)return false;if(count(k)===n){inventory.delete(k);hotbar.forEach((v,i)=>{if(v===k)hotbar[i]=null})}else inventory.set(k,count(k)-n);updateHotbar();buildInventory();return true}
function updateHotbar(){q("#hotbar").querySelectorAll(".hotbar-slot").forEach((s,i)=>{const k=hotbar[i],icon=s.querySelector(".item-icon"),num=s.querySelector(".slot-count");s.classList.toggle("selected",i===selectedSlot);if(!k){icon.style.background="transparent";num.textContent="";return}const t=itemByKey(k);icon.style.background=`linear-gradient(135deg,${t.colors[1]},${t.colors[0]},${t.colors[2]})`;num.textContent=gameMode==="creative"?"INF":count(k)});q("#selected-block-name").textContent=hotbar[selectedSlot]?itemByKey(hotbar[selectedSlot]).name:"Empty Slot"}
function buildInventory(){const grid=q("#inventory-grid");grid.innerHTML="";q("#inventory-mode").textContent=gameMode.toUpperCase();const list=gameMode==="creative"?itemTypes:[...inventory].filter(([,n])=>n>0).map(([k])=>itemByKey(k)).filter(Boolean);q("#inventory-empty").style.display=list.length?"none":"block";for(const t of list){const b=document.createElement("button");b.className="inventory-item";b.innerHTML=`<span class="item-icon" style="background:linear-gradient(135deg,${t.colors[1]},${t.colors[0]},${t.colors[2]})"></span><span>${t.name}</span><span class="inventory-count">${gameMode==="creative"?"INF":count(t.key)}</span>`;b.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();let slot=gameMode==="creative"?selectedSlot:hotbar.indexOf(t.key);if(slot<0)slot=hotbar.indexOf(null);if(slot<0)slot=selectedSlot;hotbar[slot]=t.key;selectedSlot=slot;updateHotbar();closeInventory()});grid.appendChild(b)}}
function clearKeys(){Object.keys(keys).forEach(k=>keys[k]=false);document.querySelectorAll(".mobile-button.active").forEach(b=>b.classList.remove("active"))}
function openInventory(){if(!started||chatOpen)return;inventoryOpen=paused=true;clearKeys();buildInventory();q("#inventory-screen").classList.remove("hidden");if(controls.isLocked)controls.unlock()}
function closeInventory(){inventoryOpen=paused=false;q("#inventory-screen").classList.add("hidden");if(!isTouch&&started)controls.lock()}
q("#inventory-close").addEventListener("click",closeInventory);
function chatMessage(text,color="#fff"){const line=document.createElement("div");line.textContent=text;line.style.color=color;q("#chat-history").appendChild(line);q("#chat-history").scrollTop=99999}
function openChat(text=""){if(!started||inventoryOpen)return;chatOpen=paused=true;clearKeys();q("#chat-screen").classList.remove("hidden");if(controls.isLocked)controls.unlock();q("#chat-input").value=text;setTimeout(()=>q("#chat-input").focus(),20)}
function closeChat(){chatOpen=paused=false;q("#chat-screen").classList.add("hidden");q("#chat-input").blur();if(!isTouch&&started)controls.lock()}
function command(text){const p=text.slice(1).trim().split(/\s+/),c=p[0]?.toLowerCase();if(c==="gamemode"){if(!["survival","creative"].includes(p[1]))return chatMessage("Usage: /gamemode survival|creative","#ff8585");gameMode=p[1];hotbar.fill(null);selectedSlot=0;updateHotbar();buildInventory();chatMessage(`Game mode set to ${gameMode}. Hotbar cleared.`,"#a5ffbd")}else if(c==="give"){const t=itemByKey(p[1]),n=Math.max(1,Math.min(999,Number(p[2])||1));if(!t)return chatMessage("Unknown item.","#ff8585");addItem(t.key,n);chatMessage(`Given ${t.name} x${n}.`,"#a5ffbd")}else if(c==="time"){const m={day:.25,sunset:.48,night:.75};if(!(p[1]in m))return chatMessage("Usage: /time day|sunset|night","#ff8585");worldTime=m[p[1]]}else if(c==="seed")chatMessage(`Seed: ${seed}`,"#a5ffbd");else if(c==="spawn")respawn();else if(c==="save")saveWorld();else chatMessage("Unknown command.","#ff8585")}
q("#chat-input").addEventListener("keydown",e=>{e.stopPropagation();if(e.code==="Enter"){const t=e.target.value.trim();if(t){chatMessage(t.startsWith("/")?t:`<${profile.name}> ${t}`);if(t.startsWith("/"))command(t)}closeChat()}else if(e.code==="Escape")closeChat()});

function bounds(x,y,z){const feet=y-eyeHeight;return{minX:x-RADIUS,maxX:x+RADIUS,minY:feet,maxY:feet+playerHeight,minZ:z-RADIUS,maxZ:z+RADIUS}}
function collides(x,y,z){const b=bounds(x,y,z);for(let bx=Math.floor(b.minX-.5);bx<=Math.floor(b.maxX+.5);bx++)for(let by=Math.floor(b.minY-.5);by<=Math.floor(b.maxY+.5);by++)for(let bz=Math.floor(b.minZ-.5);bz<=Math.floor(b.maxZ+.5);bz++)if(worldBlock(bx,by,bz)&&b.maxX>bx-.5&&b.minX<bx+.5&&b.maxY>by-.5&&b.minY<by+.5&&b.maxZ>bz-.5&&b.minZ<bz+.5)return true;return false}
function supported(x,z){const y=camera.position.y-eyeHeight-.12,r=.2;return[[0,0],[-r,-r],[r,-r],[-r,r],[r,r]].some(([ox,oz])=>worldBlock(Math.floor(x+ox+.5),Math.floor(y),Math.floor(z+oz+.5)))}
function moveAxis(axis,d){const n=Math.max(1,Math.ceil(Math.abs(d)/.06)),step=d/n;for(let i=0;i<n;i++){const x=axis==="x"?camera.position.x+step:camera.position.x,z=axis==="z"?camera.position.z+step:camera.position.z;if(collides(x,camera.position.y,z))return;if(sneaking&&canJump&&velocity.y<=0&&!supported(x,z))return;camera.position[axis]+=step}}
function moveVertical(d){const n=Math.max(1,Math.ceil(Math.abs(d)/.06)),step=d/n;for(let i=0;i<n;i++){const y=camera.position.y+step;if(collides(camera.position.x,y,camera.position.z)){if(velocity.y<=0)canJump=true;velocity.y=0;return}camera.position.y=y;canJump=false}}
function updatePlayer(dt){if(!started||paused||(!isTouch&&!controls.isLocked))return;sneaking=!!(keys.ShiftLeft||keys.ShiftRight);rushing=!!keys.KeyR;const target=sneaking?SNEAK_EYE:EYE,old=eyeHeight;eyeHeight=THREE.MathUtils.lerp(eyeHeight,target,.24);camera.position.y+=eyeHeight-old;playerHeight=sneaking?SNEAK_HEIGHT:HEIGHT;const speed=sneaking?2.1:rushing?7.4:4.6,ix=(keys.KeyD?1:0)-(keys.KeyA?1:0),iz=(keys.KeyW?1:0)-(keys.KeyS?1:0),len=Math.hypot(ix,iz)||1,f=new THREE.Vector3(),r=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();r.set(-f.z,0,f.x);moveAxis("x",(r.x*ix/len+f.x*iz/len)*speed*dt);moveAxis("z",(r.z*ix/len+f.z*iz/len)*speed*dt);velocity.y-=20*dt;moveVertical(velocity.y*dt);if(camera.position.y<-20)respawn();updateChunks()}
function target(){raycaster.setFromCamera(center,camera);raycaster.far=REACH;const meshes=[];for(const c of chunks.values())meshes.push(...c.group.children);const hit=raycaster.intersectObjects(meshes,false)[0];if(!hit)return null;const block=hit.object.userData.blocks?.[hit.instanceId];return block?{hit,block}:null}
function notify(t){q("#notification").textContent=t;q("#notification").classList.add("visible");clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>q("#notification").classList.remove("visible"),1500)}
function breakBlock(){if(paused)return;const t=target();if(!t)return;const type=blockByKey(t.block.type);if(type.unbreakable)return notify("Bedrock cannot be broken");const item=drop[t.block.type];if(gameMode==="survival"&&item)addItem(item,1);const k=posKey(t.block.x,t.block.y,t.block.z);edits.delete(k);removed.add(k);reload(t.block.x,t.block.z);notify(item?`Collected ${itemByKey(item).name}`:`Broke ${type.name}`)}
function placeBlock(){if(paused)return;const t=target();if(!t||!t.hit.face)return;const n=t.hit.face.normal,x=t.block.x+Math.round(n.x),y=t.block.y+Math.round(n.y),z=t.block.z+Math.round(n.z),k=posKey(x,y,z),item=hotbar[selectedSlot],type=blockByKey(item);if(!item)return notify("This slot is empty");if(!type)return notify("This item cannot be placed");if(worldBlock(x,y,z))return;if(gameMode==="survival"&&count(item)<=0)return notify("No blocks available");edits.set(k,item);removed.delete(k);reload(x,z);if(collides(camera.position.x,camera.position.y,camera.position.z)){edits.delete(k);removed.add(k);reload(x,z);return notify("Cannot place a block here")}removeItem(item,1);notify(`Placed ${type.name}`)}
function jump(){if(canJump&&!paused){velocity.y=7.2;canJump=false}}
function respawn(){const y=height(0,0);camera.position.set(0,y+EYE+2,0);camera.rotation.set(0,0,0);velocity.set(0,0,0);updateChunks(true)}

function saveWorld(){localStorage.setItem(SAVE_KEY,JSON.stringify({seed,worldTime,gameMode,player:[camera.position.x,camera.position.y,camera.position.z,camera.rotation.x,camera.rotation.y],edits:[...edits],removed:[...removed],inventory:[...inventory],hotbar:[...hotbar],selectedSlot}));notify("World saved")}
function loadWorld(){const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;try{const d=JSON.parse(raw);seed=d.seed;worldTime=d.worldTime??.25;gameMode=d.gameMode??"survival";edits.clear();removed.clear();inventory.clear();for(const x of d.edits??[])edits.set(...x);for(const x of d.removed??[])removed.add(x);for(const x of d.inventory??[])inventory.set(...x);for(let i=0;i<9;i++)hotbar[i]=d.hotbar?.[i]??null;selectedSlot=d.selectedSlot??0;while(chunks.size){const c=chunks.values().next().value;unload(c.group.userData.cx,c.group.userData.cz)}camera.position.set(...d.player.slice(0,3));camera.rotation.set(d.player[3],d.player[4],0);updateChunks(true);updateHotbar();return true}catch{return false}}
function newWorld(){seed=Math.floor(Math.random()*1e9);worldTime=.25;gameMode="survival";edits.clear();removed.clear();inventory.clear();hotbar.fill(null);selectedSlot=0;localStorage.removeItem(SAVE_KEY);respawn();updateHotbar()}
function start(){started=true;paused=false;q("#start-screen").classList.add("hidden");q("#pause-screen").classList.add("hidden");q("#hud").classList.remove("hidden");updateChunks(true);if(!isTouch)controls.lock()}
q("#play-button").addEventListener("click",start);q("#load-button").addEventListener("click",()=>{if(loadWorld())start();else notify("No saved world found")});q("#resume-button").addEventListener("click",()=>{paused=false;q("#pause-screen").classList.add("hidden");if(!isTouch)controls.lock()});q("#save-button").addEventListener("click",saveWorld);q("#new-world-button").addEventListener("click",()=>{newWorld();paused=false;q("#pause-screen").classList.add("hidden");if(!isTouch)controls.lock()});q("#mobile-pause-button").addEventListener("click",()=>{paused=true;clearKeys();q("#pause-screen").classList.remove("hidden")});
controls.addEventListener("unlock",()=>{if(started&&!isTouch&&!paused&&!inventoryOpen&&!chatOpen){paused=true;q("#pause-screen").classList.remove("hidden")}});

function hold(id,key){const b=q(id),down=e=>{e.preventDefault();keys[key]=true;b.classList.add("active");b.setPointerCapture?.(e.pointerId)},up=e=>{e.preventDefault();keys[key]=false;b.classList.remove("active")};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up)}
hold("#move-forward","KeyW");hold("#move-backward","KeyS");hold("#move-left","KeyA");hold("#move-right","KeyD");hold("#sneak-button","ShiftLeft");hold("#rush-button","KeyR");
q("#jump-button").addEventListener("pointerdown",jump);q("#break-button").addEventListener("pointerdown",breakBlock);q("#place-button").addEventListener("pointerdown",placeBlock);q("#inventory-mobile-button").addEventListener("pointerdown",openInventory);q("#chat-mobile-button").addEventListener("pointerdown",()=>openChat(""));
renderer.domElement.addEventListener("pointerdown",e=>{if(!isTouch||!started||paused)return;touchId=e.pointerId;touchX=e.clientX;touchY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener("pointermove",e=>{if(e.pointerId!==touchId||paused)return;const dx=e.clientX-touchX,dy=e.clientY-touchY;touchX=e.clientX;touchY=e.clientY;camera.rotation.y-=dx*.004;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.004,-Math.PI/2+.05,Math.PI/2-.05)});renderer.domElement.addEventListener("pointerup",e=>{if(e.pointerId===touchId)touchId=null});
document.addEventListener("keydown",e=>{if(chatOpen)return;if(inventoryOpen){if((e.code==="KeyE"||e.code==="Escape")&&!e.repeat)closeInventory();return}if(!started)return;if(e.code==="KeyE"&&!e.repeat)return openInventory();if(e.code==="KeyT"&&!e.repeat)return openChat("");if(e.code==="Slash"&&!e.repeat)return openChat("/");keys[e.code]=true;if(e.code==="Space"&&!e.repeat)jump();if(e.code.startsWith("Digit")){const n=Number(e.code.slice(5));if(n>=1&&n<=9){selectedSlot=n-1;updateHotbar()}}});document.addEventListener("keyup",e=>keys[e.code]=false);document.addEventListener("mousedown",e=>{if(isTouch||!started||paused||!controls.isLocked)return;if(e.button===0)breakBlock();if(e.button===2)placeBlock()});document.addEventListener("contextmenu",e=>e.preventDefault());document.addEventListener("wheel",e=>{if(started&&!paused){selectedSlot=(selectedSlot+Math.sign(e.deltaY)+9)%9;updateHotbar()}},{passive:true});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});addEventListener("beforeunload",()=>{if(started)saveWorld()});
function animate(){requestAnimationFrame(animate);const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;updatePlayer(dt);updateSky(dt);fpsFrames++;fpsTime+=dt;if(fpsTime>.5){q("#fps").textContent=`FPS: ${Math.round(fpsFrames/fpsTime)}`;fpsFrames=fpsTime=0}q("#position").textContent=`XYZ: ${camera.position.x.toFixed(1)} / ${camera.position.y.toFixed(1)} / ${camera.position.z.toFixed(1)} | ${sneaking?"SNEAK":rushing?"RUSH":"WALK"} | ${gameMode.toUpperCase()}`;renderer.render(scene,camera)}

q("#device-message").textContent=isTouch?"Touch controls enabled.":"Keyboard and mouse controls enabled.";
loadProfile();createHotbar();buildInventory();respawn();updateChunks(true);animate();
