function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function fitCover(sourceWidth, sourceHeight, viewportWidth, viewportHeight, zoom = 1) {
  const scale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight) * zoom;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { width, height, x: (viewportWidth - width) / 2, y: (viewportHeight - height) / 2 };
}

function keepInViewport(x, y, width, height, viewportWidth, viewportHeight) {
  return {
    x: clamp(x, viewportWidth - width, 0),
    y: clamp(y, viewportHeight - height, 0)
  };
}

function resizeAroundCenter(previous, next, viewportWidth, viewportHeight) {
  const centerX = (viewportWidth / 2 - previous.x) / previous.width;
  const centerY = (viewportHeight / 2 - previous.y) / previous.height;
  return keepInViewport(viewportWidth / 2 - centerX * next.width, viewportHeight / 2 - centerY * next.height,
    next.width, next.height, viewportWidth, viewportHeight);
}

module.exports = { fitCover, keepInViewport, resizeAroundCenter };
