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

export const rescaleImage = (image, targetW, targetH, options = {}) => {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  // CRITICAL: Disable smoothing for pixel art
  ctx.imageSmoothingEnabled = false;
  
  ctx.drawImage(image, 0, 0, targetW, targetH);

  if (options.removeWhite) {
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    removeWhiteBackground(ctx, imageData, options.tolerance);
  }

  return canvas;
};

/**
 * 2D Shelf Packing Algorithm
 * Arranges images in rows (shelves).
 */
export const shelfPacking = (images, maxWidth) => {
  // Sort by height descending for efficiency
  const sorted = [...images].sort((a, b) => b.height - a.height);
  
  let currentX = 0;
  let currentY = 0;
  let shelfHeight = 0;
  let totalWidth = 0;
  let totalHeight = 0;

  const placements = [];

  for (const img of sorted) {
    if (currentX + img.width > maxWidth) {
      // Move to next shelf
      currentX = 0;
      currentY += shelfHeight;
      shelfHeight = 0;
    }

    placements.push({
      img,
      x: currentX,
      y: currentY,
      w: img.width,
      h: img.height
    });

    currentX += img.width;
    shelfHeight = Math.max(shelfHeight, img.height);
    totalWidth = Math.max(totalWidth, currentX);
    totalHeight = Math.max(totalHeight, currentY + shelfHeight);
  }

  return {
    placements,
    width: totalWidth,
    height: totalHeight
  };
};

export const generateSpriteSheet = async (assets, baseResolution, options) => {
  // 1. Process and Rescale each image
  const processedImages = await Promise.all(assets.map(async (asset) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetW = asset.gridSpan.w * baseResolution;
        const targetH = asset.gridSpan.h * baseResolution;
        const canvas = rescaleImage(img, targetW, targetH, {
          removeWhite: options.removeWhite,
          tolerance: options.tolerance
        });
        resolve(canvas);
      };
      img.src = asset.preview;
    });
  }));

  // 2. Pack images
  // We can estimate a max width, e.g., 1024 or based on total width
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
  
  // Ensure no smoothing here too if we draw images
  ctx.imageSmoothingEnabled = false;

  packingResult.placements.forEach(p => {
    ctx.drawImage(p.img, p.x, p.y);
  });

  return masterCanvas;
};
