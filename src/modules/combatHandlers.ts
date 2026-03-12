import React from 'react';
import { AttackForm, GeneralUpgrade, MAPS, Room, SpecificUpgrade, Upgrade } from '../gameLogic';

interface GridActionDeps {
  room: Room;
  myId: string;
  canvas: HTMLCanvasElement;
  selectionStart: { x: number; y: number };
  selectionEnd: { x: number; y: number };
  setShowGridMenu: React.Dispatch<React.SetStateAction<boolean>>;
  isSelectingGridRef: React.MutableRefObject<boolean>;
  selectionStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  selectionEndRef: React.MutableRefObject<{ x: number; y: number } | null>;
  shake: React.MutableRefObject<number>;
}

export function applyGridAction(type: 'area' | 'row' | 'col', deps: GridActionDeps) {
  const {
    room,
    myId,
    canvas,
    selectionStart,
    selectionEnd,
    setShowGridMenu,
    isSelectingGridRef,
    selectionStartRef,
    selectionEndRef,
    shake
  } = deps;

  const me = room.players[myId];
  if (!me) return;

  const SCALE = 0.8;
  const cameraX = me.x - canvas.width / (2 * SCALE);
  const cameraY = me.y - canvas.height / (2 * SCALE);

  const worldStartX = selectionStart.x / SCALE + cameraX;
  const worldStartY = selectionStart.y / SCALE + cameraY;
  const worldEndX = selectionEnd.x / SCALE + cameraX;
  const worldEndY = selectionEnd.y / SCALE + cameraY;

  const x = Math.min(worldStartX, worldEndX);
  const y = Math.min(worldStartY, worldEndY);
  const w = Math.abs(worldEndX - worldStartX);
  const h = Math.abs(worldEndY - worldStartY);

  room.bulletTime = 0;
  let hitCount = 0;
  room.enemies.forEach(e => {
    let hit = false;

    if (type === 'area') {
      hit = e.x + e.width/2 > x && e.x - e.width/2 < x + w &&
            e.y + e.height/2 > y && e.y - e.height/2 < y + h;
    } else if (type === 'row') {
      hit = e.y + e.height/2 > y && e.y - e.height/2 < y + h;
    } else if (type === 'col') {
      hit = e.x + e.width/2 > x && e.x - e.width/2 < x + w;
    }

    if (hit) {
      if (e.type === 'EliteBoss') {
        e.hp -= Math.min(e.hp, e.maxHp / 3);
      } else {
        e.hp -= 99999;
      }
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
}

interface SelectUpgradeDeps {
  room: Room;
  myId: string;
  totalStages: number;
  setFinalScore: React.Dispatch<React.SetStateAction<number>>;
  setIsCleared: React.Dispatch<React.SetStateAction<boolean>>;
  setUiState: React.Dispatch<React.SetStateAction<any>>;
}

export function applySelectedUpgrade(upgrade: Upgrade, deps: SelectUpgradeDeps) {
  const { room, myId, totalStages, setFinalScore, setIsCleared, setUiState } = deps;
  const p = room.players[myId];
  if (!p) return;

  if (['bold', 'underline', 'highlight', 'rand', 'vlookup', 'sum', 'italic', 'strikethrough', 'ctrl_c', 'ctrl_z', 'format_painter'].includes(upgrade)) {
    if (upgrade === 'format_painter' && p.attackForm === 'sparkline') {
      room.skillChoices = room.skillChoices.filter(u => u !== upgrade);
      return;
    }
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
    setUiState((prev: any) => prev ? { ...prev, skillChoices: room.skillChoices } : null);
    return;
  }

  p.readyForNextStage = true;

  room.isSelectingSkill = false;
  room.stage++;
  room.stageTimer = 0;

  if (room.stage > totalStages) {
    const score = (p.kills || 0) * 10 + totalStages * 200 - (p.deaths || 0) * 100;
    setFinalScore(Math.max(0, score));
    setIsCleared(true);
    setUiState((prev: any) => prev ? { ...prev, isSelectingSkill: false } : null);
    return;
  }

  if (room.stage <= MAPS.length) {
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
  setUiState((prev: any) => prev ? { ...prev, isSelectingSkill: false } : null);
}

export function applySelectedForm(room: Room, myId: string, form: AttackForm, setUiState: React.Dispatch<React.SetStateAction<any>>) {
  const p = room.players[myId];
  if (p) {
    p.attackForm = form;
  }

  room.isSelectingForm = false;
  setUiState((prev: any) => prev ? { ...prev, isSelectingForm: false } : null);
}
