diff --git a/docs/code_audit_zh.md b/docs/code_audit_zh.md
new file mode 100644
index 0000000000000000000000000000000000000000..5ebc87934aaeedca5ff2e6011bc2cc90a4cecf25
--- /dev/null
+++ b/docs/code_audit_zh.md
@@ -0,0 +1,19 @@
+# Excel保卫战代码审阅笔记
+
+- 项目类型：React + TypeScript + Vite 的前端单机动作生存游戏。
+- 核心玩法：WASD移动、鼠标瞄准和持续射击；有阶段升级、武器形态、Boss与生存模式。
+
+## 主要风险点（摘要）
+
+1. `italic`通用升级在发射前对`bulletSpeed/fireRate`做乘法，但变量初始值是0，随后才赋基础值，导致该升级的核心效果实际不生效。
+2. `comment_knockback`分支写入`knockbackMult`，但当前作用域没有定义该变量，命中此分支会触发运行时错误。
+3. 关卡结束时是否进入升级选择用“当前已选升级数 < 全部升级总数”判断；但玩家只能拿到“当前武器形态+通用”的子集，后期可能出现升级池为空仍强制进选择界面，造成软锁。
+4. `hpMult`计算后未被使用，疑似遗留难度参数。
+5. 敌人减速判断里出现`slow_zone`，但水池类型定义中不存在该类型，属于死代码/未完成特性。
+
+## 建议
+
+- 把`italic`改为倍率变量（如`bulletSpeedMult`/`fireRateMult`）在武器基础参数赋值后统一结算。
+- 为`comment_knockback`补齐局部变量或改为写入子弹字段。
+- 关卡结束判定改为“可选升级池是否为空”。
+- 清理未使用参数与无效分支，降低后续维护成本。
diff --git a/src/App.tsx b/src/App.tsx
index 2ea10da0b6822656aa2cab928501595d2eb4fd39..d1f8b53d1de56bc74a8e388d801f669da2f82167 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,170 +1,194 @@
 import React, { useEffect, useRef, useState } from 'react';
 import { AttackForm, Upgrade, SpecificUpgrade, GeneralUpgrade, Player, Enemy, Bullet, MAPS, Room, createRoom, EnemyType, ATTACK_FORM_NAMES, ATTACK_FORM_DESCS, UPGRADE_NAMES, UPGRADE_DESCS } from './gameLogic';
 import { MainMenu } from './components/MainMenu';
