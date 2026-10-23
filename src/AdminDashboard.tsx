/**
 * AdminDashboard.tsx
 * Comprehensive Admin Management Panel (Route '/admin')
 * Features:
 * - Admin Authentication & Route Protection
 * - Scene CRUD with Dynamic 360 Panorama File Upload / Replacement
 * - Visual Hotspot Pinpointer (3D Raycasting Floor Alignment)
 * - Dynamic Logo & Branding Upload Manager
 * - Admin User Management (CRUD Admin accounts)
 * - Local Deployment Guide for D:/tur360
 */

import React, { useState, useEffect, useRef } from 'react';
import { Scene, Hotspot, AdminUser, TourSettings, AuthState } from './types';
import { VisualPinpointModal } from './VisualPinpointModal';
import { soundManager } from './audioManager';
import {
  Layers,
  MapPin,
  Sliders,
  Image,
  Users,
  Settings,
  Plus,
  Trash2,
  Edit,
  Upload,
  Check,
  X,
  Eye,
  LogOut,
  Navigation,
  Info,
  ShieldCheck,
  Sparkles,
  Terminal,
  ExternalLink,
  Lock,
  ArrowRight,
  RefreshCw,
  Download,
  Database,
  AlertTriangle,
} from 'lucide-react';

interface AdminDashboardProps {
  scenes: Scene[];
  settings: TourSettings;
  onRefreshData: () => void;
  onNavigateToPublic: () => void;
}

