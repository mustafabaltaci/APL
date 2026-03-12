/**
 * Utility for pixel manipulation and sprite sheet generation
 */

export const removeWhiteBackground = (ctx, imageData, tolerance = 15) => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Calculate Euclidean distance from pure white (255, 255, 255)
    const distance = Math.sqrt(
      Math.pow(255 - r, 2) + 
      Math.pow(255 - g, 2) + 
      Math.pow(255 - b, 2)
    );

    if (distance <= tolerance) {
      data[i + 3] = 0; // Set alpha to 0
    }
  }
  ctx.putImageData(imageData, 0, 0);
};

export const getTrimmedBounds = (ctx, width, height) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hasContent = true;
      }
    }
  }

  return hasContent ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
};

export const processAsset = (image, asset, baseResolution, options = {}) => {
  // 1. Create temporary canvas for initial processing (color keying)
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(image, 0, 0);

  if (options.removeWhite) {
    const imageData = tempCtx.getImageData(0, 0, image.width, image.height);
    removeWhiteBackground(tempCtx, imageData, options.tolerance);
  }

  // 2. Auto-Trim
  const bounds = getTrimmedBounds(tempCtx, image.width, image.height);
  if (!bounds) return null; // Empty image

  // 3. Scale and Center in Grid Cell
  const gridW = asset.gridSpan.w * baseResolution;
  const gridH = asset.gridSpan.h * baseResolution;
  const padX = asset.padding?.x || 0;
  const padY = asset.padding?.y || 0;

  const availableW = Math.max(1, gridW - 2 * padX);
  const availableH = Math.max(1, gridH - 2 * padY);

  const scale = Math.min(availableW / bounds.w, availableH / bounds.h);
  const targetW = Math.floor(bounds.w * scale);
  const targetH = Math.floor(bounds.h * scale);

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = gridW;
  finalCanvas.height = gridH;
  const finalCtx = finalCanvas.getContext('2d');
  finalCtx.imageSmoothingEnabled = false;

  const offsetX = Math.floor((gridW - targetW) / 2);
  const offsetY = Math.floor((gridH - targetH) / 2);

  finalCtx.drawImage(
    tempCanvas,
    bounds.x, bounds.y, bounds.w, bounds.h,
    offsetX, offsetY, targetW, targetH
  );

  return finalCanvas;
};

export const generateHoverOutlines = (mainCanvas) => {
  const width = mainCanvas.width;
  const height = mainCanvas.height;
  const outlineCanvas = document.createElement('canvas');
  outlineCanvas.width = width;
  outlineCanvas.height = height;
  const outlineCtx = outlineCanvas.getContext('2d');

  const mainCtx = mainCanvas.getContext('2d');
  const mainData = mainCtx.getImageData(0, 0, width, height).data;
  const outlineImageData = outlineCtx.createImageData(width, height);
  const outlineData = outlineImageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = mainData[idx + 3];

      if (alpha === 0) {
        // Check 4-way neighbors
        const neighbors = [
          { x: x, y: y - 1 }, // Top
          { x: x, y: y + 1 }, // Bottom
          { x: x - 1, y: y }, // Left
          { x: x + 1, y: y }  // Right
        ];

        let isEdge = false;
        for (const n of neighbors) {
          if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
            const nIdx = (n.y * width + n.x) * 4;
            if (mainData[nIdx + 3] > 0) {
              isEdge = true;
              break;
            }
          }
        }

        if (isEdge) {
          outlineData[idx] = 0;     // R
          outlineData[idx + 1] = 255; // G (Bright Green Outline)
          outlineData[idx + 2] = 0;   // B
          outlineData[idx + 3] = 255; // A
        }
      }
    }
  }

  outlineCtx.putImageData(outlineImageData, 0, 0);
  return outlineCanvas;
};

/**
 * 2D Shelf Packing Algorithm
 */
export const shelfPacking = (images, maxWidth) => {
  const sorted = [...images].sort((a, b) => b.height - a.height);
  let currentX = 0, currentY = 0, shelfHeight = 0, totalWidth = 0, totalHeight = 0;
  const placements = [];

  for (const img of sorted) {
    if (currentX + img.width > maxWidth) {
      currentX = 0;
      currentY += shelfHeight;
      shelfHeight = 0;
    }
    placements.push({ img, x: currentX, y: currentY, w: img.width, h: img.height });
    currentX += img.width;
    shelfHeight = Math.max(shelfHeight, img.height);
    totalWidth = Math.max(totalWidth, currentX);
    totalHeight = Math.max(totalHeight, currentY + shelfHeight);
  }

  return { placements, width: totalWidth, height: totalHeight };
};

export const generateSpriteSheet = async (assets, baseResolution, options) => {
  // 1. Process and Rescale each image with Auto-Trim and Padding
  const processedImages = (await Promise.all(assets.map(async (asset) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = processAsset(img, asset, baseResolution, options);
        resolve(canvas);
      };
      img.src = asset.preview;
    });
  }))).filter(Boolean);

  // 2. Pack images
  const estimatedMaxWidth = Math.max(
    ...processedImages.map(i => i.width),
    Math.ceil(Math.sqrt(processedImages.reduce((acc, img) => acc + (img.width * img.height), 0))) * 1.5
  );
  const packingResult = shelfPacking(processedImages, estimatedMaxWidth);

  // 3. Create Master Canvas
  const masterCanvas = document.createElement('canvas');
  masterCanvas.width = packingResult.width;
  masterCanvas.height = packingResult.height;
  const ctx = masterCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  packingResult.placements.forEach(p => {
    ctx.drawImage(p.img, p.x, p.y);
  });

  return {
    canvas: masterCanvas,
    packing: packingResult
  };
};