-import { GameOver, FormSelection, UpgradeSelection, SumSkillOverlay, GridMenu, GridToolOverlay } from './components/UI';
+import { GameOver, GameClear, FormSelection, UpgradeSelection, SumSkillOverlay, GridMenu, GridToolOverlay } from './components/UI';
+
+const TOTAL_STAGES = 15;
 
 const getStageDuration = (stage: number) => {
   if (stage === 1) return 30;
   if (stage === 2) return 40;
   if (stage === 3) return 50;
   return 60;
 };
 
 function generateUpgradeChoices(room: Room, player: Player): Upgrade[] {
   const choices: Upgrade[] = [];
   const form = player.attackForm;
   if (!form) return [];
 
   const allSpecific = [
     'wordart_size', 'wordart_weight', 'wordart_spread', 'wordart_title', 'wordart_ult',
     'wordart_wide', 'wordart_fast_push', 'wordart_shield', 'wordart_stun', 'wordart_quad',
+    'wordart_all_caps', 'wordart_hotkey', 'wordart_typewriter', 'wordart_revision', 'wordart_subscript',
     'sparkline_width', 'sparkline_focus', 'sparkline_bounce', 'sparkline_rapid', 'sparkline_ult',
     'sparkline_freeze', 'sparkline_cannon', 'sparkline_reflect', 'sparkline_overclock',
+    'sparkline_burn', 'sparkline_killshot', 'sparkline_execute', 'sparkline_tenshot', 'sparkline_charge',
     'comment_size', 'comment_chain', 'comment_residue', 'comment_fast', 'comment_ult',
     'comment_triple', 'comment_knockback', 'comment_split', 'comment_black', 'comment_super',
+    'comment_density', 'comment_mark', 'comment_wallbounce', 'comment_proximity', 'comment_battery',
     'array_count', 'array_split', 'array_track', 'array_fast', 'array_ult',
-    'array_plus_2', 'array_rapid', 'array_bounce', 'array_pierce', 'array_big'
+    'array_plus_2', 'array_rapid', 'array_bounce', 'array_pierce', 'array_big',
+    'array_ricochet', 'array_converge', 'array_single', 'array_orbit', 'array_scatter'
   ] as SpecificUpgrade[];
   
   const formSpecific = allSpecific.filter(u => u.startsWith(form));
   const availableSpecific = formSpecific.filter(u => !player.specificUpgrades.includes(u));
 
   const allGeneral = ['bold', 'underline', 'highlight', 'rand', 'vlookup', 'sum', 'italic', 'strikethrough', 'ctrl_c', 'ctrl_z', 'format_painter'] as GeneralUpgrade[];
   let availableGeneral = allGeneral.filter(u => !player.generalUpgrades.includes(u));
   if (form === 'sparkline') {
     availableGeneral = availableGeneral.filter(u => u !== 'format_painter');
   }
 
   const has3Specific = player.specificUpgrades.length >= 3;
   const ult = formSpecific.find(u => u.endsWith('_ult'));
   
   // If player has 3 specific upgrades, make sure ult is in the pool
   let pool: Upgrade[] = [...availableSpecific.filter(u => !u.endsWith('_ult')), ...availableGeneral];
   
   if (has3Specific && ult && !player.specificUpgrades.includes(ult)) {
     // High chance to get ult if eligible
     if (Math.random() < 0.6) {
       choices.push(ult);
     } else {
       pool.push(ult);
     }
   }
 
   // First stage guarantee a specific upgrade
   if (room.stage === 1 && availableSpecific.length > 0) {
     const specificChoice = availableSpecific[Math.floor(Math.random() * availableSpecific.length)];
     choices.push(specificChoice);
     pool = pool.filter(u => u !== specificChoice);
   }
 
-  const numChoices = room.stage < 5 ? 5 : 3;
+  const numChoices = room.stage <= 4 ? 5 : 3;
 
   while (choices.length < numChoices && pool.length > 0) {
     const specificInPool = pool.filter(u => availableSpecific.includes(u as SpecificUpgrade));
     const generalInPool = pool.filter(u => availableGeneral.includes(u as GeneralUpgrade));
     
     let choice: Upgrade;
     // Prioritize specific upgrades in early game
-    const specificChance = room.stage < 5 ? 0.8 : 0.4;
+    const specificChance = room.stage <= 4 ? 0.92 : 0.4;
     
     if (specificInPool.length > 0 && Math.random() < specificChance) {
       choice = specificInPool[Math.floor(Math.random() * specificInPool.length)];
     } else if (generalInPool.length > 0) {
       choice = generalInPool[Math.floor(Math.random() * generalInPool.length)];
     } else {
       choice = pool[Math.floor(Math.random() * pool.length)];
     }
     
     if (!choices.includes(choice)) {
       choices.push(choice);
       pool = pool.filter(u => u !== choice);
     }
   }
 
   return choices;
 }
 
 export default function App() {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const containerRef = useRef<HTMLDivElement>(null);
   
   const gameStateRef = useRef<Room | null>(null);
   const [uiState, setUiState] = useState<{
     stage: number;
     stageTimer: number;
     isSelectingSkill: boolean;
     isSelectingForm: boolean;
     skillChoices: Upgrade[];
     formChoices: AttackForm[];
     players: Record<string, Player>;
   } | null>(null);
   const myId = 'player1';
   
   const [currentRoom, setCurrentRoom] = useState<string>('');
   const [roomInput, setRoomInput] = useState<string>('工作簿1');
 
   const keys = useRef({ w: false, a: false, s: false, d: false });
   const mouse = useRef({ x: 0, y: 0, isDown: false });
   const animationFrameId = useRef<number | null>(null);
   const gameLoopId = useRef<number | null>(null);
   
   const particles = useRef<any[]>([]);
   const shake = useRef<number>(0);
 
   const [showGridMenu, setShowGridMenu] = useState(false);
   const [gridMenuPos, setGridMenuPos] = useState({x: 0, y: 0});
+  const [isCleared, setIsCleared] = useState(false);
+  const [finalScore, setFinalScore] = useState(0);
 
   const isSelectingGridRef = useRef(false);
   const selectionStartRef = useRef<{x: number, y: number} | null>(null);
   const selectionEndRef = useRef<{x: number, y: number} | null>(null);
 
+  const clampGridMenuPos = (x: number, y: number) => {
+    const menuW = 220;
+    const menuH = 170;
+    const margin = 8;
+    const maxW = containerRef.current?.clientWidth || window.innerWidth;
+    const maxH = containerRef.current?.clientHeight || window.innerHeight;
+    return {
+      x: Math.max(margin, Math.min(maxW - menuW - margin, x)),
+      y: Math.max(margin, Math.min(maxH - menuH - margin, y))
+    };
+  };
+
   const joinRoom = () => {
     if (roomInput.trim()) {
       const room = createRoom(roomInput.trim());
       room.players[myId] = {
         id: myId,
         x: MAPS[0].playerSpawn.x,
         y: MAPS[0].playerSpawn.y,
         hp: 500,
         maxHp: 500,
         angle: 0,
         isShooting: false,
         keys: { w: false, a: false, s: false, d: false },
         attackForm: null,
         specificUpgrades: [],
         generalUpgrades: [],
         lastShot: 0,
         lastLaser: 0,
         kills: 0,
         sumKills: 0,
         deaths: 0,
         readyForNextStage: false,
         invincibleUntil: 0,
         sumStacks: 0,
         wordartCounter: 0,
-        commentCounter: 0
+        commentCounter: 0,
+        laserCharge: 0,
+        lastChargeTime: 0,
+        lasersHit: 0,
+        nextLaserCrit: false
       };
       gameStateRef.current = room;
       setCurrentRoom(roomInput.trim());
     }
   };
 
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'w' || e.key === 'W') keys.current.w = true;
       if (e.key === 'a' || e.key === 'A') keys.current.a = true;
       if (e.key === 's' || e.key === 'S') keys.current.s = true;
       if (e.key === 'd' || e.key === 'D') keys.current.d = true;
       if (e.key === ' ') {
         const gs = gameStateRef.current;
         if (gs && gs.players[myId]) {
           const p = gs.players[myId];
           if (p.gridToolCharges && p.gridToolCharges > 0 && gs.bulletTime <= 0) {
             p.gridToolCharges--;
             gs.bulletTime = 300;
           }
         }
       }
     };
 
     const handleKeyUp = (e: KeyboardEvent) => {
@@ -196,187 +220,212 @@ export default function App() {
           setShowGridMenu(false);
           if (gameStateRef.current) gameStateRef.current.bulletTime = 0;
         }
         return;
       }
 
       const gs = gameStateRef.current;
       if (gs && gs.bulletTime > 0 && !showGridMenu) {
         isSelectingGridRef.current = true;
         selectionStartRef.current = { x: mouse.current.x, y: mouse.current.y };
         selectionEndRef.current = { x: mouse.current.x, y: mouse.current.y };
       }
     };
     
     const handleMouseUp = (e: MouseEvent) => { 
       if (e.button !== 0) return;
       mouse.current.isDown = false; 
       
       if (isSelectingGridRef.current) {
         isSelectingGridRef.current = false;
         if (selectionStartRef.current && selectionEndRef.current) {
           const dx = Math.abs(selectionEndRef.current.x - selectionStartRef.current.x);
           const dy = Math.abs(selectionEndRef.current.y - selectionStartRef.current.y);
           if (dx > 10 && dy > 10) {
             setShowGridMenu(true);
-            let menuX = mouse.current.x;
-            let menuY = mouse.current.y;
-            if (menuX + 200 > window.innerWidth) menuX = window.innerWidth - 200;
-            if (menuY + 150 > window.innerHeight) menuY = window.innerHeight - 150;
-            setGridMenuPos({ x: menuX, y: menuY });
+            const pos = clampGridMenuPos(mouse.current.x, mouse.current.y);
+            setGridMenuPos(pos);
           } else {
             selectionStartRef.current = null;
             selectionEndRef.current = null;
           }
         }
       }
     };
 
     window.addEventListener('keydown', handleKeyDown);
     window.addEventListener('keyup', handleKeyUp);
     window.addEventListener('mousemove', handleMouseMove);
     window.addEventListener('mousedown', handleMouseDown);
     window.addEventListener('mouseup', handleMouseUp);
 
     return () => {
       window.removeEventListener('keydown', handleKeyDown);
       window.removeEventListener('keyup', handleKeyUp);
       window.removeEventListener('mousemove', handleMouseMove);
       window.removeEventListener('mousedown', handleMouseDown);
       window.removeEventListener('mouseup', handleMouseUp);
     };
   }, [showGridMenu]);
 
   // Game Loop
   useEffect(() => {
     if (!currentRoom) return;
 
     let tick = 0;
     let lastUiUpdate = 0;
     let lastIsSelecting = false;
-    let lastIsSelectingForm = true;
+    let lastIsSelectingForm = false;
 
     const gameLoop = () => {
       const room = gameStateRef.current;
       if (!room) return;
 
       tick++;
       const now = Date.now();
       const currentMap = MAPS[Math.min(room.stage - 1, MAPS.length - 1)];
 
       // Update UI
       const forceUpdate = room.isSelectingSkill !== lastIsSelecting || room.isSelectingForm !== lastIsSelectingForm;
       if (forceUpdate || now - lastUiUpdate > 250) {
         setUiState({
           stage: room.stage,
           stageTimer: room.stageTimer,
           isSelectingSkill: room.isSelectingSkill,
           isSelectingForm: room.isSelectingForm,
           skillChoices: room.skillChoices,
           formChoices: room.formChoices,
           players: JSON.parse(JSON.stringify(room.players))
         });
         lastUiUpdate = now;
         lastIsSelecting = room.isSelectingSkill;
         lastIsSelectingForm = room.isSelectingForm;
       }
 
-      if (room.isSelectingSkill || room.isSelectingForm) return;
+      if (isCleared || room.isSelectingSkill || room.isSelectingForm) return;
 
       room.stageTimer++;
       if (room.bulletTime > 0) room.bulletTime--;
 
       const timeSpeed = room.bulletTime > 0 ? 0.1 : 1.0;
       let stageDuration = 3600;
       if (room.stage === 1) stageDuration = 1800;
       else if (room.stage === 2) stageDuration = 2400;
       else if (room.stage === 3) stageDuration = 3000;
 
       room.margin = 0;
 
-      if (room.stageTimer >= stageDuration && room.players[myId]?.specificUpgrades.length + room.players[myId]?.generalUpgrades.length < Object.keys(UPGRADE_NAMES).length) {
+      if (room.stageTimer >= stageDuration) {
+        if (room.stage >= TOTAL_STAGES) {
+          const me = room.players[myId];
+          const score = (me?.kills || 0) * 10 + room.stage * 200 - (me?.deaths || 0) * 100;
+          setFinalScore(Math.max(0, score));
+          setIsCleared(true);
+          return;
+        }
+
         room.skillChoices = generateUpgradeChoices(room, room.players[myId]);
-        room.players[myId].upgradesToChoose = room.stage < 5 ? 2 : 1;
+        if (room.skillChoices.length === 0) {
+          room.stage++;
+          room.stageTimer = 0;
+          const nextMap = MAPS[Math.min(room.stage - 1, MAPS.length - 1)];
+          const me = room.players[myId];
+          if (me) {
+            me.x = nextMap.playerSpawn.x;
+            me.y = nextMap.playerSpawn.y;
+          }
+          room.enemies = [];
+          room.bullets = [];
+          room.puddles = [];
+          room.enemyBullets = [];
+          room.aoeWarnings = [];
+          room.lasers = [];
+          room.items = [];
+          room.dynamicObstacles = [];
+          return;
+        }
+        room.players[myId].upgradesToChoose = (room.stage === 4 || room.stage === 8) ? 2 : 1; //保留
         room.isSelectingSkill = true;
         return;
       }
 
       if (room.stage >= 5) {
         if (room.eventTimer > 0) {
           room.eventTimer -= timeSpeed;
           if (room.eventTimer <= 0) {
             room.activeEvent = 'NONE';
           }
         } else if (room.stageTimer % 3600 === 0 && room.stageTimer > 0) {
           room.activeEvent = Math.random() < 0.5 ? 'DIV0' : 'OOM';
           room.eventTimer = 900; // 15 seconds
         }
       }
 
       if (room.activeEvent === 'DIV0') {
         const cx = currentMap.width / 2;
         const cy = currentMap.height / 2;
         const pullForce = 2 * timeSpeed;
         
         Object.values(room.players).forEach((p: any) => {
           if (p.hp > 0) {
             const angle = Math.atan2(cy - p.y, cx - p.x);
             p.x += Math.cos(angle) * pullForce;
             p.y += Math.sin(angle) * pullForce;
             if (Math.hypot(cx - p.x, cy - p.y) < 100) {
               p.hp -= 1 * timeSpeed;
               if (p.hp <= 0) {
                 if (p.generalUpgrades.includes('ctrl_z') && !p.ctrlZUsed) {
                   p.hp = p.maxHp * 0.3;
                   p.ctrlZUsed = true;
                   p.invincibleUntil = now + 2000;
                 }
               }
             }
           }
         });
         
         room.enemies.forEach(e => {
           const angle = Math.atan2(cy - e.y, cx - e.x);
           e.x += Math.cos(angle) * pullForce;
           e.y += Math.sin(angle) * pullForce;
         });
       }
 
       const spawnChance = 0.03 + (room.stage * 0.015) + (room.stageTimer / stageDuration) * 0.05;
       
-      const hpMult = room.stage >= 5 ? 1 + (room.stage - 5) * 0.5 : 1;
 
       if (room.stage >= 5 && room.stageTimer === 100) {
         const bossCount = room.stage === 5 ? 1 : Math.floor((room.stage - 4) / 2) + 1;
         for (let i = 0; i < bossCount; i++) {
           const spawner = currentMap.spawners[Math.floor(Math.random() * currentMap.spawners.length)];
           let bossHp = 3300 * Math.pow(1.12, room.stage - 5);
           let spawnX = spawner.x + (Math.random() - 0.5) * 200;
           let spawnY = spawner.y + (Math.random() - 0.5) * 200;
-          spawnX = Math.max(100, Math.min(currentMap.width - 100, spawnX));
-          spawnY = Math.max(100, Math.min(currentMap.height - 100, spawnY));
+          const halfW = 250;
+          const halfH = 40;
+          spawnX = Math.max(halfW + 10, Math.min(currentMap.width - halfW - 10, spawnX));
+          spawnY = Math.max(halfH + 10, Math.min(currentMap.height - halfH - 10, spawnY));
           room.enemies.push({
             id: room.enemyIdCounter++,
             type: 'EliteBoss',
             x: spawnX,
             y: spawnY,
             hp: bossHp,
             maxHp: bossHp,
             speed: 1.2 + Math.min(1.0, (room.stage - 5) * 0.05),
             text: '【项目方案_最终版_V18_打死不改版】',
             width: 500,
             height: 80,
             weight: 100,
             vx: 0, vy: 0, knockbackX: 0, knockbackY: 0,
             state: 'idle', stateTimer: 0, lastAttack: 0
           });
         }
       }
 
       if (room.enemies.length < 300 && Math.random() < spawnChance * timeSpeed) {
         const spawner = currentMap.spawners[Math.floor(Math.random() * currentMap.spawners.length)];
         const spawnCount = Math.floor(Math.random() * 3) + 1 + Math.floor(room.stage / 2);
         
         for(let i=0; i<spawnCount; i++) {
           let sx = spawner.x + (Math.random() - 0.5) * 100;
           let sy = spawner.y + (Math.random() - 0.5) * 100;
@@ -483,51 +532,51 @@ export default function App() {
               y + h/2 > obs.y && y - h/2 < obs.y + obs.h) {
             return true;
           }
         }
         for (const obs of room.dynamicObstacles) {
           if (x + w/2 > obs.x && x - w/2 < obs.x + obs.w && 
               y + h/2 > obs.y && y - h/2 < obs.y + obs.h) {
             return true;
           }
         }
         if (isPlayer) {
           // Removed FreezeCell aura collision check to prevent players from getting stuck
         }
         return false;
       };
 
       const p = room.players[myId];
       if (p && p.hp > 0) {
         if (p.hp < p.maxHp) {
           p.hp = Math.min(p.maxHp, p.hp + 0.3); // ~18 HP per second regen
         }
         
         let speedMultiplier = 1;
         
         if (p.attackForm === 'wordart') {
-          speedMultiplier *= 0.7; // -30% speed
+          speedMultiplier *= p.specificUpgrades.includes('wordart_all_caps') ? 0.9 : 0.7; // -10% or -30% speed //保留
           if (p.specificUpgrades.includes('wordart_shield')) {
             speedMultiplier *= 0.85; // Additional -10% (relative to base, but multiplying is fine, or subtract)
           }
         }
 
         let inFormatPaint = false;
         for (const puddle of room.puddles) {
           if (Math.hypot(p.x - puddle.x, p.y - puddle.y) < puddle.radius) {
             if (puddle.type === 'formatPaint') inFormatPaint = true;
           }
         }
         if (inFormatPaint) speedMultiplier *= 0.4;
         
         
         const speed = 6 * speedMultiplier;
         let dx = 0;
         let dy = 0;
         if (keys.current.w) dy -= speed;
         if (keys.current.s) dy += speed;
         if (keys.current.a) dx -= speed;
         if (keys.current.d) dx += speed;
 
         if (dx !== 0 && dy !== 0) {
           const length = Math.sqrt(dx * dx + dy * dy);
           dx = (dx / length) * speed;
@@ -536,77 +585,87 @@ export default function App() {
 
         if (!checkObstacleCollision(p.x + dx, p.y, 40, 20, true)) p.x += dx;
         if (!checkObstacleCollision(p.x, p.y + dy, 40, 20, true)) p.y += dy;
         
         p.x = Math.max(room.margin, Math.min(currentMap.width - room.margin, p.x));
         p.y = Math.max(room.margin, Math.min(currentMap.height - room.margin, p.y));
 
         for (let i = room.items.length - 1; i >= 0; i--) {
           const item = room.items[i];
           if (Math.hypot(p.x - item.x, p.y - item.y) < 50) {
             p.gridToolCharges = (p.gridToolCharges || 0) + 1;
             room.items.splice(i, 1);
             shake.current = 5;
           }
         }
 
         const canvas = canvasRef.current;
         if (canvas) {
           const screenX = canvas.width / 2;
           const screenY = canvas.height / 2;
           p.angle = Math.atan2(mouse.current.y - screenY, mouse.current.x - screenX);
         }
 
         const isShooting = mouse.current.isDown && !isSelectingGridRef.current && !showGridMenu && room.bulletTime <= 0;
 
+        if (p.attackForm === 'sparkline' && !isShooting) {
+          if ((p.laserCharge || 0) < 3 && now - (p.lastChargeTime || 0) > 1000) {
+            p.laserCharge = (p.laserCharge || 0) + 1;
+            p.lastChargeTime = now;
+          }
+        }
+
         if (isShooting && p.attackForm) {
           const form = p.attackForm;
           const specific = p.specificUpgrades;
           const general = p.generalUpgrades;
 
           let fireRate = 0;
           let bulletSpeed = 0;
           let damage = 0;
           let size = 0;
           let pierce = 1;
           let knockback = 0;
           let duration = 0;
 
           // Apply General Upgrades
           let damageMult = 1;
           let knockbackAdd = 0;
           let critChance = 0;
           let critMult = 1;
           let eliteDamageMult = 1;
+          let bulletSpeedMult = 1;
+          let fireRateMult = 1;
+          let commentKnockbackMult = 1;
 
           if (general.includes('bold')) {
             damageMult *= 1.3;
             knockbackAdd += 6;
           }
           if (general.includes('italic')) {
-            bulletSpeed *= 1.15;
-            fireRate *= 0.9;
+            bulletSpeedMult *= 1.15;
+            fireRateMult *= 0.9;
           }
           if (general.includes('strikethrough')) {
             pierce += 1;
             // Armor damage handled in collision if needed
           }
           if (general.includes('highlight')) {
             // Handled in collision
           }
           if (general.includes('rand')) {
             critChance = 0.15;
             critMult = 2.4;
           }
           if (general.includes('vlookup')) {
             eliteDamageMult = 1.15;
           }
           if (general.includes('sum')) {
             const sumBonus = Math.min(0.24, (p.sumKills || 0) * 0.03);
             damageMult *= (1 + sumBonus);
           }
 
           const isFormatPainter = general.includes('format_painter');
 
           const fireCtrlC = (baseDamage: number) => {
             if (general.includes('ctrl_c') && Math.random() < 0.2) {
               const angleOffset = (Math.random() - 0.5) * 0.5;
@@ -634,50 +693,53 @@ export default function App() {
 
           if (form === 'wordart') {
             fireRate = 1200;
             damage = 15;
             bulletSpeed = 6; // Slower, steady push
             size = 60; // Base size
             pierce = 999; // Infinite pierce
             knockback = 0; // Handled by bulldozer logic
             duration = 3000; // Increased range
 
             if (specific.includes('wordart_size')) {
               size *= 1.5;
               damageMult *= 1.25;
             }
             if (specific.includes('wordart_weight')) {
               bulletSpeed *= 1.5;
               damageMult *= 1.2;
             }
             if (specific.includes('wordart_fast_push')) {
               bulletSpeed *= 1.5;
             }
             if (specific.includes('wordart_shield')) {
               fireRate /= 0.8;
             }
 
+            fireRate *= fireRateMult;
+            bulletSpeed *= bulletSpeedMult;
+
             let wordWidth = size * 2.5;
             let wordHeight = size * 0.8;
 
             if (specific.includes('wordart_wide')) {
               wordWidth *= 2;
             }
 
             if (now - p.lastShot > fireRate) {
               p.lastShot = now;
               p.wordartCounter = (p.wordartCounter || 0) + 1;
               
               let isTitle = false;
               if (specific.includes('wordart_title') && p.wordartCounter % 3 === 0) {
                 isTitle = true;
                 damageMult *= 2.5;
                 wordWidth *= 1.8;
                 wordHeight *= 1.8;
               }
 
               let finalDamage = damage * damageMult;
               let isCrit = false;
               if (Math.random() < critChance) {
                 isCrit = true;
                 finalDamage *= critMult;
               }
@@ -685,258 +747,316 @@ export default function App() {
               room.bullets.push({
                 id: room.bulletIdCounter++,
                 owner: p.id,
                 x: p.x, y: p.y,
                 vx: Math.cos(p.angle) * bulletSpeed,
                 vy: Math.sin(p.angle) * bulletSpeed,
                 angle: p.angle, // Store angle for rectangle collision
                 damage: finalDamage,
                 size: size,
                 width: wordWidth,
                 height: wordHeight,
                 pierce: pierce,
                 life: duration,
                 maxLife: duration,
                 type: 'wordart',
                 isCrit: isCrit,
                 knockback: 0,
                 isTitle: isTitle,
                 isBulldozer: true, // Flag for bulldozer logic
                 isShield: specific.includes('wordart_shield'),
                 stunChance: specific.includes('wordart_stun') ? 0.5 : 0,
                 eliteDamageMult: eliteDamageMult,
                 isHighlight: general.includes('highlight'),
                 leavesResidue: general.includes('underline'),
                 isItalic: general.includes('italic'),
-                isStrikethrough: general.includes('strikethrough')
+                isStrikethrough: general.includes('strikethrough'),
+                typewriterScale: specific.includes('wordart_typewriter') ? 0.3 : undefined,
+                initialWidth: wordWidth,
+                initialHeight: wordHeight
               } as Bullet);
               
+              if (specific.includes('wordart_subscript')) {
+                room.bullets.push({
+                  id: room.bulletIdCounter++,
+                  owner: p.id,
+                  x: p.x, y: p.y + 60,
+                  vx: Math.cos(p.angle) * bulletSpeed,
+                  vy: Math.sin(p.angle) * bulletSpeed,
+                  angle: p.angle,
+                  damage: finalDamage * 0.4,
+                  size: size * 0.4,
+                  width: wordWidth * 0.4,
+                  height: wordHeight * 0.4,
+                  pierce: pierce,
+                  life: duration,
+                  maxLife: duration,
+                  type: 'wordart',
+                  isCrit: false,
+                  knockback: 0,
+                  isTitle: false,
+                  isBulldozer: true,
+                  isShield: specific.includes('wordart_shield'),
+                  stunChance: specific.includes('wordart_stun') ? 0.5 : 0,
+                  eliteDamageMult: eliteDamageMult,
+                  isHighlight: general.includes('highlight'),
+                  leavesResidue: general.includes('underline'),
+                  isItalic: general.includes('italic'),
+                  isStrikethrough: general.includes('strikethrough'),
+                  typewriterScale: specific.includes('wordart_typewriter') ? 0.3 : undefined,
+                  initialWidth: wordWidth * 0.4,
+                  initialHeight: wordHeight * 0.4
+                } as Bullet);
+              }
+
               fireCtrlC(finalDamage);
             }
           } else if (form === 'sparkline') {
             fireRate = 180; // High frequency
             damage = 18;
             let range = 3000; // Infinite range
             let width = 12;
             let isSlow = false;
 
             if (specific.includes('sparkline_width')) {
               width *= 1.5;
               damageMult *= 1.2;
             }
             if (specific.includes('sparkline_focus')) {
               isSlow = true;
             }
             if (specific.includes('sparkline_rapid')) {
               fireRate *= 0.6; // Very rapid
             }
             if (specific.includes('sparkline_overclock')) {
               fireRate *= 0.5;
             }
 
+            fireRate *= fireRateMult;
+
             if (now - p.lastShot > fireRate && now > (p.sparklineVacuumUntil || 0)) {
               p.lastShot = now;
               
               let finalDamage = damage * damageMult;
+              if (specific.includes('sparkline_charge')) {
+                finalDamage *= (1 + (p.laserCharge || 0) * 0.7);
+                p.laserCharge = 0;
+              }
               let isCrit = false;
               if (Math.random() < critChance) {
                 isCrit = true;
                 finalDamage *= critMult;
               }
 
               const createLaser = (angleOffset: number, dmgMult: number, extraWidth: number) => {
+                const laserWidthMult = general.includes('bold') ? 1.8 : 1;
                 room.lasers.push({
                   id: room.bulletIdCounter++,
                   owner: p.id,
                   x: p.x, y: p.y,
                   angle: p.angle + angleOffset,
                   damage: finalDamage * dmgMult,
-                  width: width + extraWidth,
+                  width: (width + extraWidth) * laserWidthMult,
                   range: range,
                   life: 15,
                   maxLife: 15,
                   type: 'sparkline',
                   isCrit: isCrit,
                   eliteDamageMult: eliteDamageMult,
                   isSlow: isSlow,
                   bouncesLeft: specific.includes('sparkline_bounce') ? 3 : (specific.includes('sparkline_reflect') ? 1 : 0),
                   isHighlight: general.includes('highlight'),
                   leavesResidue: general.includes('underline'),
                   isItalic: general.includes('italic'),
                   isStrikethrough: general.includes('strikethrough'),
                   stunChance: specific.includes('sparkline_freeze') ? 0.05 : 0
                 } as Laser);
               };
 
               createLaser(0, 1, specific.includes('sparkline_ult') ? width * 0.8 : 0); // Increased ult width
               
               if (specific.includes('sparkline_ult')) {
                 createLaser(12 * Math.PI / 180, 0.6, 0); // Increased side laser damage
                 createLaser(-12 * Math.PI / 180, 0.6, 0);
               }
               
               fireCtrlC(finalDamage);
             }
           } else if (form === 'comment') {
             fireRate = 600;
             damage = 50;
             bulletSpeed = 11.5; // 230px/s approx
-            let explosionRadius = 100;
+            let explosionRadius = 110;
             let count = 1;
 
             if (specific.includes('comment_size')) {
-              explosionRadius *= 1.3;
-              damageMult *= 1.2;
+              explosionRadius *= 1.5;
+              damageMult *= 1.25;
             }
             if (specific.includes('comment_fast')) {
               fireRate *= 0.7;
               bulletSpeed *= 1.2;
             }
             if (specific.includes('comment_triple')) {
               count = 3;
               fireRate /= 0.8;
             }
             if (specific.includes('comment_knockback')) {
-              knockbackMult = (knockbackMult || 1) * 2;
+              commentKnockbackMult *= 2;
             }
 
-            explosionRadius = Math.min(explosionRadius, 160);
+            explosionRadius = Math.min(explosionRadius, 220); //保留
+            fireRate *= fireRateMult;
+            bulletSpeed *= bulletSpeedMult;
 
             if (now - p.lastShot > fireRate) {
               p.lastShot = now;
               p.commentCounter = (p.commentCounter || 0) + 1;
               
               let isUlt = false;
               if (specific.includes('comment_ult') && p.commentCounter % 4 === 0) {
                 isUlt = true;
                 damage = 90;
-                explosionRadius = 160;
+                explosionRadius = 220;
               }
 
               let finalDamage = damage * damageMult;
               let isCrit = false;
               if (Math.random() < critChance) {
                 isCrit = true;
                 finalDamage *= critMult;
               }
 
               for (let i = 0; i < count; i++) {
                 const angleOffset = count > 1 ? (i - 1) * 0.2 : 0;
                 room.bullets.push({
                   id: room.bulletIdCounter++,
                   owner: p.id,
                   x: p.x, y: p.y,
                   vx: Math.cos(p.angle + angleOffset) * bulletSpeed,
                   vy: Math.sin(p.angle + angleOffset) * bulletSpeed,
                   damage: finalDamage,
                   size: 20,
                   pierce: pierce,
                   life: 3000, // Max flight time
                   maxLife: 3000,
                   type: 'comment',
                   isCrit: isCrit,
+                  knockback: 15 * commentKnockbackMult,
                   explosionRadius: explosionRadius,
                   isUlt: isUlt,
                   eliteDamageMult: eliteDamageMult,
                   splitsLeft: specific.includes('comment_split') ? 1 : 0,
                   isHighlight: general.includes('highlight'),
                   leavesResidue: general.includes('underline') || specific.includes('comment_black'),
                   isItalic: general.includes('italic'),
                   isStrikethrough: general.includes('strikethrough')
                 } as Bullet);
               }
               
               fireCtrlC(finalDamage);
             }
           } else if (form === 'array') {
             fireRate = 150;
             damage = 25;
             bulletSpeed = 18; // 360px/s approx
             let count = 1;
             let spreadAngle = 14 * Math.PI / 180;
             let bSize = 24;
 
             if (specific.includes('array_count')) {
               count += 2;
               spreadAngle += 6 * Math.PI / 180;
             }
             if (specific.includes('array_plus_2')) {
               count += 2;
               spreadAngle += 6 * Math.PI / 180;
             }
             if (specific.includes('array_fast')) {
               fireRate *= 0.82;
               bulletSpeed *= 1.15;
             }
             if (specific.includes('array_rapid')) {
               fireRate /= 1.5;
             }
             if (specific.includes('array_pierce')) {
               pierce = 999;
             }
             if (specific.includes('array_big')) {
               bSize *= 2;
             }
 
             count = Math.min(count, 8);
+            fireRate *= fireRateMult;
+            bulletSpeed *= bulletSpeedMult;
 
             if (now - p.lastShot > fireRate) {
               p.lastShot = now;
               
               let finalDamage = damage * damageMult;
+              if (specific.includes('array_single')) {
+                const originalCount = count;
+                count = 1;
+                finalDamage *= originalCount * 0.8;
+                bulletSpeed *= 1.5;
+              }
               let isCrit = false;
               if (Math.random() < critChance) {
                 isCrit = true;
                 finalDamage *= critMult;
               }
 
               const startAngle = p.angle - spreadAngle / 2;
               const angleStep = count > 1 ? spreadAngle / (count - 1) : 0;
 
               for (let i = 0; i < count; i++) {
                 const angle = startAngle + i * angleStep;
                 room.bullets.push({
                   id: room.bulletIdCounter++,
                   owner: p.id,
                   x: p.x, y: p.y,
                   vx: Math.cos(angle) * bulletSpeed,
                   vy: Math.sin(angle) * bulletSpeed,
                   damage: finalDamage,
                   size: bSize,
                   pierce: pierce,
                   life: 1500,
                   maxLife: 1500,
                   type: 'array',
                   isCrit: isCrit,
                   eliteDamageMult: eliteDamageMult,
                   splitsLeft: specific.includes('array_split') ? 1 : 0,
                   bouncesLeft: specific.includes('array_bounce') ? 1 : 0,
                   trackRadius: specific.includes('array_track') ? 160 : 0,
                   isHighlight: general.includes('highlight'),
                   leavesResidue: general.includes('underline'),
                   isItalic: general.includes('italic'),
-                  isStrikethrough: general.includes('strikethrough')
+                  isStrikethrough: general.includes('strikethrough'),
+                  initialAngle: p.angle,
+                  travelDist: 0,
+                  ricochetSpeed: bulletSpeed,
+                  ricochetPierce: 0
                 } as Bullet);
               }
               
               fireCtrlC(finalDamage);
             }
           }
         }
         
         // Handle Ultimates and passive effects
         if (p.attackForm === 'wordart' && p.specificUpgrades.includes('wordart_ult')) {
           if (now - (p.lastWordartUlt || 0) > 5000) {
             p.lastWordartUlt = now;
             room.bullets.push({
               id: room.bulletIdCounter++,
               owner: p.id,
               x: p.x, y: p.y,
               vx: Math.cos(p.angle) * 8, // Slower push
               vy: Math.sin(p.angle) * 8,
               angle: p.angle,
               damage: 150,
               size: 450, // Massive width
               width: 450 * 2.5,
               height: 450 * 0.8,
               pierce: 999,
               life: 2000,
@@ -981,131 +1101,139 @@ export default function App() {
                 knockback: 0,
                 isTitle: true,
                 isBulldozer: true,
                 isShield: p.specificUpgrades.includes('wordart_shield'),
                 stunChance: p.specificUpgrades.includes('wordart_stun') ? 0.5 : 0,
                 leavesResidue: p.generalUpgrades.includes('underline'),
                 eliteDamageMult: 1.5,
                 isHighlight: p.generalUpgrades.includes('highlight'),
                 isItalic: p.generalUpgrades.includes('italic'),
                 isStrikethrough: p.generalUpgrades.includes('strikethrough')
               });
             }
           }
         }
 
         if (p.attackForm === 'sparkline' && p.specificUpgrades.includes('sparkline_cannon')) {
           if (now - (p.lastSparklineCannon || 0) > 30000) {
             p.lastSparklineCannon = now;
             p.sparklineVacuumUntil = now + 1500; // 1.5s cooldown for normal lasers
             room.lasers.push({
               id: room.bulletIdCounter++,
               owner: p.id,
               x: p.x, y: p.y,
               angle: p.angle,
               damage: 9999, // High damage
-              width: 150, // Very wide
+              width: p.generalUpgrades.includes('bold') ? 220 : 150, // Very wide
               range: 5000,
               life: 30, // 0.5s duration
               maxLife: 30,
               type: 'sparkline',
               isCrit: true,
               eliteDamageMult: 1,
               isSlow: false,
               bouncesLeft: 0,
               isCannon: true,
               isHighlight: p.generalUpgrades.includes('highlight'),
               leavesResidue: p.generalUpgrades.includes('underline'),
               isItalic: p.generalUpgrades.includes('italic'),
               isStrikethrough: p.generalUpgrades.includes('strikethrough')
             } as Laser);
             shake.current = 30;
           }
         }
 
         if (p.attackForm === 'comment' && p.specificUpgrades.includes('comment_super')) {
           if (now - (p.lastCommentSuper || 0) > 30000) {
             p.lastCommentSuper = now;
             room.bullets.push({
               id: room.bulletIdCounter++,
               owner: p.id,
               x: p.x, y: p.y,
               vx: Math.cos(p.angle) * 8,
               vy: Math.sin(p.angle) * 8,
               damage: 500,
               size: 60,
               pierce: 1,
               life: 3000,
               maxLife: 3000,
               type: 'comment',
               isCrit: true,
+              knockback: 24,
               explosionRadius: 400,
               isSuper: true,
               eliteDamageMult: 1.5,
               splitsLeft: 0,
               isHighlight: p.generalUpgrades.includes('highlight'),
               leavesResidue: p.generalUpgrades.includes('underline'),
               isItalic: p.generalUpgrades.includes('italic'),
               isStrikethrough: p.generalUpgrades.includes('strikethrough')
             } as Bullet);
           }
         }
 
         if (p.attackForm === 'array' && p.specificUpgrades.includes('array_ult')) {
           if (now - (p.lastArrayUlt || 0) > 3000) {
             p.lastArrayUlt = now;
             for (let i = 0; i < 16; i++) {
               const angle = (i / 16) * Math.PI * 2;
               room.bullets.push({
                 id: room.bulletIdCounter++,
                 owner: p.id,
                 x: p.x, 
                 y: p.y,
                 vx: Math.cos(angle) * 18,
                 vy: Math.sin(angle) * 18,
                 damage: 6,
                 size: 12,
                 pierce: 1,
                 life: 1500,
                 maxLife: 1500,
                 type: 'array',
                 isCrit: false,
                 eliteDamageMult: 1,
                 splitsLeft: 0,
                 trackRadius: 160,
                 isHighlight: p.generalUpgrades.includes('highlight'),
                 leavesResidue: p.generalUpgrades.includes('underline'),
                 isItalic: p.generalUpgrades.includes('italic'),
                 isStrikethrough: p.generalUpgrades.includes('strikethrough')
               });
             }
           }
         }
       }
 
       for (let i = room.enemies.length - 1; i >= 0; i--) {
         const e = room.enemies[i];
+
+        if (e.type === 'SplitCell') {
+          e.stateTimer = (e.stateTimer || 0) - timeSpeed;
+          if ((e.stateTimer || 0) <= 0) {
+            e.hp = 0;
+          }
+        }
         
         if (e.state === 'stunned') {
           e.stateTimer = (e.stateTimer || 0) - timeSpeed;
           e.vx = 0;
           e.vy = 0;
           if (e.stateTimer <= 0) {
             e.state = 'idle';
           }
         }
         
         let nearestP = null;
         let minDist = Infinity;
         if (p && p.hp > 0) {
           const d = Math.hypot(p.x - e.x, p.y - e.y);
           if (d < minDist) {
             minDist = d;
             nearestP = p;
           }
         }
 
         if (nearestP && e.state !== 'stunned') {
           const angle = Math.atan2(nearestP.y - e.y, nearestP.x - e.x);
           e.facingAngle = angle;
 
           if (e.type === 'Value') {
@@ -1362,109 +1490,126 @@ export default function App() {
                 e.vx = 0; e.vy = 0;
               }
               if (e.stateTimer <= 0 && nearestP) {
                 e.state = 'aiming';
                 e.stateTimer = 120; // 2 seconds aim
                 e.dashTargetX = nearestP.x;
                 e.dashTargetY = nearestP.y;
                 e.vx = 0; e.vy = 0;
               }
             } else if (e.state === 'aiming') {
               e.vx = 0; e.vy = 0;
               if (nearestP && e.stateTimer > 60) {
                 // Track player for first 1 second
                 e.dashTargetX = nearestP.x;
                 e.dashTargetY = nearestP.y;
               }
               if (e.stateTimer <= 0) {
                 e.state = 'idle';
                 e.stateTimer = 180; // 3 seconds cooldown
                 const ba = Math.atan2((e.dashTargetY || e.y) - e.y, (e.dashTargetX || e.x) - e.x);
                 room.enemyBullets.push({ id: room.enemyBulletIdCounter++, x: e.x, y: e.y, vx: Math.cos(ba) * 15, vy: Math.sin(ba) * 15, damage: 30, life: 300, size: 15, type: 'vlookup' });
               }
             }
           } else if (e.type === 'MACRO') {
             e.stateTimer = (e.stateTimer || 0) - timeSpeed;
-            // Run away
-            e.vx = -Math.cos(angle) * e.speed;
-            e.vy = -Math.sin(angle) * e.speed;
+
+            const desiredMin = 320;
+            const desiredMax = 620;
+            let macroSpeed = 2.2;
+            if (minDist < desiredMin) {
+              macroSpeed = 5.8;
+              e.vx = -Math.cos(angle) * macroSpeed;
+              e.vy = -Math.sin(angle) * macroSpeed;
+            } else if (minDist > desiredMax) {
+              macroSpeed = 1.8;
+              e.vx = Math.cos(angle) * macroSpeed;
+              e.vy = Math.sin(angle) * macroSpeed;
+            } else {
+              const strafe = angle + Math.PI / 2;
+              e.vx = Math.cos(strafe) * 1.2;
+              e.vy = Math.sin(strafe) * 1.2;
+            }
+
             if (e.stateTimer <= 0) {
-              e.stateTimer = 240;
-              // Summon minions
-              for (let k = 0; k < 5; k++) {
-                const ba = (Math.PI * 2 / 5) * k;
-                const sx = e.x + Math.cos(ba) * 50;
-                const sy = e.y + Math.sin(ba) * 50;
-                room.enemies.push({
-                  id: room.enemyIdCounter++, x: sx, y: sy, hp: 10, maxHp: 10, type: 'MINION',
-                  vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, text: '💣', width: 30, height: 30, speed: 3.0, weight: 1,
-                  state: 'idle', stateTimer: 0, lastAttack: 0
-                });
+              e.stateTimer = 180;
+              const bombMinions = room.enemies.filter(en => en.type === 'MINION').length;
+              const canSummon = Math.max(0, 4 - bombMinions);
+              if (canSummon > 0) {
+                const spawnNum = Math.min(canSummon, 2);
+                for (let k = 0; k < spawnNum; k++) {
+                  const ba = (Math.PI * 2 / Math.max(1, spawnNum)) * k + Math.random() * 0.4;
+                  const sx = e.x + Math.cos(ba) * 40;
+                  const sy = e.y + Math.sin(ba) * 40;
+                  room.enemies.push({
+                    id: room.enemyIdCounter++, x: sx, y: sy, hp: 8, maxHp: 8, type: 'MINION',
+                    vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, text: 'ERR', width: 28, height: 28, speed: 3.4, weight: 1,
+                    state: 'idle', stateTimer: 0, lastAttack: 0
+                  });
+                }
               }
             }
           } else if (e.type === 'MINION') {
             e.vx = Math.cos(angle) * e.speed;
             e.vy = Math.sin(angle) * e.speed;
             if (minDist < 50) {
-              // Explode
               e.hp = 0;
-              room.puddles.push({ id: room.puddleIdCounter++, x: e.x, y: e.y, radius: 80, type: 'explosion', life: 30, maxLife: 30 });
-              if (nearestP && minDist < 80) {
-                nearestP.hp -= 20;
+              room.puddles.push({ id: room.puddleIdCounter++, x: e.x, y: e.y, radius: 70, type: 'burn_slow', life: 6, maxLife: 6, damage: 0.2 });
+              if (nearestP && minDist < 70) {
+                nearestP.hp -= 2;
               }
             }
           } else {
             e.vx = Math.cos(angle) * e.speed;
             e.vy = Math.sin(angle) * e.speed;
           }
         } else {
           e.vx = 0;
           e.vy = 0;
         }
 
         // Add collision avoidance between enemies
         for (let j = 0; j < room.enemies.length; j++) {
           if (i !== j) {
             const other = room.enemies[j];
             const dx = e.x - other.x;
             const dy = e.y - other.y;
             const dist = Math.hypot(dx, dy);
             const minDist = (e.width + other.width) / 2;
             if (dist < minDist && dist > 0) {
               const pushForce = (minDist - dist) / minDist * 0.5;
               e.vx += (dx / dist) * pushForce;
               e.vy += (dy / dist) * pushForce;
             }
           }
         }
 
         let enemySpeedMult = 1;
         for (const puddle of room.puddles) {
           if (Math.hypot(e.x - puddle.x, e.y - puddle.y) < puddle.radius + e.width/2) {
             if (puddle.type === 'burn_slow') enemySpeedMult = Math.min(enemySpeedMult, 0.2);
             else if (puddle.type === 'formatPaint') enemySpeedMult = Math.min(enemySpeedMult, 0.4);
-            else if (puddle.type === 'slow_zone') enemySpeedMult = Math.min(enemySpeedMult, 0.1);
           }
         }
 
         let moveX = (e.vx * enemySpeedMult * timeSpeed * (room.activeEvent === 'OOM' ? 0.5 : 1)) + e.knockbackX;
         let moveY = (e.vy * enemySpeedMult * timeSpeed * (room.activeEvent === 'OOM' ? 0.5 : 1)) + e.knockbackY;
         
         e.knockbackX *= 0.8;
         e.knockbackY *= 0.8;
 
         if (!checkObstacleCollision(e.x + moveX, e.y, e.width, e.height)) e.x += moveX;
         if (!checkObstacleCollision(e.x, e.y + moveY, e.width, e.height)) e.y += moveY;
 
         if (nearestP && minDist < (e.width/2 + 20)) {
           if (now > nearestP.invincibleUntil) {
             const wasAlive = nearestP.hp > 0;
             nearestP.hp -= (e.type === 'EliteBoss' ? 10 : e.type === 'MiniBoss' ? 5 : 2) * timeSpeed;
             if (wasAlive && nearestP.hp <= 0) nearestP.deaths++;
           }
         }
 
         if (e.hp <= 0) {
           // Find the player who killed the enemy (simplified to nearest player for now)
           const killer = nearestP;
           if (killer) {
             killer.kills++;
@@ -1472,223 +1617,319 @@ export default function App() {
               killer.sumKills = (killer.sumKills || 0) + 1;
               if (killer.sumKills >= 10) {
                 killer.sumKills = 0;
                 killer.sumStacks = (killer.sumStacks || 0) + 1;
                 
                 const overflow = Math.max(0, killer.sumStacks - 20);
                 killer.knockbackMult = 1 + Math.sqrt(overflow) * 0.1;
                 killer.sizeMult = 1 + Math.sqrt(overflow) * 0.05;
                 killer.eliteDamageMult = 1 + Math.sqrt(overflow) * 0.1;
               }
             }
           }
           
           if (e.type === 'MergedCell') {
             if (nearestP && Math.hypot(nearestP.x - e.x, nearestP.y - e.y) < 600) {
               shake.current = Math.max(shake.current, 15);
             }
             for (let k = 0; k < 4; k++) {
               const angle = (Math.PI / 2) * k + Math.random();
               room.enemies.push({
                 id: room.enemyIdCounter++,
                 x: e.x + Math.cos(angle) * 20,
                 y: e.y + Math.sin(angle) * 20,
                 hp: 15 * room.stage, maxHp: 15 * room.stage, type: 'SplitCell', text: '单元格', width: 30, height: 20, speed: 2.5,
                 vx: 0, vy: 0, knockbackX: Math.cos(angle) * 10, knockbackY: Math.sin(angle) * 10,
-                state: 'idle', stateTimer: 0, lastAttack: 0,
+                state: 'idle', stateTimer: 600, lastAttack: 0,
                 weight: 1
               });
             }
           }
 
           if ((e.type === 'Elite' && Math.random() < 0.15) || e.type === 'MiniBoss' || e.type === 'EliteBoss') {
             room.items.push({ id: room.itemIdCounter++, x: e.x, y: e.y, type: 'GridTool' });
           }
           room.enemies.splice(i, 1);
         }
       }
 
       for (let i = 0; i < room.enemies.length; i++) {
         const e1 = room.enemies[i];
         for (let j = i + 1; j < room.enemies.length; j++) {
           const e2 = room.enemies[j];
           const dx = e1.x - e2.x;
           const dy = e1.y - e2.y;
           const distSq = dx * dx + dy * dy;
           
           const r1 = (e1.width + e1.height) / 4;
           const r2 = (e2.width + e2.height) / 4;
           const minDist = r1 + r2;
           
           if (distSq < minDist * minDist && distSq > 0.1) {
             const dist = Math.sqrt(distSq);
             const overlap = minDist - dist;
             const forceX = (dx / dist) * overlap * 0.5;
             const forceY = (dy / dist) * overlap * 0.5;
             
             e1.x += forceX;
             e1.y += forceY;
             e2.x -= forceX;
             e2.y -= forceY;
           }
         }
       }
 
+      if (room.stageTimer % 60 === 0) {
+        room.enemies.forEach(e => {
+          if ((e.burnStacks || 0) > 0) {
+            e.hp -= (e.burnStacks || 0) * 5;
+            if (Math.random() < 0.04) {
+              e.burnStacks = Math.max(0, (e.burnStacks || 0) - 1);
+            }
+          }
+        });
+      }
+
+      if (p && p.hp > 0 && p.specificUpgrades.includes('array_orbit')) {
+        p.orbitAngle = ((p.orbitAngle || 0) + 0.06) % (Math.PI * 2);
+        for (let oi = 0; oi < 8; oi++) {
+          const a = (p.orbitAngle || 0) + oi * Math.PI / 4;
+          const ox = p.x + Math.cos(a) * 55;
+          const oy = p.y + Math.sin(a) * 55;
+          for (const e of room.enemies) {
+            if (Math.hypot(e.x - ox, e.y - oy) < 18) {
+              e.hp -= 5;
+              const pushAngle = Math.atan2(e.y - oy, e.x - ox);
+              e.knockbackX += Math.cos(pushAngle) * 4;
+              e.knockbackY += Math.sin(pushAngle) * 4;
+            }
+          }
+        }
+      }
+
       for (let i = room.bullets.length - 1; i >= 0; i--) {
         const b = room.bullets[i];
+        const ownerPlayer = room.players[b.owner];
+        const ownerSpecific = ownerPlayer?.specificUpgrades || [];
+
+        if (b.typewriterScale !== undefined && b.initialWidth && b.initialHeight) {
+          b.typewriterScale = Math.min(2.0, b.typewriterScale + (2.0 - 0.3) / Math.max(1, b.maxLife));
+          b.width = b.initialWidth * b.typewriterScale;
+          b.height = b.initialHeight * b.typewriterScale;
+          b.size = Math.max(b.width, b.height);
+        }
+
+        if (b.type === 'array' && ownerSpecific.includes('array_converge')) {
+          b.travelDist = (b.travelDist || 0) + Math.hypot(b.vx, b.vy);
+          if ((b.travelDist || 0) > 300 && b.initialAngle !== undefined) {
+            const curAngle = Math.atan2(b.vy, b.vx);
+            let diff = b.initialAngle - curAngle;
+            while (diff > Math.PI) diff -= Math.PI * 2;
+            while (diff < -Math.PI) diff += Math.PI * 2;
+            const spd = Math.hypot(b.vx, b.vy);
+            const newAngle = curAngle + diff * 0.04;
+            b.vx = Math.cos(newAngle) * spd;
+            b.vy = Math.sin(newAngle) * spd;
+          }
+        }
         
         if (b.trackRadius && b.trackRadius > 0) {
           let nearestE = null;
           let minDist = b.trackRadius;
           for (const e of room.enemies) {
             const d = Math.hypot(b.x - e.x, b.y - e.y);
             if (d < minDist) { minDist = d; nearestE = e; }
           }
           if (nearestE) {
             const targetAngle = Math.atan2(nearestE.y - b.y, nearestE.x - b.x);
             const currentAngle = Math.atan2(b.vy, b.vx);
             const speed = Math.hypot(b.vx, b.vy);
             let angleDiff = targetAngle - currentAngle;
             while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
             while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
             const newAngle = currentAngle + angleDiff * 0.08;
             b.vx = Math.cos(newAngle) * speed;
             b.vy = Math.sin(newAngle) * speed;
           }
         }
         
         b.x += b.vx * timeSpeed;
         b.y += b.vy * timeSpeed;
         b.life -= timeSpeed;
 
+        if (b.type === 'comment' && ownerSpecific.includes('comment_proximity')) {
+          for (const e of room.enemies) {
+            if (Math.hypot(b.x - e.x, b.y - e.y) < 40) {
+              b.life = 0;
+              break;
+            }
+          }
+        }
+
         if (b.life <= 0) {
           if (b.type === 'comment') {
+            const hitCount = room.enemies.filter(e => Math.hypot(e.x - b.x, e.y - b.y) < (b.explosionRadius || 70) + e.width/2).length;
+            const densityMult = ownerSpecific.includes('comment_density') ? (1 + Math.min(5, Math.max(0, hitCount - 1)) * 0.15) : 1;
+
             room.enemies.forEach(e => {
               if (Math.hypot(e.x - b.x, e.y - b.y) < (b.explosionRadius || 70) + e.width/2) {
                 let finalDamage = b.damage;
+                finalDamage *= densityMult;
                 if (e.type === 'EliteBoss' || e.type === 'MiniBoss' || e.type === 'Elite') {
                   finalDamage *= (b.eliteDamageMult || 1);
                 }
+
+                if (e.commentMark && Date.now() < e.commentMark) {
+                  finalDamage *= 1.8;
+                  e.commentMark = 0;
+                }
+
+                if (e.revisionMark && Date.now() < e.revisionMark) {
+                  finalDamage *= 1.35;
+                }
                 
                 if (b.isSuper && e.type !== 'EliteBoss' && e.type !== 'MiniBoss') {
                   e.hp = 0;
                 } else {
                   e.hp -= finalDamage;
                 }
                 
                 // Explosion knockback
                 const angle = Math.atan2(e.y - b.y, e.x - b.x);
                 let kbResist = e.isBuffed ? 0.2 : 0.8;
                 kbResist /= (e.weight || 1);
-                e.vx += Math.cos(angle) * 15 * kbResist;
-                e.vy += Math.sin(angle) * 15 * kbResist;
+                const explosionKb = b.knockback || 15;
+                e.vx += Math.cos(angle) * explosionKb * kbResist;
+                e.vy += Math.sin(angle) * explosionKb * kbResist;
                 
                 // comment_chain logic
                 if (e.hp <= 0) {
                   const ownerPlayer = room.players[b.owner];
                   if (ownerPlayer && ownerPlayer.specificUpgrades.includes('comment_chain') && Math.random() < 0.5) {
                     if ((b.chainDepth || 0) < 3) { // Limit chain depth to prevent infinite loops
                       room.bullets.push({
                         ...b,
                         id: room.bulletIdCounter++,
                         x: e.x, y: e.y,
                         life: 0, // Explode immediately next frame
                         maxLife: 0,
                         damage: b.damage * 0.5,
                         explosionRadius: (b.explosionRadius || 70) * 0.8,
                         splitsLeft: 0,
                         chainDepth: (b.chainDepth || 0) + 1,
                         hitTargets: new Set()
                       });
                     }
                   }
                 }
               }
             });
+
+            if (ownerSpecific.includes('comment_mark')) {
+              room.enemies.forEach(e => {
+                if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < (b.explosionRadius || 70) + e.width/2) {
+                  e.commentMark = Date.now() + 4000;
+                }
+              });
+            }
+
+            if (hitCount > 0 && ownerSpecific.includes('comment_battery') && ownerPlayer) {
+              ownerPlayer.hp = Math.min(ownerPlayer.maxHp, ownerPlayer.hp + ownerPlayer.maxHp * 0.02);
+            }
             
             // Visual explosion puddle
             room.puddles.push({
               id: room.puddleIdCounter++, x: b.x, y: b.y, radius: b.explosionRadius || 70, type: 'explosion', life: 30, maxLife: 30, damage: 0, owner: b.owner
             });
             
             // Lingering effect puddle
             if (!b.isSuper && !b.leavesResidue) {
               room.puddles.push({
                 id: room.puddleIdCounter++, x: b.x, y: b.y, radius: (b.explosionRadius || 70) * 0.8, type: 'highlight', life: 180, maxLife: 180, damage: b.damage * 0.2, owner: b.owner
               });
             }
             
             if (b.isSuper || b.leavesResidue) { // comment_black or underline
               room.puddles.push({
-                id: room.puddleIdCounter++, x: b.x, y: b.y, radius: (b.explosionRadius || 70) * 0.8, type: 'burn_slow', life: 300, maxLife: 300, damage: b.damage * 0.1, owner: b.owner
+                id: room.puddleIdCounter++, x: b.x, y: b.y, radius: (b.explosionRadius || 70) * 1.15, type: 'burn_slow', life: 360, maxLife: 360, damage: b.damage * 0.14, owner: b.owner //保留
               });
               room.puddles.push({
                 id: room.puddleIdCounter++, x: b.x, y: b.y, radius: (b.explosionRadius || 70) * 0.8, type: 'blacken', life: 600, maxLife: 600, damage: 0, owner: b.owner
               });
             }
             
             if (b.splitsLeft && b.splitsLeft > 0) {
               for (let j = 0; j < 3; j++) {
                 const angle = Math.random() * Math.PI * 2;
                 const speed = 8 + Math.random() * 4;
                 room.bullets.push({
                   ...b,
                   id: room.bulletIdCounter++,
                   x: b.x, y: b.y,
                   vx: Math.cos(angle) * speed,
                   vy: Math.sin(angle) * speed,
                   damage: b.damage * 0.4,
                   explosionRadius: (b.explosionRadius || 70) * 0.6,
                   size: b.size * 0.6,
                   life: 30 + Math.random() * 20,
                   maxLife: 50,
                   splitsLeft: 0,
                   chainDepth: 99, // Prevent chain from triggering on split bullets to avoid crazy loops
                   pierce: 1,
                   hitTargets: new Set()
                 });
               }
             }
             
             shake.current = Math.max(shake.current, b.isUlt ? 20 : 10);
           } else if (b.type === 'wordart' && b.leavesResidue) {
             room.puddles.push({
               id: room.puddleIdCounter++, x: b.x, y: b.y, radius: b.size, type: 'highlight', life: 180, maxLife: 180, damage: b.damage * 0.3, owner: b.owner
             });
           }
           room.bullets.splice(i, 1);
           continue;
         }
 
         let hitEnemy = false;
         for (const e of room.enemies) {
           if (e.hp <= 0) continue;
           if (!b.isBulldozer && b.hitTargets && b.hitTargets.has(e.id)) continue;
 
           let isHit = false;
-          if (b.type === 'wordart' && b.width && b.height) {
-            // WordArt is always horizontal now, so simple AABB collision
+          if (b.type === 'wordart' && b.width && b.height && b.angle !== undefined) { //保留
+            const dx = e.x - b.x;
+            const dy = e.y - b.y;
+            const cos = Math.cos(-b.angle);
+            const sin = Math.sin(-b.angle);
+            const rx = dx * cos - dy * sin;
+            const ry = dx * sin + dy * cos;
+
+            if (Math.abs(rx) < b.width/2 + e.width/2 && Math.abs(ry) < b.height/2 + e.height/2) {
+              isHit = true;
+            }
+          } else if (b.type === 'wordart' && b.width && b.height) {
             if (Math.abs(b.x - e.x) < b.width/2 + e.width/2 && Math.abs(b.y - e.y) < b.height/2 + e.height/2) {
               isHit = true;
             }
           } else if (b.width && b.height && b.angle !== undefined) {
             const dx = e.x - b.x;
             const dy = e.y - b.y;
             const cos = Math.cos(-b.angle);
             const sin = Math.sin(-b.angle);
             const rx = dx * cos - dy * sin;
             const ry = dx * sin + dy * cos;
             
             if (Math.abs(rx) < b.width/2 + e.width/2 && Math.abs(ry) < b.height/2 + e.height/2) {
               isHit = true;
             }
           } else if (b.isBulldozer && b.angle !== undefined) {
             const dx = e.x - b.x;
             const dy = e.y - b.y;
             const cos = Math.cos(-b.angle);
             const sin = Math.sin(-b.angle);
             const rx = dx * cos - dy * sin;
             const ry = dx * sin + dy * cos;
             
             if (Math.abs(rx) < 20 + e.width/2 && Math.abs(ry) < b.size/2 + e.height/2) {
               isHit = true;
             }
@@ -1698,69 +1939,87 @@ export default function App() {
             }
           }
 
           if (isHit) {
             if (!b.hitTargets) b.hitTargets = new Set();
             const firstHit = !b.hitTargets.has(e.id);
             b.hitTargets.add(e.id);
 
             if (firstHit) {
               let finalDamage = b.damage;
               
               if (e.type === 'ProtectedView' && e.facingAngle !== undefined) {
                 const angleToBullet = Math.atan2(b.y - e.y, b.x - e.x);
                 let angleDiff = Math.abs(angleToBullet - e.facingAngle);
                 if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                 
                 if (angleDiff < Math.PI / 3 && b.type !== 'wordart') {
                   finalDamage *= 0.1; 
                 }
               }
               
               if (e.type === 'EliteBoss' || e.type === 'MiniBoss' || e.type === 'Elite') {
                 finalDamage *= (b.eliteDamageMult || 1);
               }
 
+              if (e.revisionMark && Date.now() < e.revisionMark) {
+                finalDamage *= 1.35;
+              }
+
               const inHighlight = room.puddles.some(p => p.type === 'highlight' && Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.width/2);
               if (inHighlight) {
                 finalDamage *= 1.5;
               }
 
               e.hp -= finalDamage;
+
+              if (b.type === 'wordart' && ownerSpecific.includes('wordart_revision') && (e.type === 'Elite' || e.type === 'MiniBoss' || e.type === 'EliteBoss')) {
+                e.revisionMark = Date.now() + 5000;
+              }
               
               if (b.isStrikethrough && e.hp > 0 && e.hp / e.maxHp <= 0.2 && e.type !== 'EliteBoss' && e.type !== 'MiniBoss') {
                 e.hp = 0;
                 const deathTexts = ['DELETE', 'KILL', 'GG.EXE'];
                 particles.current.push({
                   x: e.x, y: e.y, vx: 0, vy: -1, life: 30, text: deathTexts[Math.floor(Math.random() * deathTexts.length)], color: '#ff0000'
                 });
               }
               
               if (e.hp > 0 && b.stunChance && Math.random() < b.stunChance) {
                 e.state = 'stunned';
                 e.stateTimer = 60; // 1s
               }
+
+              if (e.hp <= 0 && b.type === 'array' && ownerSpecific.includes('array_ricochet')) {
+                b.ricochetPierce = Math.min(3, (b.ricochetPierce || 0) + 1);
+                b.pierce += 1;
+                const spd = Math.hypot(b.vx, b.vy) || 1;
+                const baseSpd = b.ricochetSpeed || spd;
+                const newSpd = Math.min(spd * 1.2, baseSpd * Math.pow(1.2, 3));
+                b.vx = (b.vx / spd) * newSpd;
+                b.vy = (b.vy / spd) * newSpd;
+              }
               
               shake.current = Math.max(shake.current, 2);
               
               for(let i=0; i<3; i++) {
                 particles.current.push({
                   x: e.x + (Math.random()-0.5)*e.width, y: e.y + (Math.random()-0.5)*e.height,
                   vx: (Math.random()-0.5)*4 + b.vx*0.1, vy: (Math.random()-0.5)*4 + b.vy*0.1,
                   life: 15 + Math.random()*10, text: '·', color: '#000000'
                 });
               }
               
               let dmgText = `-${Math.floor(finalDamage)}${b.isCrit ? '!' : ''}`;
               if (finalDamage >= 100) {
                 const hex = Math.floor(finalDamage).toString(16).toUpperCase();
                 dmgText = b.isCrit ? `CRIT:0x${hex}!!` : `-0x${hex}`;
               }
               
               particles.current.push({
                 x: e.x + (Math.random()-0.5)*30, y: e.y + (Math.random()-0.5)*30,
                 vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6 - 2,
                 life: 30 + Math.random()*20, text: dmgText, color: b.isCrit ? '#e81123' : '#666666'
               });
               
               if (b.isHighlight && Math.random() < 0.3) {
                 room.puddles.push({
@@ -1793,50 +2052,53 @@ export default function App() {
               let atWall = false;
               if (e.x <= e.width/2 || e.x >= currentMap.width - e.width/2 || 
                   e.y <= e.height/2 || e.y >= currentMap.height - e.height/2 ||
                   checkObstacleCollision(e.x, e.y, e.width, e.height)) {
                 atWall = true;
                 e.x = prevX; // Revert movement to prevent going into wall/out of bounds
                 e.y = prevY;
               }
 
               if (atWall) {
                 if (!e.crushCooldown || now > e.crushCooldown) {
                   const isElite = e.type !== 'Minion' && e.type !== 'MINION';
                   if (isElite) {
                     if (!e.crushCount) {
                       e.crushCount = 1;
                       e.crushCooldown = now + 1000; // 1 second cooldown
                       e.hp -= e.maxHp * 0.5; // Deal 50% damage
                       shake.current = Math.max(shake.current, 5);
                       particles.current.push({
                         x: e.x, y: e.y,
                         vx: 0, vy: -2,
                         life: 30, color: '#ffaa00', text: 'CRUSH 1/2!'
                       });
                     } else {
                       e.hp = 0;
+                      if (ownerSpecific.includes('wordart_hotkey') && ownerPlayer) {
+                        ownerPlayer.lastShot = 0;
+                      }
                       shake.current = Math.max(shake.current, 10);
                       const deathTexts = ['DELETE', 'KILL', 'GG.EXE'];
                       for(let i=0; i<5; i++) {
                         particles.current.push({
                           x: e.x, y: e.y,
                           vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                           life: 30, color: '#ff0000', text: deathTexts[Math.floor(Math.random() * deathTexts.length)]
                         });
                       }
                     }
                   } else {
                     e.hp = 0;
                     shake.current = Math.max(shake.current, 10);
                     const deathTexts = ['DELETE', 'KILL', 'GG.EXE'];
                     for(let i=0; i<5; i++) {
                       particles.current.push({
                         x: e.x, y: e.y,
                         vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                         life: 30, color: '#ff0000', text: deathTexts[Math.floor(Math.random() * deathTexts.length)]
                       });
                     }
                   }
                 }
               }
             } else if (firstHit) {
@@ -1882,82 +2144,133 @@ export default function App() {
                 }
               }
 
               if (b.type === 'comment') {
                 b.life = 0;
               } else if (b.type === 'array' && b.splitsLeft && b.splitsLeft > 0) {
                 b.splitsLeft--;
                 const speed = Math.hypot(b.vx, b.vy);
                 const currentAngle = Math.atan2(b.vy, b.vx);
                 for (let j = -1; j <= 1; j++) {
                   const newAngle = currentAngle + j * Math.PI / 6;
                   room.bullets.push({
                     ...b,
                     id: room.bulletIdCounter++,
                     vx: Math.cos(newAngle) * speed,
                     vy: Math.sin(newAngle) * speed,
                     splitsLeft: 0,
                     pierce: 1,
                     damage: b.damage * 0.45,
                     hitTargets: new Set()
                   });
                 }
                 b.life = 0;
               }
 
+              if (b.type === 'array' && ownerSpecific.includes('array_scatter')) {
+                for (let si = 0; si < 2; si++) {
+                  const a = Math.random() * Math.PI * 2;
+                  room.bullets.push({
+                    id: room.bulletIdCounter++,
+                    owner: b.owner,
+                    x: b.x, y: b.y,
+                    vx: Math.cos(a) * 10,
+                    vy: Math.sin(a) * 10,
+                    damage: b.damage * 0.3,
+                    size: b.size * 0.6,
+                    pierce: 1,
+                    life: 500,
+                    maxLife: 500,
+                    type: 'array',
+                    isCrit: false,
+                    eliteDamageMult: b.eliteDamageMult || 1,
+                    splitsLeft: 0,
+                    bouncesLeft: 0,
+                    trackRadius: 0,
+                    isHighlight: false,
+                    leavesResidue: false,
+                    isItalic: false,
+                    isStrikethrough: false
+                  });
+                }
+              }
+
               b.pierce--;
               hitEnemy = true;
               if (!b.isBulldozer) break;
             }
           }
         }
 
         if (hitEnemy && b.pierce <= 0) {
           if (b.life > 0) {
             room.bullets.splice(i, 1);
           }
         } else if ((!b.isBulldozer && checkObstacleCollision(b.x, b.y, b.size, b.size)) || 
             b.x < -100 || b.x > currentMap.width + 100 || b.y < -100 || b.y > currentMap.height + 100) {
-          b.life = 0;
+          if (b.type === 'comment' && ownerSpecific.includes('comment_wallbounce') && !b.wallBounced) { //保留
+            const outX = b.x < 0 || b.x > currentMap.width;
+            const outY = b.y < 0 || b.y > currentMap.height;
+            if (outX) b.vx *= -1;
+            if (outY) b.vy *= -1;
+            if (!outX && !outY) {
+              if (Math.abs(b.vx) > Math.abs(b.vy)) b.vx *= -1;
+              else b.vy *= -1;
+            }
+            b.wallBounced = true;
+          } else {
+            b.life = 0;
+          }
         }
       }
 
       for (let i = room.enemyBullets.length - 1; i >= 0; i--) {
         const eb = room.enemyBullets[i];
         eb.x += eb.vx * timeSpeed;
         eb.y += eb.vy * timeSpeed;
         eb.life -= timeSpeed;
 
         if (eb.life <= 0 || checkObstacleCollision(eb.x, eb.y, eb.size, eb.size)) {
           room.enemyBullets.splice(i, 1);
           continue;
         }
 
         let blocked = false;
         for (const b of room.bullets) {
           if (b.type === 'wordart' && b.isShield && b.width && b.height) {
-            if (Math.abs(eb.x - b.x) < (b.width/2 + eb.size) && Math.abs(eb.y - b.y) < (b.height/2 + eb.size)) {
+            if (b.angle !== undefined) { //保留
+              const dx = eb.x - b.x;
+              const dy = eb.y - b.y;
+              const cos = Math.cos(-b.angle);
+              const sin = Math.sin(-b.angle);
+              const rx = dx * cos - dy * sin;
+              const ry = dx * sin + dy * cos;
+              if (Math.abs(rx) < (b.width/2 + eb.size) && Math.abs(ry) < (b.height/2 + eb.size)) {
+                blocked = true;
+                break;
+              }
+            } else if (Math.abs(eb.x - b.x) < (b.width/2 + eb.size) && Math.abs(eb.y - b.y) < (b.height/2 + eb.size)) {
               blocked = true;
               break;
             }
           }
         }
 
         if (blocked) {
           room.enemyBullets.splice(i, 1);
           continue;
         }
 
         Object.values(room.players).forEach((p: any) => {
           if (p.hp > 0 && now > p.invincibleUntil) {
             if (Math.hypot(p.x - eb.x, p.y - eb.y) < eb.size + 15) {
               p.hp -= eb.damage;
               if (p.hp <= 0) {
                 if (p.generalUpgrades.includes('ctrl_z') && !p.ctrlZUsed) {
                   p.hp = p.maxHp * 0.3;
                   p.ctrlZUsed = true;
                   p.invincibleUntil = now + 2000;
                 } else {
                   p.deaths++;
                 }
               }
               eb.life = 0;
@@ -2005,74 +2318,108 @@ export default function App() {
         }
       }
 
       for (let i = room.lasers.length - 1; i >= 0; i--) {
         const l = room.lasers[i];
         l.life -= timeSpeed;
         
         if (!l.hitTargets) l.hitTargets = new Set();
         
         for (const e of room.enemies) {
           if (l.hitTargets.has(e.id)) continue;
           
           // Simple line-circle collision approximation
           const dx = e.x - l.x;
           const dy = e.y - l.y;
           const dist = Math.hypot(dx, dy);
           const angleToEnemy = Math.atan2(dy, dx);
           let angleDiff = Math.abs(angleToEnemy - l.angle);
           while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
           while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
           
           if (dist < l.range && Math.abs(angleDiff) < 0.1) {
             l.hitTargets.add(e.id);
             
             let finalDamage = l.damage;
+            const laserOwner = room.players[l.owner];
+            const laserSpecific = laserOwner?.specificUpgrades || [];
+
+            if (laserOwner?.killshotUntil && Date.now() < laserOwner.killshotUntil) {
+              finalDamage *= 3;
+              laserOwner.killshotUntil = 0;
+            }
             if (e.type === 'EliteBoss' || e.type === 'MiniBoss' || e.type === 'Elite') {
               finalDamage *= (l.eliteDamageMult || 1);
             }
+
+            if (e.revisionMark && Date.now() < e.revisionMark) {
+              finalDamage *= 1.35;
+            }
+
+            if (laserSpecific.includes('sparkline_execute') && e.hp / e.maxHp < 0.25 && e.type !== 'EliteBoss' && e.type !== 'MiniBoss') {
+              finalDamage *= 3;
+            }
+
+            if (laserSpecific.includes('sparkline_tenshot')) {
+              laserOwner!.lasersHit = (laserOwner!.lasersHit || 0) + 1;
+              if ((laserOwner!.lasersHit || 0) % 10 === 0) {
+                laserOwner!.nextLaserCrit = true;
+              }
+              if (laserOwner!.nextLaserCrit) {
+                finalDamage *= 3;
+                laserOwner!.nextLaserCrit = false;
+              }
+            }
             
             // Highlight vulnerability
             const inHighlight = room.puddles.some(p => p.type === 'highlight' && Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.width/2);
             if (inHighlight) {
               finalDamage *= 1.5;
             }
             
             e.hp -= finalDamage;
+
+            if (laserSpecific.includes('sparkline_burn')) {
+              e.burnStacks = Math.min(8, (e.burnStacks || 0) + 1);
+            }
             
             // Strikethrough execute
             if (l.isStrikethrough && e.hp > 0 && e.hp / e.maxHp <= 0.2 && e.type !== 'EliteBoss' && e.type !== 'MiniBoss') {
               e.hp = 0;
               const deathTexts = ['DELETE', 'KILL', 'GG.EXE'];
               particles.current.push({
                 x: e.x, y: e.y, vx: 0, vy: -1, life: 30, text: deathTexts[Math.floor(Math.random() * deathTexts.length)], color: '#ff0000'
               });
             }
             
             if (l.isCannon && e.type !== 'EliteBoss' && e.type !== 'MiniBoss') {
               e.hp = 0;
             }
+
+            if (e.hp <= 0 && laserSpecific.includes('sparkline_killshot')) {
+              laserOwner!.killshotUntil = Date.now() + 300;
+            }
             
             if (e.hp > 0 && l.stunChance && Math.random() < l.stunChance) {
               e.state = 'stunned';
               e.stateTimer = 60; // 1s
             }
             
             if ((l as any).isSlow) {
               e.vx *= 0.2;
               e.vy *= 0.2;
             }
             
             shake.current = Math.max(shake.current, 1);
             
             let dmgText = `-${Math.floor(finalDamage)}${l.isCrit ? '!' : ''}`;
             if (finalDamage >= 100) {
               const hex = Math.floor(finalDamage).toString(16).toUpperCase();
               dmgText = l.isCrit ? `CRIT:0x${hex}!!` : `-0x${hex}`;
             }
             
             particles.current.push({
               x: e.x + (Math.random()-0.5)*30, y: e.y + (Math.random()-0.5)*30,
               vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6 - 2,
               life: 20 + Math.random()*10, text: dmgText, color: l.isCrit ? '#e81123' : '#0078d7'
             });
             
@@ -2123,179 +2470,196 @@ export default function App() {
         }
       }
       
       if (particles.current.length > 200) {
         particles.current = particles.current.slice(-200);
       }
     };
 
     gameLoopId.current = window.setInterval(gameLoop, 1000 / 60);
 
     return () => {
       if (gameLoopId.current) clearInterval(gameLoopId.current);
     };
   }, [currentRoom]);
 
   const handleGridAction = (type: 'area' | 'row' | 'col') => {
     if (!selectionStartRef.current || !selectionEndRef.current || !gameStateRef.current) return;
     
     const room = gameStateRef.current;
     const me = room.players[myId];
     if (!me) return;
     
     const canvas = canvasRef.current;
     if (!canvas) return;
     
-    const SCALE = 0.6;
+    const SCALE = 0.8; //保留
     const cameraX = me.x - canvas.width / (2 * SCALE);
     const cameraY = me.y - canvas.height / (2 * SCALE);
     
     const worldStartX = selectionStartRef.current.x / SCALE + cameraX;
     const worldStartY = selectionStartRef.current.y / SCALE + cameraY;
     const worldEndX = selectionEndRef.current.x / SCALE + cameraX;
     const worldEndY = selectionEndRef.current.y / SCALE + cameraY;
     
     const x = Math.min(worldStartX, worldEndX);
     const y = Math.min(worldStartY, worldEndY);
     const w = Math.abs(worldEndX - worldStartX);
     const h = Math.abs(worldEndY - worldStartY);
     
     room.bulletTime = 0;
     let hitCount = 0;
     room.enemies.forEach(e => {
       let hit = false;
       if (type === 'area') {
         if (e.x > x && e.x < x + w && e.y > y && e.y < y + h) hit = true;
       } else if (type === 'row') {
         if (e.y > y && e.y < y + h) hit = true;
       } else if (type === 'col') {
         if (e.x > x && e.x < x + w) hit = true;
       }
 
       if (hit) {
-        e.hp -= 99999;
+        if (e.type === 'EliteBoss') {
+          e.hp -= Math.min(e.hp, e.maxHp / 3);
+        } else {
+          e.hp -= 99999;
+        }
         hitCount++;
       }
     });
     
     if (hitCount > 0) {
       shake.current = 30;
     }
     
     setShowGridMenu(false);
     isSelectingGridRef.current = false;
     selectionStartRef.current = null;
     selectionEndRef.current = null;
   };
 
   const handleSelectUpgrade = (upgrade: Upgrade) => {
     const room = gameStateRef.current;
     if (!room) return;
     
     const p = room.players[myId];
     if (p) {
       if (['bold', 'underline', 'highlight', 'rand', 'vlookup', 'sum', 'italic', 'strikethrough', 'ctrl_c', 'ctrl_z', 'format_painter'].includes(upgrade)) {
+        if (upgrade === 'format_painter' && p.attackForm === 'sparkline') {
+          room.skillChoices = room.skillChoices.filter(u => u !== upgrade);
+          return;
+        }
         if (!p.generalUpgrades.includes(upgrade as GeneralUpgrade)) {
           p.generalUpgrades.push(upgrade as GeneralUpgrade);
         }
       } else {
         if (!p.specificUpgrades.includes(upgrade as SpecificUpgrade)) {
           p.specificUpgrades.push(upgrade as SpecificUpgrade);
         }
       }
       
       p.upgradesToChoose = (p.upgradesToChoose || 1) - 1;
       room.skillChoices = room.skillChoices.filter(u => u !== upgrade);
       
       if (p.upgradesToChoose > 0 && room.skillChoices.length > 0) {
         setUiState(prev => prev ? { ...prev, skillChoices: room.skillChoices } : null);
         return;
       }
     }
     
     p.readyForNextStage = true;
 
     room.isSelectingSkill = false;
     room.stage++;
     room.stageTimer = 0;
+
+    if (room.stage > TOTAL_STAGES) {
+      const score = (p.kills || 0) * 10 + TOTAL_STAGES * 200 - (p.deaths || 0) * 100;
+      setFinalScore(Math.max(0, score));
+      setIsCleared(true);
+      setUiState(prev => prev ? { ...prev, isSelectingSkill: false } : null);
+      return;
+    }
     
-    if (room.stage <= 5) {
+    if (room.stage <= MAPS.length) {
       room.enemies = []; 
       room.bullets = [];
       room.puddles = [];
       room.enemyBullets = [];
       room.aoeWarnings = [];
       room.lasers = [];
       room.items = [];
       room.dynamicObstacles = [];
       
       const currentMap = MAPS[Math.min(room.stage - 1, MAPS.length - 1)];
       p.x = currentMap.playerSpawn.x;
       p.y = currentMap.playerSpawn.y;
     }
     p.readyForNextStage = false;
     setUiState(prev => prev ? { ...prev, isSelectingSkill: false } : null);
   };
 
   const handleSelectForm = (form: AttackForm) => {
     const room = gameStateRef.current;
     if (!room) return;
     
     const p = room.players[myId];
     if (p) {
       p.attackForm = form;
     }
     
     room.isSelectingForm = false;
     setUiState(prev => prev ? { ...prev, isSelectingForm: false } : null);
   };
 
   // Canvas Render Loop
   useEffect(() => {
     if (!currentRoom) return;
 
     const canvas = canvasRef.current;
     const container = containerRef.current;
     if (!canvas || !container) return;
     const ctx = canvas.getContext('2d');
     if (!ctx) return;
 
     const render = () => {
       const gameState = gameStateRef.current;
+      const renderNow = Date.now();
       
       if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
         canvas.width = container.clientWidth;
         canvas.height = container.clientHeight;
       }
 
       if (!gameState) {
         animationFrameId.current = requestAnimationFrame(render);
         return;
       }
 
       const me = gameState.players[myId];
-      const SCALE = 0.6;
+      const SCALE = 0.8;
       
       let bgColor = '#ffffff';
       let gridColor = '#e1dfdd';
       let textColor = '#000000';
       if (gameState.stage > 5) {
         const endlessLevel = (gameState.stage - 5) + (gameState.stageTimer / 3600);
         const progress = Math.min(1, endlessLevel / 15); // Max darkness at stage 20
         const r = Math.floor(255 - progress * (255 - 10));
         const g = Math.floor(255 - progress * (255 - 25));
         const b = Math.floor(255 - progress * (255 - 47));
         bgColor = `rgb(${r}, ${g}, ${b})`;
         
         const gr = Math.floor(225 - progress * (225 - 30));
         const gg = Math.floor(223 - progress * (223 - 45));
         const gb = Math.floor(221 - progress * (221 - 70));
         gridColor = `rgb(${gr}, ${gg}, ${gb})`;
         
         const tc = Math.floor(0 + progress * 255);
         textColor = `rgb(${tc}, ${tc}, ${tc})`;
       }
       
       ctx.fillStyle = bgColor;
       ctx.fillRect(0, 0, canvas.width, canvas.height);
 
       let cameraX = me ? me.x - canvas.width / (2 * SCALE) : 0;
@@ -2420,578 +2784,569 @@ export default function App() {
         for (let i = -obs.h; i < obs.w; i += 20) {
           ctx.moveTo(obs.x + i, obs.y);
           ctx.lineTo(obs.x + i + obs.h, obs.y + obs.h);
         }
         ctx.stroke();
       });
 
       currentMap?.bushes?.forEach((bush: any) => {
         if (!isVisible(bush.x, bush.y, bush.w, bush.h)) return;
         ctx.fillStyle = '#1e3b2b'; 
         ctx.fillRect(bush.x, bush.y, bush.w, bush.h);
         ctx.fillStyle = '#ffffff';
         ctx.font = '12px Calibri';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText('***', bush.x + bush.w/2, bush.y + bush.h/2);
       });
 
       gameState.puddles?.forEach((p: any) => {
         if (!isVisible(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2)) return;
         
         if (p.type === 'explosion') {
           const progress = 1 - (p.life / p.maxLife);
           const alpha = p.life / p.maxLife;
           const explosionChars = ['#REF!', '#VALUE!', '#NULL!', 'ERR', '{}', '[[]]', 'NaN', '0xFF', 'SIGSEGV', 'OVERFLOW'];
-          
+
           ctx.save();
           ctx.translate(p.x, p.y);
-          
-          const rings = 3;
-          for (let r = 1; r <= rings; r++) {
-            const ringRadius = p.radius * progress * (r / rings);
-            const numChars = Math.floor(ringRadius / 5) + 4;
-            const fontSize = Math.max(10, 30 - r * 5);
+          ctx.textAlign = 'center';
+          ctx.textBaseline = 'middle';
+
+          const rings = 5;
+          for (let r = 0; r < rings; r++) {
+            const ringProgress = (r + 1) / rings;
+            const ringRadius = p.radius * (0.18 + ringProgress * 0.92) * progress;
+            const charCount = Math.min(52, Math.max(8, Math.floor(ringRadius / 7) + r * 4));
+            const fontSize = Math.max(9, 24 - r * 3.2);
+            const wobble = 2.2 + r * 0.7;
             ctx.font = `bold ${fontSize}px monospace`;
-            ctx.fillStyle = `rgba(255, 60, 0, ${alpha * (1 - r/rings * 0.5)})`;
-            ctx.textAlign = 'center';
-            ctx.textBaseline = 'middle';
-            
-            for (let i = 0; i < numChars; i++) {
-              const angle = (i / numChars) * Math.PI * 2 + (Date.now() * 0.002 * r);
-              const char = explosionChars[(i + r) % explosionChars.length];
-              const cx = Math.cos(angle) * ringRadius;
-              const cy = Math.sin(angle) * ringRadius;
-              
+            const ringAlpha = alpha * (1 - r * 0.14);
+
+            for (let i = 0; i < charCount; i++) {
+              const t = i / charCount;
+              const angle = t * Math.PI * 2 + renderNow * (0.0014 + r * 0.00025);
+              const pulse = Math.sin(renderNow * 0.01 + i * 0.8 + r) * wobble;
+              const rr = ringRadius + pulse;
+              const cx = Math.cos(angle) * rr;
+              const cy = Math.sin(angle) * rr;
+              const token = explosionChars[(i + r + Math.floor(renderNow / 70)) % explosionChars.length];
+
               ctx.save();
               ctx.translate(cx, cy);
-              ctx.rotate(angle + Math.PI/2);
-              ctx.fillText(char, 0, 0);
+              ctx.rotate(angle + Math.PI / 2 + Math.sin(renderNow * 0.004 + i) * 0.15);
+              ctx.fillStyle = `rgba(${255 - r * 18}, ${120 - r * 10}, ${40 + r * 16}, ${Math.max(0.05, ringAlpha * (0.72 - t * 0.18))})`;
+              ctx.fillText(token, 0, 0);
               ctx.restore();
             }
           }
           ctx.restore();
         } else if (p.type === 'highlight' || p.type === 'burn_slow') {
           ctx.save();
           ctx.beginPath();
           ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
           ctx.clip();
           
           const alpha = p.life / p.maxLife;
           ctx.fillStyle = p.type === 'highlight' ? `rgba(154, 205, 50, ${0.3 * alpha})` : `rgba(255, 69, 0, ${0.4 * alpha})`;
           ctx.fill(); // Base background
           
           ctx.fillStyle = p.type === 'highlight' ? `rgba(154, 205, 50, ${0.6 * alpha})` : `rgba(255, 69, 0, ${0.8 * alpha})`;
           ctx.font = '12px monospace';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           
           const matrixChars = '01';
-          const scrollY = (Date.now() * 0.05) % 20;
+          const scrollY = (renderNow * 0.05) % 20;
           
           for (let mx = -p.radius; mx <= p.radius; mx += 15) {
             for (let my = -p.radius - 20; my <= p.radius; my += 20) {
-              const char = matrixChars[Math.floor(Math.abs(mx * my + Date.now()*0.001)) % matrixChars.length];
+              const char = matrixChars[Math.floor(Math.abs(mx * my + renderNow*0.001)) % matrixChars.length];
               ctx.fillText(char, p.x + mx, p.y + my + scrollY);
             }
           }
           
           ctx.restore();
         } else {
           ctx.beginPath();
           ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
           if (p.type === 'formatPaint') {
             ctx.fillStyle = `rgba(255, 200, 0, ${Math.min(0.4, p.life / 500)})`;
             ctx.fill();
             ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.5, p.life / 500)})`;
             ctx.font = '12px Calibri';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText('🖌️', p.x, p.y);
           } else if (p.type === 'blacken') {
             ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.8, p.life / 600)})`;
             ctx.fill();
           }
         }
       });
 
-      gameState.enemies?.forEach((e: any) => {
-        // Removed FreezeCell aura rendering
-      });
-
       gameState.enemyBullets?.forEach((eb: any) => {
         if (!isVisible(eb.x - eb.size, eb.y - eb.size, eb.size * 2, eb.size * 2)) return;
+        ctx.save();
+        ctx.translate(eb.x, eb.y);
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
-        if (eb.type === 'value') {
-          ctx.fillStyle = '#e81123';
-          ctx.font = 'bold 14px Calibri';
-          ctx.fillText('#VALUE!', eb.x, eb.y);
-        } else if (eb.type === 'row') {
-          ctx.fillStyle = '#e81123';
-          ctx.font = 'bold 14px Calibri';
-          ctx.fillText('#REF!', eb.x, eb.y);
-        } else if (eb.type === 'col') {
-          ctx.fillStyle = '#e81123';
-          ctx.font = 'bold 14px Calibri';
-          ctx.fillText('#N/A', eb.x, eb.y);
-        } else {
-          ctx.fillStyle = '#e81123';
-          ctx.font = `bold ${eb.size * 2}px Consolas`;
-          const char = eb.type === 'ref' ? '?' : (eb.type === 'vlookup' ? '§' : '*');
-          ctx.fillText(char, eb.x, eb.y);
+
+        const hostileTokens: Record<string, string[]> = {
+          value: ['#VALUE!', 'NaN', 'TypeError'],
+          row: ['<ROW/>', '////', '===>'],
+          col: ['<COL/>', '||||', '::'],
+          ref: ['#REF!', '?', 'NULL'],
+          vlookup: ['VLOOKUP', '=>', 'MISS']
+        };
+        const seq = hostileTokens[eb.type] || ['ERR'];
+        const token = seq[Math.floor((renderNow / 40 + eb.id) % seq.length)];
+        const alpha = Math.max(0.35, eb.life / 300);
+
+        ctx.fillStyle = `rgba(255, 70, 70, ${alpha})`;
+        ctx.font = `bold ${Math.max(12, eb.size * 1.4)}px monospace`;
+
+        for (let lane = -1; lane <= 1; lane++) {
+          const yJitter = Math.sin(renderNow * 0.02 + eb.id + lane) * 2;
+          ctx.fillText(token, 0, lane * 10 + yJitter);
         }
-      });
 
-      gameState.items?.forEach((item: any) => {
-        if (!isVisible(item.x - 15, item.y - 15, 30, 30)) return;
-        ctx.fillStyle = 'rgba(0, 120, 215, 0.2)';
-        ctx.fillRect(item.x - 15, item.y - 15, 30, 30);
-        ctx.strokeStyle = '#0078d7';
-        ctx.lineWidth = 2;
-        ctx.setLineDash([4, 2]);
-        ctx.strokeRect(item.x - 15, item.y - 15, 30, 30);
-        ctx.setLineDash([]);
+        ctx.restore();
       });
 
       gameState.enemies?.forEach((e: any) => {
         if (!isVisible(e.x - e.width/2, e.y - e.height/2, e.width, e.height)) return;
-        
+
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
-        
+
         if (e.type === 'FormatBrush' && e.state === 'warning') {
           ctx.beginPath();
           ctx.moveTo(e.x, e.y);
           ctx.lineTo(e.dashTargetX || e.x, e.dashTargetY || e.y);
-          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
-          ctx.lineWidth = 4;
-          ctx.setLineDash([10, 10]);
+          ctx.strokeStyle = 'rgba(255, 90, 90, 0.65)';
+          ctx.lineWidth = 3;
+          ctx.setLineDash([8, 6]);
           ctx.stroke();
           ctx.setLineDash([]);
         }
 
         if (e.type === 'ProtectedView' && e.facingAngle !== undefined) {
           ctx.beginPath();
           ctx.arc(e.x, e.y, e.width/2 + 10, e.facingAngle - Math.PI/4, e.facingAngle + Math.PI/4);
           ctx.strokeStyle = '#00a2ed';
-          ctx.lineWidth = 4;
+          ctx.lineWidth = 3;
           ctx.stroke();
         }
-        
-        if (e.spreadsheetMark && e.spreadsheetMark > Date.now()) {
+
+        const phase = renderNow * 0.002 + e.id;
+        const baseColorMap: Record<string, string> = {
+          Minion: '#a0a0a0',
+          Elite: '#ff5a5a',
+          MiniBoss: '#ffd166',
+          EliteBoss: '#ff355e',
+          Value: '#ff8a3d',
+          FormatBrush: '#ffd43b',
+          FreezeCell: '#59d8ff',
+          ProtectedView: '#3ecf8e',
+          MergedCell: '#b892ff',
+          SplitCell: '#ff70d8',
+          REF: '#ff3b3b',
+          VLOOKUP: '#4aa8ff',
+          MACRO: '#43d17a',
+          MINION: '#ff8080'
+        };
+
+        let tokenPool = ['NULL', 'NaN', '{}'];
+        if (e.type === 'Minion') tokenPool = ['lorem', 'var', 'tmp', 'obj'];
+        else if (e.type === 'Elite') tokenPool = ['ERR', 'panic!', 'stack'];
+        else if (e.type === 'MiniBoss') tokenPool = ['TODO', 'FIXME', 'REWORK'];
+        else if (e.type === 'EliteBoss') tokenPool = ['{', '}', '<', '>', '/', '\\', '0', '1', 'x', '=', '?', '#'];
+        else if (e.type === 'Value') tokenPool = ['#N/A', '#VALUE!', 'NaN'];
+        else if (e.type === 'FormatBrush') tokenPool = ['paint()', 'fmt', '{style}'];
+        else if (e.type === 'FreezeCell') tokenPool = ['const', 'let', 'lock'];
+        else if (e.type === 'ProtectedView') tokenPool = ['readonly', 'shield', 'perm'];
+        else if (e.type === 'MergedCell') tokenPool = ['merge', '[][]', '<td>'];
+        else if (e.type === 'SplitCell') tokenPool = ['split', '::', '..'];
+        else if (e.type === 'REF') tokenPool = ['#REF!', '?', 'dangling'];
+        else if (e.type === 'VLOOKUP') tokenPool = ['VLOOKUP', 'index', 'find'];
+        else if (e.type === 'MACRO') tokenPool = ['macro()', 'exec', 'virus'];
+        else if (e.type === 'MINION') tokenPool = ['ERR', 'bomb()', '!!'];
+
+        const baseColor = baseColorMap[e.type] || '#cccccc';
+
+        if (e.type === 'EliteBoss') {
           ctx.save();
           ctx.translate(e.x, e.y);
-          ctx.rotate(Date.now() * 0.005);
-          ctx.strokeStyle = '#107c41';
-          ctx.lineWidth = 2;
-          ctx.setLineDash([5, 5]);
-          ctx.strokeRect(-e.width/2 - 5, -e.height/2 - 5, e.width + 10, e.height + 10);
+          ctx.globalAlpha = 0.9;
+          const layers = 7;
+          for (let layer = 0; layer < layers; layer++) {
+            const r = Math.max(90, e.width * 0.28 - layer * 10);
+            const chars = 80 + layer * 20;
+            ctx.fillStyle = `hsla(${(renderNow / 8 + layer * 40) % 360}, 95%, ${45 + layer * 3}%, ${0.18 + layer * 0.05})`;
+            ctx.font = `bold ${10 + layer}px monospace`;
+            for (let i = 0; i < chars; i++) {
+              const a = (i / chars) * Math.PI * 2 + phase * (0.6 + layer * 0.08);
+              const wiggle = Math.sin(a * 3 + phase * 3 + layer) * (14 + layer * 2);
+              const x = Math.cos(a) * (r + wiggle);
+              const y = Math.sin(a) * (r * 0.42 + wiggle * 0.35);
+              const glyph = tokenPool[(i + layer) % tokenPool.length];
+              ctx.fillText(glyph, x, y);
+            }
+          }
+          ctx.fillStyle = 'rgba(255,255,255,0.85)';
+          ctx.font = 'bold 18px monospace';
+          ctx.fillText('KERNEL_PANIC_BOSS', 0, 0);
           ctx.restore();
-        }
-        
-        if (e.type === 'Minion') {
-          ctx.fillStyle = '#666666';
-          ctx.font = '14px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'Elite') {
-          ctx.fillStyle = '#e81123';
-          ctx.font = '16px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
+        } else {
+          ctx.save();
+          ctx.translate(e.x, e.y);
+
+          const bodyW = e.width * (0.82 + Math.sin(phase * 1.7) * 0.08);
+          const bodyH = e.height * (0.8 + Math.cos(phase * 1.45) * 0.1);
+          const bulges = 18;
           ctx.beginPath();
-          ctx.strokeStyle = '#e81123';
-          ctx.lineWidth = 1;
-          for(let i = -e.width/2; i < e.width/2; i+=4) {
-            ctx.lineTo(e.x + i, e.y + 10 + (i%8 === 0 ? 2 : -2));
+          for (let i = 0; i <= bulges; i++) {
+            const t = i / bulges;
+            const a = t * Math.PI * 2;
+            const irregular = 1 + Math.sin(a * 3 + phase * 2.6) * 0.17 + Math.sin(a * 7 - phase * 1.8) * 0.08;
+            const x = Math.cos(a) * bodyW * 0.55 * irregular;
+            const y = Math.sin(a) * bodyH * 0.55 * (1 + Math.cos(a * 4 + phase * 2.2) * 0.11);
+            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
           }
-          ctx.stroke();
-        } else if (e.type === 'MiniBoss') {
-          ctx.fillStyle = '#fff2ab';
-          ctx.fillRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
-          ctx.strokeStyle = '#c8c6c4';
-          ctx.strokeRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
-          ctx.fillStyle = '#000000';
-          ctx.font = '14px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'EliteBoss') {
-          ctx.save();
-          ctx.shadowColor = '#ff0000';
-          ctx.shadowBlur = 20;
-          ctx.fillStyle = `hsl(${(Date.now() / 10) % 360}, 100%, 50%)`;
-          ctx.font = 'bold 36px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-          ctx.restore();
-        } else if (e.type === 'Value') {
-          ctx.fillStyle = '#d83b01';
-          ctx.font = 'bold 16px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'FormatBrush') {
-          ctx.fillStyle = '#ffb900';
-          ctx.font = 'bold 16px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'FreezeCell') {
-          ctx.fillStyle = '#00bcf2';
-          ctx.fillRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
-          ctx.strokeStyle = '#0078d7';
-          ctx.strokeRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
-          ctx.fillStyle = '#ffffff';
-          ctx.font = '14px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'ProtectedView') {
-          ctx.fillStyle = '#107c41';
-          ctx.font = 'bold 16px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'MergedCell') {
-          ctx.fillStyle = '#5c2d91';
-          ctx.fillRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
-          ctx.strokeStyle = '#32145a';
-          ctx.strokeRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
-          ctx.fillStyle = '#ffffff';
-          ctx.font = 'bold 16px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'SplitCell') {
-          ctx.fillStyle = '#e3008c';
-          ctx.font = '12px Calibri';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'REF') {
-          ctx.fillStyle = '#ff0000';
-          ctx.font = 'bold 16px Consolas';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'VLOOKUP') {
-          ctx.fillStyle = '#0078d7';
-          ctx.font = 'bold 16px Consolas';
-          ctx.fillText(e.text, e.x, e.y);
-          if (e.state === 'aiming' && e.dashTargetX !== undefined && e.dashTargetY !== undefined) {
-            ctx.beginPath();
-            ctx.moveTo(e.x, e.y);
-            ctx.lineTo(e.dashTargetX, e.dashTargetY);
-            ctx.strokeStyle = `rgba(255, 0, 0, ${Math.max(0.2, 1 - (e.stateTimer || 0)/120)})`;
-            ctx.lineWidth = 2;
-            ctx.stroke();
+          ctx.closePath();
+          ctx.clip();
+
+          const layers = 4;
+          const lineHeight = Math.max(10, Math.floor(e.height / 7));
+          for (let layer = 0; layer < layers; layer++) {
+            ctx.fillStyle = `hsla(${(renderNow / 11 + layer * 25) % 360}, 88%, ${46 + layer * 8}%, ${0.18 + layer * 0.13})`;
+            ctx.font = `bold ${Math.max(12, Math.min(26, e.height * 0.38 - layer * 1.5))}px monospace`;
+            const lines = Math.max(3, Math.floor(e.height / 8) + layer);
+            for (let row = 0; row < lines; row++) {
+              let line = '';
+              const charsPerLine = Math.max(8, Math.floor(e.width / 9));
+              for (let col = 0; col < charsPerLine; col++) {
+                const t = tokenPool[Math.floor((renderNow / 45 + row * 4 + col * (1.2 + layer * 0.2) + e.id + layer * 3) % tokenPool.length)];
+                line += (t?.[col % t.length] || t?.[0] || 'x');
+              }
+              const x = Math.sin(renderNow * 0.002 + row * 0.7 + layer) * (8 + layer * 4);
+              const y = (row - (lines - 1) / 2) * lineHeight + Math.cos(renderNow * 0.003 + row + layer) * 4;
+              ctx.fillText(line, x, y);
+            }
           }
-        } else if (e.type === 'MACRO') {
-          ctx.fillStyle = '#107c41';
-          ctx.font = 'bold 16px Consolas';
-          ctx.fillText(e.text, e.x, e.y);
-        } else if (e.type === 'MINION') {
-          ctx.fillStyle = '#ff4444';
-          ctx.font = '20px Arial';
-          ctx.fillText(e.text, e.x, e.y);
+
+          ctx.restore();
+        }
+
+        if (e.type === 'VLOOKUP' && e.state === 'aiming' && e.dashTargetX !== undefined && e.dashTargetY !== undefined) {
+          ctx.beginPath();
+          ctx.moveTo(e.x, e.y);
+          ctx.lineTo(e.dashTargetX, e.dashTargetY);
+          ctx.strokeStyle = `rgba(255, 50, 50, ${Math.max(0.2, 1 - (e.stateTimer || 0)/120)})`;
+          ctx.lineWidth = 2;
+          ctx.stroke();
         }
 
         if (e.type === 'MiniBoss' || e.type === 'EliteBoss' || e.type === 'FreezeCell' || e.type === 'MergedCell' || e.type === 'REF' || e.type === 'VLOOKUP' || e.type === 'MACRO') {
-          ctx.fillStyle = '#e1dfdd';
+          ctx.fillStyle = '#3a3a3a';
           ctx.fillRect(e.x - e.width/2, e.y - e.height/2 - 10, e.width, 4);
-          ctx.fillStyle = '#e81123';
+          const hpGrad = ctx.createLinearGradient(e.x - e.width/2, 0, e.x + e.width/2, 0);
+          hpGrad.addColorStop(0, '#ff5454');
+          hpGrad.addColorStop(1, '#ff9b54');
+          ctx.fillStyle = hpGrad;
           ctx.fillRect(e.x - e.width/2, e.y - e.height/2 - 10, e.width * (e.hp / e.maxHp), 4);
         }
       });
 
       Object.values(gameState.players).forEach((p: any) => {
         if (p.hp > 0) {
           if (!isVisible(p.x - 40, p.y - 12, 80, 24)) return;
 
           const isMe = p.id === myId;
-          const now = Date.now();
+          const now = renderNow;
           const isInvincible = p.invincibleUntil && now < p.invincibleUntil;
           
           if (isInvincible) {
             ctx.globalAlpha = Math.floor(now / 150) % 2 === 0 ? 0.5 : 1.0;
           }
           
           ctx.fillStyle = 'rgba(33, 115, 70, 0.1)';
           ctx.fillRect(p.x - 40, p.y - 12, 80, 24);
           ctx.strokeStyle = isMe ? '#217346' : '#800080';
           ctx.lineWidth = 2;
           ctx.strokeRect(p.x - 40, p.y - 12, 80, 24);
           
           ctx.fillStyle = isMe ? '#217346' : '#800080';
           ctx.fillRect(p.x + 37, p.y + 9, 6, 6);
 
           ctx.fillStyle = '#000000';
           ctx.font = '12px Calibri';
           ctx.textAlign = 'left';
           ctx.fillText(isMe ? '我' : '同事', p.x - 35, p.y + 4);
 
           ctx.fillStyle = '#e1dfdd';
           ctx.fillRect(p.x - 40, p.y + 15, 80, 4);
           ctx.fillStyle = '#217346';
           ctx.fillRect(p.x - 40, p.y + 15, 80 * (p.hp / p.maxHp), 4);
 
           ctx.globalAlpha = 1.0;
         } else if (p.id === myId) {
           ctx.fillStyle = '#e81123';
           ctx.font = 'bold 12px Calibri';
           ctx.fillText('#DIV/0!', p.x - 20, p.y + 4);
         }
       });
 
+      Object.values(gameState.players).forEach((p: any) => {
+        if (!(p?.specificUpgrades || []).includes('array_orbit') || p.hp <= 0) return;
+        const oa = p.orbitAngle || 0;
+        for (let i = 0; i < 8; i++) {
+          const a = oa + i * Math.PI / 4;
+          const ox = p.x + Math.cos(a) * 55;
+          const oy = p.y + Math.sin(a) * 55;
+          if (!isVisible(ox - 8, oy - 8, 16, 16)) continue;
+          ctx.beginPath();
+          ctx.arc(ox, oy, 6, 0, Math.PI * 2);
+          ctx.fillStyle = '#107c41';
+          ctx.fill();
+          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
+          ctx.lineWidth = 1;
+          ctx.stroke();
+        }
+      });
+
       gameState.bullets?.forEach((b: any) => {
         if (!isVisible(b.x - 20, b.y - 20, 40, 40)) return;
-        
+
         ctx.save();
         ctx.translate(b.x, b.y);
-        
-        if (b.type === 'wordart') {
-          // No rotation for wordart, always horizontal
+
+        if (b.angle !== undefined) {
+          ctx.rotate(b.angle);
         } else {
           ctx.rotate(Math.atan2(b.vy, b.vx));
         }
-        
+
         if (b.type === 'wordart') {
-          // Calculate scale to match width/height if provided
           let scaleX = 1;
           let scaleY = 1;
           if (b.width && b.height) {
-            // Assuming base text width is roughly 4 characters * size, height is size
             const baseWidth = b.size * 4;
             const baseHeight = b.size;
             scaleX = b.width / baseWidth;
             scaleY = b.height / baseHeight;
             ctx.scale(scaleX, scaleY);
           }
-          
-          ctx.font = (b.isItalic ? 'italic ' : '') + '900 ' + b.size + 'px "Microsoft YaHei", Impact, sans-serif';
-          
-          // Enhanced visual for WordArt
-          let text = b.isTitle ? '大标题' : (b.wordartText || '推翻重做');
-          
-          // Randomly replace 1 character with gibberish every 3 frames
-          if (Math.floor(Date.now() / 50) % 3 === 0 && text.length > 0) {
-            const gibberish = ['烫烫烫', '锟斤拷', 'XXXX', '▓░▒'];
-            const replaceIdx = Math.floor(Math.random() * text.length);
-            const randGib = gibberish[Math.floor(Math.random() * gibberish.length)];
-            text = text.substring(0, replaceIdx) + randGib[0] + text.substring(replaceIdx + 1);
-          }
-          
-          if (b.isTitle) {
-            // Title gets a special gradient and shadow
-            const gradient = ctx.createLinearGradient(0, -b.size/2, 0, b.size/2);
-            gradient.addColorStop(0, '#ff4b1f');
-            gradient.addColorStop(1, '#ff9068');
-            ctx.fillStyle = gradient;
-            ctx.strokeStyle = '#ffffff';
-            ctx.lineWidth = b.size * 0.08;
-            ctx.shadowColor = 'rgba(255, 75, 31, 0.6)';
-            ctx.shadowBlur = 15;
-            ctx.shadowOffsetX = 4;
-            ctx.shadowOffsetY = 4;
-          } else {
-            // Normal wordart gets standard styling but better
-            ctx.fillStyle = '#ffaa00';
-            ctx.strokeStyle = '#000000';
-            ctx.lineWidth = Math.max(2, b.size * 0.05);
-            ctx.shadowColor = 'rgba(0,0,0,0.3)';
-            ctx.shadowBlur = 5;
-            ctx.shadowOffsetX = 2;
-            ctx.shadowOffsetY = 2;
-          }
-          
-          if (b.isShield) {
-            ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
-            ctx.shadowBlur = 20;
-            ctx.strokeStyle = '#00ffff';
-          }
-          
+
+          const stream = b.isTitle
+            ? '<<while(alive){push(code_wall);}>>'
+            : 'if(hit){++pressure;}else{advance();}';
+          const glyphSize = Math.max(14, b.size * 0.5);
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
-          
-          ctx.strokeText(text, 0, 0);
-          ctx.fillText(text, 0, 0);
-          
-          // Reset shadow
-          ctx.shadowBlur = 0;
-          ctx.shadowOffsetX = 0;
-          ctx.shadowOffsetY = 0;
-          
-          // Semi-transparent green scanline
-          const textWidth = ctx.measureText(text).width;
-          const scanlineY = (Date.now() * 0.1) % b.size - b.size/2;
-          ctx.fillStyle = `rgba(0, 255, 0, ${0.3 + 0.2 * Math.sin(Date.now() * 0.02)})`;
-          ctx.fillRect(-textWidth/2 - 10, scanlineY, textWidth + 20, 4);
-          
+          ctx.font = (b.isItalic ? 'italic ' : '') + `900 ${glyphSize}px monospace`;
+          ctx.shadowColor = b.isShield ? 'rgba(120,255,250,0.9)' : 'rgba(60,230,190,0.45)';
+          ctx.shadowBlur = b.isShield ? 18 : 9;
+
+          const lanes = b.isTitle ? 7 : 5;
+          for (let lane = -Math.floor(lanes / 2); lane <= Math.floor(lanes / 2); lane++) {
+            const laneOffset = lane * (glyphSize * 0.64);
+            const laneAlpha = 0.5 + (1 - Math.abs(lane) / (lanes * 0.6)) * 0.45;
+            let out = '';
+            const len = b.isTitle ? 22 : 16;
+            for (let i = 0; i < len; i++) {
+              const idx = Math.floor((renderNow / 48 + i + lane * 2 + b.id) % stream.length);
+              out += stream[idx] || '#';
+            }
+            const xJitter = Math.sin(renderNow * 0.01 + lane * 0.7 + b.id) * 6;
+            const yJitter = Math.cos(renderNow * 0.009 + lane * 0.8 + b.id) * 2.5;
+            ctx.fillStyle = `rgba(${90 + Math.abs(lane) * 22},255,220,${laneAlpha})`;
+            ctx.fillText(out, xJitter, laneOffset + yJitter);
+          }
+
           if (b.isStrikethrough) {
             ctx.beginPath();
-            ctx.moveTo(-b.size * 2, 0);
-            ctx.lineTo(b.size * 2, 0);
-            ctx.strokeStyle = '#e81123';
-            ctx.lineWidth = 4;
+            ctx.moveTo(-b.size * 3.2, 0);
+            ctx.lineTo(b.size * 3.2, 0);
+            ctx.strokeStyle = '#ff4b4b';
+            ctx.lineWidth = 3;
             ctx.stroke();
           }
         } else if (b.type === 'sparkline') {
-          ctx.beginPath();
-          ctx.moveTo(-b.size/2, 0);
-          ctx.lineTo(b.size/2, 0);
-          ctx.strokeStyle = '#0078d7';
-          ctx.lineWidth = b.isBold ? 6 : 3;
-          ctx.stroke();
+          const token = ['=>', '::', '01', '{}'][Math.floor((renderNow / 60 + b.id) % 4)];
+          ctx.fillStyle = 'rgba(70,180,255,0.9)';
+          ctx.font = `bold ${Math.max(12, b.size * 0.9)}px monospace`;
+          for (let k = -2; k <= 2; k++) {
+            const x = k * (b.size * 0.45);
+            const y = Math.sin(renderNow * 0.01 + k + b.id) * 2;
+            ctx.fillText(token, x, y);
+          }
         } else if (b.type === 'comment') {
-          ctx.fillStyle = '#222';
-          ctx.beginPath();
-          ctx.arc(0, 0, b.size/2, 0, Math.PI * 2);
-          ctx.fill();
-          ctx.strokeStyle = '#ff4400';
-          ctx.lineWidth = 2;
-          ctx.stroke();
-          
-          ctx.fillStyle = '#ff4400';
-          ctx.font = 'bold 12px monospace';
+          const bombTokens = ['#REF!', '#VALUE!', '{}', '[[]]', 'NaN', '0xFF', 'ERR', 'SIG'];
+          const radius = Math.max(8, b.size * 0.55);
+          const glyphs = 10;
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
-          const bombText = '/**/';
-          ctx.fillText(bombText, 0, 0);
-          
-          // Add a little fuse spark
-          const sparkAngle = Date.now() * 0.01;
-          const sx = Math.cos(sparkAngle) * (b.size/2 + 4);
-          const sy = Math.sin(sparkAngle) * (b.size/2 + 4);
-          ctx.fillStyle = '#ffff00';
-          ctx.fillRect(sx - 2, sy - 2, 4, 4);
-          
+
+          for (let i = 0; i < glyphs; i++) {
+            const a = (i / glyphs) * Math.PI * 2 + renderNow * 0.012;
+            const rr = radius + Math.sin(renderNow * 0.02 + i) * 2;
+            const x = Math.cos(a) * rr;
+            const y = Math.sin(a) * rr;
+            const tok = bombTokens[(i + b.id) % bombTokens.length];
+            ctx.font = `bold ${Math.max(10, b.size * 0.5 - (i % 3))}px monospace`;
+            ctx.fillStyle = `rgba(255, ${140 - i * 6}, ${80 + i * 5}, ${0.75 - i * 0.03})`;
+            ctx.fillText(tok, x, y);
+          }
+
+          ctx.font = `bold ${Math.max(11, b.size * 0.6)}px monospace`;
+          ctx.fillStyle = 'rgba(255,230,180,0.95)';
+          ctx.fillText('/*BOMB*/', 0, 0);
+
           if (b.isStrikethrough) {
             ctx.beginPath();
             ctx.moveTo(-b.size/2, 0);
             ctx.lineTo(b.size/2, 0);
-            ctx.strokeStyle = '#e81123';
+            ctx.strokeStyle = '#ff4b4b';
             ctx.lineWidth = 2;
             ctx.stroke();
           }
         } else if (b.type === 'array') {
-          ctx.fillStyle = '#107c41';
-          ctx.font = (b.isItalic ? 'italic ' : '') + 'bold ' + b.size + 'px Consolas';
+          ctx.fillStyle = '#73f7a6';
+          ctx.font = (b.isItalic ? 'italic ' : '') + `bold ${Math.max(12, b.size)}px monospace`;
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
-          ctx.shadowColor = 'rgba(16, 124, 65, 0.4)';
-          ctx.shadowBlur = 4;
-          const chars = ['A', 'B', 'C', 'X', 'Y', 'Z', '0', '1', '2', '!', '@', '#', '$', '%', '&'];
-          const char = chars[b.id % chars.length];
+          ctx.shadowColor = 'rgba(100,255,170,0.5)';
+          ctx.shadowBlur = 6;
+          const chars = ['0', '1', 'x', 'n', '{', '}', '[', ']', '='];
+          const char = chars[Math.floor((renderNow / 50 + b.id) % chars.length)];
           ctx.fillText(char, 0, 0);
           ctx.shadowBlur = 0;
-          
+
           if (b.isStrikethrough) {
             ctx.beginPath();
             ctx.moveTo(-b.size/2, 0);
             ctx.lineTo(b.size/2, 0);
-            ctx.strokeStyle = '#e81123';
+            ctx.strokeStyle = '#ff4b4b';
             ctx.lineWidth = 2;
             ctx.stroke();
           }
         } else if (b.type === 'ctrl_c') {
-          ctx.fillStyle = '#666666';
-          ctx.font = 'bold 12px Consolas';
+          ctx.fillStyle = '#a8a8a8';
+          ctx.font = 'bold 12px monospace';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
-          ctx.fillText('[Object]', 0, 0);
+          ctx.fillText('[clone()]', 0, 0);
         } else {
-          ctx.fillStyle = textColor;
+          ctx.fillStyle = b.isCrit ? '#ff6767' : textColor;
           let fontStr = '';
           if (b.isItalic) fontStr += 'italic ';
           if (b.isBold) fontStr += 'bold ';
-          fontStr += `${b.size}px Calibri`;
+          fontStr += `${b.size}px monospace`;
           ctx.font = fontStr;
-          
-          if (b.isCrit) ctx.fillStyle = '#e81123';
-          
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
-          ctx.fillText('文字', 0, 0);
-          
+          ctx.fillText('code', 0, 0);
+
           if (b.isUnderline) {
             ctx.beginPath();
             ctx.moveTo(-10, b.size/2);
             ctx.lineTo(10, b.size/2);
             ctx.strokeStyle = textColor;
             ctx.lineWidth = b.isBold ? 2 : 1;
             ctx.stroke();
           }
         }
-        
+
         ctx.restore();
       });
 
       gameState.aoeWarnings?.forEach((aoe: any) => {
         if (!isVisible(aoe.x - aoe.w/2, aoe.y - aoe.h/2, aoe.w, aoe.h)) return;
         const progress = 1 - (aoe.life / aoe.maxLife);
         ctx.fillStyle = `rgba(255, 0, 0, ${0.1 + progress * 0.3})`;
         ctx.fillRect(aoe.x - aoe.w/2, aoe.y - aoe.h/2, aoe.w, aoe.h);
         ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + progress * 0.5})`;
         ctx.lineWidth = 2;
         ctx.setLineDash([10, 10]);
         ctx.strokeRect(aoe.x - aoe.w/2, aoe.y - aoe.h/2, aoe.w, aoe.h);
         ctx.setLineDash([]);
 
         if (progress > 0.5) {
           ctx.fillStyle = '#ffffff';
           ctx.fillRect(aoe.x, aoe.y, 120, 30);
           ctx.strokeStyle = '#cccccc';
           ctx.strokeRect(aoe.x, aoe.y, 120, 30);
           ctx.fillStyle = '#000000';
           ctx.font = '14px Calibri';
           ctx.textAlign = 'left';
           ctx.textBaseline = 'middle';
           ctx.fillText('🗑️ 删除(D)...', aoe.x + 10, aoe.y + 15);
         }
       });
 
       gameState.lasers?.forEach((l: any) => {
         ctx.save();
         ctx.translate(l.x, l.y);
         ctx.rotate(l.angle);
         
         if (l.type === 'sparkline') {
           const isUlt = l.width > 20; // Heuristic for ult laser
           const isCannon = l.isCannon;
           const alpha = Math.max(0, l.life / l.maxLife);
+          const visibleLaserRange = Math.min(l.range, canvas.width / SCALE + 320); //保留
+          const flow = (renderNow * 0.25) % 8;
           
           const sparklineChars = '01NaNnull{}[]()=>undefinedvoid0xFFerr%$#@!';
           
           if (isCannon) {
             ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
             ctx.shadowBlur = 15;
             ctx.fillStyle = `rgba(50, 50, 50, ${alpha})`;
             ctx.font = 'bold 36px monospace';
-            const charCount = Math.floor(l.range / 20);
+            const charCount = Math.floor(visibleLaserRange / 9);
             for (let i = 0; i < charCount; i++) {
-              const dist = i * 20;
-              const seed = Math.floor(Date.now() / 50) + i;
+              const dist = i * 9 + flow;
+              const seed = Math.floor(renderNow / 50) + i;
               const char = sparklineChars[seed % sparklineChars.length];
-              const yOffset = Math.sin(dist * 0.05 + Date.now() * 0.01) * 15;
+              const yOffset = Math.sin(i * 0.35 + renderNow * 0.015) * 2;
               
               for (let w = -2; w <= 2; w++) {
-                ctx.fillText(char, dist, yOffset + w * 25);
+                ctx.fillText(char, dist, yOffset + w * 18);
               }
             }
           } else {
             ctx.fillStyle = `rgba(30, 30, 30, ${alpha})`;
             ctx.font = '14px monospace';
-            const charCount = Math.floor(l.range / 10);
+            const charCount = Math.floor(visibleLaserRange / 4);
             for (let i = 0; i < charCount; i++) {
-              const dist = i * 10;
-              const seed = Math.floor(Date.now() / 50) + i;
+              const dist = i * 4 + flow;
+              const seed = Math.floor(renderNow / 50) + i;
               const char = sparklineChars[seed % sparklineChars.length];
-              const yOffset = Math.sin(dist * 0.1 + Date.now() * 0.01) * 5;
-              const fade = 1 - (dist / l.range);
+              const yOffset = Math.sin(i * 0.42 + renderNow * 0.02) * 1.2;
+              const fade = 1 - (dist / visibleLaserRange);
               ctx.fillStyle = `rgba(30, 30, 30, ${alpha * fade})`;
               
               const widthMultiplier = isUlt ? 3 : 1;
               for (let w = -widthMultiplier; w <= widthMultiplier; w++) {
                 ctx.fillText(char, dist, yOffset + w * 12);
               }
             }
           }
           
           // Reset shadow
           ctx.shadowBlur = 0;
         } else {
           ctx.fillStyle = `rgba(232, 17, 35, ${l.life / 30})`;
           ctx.font = 'bold 24px Consolas';
           ctx.textAlign = 'left';
           ctx.textBaseline = 'middle';
           ctx.shadowColor = '#e81123';
           ctx.shadowBlur = 10;
           const laserStr = "%***&&%%…………&".repeat(20);
           ctx.fillText(laserStr, 0, 0);
         }
         ctx.restore();
       });
 
       particles.current.forEach(p => {
@@ -3067,156 +3422,160 @@ export default function App() {
         
         ctx.fillStyle = 'rgba(0, 120, 215, 0.2)';
         ctx.fillRect(x, y, w, h);
         ctx.strokeStyle = '#0078d7';
         ctx.lineWidth = 1;
         ctx.strokeRect(x, y, w, h);
       }
 
       if (gameState.bulletTime > 0) {
         ctx.fillStyle = 'rgba(0, 120, 215, 0.1)';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         ctx.fillStyle = '#0078d7';
         ctx.font = 'bold 24px Calibri';
         ctx.textAlign = 'center';
         ctx.fillText('框选网格以删除！', canvas.width/2, 50);
       }
 
       animationFrameId.current = requestAnimationFrame(render);
     };
 
     animationFrameId.current = requestAnimationFrame(render);
 
     return () => {
       if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
     };
-  }, [currentRoom, showGridMenu]);
+  }, [currentRoom, showGridMenu, isCleared]);
 
   if (!currentRoom) {
     return (
       <MainMenu 
         roomInput={roomInput} 
         setRoomInput={setRoomInput} 
         joinRoom={joinRoom} 
       />
     );
   }
 
   const me = uiState?.players[myId];
 
   return (
     <div className="flex flex-col w-full h-screen bg-white font-sans text-[13px] select-none overflow-hidden">
       <div className="bg-[#217346] text-white px-3 py-2 flex justify-between items-center">
         <div className="flex items-center gap-2">
           <span className="font-semibold">{currentRoom} - Excel保卫战</span>
         </div>
         <div className="flex gap-4 text-lg leading-none cursor-default">
           <span className="hover:bg-[#1e6b40] px-2">_</span>
           <span className="hover:bg-[#1e6b40] px-2">□</span>
           <span className="hover:bg-[#e81123] px-2">×</span>
         </div>
       </div>
       
       <div className="bg-[#f3f2f1] border-b border-[#e1dfdd] flex flex-col">
         <div className="flex gap-1 px-2 pt-1 text-gray-600">
           <span className="px-3 py-1 bg-white border border-[#e1dfdd] border-b-white -mb-[1px] z-10 text-[#217346] font-semibold">开始</span>
         </div>
         <div className="bg-white px-4 py-2 flex gap-6 items-center border-t border-[#e1dfdd]">
           <div className="flex flex-col items-center gap-1">
             <div className="flex gap-1">
               <span className={`font-bold font-serif border px-2 py-0.5 ${me?.generalUpgrades.includes('bold') ? 'bg-gray-200 border-gray-400' : 'border-transparent text-gray-400'}`}>B</span>
               <span className={`italic font-serif border px-2 py-0.5 ${me?.generalUpgrades.includes('italic') ? 'bg-gray-200 border-gray-400' : 'border-transparent text-gray-400'}`}>I</span>
               <span className={`underline font-serif border px-2 py-0.5 ${me?.generalUpgrades.includes('underline') ? 'bg-gray-200 border-gray-400' : 'border-transparent text-gray-400'}`}>U</span>
               <span className={`line-through font-serif border px-2 py-0.5 ${me?.generalUpgrades.includes('strikethrough') ? 'bg-gray-200 border-gray-400' : 'border-transparent text-gray-400'}`}>ab</span>
               <span className={`font-serif border px-2 py-0.5 bg-yellow-100 ${me?.generalUpgrades.includes('highlight') ? 'border-yellow-400' : 'border-transparent text-gray-400'}`}>A</span>
             </div>
             <span className="text-[10px] text-gray-500">已激活技能</span>
           </div>
           <div className="w-px h-8 bg-gray-300"></div>
           <div className="flex flex-col items-center gap-1">
             <span className="text-gray-700 font-semibold">第 {uiState?.stage || 1} 关</span>
-            <span className="text-[10px] text-gray-500">生存进度: {Math.floor((uiState?.stageTimer || 0) / 60)}s / {getStageDuration(uiState?.stage || 1)}s</span>
+            <span className="text-[10px] text-gray-500">生存进度: {Math.floor((uiState?.stageTimer || 0) / 60)}s / {getStageDuration(uiState?.stage || 1)}s · 总关卡 {TOTAL_STAGES}</span>
           </div>
         </div>
       </div>
 
       <div className="flex items-center gap-2 px-2 py-1 border-b border-[#e1dfdd] bg-white">
         <div className="w-20 text-center border border-[#e1dfdd] bg-white shadow-inner py-0.5 text-gray-700">
           {me ? `HP:${Math.floor(me.hp)}` : 'A1'}
         </div>
         <div className="text-gray-400 font-serif italic font-bold text-base px-1">fx</div>
         <div className="flex-1 border border-[#e1dfdd] px-2 py-0.5 bg-white shadow-inner font-mono text-gray-700">
           {me ? `=玩家(击杀:${me.kills}, 死亡:${me.deaths})` : '=正在加载...'}
         </div>
       </div>
 
       <div className="flex-1 relative w-full h-full bg-[#f3f2f1]" ref={containerRef}>
         <canvas
           ref={canvasRef}
           className="absolute inset-0 block"
           style={{ cursor: 'crosshair' }}
         />
         
-        {me?.hp <= 0 && (
+        {me?.hp <= 0 && !isCleared && (
           <GameOver stageTimer={uiState?.stageTimer || 0} onRestart={() => window.location.reload()} />
         )}
 
+        {isCleared && (
+          <GameClear score={finalScore} kills={me?.kills || 0} deaths={me?.deaths || 0} onRestart={() => window.location.reload()} />
+        )}
+
         {me?.generalUpgrades.includes('sum') && (
           <SumSkillOverlay 
             sumStacks={me.sumStacks || 0} 
             knockbackMult={me.knockbackMult || 1} 
             sizeMult={me.sizeMult || 1} 
             eliteDamageMult={me.eliteDamageMult || 1} 
           />
         )}
 
         {(me?.gridToolCharges ?? 0) > 0 && (
           <GridToolOverlay charges={me!.gridToolCharges!} />
         )}
 
         {showGridMenu && (
           <GridMenu 
             pos={gridMenuPos} 
             onAction={handleGridAction} 
             onCancel={() => {
               setShowGridMenu(false);
               if (gameStateRef.current) gameStateRef.current.bulletTime = 0;
             }} 
           />
         )}
 
         {uiState?.isSelectingForm && (
           <FormSelection 
             formChoices={uiState.formChoices} 
             onSelect={handleSelectForm} 
           />
         )}
 
         {uiState?.isSelectingSkill && (
           <UpgradeSelection 
             stage={uiState.stage} 
             upgradeChoices={uiState.skillChoices} 
             upgradesToChoose={me?.upgradesToChoose || 1}
             onSelect={handleSelectUpgrade} 
           />
         )}
       </div>
 
       <div className="bg-[#f3f2f1] border-t border-[#e1dfdd] flex items-center px-2 py-1 text-sm text-gray-600">
         <div className="flex gap-1">
-          {[1, 2, 3, 4, 5].map(sheetNum => (
+          {Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1).map(sheetNum => (
             <div 
               key={sheetNum}
-              className={`px-4 py-1 cursor-default ${(uiState?.stage || 1) === sheetNum || ((uiState?.stage || 1) > 5 && sheetNum === 5) ? 'bg-white border-b-2 border-[#217346] font-semibold text-[#217346]' : 'hover:bg-gray-200'}`}
+              className={`px-3 py-1 cursor-default ${(uiState?.stage || 1) === sheetNum ? 'bg-white border-b-2 border-[#217346] font-semibold text-[#217346]' : 'hover:bg-gray-200'}`}
             >
-              Sheet{sheetNum}{((uiState?.stage || 1) > 5 && sheetNum === 5) ? ' (Endless)' : ''}
+              Sheet{sheetNum}
             </div>
           ))}
         </div>
         <div className="ml-auto flex gap-4 px-4">
           <span>就绪</span>
           <span>100%</span>
         </div>
       </div>
     </div>
   );
 }
diff --git a/src/components/UI.tsx b/src/components/UI.tsx
index da6252943dbb17ca7ad5c359ba482a51cd0b7f59..8b06b5d060ceda06b4c8dac3675ab894b1737c8a 100644
--- a/src/components/UI.tsx
+++ b/src/components/UI.tsx
@@ -1,44 +1,61 @@
 import React from 'react';
 import { AttackForm, Upgrade, ATTACK_FORM_NAMES, ATTACK_FORM_DESCS, UPGRADE_NAMES, UPGRADE_DESCS } from '../gameLogic';
 
 export const GameOver: React.FC<{ stageTimer: number; onRestart: () => void }> = ({ stageTimer, onRestart }) => (
   <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
     <div className="bg-white p-8 border border-[#c8c6c4] shadow-xl flex flex-col items-center max-w-md w-full">
       <div className="text-4xl mb-4">⚠️</div>
       <h2 className="text-2xl font-bold text-[#e81123] mb-2">#VALUE! (你死了)</h2>
       <p className="text-gray-600 mb-6 text-center">你的单元格已被清空。生存时间: {Math.floor(stageTimer / 60)}s</p>
       <button 
         className="px-6 py-2 bg-[#217346] text-white font-bold hover:bg-[#1e603b] transition-colors"
         onClick={onRestart}
       >
         重新开始
       </button>
     </div>
   </div>
 );
 
+export const GameClear: React.FC<{ score: number; kills: number; deaths: number; onRestart: () => void }> = ({ score, kills, deaths, onRestart }) => (
+  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
+    <div className="bg-white p-8 border border-[#c8c6c4] shadow-xl flex flex-col items-center max-w-md w-full">
+      <div className="text-4xl mb-4">🏆</div>
+      <h2 className="text-2xl font-bold text-[#107c41] mb-2">恭喜通关！</h2>
+      <p className="text-gray-700 mb-1">总分：<span className="font-bold">{score}</span></p>
+      <p className="text-gray-600 mb-6 text-center">击杀: {kills} / 死亡: {deaths}</p>
+      <button
+        className="px-6 py-2 bg-[#217346] text-white font-bold hover:bg-[#1e603b] transition-colors"
+        onClick={onRestart}
+      >
+        再来一局
+      </button>
+    </div>
+  </div>
+);
+
 export const FormSelection: React.FC<{
   formChoices: AttackForm[];
   onSelect: (form: AttackForm) => void;
 }> = ({ formChoices, onSelect }) => {
   return (
     <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
       <div className="bg-white p-6 rounded shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
         <h2 className="text-2xl font-bold mb-2 text-gray-800 shrink-0">选择你的攻击形态</h2>
         <p className="text-gray-600 mb-6 shrink-0">一局内无法更换，请谨慎选择</p>
         
         <div className="grid grid-cols-1 gap-4 overflow-y-auto flex-1 pr-2">
           {formChoices.map(form => (
             <button 
               key={form}
               onClick={() => onSelect(form)}
               className="flex flex-col items-start p-4 border border-gray-300 hover:border-[#217346] hover:bg-green-50 transition-colors text-left"
             >
               <span className="font-bold text-lg text-[#217346]">{ATTACK_FORM_NAMES[form]}</span>
               <span className="text-gray-600 mt-1">{ATTACK_FORM_DESCS[form]}</span>
             </button>
           ))}
         </div>
       </div>
     </div>
   );
diff --git a/src/gameLogic.ts b/src/gameLogic.ts
index 5cb5d7a74eb280d92727fd4ada07508e6d7f6be8..ac35475b7c48dac2efe430d88141925ba38a1b3a 100644
--- a/src/gameLogic.ts
+++ b/src/gameLogic.ts
@@ -1,36 +1,40 @@
 export type AttackForm = 'wordart' | 'sparkline' | 'comment' | 'array';
 
 export type SpecificUpgrade = 
   | 'wordart_size' | 'wordart_weight' | 'wordart_spread' | 'wordart_title' | 'wordart_ult'
   | 'sparkline_width' | 'sparkline_focus' | 'sparkline_bounce' | 'sparkline_rapid' | 'sparkline_ult'
   | 'comment_size' | 'comment_chain' | 'comment_residue' | 'comment_fast' | 'comment_ult'
   | 'array_count' | 'array_split' | 'array_track' | 'array_fast' | 'array_ult'
   | 'wordart_wide' | 'wordart_fast_push' | 'wordart_shield' | 'wordart_stun' | 'wordart_quad' | 'wordart_pile_driver' | 'wordart_column_freeze'
   | 'array_plus_2' | 'array_rapid' | 'array_bounce' | 'array_pierce' | 'array_big' | 'array_spreadsheet'
   | 'sparkline_freeze' | 'sparkline_cannon' | 'sparkline_reflect' | 'sparkline_overclock' | 'sparkline_burn_stack' | 'sparkline_overload'
-  | 'comment_triple' | 'comment_knockback' | 'comment_split' | 'comment_black' | 'comment_super' | 'comment_gravity_well';
+  | 'comment_triple' | 'comment_knockback' | 'comment_split' | 'comment_black' | 'comment_super' | 'comment_gravity_well'
+  | 'wordart_all_caps' | 'wordart_hotkey' | 'wordart_typewriter' | 'wordart_revision' | 'wordart_subscript'
+  | 'sparkline_burn' | 'sparkline_killshot' | 'sparkline_execute' | 'sparkline_tenshot' | 'sparkline_charge'
+  | 'comment_density' | 'comment_mark' | 'comment_wallbounce' | 'comment_proximity' | 'comment_battery'
+  | 'array_ricochet' | 'array_converge' | 'array_single' | 'array_orbit' | 'array_scatter';
 
 export type GeneralUpgrade = 'bold' | 'underline' | 'highlight' | 'rand' | 'vlookup' | 'sum' | 'italic' | 'strikethrough' | 'ctrl_c' | 'ctrl_z' | 'format_painter';
 
 export type Upgrade = SpecificUpgrade | GeneralUpgrade;
 
 export const ATTACK_FORM_NAMES: Record<AttackForm, string> = {
   wordart: '艺术字 (WordArt)',
   sparkline: '迷你图 (Sparkline)',
   comment: '批注/报错框 (Comment)',
   array: '数组/自动填充 (Array)'
 };
 
 export const ATTACK_FORM_DESCS: Record<AttackForm, string> = {
   wordart: '发射巨大的文字推图机，缓慢推进并强制推走敌人，推到墙边直接秒杀',
   sparkline: '发射高频穿透地形的无限距离激光，无击退但可减速',
   comment: '投掷会爆炸的批注框，造成范围击退并留下持续伤害区域',
   array: '发射常规文字子弹，属性均衡，适合穿透和分裂'
 };
 
 export const UPGRADE_NAMES: Record<Upgrade, string> = {
   wordart_size: '字号 (Size)',
   wordart_weight: '字重 (Weight)',
   wordart_spread: '段落扩散 (Spread)',
   wordart_title: '标题编排 (Title)',
   wordart_ult: 'WordArt (终极)',
@@ -46,50 +50,70 @@ export const UPGRADE_NAMES: Record<Upgrade, string> = {
   comment_ult: '#VALUE! (终极)',
   array_count: '扩列 (Expand)',
   array_split: '自动填充 (AutoFill)',
   array_track: '智能填充 (SmartFill)',
   array_fast: '高速填充 (FastFill)',
   array_ult: 'RANDARRAY (终极)',
   wordart_wide: '啊啊啊啊啊',
   wordart_fast_push: '推动加速',
   wordart_shield: '文字护盾',
   wordart_stun: '震慑排版',
   wordart_quad: '四面大字',
   array_plus_2: '弹道 +2',
   array_rapid: '高速填充',
   array_bounce: '墙体反弹',
   array_pierce: '无限穿透',
   array_big: '大号单元格',
   sparkline_freeze: '冻结射线',
   sparkline_cannon: '激光炮',
   sparkline_reflect: '反射',
   sparkline_overclock: '超频',
   comment_triple: '三连投',
   comment_knockback: '强力击飞',
   comment_split: '分裂炸弹',
   comment_black: '炸黑了',
   comment_super: '超级炸弹',
+  wordart_all_caps: '全大写',
+  wordart_hotkey: '快捷键',
+  wordart_typewriter: '打字机',
+  wordart_revision: '修订标记',
+  wordart_subscript: '下标',
+  sparkline_burn: '灼烧叠层',
+  sparkline_killshot: '击杀闪光',
+  sparkline_execute: '立即执行',
+  sparkline_tenshot: '十连',
+  sparkline_charge: '充能发射',
+  comment_density: '密度加成',
+  comment_mark: '未解决批注',
+  comment_wallbounce: '墙面反弹',
+  comment_proximity: '近爆引信',
+  comment_battery: '电池批注',
+  array_ricochet: '连续引用',
+  array_converge: '汇聚公式',
+  array_single: '单元格模式',
+  array_orbit: '轨道防御',
+  array_scatter: '扩散填充',
   bold: '加粗 (Bold)',
   italic: '斜体 (Italic)',
   underline: '下划线 (Underline)',
   strikethrough: '删除线 (Strikethrough)',
   highlight: '高亮 (Highlight)',
   rand: '=RAND() 随机数',
   vlookup: '=VLOOKUP() 查找',
   sum: '=SUM() 求和',
   ctrl_c: 'Ctrl+C 复制',
   ctrl_z: 'Ctrl+Z 撤销',
   format_painter: '格式刷 (Format Painter)'
 };
 
 export const UPGRADE_DESCS: Record<Upgrade, string> = {
   wordart_size: '大标题宽度 +50%，伤害 +25%',
   wordart_weight: '大标题推进速度加快，推力更强',
   wordart_spread: '大标题命中敌人时，有概率向两侧发射小号文字',
   wordart_title: '每第3发变成超宽大标题，伤害2.5倍，无限穿透',
   wordart_ult: '每5秒全屏发射巨型大标题清场，伤害150，对精英1.5倍伤害',
   sparkline_width: '激光加粗，伤害 +20%',
   sparkline_focus: '激光附带强力减速效果',
   sparkline_bounce: '激光命中第一个敌人时会折射出一条新的激光',
   sparkline_rapid: '激光发射频率大幅提升',
   sparkline_ult: '每次发射3道激光，主激光极宽',
   comment_size: '爆炸半径 +30%，伤害 +20%',
@@ -99,139 +123,169 @@ export const UPGRADE_DESCS: Record<Upgrade, string> = {
   comment_ult: '每第4次爆炸变成大崩溃爆炸，范围极大',
   array_count: '子弹数 +2，扇形角度 +6°',
   array_split: '每发子弹在命中或飞行结束时分裂成3个小碎片',
   array_track: '获得轻度追踪，追踪半径160',
   array_fast: '冷却 -18%，飞行速度 +15%',
   array_ult: '每3秒向四周发射一圈子弹(16发)',
   wordart_wide: '【啊啊啊啊啊】推出去的文字横向变宽',
   wordart_fast_push: '【推动加速】推着敌人往前走的速度更快',
   wordart_shield: '【文字护盾】大字可抵挡敌方子弹，射速-20%，移速额外-10%',
   wordart_stun: '【震慑排版】未击杀目标时50%概率眩晕1秒',
   wordart_quad: '【四面大字】每20秒向四个方向各发射一个大字',
   array_plus_2: '【弹道 +2】子弹数量 +2',
   array_rapid: '【高速填充】射速 x1.5',
   array_bounce: '【墙体反弹】子弹碰到墙壁可反弹1次',
   array_pierce: '【无限穿透】子弹获得无限穿透',
   array_big: '【大号单元格】子弹体积 x2',
   sparkline_freeze: '【冻结射线】命中时5%概率冰冻敌人',
   sparkline_cannon: '【激光炮】每30秒发射极粗激光秒杀非BOSS，随后1.5秒无法发射普通激光',
   sparkline_reflect: '【反射】激光击中墙壁后反射1次',
   sparkline_overclock: '【超频】激光射速 x2',
   comment_triple: '【三连投】一次扔出3颗炸弹，攻速降低20%',
   comment_knockback: '【强力击飞】炸弹击飞距离增加100%',
   comment_split: '【分裂炸弹】碰到敌人后分裂成3颗炸弹',
   comment_black: '【炸黑了】爆炸后把地面炸黑(视觉效果)',
   comment_super: '【超级炸弹】每30秒扔出巨大炸弹，秒杀普通/精英怪，并附加减速和灼烧',
+  wordart_all_caps: 'WordArt形态移速惩罚从-30%降为-10%',
+  wordart_hotkey: '压墙击杀后，下一发忽略冷却立即可发',
+  wordart_typewriter: '子弹从30%体积飞行中线性增长至200%，碰撞体积同步变化',
+  wordart_revision: '大字命中精英/Boss时施加"修订"标记5秒，标记期间该目标受所有伤害来源+35%',
+  wordart_subscript: '每次发射同时在玩家下方60px发射40%大小副弹（伤害40%，相同穿透），不消耗CD',
+  sparkline_burn: '激光持续命中同一目标叠灼烧（每秒+1层，最多8层，每层+5伤/秒），离开后每3秒-1层',
+  sparkline_killshot: '激光击杀敌人后300ms内，下一束激光伤害×3（触发即消耗）',
+  sparkline_execute: '激光对HP低于25%的非Boss敌人造成3倍伤害',
+  sparkline_tenshot: '每连续命中10次后，下次命中触发确定3倍暴击（非随机，触发即重置计数）',
+  sparkline_charge: '不射击时每秒积累1格充能（最多3格），射击时消耗全部，激光伤害×(1+格数×0.7)',
+  comment_density: '爆炸范围内每多1个敌人，所有命中者额外+15%伤害（最多+75%）',
+  comment_mark: '爆炸后范围内存活的敌人被标记4秒，受下次爆炸+80%伤害（消耗标记）',
+  comment_wallbounce: '炸弹碰到边界或障碍物时反弹一次继续飞行，不提前爆炸（限1次）',
+  comment_proximity: '炸弹飞行中任意敌人进入40px范围内立即触发爆炸',
+  comment_battery: '每次爆炸命中至少1个敌人，立即回复玩家2%最大HP',
+  array_ricochet: '每次击杀敌人：本次飞行速度+20%、穿透+1（各上限累计+3）',
+  array_converge: '所有子弹飞出300px后向发射中心线收拢，远处集中打同一目标',
+  array_single: '强制只发射1颗子弹，伤害=当前所有子弹总和×0.8，速度×1.5',
+  array_orbit: '玩家周围持续绕行8颗微型子弹，触碰敌人造成5伤害并推开',
+  array_scatter: '子弹命中敌人时，在命中点生成2颗随机方向弹片（伤害30%，无穿透）',
   bold: '直接伤害 +30%，击退 +6px',
   italic: '飞行速度 +15%，射速 +10%',
   underline: '攻击留下1.4秒拖尾/残痕，伤害7/s',
   strikethrough: '穿透 +1，直接秒杀生命值低于20%的非Boss敌人 (斩杀)',
   highlight: '命中后生成50px高亮区，持续2.5秒，区域内敌人受到伤害增加50% (易伤)',
   rand: '15%概率暴击，暴击倍率2.4x',
   vlookup: '对精英/Boss伤害+15%，投射物获得轻度追踪，激光对目标有轻微吸附',
   sum: '当前波次内：每击杀10个敌人，本波伤害+3%(上限+24%)，下波清零',
   ctrl_c: '每次攻击有20%概率额外发射一团乱码(多重射击)',
   ctrl_z: '受到致命伤时免死，恢复30%血量并无敌2秒 (每局限1次)',
   format_painter: '击中敌人时，有20%概率在敌人脚下生成一个格式刷区域，减速并造成持续伤害'
 };
 
 export interface Player {
   id: string;
   x: number;
   y: number;
   hp: number;
   maxHp: number;
   angle: number;
   isShooting: boolean;
   keys: { w: boolean; a: boolean; s: boolean; d: boolean };
   attackForm: AttackForm | null;
   specificUpgrades: SpecificUpgrade[];
   generalUpgrades: GeneralUpgrade[];
   lastShot: number;
   lastLaser: number;
   lastWordart?: number;
   lastWordartUlt?: number;
   lastWordartQuad?: number;
   lastArrayUlt?: number;
   lastCommentUlt?: number;
   lastCommentSuper?: number;
   sparklineVacuumUntil?: number;
   lastSparklineCannon?: number;
   kills: number;
   sumKills: number;
   deaths: number;
   readyForNextStage: boolean;
   invincibleUntil: number;
   sumStacks?: number;
   knockbackMult?: number;
   sizeMult?: number;
   eliteDamageMult?: number;
   wordartCounter: number;
   commentCounter: number;
   ctrlZUsed?: boolean;
   gridToolCharges?: number;
   upgradesToChoose?: number;
+  laserCharge?: number;
+  lastChargeTime?: number;
+  lasersHit?: number;
+  nextLaserCrit?: boolean;
+  killshotUntil?: number;
+  orbitAngle?: number;
 }
 
 export interface AoeWarning {
   id: number;
   x: number;
   y: number;
   w: number;
   h: number;
   type: 'rect' | 'row' | 'col';
   life: number;
   maxLife: number;
 }
 
 export type EnemyType = 'Minion' | 'Elite' | 'MiniBoss' | 'EliteBoss' | 'Value' | 'FormatBrush' | 'FreezeCell' | 'ProtectedView' | 'MergedCell' | 'SplitCell' | 'REF' | 'VLOOKUP' | 'MACRO' | 'MINION';
 
 export interface Enemy {
   id: number;
   x: number;
   y: number;
   hp: number;
   maxHp: number;
   type: EnemyType;
   vx: number;
   vy: number;
   knockbackX: number;
   knockbackY: number;
   text: string;
   width: number;
   height: number;
   speed: number;
   weight: number;
   state?: 'idle' | 'warning' | 'dashing' | 'aiming' | 'firing' | 'stunned';
   stateTimer?: number;
   dashTargetX?: number;
   dashTargetY?: number;
   facingAngle?: number;
   lastAttack?: number;
   isBuffed?: boolean;
   crushCooldown?: number;
   crushCount?: number;
+  burnStacks?: number;
+  annotateMark?: number;
+  commentMark?: number;
+  revisionMark?: number;
 }
 
 export interface EnemyBullet {
   id: number;
   x: number;
   y: number;
   vx: number;
   vy: number;
   damage: number;
   life: number;
   size: number;
   type: 'value' | 'row' | 'col' | 'ref' | 'vlookup';
 }
 
 export interface Puddle {
   id: number;
   x: number;
   y: number;
   radius: number;
   type: 'formatPaint' | 'freeze' | 'highlight' | 'explosion' | 'blacken' | 'burn_slow';
   life: number;
   maxLife: number;
   damage?: number;
   owner?: string;
 }
@@ -250,50 +304,59 @@ export interface Bullet {
   pierce: number;
   type: string;
   isCrit?: boolean;
   knockback?: number;
   isTitle?: boolean;
   eliteDamageMult?: number;
   explosionRadius?: number;
   isUlt?: boolean;
   splitsLeft?: number;
   trackRadius?: number;
   leavesResidue?: boolean;
   isHighlight?: boolean;
   bouncesLeft?: number;
   isItalic?: boolean;
   isStrikethrough?: boolean;
   isBlacken?: boolean;
   chainDepth?: number;
   isBulldozer?: boolean;
   hitTargets?: Set<number>;
   angle?: number;
   width?: number;
   height?: number;
   isShield?: boolean;
   stunChance?: number;
   isSuper?: boolean;
+  typewriterScale?: number;
+  initialAngle?: number;
+  travelDist?: number;
+  ricochetSpeed?: number;
+  ricochetPierce?: number;
+  isOrbit?: boolean;
+  initialWidth?: number;
+  initialHeight?: number;
+  wallBounced?: boolean;
 }
 
 export interface Laser {
   id: number;
   owner: string;
   x: number;
   y: number;
   angle: number;
   damage: number;
   width: number;
   range: number;
   life: number;
   maxLife: number;
   type: string;
   isCrit?: boolean;
   isStrikethrough?: boolean;
   eliteDamageMult?: number;
   bouncesLeft?: number;
   hasHit?: boolean;
   isHighlight?: boolean;
   leavesResidue?: boolean;
   hitTargets?: Set<number>;
   isCannon?: boolean;
 }
 
@@ -368,51 +431,177 @@ export const MAPS: MapDef[] = [
     bushes: [
       { x: 1000, y: 1000, w: 300, h: 300 }, { x: 1700, y: 1700, w: 300, h: 300 }
     ],
     spawners: [
       { x: 1500, y: 200 }, { x: 1500, y: 2800 },
       { x: 200, y: 1500 }, { x: 2800, y: 1500 },
       { x: 200, y: 200 }, { x: 2800, y: 2800 }
     ],
     playerSpawn: { x: 1500, y: 1100 }
   },
   {
     width: 3000, height: 3000,
     obstacles: [
       { x: 0, y: 0, w: 3000, h: 100 },
       { x: 0, y: 2900, w: 3000, h: 100 },
       { x: 0, y: 0, w: 100, h: 3000 },
       { x: 2900, y: 0, w: 100, h: 3000 },
     ],
     bushes: [],
     spawners: [
       { x: 300, y: 300 }, { x: 1500, y: 300 }, { x: 2700, y: 300 },
       { x: 300, y: 1500 }, { x: 2700, y: 1500 },
       { x: 300, y: 2700 }, { x: 1500, y: 2700 }, { x: 2700, y: 2700 }
     ],
     playerSpawn: { x: 1500, y: 1500 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 500, y: 900, w: 2000, h: 120 },
+      { x: 500, y: 1980, w: 2000, h: 120 },
+      { x: 1450, y: 1020, w: 100, h: 960 }
+    ],
+    bushes: [{ x: 1380, y: 1400, w: 240, h: 200 }],
+    spawners: [{ x: 250, y: 250 }, { x: 2750, y: 250 }, { x: 250, y: 2750 }, { x: 2750, y: 2750 }],
+    playerSpawn: { x: 1500, y: 1500 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 700, y: 700, w: 200, h: 1600 },
+      { x: 2100, y: 700, w: 200, h: 1600 },
+      { x: 900, y: 700, w: 1200, h: 200 },
+      { x: 900, y: 2100, w: 1200, h: 200 }
+    ],
+    bushes: [{ x: 1300, y: 1300, w: 400, h: 400 }],
+    spawners: [{ x: 1500, y: 250 }, { x: 1500, y: 2750 }, { x: 300, y: 1500 }, { x: 2700, y: 1500 }],
+    playerSpawn: { x: 1500, y: 1500 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 450, y: 450, w: 450, h: 450 }, { x: 2100, y: 450, w: 450, h: 450 },
+      { x: 450, y: 2100, w: 450, h: 450 }, { x: 2100, y: 2100, w: 450, h: 450 },
+      { x: 1200, y: 1200, w: 600, h: 600 }
+    ],
+    bushes: [],
+    spawners: [{ x: 1500, y: 200 }, { x: 1500, y: 2800 }, { x: 200, y: 1500 }, { x: 2800, y: 1500 }],
+    playerSpawn: { x: 1500, y: 980 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 0, y: 1300, w: 1200, h: 120 },
+      { x: 1800, y: 1300, w: 1200, h: 120 },
+      { x: 0, y: 1580, w: 1200, h: 120 },
+      { x: 1800, y: 1580, w: 1200, h: 120 },
+      { x: 1380, y: 600, w: 240, h: 1800 }
+    ],
+    bushes: [{ x: 1280, y: 1360, w: 440, h: 280 }],
+    spawners: [{ x: 200, y: 200 }, { x: 2800, y: 200 }, { x: 200, y: 2800 }, { x: 2800, y: 2800 }],
+    playerSpawn: { x: 1500, y: 1500 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 600, y: 600, w: 1800, h: 120 },
+      { x: 600, y: 2280, w: 1800, h: 120 },
+      { x: 600, y: 720, w: 120, h: 1560 },
+      { x: 2280, y: 720, w: 120, h: 1560 },
+      { x: 1200, y: 1200, w: 600, h: 600 }
+    ],
+    bushes: [],
+    spawners: [{ x: 300, y: 1500 }, { x: 2700, y: 1500 }, { x: 1500, y: 300 }, { x: 1500, y: 2700 }],
+    playerSpawn: { x: 1500, y: 900 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 900, y: 0, w: 140, h: 1300 },
+      { x: 900, y: 1700, w: 140, h: 1300 },
+      { x: 1960, y: 0, w: 140, h: 1300 },
+      { x: 1960, y: 1700, w: 140, h: 1300 },
+      { x: 1200, y: 1380, w: 600, h: 240 }
+    ],
+    bushes: [{ x: 1220, y: 1400, w: 560, h: 200 }],
+    spawners: [{ x: 200, y: 300 }, { x: 2800, y: 300 }, { x: 200, y: 2700 }, { x: 2800, y: 2700 }],
+    playerSpawn: { x: 1500, y: 1500 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 400, y: 400, w: 500, h: 220 },
+      { x: 2100, y: 400, w: 500, h: 220 },
+      { x: 400, y: 2380, w: 500, h: 220 },
+      { x: 2100, y: 2380, w: 500, h: 220 },
+      { x: 1200, y: 850, w: 600, h: 1300 }
+    ],
+    bushes: [],
+    spawners: [{ x: 1500, y: 150 }, { x: 1500, y: 2850 }, { x: 150, y: 1500 }, { x: 2850, y: 1500 }],
+    playerSpawn: { x: 950, y: 1500 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 0, y: 0, w: 3000, h: 100 },
+      { x: 0, y: 2900, w: 3000, h: 100 },
+      { x: 0, y: 0, w: 100, h: 3000 },
+      { x: 2900, y: 0, w: 100, h: 3000 },
+      { x: 700, y: 700, w: 1600, h: 80 },
+      { x: 700, y: 2220, w: 1600, h: 80 }
+    ],
+    bushes: [{ x: 1300, y: 1250, w: 400, h: 500 }],
+    spawners: [{ x: 300, y: 300 }, { x: 2700, y: 300 }, { x: 300, y: 2700 }, { x: 2700, y: 2700 }],
+    playerSpawn: { x: 1500, y: 1500 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 500, y: 500, w: 2000, h: 180 },
+      { x: 500, y: 2320, w: 2000, h: 180 },
+      { x: 500, y: 680, w: 180, h: 1640 },
+      { x: 2320, y: 680, w: 180, h: 1640 },
+      { x: 1300, y: 1200, w: 400, h: 600 }
+    ],
+    bushes: [],
+    spawners: [{ x: 1500, y: 250 }, { x: 1500, y: 2750 }, { x: 250, y: 1500 }, { x: 2750, y: 1500 }],
+    playerSpawn: { x: 900, y: 900 }
+  },
+  {
+    width: 3000, height: 3000,
+    obstacles: [
+      { x: 800, y: 800, w: 500, h: 500 },
+      { x: 1700, y: 800, w: 500, h: 500 },
+      { x: 800, y: 1700, w: 500, h: 500 },
+      { x: 1700, y: 1700, w: 500, h: 500 }
+    ],
+    bushes: [{ x: 1400, y: 1400, w: 200, h: 200 }],
+    spawners: [{ x: 200, y: 200 }, { x: 2800, y: 200 }, { x: 200, y: 2800 }, { x: 2800, y: 2800 }, { x: 1500, y: 200 }, { x: 1500, y: 2800 }],
+    playerSpawn: { x: 1500, y: 1500 }
   }
+
 ];
 
 export interface Room {
   id: string;
   players: Record<string, Player>;
   enemies: Enemy[];
   bullets: Bullet[];
   enemyBullets: EnemyBullet[];
   puddles: Puddle[];
   aoeWarnings: AoeWarning[];
   lasers: Laser[];
   items: any[];
   stage: number;
   stageTimer: number;
   isSelectingSkill: boolean;
   isSelectingForm: boolean;
   skillChoices: Upgrade[];
   formChoices: AttackForm[];
   bulletTime: number;
   enemyIdCounter: number;
   bulletIdCounter: number;
   enemyBulletIdCounter: number;
   puddleIdCounter: number;
   aoeIdCounter: number;
   itemIdCounter: number;
