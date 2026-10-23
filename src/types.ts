// TypeScript definitions for Tour360 Virtual Tour

export type HotspotType = 'navigation' | 'info';
export type HotspotIcon = 'arrow' | 'info' | 'door' | 'eye' | 'star' | 'circle';

export interface Hotspot {
  id: string;
  sceneId: string;
  title: string;
  type: HotspotType;
  targetSceneId?: string; // Target scene ID for navigation
  pitch: number;          // Vertical angle (-90 to +90 degrees)
  yaw: number;            // Horizontal angle (-180 to +180 degrees)
  groundPlacement: boolean; // True = Google Street View floor chevron/disc
  groundElevation?: number; // e.g. -35deg
  description?: string;
  imageUrl?: string;
  icon?: HotspotIcon;
  createdAt?: string;
  updatedAt?: string;
}

export interface Scene {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  isDefault: boolean;
  initialPitch: number;
  initialYaw: number;
  category?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  hotspots?: Hotspot[];
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';
  isActive: boolean;
  createdAt: string;
}

export interface TourSettings {
  appName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  enableAmbientAudio: boolean;
  enableAutoRotate: boolean;
  autoRotateSpeed: number;
  enableCompass: boolean;
  enableZoomControls: boolean;
  contactEmail?: string;
  contactPhone?: string;
  footerNote?: string;
}

export interface AuthState {
  token: string | null;
  user: AdminUser | null;
}
