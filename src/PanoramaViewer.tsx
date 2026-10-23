/**
 * PanoramaViewer.tsx
 * World-Class 360° Equirectangular Three.js Engine
 * Inspired by professional virtual tour systems (indonesiavirtualtour.com / Panotour / 3DVista)
 * Features:
 * - "Little Planet" (Tiny Planet) stereographic intro zoom-in animation
 * - Smooth forward fly-through camera transition when navigating between scenes
 * - Exact mathematical Pitch & Yaw raycasting without coordinate drift
 * - Professional animated pulsing target hotspot markers matching red circles
 * - DeviceOrientation / Gyroscope mobile support
 * - Stereoscopic VR split-screen mode
 * - Orientation radar compass & zoom controls
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Hotspot } from './types';
import { Compass, Navigation, Info, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, Sparkles, MapPin, Globe, Glasses, Smartphone } from 'lucide-react';
import { soundManager } from './audioManager';
import { createEquirectangularTexture } from './defaultScenes';

export interface PanoramaViewerProps {
  imageUrl: string;
  initialPitch?: number;
  initialYaw?: number;
  hotspots?: Hotspot[];
  onHotspotClick?: (hotspot: Hotspot) => void;
  onSceneClickForPinpoint?: (coords: { pitch: number; yaw: number }) => void;
  isPinpointMode?: boolean;
  pinpointHotspotDraft?: Partial<Hotspot> | null;
  autoRotate?: boolean;
  onAutoRotateChange?: (active: boolean) => void;
  stopAutoRotateOnInteraction?: boolean;
  autoRotateSpeed?: number;
  showControls?: boolean;
  className?: string;
  enableLittlePlanetIntro?: boolean;
  currentSceneTitle?: string;
  onPrevScene?: () => void;
  onNextScene?: () => void;
  hasPrevScene?: boolean;
  hasNextScene?: boolean;
}

interface ProjectedHotspot {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  scale: number;
  groundTilt: number;
  hotspot: Hotspot;
}

// Convert spherical Pitch & Yaw to 3D Cartesian coordinates
export function pitchYawToVector3(pitch: number, yaw: number, radius = 500): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - pitch);
  const theta = THREE.MathUtils.degToRad(yaw);

  const x = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.cos(theta);

  return new THREE.Vector3(x, y, z);
}

// Convert 3D intersection point on the sphere back to Pitch & Yaw angles
export function vector3ToPitchYaw(point: THREE.Vector3): { pitch: number; yaw: number } {
  const len = point.length();
  if (len === 0) return { pitch: 0, yaw: 0 };

  const clampedY = Math.max(-1, Math.min(1, point.y / len));
  const pitch = THREE.MathUtils.radToDeg(Math.asin(clampedY));

  let yaw = THREE.MathUtils.radToDeg(Math.atan2(point.x, point.z));
  while (yaw > 180) yaw -= 360;
  while (yaw < -180) yaw += 360;

  return {
    pitch: Math.round(pitch * 10) / 10,
    yaw: Math.round(yaw * 10) / 10,
  };
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  imageUrl,
  initialPitch = 0,
  initialYaw = 0,
  hotspots = [],
  onHotspotClick,
  onSceneClickForPinpoint,
  isPinpointMode = false,
  pinpointHotspotDraft = null,
  autoRotate: defaultAutoRotate = true,
  onAutoRotateChange,
  stopAutoRotateOnInteraction = true,
  autoRotateSpeed = 0.08,
  showControls = true,
  className = '',
  enableLittlePlanetIntro = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereMeshRef = useRef<THREE.Mesh | null>(null);
  const fadeSphereMeshRef = useRef<THREE.Mesh | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader>(new THREE.TextureLoader());
  const textureRef = useRef<THREE.Texture | null>(null);
  const nextLoadedTextureRef = useRef<THREE.Texture | null>(null);
  const isFadingRef = useRef<boolean>(false);
  const fadeProgressRef = useRef<number>(1);
  const isInitialLoadRef = useRef<boolean>(true);

  // Camera 3D physical position & fly-through dolly translation
  const camPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const targetCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Camera angles & FOV
  const pitchRef = useRef<number>(enableLittlePlanetIntro ? -85 : initialPitch);
  const yawRef = useRef<number>(initialYaw);
  const targetPitchRef = useRef<number>(enableLittlePlanetIntro ? -85 : initialPitch);
  const targetYawRef = useRef<number>(initialYaw);
  const fovRef = useRef<number>(enableLittlePlanetIntro ? 135 : 75);
  const targetFovRef = useRef<number>(enableLittlePlanetIntro ? 135 : 75);

  // States
  const [currentYaw, setCurrentYaw] = useState<number>(initialYaw);
  const [currentPitch, setCurrentPitch] = useState<number>(initialPitch);
  const [projectedHotspots, setProjectedHotspots] = useState<ProjectedHotspot[]>([]);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(defaultAutoRotate);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hoveredCoords, setHoveredCoords] = useState<{ pitch: number; yaw: number } | null>(null);
  const [isLoadingTexture, setIsLoadingTexture] = useState<boolean>(true);
  const [isLittlePlanetActive, setIsLittlePlanetActive] = useState<boolean>(enableLittlePlanetIntro);
  const [isVrStereoMode, setIsVrStereoMode] = useState<boolean>(false);
  const [isGyroActive, setIsGyroActive] = useState<boolean>(false);
  const [transitioningHotspotId, setTransitioningHotspotId] = useState<string | null>(null);

  // Auto-rotate and interaction tracking via mutable refs to prevent stale closure in 60fps animate loop
  const isAutoRotatingRef = useRef<boolean>(defaultAutoRotate);
  const autoRotateSpeedRef = useRef<number>(autoRotateSpeed);
  const stopAutoRotateOnInteractionRef = useRef<boolean>(stopAutoRotateOnInteraction);
  const isLittlePlanetActiveRef = useRef<boolean>(enableLittlePlanetIntro);

  useEffect(() => {
    autoRotateSpeedRef.current = autoRotateSpeed;
  }, [autoRotateSpeed]);

  useEffect(() => {
    stopAutoRotateOnInteractionRef.current = stopAutoRotateOnInteraction;
  }, [stopAutoRotateOnInteraction]);

  useEffect(() => {
    setIsAutoRotating(defaultAutoRotate);
    isAutoRotatingRef.current = defaultAutoRotate;
  }, [defaultAutoRotate]);

  // Keep hotspots and pinpoint drafts in refs so the 60fps requestAnimationFrame loop ALWAYS has fresh data
  const hotspotsRef = useRef<Hotspot[]>(hotspots);
  useEffect(() => {
    hotspotsRef.current = hotspots;
  }, [hotspots]);

  const pinpointDraftRef = useRef(pinpointHotspotDraft);
  useEffect(() => {
    pinpointDraftRef.current = pinpointHotspotDraft;
  }, [pinpointHotspotDraft]);

  // Interaction tracking
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistanceRef = useRef<number>(0);
  const pinchStartDistRef = useRef<number | null>(null);
  const gyroOrientationRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);

  // Perform "Little Planet" to normal view zoom on initial mount
  useEffect(() => {
    if (enableLittlePlanetIntro) {
      setIsLittlePlanetActive(true);
      isLittlePlanetActiveRef.current = true;
      targetPitchRef.current = -85;
      targetFovRef.current = 135;

      const timer = setTimeout(() => {
        targetPitchRef.current = initialPitch;
        targetYawRef.current = initialYaw;
        targetFovRef.current = 75;
        setTimeout(() => {
          setIsLittlePlanetActive(false);
          isLittlePlanetActiveRef.current = false;
        }, 2600);
      }, 700);

      return () => clearTimeout(timer);
    } else {
      targetPitchRef.current = initialPitch;
      targetYawRef.current = initialYaw;
      targetFovRef.current = 75;
      isLittlePlanetActiveRef.current = false;
    }
  }, [enableLittlePlanetIntro, initialPitch, initialYaw]);

  // When initialPitch or initialYaw change on scene switch (or imageUrl changes)
  useEffect(() => {
    if (!isLittlePlanetActiveRef.current) {
      targetPitchRef.current = initialPitch;
      targetYawRef.current = initialYaw;
    }
  }, [imageUrl, initialPitch, initialYaw]);

  // Trigger Little Planet effect on-demand
  const triggerLittlePlanet = () => {
    setIsLittlePlanetActive(true);
    isLittlePlanetActiveRef.current = true;
    targetPitchRef.current = -85;
    targetFovRef.current = 135;

    setTimeout(() => {
      targetPitchRef.current = initialPitch;
      targetYawRef.current = initialYaw;
      targetFovRef.current = 75;
      setTimeout(() => {
        setIsLittlePlanetActive(false);
        isLittlePlanetActiveRef.current = false;
      }, 2400);
    }, 1800);
  };

  // Full memory texture preloader with cinematic crossfade support
  const loadTexture = useCallback((url: string) => {
    if (!url) {
      setIsLoadingTexture(false);
      return;
    }

    // Only show full loading overlay on the very first scene mount; for subsequent navigations, keep canvas active and perform a smooth cinematic cross-fade!
    if (isInitialLoadRef.current) {
      setIsLoadingTexture(true);
    }

    // Apply cache-busting to ensure latest updated image is loaded without browser cache stale
    const cacheBustedUrl = url.startsWith('data:') || url.startsWith('blob:')
      ? url
      : `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;

    // Preload image completely in memory before applying to Three.js texture
    const preloader = new Image();
    preloader.crossOrigin = 'anonymous';

    // Watchdog timer: safety timeout so UI never hangs permanently
    const watchdogTimer = setTimeout(() => {
      console.warn('Panorama texture preloading timed out (7s), unlocking viewer UI:', url);
      setIsLoadingTexture(false);
    }, 7000);

    preloader.onload = () => {
      clearTimeout(watchdogTimer);
      try {
        const loadedTexture = new THREE.Texture(preloader);
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.generateMipmaps = false;
        loadedTexture.needsUpdate = true;

        if (isInitialLoadRef.current || !textureRef.current || !fadeSphereMeshRef.current) {
          // Initial first texture load: direct assign to main sphere
          if (textureRef.current) {
            textureRef.current.dispose();
          }
          textureRef.current = loadedTexture;

          if (sphereMeshRef.current) {
            const mat = sphereMeshRef.current.material as THREE.MeshBasicMaterial;
            mat.map = loadedTexture;
            mat.needsUpdate = true;
          }
          isInitialLoadRef.current = false;
          setIsLoadingTexture(false);
        } else {
          // Seamless cinematic crossfade: load onto fade sphere and dissolve smoothly
          if (nextLoadedTextureRef.current) {
            nextLoadedTextureRef.current.dispose();
          }
          nextLoadedTextureRef.current = loadedTexture;

          if (fadeSphereMeshRef.current) {
            const fadeMat = fadeSphereMeshRef.current.material as THREE.MeshBasicMaterial;
            fadeMat.map = loadedTexture;
            fadeMat.opacity = 0;
            fadeMat.needsUpdate = true;
            fadeSphereMeshRef.current.visible = true;
          }

          fadeProgressRef.current = 0;
          isFadingRef.current = true;
          setIsLoadingTexture(false);
        }
      } catch (err) {
        console.error('Error applying preloaded texture to Three.js:', err);
        setIsLoadingTexture(false);
      }
    };

    preloader.onerror = (error) => {
      clearTimeout(watchdogTimer);
      console.error('Error preloading panorama image, using procedural fallback:', error, url);
      try {
        const fallbackDataUrl = createEquirectangularTexture('lobby');
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          const fallbackTex = new THREE.Texture(fallbackImg);
          fallbackTex.colorSpace = THREE.SRGBColorSpace;
          fallbackTex.needsUpdate = true;
          if (sphereMeshRef.current) {
            const mat = sphereMeshRef.current.material as THREE.MeshBasicMaterial;
            mat.map = fallbackTex;
            mat.needsUpdate = true;
          }
          setIsLoadingTexture(false);
        };
        fallbackImg.src = fallbackDataUrl;
      } catch (e) {
        console.error('Failed to apply fallback texture:', e);
        setIsLoadingTexture(false);
      }
    };

    preloader.src = cacheBustedUrl;
  }, []);

  // Texture loading effect when imageUrl changes and sphereMesh is already mounted
  useEffect(() => {
    if (sphereMeshRef.current && imageUrl) {
      loadTexture(imageUrl);
    }
  }, [imageUrl, loadTexture]);

  // Gyroscope / DeviceOrientation sensor listener
  useEffect(() => {
    if (!isGyroActive) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
        // Map beta to pitch and alpha to yaw
        targetPitchRef.current = Math.max(-85, Math.min(85, (e.beta - 90)));
        targetYawRef.current = -e.alpha;
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isGyroActive]);

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    const canvasMount = canvasMountRef.current;
    if (!container || !canvasMount) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(fovRef.current, width / height, 1, 1200);
    cameraRef.current = camera;

    // 2. Primary Inverted Sphere for 360 Panorama
    const sphereGeometry = new THREE.SphereGeometry(500, 60, 40);
    sphereGeometry.scale(-1, 1, 1);

    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.FrontSide,
    });
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphereMesh);
    sphereMeshRef.current = sphereMesh;

    // 2b. Secondary Inverted Sphere for Cinematic Cross-Fade Dissolve
    const fadeGeometry = new THREE.SphereGeometry(499.5, 60, 40);
    fadeGeometry.scale(-1, 1, 1);
    const fadeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const fadeSphereMesh = new THREE.Mesh(fadeGeometry, fadeMaterial);
    fadeSphereMesh.visible = false;
    scene.add(fadeSphereMesh);
    fadeSphereMeshRef.current = fadeSphereMesh;

    // Load initial panorama image immediately once the sphere mesh is created
    if (imageUrl) {
      loadTexture(imageUrl);
    }

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    canvasMount.replaceChildren(renderer.domElement);

    // Initial look
    const initLook = pitchYawToVector3(pitchRef.current, yawRef.current, 100);
    camera.lookAt(initLook);

    // Pre-allocated variables for zero-GC animation loop
    const _camDirection = new THREE.Vector3();
    const _targetVec = new THREE.Vector3();
    const _hotspotVec = new THREE.Vector3();
    let animationFrameId: number;

    // Smooth animation loop
    const animate = () => {
      // 1. Cinematic Cross-Fade Dissolve Transition
      if (isFadingRef.current && fadeSphereMeshRef.current && nextLoadedTextureRef.current) {
        fadeProgressRef.current += 0.05; // ~350ms smooth dissolve
        if (fadeProgressRef.current >= 1) {
          fadeProgressRef.current = 1;
          isFadingRef.current = false;

          // Swap texture permanently onto main sphere
          if (sphereMeshRef.current) {
            const mainMat = sphereMeshRef.current.material as THREE.MeshBasicMaterial;
            mainMat.map = nextLoadedTextureRef.current;
            mainMat.needsUpdate = true;
          }

          const fadeMat = fadeSphereMeshRef.current.material as THREE.MeshBasicMaterial;
          fadeMat.opacity = 0;
          fadeSphereMeshRef.current.visible = false;

          if (textureRef.current) {
            textureRef.current.dispose();
          }
          textureRef.current = nextLoadedTextureRef.current;
          nextLoadedTextureRef.current = null;
        } else {
          const fadeMat = fadeSphereMeshRef.current.material as THREE.MeshBasicMaterial;
          fadeMat.opacity = fadeProgressRef.current;
        }
      }

      // Auto-rotation when active and user not interacting
      if (isAutoRotatingRef.current && !isDraggingRef.current && !isLittlePlanetActiveRef.current) {
        targetYawRef.current = (targetYawRef.current + autoRotateSpeedRef.current) % 360;
      }

      // Smooth exponential damping
      const dampingFactor = isLittlePlanetActiveRef.current ? 0.05 : 0.12;
      pitchRef.current += (targetPitchRef.current - pitchRef.current) * dampingFactor;

      // Handle shortest angular rotation for Yaw (prevent 360 wrap spin)
      let diffYaw = targetYawRef.current - yawRef.current;
      while (diffYaw > 180) diffYaw -= 360;
      while (diffYaw < -180) diffYaw += 360;
      yawRef.current += diffYaw * dampingFactor;
      while (yawRef.current > 180) yawRef.current -= 360;
      while (yawRef.current < -180) yawRef.current += 360;

      fovRef.current += (targetFovRef.current - fovRef.current) * (isLittlePlanetActiveRef.current ? 0.04 : 0.12);

      // Smooth camera position translation (Fly-Through / Dolly forward motion)
      camPosRef.current.lerp(targetCamPosRef.current, 0.12);
      camera.position.copy(camPosRef.current);

      camera.fov = fovRef.current;
      camera.updateProjectionMatrix();

      // Camera look-at relative to moving camera position
      const phi = THREE.MathUtils.degToRad(90 - pitchRef.current);
      const theta = THREE.MathUtils.degToRad(yawRef.current);

      _targetVec.set(
        camera.position.x + 500 * Math.sin(phi) * Math.sin(theta),
        camera.position.y + 500 * Math.cos(phi),
        camera.position.z + 500 * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(_targetVec);

      // Render standard or VR stereoscopic view
      const curContainer = containerRef.current;
      if (curContainer && renderer) {
        const cWidth = curContainer.clientWidth;
        const cHeight = curContainer.clientHeight;

        if (isVrStereoMode) {
          // Stereoscopic split screen (Left eye & Right eye)
          renderer.setScissorTest(true);
          const halfWidth = Math.floor(cWidth / 2);

          // Left eye
          camera.aspect = halfWidth / cHeight;
          camera.updateProjectionMatrix();
          renderer.setViewport(0, 0, halfWidth, cHeight);
          renderer.setScissor(0, 0, halfWidth, cHeight);
          renderer.render(scene, camera);

          // Right eye
          renderer.setViewport(halfWidth, 0, halfWidth, cHeight);
          renderer.setScissor(halfWidth, 0, halfWidth, cHeight);
          renderer.render(scene, camera);
          renderer.setScissorTest(false);
        } else {
          renderer.setViewport(0, 0, cWidth, cHeight);
          renderer.render(scene, camera);
        }

        // Project hotspots to 2D screen coordinates
        camera.getWorldDirection(_camDirection);

        // Project hotspots to 2D screen coordinates seamlessly on every frame
        camera.getWorldDirection(_camDirection);

        const allSpots = [...(hotspotsRef.current || [])];
        const draft = pinpointDraftRef.current;
        if (draft && draft.pitch !== undefined && draft.yaw !== undefined) {
          allSpots.push({
            id: 'pinpoint-draft',
            sceneId: '',
            title: draft.title || 'Titik Hotspot Baru',
            type: draft.type || 'navigation',
            pitch: draft.pitch,
            yaw: draft.yaw,
            groundPlacement: draft.groundPlacement ?? true,
            icon: draft.icon || 'arrow',
          } as Hotspot);
        }

        const projected = allSpots.map((h) => {
          _hotspotVec.copy(pitchYawToVector3(h.pitch, h.yaw, 500));

          const spotRelVec = _hotspotVec.clone().sub(camera.position).normalize();
          const dot = _camDirection.dot(spotRelVec);

          if (dot <= 0.08) {
            return {
              id: h.id,
              x: -9999,
              y: -9999,
              visible: false,
              scale: 1,
              groundTilt: 45,
              hotspot: h,
            };
          }

          // Project to NDC [-1, 1]
          const ndcPos = _hotspotVec.clone().project(camera);
          const screenX = (ndcPos.x * 0.5 + 0.5) * cWidth;
          const screenY = (-(ndcPos.y * 0.5) + 0.5) * cHeight;

          // Perspective scale
          const scale = Math.max(0.75, Math.min(1.25, 1.1 - ndcPos.z * 0.2));
          const groundTilt = Math.max(20, Math.min(65, -h.pitch * 0.95));

          return {
            id: h.id,
            x: screenX,
            y: screenY,
            visible: true,
            scale,
            groundTilt,
            hotspot: h,
          };
        });

        setProjectedHotspots(projected);
      }

      setCurrentYaw(Math.round(yawRef.current));
      setCurrentPitch(Math.round(pitchRef.current));

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      fadeGeometry.dispose();
      fadeMaterial.dispose();
      if (textureRef.current) {
        textureRef.current.dispose();
      }
      if (nextLoadedTextureRef.current) {
        nextLoadedTextureRef.current.dispose();
      }
    };
  }, [isVrStereoMode]);

  // Raycast from mouse/touch event to get sphere Pitch & Yaw
  const raycastSphere = useCallback((clientX: number, clientY: number): { pitch: number; yaw: number } | null => {
    if (!containerRef.current || !cameraRef.current || !sphereMeshRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObject(sphereMeshRef.current);

    if (intersects.length > 0) {
      const hitPoint = intersects[0].point;
      return vector3ToPitchYaw(hitPoint);
    }
    return null;
  }, []);

  // Smooth cinematic forward fly-through transition when clicking a navigation hotspot
  const handleHotspotClickWithFlyThrough = (hotspot: Hotspot) => {
    if (hotspot.type === 'navigation' && hotspot.targetSceneId) {
      setTransitioningHotspotId(hotspot.id);
      soundManager.playTransitionSfx();

      // 1. Calculate direction unit vector towards the hotspot in 3D space
      const phi = THREE.MathUtils.degToRad(90 - hotspot.pitch);
      const theta = THREE.MathUtils.degToRad(hotspot.yaw);
      const forwardDir = new THREE.Vector3(
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi) * 0.35, // subtle vertical movement
        Math.sin(phi) * Math.cos(theta)
      ).normalize();

      // 2. Smoothly pivot camera look-at towards the target hotspot
      targetPitchRef.current = Math.max(-25, Math.min(15, hotspot.pitch));
      targetYawRef.current = hotspot.yaw;

      // 3. Translate camera forward in 3D space towards the hotspot (Forward walk / Dolly)
      targetCamPosRef.current.copy(forwardDir.clone().multiplyScalar(220));

      // 4. Zoom FOV dynamically (high-speed rushing sensation)
      targetFovRef.current = 48;

      // 5. At the peak of forward travel, trigger scene switch and glide smoothly into new room
      setTimeout(() => {
        onHotspotClick?.(hotspot);

        // In the new scene, camera glides in smoothly from entryway towards center
        camPosRef.current.copy(forwardDir.clone().multiplyScalar(-130));
        targetCamPosRef.current.set(0, 0, 0);

        // Smoothly restore standard FOV
        targetFovRef.current = 75;

        setTimeout(() => {
          setTransitioningHotspotId(null);
        }, 300);
      }, 420);
    } else {
      soundManager.playClickSfx();
      onHotspotClick?.(hotspot);
    }
  };

  // Mouse & Touch Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragDistanceRef.current = 0;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      const deltaX = e.clientX - dragStartPosRef.current.x;
      const deltaY = e.clientY - dragStartPosRef.current.y;
      dragDistanceRef.current += Math.hypot(deltaX, deltaY);

      // Stop auto-rotation when user manually drags the screen
      if (stopAutoRotateOnInteractionRef.current && isAutoRotatingRef.current && dragDistanceRef.current > 3) {
        isAutoRotatingRef.current = false;
        setIsAutoRotating(false);
        onAutoRotateChange?.(false);
      }

      const speedFactor = (fovRef.current / 75) * 0.16;
      targetYawRef.current = (targetYawRef.current - deltaX * speedFactor) % 360;
      targetPitchRef.current = Math.max(-85, Math.min(85, targetPitchRef.current + deltaY * speedFactor));

      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    }

    if (isPinpointMode) {
      const coords = raycastSphere(e.clientX, e.clientY);
      if (coords) {
        setHoveredCoords(coords);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe catch
      }

      if (dragDistanceRef.current < 6 && isPinpointMode) {
        const coords = raycastSphere(e.clientX, e.clientY);
        if (coords && onSceneClickForPinpoint) {
          soundManager.playClickSfx();
          onSceneClickForPinpoint(coords);
        }
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (stopAutoRotateOnInteractionRef.current && isAutoRotatingRef.current) {
      isAutoRotatingRef.current = false;
      setIsAutoRotating(false);
      onAutoRotateChange?.(false);
    }
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      if (pinchStartDistRef.current !== null) {
        const delta = pinchStartDistRef.current - dist;
        targetFovRef.current = Math.max(30, Math.min(95, targetFovRef.current + delta * 0.08));
      }
      pinchStartDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    targetFovRef.current = Math.max(30, Math.min(95, targetFovRef.current + e.deltaY * 0.05));
  };

  const handleZoomIn = () => {
    targetFovRef.current = Math.max(30, targetFovRef.current - 12);
  };

  const handleZoomOut = () => {
    targetFovRef.current = Math.min(95, targetFovRef.current + 12);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const toggleGyro = () => {
    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> })
        .requestPermission()
        .then((permissionState) => {
          if (permissionState === 'granted') {
            setIsGyroActive(!isGyroActive);
          }
        })
        .catch(() => {});
    } else {
      setIsGyroActive(!isGyroActive);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-slate-950 touch-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      style={{ cursor: isPinpointMode ? 'crosshair' : isDraggingRef.current ? 'grabbing' : 'grab' }}
    >
      {/* 3D WebGL Canvas Mount: smooth opacity fade-in once texture is 100% loaded */}
      <div
        ref={canvasMountRef}
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          isLoadingTexture ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Fly-Through Flash Overlay */}
      {transitioningHotspotId && (
        <div className="absolute inset-0 z-30 pointer-events-none bg-white/15 backdrop-blur-[2px] transition-opacity duration-300 animate-fadeIn" />
      )}

      {/* Loading Overlay: Hides canvas completely until 100% memory preloaded */}
      {isLoadingTexture && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 backdrop-blur-md transition-opacity duration-300">
          <div className="flex flex-col items-center gap-3 px-8 py-5 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl text-center">
            <div className="relative flex items-center justify-center w-12 h-12">
              <div className="absolute inset-0 rounded-full border-3 border-sky-500/20" />
              <div className="absolute inset-0 rounded-full border-3 border-sky-400 border-t-transparent animate-spin" />
              <Navigation className="w-5 h-5 text-sky-400 animate-pulse" />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-wide block">Memuat Panorama 360°</span>
              <span className="text-xs text-slate-400 mt-0.5 block">Mengunduh tekstur resolusi tinggi 100% ke memori...</span>
            </div>
          </div>
        </div>
      )}

      {/* Pinpoint Mode Live Crosshair */}
      {isPinpointMode && hoveredCoords && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/90 border border-sky-500/60 rounded-full shadow-xl shadow-sky-950/40 text-xs text-sky-200">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
            <span className="font-semibold text-white">Klik lantai/titik untuk memposisikan hotspot</span>
            <span className="text-slate-400">|</span>
            <span>Pitch: <strong className="text-sky-300">{hoveredCoords.pitch}°</strong></span>
            <span>Yaw: <strong className="text-sky-300">{hoveredCoords.yaw}°</strong></span>
          </div>
        </div>
      )}

      {/* Interactive Hotspot Screen Projections (Kept mounted in DOM to prevent marker vanishing) */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {projectedHotspots.map(({ id, x, y, visible, scale, groundTilt, hotspot }) => {
          const isDraft = id === 'pinpoint-draft';
          const isGround = hotspot.groundPlacement;

          return (
            <div
              key={id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-75 hover:scale-120 group"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                display: visible ? 'block' : 'none',
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? 'auto' : 'none',
                zIndex: isDraft ? 40 : Math.round(100 - (hotspot.pitch + 90)),
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDraft) {
                  handleHotspotClickWithFlyThrough(hotspot);
                }
              }}
            >
              {isGround ? (
                /* Google Street View / Professional Pulsing Floor Arrow */
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    transform: `perspective(700px) rotateX(${groundTilt}deg) scale(${scale})`,
                  }}
                >
                  {/* Concentric Pulsing Ground Ring & Target Reticle */}
                  {/* Concentric Pulsing Ground Ring & Target Reticle */}
                  <div className="relative flex items-center justify-center w-20 h-20">
                    {/* Outer pulsating wave ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-rose-500/70 animate-ping" />
                    {/* Orbiting dashed compass ring */}
                    <div
                      className="absolute -inset-1 rounded-full border-2 border-dashed border-sky-400/80 animate-spin"
                      style={{ animationDuration: '6s' }}
                    />
                    {/* Inner glowing disc */}
                    <div className="absolute inset-1.5 rounded-full border-2 border-white/90 bg-linear-to-b from-sky-500/40 to-sky-600/70 backdrop-blur-xs shadow-xl shadow-sky-500/50" />
                    
                    {/* Center Chevron Navigation Icon with continuous rotating animation */}
                    <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white text-sky-600 shadow-2xl group-hover:bg-sky-400 group-hover:text-white transition-all duration-200">
                      <Navigation
                        className="w-6 h-6 animate-spin fill-current filter drop-shadow-md text-sky-600 group-hover:text-white"
                        style={{ animationDuration: '3.5s' }}
                      />
                    </div>
                  </div>

                  {/* Hotspot Floating Tooltip anchored below center */}
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/95 border border-slate-700/90 rounded-full shadow-2xl text-[11px] font-bold text-white whitespace-nowrap opacity-95 group-hover:opacity-100 group-hover:border-sky-400 transition-all duration-200 pointer-events-none flex items-center gap-1.5">
                    {isDraft ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Posisi Baru: {hotspot.title}
                      </span>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        {hotspot.title}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Floating Info Marker / Target Badge */
                <div
                  className="relative flex items-center justify-center"
                  style={{ transform: `scale(${scale})` }}
                >
                  <div className="relative flex items-center justify-center w-11 h-11 rounded-full bg-slate-900/95 border-2 border-amber-400 text-amber-300 shadow-xl shadow-amber-500/25 group-hover:scale-115 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all duration-200">
                    {hotspot.icon === 'star' ? (
                      <Sparkles className="w-5 h-5 fill-current" />
                    ) : hotspot.icon === 'info' ? (
                      <Info className="w-5 h-5" />
                    ) : (
                      <Navigation className="w-5 h-5 animate-spin fill-current filter" style={{ animationDuration: '3.5s' }} />
                    )}
                  </div>

                  {/* Tooltip Label */}
                  <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/95 border border-amber-500/40 rounded-lg shadow-xl text-[11px] font-medium text-amber-100 whitespace-nowrap opacity-90 group-hover:opacity-100 group-hover:border-amber-400 transition-all duration-200 pointer-events-none">
                    {hotspot.title}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating HUD Controls */}
      {showControls && (
        <>
          {/* Top-Right: Orientation Radar / Compass */}
          <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
            <div
              className="relative flex items-center justify-center w-13 h-13 rounded-full bg-slate-900/80 border border-slate-700/80 shadow-xl backdrop-blur-xs text-slate-200 hover:border-sky-500 transition-colors"
              title={`Arah Pandang: ${Math.round(currentYaw)}° (Pitch: ${Math.round(currentPitch)}°)`}
              onClick={() => {
                targetYawRef.current = 0;
                targetPitchRef.current = 0;
              }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
                style={{ transform: `rotate(${-currentYaw}deg)` }}
              >
                <div className="w-0.5 h-9 bg-linear-to-b from-rose-500 via-slate-600 to-slate-400 rounded-full" />
                <span className="absolute -top-1 text-[9px] font-bold text-rose-500 tracking-tighter">U</span>
              </div>
              <Compass className="w-5 h-5 text-slate-400 pointer-events-none" />
            </div>

            <div className="px-2 py-0.5 bg-slate-900/70 border border-slate-800 rounded-md text-[10px] text-slate-400 font-mono">
              {Math.round(currentYaw)}°
            </div>
          </div>

          {/* Quick Floating Actions: Little Planet, Gyro, VR, Zoom */}
          <div className="absolute bottom-20 right-4 z-20 flex flex-col items-center gap-2 bg-slate-900/85 border border-slate-800/90 p-1.5 rounded-2xl shadow-2xl backdrop-blur-xs">
            <button
              onClick={triggerLittlePlanet}
              className={`p-2 rounded-xl transition-all ${
                isLittlePlanetActive ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Efek Tiny Planet (Little Planet Zoom)"
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              onClick={toggleGyro}
              className={`p-2 rounded-xl transition-all ${
                isGyroActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Sensor Gyroscope (Arah HP)"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsVrStereoMode(!isVrStereoMode)}
              className={`p-2 rounded-xl transition-all ${
                isVrStereoMode ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Mode VR Split-Screen (Kacamata VR)"
            >
              <Glasses className="w-4 h-4" />
            </button>
            <div className="w-4 h-px bg-slate-800" />
            <button
              onClick={handleZoomIn}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Perbesar (Zoom In)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Perkecil (Zoom Out)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Layar Penuh (Fullscreen)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
