import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Trash2, 
  Settings2, 
  Download, 
  Package, 
  Grid3X3, 
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { generateSpriteSheet } from './utils/canvasProcessor';

const GRID_RESOLUTIONS = [16, 32, 48, 64];

export default function App() {
  const [packageName, setPackageName] = useState('MySpriteSheet');
  const [baseResolution, setBaseResolution] = useState(32);
  const [removeWhite, setRemoveWhite] = useState(false);
  const [tolerance, setTolerance] = useState(15);
  const [generateOutlines, setGenerateOutlines] = useState(false);
  const [assets, setAssets] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    const newAssets = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      gridSpan: { w: 1, h: 1 },
      padding: { x: 0, y: 0 }
    }));
    setAssets(prev => [...prev, ...newAssets]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    }
  });

  const removeAsset = (id) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const updateGridSpan = (id, axis, value) => {
    setAssets(prev => prev.map(a => 
      a.id === id ? { ...a, gridSpan: { ...a.gridSpan, [axis]: parseInt(value) || 1 } } : a
    ));
  };

  const updatePadding = (id, axis, value) => {
    setAssets(prev => prev.map(a => 
      a.id === id ? { ...a, padding: { ...a.padding, [axis]: parseInt(value) || 0 } } : a
    ));
  };

  const downloadFile = (blob, fileName) => {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleGenerate = async () => {
    if (assets.length === 0) return;
    setIsGenerating(true);
    try {
      const { canvas, packing } = await generateSpriteSheet(assets, baseResolution, { removeWhite, tolerance });
      
      // 1. Download Sprite Sheet PNG
      canvas.toBlob((blob) => downloadFile(blob, `${packageName}.png`));

      // 2. Generate and Download Tiled .tsx
      const tileCount = packing.placements.length;
      const columns = Math.floor(packing.width / baseResolution);
      const tsxContent = `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.10.2" name="${packageName}" tilewidth="${baseResolution}" tileheight="${baseResolution}" tilecount="${tileCount}" columns="${columns}">
  <image source="${packageName}.png" width="${packing.width}" height="${packing.height}"/>
</tileset>`;
      const tsxBlob = new Blob([tsxContent], { type: 'text/xml' });
      downloadFile(tsxBlob, `${packageName}.tsx`);

      // 3. Generate and Download Outlines if enabled
      if (generateOutlines) {
        const { generateHoverOutlines } = await import('./utils/canvasProcessor');
        const outlineCanvas = generateHoverOutlines(canvas);
        outlineCanvas.toBlob((blob) => downloadFile(blob, `${packageName}_outlines.png`));
      }

    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-12 text-gray-200">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header / Top Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">SpritePacker</h1>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-full transition-all"
                  title="How to Use"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-400">Pixel Art Sprite Sheet Generator</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-gray-500">Package Name</label>
              <input 
                type="text" 
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Pack name..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-gray-500">Base Grid</label>
              <select 
                value={baseResolution}
                onChange={(e) => setBaseResolution(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {GRID_RESOLUTIONS.map(res => (
                  <option key={res} value={res}>{res}x{res}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Dropzone & Asset List */}
          <div className="lg:col-span-2 space-y-6">
            <div 
              {...getRootProps()} 
              className={`
                relative cursor-pointer group
                border-2 border-dashed rounded-2xl p-12 transition-all duration-300
                flex flex-col items-center justify-center gap-4
                ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 hover:border-gray-600 bg-gray-900/50'}
              `}
            >
              <input {...getInputProps()} />
              <div className={`p-4 rounded-full ${isDragActive ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 group-hover:text-gray-200'}`}>
                <Upload className="w-8 h-8" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-gray-200">
                  {isDragActive ? 'Drop your sprites here' : 'Drag & drop assets'}
                </p>
                <p className="text-sm text-gray-500">Supports PNG and JPG</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {assets.map((asset) => (
                <div key={asset.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 items-center">
                  <div className="relative w-16 h-16 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center border border-gray-700">
                    <img src={asset.preview} alt="preview" className="max-w-full max-h-full object-contain image-pixelated" />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-medium text-gray-400 truncate w-32">{asset.file.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
                        <span className="text-[10px] text-gray-500">W</span>
                        <input 
                          type="number" 
                          min="1"
                          value={asset.gridSpan.w}
                          onChange={(e) => updateGridSpan(asset.id, 'w', e.target.value)}
                          className="w-8 bg-transparent text-xs outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
                        <span className="text-[10px] text-gray-500">H</span>
                        <input 
                          type="number" 
                          min="1"
                          value={asset.gridSpan.h}
                          onChange={(e) => updateGridSpan(asset.id, 'h', e.target.value)}
                          className="w-8 bg-transparent text-xs outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded px-2 py-1">
                        <span className="text-[10px] text-indigo-400">PX</span>
                        <input 
                          type="number" 
                          value={asset.padding.x}
                          onChange={(e) => updatePadding(asset.id, 'x', e.target.value)}
                          className="w-8 bg-transparent text-xs outline-none text-indigo-200"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded px-2 py-1">
                        <span className="text-[10px] text-indigo-400">PY</span>
                        <input 
                          type="number" 
                          value={asset.padding.y}
                          onChange={(e) => updatePadding(asset.id, 'y', e.target.value)}
                          className="w-8 bg-transparent text-xs outline-none text-indigo-200"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => removeAsset(asset.id)}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Global Settings & Export */}
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-lg">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-4">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <h2 className="font-bold text-lg">Configuration</h2>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={removeWhite}
                      onChange={(e) => setRemoveWhite(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-800 rounded-full peer peer-checked:bg-indigo-600 transition-all"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all"></div>
                  </div>
                  <span className="text-sm font-medium text-gray-300">Remove White Background</span>
                </label>

                {removeWhite && (
                  <div className="space-y-2 pl-2 border-l-2 border-indigo-600/30 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold uppercase text-gray-500">Tolerance: {tolerance}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={tolerance} 
                      onChange={(e) => setTolerance(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer group pb-2 border-b border-gray-800/50">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={generateOutlines}
                      onChange={(e) => setGenerateOutlines(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-gray-800 rounded-full peer peer-checked:bg-indigo-600 transition-all"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all"></div>
                  </div>
                  <span className="text-sm font-medium text-gray-300">Generate Hover Outlines</span>
                </label>

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3">
                  <Grid3X3 className="w-5 h-5 text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-200 leading-relaxed">
                    Packing logic will use <strong>Nearest Neighbor</strong> scaling to preserve pixel crispness.
                  </p>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Assets</span>
                  <span className="font-mono text-white">{assets.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Target Grid</span>
                  <span className="font-mono text-white">{baseResolution}px</span>
                </div>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={assets.length === 0 || isGenerating}
                className={`
                  w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all
                  ${assets.length === 0 || isGenerating 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}
                `}
              >
                {isGenerating ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Generate & Download
                  </>
                )}
              </button>
            </div>

            {assets.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Ready to generate
              </div>
            )}
          </div>

        </main>
      </div>
      
      {/* How to Use Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-6 h-6 text-indigo-400" />
                <h2 className="text-xl font-bold text-white">How to Use SpritePacker</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <p className="text-gray-300 leading-relaxed">
                A client-side, privacy-first pipeline to generate production-ready sprite sheets for your 2D games.
              </p>
              
              <div className="space-y-6">
                {[
                  { title: "Set Base Grid", text: "Choose the core resolution for your game (e.g., 48x48)." },
                  { title: "Drag & Drop", text: "Upload your raw pixel art assets." },
                  { title: "Configure Spans & Padding", text: "Set grid blocks (WxH) and add PX/PY margins for perfect centering after auto-trimming." },
                  { title: "Clean Backgrounds", text: "Instantly remove backgrounds with Euclidean tolerance for anti-aliased edges." },
                  { title: "Tiled & Outlines", text: "Get a production-ready .tsx tileset and an optional _outlines.png for hover effects." },
                  { title: "Generate", text: "Instantly pack, scale (Nearest Neighbor), and download your game-ready assets." }
                ].map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-white mb-1">{step.title}</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gray-800/50 border-t border-gray-800 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Signature */}
      <footer className="w-full py-8 text-center mt-12">
        <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-medium tracking-wide">
          <span>Developed by Mustafa Baltacı</span>
          <span className="text-gray-700">x</span>
          <div className="flex items-center gap-1.5 text-indigo-400/80">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12,2L14.5,9.5L22,12L14.5,14.5L12,22L9.5,14.5L2,12L9.5,9.5L12,2Z" />
            </svg>
            <span className="uppercase tracking-[0.2em] text-[10px]">Gemini</span>
          </div>
        </div>
      </footer>

      <style>{`
        .image-pixelated {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  );
}
