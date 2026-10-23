/**
 * VisualPinpointModal.tsx
 * Interactive 3D Visual Pinpointing Tool for Admin
 * Allows admins to click directly on the 360 scene floor or walls
 * to precisely place and align Street View ground chevrons or info pins.
 */

import React, { useState } from 'react';
import { Scene, Hotspot } from './types';
import { PanoramaViewer } from './PanoramaViewer';
import { X, Check, Navigation, Info, Sliders, MapPin, Sparkles, AlertCircle } from 'lucide-react';

interface VisualPinpointModalProps {
  scene: Scene;
  scenes: Scene[];
  initialHotspot?: Partial<Hotspot> | null;
  onSave: (hotspotData: Partial<Hotspot>) => void;
  onClose: () => void;
}

export const VisualPinpointModal: React.FC<VisualPinpointModalProps> = ({
  scene,
  scenes,
  initialHotspot,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState<string>(initialHotspot?.title || 'Arah Menuju Ruangan');
  const [type, setType] = useState<'navigation' | 'info'>(initialHotspot?.type || 'navigation');
  const [targetSceneId, setTargetSceneId] = useState<string>(
    initialHotspot?.targetSceneId || (scenes.find((s) => s.id !== scene.id)?.id || '')
  );
  const [pitch, setPitch] = useState<number>(initialHotspot?.pitch ?? -35);
  const [yaw, setYaw] = useState<number>(initialHotspot?.yaw ?? 0);
  const [groundPlacement, setGroundPlacement] = useState<boolean>(initialHotspot?.groundPlacement ?? true);
  const [icon, setIcon] = useState<'arrow' | 'info' | 'star' | 'door'>(
    (initialHotspot?.icon as 'arrow' | 'info' | 'star' | 'door') || 'arrow'
  );
  const [description, setDescription] = useState<string>(initialHotspot?.description || '');

  // Handle click on the 360 sphere
  const handleSceneClick = (coords: { pitch: number; yaw: number }) => {
    setPitch(coords.pitch);
    setYaw(coords.yaw);
  };

  const handleSave = () => {
    onSave({
      id: initialHotspot?.id,
      sceneId: scene.id,
      title,
      type,
      targetSceneId: type === 'navigation' ? targetSceneId : undefined,
      pitch,
      yaw,
      groundPlacement,
      icon,
      description: type === 'info' ? description : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6">
      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Visual Hotspot Pinpointing
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-normal">
                  {scene.title}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Klik langsung di atas permukaan lantai atau jalur untuk menancapkan ikon panah navigasi secara presisi.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area: Split 3D Viewport & Control Panel */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Interactive 360 Raycasting Viewport */}
          <div className="flex-1 relative bg-slate-950 min-h-[350px]">
            <PanoramaViewer
              imageUrl={scene.imageUrl}
              initialPitch={pitch}
              initialYaw={yaw}
              hotspots={scene.hotspots || []}
              isPinpointMode={true}
              pinpointHotspotDraft={{
                title,
                type,
                pitch,
                yaw,
                groundPlacement,
                icon,
              }}
              onSceneClickForPinpoint={handleSceneClick}
              showControls={true}
            />

            {/* Quick Helper Badge */}
            <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-xs text-slate-300 shadow-xl">
                <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Tip: Klik lantai di jalur jalan untuk membuat panah Street View menempel rapi.</span>
              </div>
            </div>
          </div>

          {/* Right: Fine-Tuning Coordinates & Metadata Panel */}
          <div className="w-full lg:w-96 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Tipe Hotspot
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('navigation');
                      setGroundPlacement(true);
                      setIcon('arrow');
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      type === 'navigation'
                        ? 'bg-sky-500/20 border-sky-500 text-white shadow-sm'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Navigation className="w-4 h-4 text-sky-400" />
                    Navigasi Scene
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('info');
                      setGroundPlacement(false);
                      setIcon('info');
                    }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      type === 'info'
                        ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Info className="w-4 h-4 text-amber-400" />
                    Informasi / Detail
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Label Hotspot
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Menuju Taman Belakang"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              {/* Navigation Target Scene */}
              {type === 'navigation' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Target Scene Tujuan
                  </label>
                  <select
                    value={targetSceneId}
                    onChange={(e) => setTargetSceneId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                  >
                    {scenes
                      .filter((s) => s.id !== scene.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Info Description */}
              {type === 'info' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Deskripsi Info Popup
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tuliskan keterangan detail mengenai objek atau spot ini..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              )}

              {/* Ground Placement Toggle (Google Street View Floor Alignment) */}
              <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Google Street View Floor Mode
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Ratakan ikon horizontal menempel di lantai
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={groundPlacement}
                    onChange={(e) => setGroundPlacement(e.target.checked)}
                    className="w-4 h-4 accent-sky-500 rounded"
                  />
                </div>
              </div>

              {/* Fine-Tuning Coordinates Sliders */}
              <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Presisi Koordinat 3D</span>
                  <span className="text-sky-400 font-mono">
                    Pitch: {pitch}° | Yaw: {yaw}°
                  </span>
                </div>

                {/* Pitch Slider & Nudge Buttons */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Pitch (Vertikal/Lantai)</span>
                    <div className="flex items-center gap-1 font-mono">
                      <button
                        type="button"
                        onClick={() => setPitch((p) => Math.max(-85, Math.round((p - 0.5) * 10) / 10))}
                        className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200"
                      >
                        -0.5°
                      </button>
                      <span className="font-bold text-sky-300 px-1">{pitch}°</span>
                      <button
                        type="button"
                        onClick={() => setPitch((p) => Math.min(85, Math.round((p + 0.5) * 10) / 10))}
                        className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200"
                      >
                        +0.5°
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-85"
                    max="85"
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                    <span>-85° (Lantai Penuh)</span>
                    <span>0° (Horizon)</span>
                    <span>+85° (Langit-langit)</span>
                  </div>
                </div>

                {/* Yaw Slider & Nudge Buttons */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Yaw (Horizontal 360°)</span>
                    <div className="flex items-center gap-1 font-mono">
                      <button
                        type="button"
                        onClick={() => setYaw((y) => Math.max(-180, Math.round((y - 1) * 10) / 10))}
                        className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200"
                      >
                        -1°
                      </button>
                      <span className="font-bold text-sky-300 px-1">{yaw}°</span>
                      <button
                        type="button"
                        onClick={() => setYaw((y) => Math.min(180, Math.round((y + 1) * 10) / 10))}
                        className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200"
                      >
                        +1°
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="0.1"
                    value={yaw}
                    onChange={(e) => setYaw(parseFloat(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                    <span>-180°</span>
                    <span>0°</span>
                    <span>+180°</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25 transition-all"
              >
                <Check className="w-4 h-4" />
                Simpan Posisi Hotspot
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
