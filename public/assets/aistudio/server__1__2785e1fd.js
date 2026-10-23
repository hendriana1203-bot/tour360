/**
 * server.ts
 * Tour360 Express Server
 * Featuring:
 * - Multer file uploads for 360 Panoramas and Branding Logos
 * - Persistent CRUD for Scenes, Hotspots, Admin Users, and Settings
 * - Vite dev middleware mounting for seamless SPA development
 * - Zero external cloud dependencies (local SQLite/JSON persistence in dev.db / data store)
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
// Ensure directories exist (STRICTLY using 'uploads' and 'data')
const UPLOAD_ROOT = path.join(__dirname, 'uploads');
const PANORAMA_DIR = path.join(UPLOAD_ROOT, 'panoramas');
const BRANDING_DIR = path.join(UPLOAD_ROOT, 'branding');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'tour360_db.json');
[UPLOAD_ROOT, PANORAMA_DIR, BRANDING_DIR, DATA_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});
// Configure Multer for 360 Panoramas and Logos
const panoramaStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PANORAMA_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        cb(null, unique);
    },
});
const brandingStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BRANDING_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const unique = `logo-${Date.now()}${ext}`;
        cb(null, unique);
    },
});
const uploadPanorama = multer({
    storage: panoramaStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (/image\/(jpeg|jpg|png|webp)/i.test(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Format file harus berupa gambar (JPG, PNG, atau WebP).'));
        }
    },
});
const uploadBranding = multer({
    storage: brandingStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (/image\/(jpeg|jpg|png|webp|svg\+xml)/i.test(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Format logo harus JPG, PNG, WebP, atau SVG.'));
        }
    },
});
// JSON and static middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Serve uploaded assets and static assets with CORS headers
app.use('/uploads', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    next();
}, express.static(UPLOAD_ROOT), express.static(path.join(__dirname, 'public/uploads')));
app.use('/assets', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
}, express.static(path.join(__dirname, 'public/assets')));
app.use('/storage', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
}, express.static(path.join(__dirname, 'public/assets/storage')), express.static(path.join(__dirname, 'storage')), express.static(path.join(__dirname, 'public/storage')));
app.use('/public', express.static(path.join(__dirname, 'public')));
// Simple password hashing helper
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + '_tour360_salt').digest('hex');
}
// Initial Database Seeder
function getInitialDB() {
    return {
        users: [
            {
                id: 'usr-admin-1',
                username: 'admin',
                email: 'admin@tour360.local',
                name: 'Super Administrator',
                passwordHash: hashPassword('admin123'),
                role: 'SUPER_ADMIN',
                isActive: true,
                createdAt: new Date().toISOString(),
            },
        ],
        scenes: [
            {
                id: 'scene-lobby',
                title: 'Lobi Utama & Galeri Seni',
                description: 'Pusat resepsi utama dengan arsitektur modern, karya seni instalasi, dan akses ke seluruh zona gedung.',
                imageUrl: '/api/preset-panorama/lobby',
                thumbnailUrl: '',
                isDefault: true,
                initialPitch: -6,
                initialYaw: 15,
                category: 'Interior Gedung',
                order: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'scene-courtyard',
                title: 'Taman Terbuka & Koridor Plaza',
                description: 'Area hijau terbuka dengan kolam air mancur Zen, pepohonan peneduh, dan akses penghubung pedestrian.',
                imageUrl: '/api/preset-panorama/courtyard',
                thumbnailUrl: '',
                isDefault: false,
                initialPitch: -4,
                initialYaw: 45,
                category: 'Outdoor & Lansekap',
                order: 2,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'scene-hall',
                title: 'Executive Lounge & Skyline Deck',
                description: 'Ruang pertemuan eksklusif berlantai parket kayu dengan pemandangan cakrawala kota saat senja.',
                imageUrl: '/api/preset-panorama/hall',
                thumbnailUrl: '',
                isDefault: false,
                initialPitch: -5,
                initialYaw: 10,
                category: 'Fasilitas Eksekutif',
                order: 3,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ],
        hotspots: [
            {
                id: 'hs-1',
                sceneId: 'scene-lobby',
                title: 'Menuju Taman Terbuka & Plaza',
                type: 'navigation',
                targetSceneId: 'scene-courtyard',
                pitch: -36,
                yaw: 18,
                groundPlacement: true,
                groundElevation: -36,
                icon: 'arrow',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'hs-2',
                sceneId: 'scene-lobby',
                title: 'Menuju Executive Lounge & Suite',
                type: 'navigation',
                targetSceneId: 'scene-hall',
                pitch: -34,
                yaw: -78,
                groundPlacement: true,
                groundElevation: -34,
                icon: 'arrow',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'hs-3',
                sceneId: 'scene-lobby',
                title: 'Instalasi Seni Harmoni Ruang',
                type: 'info',
                pitch: 2,
                yaw: 52,
                groundPlacement: false,
                icon: 'info',
                description: 'Patung perunggu kontemporer karya seniman ternama, melambangkan keterbukaan, dinamika ruang, dan inovasi arsitektur masa depan.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'hs-4',
                sceneId: 'scene-courtyard',
                title: 'Kembali ke Lobi Utama',
                type: 'navigation',
                targetSceneId: 'scene-lobby',
                pitch: -38,
                yaw: 172,
                groundPlacement: true,
                groundElevation: -38,
                icon: 'arrow',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'hs-5',
                sceneId: 'scene-courtyard',
                title: 'Masuk ke Executive Lounge',
                type: 'navigation',
                targetSceneId: 'scene-hall',
                pitch: -35,
                yaw: -48,
                groundPlacement: true,
                groundElevation: -35,
                icon: 'arrow',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'hs-6',
                sceneId: 'scene-courtyard',
                title: 'Air Mancur Zen & Kolam Refleksi',
                type: 'info',
                pitch: -8,
                yaw: 88,
                groundPlacement: false,
                icon: 'info',
                description: 'Fitur air mancur hemat energi dengan sirkulasi biologis yang menghadirkan suasana tenang dan asri.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'hs-7',
                sceneId: 'scene-hall',
                title: 'Kembali ke Lobi Utama',
                type: 'navigation',
                targetSceneId: 'scene-lobby',
                pitch: -37,
                yaw: 96,
                groundPlacement: true,
                groundElevation: -37,
                icon: 'arrow',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'hs-8',
                sceneId: 'scene-hall',
                title: 'Menuju Taman Terbuka',
                type: 'navigation',
                targetSceneId: 'scene-courtyard',
                pitch: -35,
                yaw: 142,
                groundPlacement: true,
                groundElevation: -35,
                icon: 'arrow',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'hs-9',
                sceneId: 'scene-hall',
                title: 'Smart Presentation Screen',
                type: 'info',
                pitch: 0,
                yaw: -22,
                groundPlacement: false,
                icon: 'star',
                description: 'Layar 4K interaktif untuk presentasi strategis dan konferensi video real-time.',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ],
        settings: {
            appName: 'Tour360 Virtual Tour',
            tagline: 'Jelajahi Setiap Sudut dengan Pengalaman 360° Interaktif',
            logoUrl: '',
            primaryColor: '#0284c7',
            enableAmbientAudio: 'true',
            enableAutoRotate: 'false',
            autoRotateSpeed: '0.35',
            enableCompass: 'true',
            enableZoomControls: 'true',
            contactEmail: 'admin@tour360.local',
            contactPhone: '+62 812-3456-7890',
            footerNote: 'Tour360 Platform • Powered by Three.js WebGL Engine',
        },
    };
}
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf-8');
            return JSON.parse(data);
        }
    }
    catch (err) {
        console.error('Error reading database file, resetting to initial defaults:', err);
    }
    const initial = getInitialDB();
    saveDB(initial);
    return initial;
}
function saveDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('Error writing database file:', err);
    }
}
// ----------------- API ROUTES -----------------
// 1. Authentication & Admin Profiles
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }
    const db = loadDB();
    const passwordHash = hashPassword(password);
    const user = db.users.find((u) => (u.username === username || u.email === username) && u.passwordHash === passwordHash && u.isActive);
    if (!user) {
        return res.status(401).json({ error: 'Username atau password tidak sesuai.' });
    }
    // Generate lightweight session token
    const token = `tour360_${user.id}_${Date.now()}`;
    const { passwordHash: _, ...userProfile } = user;
    res.json({
        token,
        user: userProfile,
    });
});
// Admin User Management (CRUD Admin)
app.get('/api/users', (_req, res) => {
    const db = loadDB();
    const safeUsers = db.users.map(({ passwordHash: _, ...u }) => u);
    res.json(safeUsers);
});
app.post('/api/users', (req, res) => {
    const { username, email, name, password, role } = req.body;
    if (!username || !email || !password || !name) {
        return res.status(400).json({ error: 'Data admin tidak lengkap.' });
    }
    const db = loadDB();
    if (db.users.some((u) => u.username === username || u.email === email)) {
        return res.status(400).json({ error: 'Username atau email sudah digunakan.' });
    }
    const newUser = {
        id: `usr-${Date.now()}`,
        username,
        email,
        name,
        passwordHash: hashPassword(password),
        role: role || 'ADMIN',
        isActive: true,
        createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    saveDB(db);
    const { passwordHash: _, ...safe } = newUser;
    res.status(201).json(safe);
});
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, role, isActive, password } = req.body;
    const db = loadDB();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) {
        return res.status(404).json({ error: 'Admin tidak ditemukan.' });
    }
    if (name !== undefined)
        db.users[idx].name = name;
    if (email !== undefined)
        db.users[idx].email = email;
    if (role !== undefined)
        db.users[idx].role = role;
    if (isActive !== undefined)
        db.users[idx].isActive = isActive;
    if (password)
        db.users[idx].passwordHash = hashPassword(password);
    saveDB(db);
    const { passwordHash: _, ...safe } = db.users[idx];
    res.json(safe);
});
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDB();
    // Prevent deleting the last super admin
    if (db.users.filter((u) => u.role === 'SUPER_ADMIN').length <= 1 && db.users.find((u) => u.id === id)?.role === 'SUPER_ADMIN') {
        return res.status(400).json({ error: 'Tidak dapat menghapus satu-satunya Super Admin.' });
    }
    db.users = db.users.filter((u) => u.id !== id);
    saveDB(db);
    res.json({ success: true, message: 'Admin berhasil dihapus.' });
});
// 2. Scene CRUD & Panorama File Replacement
app.get('/api/scenes', (_req, res) => {
    const db = loadDB();
    const scenesWithHotspots = db.scenes
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
        ...s,
        hotspots: db.hotspots.filter((h) => h.sceneId === s.id),
    }));
    res.json(scenesWithHotspots);
});
// Create Scene (with optional Multer 360 photo upload)
app.post('/api/scenes', uploadPanorama.single('panoramaFile'), (req, res) => {
    try {
        const { title, description, initialPitch, initialYaw, category, isDefault, presetType } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Judul scene wajib diisi.' });
        }
        let imageUrl = '';
        if (req.file) {
            imageUrl = `/uploads/panoramas/${req.file.filename}`;
        }
        else if (presetType) {
            imageUrl = `/api/preset-panorama/${presetType}`;
        }
        else {
            imageUrl = '/api/preset-panorama/lobby';
        }
        const db = loadDB();
        if (isDefault === 'true' || isDefault === true) {
            db.scenes.forEach((s) => (s.isDefault = false));
        }
        const newScene = {
            id: `scene-${Date.now()}`,
            title,
            description: description || '',
            imageUrl,
            thumbnailUrl: imageUrl,
            isDefault: isDefault === 'true' || isDefault === true || db.scenes.length === 0,
            initialPitch: initialPitch ? parseFloat(initialPitch) : -5,
            initialYaw: initialYaw ? parseFloat(initialYaw) : 0,
            category: category || 'Umum',
            order: db.scenes.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        db.scenes.push(newScene);
        saveDB(db);
        res.status(201).json({ ...newScene, hotspots: [] });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal membuat scene.';
        res.status(500).json({ error: message });
    }
});
// Update Scene & Replace 360 Panorama Photo Dynamically
app.put('/api/scenes/:id', uploadPanorama.single('panoramaFile'), (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, initialPitch, initialYaw, category, isDefault } = req.body;
        const db = loadDB();
        const idx = db.scenes.findIndex((s) => s.id === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Scene tidak ditemukan.' });
        }
        if (title !== undefined)
            db.scenes[idx].title = title;
        if (description !== undefined)
            db.scenes[idx].description = description;
        if (category !== undefined)
            db.scenes[idx].category = category;
        if (initialPitch !== undefined)
            db.scenes[idx].initialPitch = parseFloat(initialPitch);
        if (initialYaw !== undefined)
            db.scenes[idx].initialYaw = parseFloat(initialYaw);
        if (isDefault === 'true' || isDefault === true) {
            db.scenes.forEach((s) => (s.isDefault = false));
            db.scenes[idx].isDefault = true;
        }
        // If new 360 panorama file uploaded, replace image URL
        if (req.file) {
            const oldUrl = db.scenes[idx].imageUrl;
            // Delete old local file if in /uploads/panoramas
            if (oldUrl && oldUrl.startsWith('/uploads/panoramas/')) {
                const oldPath = path.join(__dirname, oldUrl);
                if (fs.existsSync(oldPath)) {
                    try {
                        fs.unlinkSync(oldPath);
                    }
                    catch {
                        // Ignore unlink errors
                    }
                }
            }
            db.scenes[idx].imageUrl = `/uploads/panoramas/${req.file.filename}`;
            db.scenes[idx].thumbnailUrl = `/uploads/panoramas/${req.file.filename}`;
        }
        db.scenes[idx].updatedAt = new Date().toISOString();
        saveDB(db);
        const sceneWithHotspots = {
            ...db.scenes[idx],
            hotspots: db.hotspots.filter((h) => h.sceneId === id),
        };
        res.json(sceneWithHotspots);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memperbarui scene.';
        res.status(500).json({ error: message });
    }
});
// Delete Scene
app.delete('/api/scenes/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDB();
    const sceneToDelete = db.scenes.find((s) => s.id === id);
    if (!sceneToDelete) {
        return res.status(404).json({ error: 'Scene tidak ditemukan.' });
    }
    // Remove uploaded file if exists
    if (sceneToDelete.imageUrl.startsWith('/uploads/panoramas/')) {
        const filePath = path.join(__dirname, sceneToDelete.imageUrl);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            }
            catch {
                // Safe catch
            }
        }
    }
    // Remove scene and its hotspots
    db.scenes = db.scenes.filter((s) => s.id !== id);
    db.hotspots = db.hotspots.filter((h) => h.sceneId !== id && h.targetSceneId !== id);
    // If deleted scene was default, assign default to first scene
    if (sceneToDelete.isDefault && db.scenes.length > 0) {
        db.scenes[0].isDefault = true;
    }
    saveDB(db);
    res.json({ success: true, message: 'Scene dan relasi hotspot berhasil dihapus.' });
});
// 3. Hotspots CRUD
app.post('/api/scenes/:sceneId/hotspots', (req, res) => {
    const { sceneId } = req.params;
    const { title, type, targetSceneId, pitch, yaw, groundPlacement, description, icon } = req.body;
    if (!title || pitch === undefined || yaw === undefined) {
        return res.status(400).json({ error: 'Title, Pitch, dan Yaw wajib ditentukan.' });
    }
    const db = loadDB();
    const sceneExists = db.scenes.some((s) => s.id === sceneId);
    if (!sceneExists) {
        return res.status(404).json({ error: 'Scene tidak ditemukan.' });
    }
    const newHotspot = {
        id: `hs-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        sceneId,
        title,
        type: type || 'navigation',
        targetSceneId: type === 'navigation' ? targetSceneId : undefined,
        pitch: parseFloat(pitch),
        yaw: parseFloat(yaw),
        groundPlacement: groundPlacement !== undefined ? Boolean(groundPlacement) : true,
        groundElevation: parseFloat(pitch),
        description: description || '',
        icon: icon || 'arrow',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    db.hotspots.push(newHotspot);
    saveDB(db);
    res.status(201).json(newHotspot);
});
app.put('/api/hotspots/:id', (req, res) => {
    const { id } = req.params;
    const { title, type, targetSceneId, pitch, yaw, groundPlacement, description, icon } = req.body;
    const db = loadDB();
    const idx = db.hotspots.findIndex((h) => h.id === id);
    if (idx === -1) {
        return res.status(404).json({ error: 'Hotspot tidak ditemukan.' });
    }
    if (title !== undefined)
        db.hotspots[idx].title = title;
    if (type !== undefined)
        db.hotspots[idx].type = type;
    if (targetSceneId !== undefined)
        db.hotspots[idx].targetSceneId = targetSceneId;
    if (pitch !== undefined) {
        db.hotspots[idx].pitch = parseFloat(pitch);
        db.hotspots[idx].groundElevation = parseFloat(pitch);
    }
    if (yaw !== undefined)
        db.hotspots[idx].yaw = parseFloat(yaw);
    if (groundPlacement !== undefined)
        db.hotspots[idx].groundPlacement = Boolean(groundPlacement);
    if (description !== undefined)
        db.hotspots[idx].description = description;
    if (icon !== undefined)
        db.hotspots[idx].icon = icon;
    db.hotspots[idx].updatedAt = new Date().toISOString();
    saveDB(db);
    res.json(db.hotspots[idx]);
});
app.delete('/api/hotspots/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDB();
    db.hotspots = db.hotspots.filter((h) => h.id !== id);
    saveDB(db);
    res.json({ success: true, message: 'Hotspot berhasil dihapus.' });
});
// 4. Logo & Branding Settings Management
app.get('/api/settings', (_req, res) => {
    const db = loadDB();
    res.json(db.settings);
});
app.put('/api/settings', (req, res) => {
    const updates = req.body;
    const db = loadDB();
    db.settings = { ...db.settings, ...updates };
    saveDB(db);
    res.json(db.settings);
});
// Upload dynamic brand logo
app.post('/api/settings/logo', uploadBranding.single('logoFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'File logo tidak ditemukan.' });
    }
    const logoUrl = `/uploads/branding/${req.file.filename}`;
    const db = loadDB();
    // Clean old logo if custom uploaded
    if (db.settings.logoUrl && db.settings.logoUrl.startsWith('/uploads/branding/')) {
        const oldPath = path.join(__dirname, db.settings.logoUrl);
        if (fs.existsSync(oldPath)) {
            try {
                fs.unlinkSync(oldPath);
            }
            catch {
                // Safe catch
            }
        }
    }
    db.settings.logoUrl = logoUrl;
    saveDB(db);
    res.json({ logoUrl, success: true });
});
// Preset procedural equirectangular panorama generator handler
// Generates SVG/Canvas stream for presets if no custom photo uploaded yet
app.get('/api/preset-panorama/:type', (req, res) => {
    const type = req.params.type;
    // Return an SVG equirectangular gradient or high-quality placeholder
    const skyColor = type === 'courtyard' ? '#0284c7' : type === 'hall' ? '#312e81' : '#1e293b';
    const floorColor = type === 'courtyard' ? '#57534e' : type === 'hall' ? '#78350f' : '#0f172a';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#020617"/>
        <stop offset="50%" stop-color="${skyColor}"/>
      </linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${floorColor}"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
    </defs>
    <!-- Sky / Ceiling -->
    <rect x="0" y="0" width="2048" height="512" fill="url(#sky)"/>
    <!-- Floor -->
    <rect x="0" y="512" width="2048" height="512" fill="url(#floor)"/>
    <!-- Floor Grid / Pathway -->
    <g stroke="rgba(255,255,255,0.15)" stroke-width="2">
      ${Array.from({ length: 32 })
        .map((_, i) => `<line x1="${i * 64}" y1="512" x2="${i * 64}" y2="1024"/>`)
        .join('')}
      ${Array.from({ length: 12 })
        .map((_, i) => `<line x1="0" y1="${512 + i * 42}" x2="2048" y2="${512 + i * 42}"/>`)
        .join('')}
    </g>
    <!-- Center Floor Rose Medallion -->
    <circle cx="1024" cy="768" r="140" fill="none" stroke="rgba(56,189,248,0.3)" stroke-width="6"/>
    <circle cx="1024" cy="768" r="60" fill="rgba(14,165,233,0.1)" stroke="rgba(56,189,248,0.5)" stroke-width="2"/>
    <!-- Horizon Horizon Label -->
    <text x="1024" y="490" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-size="28" font-weight="bold" text-anchor="middle">
      Tour360 • ${type === 'courtyard' ? 'Taman Terbuka & Plaza' : type === 'hall' ? 'Executive Lounge' : 'Lobi Utama & Galeri'}
    </text>
  </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
});
// ----------------- VITE INTEGRATION -----------------
async function startServer() {
    if (process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    }
    else {
        const distPath = path.join(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Tour360 Virtual Tour Server running at http://localhost:${PORT}`);
        console.log(`📁 Asset uploads stored in: ${UPLOAD_ROOT}`);
    });
}
startServer();
