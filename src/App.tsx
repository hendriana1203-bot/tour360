/**
 * App.tsx
 * Tour360 Virtual Tour Main Application Entry
 * Orchestrates Public User View ('/') and Admin Dashboard ('/admin')
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Scene, TourSettings } from './types';
import { INITIAL_SCENES, DEFAULT_SETTINGS, createEquirectangularTexture } from './defaultScenes';
import { PublicTour } from './PublicTour';
import { AdminDashboard } from './AdminDashboard';

export default function App() {
  const [route, setRoute] = useState<string>(() => {
    return window.location.pathname.startsWith('/admin') ? '/admin' : '/';
  });

  const [scenes, setScenes] = useState<Scene[]>(INITIAL_SCENES);
  const [settings, setSettings] = useState<TourSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync with browser navigation history
  useEffect(() => {
    const handlePopState = () => {
      setRoute(window.location.pathname.startsWith('/admin') ? '/admin' : '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (newRoute: string) => {
    window.history.pushState({}, '', newRoute);
    setRoute(newRoute);
  };

  // Prepare and normalize scene panoramas
  const prepareScenes = useCallback((rawScenes: Scene[]): Scene[] => {
    return rawScenes.map((s) => {
      // If image is an uploaded photo or asset URL, preserve it directly
      if (s.imageUrl && (s.imageUrl.startsWith('/uploads') || s.imageUrl.startsWith('/assets') || s.imageUrl.startsWith('/public') || s.imageUrl.startsWith('http') || s.imageUrl.startsWith('data:'))) {
        return s;
      }
      // If image is a procedural preset or empty, generate high-res canvas
      if (!s.imageUrl || s.imageUrl.includes('lobby') || s.imageUrl === '') {
        return {
          ...s,
          imageUrl: createEquirectangularTexture('lobby'),
        };
      } else if (s.imageUrl.includes('courtyard')) {
        return {
          ...s,
          imageUrl: createEquirectangularTexture('courtyard'),
        };
      } else if (s.imageUrl.includes('hall')) {
        return {
          ...s,
          imageUrl: createEquirectangularTexture('hall'),
        };
      }
      return s;
    });
  }, []);

  // Fetch initial data from server with cache-busting
  const loadData = useCallback(async () => {
    try {
      const [scenesRes, settingsRes] = await Promise.allSettled([
        fetch(`/api/scenes?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      if (scenesRes.status === 'fulfilled' && scenesRes.value.ok) {
        const scenesData = await scenesRes.value.json();
        if (Array.isArray(scenesData)) {
          setScenes(prepareScenes(scenesData.length > 0 ? scenesData : []));
        } else {
          setScenes(prepareScenes(INITIAL_SCENES));
        }
      } else {
        setScenes(prepareScenes(INITIAL_SCENES));
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
        const settingsData = await settingsRes.value.json();
        setSettings((prev) => ({ ...prev, ...settingsData }));
      }
    } catch (err) {
      console.warn('API server running with initial presets:', err);
      setScenes(prepareScenes(INITIAL_SCENES));
    } finally {
      setIsLoading(false);
    }
  }, [prepareScenes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading && scenes.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wide text-slate-300">Inisialisasi Tour360...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${route === '/admin' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'} bg-slate-950 font-sans text-slate-100 antialiased`}>
      {route === '/admin' ? (
        <AdminDashboard
          scenes={scenes}
          settings={settings}
          onRefreshData={loadData}
          onNavigateToPublic={() => navigateTo('/')}
        />
      ) : (
        <PublicTour
          scenes={scenes}
          settings={settings}
          onNavigateToAdmin={() => navigateTo('/admin')}
        />
      )}
    </div>
  );
}
