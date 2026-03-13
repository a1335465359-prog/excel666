import React from 'react';
import { Room } from '../gameLogic';

interface InputHandlerDeps {
  keys: React.MutableRefObject<{ w: boolean; a: boolean; s: boolean; d: boolean }>;
  mouse: React.MutableRefObject<{ x: number; y: number; isDown: boolean }>;
  gameStateRef: React.MutableRefObject<Room | null>;
  containerRef: React.RefObject<HTMLDivElement>;
  selectionStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  selectionEndRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isSelectingGridRef: React.MutableRefObject<boolean>;
  showGridMenu: boolean;
  setShowGridMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setGridMenuPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  clampGridMenuPos: (x: number, y: number) => { x: number; y: number };
  myId: string;
}

export function attachInputHandlers(deps: InputHandlerDeps): () => void {
  const {
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
  } = deps;

  const handleKeyDown = (e: KeyboardEvent) => {
    const gs = gameStateRef.current;

    if (gs && gs.players[myId]) {
      const me = gs.players[myId];
      const digit = Number(e.key);

      if (gs.isSelectingForm && digit >= 1 && digit <= 4 && gs.formChoices[digit - 1]) {
        me.attackForm = gs.formChoices[digit - 1];
        gs.isSelectingForm = false;
      }

    }

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
    if (e.key === 'w' || e.key === 'W') keys.current.w = false;
    if (e.key === 'a' || e.key === 'A') keys.current.a = false;
    if (e.key === 's' || e.key === 'S') keys.current.s = false;
    if (e.key === 'd' || e.key === 'D') keys.current.d = false;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouse.current.x = e.clientX - rect.left;
    mouse.current.y = e.clientY - rect.top;

    if (isSelectingGridRef.current && selectionStartRef.current) {
      selectionEndRef.current = { x: mouse.current.x, y: mouse.current.y };
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    mouse.current.isDown = true;

    if (showGridMenu) {
      const menuEl = document.getElementById('grid-menu');
      if (menuEl && !menuEl.contains(e.target as Node)) {
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

    if (isSelectingGridRef.current && selectionStartRef.current && selectionEndRef.current) {
      const dx = Math.abs(selectionEndRef.current.x - selectionStartRef.current.x);
      const dy = Math.abs(selectionEndRef.current.y - selectionStartRef.current.y);
      if (dx > 10 && dy > 10) {
        const pos = clampGridMenuPos(mouse.current.x, mouse.current.y);
        setGridMenuPos(pos);
        setShowGridMenu(true);
      } else {
        if (gameStateRef.current) gameStateRef.current.bulletTime = 0;
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
}
