"use strict";
const q=s=>document.querySelector(s),isTouch=matchMedia("(pointer:coarse)").matches||navigator.maxTouchPoints>0;document.body.classList.toggle("touch-device",isTouch);q("#device").textContent=isTouch?"Touch controls enabled.":"Keyboard and mouse controls enabled.";
let load=0;
let bootFinished=false;
function showMainMenu(){
  if(bootFinished)return;
  bootFinished=true;
  const loadingScreen=q("#loading");
  const menuScreen=q("#menu");
  if(menuScreen)menuScreen.classList.remove("hidden");
  if(loadingScreen){
    loadingScreen.classList.add("loading-done");
    setTimeout(()=>loadingScreen.remove(),420);
  }
}
window.addEventListener("error",event=>{
  const status=q("#loading-text");
  if(status){status.textContent="Load error: "+(event.message||"Unknown error");status.style.color="#ff8585";}
  console.error(event.error||event.message);
});
const loadTimer=setInterval(()=>{
  load=Math.min(100,load+5);
  const bar=q("#loading-bar"),percent=q("#loading-percent"),status=q("#loading-text");
  if(bar)bar.style.width=load+"%";
  if(percent)percent.textContent=load+"%";
  if(status)status.textContent=load<35?"Loading renderer...":load<70?"Building BedFight arena...":load<100?"Preparing challenger bot...":"Ready.";
  if(load>=100){clearInterval(loadTimer);showMainMenu();}
},55);
setTimeout(showMainMenu,2500);

