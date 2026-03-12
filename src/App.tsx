import React, { useEffect, useRef, useState } from 'react';
import { AttackForm, Upgrade, SpecificUpgrade, GeneralUpgrade, Player, Enemy, Bullet, MAPS, Room, createRoom, EnemyType, ATTACK_FORM_NAMES, ATTACK_FORM_DESCS, UPGRADE_NAMES, UPGRADE_DESCS } from './gameLogic';
import { MainMenu } from './components/MainMenu';
import { GameOver, GameClear, FormSelection, UpgradeSelection, SumSkillOverlay, GridMenu, GridToolOverlay } from './components/UI';
import { attachInputHandlers } from './modules/inputHandlers';
import { applyGridAction, applySelectedForm, applySelectedUpgrade } from './modules/combatHandlers';
import { clampGridMenuPosToViewport } from './modules/renderUtils';

const TOTAL_STAGES = 15;

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
    'wordart_all_caps', 'wordart_hotkey', 'wordart_typewriter', 'wordart_revision', 'wordart_subscript',
    'sparkline_width', 'sparkline_focus', 'sparkline_bounce', 'sparkline_rapid', 'sparkline_ult',
    'sparkline_freeze', 'sparkline_cannon', 'sparkline_reflect', 'sparkline_overclock',
    'sparkline_burn', 'sparkline_killshot', 'sparkline_execute', 'sparkline_tenshot', 'sparkline_charge',
    'comment_size', 'comment_chain', 'comment_residue', 'comment_fast', 'comment_ult',
    'comment_triple', 'comment_knockback', 'comment_split', 'comment_black', 'comment_super',
    'comment_density', 'comment_mark', 'comment_wallbounce', 'comment_proximity', 'comment_battery',
    'array_count', 'array_split', 'array_track', 'array_fast', 'array_ult',
    'array_plus_2', 'array_rapid', 'array_bounce', 'array_pierce', 'array_big',
    'array_ricochet', 'array_converge', 'array_single', 'array_orbit', 'array_scatter'
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

  const numChoices = room.stage <= 4 ? 5 : 3;

  while (choices.length < numChoices && pool.length > 0) {
    const specificInPool = pool.filter(u => availableSpecific.includes(u as SpecificUpgrade));
    const generalInPool = pool.filter(u => availableGeneral.includes(u as GeneralUpgrade));
    
    let choice: Upgrade;
    // Prioritize specific upgrades in early game
    const specificChance = room.stage <= 4 ? 0.92 : 0.4;
    
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
  const [isCleared, setIsCleared] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const isSelectingGridRef = useRef(false);
  const selectionStartRef = useRef<{x: number, y: number} | null>(null);
  const selectionEndRef = useRef<{x: number, y: number} | null>(null);

  const clampGridMenuPos = (x: number, y: number) => {
    const maxW = containerRef.current?.clientWidth || window.innerWidth;
    const maxH = containerRef.current?.clientHeight || window.innerHeight;
    return clampGridMenuPosToViewport(x, y, maxW, maxH);
  };

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
        commentCounter: 0,
        laserCharge: 0,
        lastChargeTime: 0,
        lasersHit: 0,
        nextLaserCrit: false
      };
      gameStateRef.current = room;
      setCurrentRoom(roomInput.trim());
    }
  };

  useEffect(() => {
    return attachInputHandlers({
      keys,
      mouse,
      gameStateRef,
      containerRef,
      selectionStartRef,
      selectionEndRef,
      isSelectingGridRef,
      showGridMenu,
      setShowGridMenu,
      setGridMenuPos,
      clampGridMenuPos,
      myId
    });
  }, [showGridMenu]);

  // Game Loop
  useEffect(() => {
    if (!currentRoom) return;

    let tick = 0;
    let lastUiUpdate = 0;
    let lastIsSelecting = false;
    let lastIsSelectingForm = false;

    const gameLoop = () => {
      const room = gameStateRef.current;
      if (!room) return;

      tick++;
      const now = renderNow;
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

      if (isCleared || room.isSelectingSkill || room.isSelectingForm) return;

      room.stageTimer++;
      if (room.bulletTime > 0) room.bulletTime--;

      const timeSpeed = room.bulletTime > 0 ? 0.1 : 1.0;
      let stageDuration = 3600;
      if (room.stage === 1) stageDuration = 1800;
      else if (room.stage === 2) stageDuration = 2400;
      else if (room.stage === 3) stageDuration = 3000;

      room.margin = 0;

      if (room.stageTimer >= stageDuration) {
        if (room.stage >= TOTAL_STAGES) {
          const me = room.players[myId];
          const score = (me?.kills || 0) * 10 + room.stage * 200 - (me?.deaths || 0) * 100;
          setFinalScore(Math.max(0, score));
          setIsCleared(true);
          return;
        }

        room.skillChoices = generateUpgradeChoices(room, room.players[myId]);
        if (room.skillChoices.length === 0) {
          room.stage++;
          room.stageTimer = 0;
          const nextMap = MAPS[Math.min(room.stage - 1, MAPS.length - 1)];
          const me = room.players[myId];
          if (me) {
            me.x = nextMap.playerSpawn.x;
            me.y = nextMap.playerSpawn.y;
          }
          room.enemies = [];
          room.bullets = [];
          room.puddles = [];
          room.enemyBullets = [];
          room.aoeWarnings = [];
          room.lasers = [];
          room.items = [];
          room.dynamicObstacles = [];
          return;
        }
        room.players[myId].upgradesToChoose = (room.stage === 4 || room.stage === 8) ? 2 : 1; //保留
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
      

      if (room.stage >= 5 && room.stageTimer === 100) {
        const bossCount = room.stage === 5 ? 1 : Math.floor((room.stage - 4) / 2) + 1;
        for (let i = 0; i < bossCount; i++) {
          const spawner = currentMap.spawners[Math.floor(Math.random() * currentMap.spawners.length)];
          let bossHp = 3300 * Math.pow(1.12, room.stage - 5);
          let spawnX = spawner.x + (Math.random() - 0.5) * 200;
          let spawnY = spawner.y + (Math.random() - 0.5) * 200;
          const halfW = 250;
          const halfH = 40;
          spawnX = Math.max(halfW + 10, Math.min(currentMap.width - halfW - 10, spawnX));
          spawnY = Math.max(halfH + 10, Math.min(currentMap.height - halfH - 10, spawnY));
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
          sx = Math.max(0, Math.min(currentMap.width, sx));
          sy = Math.max(0, Math.min(currentMap.height, sy));

          let type: EnemyType = 'Minion';
          let baseHp = 30;
          if (room.stage === 2) baseHp = 35;
          else if (room.stage === 3) baseHp = 50;
          else if (room.stage === 4) baseHp = 70;
          else if (room.stage >= 5) baseHp = 100 + (room.stage - 5) * 15;
          let hp = baseHp;
          let speed = 1.0 + Math.random() * 0.5; 
          let text = ['测试文本', 'Lorem ipsum', '11111', '如题', '占位符'][Math.floor(Math.random() * 5)];
          let width = 60;
          let height = 20;

          const r = Math.random();
          let eliteRatio = 0;
          if (room.stage <= 4) eliteRatio = Math.min(0.12, (room.stage - 1) * 0.04);
          else if (room.stage === 5) eliteRatio = 0.25;
          else eliteRatio = Math.min(0.65, 0.25 + (room.stage - 5) * 0.08);

          let pRef = 0;
          if (room.stage >= 5) pRef = Math.min(0.3, (room.stage - 4) * 0.05);

          let pValue = 0, pBrush = 0, pFreeze = 0, pShield = 0, pMerged = 0, pVlookup = 0, pMacro = 0;

          if (room.stage === 2) { pValue = 0.10; }
          else if (room.stage === 3) { pValue = 0.12; pBrush = 0.08; }
          else if (room.stage === 4) { pValue = 0.12; pBrush = 0.10; pFreeze = 0.04; pShield = 0.05; pMacro = 0.04; }
          else if (room.stage >= 5) {
            pValue = 0.10;
            pBrush = 0.10;
            pFreeze = 0.03; 
            pShield = 0.05;
            pMerged = 0.05;
            pVlookup = 0.05;
            pMacro = 0.04;
          }

          const freezeCount = room.enemies.filter(e => e.type === 'FreezeCell').length;
          if (freezeCount >= 3) pFreeze = 0;

          let stateTimer = 0;

          if (r < pValue) {
            type = 'Value'; text = '#N/A'; hp = hp * 2; speed = 1.5; width = 60;
          } else if (r < pValue + pBrush) {
            type = 'FormatBrush'; text = '格式刷'; hp = hp * 2.5; speed = 0.8; width = 50;
          } else if (r < pValue + pBrush + pFreeze) {
            type = 'FreezeCell'; text = '冻结单元格'; hp = hp * 5; speed = 0.3; width = 80; height = 40;
            stateTimer = Math.random() * 600;
          } else if (r < pValue + pBrush + pFreeze + pShield) {
            type = 'ProtectedView'; text = '受保护视图'; hp = hp * 3; speed = 0.9; width = 70;
          } else if (r < pValue + pBrush + pFreeze + pShield + pMerged) {
            type = 'MergedCell'; text = '合并单元格'; hp = hp * 6; speed = 0.5; width = 100; height = 50;
          } else if (r < pValue + pBrush + pFreeze + pShield + pMerged + pRef) {
            type = 'REF'; text = '#REF!'; hp = hp * 3.5; speed = 0; width = 60; height = 20;
            stateTimer = 180;
          } else if (r < pValue + pBrush + pFreeze + pShield + pMerged + pRef + pVlookup) {
            type = 'VLOOKUP'; text = 'VLOOKUP'; hp = hp * 4; speed = 0.8; width = 80; height = 20;
            stateTimer = 120;
          } else if (r < pValue + pBrush + pFreeze + pShield + pMerged + pRef + pVlookup + pMacro) {
            type = 'MACRO'; text = '宏病毒'; hp = hp * 5; speed = 2.5; width = 70; height = 20;
            stateTimer = 240;
          } else {
            if (room.stage >= 1 && Math.random() < eliteRatio) {
              type = 'Elite';
              hp = baseHp * 4;
              speed = 2.0; 
              text = ['烫烫烫', '锟斤拷', 'NullReference'][Math.floor(Math.random() * 3)];
              width = 80;
            } else if (room.stage >= 3 && Math.random() < 0.02) {
              type = 'MiniBoss';
              hp = hp * 10;
              speed = 1.2;
              text = '[批注: Logo再大一点]';
              width = 150;
              height = 40;
            }
          }

          let weight = 1;
          if (['FreezeCell', 'MergedCell', 'REF', 'VLOOKUP', 'MACRO', 'MiniBoss'].includes(type)) weight = 10;

          room.enemies.push({
            id: room.enemyIdCounter++,
            x: sx, y: sy, hp, maxHp: hp, type, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0,
            text, width, height, speed, weight,
            state: 'idle', stateTimer, lastAttack: 0
          });
        }
      }

      const checkObstacleCollision = (x: number, y: number, w: number, h: number, isPlayer: boolean = false) => {
        if (x - w/2 < room.margin || x + w/2 > currentMap.width - room.margin ||
            y - h/2 < room.margin || y + h/2 > currentMap.height - room.margin) {
          return true;
        }
        for (const obs of currentMap.obstacles) {
          if (x + w/2 > obs.x && x - w/2 < obs.x + obs.w && 
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
          speedMultiplier *= p.specificUpgrades.includes('wordart_all_caps') ? 0.9 : 0.7; // -10% or -30% speed //保留
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
          dy = (dy / length) * speed;
        }

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

        if (p.attackForm === 'sparkline' && !isShooting) {
          if ((p.laserCharge || 0) < 3 && now - (p.lastChargeTime || 0) > 1000) {
            p.laserCharge = (p.laserCharge || 0) + 1;
            p.lastChargeTime = now;
          }
        }

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
          let bulletSpeedMult = 1;
          let fireRateMult = 1;
          let commentKnockbackMult = 1;

          if (general.includes('bold')) {
            damageMult *= 1.3;
            knockbackAdd += 6;
          }
          if (general.includes('italic')) {
            bulletSpeedMult *= 1.15;
            fireRateMult *= 0.9;
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
              room.bullets.push({
                id: room.bulletIdCounter++,
                owner: p.id,
                x: p.x, y: p.y,
                vx: Math.cos(p.angle + angleOffset) * 12,
                vy: Math.sin(p.angle + angleOffset) * 12,
                damage: baseDamage * 0.6,
                size: 20,
                pierce: 1,
                life: 800,
                maxLife: 800,
                type: 'ctrl_c',
                isCrit: false,
                knockback: 5,
                isHighlight: false,
                leavesResidue: false,
                isItalic: false,
                isStrikethrough: false
              });
            }
          };

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

            fireRate *= fireRateMult;
            bulletSpeed *= bulletSpeedMult;

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
                isStrikethrough: general.includes('strikethrough'),
                typewriterScale: specific.includes('wordart_typewriter') ? 0.3 : undefined,
                initialWidth: wordWidth,
                initialHeight: wordHeight
              } as Bullet);
              
              if (specific.includes('wordart_subscript')) {
                room.bullets.push({
                  id: room.bulletIdCounter++,
                  owner: p.id,
                  x: p.x, y: p.y + 60,
                  vx: Math.cos(p.angle) * bulletSpeed,
                  vy: Math.sin(p.angle) * bulletSpeed,
                  angle: p.angle,
                  damage: finalDamage * 0.4,
                  size: size * 0.4,
                  width: wordWidth * 0.4,
                  height: wordHeight * 0.4,
                  pierce: pierce,
                  life: duration,
                  maxLife: duration,
                  type: 'wordart',
                  isCrit: false,
                  knockback: 0,
                  isTitle: false,
                  isBulldozer: true,
                  isShield: specific.includes('wordart_shield'),
                  stunChance: specific.includes('wordart_stun') ? 0.5 : 0,
                  eliteDamageMult: eliteDamageMult,
                  isHighlight: general.includes('highlight'),
                  leavesResidue: general.includes('underline'),
                  isItalic: general.includes('italic'),
                  isStrikethrough: general.includes('strikethrough'),
                  typewriterScale: specific.includes('wordart_typewriter') ? 0.3 : undefined,
                  initialWidth: wordWidth * 0.4,
                  initialHeight: wordHeight * 0.4
                } as Bullet);
              }

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

            fireRate *= fireRateMult;

            if (now - p.lastShot > fireRate && now > (p.sparklineVacuumUntil || 0)) {
              p.lastShot = now;
              
              let finalDamage = damage * damageMult;
              if (specific.includes('sparkline_charge')) {
                finalDamage *= (1 + (p.laserCharge || 0) * 0.7);
                p.laserCharge = 0;
              }
              let isCrit = false;
              if (Math.random() < critChance) {
                isCrit = true;
                finalDamage *= critMult;
              }

              const createLaser = (angleOffset: number, dmgMult: number, extraWidth: number) => {
                const laserWidthMult = general.includes('bold') ? 1.8 : 1;
                room.lasers.push({
                  id: room.bulletIdCounter++,
                  owner: p.id,
                  x: p.x, y: p.y,
                  angle: p.angle + angleOffset,
                  damage: finalDamage * dmgMult,
                  width: (width + extraWidth) * laserWidthMult,
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
            let explosionRadius = 110;
            let count = 1;

            if (specific.includes('comment_size')) {
              explosionRadius *= 1.5;
              damageMult *= 1.25;
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
              commentKnockbackMult *= 2;
            }

            explosionRadius = Math.min(explosionRadius, 220); //保留
            fireRate *= fireRateMult;
            bulletSpeed *= bulletSpeedMult;

            if (now - p.lastShot > fireRate) {
              p.lastShot = now;
              p.commentCounter = (p.commentCounter || 0) + 1;
              
              let isUlt = false;
              if (specific.includes('comment_ult') && p.commentCounter % 4 === 0) {
                isUlt = true;
                damage = 90;
                explosionRadius = 220;
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
                  knockback: 15 * commentKnockbackMult,
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
            fireRate *= fireRateMult;
            bulletSpeed *= bulletSpeedMult;

            if (now - p.lastShot > fireRate) {
              p.lastShot = now;
              
              let finalDamage = damage * damageMult;
              if (specific.includes('array_single')) {
                const originalCount = count;
                count = 1;
                finalDamage *= originalCount * 0.8;
                bulletSpeed *= 1.5;
              }
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
                  isStrikethrough: general.includes('strikethrough'),
                  initialAngle: p.angle,
                  travelDist: 0,
                  ricochetSpeed: bulletSpeed,
                  ricochetPierce: 0
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
              maxLife: 2000,
              type: 'wordart',
              isCrit: false,
              knockback: 0,
              isTitle: true,
              isBulldozer: true,
              isShield: p.specificUpgrades.includes('wordart_shield'),
              stunChance: p.specificUpgrades.includes('wordart_stun') ? 0.5 : 0,
              leavesResidue: true,
              eliteDamageMult: 1.5,
              isHighlight: p.generalUpgrades.includes('highlight'),
              isItalic: p.generalUpgrades.includes('italic'),
              isStrikethrough: p.generalUpgrades.includes('strikethrough')
            });
          }
        }
        
        if (p.attackForm === 'wordart' && p.specificUpgrades.includes('wordart_quad')) {
          if (now - (p.lastWordartQuad || 0) > 20000) {
            p.lastWordartQuad = now;
            for (let i = 0; i < 4; i++) {
              const angle = (i * Math.PI) / 2;
              room.bullets.push({
                id: room.bulletIdCounter++,
                owner: p.id,
                x: p.x, y: p.y,
                vx: Math.cos(angle) * 6,
                vy: Math.sin(angle) * 6,
                angle: angle,
                damage: 100,
                size: 150,
                width: 150 * 2.5,
                height: 150 * 0.8,
                pierce: 999,
                life: 3000,
                maxLife: 3000,
                type: 'wordart',
                isCrit: false,
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
              width: p.generalUpgrades.includes('bold') ? 220 : 150, // Very wide
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
              knockback: 24,
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

        if (e.type === 'SplitCell') {
          e.stateTimer = (e.stateTimer || 0) - timeSpeed;
          if ((e.stateTimer || 0) <= 0) {
            e.hp = 0;
          }
        }
        
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
            if (minDist < 600 && minDist > 300) {
              e.vx = 0; e.vy = 0;
              if (now - (e.lastAttack || 0) > (room.activeEvent === 'OOM' ? 1000 : 2000)) {
                e.lastAttack = now;
                const isRowCol = Math.random() < 0.5;
                if (isRowCol) {
                  room.enemyBullets.push({ id: room.enemyBulletIdCounter++, x: e.x, y: e.y, vx: 5, vy: 0, damage: 10, life: 300, size: 10, type: 'row' });
                  room.enemyBullets.push({ id: room.enemyBulletIdCounter++, x: e.x, y: e.y, vx: -5, vy: 0, damage: 10, life: 300, size: 10, type: 'row' });
                  room.enemyBullets.push({ id: room.enemyBulletIdCounter++, x: e.x, y: e.y, vx: 0, vy: 5, damage: 10, life: 300, size: 10, type: 'col' });
                  room.enemyBullets.push({ id: room.enemyBulletIdCounter++, x: e.x, y: e.y, vx: 0, vy: -5, damage: 10, life: 300, size: 10, type: 'col' });
                } else {
                  room.enemyBullets.push({ id: room.enemyBulletIdCounter++, x: e.x, y: e.y, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4, damage: 15, life: 300, size: 12, type: 'value' });
                }
              }
            } else if (minDist <= 300) {
              e.vx = -Math.cos(angle) * e.speed * 0.5;
              e.vy = -Math.sin(angle) * e.speed * 0.5;
            } else {
              e.vx = Math.cos(angle) * e.speed;
              e.vy = Math.sin(angle) * e.speed;
            }
          } else if (e.type === 'FormatBrush') {
            if (e.state === 'idle') {
              e.vx = Math.cos(angle) * e.speed;
              e.vy = Math.sin(angle) * e.speed;
              if (minDist < 400 && now - (e.lastAttack || 0) > 4000) {
                e.state = 'warning';
                e.stateTimer = now;
                e.dashTargetX = nearestP.x;
                e.dashTargetY = nearestP.y;
                e.vx = 0; e.vy = 0;
              }
            } else if (e.state === 'warning') {
              e.vx = 0; e.vy = 0;
              if (now - (e.stateTimer || 0) > 1000) {
                e.state = 'dashing';
                e.stateTimer = now;
                const dashAngle = Math.atan2((e.dashTargetY || e.y) - e.y, (e.dashTargetX || e.x) - e.x);
                e.vx = Math.cos(dashAngle) * 8;
                e.vy = Math.sin(dashAngle) * 8;
                e.lastAttack = now;
              }
            } else if (e.state === 'dashing') {
              if (Math.random() < 0.2) {
                room.puddles.push({ id: room.puddleIdCounter++, x: e.x, y: e.y, radius: 40, type: 'formatPaint', life: 500, maxLife: 500 });
              }
              if (now - (e.stateTimer || 0) > 800) {
                e.state = 'idle';
              }
            }
          } else if (e.type === 'EliteBoss') {
            const bossPhase = e.hp > e.maxHp * 0.66 ? 1 : (e.hp > e.maxHp * 0.33 ? 2 : 3);
            e.stateTimer = (e.stateTimer || 0) + timeSpeed;
            
            const attackInterval = bossPhase === 1 ? 300 : (bossPhase === 2 ? 240 : 180);

            if (e.stateTimer > attackInterval) {
              e.stateTimer = 0;
              const attacks = ['delete', 'summon'];
              if (bossPhase >= 2) attacks.push('fontsize', 'plus');
              if (bossPhase >= 3) attacks.push('multiply');

              const attack = attacks[Math.floor(Math.random() * attacks.length)];

              if (attack === 'delete') {
                const target = nearestP || { x: e.x, y: e.y };
                const aoeType = ['rect', 'row', 'col'][Math.floor(Math.random() * 3)] as 'rect' | 'row' | 'col';
                let w = 300, h = 300, ax = target.x, ay = target.y;
                if (aoeType === 'row') { w = currentMap.width; h = 150; ax = currentMap.width/2; }
                if (aoeType === 'col') { w = 150; h = currentMap.height; ay = currentMap.height/2; }
                
                const bossHpPct = e.hp / e.maxHp;
                const aoeLife = Math.max(40, 120 * bossHpPct);
                
                room.aoeWarnings.push({
                  id: room.aoeIdCounter++,
                  x: ax, y: ay, w, h, type: aoeType, life: aoeLife, maxLife: aoeLife
                });
              } else if (attack === 'summon') {
                if (room.enemies.length < 200) {
                  const count = 50 + Math.floor(Math.random() * 30);
                  for (let k=0; k<count; k++) {
                    let sx = e.x + (Math.random()-0.5)*800;
                    let sy = e.y + (Math.random()-0.5)*800;
                    sx = Math.max(0, Math.min(currentMap.width, sx));
                    sy = Math.max(0, Math.min(currentMap.height, sy));
                    const r = Math.random();
                    let stype: EnemyType = 'Minion';
                    let stext = '乱码';
                    let shp = 15 * room.stage;
                    let sspeed = 1.0 + Math.random()*0.5;
                    let sw = 60, sh = 20;
                    if (r < 0.2) { stype = 'FormatBrush'; stext = '格式刷'; shp = 40*room.stage; sspeed = 0.8; sw = 50; }
                    else if (r < 0.4) { stype = 'Value'; stext = '#VALUE!'; shp = 30*room.stage; sspeed = 1.5; sw = 60; }

                    room.enemies.push({
                      id: room.enemyIdCounter++, x: sx, y: sy, hp: shp, maxHp: shp, type: stype,
                      vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, text: stext, width: sw, height: sh, speed: sspeed,
                      state: 'idle', stateTimer: 0, lastAttack: 0
                    });
                  }
                }
              } else if (attack === 'fontsize') {
                const targets = room.enemies.filter(en => (en.type === 'Minion' || en.type === 'FormatBrush') && !en.isBuffed);
                for (let k=0; k<Math.min(20, targets.length); k++) {
                  const t = targets[Math.floor(Math.random() * targets.length)];
                  t.width *= 3; t.height *= 3; t.hp *= 3; t.maxHp *= 3; t.isBuffed = true;
                }
              } else if (attack === 'plus') {
                const count = 30;
                for (let k=0; k<count; k++) {
                  const isHoriz = Math.random() > 0.5;
                  const offset = (Math.random() - 0.5) * 600;
                  let sx = e.x + (isHoriz ? offset : 0);
                  let sy = e.y + (isHoriz ? 0 : offset);
                  sx = Math.max(0, Math.min(currentMap.width, sx));
                  sy = Math.max(0, Math.min(currentMap.height, sy));
                  room.enemies.push({
                    id: room.enemyIdCounter++, x: sx, y: sy, hp: 15*room.stage, maxHp: 15*room.stage, type: 'Minion',
                    vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, text: '+', width: 40, height: 40, speed: 1.5,
                    state: 'idle', stateTimer: 0, lastAttack: 0, isBuffed: true
                  });
                }
              } else if (attack === 'multiply') {
                const targets = room.enemies.filter(en => en.type !== 'EliteBoss' && en.type !== 'MiniBoss');
                for (let k=0; k<Math.min(30, targets.length); k++) {
                  const t = targets[Math.floor(Math.random() * targets.length)];
                  room.enemies.push({
                    ...t,
                    id: room.enemyIdCounter++,
                    x: t.x + (Math.random()-0.5)*100,
                    y: t.y + (Math.random()-0.5)*100,
                    hp: t.maxHp
                  });
                }
              }
            }
            
            if (minDist > 400) {
              e.vx = Math.cos(angle) * e.speed;
              e.vy = Math.sin(angle) * e.speed;
            } else {
              e.vx = 0;
              e.vy = 0;
            }
          } else if (e.type === 'FreezeCell') {
            e.vx = 0; e.vy = 0;
            e.stateTimer = (e.stateTimer || 0) + timeSpeed;
            
            const colors = ['#00bcf2', '#ffb900', '#107c41'];
            e.text = colors[Math.floor(e.stateTimer / 20) % 3];

            if (e.stateTimer > 600) {
              e.stateTimer = 0;
              const p = nearestP || { x: e.x, y: e.y };
              const shapes = [
                { w: 60, h: 60 },
                { w: 120, h: 30 },
                { w: 30, h: 120 },
                { w: 90, h: 40 },
                { w: 40, h: 90 }
              ];
              const shape = shapes[Math.floor(Math.random() * shapes.length)];
              const angle = Math.random() * Math.PI * 2;
              const dist = 150;
              const ox = p.x + Math.cos(angle) * dist - shape.w/2;
              const oy = p.y + Math.sin(angle) * dist - shape.h/2;
              
              room.dynamicObstacles.push({
                x: ox, y: oy, w: shape.w, h: shape.h
              });
              
              // Visual feedback for freezing
              shake.current = 5;
              for(let i=0; i<15; i++) {
                particles.current.push({
                  x: ox + shape.w/2 + (Math.random()-0.5)*shape.w, y: oy + shape.h/2 + (Math.random()-0.5)*shape.h,
                  vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4 - 2,
                  life: 20 + Math.random()*20, text: '❄️', color: '#00bcf2'
                });
              }
              
              setTimeout(() => {
                if (gameStateRef.current) {
                  gameStateRef.current.dynamicObstacles = gameStateRef.current.dynamicObstacles.filter(o => o.x !== ox || o.y !== oy);
                }
              }, 5000);
            }
          } else if (e.type === 'MergedCell') {
            e.vx = Math.cos(angle) * e.speed;
            e.vy = Math.sin(angle) * e.speed;
            // Devour nearby #N/A
            for (let j = room.enemies.length - 1; j >= 0; j--) {
              if (i !== j) {
                const other = room.enemies[j];
                if (other.type === 'Value') {
                  const dist = Math.hypot(e.x - other.x, e.y - other.y);
                  if (dist < e.width / 2 + 50) {
                    // Devour
                    room.enemies.splice(j, 1);
                    if (j < i) i--; // Adjust index if we removed an element before i
                    e.width *= 1.1;
                    e.height *= 1.1;
                    e.hp += 50;
                    e.maxHp += 50;
                    e.weight = Math.min(100, e.weight + 5);
                    // Visual feedback
                    particles.current.push({
                      x: e.x, y: e.y, vx: 0, vy: -2, life: 30, text: '+10%', color: '#107c41'
                    });
                  }
                }
              }
            }
          } else if (e.type === 'REF') {
            e.vx = 0; e.vy = 0;
            e.stateTimer = (e.stateTimer || 0) - timeSpeed;
            if (e.state === 'waitingToFire') {
              if (e.stateTimer <= 0) {
                e.state = 'idle';
                e.stateTimer = 180; // 3 seconds until next teleport
                // Fire 8-way bullets
                for (let k = 0; k < 8; k++) {
                  const ba = (Math.PI * 2 / 8) * k;
                  room.enemyBullets.push({ id: room.enemyBulletIdCounter++, x: e.x, y: e.y, vx: Math.cos(ba) * 4, vy: Math.sin(ba) * 4, damage: 15, life: 300, size: 10, type: 'ref' });
                }
              }
            } else {
              if (e.stateTimer <= 0) {
                // Teleport
                if (nearestP) {
                  e.x = nearestP.x + (Math.random() - 0.5) * 400;
                  e.y = nearestP.y + (Math.random() - 0.5) * 400;
                  e.x = Math.max(0, Math.min(currentMap.width, e.x));
                  e.y = Math.max(0, Math.min(currentMap.height, e.y));
                  e.state = 'waitingToFire';
                  e.stateTimer = 60; // 1 second wait
                }
              }
            }
          } else if (e.type === 'VLOOKUP') {
            e.stateTimer = (e.stateTimer || 0) - timeSpeed;
            if (e.state === 'idle') {
              if (minDist < 400) {
                e.vx = -Math.cos(angle) * e.speed;
                e.vy = -Math.sin(angle) * e.speed;
              } else if (minDist > 600) {
                e.vx = Math.cos(angle) * e.speed;
                e.vy = Math.sin(angle) * e.speed;
              } else {
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

            const desiredMin = 320;
            const desiredMax = 620;
            let macroSpeed = 2.2;
            if (minDist < desiredMin) {
              macroSpeed = 5.8;
              e.vx = -Math.cos(angle) * macroSpeed;
              e.vy = -Math.sin(angle) * macroSpeed;
            } else if (minDist > desiredMax) {
              macroSpeed = 1.8;
              e.vx = Math.cos(angle) * macroSpeed;
              e.vy = Math.sin(angle) * macroSpeed;
            } else {
              const strafe = angle + Math.PI / 2;
              e.vx = Math.cos(strafe) * 1.2;
              e.vy = Math.sin(strafe) * 1.2;
            }

            if (e.stateTimer <= 0) {
              e.stateTimer = 180;
              const bombMinions = room.enemies.filter(en => en.type === 'MINION').length;
              const canSummon = Math.max(0, 4 - bombMinions);
              if (canSummon > 0) {
                const spawnNum = Math.min(canSummon, 2);
                for (let k = 0; k < spawnNum; k++) {
                  const ba = (Math.PI * 2 / Math.max(1, spawnNum)) * k + Math.random() * 0.4;
                  const sx = e.x + Math.cos(ba) * 40;
                  const sy = e.y + Math.sin(ba) * 40;
                  room.enemies.push({
                    id: room.enemyIdCounter++, x: sx, y: sy, hp: 8, maxHp: 8, type: 'MINION',
                    vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, text: 'ERR', width: 28, height: 28, speed: 3.4, weight: 1,
                    state: 'idle', stateTimer: 0, lastAttack: 0
                  });
                }
              }
            }
          } else if (e.type === 'MINION') {
            e.vx = Math.cos(angle) * e.speed;
            e.vy = Math.sin(angle) * e.speed;
            if (minDist < 50) {
              e.hp = 0;
              room.puddles.push({ id: room.puddleIdCounter++, x: e.x, y: e.y, radius: 70, type: 'burn_slow', life: 6, maxLife: 6, damage: 0.2 });
              if (nearestP && minDist < 70) {
                nearestP.hp -= 2;
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
            if (killer.generalUpgrades.includes('sum')) {
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
                state: 'idle', stateTimer: 600, lastAttack: 0,
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

      if (room.stageTimer % 60 === 0) {
        room.enemies.forEach(e => {
          if ((e.burnStacks || 0) > 0) {
            e.hp -= (e.burnStacks || 0) * 5;
            if (Math.random() < 0.04) {
              e.burnStacks = Math.max(0, (e.burnStacks || 0) - 1);
            }
          }
        });
      }

      if (p && p.hp > 0 && p.specificUpgrades.includes('array_orbit')) {
        p.orbitAngle = ((p.orbitAngle || 0) + 0.06) % (Math.PI * 2);
        for (let oi = 0; oi < 8; oi++) {
          const a = (p.orbitAngle || 0) + oi * Math.PI / 4;
          const ox = p.x + Math.cos(a) * 55;
          const oy = p.y + Math.sin(a) * 55;
          for (const e of room.enemies) {
            if (Math.hypot(e.x - ox, e.y - oy) < 18) {
              e.hp -= 5;
              const pushAngle = Math.atan2(e.y - oy, e.x - ox);
              e.knockbackX += Math.cos(pushAngle) * 4;
              e.knockbackY += Math.sin(pushAngle) * 4;
            }
          }
        }
      }

      for (let i = room.bullets.length - 1; i >= 0; i--) {
        const b = room.bullets[i];
        const ownerPlayer = room.players[b.owner];
        const ownerSpecific = ownerPlayer?.specificUpgrades || [];

        if (b.typewriterScale !== undefined && b.initialWidth && b.initialHeight) {
          b.typewriterScale = Math.min(2.0, b.typewriterScale + (2.0 - 0.3) / Math.max(1, b.maxLife));
          b.width = b.initialWidth * b.typewriterScale;
          b.height = b.initialHeight * b.typewriterScale;
          b.size = Math.max(b.width, b.height);
        }

        if (b.type === 'array' && ownerSpecific.includes('array_converge')) {
          b.travelDist = (b.travelDist || 0) + Math.hypot(b.vx, b.vy);
          if ((b.travelDist || 0) > 300 && b.initialAngle !== undefined) {
            const curAngle = Math.atan2(b.vy, b.vx);
            let diff = b.initialAngle - curAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const spd = Math.hypot(b.vx, b.vy);
            const newAngle = curAngle + diff * 0.04;
            b.vx = Math.cos(newAngle) * spd;
            b.vy = Math.sin(newAngle) * spd;
          }
        }
        
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

        if (b.type === 'comment' && ownerSpecific.includes('comment_proximity')) {
          for (const e of room.enemies) {
            if (Math.hypot(b.x - e.x, b.y - e.y) < 40) {
              b.life = 0;
              break;
            }
          }
        }

        if (b.life <= 0) {
          if (b.type === 'comment') {
            const hitCount = room.enemies.filter(e => Math.hypot(e.x - b.x, e.y - b.y) < (b.explosionRadius || 70) + e.width/2).length;
            const densityMult = ownerSpecific.includes('comment_density') ? (1 + Math.min(5, Math.max(0, hitCount - 1)) * 0.15) : 1;

            room.enemies.forEach(e => {
              if (Math.hypot(e.x - b.x, e.y - b.y) < (b.explosionRadius || 70) + e.width/2) {
                let finalDamage = b.damage;
                finalDamage *= densityMult;
                if (e.type === 'EliteBoss' || e.type === 'MiniBoss' || e.type === 'Elite') {
                  finalDamage *= (b.eliteDamageMult || 1);
                }

                if (e.commentMark && Date.now() < e.commentMark) {
                  finalDamage *= 1.8;
                  e.commentMark = 0;
                }

                if (e.revisionMark && Date.now() < e.revisionMark) {
                  finalDamage *= 1.35;
                }
                
                if (b.isSuper && e.type !== 'EliteBoss' && e.type !== 'MiniBoss') {
                  e.hp = 0;
                } else {
                  e.hp -= finalDamage;
                }
                
                // Explosion knockback
                const angle = Math.atan2(e.y - b.y, e.x - b.x);
                let kbResist = e.isBuffed ? 0.2 : 0.8;
                kbResist /= (e.weight || 1);
                const explosionKb = b.knockback || 15;
                e.vx += Math.cos(angle) * explosionKb * kbResist;
                e.vy += Math.sin(angle) * explosionKb * kbResist;
                
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

            if (ownerSpecific.includes('comment_mark')) {
              room.enemies.forEach(e => {
                if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < (b.explosionRadius || 70) + e.width/2) {
                  e.commentMark = Date.now() + 4000;
                }
              });
            }

            if (hitCount > 0 && ownerSpecific.includes('comment_battery') && ownerPlayer) {
              ownerPlayer.hp = Math.min(ownerPlayer.maxHp, ownerPlayer.hp + ownerPlayer.maxHp * 0.02);
            }
            
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
                id: room.puddleIdCounter++, x: b.x, y: b.y, radius: (b.explosionRadius || 70) * 1.15, type: 'burn_slow', life: 360, maxLife: 360, damage: b.damage * 0.14, owner: b.owner //保留
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
          if (b.type === 'wordart' && b.width && b.height && b.angle !== undefined) { //保留
            const dx = e.x - b.x;
            const dy = e.y - b.y;
            const cos = Math.cos(-b.angle);
            const sin = Math.sin(-b.angle);
            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;

            if (Math.abs(rx) < b.width/2 + e.width/2 && Math.abs(ry) < b.height/2 + e.height/2) {
              isHit = true;
            }
          } else if (b.type === 'wordart' && b.width && b.height) {
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
          } else {
            if (Math.abs(b.x - e.x) < e.width/2 + b.size && Math.abs(b.y - e.y) < e.height/2 + b.size) {
              isHit = true;
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

              if (e.revisionMark && Date.now() < e.revisionMark) {
                finalDamage *= 1.35;
              }

              const inHighlight = room.puddles.some(p => p.type === 'highlight' && Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.width/2);
              if (inHighlight) {
                finalDamage *= 1.5;
              }

              e.hp -= finalDamage;

              if (b.type === 'wordart' && ownerSpecific.includes('wordart_revision') && (e.type === 'Elite' || e.type === 'MiniBoss' || e.type === 'EliteBoss')) {
                e.revisionMark = Date.now() + 5000;
              }
              
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

              if (e.hp <= 0 && b.type === 'array' && ownerSpecific.includes('array_ricochet')) {
                b.ricochetPierce = Math.min(3, (b.ricochetPierce || 0) + 1);
                b.pierce += 1;
                const spd = Math.hypot(b.vx, b.vy) || 1;
                const baseSpd = b.ricochetSpeed || spd;
                const newSpd = Math.min(spd * 1.2, baseSpd * Math.pow(1.2, 3));
                b.vx = (b.vx / spd) * newSpd;
                b.vy = (b.vy / spd) * newSpd;
              }
              
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
                  id: room.puddleIdCounter++, x: e.x, y: e.y, radius: 80, type: 'highlight', life: 180, maxLife: 180, damage: b.damage * 0.3, owner: b.owner
                });
              }
              const ownerPlayer = room.players[b.owner];
              if (ownerPlayer && ownerPlayer.generalUpgrades.includes('format_painter') && Math.random() < 0.2) {
                room.puddles.push({
                  id: room.puddleIdCounter++, x: e.x, y: e.y, radius: 60, type: 'formatPaint', life: 200, maxLife: 200, damage: b.damage * 0.2, owner: b.owner
                });
              }
            }

            if (b.isBulldozer && e.type !== 'EliteBoss' && e.type !== 'MiniBoss') {
              const prevX = e.x;
              const prevY = e.y;
              
              // Push them slightly faster than the bullet
              e.x += b.vx * timeSpeed * 1.5;
              e.y += b.vy * timeSpeed * 1.5;
              
              // Pull towards the center of the bullet to prevent slipping out
              if (Math.abs(b.vx) > Math.abs(b.vy)) {
                e.y += (b.y - e.y) * 0.2;
              } else {
                e.x += (b.x - e.x) * 0.2;
              }
              
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
                      if (ownerSpecific.includes('wordart_hotkey') && ownerPlayer) {
                        ownerPlayer.lastShot = 0;
                      }
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
              let kbResist = e.isBuffed ? 0.2 : 0.8;
              if (b.type !== 'wordart') kbResist = e.isBuffed ? 0.1 : 0.3;
              
              kbResist /= (e.weight || 1);
              
              let kbX = b.vx * kbResist * (b.knockback || 0) * 0.1;
              let kbY = b.vy * kbResist * (b.knockback || 0) * 0.1;
              
              const kbMag = Math.hypot(kbX, kbY);
              if (kbMag > 50) {
                kbX = (kbX / kbMag) * 50;
                kbY = (kbY / kbMag) * 50;
              }
              
              e.knockbackX = kbX;
              e.knockbackY = kbY;
            }
            
            if (firstHit) {
              if (b.type === 'wordart') {
                shake.current = Math.max(shake.current, 5);
                const ownerPlayer = room.players[b.owner];
                if (ownerPlayer && ownerPlayer.specificUpgrades.includes('wordart_spread') && Math.random() < 0.3) {
                  const speed = Math.hypot(b.vx, b.vy);
                  const currentAngle = Math.atan2(b.vy, b.vx);
                  for (let j = -1; j <= 1; j += 2) {
                    const newAngle = currentAngle + j * Math.PI / 2;
                    room.bullets.push({
                      ...b,
                      id: room.bulletIdCounter++,
                      vx: Math.cos(newAngle) * speed * 1.5,
                      vy: Math.sin(newAngle) * speed * 1.5,
                      angle: newAngle,
                      size: b.size * 0.4,
                      damage: b.damage * 0.4,
                      isBulldozer: false,
                      pierce: 1
                    });
                  }
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

              if (b.type === 'array' && ownerSpecific.includes('array_scatter')) {
                for (let si = 0; si < 2; si++) {
                  const a = Math.random() * Math.PI * 2;
                  room.bullets.push({
                    id: room.bulletIdCounter++,
                    owner: b.owner,
                    x: b.x, y: b.y,
                    vx: Math.cos(a) * 10,
                    vy: Math.sin(a) * 10,
                    damage: b.damage * 0.3,
                    size: b.size * 0.6,
                    pierce: 1,
                    life: 500,
                    maxLife: 500,
                    type: 'array',
                    isCrit: false,
                    eliteDamageMult: b.eliteDamageMult || 1,
                    splitsLeft: 0,
                    bouncesLeft: 0,
                    trackRadius: 0,
                    isHighlight: false,
                    leavesResidue: false,
                    isItalic: false,
                    isStrikethrough: false
                  });
                }
              }

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
          if (b.type === 'comment' && ownerSpecific.includes('comment_wallbounce') && !b.wallBounced) { //保留
            const outX = b.x < 0 || b.x > currentMap.width;
            const outY = b.y < 0 || b.y > currentMap.height;
            if (outX) b.vx *= -1;
            if (outY) b.vy *= -1;
            if (!outX && !outY) {
              if (Math.abs(b.vx) > Math.abs(b.vy)) b.vx *= -1;
              else b.vy *= -1;
            }
            b.wallBounced = true;
          } else {
            b.life = 0;
          }
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
            if (b.angle !== undefined) { //保留
              const dx = eb.x - b.x;
              const dy = eb.y - b.y;
              const cos = Math.cos(-b.angle);
              const sin = Math.sin(-b.angle);
              const rx = dx * cos - dy * sin;
              const ry = dx * sin + dy * cos;
              if (Math.abs(rx) < (b.width/2 + eb.size) && Math.abs(ry) < (b.height/2 + eb.size)) {
                blocked = true;
                break;
              }
            } else if (Math.abs(eb.x - b.x) < (b.width/2 + eb.size) && Math.abs(eb.y - b.y) < (b.height/2 + eb.size)) {
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
            }
          }
        });
        if (eb.life <= 0) room.enemyBullets.splice(i, 1);
      }

      for (let i = room.puddles.length - 1; i >= 0; i--) {
        const p = room.puddles[i];
        p.life -= timeSpeed;
        if (p.life <= 0) {
          room.puddles.splice(i, 1);
          continue;
        }
        if ((p.type === 'highlight' || p.type === 'formatPaint' || p.type === 'burn_slow') && room.stageTimer % 10 === 0) {
          room.enemies.forEach(e => {
            if (Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.width/2) {
              e.hp -= p.damage || 0;
            }
          });
        }
      }

      for (let i = room.aoeWarnings.length - 1; i >= 0; i--) {
        const aoe = room.aoeWarnings[i];
        aoe.life -= timeSpeed;
        if (aoe.life <= 0) {
          Object.values(room.players).forEach((p: any) => {
            if (p.hp > 0 && now > p.invincibleUntil) {
              if (Math.abs(p.x - aoe.x) < aoe.w/2 && Math.abs(p.y - aoe.y) < aoe.h/2) {
                p.hp = 0;
                if (p.generalUpgrades.includes('ctrl_z') && !p.ctrlZUsed) {
                  p.hp = p.maxHp * 0.3;
                  p.ctrlZUsed = true;
                  p.invincibleUntil = now + 2000;
                } else {
                  p.deaths++;
                }
              }
            }
          });
          room.aoeWarnings.splice(i, 1);
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
            const laserOwner = room.players[l.owner];
            const laserSpecific = laserOwner?.specificUpgrades || [];

            if (laserOwner?.killshotUntil && Date.now() < laserOwner.killshotUntil) {
              finalDamage *= 3;
              laserOwner.killshotUntil = 0;
            }
            if (e.type === 'EliteBoss' || e.type === 'MiniBoss' || e.type === 'Elite') {
              finalDamage *= (l.eliteDamageMult || 1);
            }

            if (e.revisionMark && Date.now() < e.revisionMark) {
              finalDamage *= 1.35;
            }

            if (laserSpecific.includes('sparkline_execute') && e.hp / e.maxHp < 0.25 && e.type !== 'EliteBoss' && e.type !== 'MiniBoss') {
              finalDamage *= 3;
            }

            if (laserSpecific.includes('sparkline_tenshot')) {
              laserOwner!.lasersHit = (laserOwner!.lasersHit || 0) + 1;
              if ((laserOwner!.lasersHit || 0) % 10 === 0) {
                laserOwner!.nextLaserCrit = true;
              }
              if (laserOwner!.nextLaserCrit) {
                finalDamage *= 3;
                laserOwner!.nextLaserCrit = false;
              }
            }
            
            // Highlight vulnerability
            const inHighlight = room.puddles.some(p => p.type === 'highlight' && Math.hypot(e.x - p.x, e.y - p.y) < p.radius + e.width/2);
            if (inHighlight) {
              finalDamage *= 1.5;
            }
            
            e.hp -= finalDamage;

            if (laserSpecific.includes('sparkline_burn')) {
              e.burnStacks = Math.min(8, (e.burnStacks || 0) + 1);
            }
            
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

            if (e.hp <= 0 && laserSpecific.includes('sparkline_killshot')) {
              laserOwner!.killshotUntil = Date.now() + 300;
            }
            
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
            
            // Format Painter
            const ownerPlayer = room.players[l.owner];
            if (ownerPlayer && ownerPlayer.generalUpgrades.includes('format_painter') && Math.random() < 0.2) {
              room.puddles.push({
                id: room.puddleIdCounter++, x: e.x, y: e.y, radius: 60, type: 'formatPaint', life: 200, maxLife: 200, damage: l.damage * 0.2, owner: l.owner
              });
            }
            
            if (!l.hasHit && l.bouncesLeft && l.bouncesLeft > 0) {
              l.bouncesLeft--;
              l.hasHit = true;
              let nearestE = null;
              let minDist = 300;
              for (const otherE of room.enemies) {
                if (otherE.id !== e.id) {
                  const d = Math.hypot(e.x - otherE.x, e.y - otherE.y);
                  if (d < minDist) { minDist = d; nearestE = otherE; }
                }
              }
              if (nearestE) {
                const targetAngle = Math.atan2(nearestE.y - e.y, nearestE.x - e.x);
                room.lasers.push({
                  id: room.bulletIdCounter++,
                  owner: l.owner,
                  x: e.x, y: e.y,
                  angle: targetAngle,
                  damage: l.damage * 0.5,
                  width: l.width,
                  range: 3000,
                  life: 15,
                  maxLife: 15,
                  type: 'sparkline',
                  isCrit: l.isCrit,
                  eliteDamageMult: l.eliteDamageMult,
                  bouncesLeft: l.bouncesLeft,
                  isSlow: (l as any).isSlow
                } as Laser);
              }
            }
          }
        }
        
        if (l.life <= 0) {
          room.lasers.splice(i, 1);
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    applyGridAction(type, {
      room: gameStateRef.current,
      myId,
      canvas,
      selectionStart: selectionStartRef.current,
      selectionEnd: selectionEndRef.current,
      setShowGridMenu,
      isSelectingGridRef,
      selectionStartRef,
      selectionEndRef,
      shake
    });
  };

  const handleSelectUpgrade = (upgrade: Upgrade) => {
    const room = gameStateRef.current;
    if (!room) return;

    applySelectedUpgrade(upgrade, {
      room,
      myId,
      totalStages: TOTAL_STAGES,
      setFinalScore,
      setIsCleared,
      setUiState
    });
  };

  const handleSelectForm = (form: AttackForm) => {
    const room = gameStateRef.current;
    if (!room) return;
    applySelectedForm(room, myId, form, setUiState);
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
      const renderNow = Date.now();
      
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }

      if (!gameState) {
        animationFrameId.current = requestAnimationFrame(render);
        return;
      }

      const me = gameState.players[myId];
      const SCALE = 0.8;
      
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
      let cameraY = me ? me.y - canvas.height / (2 * SCALE) : 0;

      if (shake.current > 0) {
        cameraX += (Math.random() - 0.5) * shake.current;
        cameraY += (Math.random() - 0.5) * shake.current;
        shake.current *= 0.9;
        if (shake.current < 0.5) shake.current = 0;
      }

      ctx.save();
      ctx.scale(SCALE, SCALE);
      ctx.translate(-cameraX, -cameraY);

      const CELL_W = 80;
      const CELL_H = 24;
      
      const startCol = Math.floor(cameraX / CELL_W);
      const startRow = Math.floor(cameraY / CELL_H);
      const endCol = startCol + (canvas.width / SCALE) / CELL_W + 2;
      const endRow = startRow + (canvas.height / SCALE) / CELL_H + 2;

      const isVisible = (x: number, y: number, w: number, h: number) => {
        return x + w > cameraX && x < cameraX + canvas.width / SCALE &&
               y + h > cameraY && y < cameraY + canvas.height / SCALE;
      };

      const currentMap = MAPS[Math.min(gameState.stage - 1, MAPS.length - 1)];

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = startCol; c <= endCol; c++) {
        ctx.moveTo(c * CELL_W, cameraY); 
        ctx.lineTo(c * CELL_W, cameraY + canvas.height / SCALE);
      }
      for (let r = startRow; r <= endRow; r++) {
        ctx.moveTo(cameraX, r * CELL_H); 
        ctx.lineTo(cameraX + canvas.width / SCALE, r * CELL_H);
      }
      ctx.stroke();

      if (currentMap) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, currentMap.width, currentMap.height);
      }
      
      if (gameState.margin > 0) {
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        const m = gameState.margin;
        const w = currentMap.width;
        const h = currentMap.height;
        ctx.fillRect(0, 0, w, m);
        ctx.fillRect(0, h - m, w, m);
        ctx.fillRect(0, m, m, h - 2 * m);
        ctx.fillRect(w - m, m, m, h - 2 * m);

        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Calibri';
        ctx.textAlign = 'center';
        ctx.fillText('页边距 (不可进入)', w / 2, m / 2);
        ctx.fillText('页边距 (不可进入)', w / 2, h - m / 2);
      }

      if (gameState.activeEvent === 'DIV0') {
        const cx = currentMap.width / 2;
        const cy = currentMap.height / 2;
        if (isVisible(cx - 150, cy - 150, 300, 300)) {
          const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 150);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
          gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.8)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(cx, cy, 150, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#ff4444';
          ctx.font = 'bold 24px Consolas';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('#DIV/0!', cx, cy);
        }
      }

      currentMap?.obstacles?.forEach((obs: any) => {
        if (!isVisible(obs.x, obs.y, obs.w, obs.h)) return;
        ctx.fillStyle = '#f3f2f1';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#c8c6c4';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        
        ctx.strokeStyle = '#e1dfdd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = -obs.h; i < obs.w; i += 20) {
          ctx.moveTo(obs.x + i, obs.y);
          ctx.lineTo(obs.x + i + obs.h, obs.y + obs.h);
        }
        ctx.stroke();
      });

      gameState.dynamicObstacles?.forEach((obs: any) => {
        if (!isVisible(obs.x, obs.y, obs.w, obs.h)) return;
        ctx.fillStyle = '#f3f2f1';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#00bcf2'; // Blue border for freeze cell obstacles
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        
        ctx.strokeStyle = '#00bcf2';
        ctx.lineWidth = 1;
        ctx.beginPath();
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

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const rings = 5;
          for (let r = 0; r < rings; r++) {
            const ringProgress = (r + 1) / rings;
            const ringRadius = p.radius * (0.18 + ringProgress * 0.92) * progress;
            const charCount = Math.min(52, Math.max(8, Math.floor(ringRadius / 7) + r * 4));
            const fontSize = Math.max(9, 24 - r * 3.2);
            const wobble = 2.2 + r * 0.7;
            ctx.font = `bold ${fontSize}px monospace`;
            const ringAlpha = alpha * (1 - r * 0.14);

            for (let i = 0; i < charCount; i++) {
              const t = i / charCount;
              const angle = t * Math.PI * 2 + renderNow * (0.0014 + r * 0.00025);
              const pulse = Math.sin(renderNow * 0.01 + i * 0.8 + r) * wobble;
              const rr = ringRadius + pulse;
              const cx = Math.cos(angle) * rr;
              const cy = Math.sin(angle) * rr;
              const token = explosionChars[(i + r + Math.floor(renderNow / 70)) % explosionChars.length];

              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(angle + Math.PI / 2 + Math.sin(renderNow * 0.004 + i) * 0.15);
              ctx.fillStyle = `rgba(${255 - r * 18}, ${120 - r * 10}, ${40 + r * 16}, ${Math.max(0.05, ringAlpha * (0.72 - t * 0.18))})`;
              ctx.fillText(token, 0, 0);
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
          const scrollY = (renderNow * 0.05) % 20;
          
          for (let mx = -p.radius; mx <= p.radius; mx += 15) {
            for (let my = -p.radius - 20; my <= p.radius; my += 20) {
              const char = matrixChars[Math.floor(Math.abs(mx * my + renderNow*0.001)) % matrixChars.length];
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

      gameState.enemyBullets?.forEach((eb: any) => {
        if (!isVisible(eb.x - eb.size, eb.y - eb.size, eb.size * 2, eb.size * 2)) return;
        ctx.save();
        ctx.translate(eb.x, eb.y);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const hostileTokens: Record<string, string[]> = {
          value: ['#VALUE!', 'NaN', 'TypeError'],
          row: ['<ROW/>', '////', '===>'],
          col: ['<COL/>', '||||', '::'],
          ref: ['#REF!', '?', 'NULL'],
          vlookup: ['VLOOKUP', '=>', 'MISS']
        };
        const seq = hostileTokens[eb.type] || ['ERR'];
        const token = seq[Math.floor((renderNow / 40 + eb.id) % seq.length)];
        const alpha = Math.max(0.35, eb.life / 300);

        ctx.fillStyle = `rgba(255, 70, 70, ${alpha})`;
        ctx.font = `bold ${Math.max(12, eb.size * 1.4)}px monospace`;

        for (let lane = -1; lane <= 1; lane++) {
          const yJitter = Math.sin(renderNow * 0.02 + eb.id + lane) * 2;
          ctx.fillText(token, 0, lane * 10 + yJitter);
        }

        ctx.restore();
      });

      gameState.enemies?.forEach((e: any) => {
        if (!isVisible(e.x - e.width/2, e.y - e.height/2, e.width, e.height)) return;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (e.type === 'FormatBrush' && e.state === 'warning') {
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.dashTargetX || e.x, e.dashTargetY || e.y);
          ctx.strokeStyle = 'rgba(255, 90, 90, 0.65)';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (e.type === 'ProtectedView' && e.facingAngle !== undefined) {
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.width/2 + 10, e.facingAngle - Math.PI/4, e.facingAngle + Math.PI/4);
          ctx.strokeStyle = '#00a2ed';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        const phase = renderNow * 0.002 + e.id;
        const baseColorMap: Record<string, string> = {
          Minion: '#a0a0a0',
          Elite: '#ff5a5a',
          MiniBoss: '#ffd166',
          EliteBoss: '#ff355e',
          Value: '#ff8a3d',
          FormatBrush: '#ffd43b',
          FreezeCell: '#59d8ff',
          ProtectedView: '#3ecf8e',
          MergedCell: '#b892ff',
          SplitCell: '#ff70d8',
          REF: '#ff3b3b',
          VLOOKUP: '#4aa8ff',
          MACRO: '#43d17a',
          MINION: '#ff8080'
        };

        let tokenPool = ['NULL', 'NaN', '{}'];
        if (e.type === 'Minion') tokenPool = ['lorem', 'var', 'tmp', 'obj'];
        else if (e.type === 'Elite') tokenPool = ['ERR', 'panic!', 'stack'];
        else if (e.type === 'MiniBoss') tokenPool = ['TODO', 'FIXME', 'REWORK'];
        else if (e.type === 'EliteBoss') tokenPool = ['{', '}', '<', '>', '/', '\\', '0', '1', 'x', '=', '?', '#'];
        else if (e.type === 'Value') tokenPool = ['#N/A', '#VALUE!', 'NaN'];
        else if (e.type === 'FormatBrush') tokenPool = ['paint()', 'fmt', '{style}'];
        else if (e.type === 'FreezeCell') tokenPool = ['const', 'let', 'lock'];
        else if (e.type === 'ProtectedView') tokenPool = ['readonly', 'shield', 'perm'];
        else if (e.type === 'MergedCell') tokenPool = ['merge', '[][]', '<td>'];
        else if (e.type === 'SplitCell') tokenPool = ['split', '::', '..'];
        else if (e.type === 'REF') tokenPool = ['#REF!', '?', 'dangling'];
        else if (e.type === 'VLOOKUP') tokenPool = ['VLOOKUP', 'index', 'find'];
        else if (e.type === 'MACRO') tokenPool = ['macro()', 'exec', 'virus'];
        else if (e.type === 'MINION') tokenPool = ['ERR', 'bomb()', '!!'];

        const baseColor = baseColorMap[e.type] || '#cccccc';

        if (e.type === 'EliteBoss') {
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.globalAlpha = 0.9;
          const layers = 7;
          for (let layer = 0; layer < layers; layer++) {
            const r = Math.max(90, e.width * 0.28 - layer * 10);
            const chars = 80 + layer * 20;
            ctx.fillStyle = `hsla(${(renderNow / 8 + layer * 40) % 360}, 95%, ${45 + layer * 3}%, ${0.18 + layer * 0.05})`;
            ctx.font = `bold ${10 + layer}px monospace`;
            for (let i = 0; i < chars; i++) {
              const a = (i / chars) * Math.PI * 2 + phase * (0.6 + layer * 0.08);
              const wiggle = Math.sin(a * 3 + phase * 3 + layer) * (14 + layer * 2);
              const x = Math.cos(a) * (r + wiggle);
              const y = Math.sin(a) * (r * 0.42 + wiggle * 0.35);
              const glyph = tokenPool[(i + layer) % tokenPool.length];
              ctx.fillText(glyph, x, y);
            }
          }
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = 'bold 18px monospace';
          ctx.fillText('KERNEL_PANIC_BOSS', 0, 0);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(e.x, e.y);

          const bodyW = e.width * (0.82 + Math.sin(phase * 1.7) * 0.08);
          const bodyH = e.height * (0.8 + Math.cos(phase * 1.45) * 0.1);
          const bulges = 18;
          ctx.beginPath();
          for (let i = 0; i <= bulges; i++) {
            const t = i / bulges;
            const a = t * Math.PI * 2;
            const irregular = 1 + Math.sin(a * 3 + phase * 2.6) * 0.17 + Math.sin(a * 7 - phase * 1.8) * 0.08;
            const x = Math.cos(a) * bodyW * 0.55 * irregular;
            const y = Math.sin(a) * bodyH * 0.55 * (1 + Math.cos(a * 4 + phase * 2.2) * 0.11);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.clip();

          const layers = 4;
          const lineHeight = Math.max(10, Math.floor(e.height / 7));
          for (let layer = 0; layer < layers; layer++) {
            ctx.fillStyle = `hsla(${(renderNow / 11 + layer * 25) % 360}, 88%, ${46 + layer * 8}%, ${0.18 + layer * 0.13})`;
            ctx.font = `bold ${Math.max(12, Math.min(26, e.height * 0.38 - layer * 1.5))}px monospace`;
            const lines = Math.max(3, Math.floor(e.height / 8) + layer);
            for (let row = 0; row < lines; row++) {
              let line = '';
              const charsPerLine = Math.max(8, Math.floor(e.width / 9));
              for (let col = 0; col < charsPerLine; col++) {
                const t = tokenPool[Math.floor((renderNow / 45 + row * 4 + col * (1.2 + layer * 0.2) + e.id + layer * 3) % tokenPool.length)];
                line += (t?.[col % t.length] || t?.[0] || 'x');
              }
              const x = Math.sin(renderNow * 0.002 + row * 0.7 + layer) * (8 + layer * 4);
              const y = (row - (lines - 1) / 2) * lineHeight + Math.cos(renderNow * 0.003 + row + layer) * 4;
              ctx.fillText(line, x, y);
            }
          }

          ctx.restore();
        }

        if (e.type === 'VLOOKUP' && e.state === 'aiming' && e.dashTargetX !== undefined && e.dashTargetY !== undefined) {
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.dashTargetX, e.dashTargetY);
          ctx.strokeStyle = `rgba(255, 50, 50, ${Math.max(0.2, 1 - (e.stateTimer || 0)/120)})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        if (e.type === 'MiniBoss' || e.type === 'EliteBoss' || e.type === 'FreezeCell' || e.type === 'MergedCell' || e.type === 'REF' || e.type === 'VLOOKUP' || e.type === 'MACRO') {
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(e.x - e.width/2, e.y - e.height/2 - 10, e.width, 4);
          const hpGrad = ctx.createLinearGradient(e.x - e.width/2, 0, e.x + e.width/2, 0);
          hpGrad.addColorStop(0, '#ff5454');
          hpGrad.addColorStop(1, '#ff9b54');
          ctx.fillStyle = hpGrad;
          ctx.fillRect(e.x - e.width/2, e.y - e.height/2 - 10, e.width * (e.hp / e.maxHp), 4);
        }
      });

      Object.values(gameState.players).forEach((p: any) => {
        if (p.hp > 0) {
          if (!isVisible(p.x - 40, p.y - 12, 80, 24)) return;

          const isMe = p.id === myId;
          const now = renderNow;
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

      Object.values(gameState.players).forEach((p: any) => {
        if (!(p?.specificUpgrades || []).includes('array_orbit') || p.hp <= 0) return;
        const oa = p.orbitAngle || 0;
        for (let i = 0; i < 8; i++) {
          const a = oa + i * Math.PI / 4;
          const ox = p.x + Math.cos(a) * 55;
          const oy = p.y + Math.sin(a) * 55;
          if (!isVisible(ox - 8, oy - 8, 16, 16)) continue;
          ctx.beginPath();
          ctx.arc(ox, oy, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#107c41';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      gameState.bullets?.forEach((b: any) => {
        if (!isVisible(b.x - 20, b.y - 20, 40, 40)) return;

        ctx.save();
        ctx.translate(b.x, b.y);

        if (b.angle !== undefined) {
          ctx.rotate(b.angle);
        } else {

          ctx.rotate(Math.atan2(b.vy, b.vx));
        }

        if (b.type === 'wordart') {
          let scaleX = 1;
          let scaleY = 1;
          if (b.width && b.height) {
            const baseWidth = b.size * 4;
            const baseHeight = b.size;
            scaleX = b.width / baseWidth;
            scaleY = b.height / baseHeight;
            ctx.scale(scaleX, scaleY);
          }

          const stream = b.isTitle
            ? '<<while(alive){push(code_wall);}>>'
            : 'if(hit){++pressure;}else{advance();}';
          const glyphSize = Math.max(14, b.size * 0.5);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = (b.isItalic ? 'italic ' : '') + `900 ${glyphSize}px monospace`;
          ctx.shadowColor = b.isShield ? 'rgba(120,255,250,0.9)' : 'rgba(60,230,190,0.45)';
          ctx.shadowBlur = b.isShield ? 18 : 9;

          const lanes = b.isTitle ? 7 : 5;
          for (let lane = -Math.floor(lanes / 2); lane <= Math.floor(lanes / 2); lane++) {
            const laneOffset = lane * (glyphSize * 0.64);
            const laneAlpha = 0.5 + (1 - Math.abs(lane) / (lanes * 0.6)) * 0.45;
            let out = '';
            const len = b.isTitle ? 22 : 16;
            for (let i = 0; i < len; i++) {
              const idx = Math.floor((renderNow / 48 + i + lane * 2 + b.id) % stream.length);
              out += stream[idx] || '#';
            }
            const xJitter = Math.sin(renderNow * 0.01 + lane * 0.7 + b.id) * 6;
            const yJitter = Math.cos(renderNow * 0.009 + lane * 0.8 + b.id) * 2.5;
            ctx.fillStyle = `rgba(${90 + Math.abs(lane) * 22},255,220,${laneAlpha})`;
            ctx.fillText(out, xJitter, laneOffset + yJitter);
          }

          if (b.isStrikethrough) {
            ctx.beginPath();
            ctx.moveTo(-b.size * 3.2, 0);
            ctx.lineTo(b.size * 3.2, 0);
            ctx.strokeStyle = '#ff4b4b';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        } else if (b.type === 'sparkline') {
          const token = ['=>', '::', '01', '{}'][Math.floor((renderNow / 60 + b.id) % 4)];
          ctx.fillStyle = 'rgba(70,180,255,0.9)';
          ctx.font = `bold ${Math.max(12, b.size * 0.9)}px monospace`;
          for (let k = -2; k <= 2; k++) {
            const x = k * (b.size * 0.45);
            const y = Math.sin(renderNow * 0.01 + k + b.id) * 2;
            ctx.fillText(token, x, y);
          }
        } else if (b.type === 'comment') {
          const bombTokens = ['#REF!', '#VALUE!', '{}', '[[]]', 'NaN', '0xFF', 'ERR', 'SIG'];
          const radius = Math.max(8, b.size * 0.55);
          const glyphs = 10;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          for (let i = 0; i < glyphs; i++) {
            const a = (i / glyphs) * Math.PI * 2 + renderNow * 0.012;
            const rr = radius + Math.sin(renderNow * 0.02 + i) * 2;
            const x = Math.cos(a) * rr;
            const y = Math.sin(a) * rr;
            const tok = bombTokens[(i + b.id) % bombTokens.length];
            ctx.font = `bold ${Math.max(10, b.size * 0.5 - (i % 3))}px monospace`;
            ctx.fillStyle = `rgba(255, ${140 - i * 6}, ${80 + i * 5}, ${0.75 - i * 0.03})`;
            ctx.fillText(tok, x, y);
          }

          ctx.font = `bold ${Math.max(11, b.size * 0.6)}px monospace`;
          ctx.fillStyle = 'rgba(255,230,180,0.95)';
          ctx.fillText('/*BOMB*/', 0, 0);

          if (b.isStrikethrough) {
            ctx.beginPath();
            ctx.moveTo(-b.size/2, 0);
            ctx.lineTo(b.size/2, 0);
            ctx.strokeStyle = '#ff4b4b';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        } else if (b.type === 'array') {
          ctx.fillStyle = '#73f7a6';
          ctx.font = (b.isItalic ? 'italic ' : '') + `bold ${Math.max(12, b.size)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(100,255,170,0.5)';
          ctx.shadowBlur = 6;
          const chars = ['0', '1', 'x', 'n', '{', '}', '[', ']', '='];
          const char = chars[Math.floor((renderNow / 50 + b.id) % chars.length)];
          ctx.fillText(char, 0, 0);
          ctx.shadowBlur = 0;

          if (b.isStrikethrough) {
            ctx.beginPath();
            ctx.moveTo(-b.size/2, 0);
            ctx.lineTo(b.size/2, 0);
            ctx.strokeStyle = '#ff4b4b';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        } else if (b.type === 'ctrl_c') {
          ctx.fillStyle = '#a8a8a8';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('[clone()]', 0, 0);
        } else {
          ctx.fillStyle = b.isCrit ? '#ff6767' : textColor;
          let fontStr = '';
          if (b.isItalic) fontStr += 'italic ';
          if (b.isBold) fontStr += 'bold ';
          fontStr += `${b.size}px monospace`;
          ctx.font = fontStr;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('code', 0, 0);

          if (b.isUnderline) {
            ctx.beginPath();
            ctx.moveTo(-10, b.size/2);
            ctx.lineTo(10, b.size/2);
            ctx.strokeStyle = textColor;
            ctx.lineWidth = b.isBold ? 2 : 1;
            ctx.stroke();
          }
        }

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
          const visibleLaserRange = Math.min(l.range, canvas.width / SCALE + 320); //保留
          const flow = (renderNow * 0.25) % 8;
          
          const sparklineChars = '01NaNnull{}[]()=>undefinedvoid0xFFerr%$#@!';
          
          if (isCannon) {
            ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
            ctx.shadowBlur = 15;
            ctx.fillStyle = `rgba(50, 50, 50, ${alpha})`;
            ctx.font = 'bold 36px monospace';
            const charCount = Math.floor(visibleLaserRange / 9);
            for (let i = 0; i < charCount; i++) {
              const dist = i * 9 + flow;
              const seed = Math.floor(renderNow / 50) + i;
              const char = sparklineChars[seed % sparklineChars.length];
              const yOffset = Math.sin(i * 0.35 + renderNow * 0.015) * 2;
              
              for (let w = -2; w <= 2; w++) {
                ctx.fillText(char, dist, yOffset + w * 18);
              }
            }
          } else {
            ctx.fillStyle = `rgba(30, 30, 30, ${alpha})`;
            ctx.font = '14px monospace';
            const charCount = Math.floor(visibleLaserRange / 4);
            for (let i = 0; i < charCount; i++) {
              const dist = i * 4 + flow;
              const seed = Math.floor(renderNow / 50) + i;
              const char = sparklineChars[seed % sparklineChars.length];
              const yOffset = Math.sin(i * 0.42 + renderNow * 0.02) * 1.2;
              const fade = 1 - (dist / visibleLaserRange);
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
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.font = p.color === '#e81123' ? 'bold 20px Calibri' : 'bold 14px Calibri';
        ctx.globalAlpha = Math.max(0, p.life / 30);
        ctx.fillText(p.text, p.x, p.y);
      });
      ctx.globalAlpha = 1.0;
      particles.current = particles.current.filter(p => p.life > 0);

      ctx.restore();

      ctx.fillStyle = '#f3f2f1';
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.strokeStyle = '#c8c6c4';
      ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(canvas.width, 24); ctx.stroke();
      
      ctx.fillStyle = '#666666';
      ctx.font = '12px Calibri, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      for (let c = startCol; c <= endCol; c++) {
        const screenX = (c * CELL_W - cameraX) * SCALE;
        const screenW = CELL_W * SCALE;
        let colName = '';
        let tempC = c;
        while (tempC >= 0) {
          colName = String.fromCharCode(65 + (tempC % 26)) + colName;
          tempC = Math.floor(tempC / 26) - 1;
        }
        ctx.fillText(colName, screenX + screenW / 2, 12);
        ctx.moveTo(screenX, 0); 
        ctx.lineTo(screenX, 24);
      }
      ctx.stroke();

      ctx.fillStyle = '#f3f2f1';
      ctx.fillRect(0, 0, 40, canvas.height);
      ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(40, canvas.height); ctx.stroke();
      
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'center';
      ctx.beginPath();
      for (let r = startRow; r <= endRow; r++) {
        const screenY = (r * CELL_H - cameraY) * SCALE;
        const screenH = CELL_H * SCALE;
        ctx.fillText((r + 1).toString(), 20, screenY + screenH / 2);
        ctx.moveTo(0, screenY); 
        ctx.lineTo(40, screenY);
      }
      ctx.stroke();

      ctx.fillStyle = '#e1dfdd';
      ctx.fillRect(0, 0, 40, 24);
      ctx.beginPath();
      ctx.moveTo(40, 0); ctx.lineTo(40, 24); ctx.lineTo(0, 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(35, 19); ctx.lineTo(35, 24); ctx.lineTo(40, 24);
      ctx.fillStyle = '#c8c6c4';
      ctx.fill();

      if (selectionStartRef.current && selectionEndRef.current) {
        const x = Math.min(selectionStartRef.current.x, selectionEndRef.current.x);
        const y = Math.min(selectionStartRef.current.y, selectionEndRef.current.y);
        const w = Math.abs(selectionEndRef.current.x - selectionStartRef.current.x);
        const h = Math.abs(selectionEndRef.current.y - selectionStartRef.current.y);
        
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
  }, [currentRoom, showGridMenu, isCleared]);

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
            <span className="text-[10px] text-gray-500">生存进度: {Math.floor((uiState?.stageTimer || 0) / 60)}s / {getStageDuration(uiState?.stage || 1)}s · 总关卡 {TOTAL_STAGES}</span>
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
        
        {me?.hp <= 0 && !isCleared && (
          <GameOver stageTimer={uiState?.stageTimer || 0} onRestart={() => window.location.reload()} />
        )}

        {isCleared && (
          <GameClear score={finalScore} kills={me?.kills || 0} deaths={me?.deaths || 0} onRestart={() => window.location.reload()} />
        )}

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
          {Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1).map(sheetNum => (
            <div 
              key={sheetNum}
              className={`px-3 py-1 cursor-default ${(uiState?.stage || 1) === sheetNum ? 'bg-white border-b-2 border-[#217346] font-semibold text-[#217346]' : 'hover:bg-gray-200'}`}
            >
              Sheet{sheetNum}
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
