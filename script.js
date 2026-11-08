"use strict";
const q=s=>document.querySelector(s),isTouch=matchMedia("(pointer: coarse)").matches||navigator.maxTouchPoints>0;document.body.classList.toggle("touch-device",isTouch);
const PROFILE_KEY="nova-profile-v2",SAVE_KEY="nova-world-v18";const profile={name:"Player",skin:null};const validName=n=>/^[A-Za-z0-9_]{3,16}$/.test(n);
function defaultSkin(){const c=document.createElement("canvas"),x=c.getContext("2d");c.width=c.height=64;x.fillStyle="#0b2115";x.fillRect(0,0,64,64);x.fillStyle="#d6b187";x.fillRect(8,8,8,8);x.fillStyle="#43ef88";x.fillRect(20,20,24,12);x.fillRect(4,20,12,24);x.fillRect(48,20,12,24);x.fillStyle="#0c6b3b";x.fillRect(20,32,10,24);x.fillRect(34,32,10,24);x.fillStyle="#07110c";x.fillRect(10,11,2,2);x.fillRect(14,11,2,2);return c.toDataURL("image/png")}
function loadProfile(){try{Object.assign(profile,JSON.parse(localStorage.getItem(PROFILE_KEY))||{})}catch{}if(!validName(profile.name))profile.name="Player";if(!profile.skin)profile.skin=defaultSkin();localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));updateProfile()}
function drawSkin(canvas,src){const ctx=canvas.getContext("2d"),img=new Image();img.onload=()=>{ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#04130b";ctx.fillRect(0,0,canvas.width,canvas.height);const sx=canvas.width/32,sy=canvas.height/40;ctx.drawImage(img,8,8,8,8,8*sx,0,16*sx,16*sy);ctx.drawImage(img,20,20,8,12,8*sx,16*sy,16*sx,24*sy);ctx.drawImage(img,4,20,4,12,0,16*sy,8*sx,24*sy);ctx.drawImage(img,44,20,4,12,24*sx,16*sy,8*sx,24*sy);ctx.drawImage(img,4,20,4,12,8*sx,40*sy,8*sx,23*sy);ctx.drawImage(img,20,52,4,12,16*sx,40*sy,8*sx,23*sy)};img.src=src}
function updateProfile(){q("#player-name").value=profile.name;q("#pause-player-name").textContent=profile.name;q("#player-label").textContent=profile.name;drawSkin(q("#skin-preview"),profile.skin);drawSkin(q("#pause-skin-preview"),profile.skin)}let pendingSkin=null;
q("#skin-file").addEventListener("change",()=>{const f=q("#skin-file").files[0];if(!f||f.type!=="image/png")return q("#profile-status").textContent="Select a PNG file.";const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{if(i.width!==64||i.height!==64)return q("#profile-status").textContent="Skin must be exactly 64x64 pixels.";pendingSkin=r.result;drawSkin(q("#skin-preview"),pendingSkin);q("#profile-status").textContent="Skin ready. Select SAVE PROFILE."};i.src=r.result};r.readAsDataURL(f)});
q("#save-profile").addEventListener("click",()=>{const n=q("#player-name").value.trim();if(!validName(n))return q("#profile-status").textContent="Use 3-16 letters, numbers, or underscore.";profile.name=n;if(pendingSkin)profile.skin=pendingSkin;localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));updateProfile();q("#profile-status").textContent="Profile saved."});
let progress=0;const loadMessages=["Starting renderer...","Creating textures...","Preparing biomes...","Loading mobs...","Ready."];const loadTimer=setInterval(()=>{progress=Math.min(100,progress+(progress<70?7:3));q("#progress-bar").style.width=progress+"%";q("#progress-percent").textContent=progress+"%";q("#loading-status").textContent=loadMessages[Math.min(4,Math.floor(progress/24))];if(progress>=100){clearInterval(loadTimer);loadProfile();setTimeout(()=>{q("#loading-screen").classList.add("loading-done");q("#start-screen").classList.remove("hidden")},220)}},75);

