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
  const [generateOutlines, setGenerateOutlines] = useState(false);
  const [assets, setAssets] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    // Check if a project file is dropped
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
              tolerance: asset.tolerance || 15
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
        tolerance: 15
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
    try {
      const { canvas, packing } = await generateSpriteSheet(assets, baseResolution, { generateOutlines });
      
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
      console.error(t('generationFailed'), error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Sticky Header with Glassmorphism */}
        <header className="sticky top-4 z-40 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('title')}</h1>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-full transition-all"
                  title={t('howToUse')}
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('description')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t('packageName')}</label>
              <input 
                type="text" 
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-48 font-medium shadow-sm"
                placeholder={t('packNamePlaceholder')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t('baseGrid')}</label>
              <select 
                value={baseResolution}
                onChange={(e) => setBaseResolution(Number(e.target.value))}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer font-medium shadow-sm"
              >
                {GRID_RESOLUTIONS.map(res => (
                  <option key={res} value={res}>{res}x{res}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-800">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          
          {/* Left Column: Dropzone & Asset List */}
          <div className="lg:col-span-2 space-y-6">
            <div 
              {...getRootProps()} 
              className={`
                relative cursor-pointer group
                border-2 border-dashed rounded-3xl p-16 transition-all duration-500
                flex flex-col items-center justify-center gap-6
                ${isDragActive 
                  ? 'border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/10' 
                  : 'border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 bg-white dark:bg-gray-900/50 shadow-sm'}
              `}
            >
              <input {...getInputProps()} />
              <div className={`p-6 rounded-3xl transition-all duration-500 ${isDragActive ? 'bg-indigo-600 text-white scale-110 shadow-xl' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:scale-105'}`}>
                <Upload className="w-10 h-10" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">
                  {isDragActive ? t('dropActive') : t('dropInactive')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('dropSupport')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {assets.map((asset) => (
                <div key={asset.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-5 shadow-sm hover:shadow-md transition-all duration-300 group">
                  <div className="flex gap-4 items-center">
                    <div className="relative w-20 h-20 bg-gray-50 dark:bg-gray-850 rounded-xl overflow-hidden flex items-center justify-center border border-gray-100 dark:border-gray-800 group-hover:border-indigo-500/30 transition-colors">
                      <img src={asset.preview} alt="preview" className="max-w-full max-h-full object-contain image-pixelated p-2" />
                    </div>
                    
                    <div className="flex-1 space-y-3 min-w-0">
                      <input 
                        type="text"
                        value={asset.customName}
                        onChange={(e) => updateAssetSetting(asset.id, 'customName', e.target.value)}
                        className="text-sm font-bold text-gray-700 dark:text-gray-300 bg-transparent border border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 rounded-lg px-2 py-1 -ml-2 outline-none w-full truncate transition-all"
                        title={t('renameAsset')}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
                          <span className="text-[10px] font-black text-gray-400">W</span>
                          <input 
                            type="number" 
                            min="1"
                            value={asset.gridSpan.w}
                            onChange={(e) => updateGridSpan(asset.id, 'w', e.target.value)}
                            className="w-8 bg-transparent text-xs font-bold outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1.5 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
                          <span className="text-[10px] font-black text-gray-400">H</span>
                          <input 
                            type="number" 
                            min="1"
                            value={asset.gridSpan.h}
                            onChange={(e) => updateGridSpan(asset.id, 'h', e.target.value)}
                            className="w-8 bg-transparent text-xs font-bold outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg px-2 py-1.5 hover:bg-indigo-500/10 transition-colors">
                          <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400">PX</span>
                          <input 
                            type="number" 
                            value={asset.padding.x}
                            onChange={(e) => updatePadding(asset.id, 'x', e.target.value)}
                            className="w-8 bg-transparent text-xs font-bold outline-none text-indigo-600 dark:text-indigo-300"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg px-2 py-1.5 hover:bg-indigo-500/10 transition-colors">
                          <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400">PY</span>
                          <input 
                            type="number" 
                            value={asset.padding.y}
                            onChange={(e) => updatePadding(asset.id, 'y', e.target.value)}
                            className="w-8 bg-transparent text-xs font-bold outline-none text-indigo-600 dark:text-indigo-300"
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => removeAsset(asset.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all self-start"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Per-Asset Background Removal Settings */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('clearBg')}</span>
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={asset.removeBg}
                          onChange={(e) => updateAssetSetting(asset.id, 'removeBg', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-checked:bg-indigo-600 transition-all"></div>
                        <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all shadow-sm"></div>
                      </div>
                    </label>

                    {asset.removeBg && (
                      <div className="flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                        <span className="text-[10px] font-black text-gray-400 uppercase whitespace-nowrap">{t('tolerance')} {asset.tolerance}</span>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={asset.tolerance} 
                          onChange={(e) => updateAssetSetting(asset.id, 'tolerance', parseInt(e.target.value))}
                          className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Global Settings & Export */}
          <div className="space-y-6 lg:sticky lg:top-36 self-start transition-all duration-300">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 space-y-8 shadow-xl">
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-5">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Settings2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="font-bold text-xl">{t('configuration')}</h2>
              </div>

              <div className="space-y-6">
                <label className="flex items-center justify-between cursor-pointer group pb-4 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('generateOutlines')}</span>
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={generateOutlines}
                      onChange={(e) => setGenerateOutlines(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-checked:bg-indigo-600 transition-all"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-6 transition-all shadow-md"></div>
                  </div>
                </label>

                <div className="p-5 bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-2xl flex gap-4">
                  <Grid3X3 className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                    {t('logicInfo')}
                  </p>
                </div>
              </div>

              <div className="pt-2 space-y-4">
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-850 px-4 py-3 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('totalAssets')}</span>
                  <span className="font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400">{assets.length}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-850 px-4 py-3 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('targetGrid')}</span>
                  <span className="font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400">{baseResolution}px</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                  onClick={handleSaveProject}
                  className="py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                >
                  <Save className="w-4 h-4 text-indigo-500" />
                  {t('saveProject')}
                </button>
                <label className="cursor-pointer py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 text-center">
                  <FolderOpen className="w-4 h-4 text-indigo-500" />
                  {t('loadProject')}
                  <input
                    type="file"
                    accept=".spack,.json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        onDrop(Array.from(e.target.files));
                        e.target.value = null; 
                      }
                    }}
                  />
                </label>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={assets.length === 0 || isGenerating}
                className={`
                  w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98]
                  ${assets.length === 0 || isGenerating 
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 dark:shadow-indigo-900/40 hover:-translate-y-1'}
                `}
              >
                {isGenerating ? (
                  <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Download className="w-6 h-6" />
                    {t('generateDownload')}
                  </>
                )}
              </button>
            </div>

            {assets.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 justify-center font-bold animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {t('readyToGenerate')}
              </div>
            )}
          </div>

        </main>
      </div>
      
      {/* How to Use Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-gray-950/60 backdrop-blur-xl animate-in fade-in duration-500"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
            <div className="flex items-center justify-between p-8 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-600 rounded-2xl">
                  <HelpCircle className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t('modalTitle')}</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-3 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
            
            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                {t('modalSubtitle')}
              </p>
              
              <div className="grid gap-8">
                {[
                  { title: t('step1Title'), text: t('step1Text') },
                  { title: t('step2Title'), text: t('step2Text') },
                  { title: t('step3Title'), text: t('step3Text') },
                  { title: t('step4Title'), text: t('step4Text') },
                  { title: t('step5Title'), text: t('step5Text') },
                  { title: t('step6Title'), text: t('step6Text') }
                ].map((step, i) => (
                  <div key={i} className="flex gap-6 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 group-hover:scale-110 shadow-sm">
                      {i + 1}
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-black text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{step.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-gray-50/50 dark:bg-gray-850/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/20 hover:-translate-y-1 active:scale-95"
              >
                {t('gotIt')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Signature */}
      <footer className="w-full py-12 text-center mt-12 border-t border-gray-100 dark:border-gray-900">
        <div className="inline-flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 font-bold tracking-widest uppercase">
          <span>{t('developedBy')}</span>
          <span className="w-1 h-1 bg-gray-300 dark:bg-gray-700 rounded-full"></span>
          <div className="flex items-center gap-2 text-indigo-500/80">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12,2L14.5,9.5L22,12L14.5,14.5L12,22L9.5,14.5L2,12L9.5,9.5L12,2Z" />
            </svg>
            <span className="tracking-[0.3em]">Gemini</span>
          </div>
        </div>
      </footer>

      <style>{`
        .image-pixelated {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
        }
      `}</style>
    </div>
  );
}
