/**
 * PublicTour.tsx
 * World-Class Public Virtual Tour 360 User Experience
 * Modeled after professional virtual tour systems (indonesiavirtualtour.com / Panotour)
 * Features:
 * - Professional bottom control bar with scene selector & navigation chevrons
 * - "Little Planet" (Tiny Planet) intro and re-trigger button
 * - Seamless scene switching with sound & fly-through animation
 * - Quick thumbnail carousel drawer
 * - Ambient Web Audio soundscape
 * - Direct route to Admin Panel ('/admin')
 */

import React, { useState, useEffect } from 'react';
import { Scene, Hotspot, TourSettings } from './types';
import { PanoramaViewer } from './PanoramaViewer';
import { soundManager } from './audioManager';
import {
  Volume2,
  VolumeX,
  Compass,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Info,
  X,
  Lock,
  Share2,
  Maximize2,
  Minimize2,
  RotateCw,
  Globe,
  Glasses,
  MapPin,
} from 'lucide-react';

interface PublicTourProps {
  scenes: Scene[];
  settings: TourSettings;
  onNavigateToAdmin: () => void;
}

export const PublicTour: React.FC<PublicTourProps> = ({ scenes, settings, onNavigateToAdmin }) => {
  const [currentSceneId, setCurrentSceneId] = useState<string>(
    scenes.find((s) => s.isDefault)?.id || (scenes[0]?.id || '')
  );
  const [activeInfoHotspot, setActiveInfoHotspot] = useState<Hotspot | null>(null);
  const [isAudioActive, setIsAudioActive] = useState<boolean>(false);
  const [isAutoRotateActive, setIsAutoRotateActive] = useState<boolean>(true);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState<boolean>(false);
  const [isMapOpen, setIsMapOpen] = useState<boolean>(false);
  const [showShareToast, setShowShareToast] = useState<boolean>(false);
  const [viewerKey, setViewerKey] = useState<number>(1);

  const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
  const currentScene = scenes[currentIndex >= 0 ? currentIndex : 0] || scenes[0];

  // Auto-sync default scene
  useEffect(() => {
    if (!currentSceneId && scenes.length > 0) {
      const def = scenes.find((s) => s.isDefault) || scenes[0];
      setCurrentSceneId(def.id);
    }
  }, [scenes, currentSceneId]);

  // Predictive background preloader: automatically pre-caches connected & adjacent scenes in memory
  useEffect(() => {
    if (!currentScene) return;

    // 1. Gather all scene IDs connected via navigation hotspots in the current scene
    const connectedSceneIds = (currentScene.hotspots || [])
      .filter((h) => h.type === 'navigation' && h.targetSceneId)
      .map((h) => h.targetSceneId as string);

    // 2. Also include previous and next scenes in tour order
    const adjacentIds: string[] = [];
    if (currentIndex > 0 && scenes[currentIndex - 1]) {
      adjacentIds.push(scenes[currentIndex - 1].id);
    }
    if (currentIndex < scenes.length - 1 && scenes[currentIndex + 1]) {
      adjacentIds.push(scenes[currentIndex + 1].id);
    }

    const targetsToPreload = Array.from(new Set([...connectedSceneIds, ...adjacentIds]))
      .map((id) => scenes.find((s) => s.id === id))
      .filter((s): s is Scene => Boolean(s && s.imageUrl));

    targetsToPreload.forEach((targetScene) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const cacheUrl = targetScene.imageUrl.startsWith('data:') || targetScene.imageUrl.startsWith('blob:')
        ? targetScene.imageUrl
        : `${targetScene.imageUrl}${targetScene.imageUrl.includes('?') ? '&' : '?'}t=${targetScene.updatedAt ? new Date(targetScene.updatedAt).getTime() : Date.now()}`;
      img.src = cacheUrl;
    });
  }, [currentScene, currentIndex, scenes]);

  // Handle hotspot interaction
  const handleHotspotClick = (hotspot: Hotspot) => {
    if (hotspot.type === 'navigation' && hotspot.targetSceneId) {
      setCurrentSceneId(hotspot.targetSceneId);
    } else if (hotspot.type === 'info') {
      soundManager.playClickSfx();
      setActiveInfoHotspot(hotspot);
    }
  };

  // Previous and next scene navigation
  const handlePrevScene = () => {
    if (currentIndex > 0) {
      soundManager.playTransitionSfx();
      setCurrentSceneId(scenes[currentIndex - 1].id);
    }
  };

  const handleNextScene = () => {
    if (currentIndex < scenes.length - 1) {
      soundManager.playTransitionSfx();
      setCurrentSceneId(scenes[currentIndex + 1].id);
    }
  };

  // Toggle ambient audio
  const handleAudioToggle = () => {
    const newState = soundManager.toggleAmbient();
    setIsAudioActive(newState);
  };

  // Share tour link
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2500);
    }
  };

  if (!currentScene) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-300">Menyiapkan Virtual Tour 360°...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 360 Panorama Viewer with Little Planet intro */}
      <div className="absolute inset-0">
        <PanoramaViewer
          key={viewerKey}
          imageUrl={currentScene.imageUrl}
          initialPitch={currentScene.initialPitch}
          initialYaw={currentScene.initialYaw}
          hotspots={currentScene.hotspots || []}
          onHotspotClick={handleHotspotClick}
          autoRotate={isAutoRotateActive}
          onAutoRotateChange={setIsAutoRotateActive}
          stopAutoRotateOnInteraction={true}
          enableLittlePlanetIntro={viewerKey === 1 && currentIndex === 0}
          showControls={false} // Handled by our professional unified bottom bar
        />
      </div>

      {/* TOP HEADER: Branding & Admin link */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pointer-events-none">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3 bg-slate-900/85 border border-slate-800/90 py-2 px-4 rounded-2xl shadow-xl backdrop-blur-xs pointer-events-auto">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white/5 p-0.5" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-md">
              360°
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              {settings.appName || 'Wisata Binar Alam View'}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold uppercase">
                {currentScene.category || 'Zona'}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">{currentScene.title}</p>
          </div>
        </div>

        {/* Right: Sound, Share, & Admin Portal */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleShare}
            className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xl backdrop-blur-xs transition-colors"
            title="Bagikan Tautan Tour"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={onNavigateToAdmin}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white shadow-xl backdrop-blur-xs transition-all"
          >
            <Lock className="w-3.5 h-3.5 text-sky-400" />
            <span>Admin Panel</span>
          </button>
        </div>
      </header>

      {/* Share Toast */}
      {showShareToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-xs font-medium rounded-full shadow-2xl animate-bounce">
          <Sparkles className="w-4 h-4" />
          Tautan Virtual Tour berhasil disalin ke clipboard!
        </div>
      )}

      {/* INFO HOTSPOT MODAL POPUP */}
      {activeInfoHotspot && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100">
            <button
              onClick={() => setActiveInfoHotspot(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Info className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{activeInfoHotspot.title}</h3>
                <span className="text-xs text-amber-300 font-medium">Informasi Titik Lokasi</span>
              </div>
            </div>

            {activeInfoHotspot.imageUrl && (
              <img
                src={activeInfoHotspot.imageUrl}
                alt={activeInfoHotspot.title}
                className="w-full h-44 object-cover rounded-xl mb-4 border border-slate-800"
              />
            )}

            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line mb-6">
              {activeInfoHotspot.description || 'Tidak ada deskripsi detail tambahan untuk titik ini.'}
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveInfoHotspot(null)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Tutup Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= THUMBNAILS DRAWER ================= */}
      {isThumbnailsOpen && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[94vw] max-w-5xl bg-slate-900/95 border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-fadeIn">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white">Galeri Ruangan 360° ({scenes.length} Lokasi)</span>
            </div>
            <button
              onClick={() => setIsThumbnailsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
            {scenes.map((scene, idx) => {
              const isActive = scene.id === currentScene.id;
              return (
                <button
                  key={scene.id}
                  onClick={() => {
                    if (scene.id !== currentScene.id) {
                      soundManager.playTransitionSfx();
                      setCurrentSceneId(scene.id);
                      setIsThumbnailsOpen(false);
                    }
                  }}
                  className={`group relative flex-shrink-0 w-36 rounded-xl border overflow-hidden text-left transition-all ${
                    isActive
                      ? 'border-sky-400 ring-2 ring-sky-500/50 shadow-lg shadow-sky-500/25'
                      : 'border-slate-700/80 hover:border-slate-500 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="relative h-20 w-full bg-slate-950 overflow-hidden">
                    <img
                      src={`${scene.imageUrl}${scene.imageUrl.includes('?') ? '&' : '?'}t=${scene.updatedAt ? new Date(scene.updatedAt).getTime() : Date.now()}`}
                      alt={scene.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] font-bold text-white">
                      #{idx + 1}
                    </div>
                    {isActive && (
                      <div className="absolute inset-0 bg-sky-500/25 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-slate-900">
                    <div className="text-[11px] font-bold text-white truncate">{scene.title}</div>
                    <div className="text-[9px] text-slate-400 truncate">{scene.category || 'Zona'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= INTERACTIVE RADAR & MINI-MAP DRAWER ================= */}
      {isMapOpen && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[94vw] max-w-4xl bg-slate-900/95 border border-slate-700/90 rounded-3xl p-5 shadow-2xl backdrop-blur-md animate-fadeIn">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: '10s' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Peta Lokasi & Radar Pandang 360°
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {scenes.length} Titik Panorama
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">Pilih ruangan atau zona di bawah untuk berpindah lokasi seketika</p>
              </div>
            </div>
            <button
              onClick={() => setIsMapOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scene Node Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            {scenes.map((scene, idx) => {
              const isActive = scene.id === currentScene.id;
              const hotspotCount = (scene.hotspots || []).length;
              return (
                <div
                  key={scene.id}
                  onClick={() => {
                    if (!isActive) {
                      soundManager.playTransitionSfx();
                      setCurrentSceneId(scene.id);
                      setIsMapOpen(false);
                    }
                  }}
                  className={`cursor-pointer p-3 rounded-2xl border transition-all flex items-center gap-3 relative overflow-hidden group ${
                    isActive
                      ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-500/30 shadow-lg shadow-sky-500/20'
                      : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800'
                  }`}
                >
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-slate-950 border border-slate-700/50">
                    <img
                      src={`${scene.imageUrl}${scene.imageUrl.includes('?') ? '&' : '?'}t=${scene.updatedAt ? new Date(scene.updatedAt).getTime() : Date.now()}`}
                      alt={scene.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    {isActive && (
                      <div className="absolute inset-0 bg-sky-500/40 flex items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-white animate-ping" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold text-sky-400 bg-sky-500/20 px-1.5 py-0.2 rounded">
                        #{idx + 1}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">{scene.category || 'Zona'}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-sky-300 transition-colors">
                      {scene.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{hotspotCount} hotspot</span>
                      {isActive && <span className="text-emerald-400 font-bold">• Posisi Anda</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= WORLD-CLASS BOTTOM CONTROL BAR ================= */}
      {/* Inspired by reference video (indonesiavirtualtour.com) */}
      <footer className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[96vw] max-w-5xl bg-slate-900/90 border border-slate-800/90 rounded-2xl px-4 py-2 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 pointer-events-auto">
        {/* Left Controls: Audio, Auto-Rotate, Tiny Planet */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleAudioToggle}
            className={`p-2 rounded-xl transition-all ${
              isAudioActive
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isAudioActive ? 'Matikan Suara Ambien' : 'Nyalakan Suara Ambien'}
          >
            {isAudioActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsAutoRotateActive(!isAutoRotateActive)}
            className={`p-2 rounded-xl transition-all ${
              isAutoRotateActive
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Putar Otomatis (Auto Rotate)"
          >
            <RotateCw className={`w-4 h-4 ${isAutoRotateActive ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
          </button>

          <button
            onClick={() => setViewerKey((k) => k + 1)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block"
            title="Ulangi Efek Little Planet (Tiny Planet Intro)"
          >
            <Globe className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Current Scene Title Pill with Prev / Next Navigation Chevrons */}
        <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700/80 px-3 py-1.5 rounded-full shadow-inner max-w-[340px] sm:max-w-md w-full justify-between">
          <button
            onClick={handlePrevScene}
            disabled={currentIndex <= 0}
            className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-700/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Foto Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center truncate px-2">
            <span className="text-[10px] text-sky-400 font-bold block uppercase tracking-wider">
              Foto {currentIndex + 1} dari {scenes.length}
            </span>
            <span className="text-xs font-bold text-white truncate block">
              {currentScene.title}
            </span>
          </div>

          <button
            onClick={handleNextScene}
            disabled={currentIndex >= scenes.length - 1}
            className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-700/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Foto Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right Controls: Gallery Thumbnails, Radar Map & Fullscreen */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              setIsMapOpen(!isMapOpen);
              if (isThumbnailsOpen) setIsThumbnailsOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isMapOpen
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800'
            }`}
            title="Buka Peta Lokasi & Radar 360"
          >
            <Compass className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Peta Radar</span>
          </button>

          <button
            onClick={() => {
              setIsThumbnailsOpen(!isThumbnailsOpen);
              if (isMapOpen) setIsMapOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isThumbnailsOpen
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800'
            }`}
            title="Buka Galeri Foto 360"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Galeri</span>
          </button>

          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
              } else {
                document.exitFullscreen?.().catch(() => {});
              }
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Layar Penuh (Fullscreen)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};