const scene=new THREE.Scene();scene.background=new THREE.Color(0x88c9ef);scene.fog=new THREE.Fog(0xa8d6ed,38,135);const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,240);camera.rotation.order="YXZ";const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance"});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.15:1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;q("#game-container").appendChild(renderer.domElement);const controls=new THREE.PointerLockControls(camera,document.body);
const CHUNK=16,RENDER_DISTANCE=isTouch?1:2,SEA=8,REACH=6,EYE=1.62,SNEAK_EYE=1.32,RADIUS=.3,HEIGHT=1.75,SNEAK_HEIGHT=1.45;const blockGeometry=new THREE.BoxGeometry(1,1,1),raycaster=new THREE.Raycaster(),center=new THREE.Vector2(),velocity=new THREE.Vector3(),keys={};const chunks=new Map(),lookup=new Map(),edits=new Map(),removed=new Set(),inventory=new Map(),hotbar=new Array(9).fill(null),materials={},mobs=[];let seed=Math.floor(Math.random()*1e9),selectedSlot=0,gameMode="survival",started=false,paused=false,inventoryOpen=false,chatOpen=false,canJump=false,sneaking=false,rushing=false,eyeHeight=EYE,playerHeight=HEIGHT,lastCX=NaN,lastCZ=NaN,lastTime=performance.now(),worldTime=.25,fpsFrames=0,fpsTime=0,noticeTimer=null,touchId=null,touchX=0,touchY=0,inventoryTab="all";
const B=(key,name,colors,category="blocks",o={})=>({key,name,colors,category,placeable:true,...o});
const blockTypes=[B("grass","Grass Block",["#559b42","#79bd59","#3e7d34"],"nature"),B("dirt","Dirt",["#765039","#936746","#5f3e2d"],"nature"),B("stone","Stone",["#777","#999","#555"]),B("cobblestone","Cobblestone",["#666","#888","#444"]),B("sand","Sand",["#d8c37f","#ead99a","#baa663"],"nature"),B("red_sand","Red Sand",["#b65c32","#d97a43","#873d25"],"nature"),B("gravel","Gravel",["#74716d","#928c84","#55524f"],"nature"),B("clay","Clay",["#8e9ba7","#aebbc5","#6e7d89"],"nature"),B("snow","Snow Block",["#e8f4f6","#fff","#c7dfe5"],"nature"),B("ice","Ice",["#78bfe7","#bcecff","#4b9ed1"],"nature",{transparent:true,opacity:.72}),B("water","Water",["#287dd8","#48a6ee","#1657a1"],"nature",{transparent:true,opacity:.55}),B("wood","Oak Log",["#76502d","#9a7041","#55371f"],"nature"),B("planks","Oak Planks",["#b0834f","#cf9e60","#896136"]),B("birch_log","Birch Log",["#d6d0b8","#eee8cf","#605b50"],"nature"),B("birch_planks","Birch Planks",["#d8c78e","#f0dfa9","#b09d69"]),B("spruce_log","Spruce Log",["#4e351f","#6d4b2d","#302014"],"nature"),B("spruce_planks","Spruce Planks",["#74502e","#91663c","#55381f"]),B("leaves","Oak Leaves",["#32703a","#478d4a","#24572f"],"nature",{transparent:true}),B("glass","Glass",["#b5e8ec","#d8f7f8","#84cbd2"],"blocks",{transparent:true,opacity:.5}),B("bricks","Bricks",["#8c4638","#ad5e4c","#6c332d"]),B("stone_bricks","Stone Bricks",["#73777a","#969b9e","#55595c"]),B("mossy_stone_bricks","Mossy Stone Bricks",["#667260","#87927b","#465340"]),B("sandstone","Sandstone",["#d9bd79","#efd99a","#b59658"]),B("deepslate","Deepslate",["#3f4548","#596064","#292e31"]),B("obsidian","Obsidian",["#20152f","#3a2854","#0d0914"]),B("coal_ore","Coal Ore",["#737373","#252525","#555"],"nature"),B("iron_ore","Iron Ore",["#777","#b68b68","#d2a27b"],"nature"),B("copper_ore","Copper Ore",["#747575","#b76f4d","#d38a62"],"nature"),B("gold_ore","Gold Ore",["#777","#e2b92e","#f4d54d"],"nature"),B("lapis_ore","Lapis Ore",["#6e7478","#2851a3","#17326d"],"nature"),B("redstone_ore","Redstone Ore",["#747474","#b82626","#671313"],"nature"),B("diamond_ore","Diamond Ore",["#737373","#31c6c4","#62efea"],"nature"),B("emerald_block","Emerald Block",["#139f55","#3fe987","#087139"]),B("crafting_table","Crafting Table",["#8b592f","#bd7b43","#50321f"]),B("furnace","Furnace",["#686868","#898989","#333"]),B("chest","Chest",["#9b6428","#c98a3d","#5d3919"]),B("bookshelf","Bookshelf",["#7c4c28","#c04444","#315ca8"]),B("tnt","TNT",["#bd2525","#f03e3e","#f2e8cf"]),B("bedrock","Bedrock",["#303030","#555","#171717"],"nature",{placeable:false,unbreakable:true})];
const I=(key,name,colors,shape="material")=>({key,name,colors,category:shape==="tool"?"tools":"items",shape,placeable:false});const itemTypes=[...blockTypes.filter(b=>!b.unbreakable),I("coal","Coal",["#181818","#343434","#080808"]),I("raw_iron","Raw Iron",["#b88768","#d7a481","#805e4a"]),I("copper_ingot","Copper Ingot",["#b76743","#e29a70","#81452f"]),I("raw_gold","Raw Gold",["#d49f23","#f1cd4b","#9a6a12"]),I("diamond","Diamond",["#2db7ba","#61f4ef","#187f82"],"gem"),I("emerald","Emerald",["#0c9c50","#47ef91","#086632"],"gem"),I("lapis_lazuli","Lapis Lazuli",["#224aa0","#4474d6","#10275d"],"gem"),I("redstone_dust","Redstone Dust",["#9e1111","#e12d2d","#5b0808"]),I("stick","Stick",["#75502d","#a67843","#4c321c"]),I("apple","Apple",["#a51d28","#e23e45","#5e1018"],"food"),I("bread","Bread",["#b97725","#e0a44b","#805018"],"food"),...["wooden","stone","iron","diamond"].flatMap((t,i)=>{const c=[["#75502d","#aa7844","#3d2918"],["#666","#999","#3d3d3d"],["#c7c5bd","#eee","#777"],["#22adaf","#61efeb","#12696b"]][i],n=t[0].toUpperCase()+t.slice(1);return[I(t+"_pickaxe",n+" Pickaxe",c,"tool"),I(t+"_sword",n+" Sword",c,"tool")]})];const drop={grass:"dirt",dirt:"dirt",stone:"cobblestone",cobblestone:"cobblestone",sand:"sand",red_sand:"red_sand",gravel:"gravel",clay:"clay",snow:"snow",ice:null,water:null,wood:"wood",planks:"planks",birch_log:"birch_log",birch_planks:"birch_planks",spruce_log:"spruce_log",spruce_planks:"spruce_planks",leaves:"leaves",glass:null,bricks:"bricks",stone_bricks:"stone_bricks",mossy_stone_bricks:"mossy_stone_bricks",sandstone:"sandstone",deepslate:"deepslate",obsidian:"obsidian",coal_ore:"coal",iron_ore:"raw_iron",copper_ore:"copper_ingot",gold_ore:"raw_gold",lapis_ore:"lapis_lazuli",redstone_ore:"redstone_dust",diamond_ore:"diamond",emerald_block:"emerald",crafting_table:"crafting_table",furnace:"furnace",chest:"chest",bookshelf:"bookshelf",tnt:"tnt"};const blockByKey=k=>blockTypes.find(x=>x.key===k),itemByKey=k=>itemTypes.find(x=>x.key===k);
function noise(x,z,o=0){const v=Math.sin(x*127.1+z*311.7+(seed+o)*.000731)*43758.5453123;return v-Math.floor(v)}function noise3(x,y,z,o=0){return noise(x+y*17.13,z-y*9.71,o)}function smooth(x,z,s,o){const X=x/s,Z=z/s,x0=Math.floor(X),z0=Math.floor(Z),fx=X-x0,fz=Z-z0,ax=fx*fx*(3-2*fx),az=fz*fz*(3-2*fz);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(noise(x0,z0,o),noise(x0+1,z0,o),ax),THREE.MathUtils.lerp(noise(x0,z0+1,o),noise(x0+1,z0+1,o),ax),az)}
function biome(x,z){const continental=smooth(x,z,140,1),temp=smooth(x,z,110,2),moist=smooth(x,z,95,3),river=Math.abs(smooth(x,z,55,4)-.5);if(continental<.28)return"Ocean";if(river<.035&&continental<.7)return"River";if(temp>.68&&moist<.42)return"Desert";if(continental>.78)return temp<.42?"Snowy Mountains":"Mountains";if(moist>.6)return"Forest";return"Plains"}
function heightAt(x,z){const b=biome(x,z),base=7+smooth(x,z,90,10)*6,detail=smooth(x,z,22,11)*3;if(b==="Ocean")return Math.floor(2+smooth(x,z,35,12)*3);if(b==="River")return SEA-2;if(b==="Desert")return Math.floor(8+smooth(x,z,48,13)*4);if(b.includes("Mountains"))return Math.floor(14+Math.pow(smooth(x,z,36,14),2)*24+detail);return Math.floor(base+detail)}
const posKey=(x,y,z)=>x+","+y+","+z,chunkKey=(x,z)=>x+","+z,toChunk=v=>Math.floor(v/CHUNK);
function generated(x,y,z){const h=heightAt(x,z),b=biome(x,z);if(y<0||y>Math.max(h,SEA))return null;if(y>h&&y<=SEA&&(b==="Ocean"||b==="River"))return"water";if(y===0)return"bedrock";if(y<h-5&&y>2&&noise3(x,y,z,500)>.93)return null;if(y===h){if(b==="Desert"||b==="Ocean"||b==="River")return"sand";if(b==="Snowy Mountains")return"snow";return"grass"}if(y>=h-3)return b==="Desert"?"sand":"dirt";const n=noise3(x,y,z,700);if(y<7&&n>.988)return"diamond_ore";if(y<9&&n>.98)return"redstone_ore";if(y<12&&n>.972)return"gold_ore";if(y<15&&n>.965)return"lapis_ore";if(y<18&&n>.95)return"iron_ore";if(n>.94)return"copper_ore";if(n>.91)return"coal_ore";return y<7?"deepslate":"stone"}
function worldBlock(x,y,z){const k=posKey(x,y,z);if(removed.has(k))return null;if(edits.has(k))return edits.get(k);if(lookup.has(k))return lookup.get(k);return generated(x,y,z)}
function texture(t){const c=document.createElement("canvas"),x=c.getContext("2d");c.width=c.height=16;x.fillStyle=t.colors[0];x.fillRect(0,0,16,16);for(let y=0;y<16;y++)for(let i=0;i<16;i++){const n=noise(i,y,t.colors.length*131);x.fillStyle=t.colors[Math.floor(n*t.colors.length)%t.colors.length];if(n>.42)x.fillRect(i,y,1,1)}const tex=new THREE.CanvasTexture(c);tex.magFilter=tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.colorSpace=THREE.SRGBColorSpace;return tex}for(const t of blockTypes)materials[t.key]=new THREE.MeshLambertMaterial({map:texture(t),transparent:!!t.transparent,opacity:t.opacity??1,alphaTest:t.key==="leaves"?.15:0,depthWrite:t.key!=="glass"&&t.key!=="ice"&&t.key!=="water"});
function addBlock(list,x,y,z,type){const k=posKey(x,y,z);if(!removed.has(k))list.push({x,y,z,type:edits.get(k)??type})}function addTree(x,y,z,list,type="wood"){const h=4+Math.floor(noise(x,z,900)*3),leaf="leaves";for(let i=1;i<=h;i++)addBlock(list,x,y+i,z,type);for(let ox=-2;ox<=2;ox++)for(let oy=-2;oy<=2;oy++)for(let oz=-2;oz<=2;oz++)if(Math.abs(ox)+Math.abs(oy)+Math.abs(oz)<=4&&noise(x+ox,z+oz,oy+300)>.12)addBlock(list,x+ox,y+h+oy,z+oz,leaf)}
function addVillage(cx,cz,list){if(cx!==1||cz!==1)return;const ox=20,oz=20,ground=heightAt(ox,oz);for(let x=ox-8;x<=ox+10;x++)for(let z=oz-2;z<=oz+2;z++)addBlock(list,x,ground,z,"gravel");for(const [hx,hz]of[[ox-6,oz+5],[ox+5,oz+6],[ox+3,oz-7]]){const y=heightAt(hx,hz);for(let x=hx-3;x<=hx+3;x++)for(let z=hz-3;z<=hz+3;z++)for(let yy=y+1;yy<=y+4;yy++){const edge=x===hx-3||x===hx+3||z===hz-3||z===hz+3;if(edge)addBlock(list,x,yy,z,yy===y+4?"planks":"cobblestone")}for(let x=hx-4;x<=hx+4;x++)for(let z=hz-4;z<=hz+4;z++)addBlock(list,x,y+5,z,"planks");for(let yy=y+1;yy<=y+2;yy++)addBlock(list,hx,yy,hz-3,"air")}}
function generateChunk(cx,cz){const list=[],sx=cx*CHUNK,sz=cz*CHUNK;for(let lx=0;lx<CHUNK;lx++)for(let lz=0;lz<CHUNK;lz++){const x=sx+lx,z=sz+lz,h=heightAt(x,z),top=Math.max(h,SEA);for(let y=0;y<=top;y++){const type=generated(x,y,z);if(type)addBlock(list,x,y,z,type)}const b=biome(x,z);if(noise(x,z,850)>.986&&h>SEA&&(b==="Forest"||b==="Plains")&&lx>2&&lx<13&&lz>2&&lz<13)addTree(x,h,z,list,b==="Forest"&&noise(x,z,851)>.5?"spruce_log":"wood")}addVillage(cx,cz,list);for(const[k,type]of edits){const[x,y,z]=k.split(",").map(Number);if(toChunk(x)===cx&&toChunk(z)===cz&&!list.some(b=>b.x===x&&b.y===y&&b.z===z))list.push({x,y,z,type})}return list.filter(b=>b.type!=="air"&&!removed.has(posKey(b.x,b.y,b.z)))}
function createChunk(cx,cz){const key=chunkKey(cx,cz);if(chunks.has(key))return;const list=generateChunk(cx,cz),group=new THREE.Group(),grouped={};group.userData.cx=cx;group.userData.cz=cz;for(const b of list){(grouped[b.type]??=[]).push(b);lookup.set(posKey(b.x,b.y,b.z),b.type)}const matrix=new THREE.Matrix4();for(const[type,arr]of Object.entries(grouped)){if(!materials[type])continue;const mesh=new THREE.InstancedMesh(blockGeometry,materials[type],arr.length);mesh.userData.blocks=arr;arr.forEach((b,i)=>{matrix.makeTranslation(b.x,b.y,b.z);mesh.setMatrixAt(i,matrix)});mesh.instanceMatrix.needsUpdate=true;group.add(mesh)}scene.add(group);chunks.set(key,{group,blocks:list})}
function unload(cx,cz){const k=chunkKey(cx,cz),c=chunks.get(k);if(!c)return;for(const b of c.blocks)lookup.delete(posKey(b.x,b.y,b.z));scene.remove(c.group);chunks.delete(k)}function reload(x,z){const cx=toChunk(x),cz=toChunk(z);unload(cx,cz);createChunk(cx,cz)}function updateChunks(force=false){const cx=toChunk(camera.position.x),cz=toChunk(camera.position.z);if(!force&&cx===lastCX&&cz===lastCZ)return;lastCX=cx;lastCZ=cz;const needed=new Set();for(let x=-RENDER_DISTANCE;x<=RENDER_DISTANCE;x++)for(let z=-RENDER_DISTANCE;z<=RENDER_DISTANCE;z++){needed.add(chunkKey(cx+x,cz+z));createChunk(cx+x,cz+z)}for(const[k,c]of[...chunks])if(!needed.has(k))unload(c.group.userData.cx,c.group.userData.cz);updateMobPopulation()}
scene.add(new THREE.HemisphereLight(0xe4f6ff,0x46613d,1.45));const sunLight=new THREE.DirectionalLight(0xfff2ce,1.6);scene.add(sunLight);const sky=new THREE.Mesh(new THREE.SphereGeometry(220,24,16),new THREE.MeshBasicMaterial({color:0x88c9ef,side:THREE.BackSide,fog:false}));scene.add(sky);const sun=new THREE.Mesh(new THREE.PlaneGeometry(15,15),new THREE.MeshBasicMaterial({color:0xffef9e,side:THREE.DoubleSide,fog:false}));scene.add(sun);const clouds=[];for(let i=0;i<(isTouch?7:12);i++){const g=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.88,depthWrite:false});for(const p of[[0,0,8,3],[5,0,5,4],[-5,1,5,3],[1,3,6,3]]){const m=new THREE.Mesh(new THREE.BoxGeometry(p[2],.8,p[3]),mat);m.position.set(p[0],0,p[1]);g.add(m)}g.position.set((i%4)*58-87,46+(i%3)*3,Math.floor(i/4)*58-85);g.userData.speed=1.1+(i%3)*.18;scene.add(g);clouds.push(g)}function updateSky(dt){worldTime=(worldTime+dt*.0025)%1;const a=worldTime*Math.PI*2,d=THREE.MathUtils.clamp(Math.sin(a)*.7+.4,.08,1);sun.position.set(camera.position.x+Math.cos(a)*150,Math.sin(a)*150,camera.position.z-110);sun.lookAt(camera.position);sunLight.position.copy(sun.position);const color=new THREE.Color(d>.45?0x88c9ef:0x1b2845);scene.background.copy(color);scene.fog.color.copy(color);sunLight.intensity=.1+d*1.5;for(const c of clouds){c.position.x+=c.userData.speed*dt;if(c.position.x>camera.position.x+150)c.position.x=camera.position.x-150}}
function createMob(type,x,z){const g=new THREE.Group(),palette={Cow:[0x5b3825,0xeee4d2],Pig:[0xe89a9f,0xf3b8ba],Sheep:[0xeeeeee,0x777777],Chicken:[0xffffff,0xf1c232],Villager:[0x70482e,0x9b693e],Zombie:[0x4c8b57,0x406070]}[type],mat1=new THREE.MeshLambertMaterial({color:palette[0]}),mat2=new THREE.MeshLambertMaterial({color:palette[1]});const body=new THREE.Mesh(new THREE.BoxGeometry(type==="Chicken"?.7:1.2,type==="Chicken"?.7:1, type==="Chicken"?.8:1.8),mat1),head=new THREE.Mesh(new THREE.BoxGeometry(type==="Chicken"?.55:.8,type==="Chicken"?.55:.8,type==="Chicken"?.55:.8),mat2);body.position.y=1;head.position.set(0,1.65,type==="Chicken"?-.45:-1.15);g.add(body,head);for(const sx of[-.4,.4])for(const sz of[-.55,.55]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.22,.8,.22),mat1);leg.position.set(sx,.4,sz);g.add(leg)}g.position.set(x,heightAt(x,z)+.5,z);g.userData={type,angle:noise(x,z,902)*Math.PI*2,speed:type==="Zombie"?.8:.45,timer:1+noise(x,z,903)*3};scene.add(g);mobs.push(g)}
function updateMobPopulation(){const max=isTouch?10:18;while(mobs.length<max){const a=noise(mobs.length,seed,904)*Math.PI*2,d=12+noise(mobs.length,seed,905)*35,x=Math.floor(camera.position.x+Math.cos(a)*d),z=Math.floor(camera.position.z+Math.sin(a)*d),b=biome(x,z);if(b==="Ocean"||b==="River")continue;const types=b==="Desert"?["Villager","Zombie"]:["Cow","Pig","Sheep","Chicken","Villager","Zombie"];createMob(types[Math.floor(noise(x,z,906)*types.length)],x,z)}}function updateMobs(dt){for(let i=mobs.length-1;i>=0;i--){const m=mobs[i];m.userData.timer-=dt;if(m.userData.timer<=0){m.userData.angle+= (noise(m.position.x,m.position.z,907)-.5)*2;m.userData.timer=2+noise(m.position.z,m.position.x,908)*4}const nx=m.position.x+Math.cos(m.userData.angle)*m.userData.speed*dt,nz=m.position.z+Math.sin(m.userData.angle)*m.userData.speed*dt,h=heightAt(nx,nz);if(biome(nx,nz)!=="Ocean"&&Math.abs(h-(m.position.y-.5))<=1.5){m.position.x=nx;m.position.z=nz;m.position.y=h+.5;m.rotation.y=-m.userData.angle+Math.PI/2}m.children.slice(2).forEach((leg,j)=>leg.rotation.x=Math.sin(performance.now()*.006+j*Math.PI)*.45);if(m.position.distanceTo(camera.position)>90){scene.remove(m);mobs.splice(i,1)}}}
function iconHTML(t){if(t.placeable){const c=t.colors;return`<span class="voxel-icon"><i class="top" style="background:${c[1]}"></i><i class="left" style="background:${c[0]}"></i><i class="right" style="background:${c[2]}"></i></span>`}const shape=t.shape||"material",c=t.colors;return`<span class="item-shape ${shape}" style="--c1:${c[0]};--c2:${c[1]};--c3:${c[2]}"></span>`}
function createHotbar(){const bar=q("#hotbar");bar.innerHTML="";for(let i=0;i<9;i++){const s=document.createElement("button");s.className="hotbar-slot";s.innerHTML=`<span class="slot-number">${i+1}</span><span class="slot-icon"></span><span class="slot-count"></span>`;s.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();selectedSlot=i;updateHotbar()});bar.appendChild(s)}updateHotbar()}const count=k=>inventory.get(k)??0;function addItem(k,n=1){inventory.set(k,count(k)+n);if(!hotbar.includes(k)){const i=hotbar.indexOf(null);if(i>=0)hotbar[i]=k}updateHotbar();buildInventory()}function removeItem(k,n=1){if(gameMode==="creative")return true;if(count(k)<n)return false;if(count(k)===n){inventory.delete(k);hotbar.forEach((v,i)=>{if(v===k)hotbar[i]=null})}else inventory.set(k,count(k)-n);updateHotbar();buildInventory();return true}
function updateHotbar(){q("#hotbar").querySelectorAll(".hotbar-slot").forEach((s,i)=>{const k=hotbar[i],icon=s.querySelector(".slot-icon"),num=s.querySelector(".slot-count");s.classList.toggle("selected",i===selectedSlot);if(!k){icon.innerHTML="";num.textContent="";return}const t=itemByKey(k);icon.innerHTML=iconHTML(t);icon.querySelector(".voxel-icon,.item-shape")?.style.setProperty("transform","scale(.62)");num.textContent=gameMode==="creative"?"":count(k)});q("#selected-name").textContent=hotbar[selectedSlot]?itemByKey(hotbar[selectedSlot]).name:"Empty Slot"}
function buildInventory(){const search=q("#inventory-search").value.trim().toLowerCase(),grid=q("#inventory-grid");grid.innerHTML="";q("#inventory-mode").textContent=gameMode.toUpperCase();let list=gameMode==="creative"?itemTypes:[...inventory].filter(([,n])=>n>0).map(([k])=>itemByKey(k)).filter(Boolean);list=list.filter(t=>(inventoryTab==="all"||t.category===inventoryTab)&&(t.name.toLowerCase().includes(search)||t.key.includes(search)));q("#inventory-empty").style.display=list.length?"none":"block";for(const t of list){const b=document.createElement("button");b.className="inventory-item";b.innerHTML=`${iconHTML(t)}<span class="inventory-item-name">${t.name}</span>${gameMode==="survival"?`<span class="inventory-count">${count(t.key)}</span>`:""}`;b.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();let slot=gameMode==="creative"?selectedSlot:hotbar.indexOf(t.key);if(slot<0)slot=hotbar.indexOf(null);if(slot<0)slot=selectedSlot;hotbar[slot]=t.key;selectedSlot=slot;updateHotbar()});grid.appendChild(b)}}
q("#inventory-search").addEventListener("input",buildInventory);q("#inventory-tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;inventoryTab=b.dataset.tab;q("#inventory-tabs").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));buildInventory()});function clearKeys(){Object.keys(keys).forEach(k=>keys[k]=false);document.querySelectorAll("#mobile-controls .active").forEach(b=>b.classList.remove("active"))}function openInventory(){if(!started||chatOpen)return;inventoryOpen=paused=true;clearKeys();buildInventory();q("#inventory-screen").classList.remove("hidden");if(controls.isLocked)controls.unlock()}function closeInventory(){inventoryOpen=paused=false;q("#inventory-screen").classList.add("hidden");if(!isTouch&&started)controls.lock()}q("#inventory-close").addEventListener("click",closeInventory);
function chatMessage(text,color="#fff"){const l=document.createElement("div");l.textContent=text;l.style.color=color;q("#chat-history").appendChild(l)}function openChat(text=""){if(!started||inventoryOpen)return;chatOpen=paused=true;clearKeys();q("#chat-screen").classList.remove("hidden");if(controls.isLocked)controls.unlock();q("#chat-input").value=text;setTimeout(()=>q("#chat-input").focus(),20)}function closeChat(){chatOpen=paused=false;q("#chat-screen").classList.add("hidden");q("#chat-input").blur();if(!isTouch&&started)controls.lock()}function command(text){const p=text.slice(1).trim().split(/\s+/),c=p[0]?.toLowerCase();if(c==="gamemode"){if(!["survival","creative"].includes(p[1]))return chatMessage("Usage: /gamemode survival|creative","#ff8585");gameMode=p[1];hotbar.fill(null);selectedSlot=0;updateHotbar();buildInventory();chatMessage(`Game mode set to ${gameMode}. Hotbar cleared.`,"#a5ffbd")}else if(c==="give"){const t=itemByKey(p[1]),n=Math.max(1,Math.min(999,Number(p[2])||1));if(!t)return chatMessage("Unknown item.","#ff8585");addItem(t.key,n)}else if(c==="seed")chatMessage(`Seed: ${seed}`,"#a5ffbd");else if(c==="spawn")respawn();else if(c==="save")saveWorld();else chatMessage("Unknown command.","#ff8585")}q("#chat-input").addEventListener("keydown",e=>{e.stopPropagation();if(e.code==="Enter"){const t=e.target.value.trim();if(t){chatMessage(t.startsWith("/")?t:`<${profile.name}> ${t}`);if(t.startsWith("/"))command(t)}closeChat()}else if(e.code==="Escape")closeChat()});
function bounds(x,y,z){const feet=y-eyeHeight;return{minX:x-RADIUS,maxX:x+RADIUS,minY:feet,maxY:feet+playerHeight,minZ:z-RADIUS,maxZ:z+RADIUS}}function solid(type){return type&&type!=="water"}function collides(x,y,z){const b=bounds(x,y,z);for(let bx=Math.floor(b.minX-.5);bx<=Math.floor(b.maxX+.5);bx++)for(let by=Math.floor(b.minY-.5);by<=Math.floor(b.maxY+.5);by++)for(let bz=Math.floor(b.minZ-.5);bz<=Math.floor(b.maxZ+.5);bz++){const t=worldBlock(bx,by,bz);if(solid(t)&&b.maxX>bx-.5&&b.minX<bx+.5&&b.maxY>by-.5&&b.minY<by+.5&&b.maxZ>bz-.5&&b.minZ<bz+.5)return true}return false}function supported(x,z){const y=camera.position.y-eyeHeight-.12,r=.2;return[[0,0],[-r,-r],[r,-r],[-r,r],[r,r]].some(([ox,oz])=>solid(worldBlock(Math.floor(x+ox+.5),Math.floor(y),Math.floor(z+oz+.5))))}function moveAxis(axis,d){const n=Math.max(1,Math.ceil(Math.abs(d)/.05)),step=d/n;for(let i=0;i<n;i++){const x=axis==="x"?camera.position.x+step:camera.position.x,z=axis==="z"?camera.position.z+step:camera.position.z;if(collides(x,camera.position.y,z))return;if(sneaking&&canJump&&velocity.y<=0&&!supported(x,z))return;camera.position[axis]+=step}}function moveVertical(d){const n=Math.max(1,Math.ceil(Math.abs(d)/.05)),step=d/n;for(let i=0;i<n;i++){const y=camera.position.y+step;if(collides(camera.position.x,y,camera.position.z)){if(velocity.y<=0)canJump=true;velocity.y=0;return}camera.position.y=y;canJump=false}}function updatePlayer(dt){if(!started||paused||(!isTouch&&!controls.isLocked))return;sneaking=!!(keys.ShiftLeft||keys.ShiftRight);rushing=!!keys.KeyR;const target=sneaking?SNEAK_EYE:EYE,old=eyeHeight;eyeHeight=THREE.MathUtils.lerp(eyeHeight,target,.24);camera.position.y+=eyeHeight-old;playerHeight=sneaking?SNEAK_HEIGHT:HEIGHT;const speed=sneaking?2.1:rushing?7.4:4.6,ix=(keys.KeyD?1:0)-(keys.KeyA?1:0),iz=(keys.KeyW?1:0)-(keys.KeyS?1:0),len=Math.hypot(ix,iz)||1,f=new THREE.Vector3(),r=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();r.set(-f.z,0,f.x);moveAxis("x",(r.x*ix/len+f.x*iz/len)*speed*dt);moveAxis("z",(r.z*ix/len+f.z*iz/len)*speed*dt);velocity.y-=20*dt;moveVertical(velocity.y*dt);if(camera.position.y<-20)respawn();updateChunks()}
function target(){raycaster.setFromCamera(center,camera);raycaster.far=REACH;const meshes=[];for(const c of chunks.values())meshes.push(...c.group.children);const hit=raycaster.intersectObjects(meshes,false)[0];if(!hit)return null;const block=hit.object.userData.blocks?.[hit.instanceId];return block?{hit,block}:null}function notify(t){q("#notification").textContent=t;q("#notification").classList.add("visible");clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>q("#notification").classList.remove("visible"),1500)}function breakBlock(){if(paused)return;const t=target();if(!t)return;const type=blockByKey(t.block.type);if(type.unbreakable)return notify("Bedrock cannot be broken");const item=drop[t.block.type];if(gameMode==="survival"&&item)addItem(item,1);const k=posKey(t.block.x,t.block.y,t.block.z);edits.delete(k);removed.add(k);reload(t.block.x,t.block.z);notify(item?`Collected ${itemByKey(item).name}`:`Broke ${type.name}`)}function placeBlock(){if(paused)return;const t=target();if(!t||!t.hit.face)return;const n=t.hit.face.normal,x=t.block.x+Math.round(n.x),y=t.block.y+Math.round(n.y),z=t.block.z+Math.round(n.z),k=posKey(x,y,z),item=hotbar[selectedSlot],type=blockByKey(item);if(!item)return notify("This slot is empty");if(!type)return notify("This item cannot be placed");if(worldBlock(x,y,z))return;if(gameMode==="survival"&&count(item)<=0)return notify("No blocks available");edits.set(k,item);removed.delete(k);reload(x,z);if(collides(camera.position.x,camera.position.y,camera.position.z)){edits.delete(k);removed.add(k);reload(x,z);return notify("Cannot place a block here")}removeItem(item,1)}function jump(){if(canJump&&!paused){velocity.y=7.2;canJump=false}}function respawn(){const x=0,z=0,y=heightAt(x,z);camera.position.set(x,y+EYE+2,z);camera.rotation.set(0,0,0);velocity.set(0,0,0);updateChunks(true)}
function saveWorld(){localStorage.setItem(SAVE_KEY,JSON.stringify({seed,worldTime,gameMode,player:[camera.position.x,camera.position.y,camera.position.z,camera.rotation.x,camera.rotation.y],edits:[...edits],removed:[...removed],inventory:[...inventory],hotbar:[...hotbar],selectedSlot}));notify("World saved")}function loadWorld(){const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;try{const d=JSON.parse(raw);seed=d.seed;worldTime=d.worldTime??.25;gameMode=d.gameMode??"survival";edits.clear();removed.clear();inventory.clear();for(const x of d.edits??[])edits.set(...x);for(const x of d.removed??[])removed.add(x);for(const x of d.inventory??[])inventory.set(...x);for(let i=0;i<9;i++)hotbar[i]=d.hotbar?.[i]??null;selectedSlot=d.selectedSlot??0;for(const c of[...chunks.values()])unload(c.group.userData.cx,c.group.userData.cz);camera.position.set(...d.player.slice(0,3));camera.rotation.set(d.player[3],d.player[4],0);updateChunks(true);updateHotbar();return true}catch{return false}}function newWorld(){seed=Math.floor(Math.random()*1e9);worldTime=.25;gameMode="survival";edits.clear();removed.clear();inventory.clear();hotbar.fill(null);selectedSlot=0;localStorage.removeItem(SAVE_KEY);for(const c of[...chunks.values()])unload(c.group.userData.cx,c.group.userData.cz);respawn();updateHotbar()}
function start(){started=true;paused=false;q("#start-screen").classList.add("hidden");q("#pause-screen").classList.add("hidden");q("#hud").classList.remove("hidden");updateChunks(true);if(!isTouch)controls.lock()}q("#play-button").addEventListener("click",()=>{newWorld();start()});q("#load-button").addEventListener("click",()=>{if(loadWorld())start();else notify("No saved world found")});q("#resume-button").addEventListener("click",()=>{paused=false;q("#pause-screen").classList.add("hidden");if(!isTouch)controls.lock()});q("#save-button").addEventListener("click",saveWorld);q("#new-world-button").addEventListener("click",()=>{newWorld();paused=false;q("#pause-screen").classList.add("hidden");if(!isTouch)controls.lock()});q("#menu-mobile").addEventListener("click",()=>{paused=true;clearKeys();q("#pause-screen").classList.remove("hidden")});controls.addEventListener("unlock",()=>{if(started&&!isTouch&&!paused&&!inventoryOpen&&!chatOpen){paused=true;q("#pause-screen").classList.remove("hidden")}});
function hold(id,key){const b=q(id),down=e=>{e.preventDefault();keys[key]=true;b.classList.add("active");b.setPointerCapture?.(e.pointerId)},up=e=>{e.preventDefault();keys[key]=false;b.classList.remove("active")};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up)}hold("#move-forward","KeyW");hold("#move-backward","KeyS");hold("#move-left","KeyA");hold("#move-right","KeyD");hold("#sneak-button","ShiftLeft");hold("#rush-button","KeyR");q("#jump-button").addEventListener("pointerdown",jump);q("#break-button").addEventListener("pointerdown",breakBlock);q("#place-button").addEventListener("pointerdown",placeBlock);q("#inventory-mobile").addEventListener("pointerdown",openInventory);q("#chat-mobile").addEventListener("pointerdown",()=>openChat(""));renderer.domElement.addEventListener("pointerdown",e=>{if(!isTouch||!started||paused)return;touchId=e.pointerId;touchX=e.clientX;touchY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener("pointermove",e=>{if(e.pointerId!==touchId||paused)return;const dx=e.clientX-touchX,dy=e.clientY-touchY;touchX=e.clientX;touchY=e.clientY;camera.rotation.y-=dx*.004;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.004,-Math.PI/2+.05,Math.PI/2-.05)});renderer.domElement.addEventListener("pointerup",e=>{if(e.pointerId===touchId)touchId=null});document.addEventListener("keydown",e=>{if(chatOpen)return;if(inventoryOpen){if((e.code==="KeyE"||e.code==="Escape")&&!e.repeat)closeInventory();return}if(!started)return;if(e.code==="KeyE"&&!e.repeat)return openInventory();if(e.code==="KeyT"&&!e.repeat)return openChat("");if(e.code==="Slash"&&!e.repeat)return openChat("/");keys[e.code]=true;if(e.code==="Space"&&!e.repeat)jump();if(e.code.startsWith("Digit")){const n=Number(e.code.slice(5));if(n>=1&&n<=9){selectedSlot=n-1;updateHotbar()}}});document.addEventListener("keyup",e=>keys[e.code]=false);document.addEventListener("mousedown",e=>{if(isTouch||!started||paused||!controls.isLocked)return;if(e.button===0)breakBlock();if(e.button===2)placeBlock()});document.addEventListener("contextmenu",e=>e.preventDefault());document.addEventListener("wheel",e=>{if(started&&!paused){selectedSlot=(selectedSlot+Math.sign(e.deltaY)+9)%9;updateHotbar()}},{passive:true});addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});addEventListener("beforeunload",()=>{if(started)saveWorld()});
function animate(){requestAnimationFrame(animate);const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;updatePlayer(dt);updateSky(dt);updateMobs(dt);fpsFrames++;fpsTime+=dt;if(fpsTime>.5){q("#fps").textContent=`FPS: ${Math.round(fpsFrames/fpsTime)}`;fpsFrames=fpsTime=0}q("#position").textContent=`XYZ: ${camera.position.x.toFixed(1)} / ${camera.position.y.toFixed(1)} / ${camera.position.z.toFixed(1)} | ${sneaking?"SNEAK":rushing?"RUSH":"WALK"} | ${gameMode.toUpperCase()}`;q("#biome-label").textContent=`Biome: ${biome(camera.position.x,camera.position.z)}`;renderer.render(scene,camera)}
q("#device-message").textContent=isTouch?"Touch controls enabled.":"Keyboard and mouse controls enabled.";loadProfile();createHotbar();buildInventory();respawn();updateChunks(true);animate();