const scene=new THREE.Scene();scene.background=new THREE.Color(0x8ccff5);scene.fog=new THREE.Fog(0xa9dced,55,170);const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,240);camera.rotation.order="YXZ";const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance"});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.2:1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;q("#game").appendChild(renderer.domElement);const controls=new THREE.PointerLockControls(camera,document.body);scene.add(new THREE.HemisphereLight(0xe8f7ff,0x33483a,1.55));const light=new THREE.DirectionalLight(0xfff1c4,1.8);light.position.set(40,70,20);scene.add(light);scene.add(new THREE.Mesh(new THREE.SphereGeometry(220,24,16),new THREE.MeshBasicMaterial({color:0x8ccff5,side:THREE.BackSide,fog:false})));
const G=new THREE.BoxGeometry(1,1,1),ray=new THREE.Raycaster(),center=new THREE.Vector2(),velocity=new THREE.Vector3(),keys={},blocks=new Map(),blockMeshes=[],placedBlocks=new Set();let started=false,paused=false,roundActive=false,countdownActive=false,selected=0,canJump=false,sneaking=false,rushing=false,eye=1.62,height=1.75,touchId=null,touchX=0,touchY=0,lastTime=performance.now(),roundStart=0,roundNumber=1,blueScore=0,redScore=0,blueBed=true,redBed=true,playerAlive=true,botAlive=true,noticeTimer=null;
const materials={blue_wool:new THREE.MeshLambertMaterial({color:0x3478d4}),red_wool:new THREE.MeshLambertMaterial({color:0xd53c3c}),endstone:new THREE.MeshLambertMaterial({color:0xd9d49a}),planks:new THREE.MeshLambertMaterial({color:0xa8743f}),bed_red:new THREE.MeshLambertMaterial({color:0xd52f2f}),bed_blue:new THREE.MeshLambertMaterial({color:0x3478d4}),bed_white:new THREE.MeshLambertMaterial({color:0xf4f0e6})};
const items=[{name:"Wooden Sword",icon:"sword"},{name:"Blue Wool",icon:"wool",count:64},{name:"Wooden Pickaxe",icon:"pickaxe",enchanted:true},{name:"Wooden Axe",icon:"axe",enchanted:true},{name:"Shears",icon:"shears"},null,null,null,null];
const K=(x,y,z)=>x+","+y+","+z;function addBlock(x,y,z,type,placed=false){const k=K(x,y,z);if(blocks.has(k))return null;const m=new THREE.Mesh(G,materials[type]);m.position.set(x,y,z);m.userData={x,y,z,type,placed};blocks.set(k,m);blockMeshes.push(m);scene.add(m);if(placed)placedBlocks.add(k);return m}function removeBlock(m){const k=K(m.userData.x,m.userData.y,m.userData.z);blocks.delete(k);placedBlocks.delete(k);scene.remove(m);const i=blockMeshes.indexOf(m);if(i>=0)blockMeshes.splice(i,1)}
function fill(x1,x2,y1,y2,z1,z2,type){for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(let z=z1;z<=z2;z++)addBlock(x,y,z,type)}
function buildBed(x,y,z,team){
  addBlock(x,y,z,"bed_white");
  addBlock(x,y,z+1,team==="blue"?"bed_blue":"bed_red");
}
function bedDefense(x,y,z){
  const bedCells=new Set([K(x,y,z),K(x,y,z+1)]);
  for(let bx=x-1;bx<=x+1;bx++)for(let bz=z-1;bz<=z+2;bz++){
    const edge=bx===x-1||bx===x+1||bz===z-1||bz===z+2;
    if(edge&&!bedCells.has(K(bx,y,bz)))addBlock(bx,y,bz,"planks");
  }
  addBlock(x,y+1,z,"planks");addBlock(x,y+1,z+1,"planks");
  for(let bx=x-2;bx<=x+2;bx++)for(let bz=z-2;bz<=z+3;bz++){
    const edge=bx===x-2||bx===x+2||bz===z-2||bz===z+3;
    if(edge)addBlock(bx,y,bz,"endstone");
  }
  for(let bx=x-1;bx<=x+1;bx++)for(let bz=z-1;bz<=z+2;bz++)addBlock(bx,y+2,bz,"endstone");
}
function hollowTower(cx,baseY,cz,radius,height,teamType){
  for(let y=baseY;y<baseY+height;y++)for(let x=cx-radius;x<=cx+radius;x++)for(let z=cz-radius;z<=cz+radius;z++){
    const wall=x===cx-radius||x===cx+radius||z===cz-radius||z===cz+radius;
    if(wall&&((x+z+y)%5!==0||y<baseY+2))addBlock(x,y,z,"endstone");
  }
  for(let layer=0;layer<5;layer++){
    const r=Math.max(0,radius+1-layer);
    for(let x=cx-r;x<=cx+r;x++)for(let z=cz-r;z<=cz+r;z++){
      const edge=x===cx-r||x===cx+r||z===cz-r||z===cz+r;
      if(edge)addBlock(x,baseY+height+layer,z,teamType);
    }
  }
}
function castleWall(zStart,zEnd,teamType){
  const direction=zStart<zEnd?1:-1;
  for(let z=zStart;z!==zEnd+direction;z+=direction){
    for(let x=-8;x<=8;x++){
      if(Math.abs(x)<=2&&z===zStart)continue;
      addBlock(x,7,z,"endstone");
      if(Math.abs(x)>2)addBlock(x,8,z,"endstone");
      if(Math.abs(x)>5)addBlock(x,9,z,teamType);
    }
  }
}
function buildArena(){
  for(const m of[...blockMeshes])removeBlock(m);
  placedBlocks.clear();
  // Symmetrical floating islands.
  fill(-11,11,4,5,-10,16,"endstone");
  fill(-11,11,4,5,-66,-40,"endstone");
  fill(-10,10,6,6,-9,15,"blue_wool");
  fill(-10,10,6,6,-65,-41,"red_wool");
  // Front lips and side wall-run ledges.
  fill(-6,6,6,6,-12,-9,"blue_wool");
  fill(-6,6,6,6,-41,-38,"red_wool");
  fill(-12,-10,6,7,-8,4,"planks");fill(10,12,6,7,-8,4,"planks");
  fill(-12,-10,6,7,-60,-48,"planks");fill(10,12,6,7,-60,-48,"planks");
  // Castle walls and towers.
  castleWall(10,14,"blue_wool");
  castleWall(-60,-64,"red_wool");
  hollowTower(-8,7,12,3,9,"blue_wool");hollowTower(8,7,12,3,9,"blue_wool");
  hollowTower(-8,7,-62,3,9,"red_wool");hollowTower(8,7,-62,3,9,"red_wool");
  hollowTower(0,7,14,4,13,"blue_wool");hollowTower(0,7,-64,4,13,"red_wool");
  // Beds with oak planks inside and end stone outside.
  buildBed(0,7,3,"blue");bedDefense(0,7,3);
  buildBed(0,7,-56,"red");bedDefense(0,7,-56);
  blueBed=redBed=true;
  q("#blue-bed").textContent="Blue Bed: ALIVE";
  q("#red-bed").textContent="Red Bed: ALIVE";
}
function createHotbar(){const bar=q("#hotbar");bar.innerHTML="";items.forEach((it,i)=>{const s=document.createElement("button");s.className="slot";if(it){const icon=it.icon==="wool"?'<span class="wool-icon"></span>':`<span class="pixel-tool ${it.icon}"></span>`;s.innerHTML=`<span class="slot-number">${i+1}</span>${icon}<span class="slot-count">${it.count||""}</span>`}else s.innerHTML=`<span class="slot-number">${i+1}</span>`;s.addEventListener("pointerdown",e=>{e.preventDefault();selected=i;updateHotbar()});bar.appendChild(s)});updateHotbar()}function updateHotbar(){q("#hotbar").querySelectorAll(".slot").forEach((s,i)=>s.classList.toggle("active",i===selected));q("#selected").textContent=items[selected]?.name||"Empty"}
function playerBounds(x,y,z){const feet=y-eye;return{minX:x-.3,maxX:x+.3,minY:feet,maxY:feet+height,minZ:z-.3,maxZ:z+.3}}function hitBox(b,p){return b.maxX>p.x-.5&&b.minX<p.x+.5&&b.maxY>p.y-.5&&b.minY<p.y+.5&&b.maxZ>p.z-.5&&b.minZ<p.z+.5}function collides(x,y,z){const b=playerBounds(x,y,z);for(const m of blockMeshes)if(hitBox(b,m.position))return true;return false}function supported(x,z){const y=camera.position.y-eye-.12;return[[0,0],[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]].some(([ox,oz])=>blocks.has(K(Math.floor(x+ox+.5),Math.floor(y),Math.floor(z+oz+.5))))}function moveAxis(axis,d){const n=Math.max(1,Math.ceil(Math.abs(d)/.05)),step=d/n;for(let i=0;i<n;i++){const x=axis==="x"?camera.position.x+step:camera.position.x,z=axis==="z"?camera.position.z+step:camera.position.z;if(collides(x,camera.position.y,z))return;if(sneaking&&canJump&&velocity.y<=0&&!supported(x,z))return;camera.position[axis]+=step}}function moveY(d){const n=Math.max(1,Math.ceil(Math.abs(d)/.05)),step=d/n;for(let i=0;i<n;i++){const y=camera.position.y+step;if(collides(camera.position.x,y,camera.position.z)){if(velocity.y<=0)canJump=true;velocity.y=0;return}camera.position.y=y;canJump=false}}
function updatePlayer(dt){if(!started||paused||countdownActive||!playerAlive||(!isTouch&&!controls.isLocked))return;sneaking=!!(keys.ShiftLeft||keys.ShiftRight);rushing=!!keys.KeyR;const target=sneaking?1.32:1.62,old=eye;eye=THREE.MathUtils.lerp(eye,target,.25);camera.position.y+=eye-old;height=sneaking?1.45:1.75;const speed=sneaking?2.2:rushing?7:4.8,ix=(keys.KeyD?1:0)-(keys.KeyA?1:0),iz=(keys.KeyW?1:0)-(keys.KeyS?1:0),len=Math.hypot(ix,iz)||1,f=new THREE.Vector3(),r=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();r.set(-f.z,0,f.x);moveAxis("x",(r.x*ix/len+f.x*iz/len)*speed*dt);moveAxis("z",(r.z*ix/len+f.z*iz/len)*speed*dt);velocity.y-=20*dt;moveY(velocity.y*dt);if(camera.position.y<-8)killPlayer()}
function target(){ray.setFromCamera(center,camera);ray.far=6;return ray.intersectObjects(blockMeshes,false)[0]||null}function breakTarget(){if(!roundActive)return;const h=target();if(!h)return;const m=h.object,t=m.userData.type;if(t==="bed_red"||t==="bed_white"&&m.position.z<-30){removeBlock(m);redBed=false;q("#red-bed").textContent="Red Bed: DESTROYED";notice("Red bed destroyed") }else if(m.userData.placed)removeBlock(m)}function placeTarget(){if(!roundActive||selected!==1)return;const h=target();if(!h||!h.face||items[1].count<=0)return;const p=h.object.position.clone().add(h.face.normal),x=Math.round(p.x),y=Math.round(p.y),z=Math.round(p.z);if(blocks.has(K(x,y,z)))return;const m=addBlock(x,y,z,"blue_wool",true);if(collides(camera.position.x,camera.position.y,camera.position.z)){removeBlock(m);return}items[1].count--;createHotbar()}
function jump(){if(canJump&&roundActive){velocity.y=7.2;canJump=false}}
function playerSpawn(){playerAlive=true;camera.position.set(0,9,11);camera.rotation.set(0,Math.PI,0);velocity.set(0,0,0);items[1].count=64;selected=0;createHotbar()}
function respawnCountdown(team,callback){
  const label=q("#countdown");
  label.classList.remove("hidden");
  let left=3;
  label.textContent="RESPAWNING IN "+left;
  const id=setInterval(()=>{
    left--;
    if(left>0)label.textContent="RESPAWNING IN "+left;
    else{clearInterval(id);label.classList.add("hidden");callback();}
  },1000);
}
function killPlayer(){if(!playerAlive)return;playerAlive=false;velocity.set(0,0,0);if(blueBed)respawnCountdown("BLUE",playerSpawn);else endRound("RED")}
function notice(t){q("#notice").textContent=t;q("#notice").classList.add("show");clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>q("#notice").classList.remove("show"),1400)}
function makeBot(){const g=new THREE.Group(),red=new THREE.MeshLambertMaterial({color:0xd94b4b}),skin=new THREE.MeshLambertMaterial({color:0xc99269}),dark=new THREE.MeshLambertMaterial({color:0x512a1d});const body=new THREE.Mesh(new THREE.BoxGeometry(.75,1.05,.42),red),head=new THREE.Mesh(new THREE.BoxGeometry(.72,.72,.72),skin);body.position.y=1.25;head.position.y=2.1;g.add(body,head);for(const x of[-.22,.22]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.25,.95,.25),dark);leg.position.set(x,.48,0);g.add(leg)}for(const x of[-.53,.53]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.22,.95,.22),skin);arm.position.set(x,1.35,0);g.add(arm)}g.position.set(0,6.5,-49);scene.add(g);return g}const bot=makeBot();let botWool=64,botPlaceTimer=0,botAttackTimer=0,botRespawnTimer=0;
function botSpawn(){botAlive=true;bot.visible=true;bot.position.set(0,6.5,-61);bot.rotation.y=0;botWool=64;botPlaceTimer=0;botAttackTimer=0}
function killBot(){if(!botAlive)return;botAlive=false;bot.visible=false;if(redBed){botRespawnTimer=3;notice("Red respawning in 3...")}else endRound("BLUE")}
function botSolidBelow(x,z){return blocks.has(K(Math.round(x),5,Math.round(z)))||blocks.has(K(Math.round(x),6,Math.round(z)))||blocks.has(K(Math.round(x),7,Math.round(z)))}function updateBot(dt){if(!roundActive||countdownActive)return;if(!botAlive){if(redBed&&botRespawnTimer>0){botRespawnTimer-=dt;if(botRespawnTimer<=0)botSpawn()}return}const dx=camera.position.x-bot.position.x,dz=camera.position.z-bot.position.z,dist=Math.hypot(dx,dz);let tx=0,tz=blueBed?4:camera.position.z;if(dist<8){tx=camera.position.x;tz=camera.position.z}const vx=tx-bot.position.x,vz=tz-bot.position.z,len=Math.hypot(vx,vz)||1,speed=dist<7?5.2:4.7,nx=bot.position.x+vx/len*speed*dt,nz=bot.position.z+vz/len*speed*dt;bot.rotation.y=Math.atan2(vx,vz);botPlaceTimer-=dt;if(!botSolidBelow(nx,nz)&&botWool>0&&botPlaceTimer<=0){const bx=Math.round(nx),bz=Math.round(nz);if(!blocks.has(K(bx,5,bz))){addBlock(bx,5,bz,"red_wool",true);botWool--;botPlaceTimer=.19}bot.position.x=nx;bot.position.z=nz}else if(botSolidBelow(nx,nz)){bot.position.x=nx;bot.position.z=nz;bot.position.y=6.5}if(bot.position.y<-8)killBot();if(blueBed&&Math.hypot(bot.position.x,bot.position.z-2)<2.2){for(const m of[...blockMeshes])if((m.userData.type==="bed_blue"||m.userData.type==="bed_white")&&m.position.z>-20)removeBlock(m);blueBed=false;q("#blue-bed").textContent="Blue Bed: DESTROYED";notice("Blue bed destroyed")}botAttackTimer-=dt;if(dist<2.3&&botAttackTimer<=0){botAttackTimer=.48;camera.position.x+=dx/Math.max(dist,1)*1.1;camera.position.z+=dz/Math.max(dist,1)*1.1;velocity.y=3.4;if(!blueBed&&Math.random()<.28)killPlayer()}if(dist<2.2&&keys.Space)killBot()}
function updateScore(){q("#score").textContent=`BLUE ${blueScore} - ${redScore} RED`;q("#round").textContent=`Round ${roundNumber} / Best of 5`}
function countdown(){countdownActive=true;roundActive=false;q("#countdown").classList.remove("hidden");let n=5;q("#countdown").textContent=n;const id=setInterval(()=>{n--;if(n>0)q("#countdown").textContent=n;else{clearInterval(id);q("#countdown").textContent="FIGHT";setTimeout(()=>q("#countdown").classList.add("hidden"),450);countdownActive=false;roundActive=true;roundStart=performance.now()}},1000)}
function resetRound(){buildArena();playerSpawn();botSpawn();blueBed=redBed=true;updateScore();countdown()}
function endRound(winner){if(!roundActive)return;roundActive=false;paused=true;if(winner==="BLUE")blueScore++;else redScore++;updateScore();q("#round-title").textContent=winner+" WINS";q("#round-summary").innerHTML=`<span>Score: BLUE ${blueScore} - ${redScore} RED</span><span>Round time: ${format(performance.now()-roundStart)}</span>`;q("#round-result").classList.remove("hidden");if(controls.isLocked)controls.unlock()}
function format(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60);return`${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function startGame(){started=true;paused=false;roundNumber=1;blueScore=redScore=0;q("#menu").classList.add("hidden");q("#hud").classList.remove("hidden");resetRound();if(!isTouch)controls.lock()}
q("#play").addEventListener("click",startGame);q("#resume").addEventListener("click",()=>{paused=false;q("#pause").classList.add("hidden");if(!isTouch)controls.lock()});q("#reset-round").addEventListener("click",()=>{paused=false;q("#pause").classList.add("hidden");resetRound();if(!isTouch)controls.lock()});q("#exit").addEventListener("click",()=>location.reload());q("#next-round").addEventListener("click",()=>{q("#round-result").classList.add("hidden");if(blueScore>=3||redScore>=3){q("#round-title").textContent=blueScore>redScore?"MATCH WON":"MATCH LOST";setTimeout(()=>location.reload(),1200);return}roundNumber++;paused=false;resetRound();if(!isTouch)controls.lock()});controls.addEventListener("unlock",()=>{if(started&&!paused&&!countdownActive&&!q("#round-result").classList.contains("hidden"))return;if(started&&!paused){paused=true;q("#pause").classList.remove("hidden")}});
function hold(button,keyCode){const down=e=>{e.preventDefault();keys[keyCode]=true;button.classList.add("active");button.setPointerCapture?.(e.pointerId)},up=e=>{e.preventDefault();keys[keyCode]=false;button.classList.remove("active")};button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up)}document.querySelectorAll("[data-key]").forEach(b=>hold(b,b.dataset.key));q("#mobile-jump").addEventListener("pointerdown",jump);q("#mobile-break").addEventListener("pointerdown",breakTarget);q("#mobile-place").addEventListener("pointerdown",placeTarget);q("#mobile-menu").addEventListener("pointerdown",()=>{paused=true;q("#pause").classList.remove("hidden")});renderer.domElement.addEventListener("pointerdown",e=>{if(!isTouch||!started||paused)return;touchId=e.pointerId;touchX=e.clientX;touchY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener("pointermove",e=>{if(e.pointerId!==touchId||paused)return;const dx=e.clientX-touchX,dy=e.clientY-touchY;touchX=e.clientX;touchY=e.clientY;camera.rotation.y-=dx*.004;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.004,-Math.PI/2+.05,Math.PI/2-.05)});renderer.domElement.addEventListener("pointerup",e=>{if(e.pointerId===touchId)touchId=null});document.addEventListener("keydown",e=>{if(!started||paused)return;keys[e.code]=true;if(e.code==="Space"&&!e.repeat)jump();if(e.code.startsWith("Digit")){const n=Number(e.code.slice(5));if(n>=1&&n<=9){selected=n-1;updateHotbar()}}});document.addEventListener("keyup",e=>keys[e.code]=false);document.addEventListener("mousedown",e=>{if(isTouch||!started||paused||!controls.isLocked)return;if(e.button===0)breakTarget();if(e.button===2)placeTarget()});document.addEventListener("contextmenu",e=>e.preventDefault());document.addEventListener("wheel",e=>{if(started&&!paused){selected=(selected+Math.sign(e.deltaY)+9)%9;updateHotbar()}},{passive:true});addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
function animate(){requestAnimationFrame(animate);const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;updatePlayer(dt);updateBot(dt);if(roundActive)q("#timer").textContent="Time: "+format(now-roundStart);bot.children.slice(2,6).forEach((leg,i)=>leg.rotation.x=Math.sin(now*.007+i*Math.PI)*.45);renderer.render(scene,camera)}
createHotbar();buildArena();botSpawn();playerSpawn();animate();
