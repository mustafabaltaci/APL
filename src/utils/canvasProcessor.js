/**
 * Utility for pixel manipulation and sprite sheet generation
 */

export const removeWhiteBackground = (ctx, imageData, tolerance = 15, cleanInnerWhites = false) => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const isWhite = (r, g, b) => {
    const distance = Math.sqrt(
      Math.pow(255 - r, 2) + 
      Math.pow(255 - g, 2) + 
      Math.pow(255 - b, 2)
    );
    return distance <= tolerance;
  };

  if (cleanInnerWhites) {
    // Branch A: Global Scan
    for (let i = 0; i < data.length; i += 4) {
      if (isWhite(data[i], data[i + 1], data[i + 2])) {
        data[i + 3] = 0;
      }
    }
  } else {
    // Branch B: Iterative BFS Flood Fill
    const visited = new Uint8Array(width * height);
    const queue = [];

    // Add border pixels to queue
    for (let x = 0; x < width; x++) {
      // Top border
      if (!visited[x] && isWhite(data[x * 4], data[x * 4 + 1], data[x * 4 + 2])) {
        queue.push(x, 0);
        visited[x] = 1;
      }
      // Bottom border
      const bottomIdx = (height - 1) * width + x;
      if (!visited[bottomIdx] && isWhite(data[bottomIdx * 4], data[bottomIdx * 4 + 1], data[bottomIdx * 4 + 2])) {
        queue.push(x, height - 1);
        visited[bottomIdx] = 1;
      }
    }
    for (let y = 0; y < height; y++) {
      // Left border
      const leftIdx = y * width;
      if (!visited[leftIdx] && isWhite(data[leftIdx * 4], data[leftIdx * 4 + 1], data[leftIdx * 4 + 2])) {
        queue.push(0, y);
        visited[leftIdx] = 1;
      }
      // Right border
      const rightIdx = y * width + (width - 1);
      if (!visited[rightIdx] && isWhite(data[rightIdx * 4], data[rightIdx * 4 + 1], data[rightIdx * 4 + 2])) {
        queue.push(width - 1, y);
        visited[rightIdx] = 1;
      }
    }

    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const idx = (y * width + x) * 4;
      
      data[idx + 3] = 0; // Make transparent

      // Check 4 neighbors
      const neighbors = [
        [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && isWhite(data[nIdx * 4], data[nIdx * 4 + 1], data[nIdx * 4 + 2])) {
            visited[nIdx] = 1;
            queue.push(nx, ny);
          }
        }
      }
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

export const processAsset = (image, asset, baseResolution) => {
  // 1. Create temporary canvas for initial processing (color keying)
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(image, 0, 0);

  if (asset.removeBg) {
    const imageData = tempCtx.getImageData(0, 0, image.width, image.height);
    removeWhiteBackground(tempCtx, imageData, asset.tolerance, asset.cleanInnerWhites);
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
        const canvas = processAsset(img, asset, baseResolution);
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