/* Nova Client v19 fixes: detailed mobs, safe mining, and creative flight. */
let creativeFlying = false;
let lastCreativeSpacePress = 0;
let lastBreakAction = 0;

function makeMobPart(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function createMob(type, x, z) {
  const group = new THREE.Group();
  const colors = {
    Cow: [0x5b3825, 0xf0e4d2, 0x27150d],
    Pig: [0xe89a9f, 0xf5b9bd, 0x7a3f49],
    Sheep: [0xf3f3ef, 0x777777, 0x222222],
    Chicken: [0xffffff, 0xf1c232, 0xc9322f],
    Villager: [0x70482e, 0xb18464, 0x4b2d1d],
    Zombie: [0x4c8b57, 0x4a6682, 0x213e29]
  }[type];

  const bodyMaterial = new THREE.MeshLambertMaterial({ color: colors[0] });
  const detailMaterial = new THREE.MeshLambertMaterial({ color: colors[1] });
  const darkMaterial = new THREE.MeshLambertMaterial({ color: colors[2] });
  const blackMaterial = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const whiteMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const redMaterial = new THREE.MeshLambertMaterial({ color: 0xc92f2f });

  const humanoid = type === "Villager" || type === "Zombie";
  const chicken = type === "Chicken";
  const body = makeMobPart(
    humanoid ? 0.8 : chicken ? 0.65 : 1.15,
    humanoid ? 1.15 : chicken ? 0.7 : 0.95,
    humanoid ? 0.45 : chicken ? 0.8 : 1.65,
    bodyMaterial,
    0,
    humanoid ? 1.25 : chicken ? 0.95 : 1.05,
    0
  );
  group.add(body);

  const head = makeMobPart(
    humanoid ? 0.75 : chicken ? 0.55 : 0.82,
    humanoid ? 0.75 : chicken ? 0.55 : 0.72,
    humanoid ? 0.75 : chicken ? 0.55 : 0.72,
    detailMaterial,
    0,
    humanoid ? 2.15 : chicken ? 1.45 : 1.6,
    humanoid ? 0 : chicken ? -0.55 : -1.08
  );
  group.add(head);

  const faceZ = humanoid ? -0.39 : chicken ? -0.84 : -1.47;
  group.add(makeMobPart(0.1, 0.1, 0.04, whiteMaterial, -0.18, humanoid ? 2.25 : chicken ? 1.52 : 1.7, faceZ));
  group.add(makeMobPart(0.1, 0.1, 0.04, whiteMaterial, 0.18, humanoid ? 2.25 : chicken ? 1.52 : 1.7, faceZ));
  group.add(makeMobPart(0.055, 0.055, 0.045, blackMaterial, -0.18, humanoid ? 2.25 : chicken ? 1.52 : 1.7, faceZ - 0.025));
  group.add(makeMobPart(0.055, 0.055, 0.045, blackMaterial, 0.18, humanoid ? 2.25 : chicken ? 1.52 : 1.7, faceZ - 0.025));

  if (type === "Pig") {
    group.add(makeMobPart(0.48, 0.28, 0.25, detailMaterial, 0, 1.47, -1.48));
    group.add(makeMobPart(0.07, 0.08, 0.03, darkMaterial, -0.12, 1.48, -1.62));
    group.add(makeMobPart(0.07, 0.08, 0.03, darkMaterial, 0.12, 1.48, -1.62));
  } else if (type === "Cow") {
    group.add(makeMobPart(0.18, 0.28, 0.18, darkMaterial, -0.5, 1.92, -1.05));
    group.add(makeMobPart(0.18, 0.28, 0.18, darkMaterial, 0.5, 1.92, -1.05));
    group.add(makeMobPart(0.45, 0.28, 0.18, detailMaterial, 0, 1.42, -1.47));
  } else if (type === "Sheep") {
    group.add(makeMobPart(1.28, 1.08, 1.78, bodyMaterial, 0, 1.1, 0));
  } else if (type === "Chicken") {
    group.add(makeMobPart(0.22, 0.16, 0.26, detailMaterial, 0, 1.36, -0.9));
    group.add(makeMobPart(0.14, 0.22, 0.12, redMaterial, 0, 1.2, -0.88));
    group.add(makeMobPart(0.36, 0.52, 0.12, bodyMaterial, -0.43, 1.0, 0));
    group.add(makeMobPart(0.36, 0.52, 0.12, bodyMaterial, 0.43, 1.0, 0));
  } else if (type === "Villager") {
    group.add(makeMobPart(0.18, 0.28, 0.2, detailMaterial, 0, 2.05, -0.48));
    group.add(makeMobPart(0.95, 0.28, 0.28, darkMaterial, 0, 1.35, -0.42));
  } else if (type === "Zombie") {
    group.add(makeMobPart(0.22, 0.95, 0.22, detailMaterial, -0.62, 1.45, -0.2));
    group.add(makeMobPart(0.22, 0.95, 0.22, detailMaterial, 0.62, 1.45, -0.2));
  }

  const legCount = chicken ? 2 : humanoid ? 2 : 4;
  const legs = [];
  for (let index = 0; index < legCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const front = index < 2 ? -1 : 1;
    const leg = makeMobPart(
      chicken ? 0.12 : humanoid ? 0.28 : 0.2,
      chicken ? 0.65 : humanoid ? 0.95 : 0.8,
      chicken ? 0.12 : humanoid ? 0.28 : 0.2,
      humanoid ? detailMaterial : darkMaterial,
      side * (chicken ? 0.18 : humanoid ? 0.2 : 0.4),
      chicken ? 0.35 : humanoid ? 0.48 : 0.4,
      humanoid ? 0 : front * 0.55
    );
    group.add(leg);
    legs.push(leg);
  }

  group.position.set(x, heightAt(x, z) + 0.5, z);
  group.userData = {
    type,
    legs,
    angle: noise(x, z, 902) * Math.PI * 2,
    speed: type === "Zombie" ? 0.72 : 0.42,
    timer: 1 + noise(x, z, 903) * 3,
    phase: noise(x, z, 909) * Math.PI * 2
  };
  scene.add(group);
  mobs.push(group);
}

function updateMobs(delta) {
  const clock = performance.now() * 0.006;
  for (let index = mobs.length - 1; index >= 0; index -= 1) {
    const mob = mobs[index];
    mob.userData.timer -= delta;
    if (mob.userData.timer <= 0) {
      mob.userData.angle += (noise(mob.position.x, mob.position.z, 907) - 0.5) * 2.2;
      mob.userData.timer = 2 + noise(mob.position.z, mob.position.x, 908) * 4;
    }
    const nextX = mob.position.x + Math.cos(mob.userData.angle) * mob.userData.speed * delta;
    const nextZ = mob.position.z + Math.sin(mob.userData.angle) * mob.userData.speed * delta;
    const nextHeight = heightAt(nextX, nextZ);
    const nextBiome = biome(nextX, nextZ);
    if (nextBiome !== "Ocean" && nextBiome !== "River" && Math.abs(nextHeight - (mob.position.y - 0.5)) <= 1.25) {
      mob.position.x = nextX;
      mob.position.z = nextZ;
      mob.position.y = nextHeight + 0.5;
      mob.rotation.y = -mob.userData.angle + Math.PI / 2;
    } else {
      mob.userData.angle += Math.PI * 0.65;
    }
    mob.userData.legs.forEach((leg, legIndex) => {
      leg.rotation.x = Math.sin(clock + mob.userData.phase + legIndex * Math.PI) * 0.5;
    });
    if (mob.position.distanceTo(camera.position) > 90) {
      scene.remove(mob);
      mobs.splice(index, 1);
    }
  }
}

function breakBlock() {
  if (paused) return;
  const now = performance.now();
  if (now - lastBreakAction < 180) return;
  lastBreakAction = now;
  const targetBlockData = target();
  if (!targetBlockData) return;
  const type = blockByKey(targetBlockData.block.type);
  if (type.unbreakable) return notify("Bedrock cannot be broken");
  const droppedItem = drop[targetBlockData.block.type];
  if (gameMode === "survival" && droppedItem) addItem(droppedItem, 1);
  const key = posKey(targetBlockData.block.x, targetBlockData.block.y, targetBlockData.block.z);
  edits.delete(key);
  removed.add(key);
  reload(targetBlockData.block.x, targetBlockData.block.z);
  notify(droppedItem ? `Collected ${itemByKey(droppedItem).name}` : `Broke ${type.name}`);
}

function updatePlayer(delta) {
  if (!started || paused || (!isTouch && !controls.isLocked)) return;

  if (gameMode === "creative" && creativeFlying) {
    sneaking = false;
    rushing = Boolean(keys.KeyR);
    eyeHeight = THREE.MathUtils.lerp(eyeHeight, EYE, 0.3);
    playerHeight = HEIGHT;
    const horizontalSpeed = rushing ? 12 : 8;
    const inputX = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const inputZ = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const inputLength = Math.hypot(inputX, inputZ) || 1;
    const forwardVector = new THREE.Vector3();
    const rightVector = new THREE.Vector3();
    camera.getWorldDirection(forwardVector);
    forwardVector.y = 0;
    forwardVector.normalize();
    rightVector.set(-forwardVector.z, 0, forwardVector.x);
    moveAxis("x", (rightVector.x * inputX / inputLength + forwardVector.x * inputZ / inputLength) * horizontalSpeed * delta);
    moveAxis("z", (rightVector.z * inputX / inputLength + forwardVector.z * inputZ / inputLength) * horizontalSpeed * delta);
    camera.position.y += ((keys.Space ? 1 : 0) - ((keys.ShiftLeft || keys.ShiftRight) ? 1 : 0)) * 7 * delta;
    velocity.y = 0;
    canJump = false;
    updateChunks();
    return;
  }

  sneaking = Boolean(keys.ShiftLeft || keys.ShiftRight);
  rushing = Boolean(keys.KeyR);
  const targetEyeHeight = sneaking ? SNEAK_EYE : EYE;
  const previousEyeHeight = eyeHeight;
  eyeHeight = THREE.MathUtils.lerp(eyeHeight, targetEyeHeight, 0.24);
  camera.position.y += eyeHeight - previousEyeHeight;
  playerHeight = sneaking ? SNEAK_HEIGHT : HEIGHT;
  const speed = sneaking ? 2.1 : rushing ? 7.4 : 4.6;
  const inputX = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const inputZ = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const inputLength = Math.hypot(inputX, inputZ) || 1;
  const forwardVector = new THREE.Vector3();
  const rightVector = new THREE.Vector3();
  camera.getWorldDirection(forwardVector);
  forwardVector.y = 0;
  forwardVector.normalize();
  rightVector.set(-forwardVector.z, 0, forwardVector.x);
  moveAxis("x", (rightVector.x * inputX / inputLength + forwardVector.x * inputZ / inputLength) * speed * delta);
  moveAxis("z", (rightVector.z * inputX / inputLength + forwardVector.z * inputZ / inputLength) * speed * delta);
  velocity.y -= 20 * delta;
  moveVertical(velocity.y * delta);
  if (camera.position.y < -20) respawn();
  updateChunks();
}

document.addEventListener("keydown", (event) => {
  if (!started || paused || chatOpen || inventoryOpen || gameMode !== "creative" || event.code !== "Space" || event.repeat) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const now = performance.now();
  if (now - lastCreativeSpacePress <= 320) {
    creativeFlying = !creativeFlying;
    velocity.y = 0;
    canJump = false;
    notify(creativeFlying ? "Creative flight enabled" : "Creative flight disabled");
    lastCreativeSpacePress = 0;
  } else {
    lastCreativeSpacePress = now;
    if (!creativeFlying) jump();
  }
  keys.Space = true;
}, true);

document.addEventListener("keyup", (event) => {
  if (event.code === "Space") keys.Space = false;
}, true);

/* Disable every mob system. Place this at the very end of script.js. */
function createMob() {}

function updateMobPopulation() {
  while (mobs.length > 0) {
    const mob = mobs.pop();
    scene.remove(mob);
  }
}

function updateMobs() {}
