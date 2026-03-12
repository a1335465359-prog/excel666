export function clampGridMenuPosToViewport(
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  menuW = 220,
  menuH = 170,
  margin = 8
) {
  return {
    x: Math.max(margin, Math.min(maxW - menuW - margin, x)),
    y: Math.max(margin, Math.min(maxH - menuH - margin, y))
  };
}
