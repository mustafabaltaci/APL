# SpritePacker ✨

![Client-Side Processing](https://img.shields.io/badge/Processing-100%25%20Client--Side-brightgreen)
![No Backend](https://img.shields.io/badge/Backend-None%20Required-blue)
![Tiled Compatible](https://img.shields.io/badge/Tiled-Compatible-orange)

**SpritePacker** is a professional, high-performance, and 100% client-side web application designed for game developers to generate optimized pixel art sprite sheets and Tiled-ready tilesets directly in the browser.

## ✨ Key Features

- **100% Privacy-First:** All image processing happens locally in your browser. No files are ever uploaded to a server.
- **Granular Per-Asset Control:** Toggle background removal and tweak Euclidean color tolerance individually for each uploaded sprite.
- **Auto-Trim & Padding:** Automatically crops empty space from sprites and centers them within grid cells with custom pixel padding.
- **Nearest Neighbor Scaling:** Ensures pixel art remains perfectly crisp and sharp at any resolution.
- **Professional Exports:**
  - **Master Sprite Sheet:** Optimized PNG generated using a 2D shelf-packing algorithm.
  - **Tiled Tileset (.tsx):** XML configuration ready to be dropped into the Tiled Map Editor.
  - **Hover Outlines:** Optional secondary sheet with 1px outlines for instant in-game hover effects.
- **Modern UI:** Responsive dark-mode dashboard built with React, Tailwind CSS, and Lucide icons.

## 🚀 Quick Start

1. **Set Base Grid:** Choose your game's core resolution (e.g., 32x32).
2. **Drag & Drop:** Upload your raw pixel art assets (PNG/JPG supported).
3. **Configure Assets:**
   - Adjust **W/H Spans** for multi-tile objects.
   - Set **PX/PY Padding** for internal margins.
   - Toggle **Clear Background** and adjust **Tolerance** per individual image.
4. **Generate:** Download your game-ready assets instantly.

## 🛠️ Tech Stack

- **Framework:** React (Vite)
- **Styling:** Tailwind CSS
- **Processing:** HTML5 Canvas API (ImageData manipulation)
- **Icons:** Lucide React
- **File Handling:** `react-dropzone`
- **Deployment:** GitHub Pages (via GitHub Actions)

## 📦 Installation & Development

If you want to run this project locally:

```bash
# Clone the repository
git clone https://github.com/mustafabaltaci/APL.git

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📜 License

Developed by **Mustafa Baltacı** x **Gemini**.
Released under the MIT License.
