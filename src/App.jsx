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
  Image as ImageIcon,
  Save,
  FolderOpen
} from 'lucide-react';
import { generateSpriteSheet } from './utils/canvasProcessor';
import { useLanguage } from './context/LanguageContext';
import { ThemeToggle, LanguageToggle } from './components/Toggles';

const GRID_RESOLUTIONS = [16, 32, 48, 64];

export default function App() {
  const { t } = useLanguage();
  const [packageName, setPackageName] = useState('MySpriteSheet');
  const [baseResolution, setBaseResolution] = useState(32);
  const [customGridW, setCustomGridW] = useState(64);
  const [customGridH, setCustomGridH] = useState(64);
  const [generateOutlines, setGenerateOutlines] = useState(false);
  const [assets, setAssets] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    const projectFile = acceptedFiles.find(file => file.name.endsWith('.spack') || file.name.endsWith('.json'));
    if (projectFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || !data.assets || !data.packageName) {
            throw new Error('Invalid project structure');
          }
          
          setPackageName(data.packageName);
          if (data.baseResolution) setBaseResolution(data.baseResolution);
          if (data.customGridW) setCustomGridW(data.customGridW);
          if (data.customGridH) setCustomGridH(data.customGridH);
          if (data.generateOutlines !== undefined) setGenerateOutlines(data.generateOutlines);
          
          const restoredAssets = await Promise.all(data.assets.map(async (asset) => {
            const res = await fetch(asset.base64Data);
            const blob = await res.blob();
            const file = new File([blob], asset.fileName, { type: asset.fileType });
            return {
              id: asset.id || Math.random().toString(36).substr(2, 9),
              customName: asset.customName || asset.fileName,
              file: file,
              preview: URL.createObjectURL(file),
              gridSpan: asset.gridSpan || { w: 1, h: 1 },
              padding: asset.padding || { x: 0, y: 0 },
              removeBg: asset.removeBg || false,
              tolerance: asset.tolerance || 15,
              cleanInnerWhites: asset.cleanInnerWhites || false
            };
          }));
          
          setAssets(restoredAssets);
        } catch (error) {
          console.error("Failed to load project:", error);
          alert(t('invalidProject'));
        }
      };
      reader.readAsText(projectFile);
      return;
    }

    const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
    const newAssets = imageFiles.map(file => {
      const lastDotIndex = file.name.lastIndexOf('.');
      const customName = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        customName,
        preview: URL.createObjectURL(file),
        gridSpan: { w: 1, h: 1 },
        padding: { x: 0, y: 0 },
        removeBg: true,
        tolerance: 15,
        cleanInnerWhites: false
      };
    });
    setAssets(prev => [...prev, ...newAssets]);
  }, [t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/json': ['.json', '.spack'],
      'application/x-spritepacker': ['.spack']
    }
  });

  const removeAsset = (id) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const handleClearAll = () => {
    if (assets.length === 0) return;
    if (window.confirm(t('confirmClear'))) {
      setAssets([]);
    }
  };

  const updateAssetSetting = (id, setting, value) => {
    setAssets(prev => prev.map(a => 
      a.id === id ? { ...a, [setting]: value } : a
    ));
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

  const handleSaveProject = async () => {
    try {
      const serializedAssets = await Promise.all(
        assets.map(async (asset) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: asset.id,
                customName: asset.customName,
                gridSpan: asset.gridSpan,
                padding: asset.padding,
                removeBg: asset.removeBg,
                tolerance: asset.tolerance,
                cleanInnerWhites: asset.cleanInnerWhites,
                fileName: asset.file.name,
                fileType: asset.file.type,
                base64Data: reader.result
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(asset.file);
          });
        })
      );

      const projectData = {
        version: 1,
        packageName,
        baseResolution,
        customGridW,
        customGridH,
        generateOutlines,
        assets: serializedAssets
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${packageName}_workspace.spack`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (error) {
      console.error('Failed to save project:', error);
      alert(t('failedToSave'));
    }
  };

  const handleGenerate = async () => {
    if (assets.length === 0) return;
    setIsGenerating(true);
    
    // Logic to determine actual grid size
    const activeGridW = baseResolution === 'custom' 
      ? (parseInt(customGridW, 10) || 32) 
      : (parseInt(baseResolution, 10) || 32);
    const activeGridH = baseResolution === 'custom' 
      ? (parseInt(customGridH, 10) || 32) 
      : (parseInt(baseResolution, 10) || 32);

    try {
      const { canvas, packing } = await generateSpriteSheet(assets, { w: activeGridW, h: activeGridH }, { generateOutlines });
      canvas.toBlob((blob) => downloadFile(blob, `${packageName}.png`));
      
      const tileCount = packing.placements.length;
      const columns = Math.floor(packing.width / activeGridW);
      const tsxContent = `<?xml version="1.0" encoding="UTF-8"?>\n<tileset version="1.10" tiledversion="1.10.2" name="${packageName}" tilewidth="${activeGridW}" tileheight="${activeGridH}" tilecount="${tileCount}" columns="${columns}">\n  <image source="${packageName}.png" width="${packing.width}" height="${packing.height}"/>\n</tileset>`;
      const tsxBlob = new Blob([tsxContent], { type: 'text/xml' });
      downloadFile(tsxBlob, `${packageName}.tsx`);

      if (generateOutlines) {
        const { generateHoverOutlines } = await import('./utils/canvasProcessor');
        const outlineCanvas = generateHoverOutlines(canvas);
        outlineCanvas.toBlob((blob) => downloadFile(blob, `${packageName}_outlines.png`));
      }

    } catch (error) {
      console.error(t('generationFailed'), error);
    } finally {
      setIsGenerating(false);
    }
  };

  const liquidGlassClass = "backdrop-blur-3xl bg-white/10 dark:bg-gray-950/40 border border-white/20 dark:border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),_inset_0_1px_1px_rgba(255,255,255,0.1)] transition-all duration-500";
  const nestedGlassClass = "bg-white/5 dark:bg-white/5 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-2xl transition-all duration-300";

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-500 antialiased selection:bg-indigo-500/30">
      {/* Background accents for depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10">
        
        {/* Liquid Glass Header */}
        <header className={`sticky top-4 z-40 flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-[2.5rem] ${liquidGlassClass}`}>
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] ring-1 ring-white/20">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white drop-shadow-sm">{t('title')}</h1>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-white/10 rounded-full transition-all"
                  title={t('howToUse')}
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-bold tracking-tight">{t('description')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('packageName')}</label>
              <input 
                type="text" 
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="bg-white/10 dark:bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-48 font-bold text-gray-800 dark:text-white"
                placeholder={t('packNamePlaceholder')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('baseGrid')}</label>
              <div className="flex items-center gap-2">
                <select
                  value={baseResolution}
                  onChange={(e) => setBaseResolution(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
                  className="bg-white dark:bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer font-bold text-gray-900 dark:text-white"
                >
                  {GRID_RESOLUTIONS.map(res => (
                    <option key={res} value={res} className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white">{res}x{res}</option>
                  ))}
                  <option value="custom" className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white">{t('custom')}</option>
                </select>
                {baseResolution === 'custom' && (
                  <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                    <div className="relative flex items-center">
                      <input 
                        type="number"
                        value={customGridW}
                        onChange={(e) => setCustomGridW(parseInt(e.target.value) || '')}
                        className="bg-white/10 dark:bg-black/20 border border-white/10 rounded-xl pl-2 pr-6 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all w-16 font-bold text-gray-800 dark:text-white"
                        min="1"
                        placeholder="W"
                      />
                      <span className="absolute right-2 text-[8px] font-black text-gray-500 uppercase pointer-events-none">w</span>
                    </div>
                    <span className="text-gray-500 font-black text-xs px-1">×</span>
                    <div className="relative flex items-center">
                      <input 
                        type="number"
                        value={customGridH}
                        onChange={(e) => setCustomGridH(parseInt(e.target.value) || '')}
                        className="bg-white/10 dark:bg-black/20 border border-white/10 rounded-xl pl-2 pr-6 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all w-16 font-bold text-gray-800 dark:text-white"
                        min="1"
                        placeholder="H"
                      />
                      <span className="absolute right-2 text-[8px] font-black text-gray-500 uppercase pointer-events-none">h</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          
          <div className="lg:col-span-2 space-y-6">
            {/* Liquid Glass Dropzone */}
            <div 
              {...getRootProps()} 
              className={`
                relative cursor-pointer group
                border-2 border-dashed rounded-[3rem] p-16 transition-all duration-700
                flex flex-col items-center justify-center gap-6
                ${isDragActive 
                  ? 'border-indigo-500 bg-indigo-500/10 ring-8 ring-indigo-500/5' 
                  : `border-white/10 hover:border-indigo-500/50 ${liquidGlassClass}`}
              `}
            >
              <input {...getInputProps()} />
              <div className={`p-8 rounded-[2rem] transition-all duration-700 shadow-2xl ${isDragActive ? 'bg-indigo-600 text-white scale-110' : 'bg-white/10 dark:bg-black/20 text-gray-400 group-hover:text-indigo-400 group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(79,70,229,0.3)]'}`}>
                <Upload className="w-12 h-12" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  {isDragActive ? t('dropActive') : t('dropInactive')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-black tracking-widest uppercase">{t('dropSupport')}</p>
              </div>
            </div>

            {/* Asset Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {assets.map((asset) => (
                <div key={asset.id} className={`rounded-[2rem] p-6 flex flex-col gap-6 group ${liquidGlassClass} hover:translate-y-[-4px] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]`}>
                  <div className="flex gap-4 items-center">
                    <div className="relative w-24 h-24 bg-black/30 rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 group-hover:border-indigo-500/40 transition-colors shadow-inner">
                      <img src={asset.preview} alt="preview" className="max-w-full max-h-full object-contain image-pixelated p-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                    </div>
                    
                    <div className="flex-1 space-y-3 min-w-0">
                      <input 
                        type="text"
                        value={asset.customName}
                        onChange={(e) => updateAssetSetting(asset.id, 'customName', e.target.value)}
                        className="text-sm font-black text-gray-900 dark:text-white bg-transparent border border-transparent hover:bg-white/10 hover:border-white/10 focus:bg-black/20 focus:border-indigo-500 rounded-lg px-2 py-1 -ml-2 outline-none w-full truncate transition-all shadow-none"
                        title={t('renameAsset')}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {['W', 'H'].map((dim, i) => (
                          <div key={dim} className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2 py-1.5 border border-white/5">
                            <span className="text-[10px] font-black text-gray-500">{dim}</span>
                            <input 
                              type="number" 
                              min="1"
                              value={i === 0 ? asset.gridSpan.w : asset.gridSpan.h}
                              onChange={(e) => i === 0 ? updateGridSpan(asset.id, 'w', e.target.value) : updateGridSpan(asset.id, 'h', e.target.value)}
                              className="w-8 bg-transparent text-xs font-bold outline-none text-white"
                            />
                          </div>
                        ))}
                        {['PX', 'PY'].map((pad, i) => (
                          <div key={pad} className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-1.5 shadow-[0_0_10px_rgba(79,70,229,0.1)]">
                            <span className="text-[10px] font-black text-indigo-400">{pad}</span>
                            <input 
                              type="number" 
                              value={i === 0 ? asset.padding.x : asset.padding.y}
                              onChange={(e) => i === 0 ? updatePadding(asset.id, 'x', e.target.value) : updatePadding(asset.id, 'y', e.target.value)}
                              className="w-8 bg-transparent text-xs font-bold outline-none text-indigo-300"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => removeAsset(asset.id)}
                      className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all self-start shadow-sm"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="pt-5 border-t border-white/10 flex flex-col gap-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('clearBg')}</span>
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={asset.removeBg}
                          onChange={(e) => updateAssetSetting(asset.id, 'removeBg', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6 bg-black/30 rounded-full peer peer-checked:bg-indigo-600 transition-all ring-1 ring-white/10"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-6 transition-all shadow-md"></div>
                      </div>
                    </label>

                    {asset.removeBg && (
                      <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('tolerance')} {asset.tolerance}</span>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={asset.tolerance} 
                            onChange={(e) => updateAssetSetting(asset.id, 'tolerance', parseInt(e.target.value))}
                            className="flex-1 h-1.5 bg-black/30 rounded-full appearance-none cursor-pointer accent-indigo-500 ring-1 ring-white/5"
                          />
                        </div>
                        
                        <label className="flex items-center justify-between cursor-pointer group/toggle" title={t('cleanWhitesTooltip')}>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('cleanInnerWhites')}</span>
                            <span className="text-[8px] font-bold text-gray-600 dark:text-gray-500 uppercase tracking-tight">{t('cleanWhitesTooltip')}</span>
                          </div>
                          <div className="relative flex items-center">
                            <input 
                              type="checkbox" 
                              checked={asset.cleanInnerWhites}
                              onChange={(e) => updateAssetSetting(asset.id, 'cleanInnerWhites', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-black/30 rounded-full peer peer-checked:bg-indigo-600 transition-all ring-1 ring-white/10"></div>
                            <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-md"></div>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 lg:sticky lg:top-36 self-start">
            {/* Liquid Glass Configuration Panel */}
            <div className={`rounded-[2.5rem] p-8 space-y-8 ${liquidGlassClass}`}>
              <div className="flex items-center gap-3 border-b border-white/10 pb-6">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl shadow-inner border border-white/5">
                  <Settings2 className="w-6 h-6 text-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                </div>
                <h2 className="font-black text-2xl tracking-tight">{t('configuration')}</h2>
              </div>

              <div className="space-y-6">
                <label className="flex items-center justify-between cursor-pointer group pb-4 border-b border-white/5">
                  <span className="text-sm font-black text-gray-700 dark:text-gray-300 tracking-tight">{t('generateOutlines')}</span>
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={generateOutlines}
                      onChange={(e) => setGenerateOutlines(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-black/30 rounded-full peer peer-checked:bg-indigo-600 transition-all ring-1 ring-white/10"></div>
                    <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full peer-checked:translate-x-7 transition-all shadow-xl"></div>
                  </div>
                </label>

                <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-[1.5rem] flex gap-4 shadow-inner backdrop-blur-sm">
                  <Grid3X3 className="w-7 h-7 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-200 leading-relaxed font-bold tracking-tight">
                    {t('logicInfo')}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className={`flex justify-between items-center px-5 py-4 ${nestedGlassClass} hover:bg-white/10 group`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('totalAssets')}</span>
                    {assets.length > 0 && (
                      <button 
                        onClick={handleClearAll}
                        className="p-1.5 text-red-500/70 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-all shadow-sm"
                        title={t('clearAll')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <span className="text-xl font-black text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.3)] group-hover:scale-110 transition-transform">{assets.length}</span>
                </div>
                <div className={`flex justify-between items-center px-5 py-4 ${nestedGlassClass} hover:bg-white/10 group`}>
                  <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">{t('targetGrid')}</span>
                  <span className="text-xl font-black text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.3)] group-hover:scale-110 transition-transform">
                    {baseResolution === 'custom' 
                      ? `${customGridW || 32}x${customGridH || 32}` 
                      : `${baseResolution}x${baseResolution}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                  onClick={handleSaveProject}
                  className="py-4 bg-white/10 dark:bg-black/20 hover:bg-white/20 text-gray-700 dark:text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 border border-white/5"
                >
                  <Save className="w-4 h-4 text-indigo-400" />
                  {t('saveProject')}
                </button>
                <label className="cursor-pointer py-4 bg-white/10 dark:bg-black/20 hover:bg-white/20 text-gray-700 dark:text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 text-center border border-white/5">
                  <FolderOpen className="w-4 h-4 text-indigo-400" />
                  {t('loadProject')}
                  <input type="file" accept=".spack,.json" className="hidden" onChange={(e) => { if (e.target.files?.length) { onDrop(Array.from(e.target.files)); e.target.value = null; } }} />
                </label>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={assets.length === 0 || isGenerating}
                className={`
                  w-full py-6 rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-3 transition-all duration-500 active:scale-[0.98]
                  ${assets.length === 0 || isGenerating 
                    ? 'bg-black/20 text-gray-600 cursor-not-allowed opacity-50' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:-translate-y-1 ring-1 ring-white/20'}
                `}
              >
                {isGenerating ? (
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Download className="w-7 h-7" />
                    {t('generateDownload')}
                  </>
                )}
              </button>
            </div>

            {assets.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-indigo-400 justify-center font-black uppercase tracking-[0.25em] animate-pulse drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]">
                <CheckCircle2 className="w-4 h-4" />
                {t('readyToGenerate')}
              </div>
            )}
          </div>

        </main>
      </div>
      
      {/* Liquid Glass Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-2xl animate-in fade-in duration-700" onClick={() => setIsModalOpen(false)} />
          <div className={`relative rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] animate-in zoom-in-95 slide-in-from-bottom-20 duration-700 ${liquidGlassClass}`}>
            <div className="flex items-center justify-between p-10 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl ring-1 ring-white/20">
                  <HelpCircle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">{t('modalTitle')}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-4 text-gray-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all"><X className="w-8 h-8" /></button>
            </div>
            
            <div className="p-10 space-y-10 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <p className="text-xl text-gray-300 leading-relaxed font-bold tracking-tight">{t('modalSubtitle')}</p>
              <div className="grid gap-10">
                {[1,2,3,4,5,6].map((i) => (
                  <div key={i} className="flex gap-8 group">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-indigo-500/10 border border-white/10 flex items-center justify-center text-indigo-400 font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-inner">{i}</div>
                    <div className="space-y-2">
                      <h3 className="font-black text-xl text-white group-hover:text-indigo-400 transition-colors">{t(`step${i}Title`)}</h3>
                      <p className="text-base text-gray-400 leading-relaxed font-bold">{t(`step${i}Text`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-10 bg-white/5 border-t border-white/10 flex justify-end">
              <button onClick={() => setIsModalOpen(false)} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-[0_15px_30px_rgba(79,70,229,0.3)] hover:-translate-y-1 active:scale-95 ring-1 ring-white/20">{t('gotIt')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-16 text-center mt-12 border-t border-white/10 relative z-10 bg-black/20 backdrop-blur-md">
        <div className="inline-flex items-center gap-4 text-[10px] text-gray-500 font-black tracking-[0.4em] uppercase">
          <span className="drop-shadow-sm">{t('developedBy')}</span>
          <span className="w-1.5 h-1.5 bg-gray-700 rounded-full shadow-inner" />
          <div className="flex items-center gap-2 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12,2L14.5,9.5L22,12L14.5,14.5L12,22L9.5,14.5L2,12L9.5,9.5L12,2Z" /></svg>
            <span className="tracking-[0.5em]">Gemini</span>
          </div>
        </div>
      </footer>

      <style>{`
        .image-pixelated { image-rendering: pixelated; image-rendering: crisp-edges; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
      `}</style>
    </div>
  );
}