// Safe single-read error parser to prevent "body stream already read" errors
async function parseResponseError(res: Response, fallback = 'Terjadi kesalahan.'): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object' && data.error) {
        return data.error;
      }
    } catch {
      // not JSON, strip any HTML tags
      const clean = text.replace(/<[^>]+>/g, '').trim();
      return clean.slice(0, 150) || fallback;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  scenes,
  settings,
  onRefreshData,
  onNavigateToPublic,
}) => {
  // Synchronized immutable scenes state
  const [localScenes, setLocalScenes] = useState<Scene[]>(scenes);
  useEffect(() => {
    setLocalScenes(scenes);
  }, [scenes]);

  // Auth state
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('tour360_auth');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return { token: null, user: null };
  });

  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tabs
  type TabType = 'scenes' | 'hotspots' | 'branding' | 'admins' | 'backup' | 'guide';
  const [activeTab, setActiveTab] = useState<TabType>('scenes');

  // Scene modal states
  const [isAddSceneModalOpen, setIsAddSceneModalOpen] = useState(false);
  const [isEditSceneModalOpen, setIsEditSceneModalOpen] = useState(false);
  const [sceneToEdit, setSceneToEdit] = useState<Scene | null>(null);

  // Scene Form state
  const [sceneTitle, setSceneTitle] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const [sceneCategory, setSceneCategory] = useState('Interior Gedung');
  const [sceneIsDefault, setSceneIsDefault] = useState(false);
  const [sceneFile, setSceneFile] = useState<File | null>(null);
  const [editFilePreview, setEditFilePreview] = useState<string>('');
  const [editModalError, setEditModalError] = useState<string>('');
  const [addModalError, setAddModalError] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<'lobby' | 'courtyard' | 'hall'>('lobby');
  const [isSavingScene, setIsSavingScene] = useState(false);
  const [sceneSearchTerm, setSceneSearchTerm] = useState('');

  // Backup & Restore Disaster Recovery states
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreFileInputKey, setRestoreFileInputKey] = useState(0);
  const [restorePreview, setRestorePreview] = useState<{ scenesCount: number; hotspotsCount: number; raw: any } | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // Visual Hotspot Pinpointer Modal states
  const [isPinpointModalOpen, setIsPinpointModalOpen] = useState(false);
  const [activePinpointScene, setActivePinpointScene] = useState<Scene | null>(null);
  const [hotspotToEdit, setHotspotToEdit] = useState<Partial<Hotspot> | null>(null);

  // Branding states
  const [brandingAppName, setBrandingAppName] = useState(settings.appName);
  const [brandingTagline, setBrandingTagline] = useState(settings.tagline);
  const [brandingEmail, setBrandingEmail] = useState(settings.contactEmail || '');
  const [brandingPhone, setBrandingPhone] = useState(settings.contactPhone || '');
  const [brandingLogoFile, setBrandingLogoFile] = useState<File | null>(null);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState(settings.logoUrl);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  // Admin users state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'EDITOR'>('ADMIN');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Selected scene for hotspot tab
  const [selectedHotspotSceneId, setSelectedHotspotSceneId] = useState<string>(scenes[0]?.id || '');

  // File input refs
  const sceneFileInputRef = useRef<HTMLInputElement>(null);
  const brandingLogoInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Sync settings when loaded
  useEffect(() => {
    setBrandingAppName(settings.appName);
    setBrandingTagline(settings.tagline);
    setBrandingEmail(settings.contactEmail || '');
    setBrandingPhone(settings.contactPhone || '');
    setBrandingLogoPreview(settings.logoUrl);
  }, [settings]);

  // Fetch admin users when authenticated
  useEffect(() => {
    if (authState.token) {
      fetch('/api/users')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setAdminUsers(data);
        })
        .catch(() => {});
    }
  }, [authState.token]);

  // LOGIN HANDLER
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login gagal.');
      }

      const newAuth = { token: data.token, user: data.user };
      setAuthState(newAuth);
      localStorage.setItem('tour360_auth', JSON.stringify(newAuth));
      showToast('Berhasil masuk ke Admin Dashboard.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat login.';
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAuthState({ token: null, user: null });
    localStorage.removeItem('tour360_auth');
  };

  // CREATE SCENE HANDLER
  const handleCreateScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneTitle) return;

    setIsSavingScene(true);
    setAddModalError('');
    try {
      const formData = new FormData();
      formData.append('title', sceneTitle);
      formData.append('description', sceneDescription);
      formData.append('category', sceneCategory);
      formData.append('isDefault', String(sceneIsDefault));

      if (sceneFile) {
        formData.append('panoramaFile', sceneFile);
      } else {
        formData.append('presetType', selectedPreset);
      }

      const res = await fetch('/api/scenes', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorMsg = await parseResponseError(res, 'Gagal menyimpan scene baru.');
        throw new Error(errorMsg);
      }

      const createdScene: Scene = await res.json();
      setLocalScenes((prev) => {
        let updated = [...prev, createdScene];
        if (createdScene.isDefault) {
          updated = updated.map((s) => ({ ...s, isDefault: s.id === createdScene.id }));
        }
        return updated;
      });

      showToast('Scene panorama 360 berhasil ditambahkan!');
      setIsAddSceneModalOpen(false);
      resetSceneForm();
      onRefreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setAddModalError(message);
      showToast(message, 'error');
    } finally {
      setIsSavingScene(false);
    }
  };

  // EDIT SCENE & REPLACE 360 PANORAMA FILE HANDLER
  const handleUpdateScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneToEdit) return;

    setIsSavingScene(true);
    setEditModalError('');
    try {
      const formData = new FormData();
      formData.append('title', sceneTitle);
      formData.append('description', sceneDescription);
      formData.append('category', sceneCategory);
      formData.append('isDefault', String(sceneIsDefault));

      if (sceneFile) {
        formData.append('panoramaFile', sceneFile);
      }

      const res = await fetch(`/api/scenes/${sceneToEdit.id}`, {
        method: 'PUT',
        body: formData,
      });

      if (!res.ok) {
        const errorMsg = await parseResponseError(res, 'Gagal memperbarui scene.');
        throw new Error(errorMsg);
      }

      const updatedScene: Scene = await res.json();
      setLocalScenes((prev) => {
        let updated = prev.map((s) => (s.id === updatedScene.id ? updatedScene : s));
        if (updatedScene.isDefault) {
          updated = updated.map((s) => ({ ...s, isDefault: s.id === updatedScene.id }));
        }
        return updated;
      });

      showToast('Scene dan foto panorama 360 berhasil diperbarui!');
      setIsEditSceneModalOpen(false);
      setSceneToEdit(null);
      resetSceneForm();
      onRefreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setEditModalError(message);
      showToast(message, 'error');
    } finally {
      setIsSavingScene(false);
    }
  };

  // DELETE SCENE HANDLER
  const handleDeleteScene = async (id: string, title: string) => {
    if (!window.confirm(`Yakin ingin menghapus scene "${title}" beserta seluruh hotspot di dalamnya?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/scenes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorMsg = await parseResponseError(res, 'Gagal menghapus scene.');
        throw new Error(errorMsg);
      }

      try {
        const resData = await res.json();
        if (resData.scenes && Array.isArray(resData.scenes)) {
          setLocalScenes(resData.scenes);
        } else {
          setLocalScenes((prev) => prev.filter((s) => s.id !== id));
        }
      } catch {
        setLocalScenes((prev) => prev.filter((s) => s.id !== id));
      }

      showToast('Scene berhasil dihapus.');
      onRefreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus scene.';
      showToast(message, 'error');
    }
  };

  const openEditSceneModal = (scene: Scene) => {
    setSceneToEdit(scene);
    setSceneTitle(scene.title);
    setSceneDescription(scene.description || '');
    setSceneCategory(scene.category || 'Interior Gedung');
    setSceneIsDefault(scene.isDefault);
    setSceneFile(null);
    setEditFilePreview('');
    setEditModalError('');
    setIsEditSceneModalOpen(true);
  };

  const resetSceneForm = () => {
    setSceneTitle('');
    setSceneDescription('');
    setSceneCategory('Interior Gedung');
    setSceneIsDefault(false);
    setSceneFile(null);
    setEditFilePreview('');
    setEditModalError('');
    setAddModalError('');
    setSelectedPreset('lobby');
  };

  // SAVE HOTSPOT FROM PINPOINT MODAL
  const handleSaveHotspot = async (hotspotData: Partial<Hotspot>) => {
    if (!activePinpointScene) return;

    try {
      if (hotspotData.id) {
        // Update existing hotspot
        const res = await fetch(`/api/hotspots/${hotspotData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hotspotData),
        });
        if (!res.ok) throw new Error('Gagal memperbarui koordinat hotspot.');
        showToast('Koordinat hotspot berhasil diperbarui!');
      } else {
        // Create new hotspot
        const res = await fetch(`/api/scenes/${activePinpointScene.id}/hotspots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hotspotData),
        });
        if (!res.ok) throw new Error('Gagal menambahkan hotspot.');
        showToast('Hotspot baru berhasil ditancapkan di lantai 360!');
      }

      setIsPinpointModalOpen(false);
      onRefreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      showToast(message, 'error');
    }
  };

  const handleDeleteHotspot = async (id: string) => {
    if (!window.confirm('Hapus hotspot ini?')) return;
    try {
      const res = await fetch(`/api/hotspots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus hotspot.');
      showToast('Hotspot dihapus.');
      onRefreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus hotspot.';
      showToast(message, 'error');
    }
  };

  // BRANDING LOGO & SETTINGS HANDLERS
  const handleUploadBrandingLogo = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('logoFile', file);

      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah logo.');

      setBrandingLogoPreview(data.logoUrl);
      showToast('Logo aplikasi berhasil diperbarui!');
      onRefreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengunggah logo.';
      showToast(message, 'error');
    }
  };

  const handleSaveBrandingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBranding(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: brandingAppName,
          tagline: brandingTagline,
          contactEmail: brandingEmail,
          contactPhone: brandingPhone,
        }),
      });

      if (!res.ok) throw new Error('Gagal menyimpan pengaturan branding.');
      showToast('Pengaturan branding dan identitas tour tersimpan!');
      onRefreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      showToast(message, 'error');
    } finally {
      setIsSavingBranding(false);
    }
  };

  // ADMIN USER CRUD HANDLERS
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAdminUsername,
          name: newAdminName,
          email: newAdminEmail,
          password: newAdminPassword,
          role: newAdminRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan admin.');

      showToast(`Admin ${data.username} berhasil ditambahkan!`);
      setIsAddAdminModalOpen(false);
      setNewAdminUsername('');
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      // Refresh admin list
      fetch('/api/users')
        .then((r) => r.json())
        .then((d) => setAdminUsers(d));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menambahkan admin.';
      showToast(message, 'error');
    }
  };

  const handleDeleteAdmin = async (id: string, username: string) => {
    if (!window.confirm(`Hapus akun admin "${username}"?`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus admin.');

      showToast('Akun admin berhasil dihapus.');
      setAdminUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus admin.';
      showToast(message, 'error');
    }
  };

  // 1-Click Backup Export Handler
  const handleDownloadBackup = async () => {
    setIsExportingBackup(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error('Gagal mengunduh cadangan data.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tour360_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('File backup (JSON) berhasil diunduh ke komputer!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh backup.';
      showToast(msg, 'error');
    } finally {
      setIsExportingBackup(false);
    }
  };

  // Restore file selection & parsing handler
  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError('');
    setRestorePreview(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.scenes) || !Array.isArray(parsed.hotspots)) {
          throw new Error('Format file backup tidak valid. File JSON harus memuat array "scenes" dan "hotspots".');
        }
        setRestorePreview({
          scenesCount: parsed.scenes.length,
          hotspotsCount: parsed.hotspots.length,
          raw: parsed,
        });
        showToast(`File backup valid! Terdeteksi ${parsed.scenes.length} scene.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal membaca file JSON.';
        setRestoreError(msg);
        showToast(msg, 'error');
      }
    };
    reader.readAsText(file);
  };

  // Confirm and execute Restore handler
  const handleExecuteRestore = async () => {
    if (!restorePreview) return;
    if (!window.confirm(`PERINGATAN: Memulihkan ${restorePreview.scenesCount} scene dan ${restorePreview.hotspotsCount} hotspot akan menggantikan daftar data saat ini. Lanjutkan?`)) {
      return;
    }

    setIsRestoringBackup(true);
    setRestoreError('');
    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restorePreview.raw),
      });

      if (!res.ok) {
        const err = await parseResponseError(res, 'Gagal memulihkan data backup.');
        throw new Error(err);
      }

      const result = await res.json();
      showToast(result.message || 'Data berhasil dipulihkan!');
      setRestorePreview(null);
      setRestoreFileInputKey((k) => k + 1);
      onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memulihkan data.';
      setRestoreError(msg);
      showToast(msg, 'error');
    } finally {
      setIsRestoringBackup(false);
    }
  };

  // Factory Reset
  const handleFactoryReset = async () => {
    if (!window.confirm('PERHATIAN: Apakah Anda yakin ingin mereset seluruh data kembali ke pengaturan bawaan pabrik (3 scene default)? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }

    try {
      const res = await fetch('/api/factory-reset', { method: 'POST' });
      if (!res.ok) throw new Error('Gagal mereset data ke pabrik.');
      const result = await res.json();
      showToast(result.message || 'Berhasil direset ke pengaturan bawaan.');
      onRefreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mereset data.';
      showToast(msg, 'error');
    }
  };

  // IF NOT AUTHENTICATED: SHOW LOGIN FORM
  if (!authState.token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Ambient Top Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-sky-500/10 blur-2xl rounded-full" />

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-sky-500/25">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Admin Portal Tour360</h1>
            <p className="text-xs text-slate-400 mt-1">Masuk untuk mengelola scene panorama 360, hotspot, dan branding</p>
          </div>

          {loginError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username / Email</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500 transition-colors"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400">
              <strong className="text-sky-300">Akun Bawaan:</strong> Username: <code className="text-white">admin</code> | Password: <code className="text-white">admin123</code>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm shadow-lg shadow-sky-500/30 transition-all flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Memeriksa...
                </>
              ) : (
                <>
                  Masuk ke Panel Admin <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onNavigateToPublic}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              ← Kembali ke Tampilan Pengunjung (Public Tour)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED ADMIN DASHBOARD VIEW
  const selectedHotspotScene = localScenes.find((s) => s.id === selectedHotspotSceneId) || localScenes[0];

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-auto overflow-x-hidden">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl text-xs font-medium border ${
            notification.type === 'success'
              ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-900 border-rose-500/50 text-rose-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {notification.message}
        </div>
      )}

      {/* ADMIN TOP NAVBAR */}
      <nav className="h-16 bg-slate-900/90 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white/5 p-0.5" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                360
              </div>
            )}
            <div>
              <span className="text-sm font-bold text-white tracking-tight">{settings.appName}</span>
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold uppercase">
                Admin Console
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToPublic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <Eye className="w-4 h-4 text-sky-400" />
            <span>Lihat Public Tour</span>
          </button>

          <div className="h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white">{authState.user?.name || 'Admin'}</div>
              <div className="text-[10px] text-slate-400">{authState.user?.role || 'SUPER_ADMIN'}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
              title="Keluar (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* DASHBOARD TABS NAVIGATION */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('scenes')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'scenes'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Scene & Foto Panorama 360</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">{localScenes.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('hotspots')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'hotspots'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Visual Hotspot Pinpointing</span>
          </button>

          <button
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'branding'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Image className="w-4 h-4" />
            <span>Logo & Branding</span>
          </button>

          <button
            onClick={() => setActiveTab('admins')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'admins'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kelola Admin</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">{adminUsers.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'backup'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Backup & Restore (JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'guide'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Panduan Lokal (D:/tur360)</span>
          </button>
        </div>
      </div>

      {/* MAIN TAB CONTENT */}
      <main className="flex-1 p-6 pb-28 max-w-7xl w-full mx-auto">
        {/* ================= TAB 1: SCENES & PANORAMA MANAGEMENT ================= */}
        {activeTab === 'scenes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Manajemen Scene & Foto 360</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tambah ruangan baru, ganti file foto panorama 360 secara dinamis, dan atur hotspot tujuan.
                </p>
              </div>

              <button
                onClick={() => {
                  resetSceneForm();
                  setIsAddSceneModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Tambah Scene 360 Baru
              </button>
            </div>

            {/* Search & Stats Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  value={sceneSearchTerm}
                  onChange={(e) => setSceneSearchTerm(e.target.value)}
                  placeholder="Cari scene (misal: Foto 1, Gerbang, Kolam)..."
                  className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
                />
                {sceneSearchTerm && (
                  <button
                    onClick={() => setSceneSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-400 self-end sm:self-center">
                Menampilkan <strong className="text-white">{localScenes.filter((s) => s.title.toLowerCase().includes(sceneSearchTerm.toLowerCase()) || (s.description && s.description.toLowerCase().includes(sceneSearchTerm.toLowerCase()))).length}</strong> dari {localScenes.length} scene panorama
              </div>
            </div>

            {/* Scenes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {localScenes
                .filter((scene) =>
                  scene.title.toLowerCase().includes(sceneSearchTerm.toLowerCase()) ||
                  (scene.description && scene.description.toLowerCase().includes(sceneSearchTerm.toLowerCase()))
                )
                .map((scene) => (
                <div
                  key={scene.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col group transition-all"
                >
                  {/* Panorama Thumbnail Preview with cache-busting timestamp */}
                  <div className="relative h-44 bg-slate-950 overflow-hidden">
                    <img
                      src={`${scene.imageUrl}${scene.imageUrl.includes('?') ? '&' : '?'}t=${scene.updatedAt ? new Date(scene.updatedAt).getTime() : Date.now()}`}
                      alt={scene.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      {scene.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold shadow-md">
                          Default (Awal)
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-sky-300 text-[10px] font-semibold">
                        {scene.category || 'Interior'}
                      </span>
                    </div>

                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-xs text-[10px] text-slate-300 font-mono">
                      {scene.hotspots?.length || 0} Hotspot
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm mb-1">{scene.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {scene.description || 'Tidak ada deskripsi.'}
                      </p>
                    </div>

                    {/* Action Toolbar */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      {/* Visual Pinpoint Button */}
                      <button
                        onClick={() => {
                          setActivePinpointScene(scene);
                          setHotspotToEdit(null);
                          setIsPinpointModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-semibold border border-sky-500/30 transition-colors"
                        title="Atur titik navigasi panah lantai"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Visual Pinpoint</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditSceneModal(scene)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                          title="Edit Info & Ganti Foto 360"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteScene(scene.id, scene.title)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
                          title="Hapus Scene"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 2: VISUAL HOTSPOT PINPOINTING ================= */}
        {activeTab === 'hotspots' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Koreksi Hotspot & Navigasi Raycasting</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sesuaikan sudut Pitch & Yaw agar panah navigasi Google Street View menempel presisi di permukaan lantai.
                </p>
              </div>

              {/* Scene Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Pilih Scene:</span>
                <select
                  value={selectedHotspotScene?.id}
                  onChange={(e) => setSelectedHotspotSceneId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-hidden focus:border-sky-500"
                >
                  {localScenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.hotspots?.length || 0} hotspot)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Current Scene Preview Banner */}
            {selectedHotspotScene && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold uppercase">
                        Scene Aktif
                      </span>
                      <h3 className="text-lg font-bold text-white">{selectedHotspotScene.title}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Klik tombol di bawah untuk membuka viewer 3D dan mengklik titik lantai secara visual.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setActivePinpointScene(selectedHotspotScene);
                      setHotspotToEdit(null);
                      setIsPinpointModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all"
                  >
                    <Sliders className="w-4 h-4" /> Buka Visual Hotspot Pinpointer 3D
                  </button>
                </div>

                {/* Hotspot Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3 px-3">Tipe & Simbol</th>
                        <th className="pb-3 px-3">Label Hotspot</th>
                        <th className="pb-3 px-3">Target / Keterangan</th>
                        <th className="pb-3 px-3">Koordinat (Pitch / Yaw)</th>
                        <th className="pb-3 px-3">Mode Lantai (Street View)</th>
                        <th className="pb-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {selectedHotspotScene.hotspots?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                            Belum ada hotspot pada scene ini. Klik "Buka Visual Hotspot Pinpointer 3D" untuk menambahkan panah lantai!
                          </td>
                        </tr>
                      ) : (
                        selectedHotspotScene.hotspots?.map((h) => {
                          const targetScene = localScenes.find((s) => s.id === h.targetSceneId);
                          return (
                            <tr key={h.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-3">
                                {h.type === 'navigation' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-300 font-semibold">
                                    <Navigation className="w-3.5 h-3.5" /> Navigasi
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-semibold">
                                    <Info className="w-3.5 h-3.5" /> Info
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-bold text-white">{h.title}</td>
                              <td className="py-3 px-3 text-slate-300">
                                {h.type === 'navigation' ? (
                                  targetScene ? (
                                    <span className="text-sky-300">→ {targetScene.title}</span>
                                  ) : (
                                    <span className="text-slate-500">-</span>
                                  )
                                ) : (
                                  <span className="truncate max-w-[200px] block text-slate-400">
                                    {h.description || 'Info popup'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-300">
                                <span className="text-sky-300">P: {h.pitch}°</span> |{' '}
                                <span className="text-indigo-300">Y: {h.yaw}°</span>
                              </td>
                              <td className="py-3 px-3">
                                {h.groundPlacement ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                    <Check className="w-3.5 h-3.5" /> Menempel di Lantai
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Melayang (3D Sphere)</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setActivePinpointScene(selectedHotspotScene);
                                      setHotspotToEdit(h);
                                      setIsPinpointModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Edit & Koreksi Posisi"
                                  >
                                    <Sliders className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteHotspot(h.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Hapus Hotspot"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: LOGO & BRANDING ================= */}
        {activeTab === 'branding' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Manajemen Logo & Branding</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Kustomisasi logo utama aplikasi di header dan informasi identitas tur secara dinamis.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Dynamic Logo Upload Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Logo Aplikasi Utama (Header)
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl">
                  {/* Current Logo Preview */}
                  <div className="w-24 h-24 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center p-2 overflow-hidden shadow-inner shrink-0">
                    {brandingLogoPreview ? (
                      <img src={brandingLogoPreview} alt="Brand Logo" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center">
                        <Image className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-500">Belum ada logo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="text-xs font-bold text-white">Unggah Berkas Logo Baru</div>
                    <p className="text-[11px] text-slate-400">
                      Disarankan menggunakan format PNG transparan, WebP, atau SVG (maksimal 10MB).
                    </p>
                    <input
                      type="file"
                      ref={brandingLogoInputRef}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUploadBrandingLogo(file);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => brandingLogoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/40 text-xs font-semibold shadow-md transition-all"
                    >
                      <Upload className="w-4 h-4" /> Pilih File Logo
                    </button>
                  </div>
                </div>
              </div>

              {/* Form Metadata */}
              <form onSubmit={handleSaveBrandingSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Judul Aplikasi / Tour</label>
                  <input
                    type="text"
                    value={brandingAppName}
                    onChange={(e) => setBrandingAppName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                    placeholder="Contoh: Virtual Tour SMAN 14 Garut"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tagline / Slogan</label>
                  <input
                    type="text"
                    value={brandingTagline}
                    onChange={(e) => setBrandingTagline(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                    placeholder="Jelajahi Setiap Sudut dengan Pengalaman 360° Interaktif"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Kontak</label>
                    <input
                      type="email"
                      value={brandingEmail}
                      onChange={(e) => setBrandingEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                      placeholder="info@sekolah.sch.id"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">No. Telepon / WhatsApp</label>
                    <input
                      type="text"
                      value={brandingPhone}
                      onChange={(e) => setBrandingPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                      placeholder="+62 812-xxxx-xxxx"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingBranding}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-lg shadow-sky-500/25 transition-all"
                  >
                    <Check className="w-4 h-4" />
                    {isSavingBranding ? 'Menyimpan...' : 'Simpan Pengaturan Branding'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= TAB 4: ADMIN USER MANAGEMENT ================= */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Manajemen Admin Pengelola (CRUD)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tambah, perbarui, atau hapus akun pengguna yang berwenang mengedit virtual tour.
                </p>
              </div>

              <button
                onClick={() => setIsAddAdminModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Tambah Admin Baru
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider bg-slate-900/80">
                      <th className="py-3.5 px-4">Nama Lengkap</th>
                      <th className="py-3.5 px-4">Username</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">Hak Akses (Role)</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {adminUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-linear-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                            {u.name.charAt(0)}
                          </div>
                          {u.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-mono">{u.username}</td>
                        <td className="py-3.5 px-4 text-slate-300">{u.email}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              u.role === 'SUPER_ADMIN'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Aktif
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteAdmin(u.id, u.username)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Hapus Akun Admin"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: BACKUP & DISASTER RECOVERY ================= */}
        {activeTab === 'backup' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <Database className="w-6 h-6 text-emerald-400" />
                Pencadangan & Pemulihan Data (Disaster Recovery)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ekspor seluruh konfigurasi scene, relasi hotspot, dan pengaturan ke file JSON mandiri untuk backup lokal atau dipindahkan ke komputer lain (D:/tur360).
              </p>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">Total Scene Aktif</span>
                <span className="text-2xl font-black text-white mt-1 block">{localScenes.length} Scene</span>
                <span className="text-[11px] text-emerald-400 mt-0.5 block">Tersimpan dalam database lokal</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">Total Hotspot 360</span>
                <span className="text-2xl font-black text-sky-400 mt-1 block">
                  {localScenes.reduce((acc, s) => acc + (s.hotspots?.length || 0), 0)} Titik
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Navigasi & Informasi</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">Format File Cadangan</span>
                <span className="text-2xl font-black text-indigo-400 mt-1 block">JSON Portabel</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Kompatibel Windows/Linux/Mac</span>
              </div>
            </div>

            {/* Section 1: Export Backup */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="max-w-xl">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-sky-400" /> Unduh Cadangan Lengkap (1-Click Backup)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Mengunduh seluruh metadata scene (Scene 1 s.d. {localScenes.length}), koordinat Pitch & Yaw setiap Hotspot, judul, deskripsi, dan konfigurasi branding ke dalam satu file JSON terstruktur.
                  </p>
                </div>
                <button
                  onClick={handleDownloadBackup}
                  disabled={isExportingBackup}
                  className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {isExportingBackup ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Menyiapkan...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> Download Backup JSON
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Section 2: Restore from Backup */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-400" /> Pulihkan Data dari File Cadangan (Restore JSON)
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Pilih file backup (.json) yang pernah Anda unduh sebelumnya untuk memulihkan seluruh data scene dan hotspot. Server secara otomatis membuat snapshot darurat sebelum proses penimpaan dilakukan.
                </p>
              </div>

              {restoreError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              {/* File Input */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  key={restoreFileInputKey}
                  type="file"
                  ref={restoreFileInputRef}
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleRestoreFileSelected}
                />
                <button
                  type="button"
                  onClick={() => restoreFileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-emerald-400" /> Pilih File JSON Cadangan
                </button>
                <span className="text-xs text-slate-400">
                  {restorePreview
                    ? `Terpilih: File valid (${restorePreview.scenesCount} scene & ${restorePreview.hotspotsCount} hotspot)`
                    : 'Belum ada file dipilih'}
                </span>
              </div>

              {/* Preview Box */}
              {restorePreview && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> File Backup Siap Dipulihkan
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Versi {restorePreview.raw.version || 1} • {restorePreview.raw.appName || 'Tour360'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    File ini memuat <strong>{restorePreview.scenesCount} scene</strong> dan <strong>{restorePreview.hotspotsCount} hotspot</strong>. Jika Anda melanjutkan, data yang ada saat ini akan diganti dengan data ini.
                  </p>
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isRestoringBackup}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isRestoringBackup ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Memulihkan...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> Konfirmasi & Pulihkan Sekarang
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Section 3: Factory Reset / Danger Zone */}
            <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-900/50 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" /> Zona Bahaya: Reset ke Pengaturan Awal Pabrik
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fitur ini akan mengembalikan susunan scene ke 3 contoh panorama standar bawaan (Lobi Utama, Taman Plaza, Executive Lounge). Akun login admin Anda akan tetap tersimpan dan tidak terhapus.
              </p>
              <button
                onClick={handleFactoryReset}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors"
              >
                Reset Data ke Default Pabrik
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 6: LOCAL DEPLOYMENT GUIDE (D:/tur360) ================= */}
        {activeTab === 'guide' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Panduan Eksekusi di Komputer Lokal (D:/tur360)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Langkah-langkah lengkap untuk menyalin dan menjalankan proyek ini di direktori lokal komputer Anda.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-sm text-slate-300">
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-start gap-3">
                <Terminal className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <strong className="text-white">Direktori Target:</strong> <code className="text-sky-300">D:/tur360</code>
                  <p className="text-slate-400">
                    Seluruh struktur file telah dibuat teratur, menggunakan folder <code className="text-white">uploads/</code> dan <code className="text-white">storage/</code> untuk aset gambar, serta skema <code className="text-white">prisma/schema.prisma</code> untuk database SQLite.
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs">1</span>
                  Instalasi Dependensi (Terminal)
                </div>
                <div className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-sky-300 border border-slate-800">
                  cd D:/tur360<br />
                  npm install
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs">2</span>
                  Inisialisasi Database SQLite & Prisma
                </div>
                <div className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-sky-300 border border-slate-800">
                  npx prisma generate<br />
                  npx prisma db push
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs">3</span>
                  Menjalankan Aplikasi (Mode Development)
                </div>
                <div className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-sky-300 border border-slate-800">
                  npm run dev
                </div>
                <p className="text-xs text-slate-400">
                  Buka browser di alamat: <code className="text-white">http://localhost:3000</code> untuk tampilan publik atau <code className="text-white">http://localhost:3000/admin</code> untuk panel admin.
                </p>
              </div>

              {/* Step 4 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs">4</span>
                  Build Produksi & Deployment Mandiri
                </div>
                <div className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-sky-300 border border-slate-800">
                  npm run build<br />
                  npm start
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL: ADD NEW SCENE ================= */}
      {isAddSceneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" /> Tambah Scene 360 Baru
              </h3>
              <button
                onClick={() => setIsAddSceneModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addModalError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                <div className="flex-1 leading-relaxed">
                  <strong className="font-bold">Gagal Menyimpan:</strong> {addModalError}
                </div>
              </div>
            )}

            <form onSubmit={handleCreateScene} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Judul Ruangan / Scene *</label>
                <input
                  type="text"
                  required
                  value={sceneTitle}
                  onChange={(e) => setSceneTitle(e.target.value)}
                  placeholder="Contoh: Perpustakaan Digital"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Kategori Zona</label>
                <input
                  type="text"
                  value={sceneCategory}
                  onChange={(e) => setSceneCategory(e.target.value)}
                  placeholder="Contoh: Gedung Akademik"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  placeholder="Keterangan fasilitas dan fungsi ruangan ini..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              {/* Upload 360 Photo or Preset */}
              <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-white">Sumber Foto Panorama 360 (Equirectangular)</label>
                
                <div>
                  <input
                    type="file"
                    ref={sceneFileInputRef}
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 100 * 1024 * 1024) {
                          const err = `Ukuran file "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) melebihi batas 100MB.`;
                          setAddModalError(err);
                          showToast(err, 'error');
                          setSceneFile(null);
                          return;
                        }
                        setAddModalError('');
                        setSceneFile(file);
                      }
                    }}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => sceneFileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40 text-xs font-semibold hover:bg-sky-500/30 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 inline mr-1.5" />
                      {sceneFile ? 'Ganti File Foto' : 'Unggah File Foto 360'}
                    </button>
                    <span className="text-xs text-slate-300 truncate max-w-[200px]">
                      {sceneFile ? `${sceneFile.name} (${(sceneFile.size / 1024 / 1024).toFixed(1)}MB)` : 'Atau gunakan preset bawaan:'}
                    </span>
                  </div>
                </div>

                {!sceneFile && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { key: 'lobby', label: 'Grand Lobby' },
                      { key: 'courtyard', label: 'Taman Plaza' },
                      { key: 'hall', label: 'Skyline Suite' },
                    ].map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelectedPreset(p.key as 'lobby' | 'courtyard' | 'hall')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all ${
                          selectedPreset === p.key
                            ? 'bg-sky-500/20 border-sky-500 text-white'
                            : 'border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultCheck"
                  checked={sceneIsDefault}
                  onChange={(e) => setSceneIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 rounded"
                />
                <label htmlFor="defaultCheck" className="text-xs text-slate-300 cursor-pointer">
                  Jadikan scene awal pertama saat tour dibuka (Default Scene)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddSceneModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingScene}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSavingScene ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    'Simpan Scene'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT SCENE & REPLACE PANORAMA ================= */}
      {isEditSceneModalOpen && sceneToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-sky-400" /> Edit Scene & Ganti Foto 360
              </h3>
              <button
                onClick={() => setIsEditSceneModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editModalError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                <div className="flex-1 leading-relaxed">
                  <strong className="font-bold">Gagal Menyimpan:</strong> {editModalError}
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateScene} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Judul Ruangan</label>
                <input
                  type="text"
                  required
                  value={sceneTitle}
                  onChange={(e) => setSceneTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Kategori Zona</label>
                <input
                  type="text"
                  value={sceneCategory}
                  onChange={(e) => setSceneCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              {/* Ganti File Foto Panorama 360 */}
              <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-white">Ganti Berkas Foto Panorama 360</label>
                <div className="text-[11px] text-slate-400">
                  Foto saat ini: <code className="text-sky-300">{sceneToEdit.imageUrl}</code>
                </div>

                <input
                  type="file"
                  id="replaceFileInput"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 100 * 1024 * 1024) {
                        const errorMsg = `Ukuran file "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) melebihi batas maksimal 100MB.`;
                        setEditModalError(errorMsg);
                        showToast(errorMsg, 'error');
                        setSceneFile(null);
                        setEditFilePreview('');
                        return;
                      }
                      setEditModalError('');
                      setSceneFile(file);
                      try {
                        const url = URL.createObjectURL(file);
                        setEditFilePreview(url);
                      } catch {
                        // ignore
                      }
                    }
                  }}
                />

                <div className="flex items-center gap-3 pt-2">
                  <label
                    htmlFor="replaceFileInput"
                    className="cursor-pointer px-4 py-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40 text-xs font-semibold hover:bg-sky-500/30 transition-colors flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Pilih Foto 360 Baru
                  </label>
                  <span className="text-xs text-emerald-400 font-medium truncate max-w-[200px]">
                    {sceneFile ? `File baru: ${sceneFile.name} (${(sceneFile.size / 1024 / 1024).toFixed(1)}MB)` : '(Tidak ada file baru dipilih)'}
                  </span>
                </div>

                {/* Selected File Preview */}
                {editFilePreview && (
                  <div className="mt-3 relative h-28 w-full rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950">
                    <img src={editFilePreview} alt="Preview Foto Baru" className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Foto siap diunggah & disimpan
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editDefaultCheck"
                  checked={sceneIsDefault}
                  onChange={(e) => setSceneIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 rounded"
                />
                <label htmlFor="editDefaultCheck" className="text-xs text-slate-300 cursor-pointer">
                  Jadikan scene awal pertama saat tour dibuka (Default Scene)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditSceneModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingScene}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSavingScene ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    'Perbarui Scene'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD NEW ADMIN USER ================= */}
      {isAddAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" /> Tambah Akun Admin Pengelola
              </h3>
              <button
                onClick={() => setIsAddAdminModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Misal: Ahmad Fauzi"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  placeholder="fauzi360"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="fauzi@sekolah.sch.id"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tingkat Hak Akses (Role)</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-hidden focus:border-sky-500"
                >
                  <option value="ADMIN">ADMIN (Kelola Scene, Hotspot, & Branding)</option>
                  <option value="SUPER_ADMIN">SUPER ADMIN (Semua Akses & Kelola User)</option>
                  <option value="EDITOR">EDITOR (Kelola Konten Hotspot)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddAdminModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shadow-md transition-all"
                >
                  Buat Akun Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= INTERACTIVE VISUAL HOTSPOT PINPOINTER MODAL ================= */}
      {isPinpointModalOpen && activePinpointScene && (
        <VisualPinpointModal
          scene={activePinpointScene}
          scenes={scenes}
          initialHotspot={hotspotToEdit}
          onSave={handleSaveHotspot}
          onClose={() => {
            setIsPinpointModalOpen(false);
            setHotspotToEdit(null);
          }}
        />
      )}
    </div>
  );
};
