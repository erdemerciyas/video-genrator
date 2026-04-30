import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  ArrowRight, 
  Play, 
  Loader2, 
  Image as ImageIcon, 
  Video, 
  X,
  Settings2,
  Key,
  MessageSquare,
  History,
  Trash2,
  RefreshCw,
  Edit3
} from 'lucide-react';
import { 
  generateFlowVideo, 
  pollVideoOperation, 
  fetchVideoData,
  VideoResolution,
  VideoAspectRatio
} from './services/geminiService';

// Add type definition for window.aistudio
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface FlowItem {
  id: string;
  prompt: string;
  videoUrl: string | null;
  status: 'idle' | 'generating' | 'polling' | 'completed' | 'error';
  progress: string;
  error: string | null;
  createdAt: number;
}

export default function App() {
  const [startImage, setStartImage] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const activeFlow = flows.find(f => f.id === activeFlowId);

  const updateFlowAction = (id: string, updates: Partial<FlowItem>) => {
    setFlows(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleGenerate = async (targetId?: string) => {
    if (!hasApiKey) {
      setGlobalError("Lütfen önce bir API anahtarı seçin.");
      return;
    }
    if (!startImage || !endImage) {
      setGlobalError("Lütfen hem başlangıç hem de bitiş referans görsellerini ekleyin.");
      return;
    }

    const flowId = targetId || Math.random().toString(36).substr(2, 9);
    const flowToUse = targetId ? flows.find(f => f.id === targetId) : null;
    const flowPrompt = targetId ? (flowToUse?.prompt || '') : newPrompt;

    if (!targetId) {
      const newFlow: FlowItem = {
        id: flowId,
        prompt: flowPrompt,
        videoUrl: null,
        status: 'generating',
        progress: 'Başlatılıyor...',
        error: null,
        createdAt: Date.now()
      };
      setFlows(prev => [newFlow, ...prev]);
      setActiveFlowId(flowId);
      setNewPrompt('');
    } else {
      updateFlowAction(flowId, { status: 'generating', error: null, progress: 'Yeniden başlatılıyor...', videoUrl: null });
    }

    try {
      const operation = await generateFlowVideo({
        prompt: flowPrompt,
        startImageBase64: startImage,
        endImageBase64: endImage,
        resolution: VideoResolution.R_720P,
        aspectRatio: VideoAspectRatio.AR_16_9
      });

      updateFlowAction(flowId, { status: 'polling', progress: 'Video üretiliyor...' });
      
      let currentOp = operation;
      while (!currentOp.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        currentOp = await pollVideoOperation(currentOp);
        updateFlowAction(flowId, { progress: 'Görsel işleniyor...' });
      }

      if (currentOp.error) {
        throw new Error(currentOp.error?.message?.toString() || "Üretim hatası");
      }

      const uri = currentOp.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) {
        const url = await fetchVideoData(uri);
        updateFlowAction(flowId, { videoUrl: url, status: 'completed', progress: '' });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Beklenmedik bir hata oluştu.";
      updateFlowAction(flowId, { status: 'error', error: errorMessage });
    }
  };

  const handleEditPrompt = (id: string, newText: string) => {
    updateFlowAction(id, { prompt: newText });
  };

  const removeFlow = (id: string) => {
    setFlows(prev => prev.filter(f => f.id !== id));
    if (activeFlowId === id) setActiveFlowId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'start') setStartImage(reader.result as string);
        else setEndImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-screen bg-[#0A0A0A] text-[#E0E0E0] flex flex-col font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0F0F0F] shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]">
            <Video className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-medium tracking-tight">FlowVision <span className="text-white/40 font-light">/ Video Geçiş Projesi</span></h1>
        </div>
        <div className="flex items-center space-x-3">
          {!hasApiKey && (
            <button 
              onClick={handleSelectKey}
              className="px-4 py-1.5 rounded-md border border-white/10 text-sm hover:bg-white/5 flex items-center gap-2 transition-all"
            >
              <Key className="w-4 h-4 text-indigo-400" />
              API Anahtarı Seç
            </button>
          )}
          <div className="px-4 py-1.5 rounded-md bg-indigo-600/10 border border-indigo-600/20 text-[10px] font-mono text-indigo-400 uppercase tracking-widest">
            VEO ENGINE v3.1 ACTIVE
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Flow History */}
        <aside className="w-80 border-r border-white/10 bg-[#0F0F0F] flex flex-col shrink-0 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
              <History className="w-3 h-3" /> Akış Geçmişi
            </h2>
            <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-white/40">{flows.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {flows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20 italic">
                <MessageSquare className="w-8 h-8 mb-4" />
                <p className="text-xs">Henüz bir akış oluşturulmadı. Sağ alttaki kutudan ilk konuşmanızı ekleyin.</p>
              </div>
            ) : (
              flows.map(flow => (
                <button
                  key={flow.id}
                  onClick={() => setActiveFlowId(flow.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all border group relative ${
                    activeFlowId === flow.id 
                    ? 'bg-indigo-600/10 border-indigo-500/30' 
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      flow.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                      flow.status === 'error' ? 'bg-red-500/20 text-red-400' :
                      'bg-indigo-500/20 text-indigo-400 animate-pulse'
                    }`}>
                      {flow.status.toUpperCase()}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFlow(flow.id); }}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded-md hover:bg-red-500/20 text-red-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs line-clamp-2 text-white/70 font-medium leading-relaxed">{flow.prompt}</p>
                </button>
              ))
            )}
          </div>

          <div className="p-4 bg-black/20 border-t border-white/5">
            <div className="relative">
              <textarea 
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Yeni video geçişi için konuşma metni ekleyin..."
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-3 text-sm h-24 focus:outline-none focus:border-indigo-500/50 resize-none transition-all pr-12"
              />
              <button 
                onClick={() => handleGenerate()}
                disabled={!newPrompt.trim() || !startImage || !endImage || hasApiKey === false || flows.some(f => f.status === 'generating' || f.status === 'polling')}
                className="absolute bottom-3 right-3 p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </div>
            {globalError && (
              <p className="text-[10px] text-red-400 mt-2 text-center">{globalError}</p>
            )}
          </div>
        </aside>

        {/* Main Stage: Canvas and Active Flow Editor */}
        <main className="flex-1 bg-black flex flex-col items-center justify-center p-8 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="w-full max-w-4xl space-y-6">
            <div className="relative w-full aspect-video bg-[#111] rounded-2xl border border-white/5 overflow-hidden shadow-2xl flex items-center justify-center">
              {activeFlow?.videoUrl ? (
                <video 
                  src={activeFlow.videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain"
                />
              ) : activeFlow ? (
                <div className="text-center space-y-6">
                   <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                      {activeFlow.status === 'generating' || activeFlow.status === 'polling' ? (
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      ) : activeFlow.status === 'error' ? (
                        <X className="w-8 h-8 text-red-400" />
                      ) : (
                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white/40 border-b-[8px] border-b-transparent ml-1"></div>
                      )}
                   </div>
                   <p className="text-sm text-white/20 uppercase tracking-widest font-mono">
                     {activeFlow.status === 'polling' ? activeFlow.progress : activeFlow.status === 'error' ? activeFlow.error : 'Önizleme Bekleniyor'}
                   </p>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <Video className="w-12 h-12 text-white/5 mx-auto" />
                  <p className="text-white/20 text-xs uppercase tracking-widest">Başlamak için bir konuşma seçin veya yenisini ekleyin</p>
                </div>
              )}
            </div>

            {activeFlow && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0F0F0F] rounded-2xl border border-white/10 p-6 space-y-4 shadow-xl"
              >
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
                    <Edit3 className="w-3 h-3" /> Konuşma Metnini Düzenle
                  </label>
                  {activeFlow.status === 'completed' && (
                    <button 
                      onClick={() => handleGenerate(activeFlow.id)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors border border-indigo-400/20 px-2 py-1 rounded"
                    >
                      <RefreshCw className="w-3 h-3" /> Değişiklikleri Uygula & Yeniden Üret
                    </button>
                  )}
                </div>
                <textarea 
                  value={activeFlow.prompt}
                  onChange={(e) => handleEditPrompt(activeFlow.id, e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl p-4 text-sm h-24 focus:outline-none focus:border-indigo-500/50 resize-none transition-all"
                />
              </motion.div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Static Reference Frames */}
        <aside className="w-72 border-l border-white/10 bg-[#0F0F0F] p-5 shrink-0 overflow-y-auto">
          <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-6 italic">Şablon Referansları</h2>
          <p className="text-[10px] text-white/30 mb-8 leading-relaxed">Siz değiştirene kadar tüm videolar bu iki görsel arasında akış oluşturacaktır.</p>
          
          <div className="space-y-8">
            {/* Start Reference */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-white/70">Başlangıç Sahnesi</span>
                <button 
                  onClick={() => startInputRef.current?.click()}
                  className="text-[10px] text-indigo-400 hover:underline"
                >
                  {startImage ? 'Değiştir' : 'Yükle'}
                </button>
              </div>
              <div 
                onClick={() => startInputRef.current?.click()}
                className={`aspect-video w-full rounded-lg bg-[#1A1A1A] border-2 transition-all cursor-pointer relative overflow-hidden group flex items-center justify-center ${
                  startImage ? 'border-indigo-500/50' : 'border-white/5 border-dashed hover:border-white/20'
                }`}
              >
                {startImage ? (
                  <>
                    <div className="absolute inset-0 bg-indigo-600/10 pointer-events-none"></div>
                    <img src={startImage} alt="Start" className="w-full h-full object-cover" />
                  </>
                ) : (
                  <ImageIcon className="w-6 h-6 text-white/10" />
                )}
              </div>
              <input ref={startInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'start')} className="hidden" />
            </div>

            {/* Flow Indicator */}
            <div className="flex justify-center">
              <div className="w-[1px] h-12 bg-gradient-to-b from-indigo-500/50 to-transparent"></div>
            </div>

            {/* End Reference */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-white/70">Bitiş Sahnesi</span>
                <button 
                  onClick={() => endInputRef.current?.click()}
                  className="text-[10px] text-indigo-400 hover:underline"
                >
                  {endImage ? 'Değiştir' : 'Yükle'}
                </button>
              </div>
              <div 
                onClick={() => endInputRef.current?.click()}
                className={`aspect-video w-full rounded-lg bg-[#1A1A1A] border-2 transition-all cursor-pointer relative overflow-hidden group flex items-center justify-center ${
                  endImage ? 'border-indigo-500/50' : 'border-white/5 border-dashed hover:border-white/20'
                }`}
              >
                {endImage ? (
                  <>
                    <div className="absolute inset-0 bg-indigo-600/10 pointer-events-none"></div>
                    <img src={endImage} alt="End" className="w-full h-full object-cover" />
                  </>
                ) : (
                  <ImageIcon className="w-6 h-6 text-white/10" />
                )}
              </div>
              <input ref={endInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'end')} className="hidden" />
            </div>
          </div>
        </aside>
      </div>

      <footer className="h-10 border-t border-white/10 bg-[#0A0A0A] flex items-center justify-between px-6 text-[10px] text-white/30 font-mono tracking-wider shrink-0">
        <div className="flex items-center gap-6">
          <span>AI STUDIO POWERED</span>
          <span className="hidden sm:inline">TURKISH PROMPT SUPPORT: ON</span>
        </div>
        <div className="flex items-center space-x-6">
           <span className="text-indigo-400">STATUS: READY</span>
        </div>
      </footer>
    </div>
  );
}
