// =================================================================================================
// 1. GLOBAL SETUP & UTILITIES
// =================================================================================================

// 1.1. Path Helper
/**
 * Calculates the relative path to the project root based on the current URL.
 * This is crucial for ensuring that assets and links work correctly from nested pages.
 * @returns {string} The relative path to the root (e.g., './', '../', '../../').
 */
function getPathToRoot() {
    const path = window.location.pathname;
    // Split the path and remove empty segments
    const parts = path.split('/').filter(Boolean);
    // If last segment looks like a file (has a dot), don't count it for depth
    const isFile = parts.length && parts[parts.length - 1].includes('.');
    const depth = Math.max(0, parts.length - (isFile ? 1 : 0));
    if (depth === 0) return './';
    return '../'.repeat(depth);
}
const pathToRoot = getPathToRoot();

// 1.2. Internationalization (i18n)
/**
 * Loads and applies translations from a JSON file based on the selected language.
 * It targets elements with `data-i18n` and `data-i18n-placeholder` attributes.
 * @param {string} lang - The language code (e.g., 'de', 'en') to load.
 */
async function loadTranslations(lang) {
    try {
        const response = await fetch(`${pathToRoot}locales/${lang}.json`);
        if (!response.ok) throw new Error('Language file not found');
        const translations = await response.json();
    try { window.__i18n = { lang, dict: translations }; } catch(_) {}
        document.querySelectorAll('[data-i18n], [data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const placeholderKey = element.getAttribute('data-i18n-placeholder');
            if (key && translations[key]) element.innerHTML = translations[key];
            if (placeholderKey && translations[placeholderKey]) element.placeholder = translations[placeholderKey];
        });
    } catch (error) {
        console.error('Translation Error:', error);
    }
}

// 1.3. Background Music Configuration
// =================================================================================================
/**
 * Fetches the list of background music tracks from the Firestore collection.
 * @returns {Promise<Array>} A promise that resolves to an array of background music track objects.
 */

async function getBgMusicTracks() {
    const simulatedTracks = [
        { id: 'none', title_de: 'Ohne Musik', title_en: 'Without Music', path: '', image: '' },
        { id: 'birdparadise', title_de: 'Bird´s Paradise', title_en: 'Bird´s Paradise', path: `assets/audio/bg_music/birdparadise.m4a`, image: `assets/images/backgrounds/bg_trees.png` },
        { id: 'merlinsmagic', title_de: 'Merlin´s Magic', title_en: 'Merlin´s Magic', path: `assets/audio/bg_music/merlinsmagic.m4a`, image: `assets/images/backgrounds/bg_waterfall.png` }
    ];

    const tracks = [];
    try {
        const snapshot = await db.collection('background_music').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            tracks.push({
                id: doc.id,
                title_de: data.title_de,
                title_en: data.title_en,
                // Keep paths relative to project root; prefix with pathToRoot when using
                path: data.path || '',
                image: data.image || ''
            });
        });
    } catch (error) {
        console.error("Error fetching background music:", error);
    }
    return tracks.length > 0 ? tracks : simulatedTracks; // Fallback to simulated tracks if firestore is empty
}


// =================================================================================================
// 2. FIREBASE AUTHENTICATION & ROUTING
// =================================================================================================

// 2.1. Auth Guard
/**
 * Protects routes by redirecting users based on their authentication status.
 * - Unauthenticated users trying to access protected pages are sent to the login page.
 * - Authenticated users trying to access login/register pages are sent to the main content.
 */
if (auth) {
    auth.onAuthStateChanged(user => {
        const path = window.location.pathname;
        const isProtectedPage = path.includes('/structure/');
        const isAuthPage = path.endsWith('login.html') || path.endsWith('register.html');

        if (isProtectedPage && !user) {
            return window.location.replace(`${pathToRoot}login.html`);
        }
        if (isAuthPage && user) {
            return window.location.replace(`${pathToRoot}structure/categories.html`);
        }
    });
}


// =================================================================================================
// 3. CORE APPLICATION LOGIC (DOM-Ready)
// =================================================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(`${pathToRoot}service-worker.js`).catch(() => {});
    }

    // 3.1. General Initializations
    // ---------------------------------------------------------------------------------------------
    const lang = localStorage.getItem('lang') || 'de';
    loadTranslations(lang);

    // --- Initialize Read More functionality - expands and collapses long description text --- //
    if (document.querySelector('[data-read-more]')) {
        const script = document.createElement('script');
        script.src = `${pathToRoot}read-more.js`;
        script.onload = () => {
            document.querySelectorAll('[data-read-more]').forEach(element => {
                if (typeof initReadMore === 'function') {
                    initReadMore(element);
                }
            });
        };
        document.head.appendChild(script);
    }

    const path = window.location.pathname;

    // Initialize Favorites Drawer in footer (footer HTML is injected via fetch and scripts there don't run)
    (function initFooterFavoritesDrawer() {
        const MAX_TRIES = 50;
        let tries = 0;
        const interval = setInterval(() => {
            tries++;
            const btn = document.getElementById('footer-favorites-btn');
            const drawer = document.getElementById('favorites-drawer');
            const closeBtn = document.getElementById('favorites-drawer-close');
            const listEl = document.getElementById('favorites-list');
            if (!btn || !drawer || !listEl) {
                if (tries >= MAX_TRIES) clearInterval(interval);
                return;
            }
            clearInterval(interval);

            // Ensure any i18n in injected footer gets applied once elements exist
            try { loadTranslations(localStorage.getItem('lang') || 'de'); } catch(_) {}

            let latestFavs = {};
            const audioMetaCache = {};
            let currentUserId = null;
            const renderFavorites = async (favs) => {
                latestFavs = favs || {};
                listEl.innerHTML = '';
                const favArray = Object.values(favs || {});
                if (!favArray.length) {
                    listEl.innerHTML = '<div style="padding:10px; color:#777;">Noch keine Favoriten.</div>';
                    return;
                }

                const lang = localStorage.getItem('lang') || 'de';

                // Optionally enrich titles from audio_files if available
                if (window.db) {
                    await Promise.all(favArray.map(async (f) => {
                        const key = f.id;
                        if (!key || audioMetaCache[key]) return;
                        try {
                            const doc = await window.db.collection('audio_files').doc(key).get();
                            if (doc.exists) audioMetaCache[key] = doc.data();
                            else audioMetaCache[key] = null;
                        } catch(_) { audioMetaCache[key] = null; }
                    }));
                }

                // Auto-backfill missing localized titles into user's favorites if we have metadata
                if (window.db && currentUserId) {
                    const updatePayload = {};
                    favArray.forEach(f => {
                        const meta = audioMetaCache[f.id];
                        if (!meta) return;
                        if (!f.title_de && meta.title_de) updatePayload[`favorites.${f.id}.title_de`] = meta.title_de;
                        if (!f.title_en && meta.title_en) updatePayload[`favorites.${f.id}.title_en`] = meta.title_en;
                    });
                    if (Object.keys(updatePayload).length) {
                        try { await window.db.collection('User_Profiles').doc(currentUserId).update(updatePayload); } catch(_) {}
                    }
                }

                favArray.forEach(f => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.justifyContent = 'space-between';
                    row.style.padding = '10px 8px';
                    row.style.borderBottom = '1px solid #f0f0f0';
                    row.style.cursor = 'pointer';

                    const title = document.createElement('span');
                    const meta = audioMetaCache[f.id];
                    let localized = (meta && (meta[`title_${lang}`])) || f[`title_${lang}`];
                    if (!localized && f.titleKey && window.__i18n && window.__i18n.lang === lang && window.__i18n.dict) {
                        localized = window.__i18n.dict[f.titleKey] || localized;
                    }
                    title.textContent = localized || f.title || f.id || 'Unbenannter Track';

                    const play = document.createElement('img');
                    play.src = `${pathToRoot}assets/images/icons/play_icon_white_small.png`;
                    play.alt = 'Play';
                    play.style.width = '20px';
                    play.style.height = '20px';
                    row.appendChild(title);
                    row.appendChild(play);
                    row.addEventListener('click', () => {
                        if (!f.audioSrc) return;
                        const playerTitle = (localized || f.title || '');
                        const url = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(f.audioSrc)}&title=${encodeURIComponent(playerTitle)}&courseId=${encodeURIComponent(f.id || '')}`;
                        window.location.href = url;
                    });
                    listEl.appendChild(row);
                });
            };

            // Toggle drawer open/close
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
            });
            if (closeBtn) closeBtn.addEventListener('click', () => drawer.style.display = 'none');

            // Live subscribe to favorites
        if (window.auth && window.db) {
                window.auth.onAuthStateChanged(user => {
                    if (!user) { renderFavorites({}); return; }
            currentUserId = user.uid;
                    const ref = window.db.collection('User_Profiles').doc(user.uid);
                    ref.onSnapshot(async (doc) => {
                        const favs = doc.exists ? (doc.data().favorites || {}) : {};
                        await renderFavorites(favs);
                    });
                });
            }
                // Re-render list when language changes to show the appropriate localized title
            window.addEventListener('lang-changed', () => renderFavorites(latestFavs));
        }, 100);
    })();

    /**
     * Formats time in seconds to a "m:ss" format.
     * @param {number} seconds - The time in seconds.
     * @returns {string} The formatted time string.
     */
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

        const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
        const isYesterday = (date) => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return isSameDay(date, yesterday);
        };


    // 3.2. Page-Specific Logic
    // =================================================================================================
    // --- Index Page ---
    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
        document.querySelectorAll('.lang-button').forEach(button => {
            button.addEventListener('click', () => {
                localStorage.setItem('lang', button.getAttribute('data-lang'));
                window.location.href = `${pathToRoot}login.html`;
            });
        });
    }

    // --- Subcategory & Course Cards via Tiles module ---
    // Load Tiles module if the page contains any known tile elements, regardless of URL path
    const needTiles = (
        document.querySelector('.subcategory-card') ||
        document.querySelector('.subcategory-audiocard') ||
        document.querySelector('.course-card') ||
        document.querySelector('.category-card') ||
        path.includes('subcategories') ||
        path.includes('basics')
    );
    if (needTiles) {
        const script = document.createElement('script');
        script.src = `${pathToRoot}tiles.js`;
        script.onload = () => {
            if (window.Tiles) {
                window.Tiles.initSubcategoryCards();
                window.Tiles.initCourseCards();
                window.Tiles.initCategoryCards();
                window.Tiles.initSubcategoryAudioCards();
                // If accordion exists, ensure audiocard binding remains active
                if (typeof window.Tiles.initSubcategoryAudioAccordion === 'function') {
                    window.Tiles.initSubcategoryAudioAccordion();
                }
            }
        };
    script.onerror = () => { console.warn('tiles.js failed to load'); };
        document.head.appendChild(script);
    }

    // =================================================================================================
    // 4. --- Audio Player ---
    // =================================================================================================
    
    if (path.endsWith('player.html')) {
        const audioPlayer = document.getElementById('audio-player');
        const bgPlayer = document.getElementById('audio-player-bg');
        const bgMusicSelectionContainer = document.getElementById('bg-music-selection');
        const bgMusicNameEl = document.getElementById('bg-music-name');
        const favoriteIcon = document.querySelector('.player-container .favorite-icon');
        const musicModal = document.getElementById('music-modal');
        const openModalBtn = document.getElementById('open-music-modal');
        const closeModalBtn = musicModal.querySelector('.close-button');

        if(openModalBtn) openModalBtn.onclick = () => musicModal.style.display = 'block';
        if(closeModalBtn) closeModalBtn.onclick = () => musicModal.style.display = 'none';
        window.onclick = (event) => {
            if (event.target == musicModal) {
                musicModal.style.display = 'none';
            }
        }

        const setBgMusicName = (track) => {
            if (!bgMusicNameEl || !track) return;
            const title = (localStorage.getItem('lang') || 'de') === 'de' ? track.title_de : track.title_en;
            bgMusicNameEl.textContent = title || '';
        };

        // --- Favorites handling (Player) ---
        // Compute a stable favorite ID from the current audio source path
        function getFavoriteIdFromAudioSrc(src) {
            try {
                const parts = src.split('?')[0].split('#')[0].split('/');
                const file = parts[parts.length - 1] || '';
                const base = file.replace('.m4a', '');
                const idx = base.lastIndexOf('_');
                return idx > 0 ? base.substring(0, idx) : base; // trims trailing _de/_en
            } catch (_) { return ''; }
        }

        async function refreshFavoriteIcon() {
            if (!favoriteIcon || !db || !auth || !auth.currentUser || !audioPlayer || !audioPlayer.src) return;
            try {
                const favId = getFavoriteIdFromAudioSrc(audioPlayer.src);
                if (!favId) return;
                const userDoc = await db.collection('User_Profiles').doc(auth.currentUser.uid).get();
                const favs = (userDoc.exists && userDoc.data().favorites) || {};
                const isFav = !!favs[favId];
                favoriteIcon.src = `${pathToRoot}assets/images/icons/${isFav ? 'heart_active' : 'heart_inactive'}.png`;
            } catch (e) { /* ignore */ }
        }

        async function toggleFavorite() {
            if (!db || !auth || !auth.currentUser) {
                alert('Bitte einloggen, um Favoriten zu speichern.');
                return;
            }
            const userDocRef = db.collection('User_Profiles').doc(auth.currentUser.uid);
            const favId = getFavoriteIdFromAudioSrc(audioPlayer.src || '');
            if (!favId) return;
            try {
                const doc = await userDocRef.get();
                const favs = (doc.exists && doc.data().favorites) || {};
                if (favs[favId]) {
                    await userDocRef.update({ [`favorites.${favId}`]: firebase.firestore.FieldValue.delete() });
                } else {
                    const lang = localStorage.getItem('lang') || 'de';
                    const trackTitleEl = document.getElementById('track-title');
                    const currentTitle = (trackTitleEl?.textContent || '').trim();
                    const titleKey = trackTitleEl?.getAttribute('data-i18n') || '';
                    const merged = { ...(favs[favId] || {}), id: favId, title: currentTitle, audioSrc: (audioPlayer.src || '') };
                    merged[`title_${lang}`] = currentTitle || merged[`title_${lang}`] || merged.title || '';
                    if (titleKey) merged.titleKey = titleKey;
                    await userDocRef.update({ [`favorites.${favId}`]: merged });
                }
                refreshFavoriteIcon();
            } catch (e) {
                console.error('Favorite toggle failed', e);
            }
        }

        if (favoriteIcon) {
            favoriteIcon.addEventListener('click', toggleFavorite);
        }

        getBgMusicTracks().then(bgMusicTracks => {
            bgMusicSelectionContainer.innerHTML = ''; // Clear existing tiles
            bgMusicTracks.forEach(track => {
                const tile = document.createElement('div');
                tile.className = 'music-tile';
                tile.dataset.id = track.id;
                tile.dataset.path = track.path;
                if (track.image) {
                    tile.style.backgroundImage = `url(${pathToRoot}${track.image})`;
                } else {
                    tile.style.backgroundColor = '#ccc';
                }
                
                const title = lang === 'de' ? track.title_de : track.title_en;
                const titleSpan = document.createElement('span');
                titleSpan.textContent = title;
                tile.appendChild(titleSpan);

                bgMusicSelectionContainer.appendChild(tile);

                tile.addEventListener('click', () => {
                    // Update UI state
                    document.querySelectorAll('.music-tile').forEach(t => t.classList.remove('active'));
                    tile.classList.add('active');
                    if (musicModal) musicModal.style.display = 'none';
                    // Persist selection & update label
                    try { localStorage.setItem('bgMusicId', track.id); } catch(_) {}
                    setBgMusicName(track);

                    // Handle "none" (no background music)
                    if (!track.path) {
                        if (bgPlayer) {
                            try { bgPlayer.pause(); } catch(_) {}
                            bgPlayer.src = '';
                        }
                        return;
                    }

                    // Reset any running fade-out when switching tracks
                    if (typeof fadeOutInterval !== 'undefined' && fadeOutInterval) {
                        clearInterval(fadeOutInterval);
                        fadeOutInterval = null;
                    }

                    // Set new source and start playing immediately if main audio is playing
                    if (bgPlayer) {
                        const desiredTime = (audioPlayer && !isNaN(audioPlayer.currentTime)) ? audioPlayer.currentTime : 0;
                        const applyVolume = () => {
                            const volumeValue = bgVolumeSlider ? (bgVolumeSlider.value / 100) : (bgPlayer.volume || 0.5);
                            if (isIOS && typeof gainNode !== 'undefined' && gainNode) gainNode.gain.value = volumeValue;
                            else bgPlayer.volume = volumeValue;
                        };

                        const startBg = () => {
                            try { bgPlayer.currentTime = desiredTime; } catch(_) {}
                            applyVolume();
                            if (audioPlayer && !audioPlayer.paused) {
                                bgPlayer.play().catch(() => {});
                            }
                        };

                        bgPlayer.src = `${pathToRoot}${track.path}`;
                        if (bgPlayer.readyState >= 1) startBg();
                        else bgPlayer.addEventListener('loadedmetadata', startBg, { once: true });
                    }
                });
            });

            // Determine initial background music (stored selection -> preferred default -> fallback)
            const storedBgId = (() => { try { return localStorage.getItem('bgMusicId'); } catch(_) { return null; } })();
            let initialTrack = null;
            if (storedBgId) {
                initialTrack = bgMusicTracks.find(t => t.id === storedBgId) || null;
            }
            if (!initialTrack) {
                initialTrack = bgMusicTracks.find(t => t.id === 'birdparadise')
                    || bgMusicTracks.find(t => t.id !== 'none')
                    || bgMusicTracks[0];
            }
            if (initialTrack) {
                bgPlayer.src = initialTrack.path ? `${pathToRoot}${initialTrack.path}` : '';
                const initialTile = document.querySelector(`.music-tile[data-id="${initialTrack.id}"]`);
                if (initialTile) initialTile.classList.add('active');
                setBgMusicName(initialTrack);
            }
        });

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        let audioContext, gainNode, bgAudioSource;
        let isWebAudioInitialized = false;

        const playerContainer = document.querySelector('.player-container');
        const completionScreen = document.getElementById('session-complete-screen');
        const completionStats = document.getElementById('completion-stats');
        const backToOverviewBtn = document.getElementById('back-to-overview-btn');
        const playPauseBtn = document.getElementById('play-pause-btn');
        const rewindBtn = document.getElementById('rewind-btn');
        const forwardBtn = document.getElementById('forward-btn');
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const currentTimeSpan = document.getElementById('current-time');
        const durationSpan = document.getElementById('duration');
        const trackTitleElement = document.getElementById('track-title');
        const bgVolumeContainer = document.getElementById('bg-volume-container');
        const bgVolumeSlider = document.getElementById('bg-volume-slider');
        
    const urlParams = new URLSearchParams(window.location.search);
    const audioSrc = decodeURIComponent(urlParams.get('audio') || '');
    const trackTitle = decodeURIComponent(urlParams.get('title') || '');
    const titleKeyParam = urlParams.get('titleKey');
    const courseId = decodeURIComponent(urlParams.get('courseId') || '');
        const trackProgress = urlParams.get('trackProgress') === 'true';
        const isChallenge = urlParams.get('challenge') === 'true';

    if (audioSrc) audioPlayer.src = audioSrc;
    if (trackTitleElement) {
        if (titleKeyParam) {
            trackTitleElement.setAttribute('data-i18n', titleKeyParam);
            // Render via current translations if available
            const i18n = window.__i18n;
            const langCode = (localStorage.getItem('lang') || 'de');
            if (i18n && i18n.lang === langCode && i18n.dict && i18n.dict[titleKeyParam]) {
                trackTitleElement.textContent = i18n.dict[titleKeyParam];
            } else {
                // fallback to provided title if dict not ready
                trackTitleElement.textContent = trackTitle || '';
            }
        } else if (trackTitle) {
            trackTitleElement.textContent = trackTitle;
        }
    }
    // Initialize favorite icon state for the loaded track
    refreshFavoriteIcon();
        
        bgPlayer.loop = true;
        if (bgVolumeSlider && !isIOS) bgPlayer.volume = bgVolumeSlider.value / 100;
        if (bgVolumeContainer) bgVolumeContainer.style.display = 'flex';
        

        let sessionMarkedAsComplete = false;
        let fadeOutInterval = null;

        const startFadeOut = () => {
            if (!bgPlayer || fadeOutInterval) return;
            const fadeDuration = 10; // seconds
            const fadeSteps = 50;
            const interval = (fadeDuration * 1000) / fadeSteps;
            const getVolume = () => (isIOS && gainNode) ? gainNode.gain.value : bgPlayer.volume;
            const setVolume = (vol) => {
                if (isIOS && gainNode) gainNode.gain.value = vol;
                else bgPlayer.volume = vol;
            };
            const initialVolume = getVolume();
            const volumeStep = initialVolume / fadeSteps;
            fadeOutInterval = setInterval(() => {
                const newVolume = getVolume() - volumeStep;
                if (newVolume >= 0) {
                    setVolume(newVolume);
                } else {
                    setVolume(0);
                    bgPlayer.pause();
                    clearInterval(fadeOutInterval);
                }
            }, interval);
        };



        async function markSessionComplete() {
            const user = auth.currentUser;
            if (!user || !db) return;

            if(playerContainer) playerContainer.style.display = 'none';
            if(completionScreen) completionScreen.style.display = 'flex';

            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            // Course-specific progress tracking
            if (courseId && (trackProgress || isChallenge)) {
                const progressDocRef = db.collection('userCourses').doc(`${user.uid}_${courseId}`).collection('progress').doc(today);
                const progressDoc = await progressDocRef.get();

                if (!progressDoc.exists) {
                    await progressDocRef.set({
                        completedDate: firebase.firestore.FieldValue.serverTimestamp(),
                        duration: audioPlayer.duration
                    });

                    // Only update global stats if this is the first completion for this course today
                    const userDocRef = db.collection('User_Profiles').doc(user.uid);
                    try {
                        await db.runTransaction(async (transaction) => {
                            const userDoc = await transaction.get(userDocRef);
                            if (!userDoc.exists) return;
                            const userData = userDoc.data();
                            const currentSessions = userData.sessions || 0;
                            const currentStreak = userData.streak || 0;
                            const lastSessionDate = userData.lastSessionDate ? userData.lastSessionDate.toDate() : null;
                            const currentListeningTime = userData.listeningTime || 0;
                            let newStreak = (lastSessionDate && isSameDay(lastSessionDate, new Date())) ? currentStreak : (lastSessionDate && isYesterday(lastSessionDate)) ? currentStreak + 1 : 1;
                            const newSessions = currentSessions + 1;
                            const newLastSessionDate = new Date();
                            const newListeningTime = currentListeningTime + audioPlayer.duration;
                            transaction.update(userDocRef, { sessions: newSessions, streak: newStreak, lastSessionDate: newLastSessionDate, listeningTime: newListeningTime });
                            if(completionStats) completionStats.innerHTML = `<p>Sessions: ${newSessions}</p><p>Streak: ${newStreak} Tage</p>`;
                        });
                    } catch (error) {
                        console.error("Transaction failed: ", error);
                        if(completionStats) completionStats.innerHTML = "<p>Fehler beim Speichern.</p>";
                    }
                } else {
                    // Already completed today, just show stats without updating
                    const userDocRef = db.collection('User_Profiles').doc(user.uid);
                    const userDoc = await userDocRef.get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        if(completionStats) completionStats.innerHTML = `<p>Sessions: ${userData.sessions || 0}</p><p>Streak: ${userData.streak || 0} Tage</p>`;
                    }
                }
            } else {
                // Fallback for non-course audio - original behavior
                const userDocRef = db.collection('User_Profiles').doc(user.uid);
                try {
                    await db.runTransaction(async (transaction) => {
                        const userDoc = await transaction.get(userDocRef);
                        if (!userDoc.exists) return;
                        const userData = userDoc.data();
                        const currentSessions = userData.sessions || 0;
                        const currentStreak = userData.streak || 0;
                        const lastSessionDate = userData.lastSessionDate ? userData.lastSessionDate.toDate() : null;
                        const currentListeningTime = userData.listeningTime || 0;
                        let newStreak = (lastSessionDate && isSameDay(lastSessionDate, new Date())) ? currentStreak : (lastSessionDate && isYesterday(lastSessionDate)) ? currentStreak + 1 : 1;
                        const newSessions = currentSessions + 1;
                        const newLastSessionDate = new Date();
                        const newListeningTime = currentListeningTime + audioPlayer.duration;
                        transaction.update(userDocRef, { sessions: newSessions, streak: newStreak, lastSessionDate: newLastSessionDate, listeningTime: newListeningTime });
                        if(completionStats) completionStats.innerHTML = `<p>Sessions: ${newSessions}</p><p>Streak: ${newStreak} Tage</p>`;
                    });
                } catch (error) {
                    console.error("Transaction failed: ", error);
                    if(completionStats) completionStats.innerHTML = "<p>Fehler beim Speichern.</p>";
                }
            }
            // Challenge day recording (if in challenge mode) after handling course stats
            if (isChallenge && window.Challenge && typeof window.Challenge.recordCompletion === 'function') {
                try { await window.Challenge.recordCompletion(audioPlayer.duration || 0); } catch(e){ console.warn('Challenge record failed', e); }
            }
        }

        if(playPauseBtn) playPauseBtn.addEventListener('click', () => audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause());
        audioPlayer.addEventListener('play', () => {
            if (isIOS && !isWebAudioInitialized && bgPlayer.src) {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    gainNode = audioContext.createGain();
                    bgAudioSource = audioContext.createMediaElementSource(bgPlayer);
                    bgAudioSource.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                }
                if (bgVolumeSlider) gainNode.gain.value = bgVolumeSlider.value / 100;
                isWebAudioInitialized = true;
            }
            if (bgPlayer.src) {
                bgPlayer.currentTime = audioPlayer.currentTime;
                bgPlayer.play();
            }
            playPauseBtn.src = `${pathToRoot}assets/images/icons/pause_icon_black.png`;
        });
        audioPlayer.addEventListener('pause', () => {
            if (bgPlayer.src) bgPlayer.pause();
            playPauseBtn.src = `${pathToRoot}assets/images/icons/play_icon_black.png`;
        });
        if(rewindBtn) rewindBtn.addEventListener('click', () => { audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 15); });
        if(forwardBtn) forwardBtn.addEventListener('click', () => { audioPlayer.currentTime += 15; });
        audioPlayer.addEventListener('timeupdate', () => {
            if (audioPlayer.duration) {
                const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                if(progressBar) progressBar.style.width = `${progress}%`;
                if(currentTimeSpan) currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
                if (bgPlayer.src && (audioPlayer.duration - audioPlayer.currentTime) <= 10) startFadeOut();
                if (progress >= 95 && !sessionMarkedAsComplete) {
                    sessionMarkedAsComplete = true;
                    markSessionComplete();
                }
            }
        });
        audioPlayer.addEventListener('seeking', () => { if (bgPlayer.src) bgPlayer.currentTime = audioPlayer.currentTime; });
        audioPlayer.addEventListener('loadedmetadata', () => {
            if(durationSpan) durationSpan.textContent = formatTime(audioPlayer.duration);
            refreshFavoriteIcon();
        });
        if (bgVolumeSlider) bgVolumeSlider.addEventListener('input', (e) => {
            const volumeValue = e.target.value / 100;
            if (isIOS && gainNode) gainNode.gain.value = volumeValue;
            else if (bgPlayer) bgPlayer.volume = volumeValue;
        });
        if (backToOverviewBtn) backToOverviewBtn.addEventListener('click', () => { window.location.href = 'categories.html'; });
        
        let isDragging = false;
        const handleDrag = (e) => {
            if (!isDragging || !audioPlayer.duration) return;
            if (e.type.startsWith('touch')) e.preventDefault();
            const rect = progressContainer.getBoundingClientRect();
            const clickX = (e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX) - rect.left;
            const progress = Math.max(0, Math.min(clickX / progressContainer.clientWidth, 1));
            audioPlayer.currentTime = progress * audioPlayer.duration;
        };
        if(progressContainer) {
            progressContainer.addEventListener('mousedown', () => isDragging = true);
            document.addEventListener('mouseup', () => isDragging = false);
            document.addEventListener('mousemove', handleDrag);
            progressContainer.addEventListener('touchstart', () => isDragging = true, { passive: false });
            document.addEventListener('touchend', () => isDragging = false);
            document.addEventListener('touchmove', handleDrag, { passive: false });
            progressContainer.addEventListener('click', handleDrag);
        }
    }

    // --- Registration Page ---
    if (path.endsWith('register.html')) {
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const passwordInput = document.getElementById('password');
                const passwordConfirmInput = document.getElementById('password-confirm');
                const passwordErrorMessage = document.getElementById('password-error-message');
                if (passwordInput.value !== passwordConfirmInput.value) {
                    passwordErrorMessage.style.display = 'block';
                    return;
                }
                passwordErrorMessage.style.display = 'none';
                const email = document.getElementById('email').value;
                const password = passwordInput.value;
                if (!email || !password || password.length < 6) {
                    alert('Bitte E-Mail und ein Passwort mit mind. 6 Zeichen eingeben.');
                    return;
                }
                auth.createUserWithEmailAndPassword(email, password)
                    .then(cred => {
                        const userProfileData = {
                            uid: cred.user.uid, email: cred.user.email,
                            firstName: document.getElementById('firstName').value, lastName: document.getElementById('lastName').value,
                            street: document.getElementById('street').value, zipCode: document.getElementById('zipCode').value,
                            city: document.getElementById('city').value, country: document.getElementById('country').value,
                            birthdate: document.getElementById('birthdate').value, mobile: document.getElementById('mobile').value,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            listeningTime: 0, sessions: 0, streak: 0, lastSessionDate: null, unlockedBadges: []
                        };
                        return db.collection('User_Profiles').doc(cred.user.uid).set(userProfileData);
                    })
                    .then(() => { window.location.href = `${pathToRoot}registration_success.html`; })
                    .catch((err) => {
                        console.error("Registration Error:", err);
                        alert("Fehler bei der Registrierung: " + err.message);
                        window.location.href = `${pathToRoot}registration_error.html`; 
                    });
            });
        }
    }

    // --- Login & Password Reset Pages ---
    if (auth && db && storage) {
        if (path.endsWith('login.html')) {
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;
                    if (!email || !password) return alert('Bitte E-Mail und Passwort eingeben.');
                    auth.signInWithEmailAndPassword(email, password)
                        .then(() => { window.location.href = `${pathToRoot}structure/categories.html`; })
                        .catch(() => { window.location.href = `${pathToRoot}login_error.html`; });
                });
            }
            const forgotPasswordLink = document.getElementById('forgot-password-link');
            if (forgotPasswordLink) {
                forgotPasswordLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const email = document.getElementById('email').value;
                    if (!email) {
                        alert('Bitte geben Sie Ihre E-Mail-Adresse in das E-Mail-Feld ein, um Ihr Passwort zurückzusetzen.');
                        return;
                    }
                    auth.sendPasswordResetEmail(email)
                        .then(() => { alert('Eine E-Mail zum Zurücksetzen des Passworts wurde an ' + email + ' gesendet. Bitte überprüfen Sie Ihren Posteingang.'); })
                        .catch((error) => { 
                            console.error('Error sending password reset email:', error);
                            alert('Fehler beim Senden der E-Mail: ' + error.message);
                        });
                });
            }
        }
        if (path.endsWith('password_reset.html')) {
            const resetBtn = document.getElementById('reset-password-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const email = document.getElementById('email-reset').value;
                    if (!email) return alert('Bitte E-Mail-Adresse eingeben.');
                    auth.sendPasswordResetEmail(email)
                        .then(() => {
                            alert('Link zum Zurücksetzen des Passworts wurde gesendet.');
                            window.location.href = `${pathToRoot}login.html`;
                        })
                        .catch(err => { alert('Fehler: ' + err.message); });
                });
            }
        }
    }

    // --- Profile Page ---
    if (path.endsWith('profile.html')) {
        const logoutButton = document.getElementById('logout-btn');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                if (confirm("Möchten Sie sich wirklich ausloggen?")) {
                    auth.signOut().then(() => { window.location.href = `${pathToRoot}login.html`; })
                        .catch(err => { console.error("Logout error:", err); alert("Fehler beim Ausloggen."); });
                }
            });
        }

        const languageSwitcher = document.getElementById('language-switcher');
        if (languageSwitcher) {
            const langIcon = document.getElementById('language-icon');
            const langName = document.getElementById('language-name');
            const currentLang = localStorage.getItem('lang') || 'de';
            const updateLangDisplay = (lang) => {
                if (lang === 'de') {
                    langIcon.src = '../assets/images/icons/english.png';
                    langName.textContent = 'English';
                } else {
                    langIcon.src = '../assets/images/icons/german.png';
                    langName.textContent = 'Deutsch';
                }
            };
            updateLangDisplay(currentLang);
            languageSwitcher.addEventListener('click', () => {
                const newLang = (localStorage.getItem('lang') || 'de') === 'de' ? 'en' : 'de';
                localStorage.setItem('lang', newLang);
                updateLangDisplay(newLang);
                    loadTranslations(newLang);
                    try { window.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang: newLang } })); } catch(_) {}
            });
        }

        auth.onAuthStateChanged(user => {
            if (user) {
                const resetFavBtn = document.getElementById('reset-favorites-btn');
                if (resetFavBtn) {
                    resetFavBtn.addEventListener('click', async () => {
                        if (!auth.currentUser || !db) return alert('Login erforderlich.');
                        if (!confirm('Favoritenliste wirklich löschen?')) return;
                        try {
                            await db.collection('User_Profiles').doc(auth.currentUser.uid).update({ favorites: {} });
                            alert('Favoriten zurückgesetzt.');
                            try { window.dispatchEvent(new CustomEvent('favorites-reset')); } catch(_) {}
                        } catch (e) {
                            console.error('Favoriten-Reset fehlgeschlagen:', e);
                            alert('Fehler beim Zurücksetzen.');
                        }
                    });
                }
                const userDocRef = db.collection('User_Profiles').doc(user.uid);
                const profileAvatarImg = document.getElementById('profile-avatar-img');
                const profileImageUpload = document.getElementById('profile-image-upload');

                userDocRef.get().then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        const profileUsername = document.querySelector('.profile-info h2');
                        if (profileUsername) {
                            const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                            profileUsername.textContent = fullName || 'Unbekannter Nutzer';
                        }
                        const profileEmail = document.querySelector('.profile-info p');
                        if(profileEmail) profileEmail.textContent = userData.email;
                        if (userData.profileImageUrl) {
                            profileAvatarImg.src = userData.profileImageUrl;
                        } else {
                            profileAvatarImg.src = '../assets/images/profile_img.jpg';
                        }
                        const statsSessions = document.getElementById('stats-sessions');
                        const statsListeningTime = document.getElementById('stats-listening-time');
                        const statsStreak = document.getElementById('stats-streak');
                        if (statsSessions) statsSessions.textContent = userData.sessions || 0;
                        if (statsListeningTime) {
                            const listeningTimeInSeconds = userData.listeningTime || 0;
                            const hours = Math.floor(listeningTimeInSeconds / 3600);
                            const minutes = Math.floor((listeningTimeInSeconds % 3600) / 60);
                            statsListeningTime.textContent = `${hours}h ${minutes}m`;
                        }
                        if (statsStreak) statsStreak.textContent = userData.streak || 0;

                        const editProfileButton = document.querySelector('[data-i18n="profile_settings_edit_profile"]');
                        if (editProfileButton) {
                            editProfileButton.parentElement.addEventListener('click', () => {
                                const currentName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                                const newName = prompt("Geben Sie Ihren neuen Vor- und Nachnamen ein:", currentName);
                                if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
                                    const nameParts = newName.trim().split(' ');
                                    const firstName = nameParts.shift() || '';
                                    const lastName = nameParts.join(' ');
                                    userDocRef.update({ firstName: firstName, lastName: lastName })
                                        .then(() => { if(profileUsername) profileUsername.textContent = newName.trim(); alert("Name erfolgreich aktualisiert!"); })
                                        .catch(err => alert("Fehler: " + err.message));
                                }
                            });
                        }
                        const changePasswordButton = document.querySelector('[data-i18n="profile_settings_change_password"]');
                        if (changePasswordButton) {
                            changePasswordButton.parentElement.addEventListener('click', () => {
                                if (confirm("Eine E-Mail zum Zurücksetzen des Passworts wird an " + user.email + " gesendet. Fortfahren?")) {
                                    auth.sendPasswordResetEmail(user.email)
                                        .then(() => { alert("E-Mail wurde versendet."); })
                                        .catch((error) => { alert("Fehler beim Senden der E-Mail: " + error.message); });
                                }
                            });
                        }
                    }
                });

                if (profileAvatarImg) profileAvatarImg.addEventListener('click', () => { if (profileImageUpload) profileImageUpload.click(); });
                if (profileImageUpload) {
                    profileImageUpload.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        alert("Profilbild wird hochgeladen...");
                        const storageRef = storage.ref(`profile_images/${user.uid}`);
                        const uploadTask = storageRef.put(file);
                        uploadTask.on('state_changed', 
                            (snapshot) => console.log('Upload is ' + (snapshot.bytesTransferred / snapshot.totalBytes) * 100 + '% done'), 
                            (error) => { console.error("Upload error:", error); alert("Fehler beim Hochladen des Bildes."); }, 
                            () => {
                                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                                    profileAvatarImg.src = downloadURL;
                                    userDocRef.update({ profileImageUrl: downloadURL })
                                        .then(() => alert("Profilbild erfolgreich aktualisiert!"))
                                        .catch(err => { console.error("Error updating Firestore:", err); alert("Fehler beim Speichern des Bild-Links."); });
                                });
                            }
                        );
                    });
                }
            }
        });
    }

    // --- "For You" Section ---
    if (path.endsWith('categories.html')) {
        const forYouResultsContainer = document.getElementById('for-you-results');
        const moodButtons = document.querySelectorAll('.mood-button');

        function addResultCardListeners() {
            document.querySelectorAll('#for-you-results .result-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    const audioPath = e.currentTarget.dataset.audioPath;
                    const title = e.currentTarget.dataset.title;
                    if (audioPath && title) {
                        window.location.href = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioPath)}&title=${encodeURIComponent(title)}`;
                    }
                });
            });
        }

        function renderForYouResults(tracks) {
            forYouResultsContainer.innerHTML = '';
            if (tracks.length === 0) return;
            const section = document.createElement('div');
            section.className = 'for-you-section';
            const header = document.createElement('h4');
            header.setAttribute('data-i18n', 'forYouSuggestions');
            header.textContent = 'Deine Vorschläge';
            section.appendChild(header);

            tracks.forEach(track => {
                const lang = localStorage.getItem('lang') || 'de';
                const title = track[`title_${lang}`] || track.title_de || 'Unbenannter Track';
                const filename_from_db = track.path;
                let audioPath = '';
                if (filename_from_db) {
                    const filename_base = filename_from_db.split('.')[0];
                    audioPath = `${pathToRoot}assets/audio/subcategories/${lang}/${filename_base}.m4a`;
                }
                if (!audioPath) return;
                const card = document.createElement('div');
                card.className = 'result-card';
                card.dataset.audioPath = audioPath;
                card.dataset.title = title;
                const titleSpan = document.createElement('span');
                titleSpan.className = 'result-card-title';
                titleSpan.textContent = title;
                const playImg = document.createElement('img');
                playImg.className = 'result-card-play-icon';
                playImg.src = `${pathToRoot}assets/images/icons/play_icon_white.png`;
                playImg.alt = 'Play';
                card.appendChild(titleSpan);
                card.appendChild(playImg);
                section.appendChild(card);
            });
            forYouResultsContainer.appendChild(section);
            loadTranslations(localStorage.getItem('lang') || 'de');
            addResultCardListeners();
        }

        moodButtons.forEach(button => {
            button.addEventListener('click', () => {
                const selectedTag = button.getAttribute('data-tag');
                if (button.classList.contains('active')) {
                    button.classList.remove('active');
                    forYouResultsContainer.innerHTML = '';
                    return;
                }
                moodButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                forYouResultsContainer.innerHTML = `<div class="for-you-section"><p data-i18n="loading">Lädt Vorschläge...</p></div>`;
                loadTranslations(localStorage.getItem('lang') || 'de');
                db.collection('audio_files').where('tags', 'array-contains', selectedTag).limit(3).get()
                    .then(snapshot => {
                        const tracks = [];
                        snapshot.forEach(doc => tracks.push({ id: doc.id, ...doc.data() }));
                        if (tracks.length === 0) {
                             forYouResultsContainer.innerHTML = `<div class="for-you-section"><p data-i18n="noResults">Keine passenden Übungen gefunden.</p></div>`;
                             loadTranslations(localStorage.getItem('lang') || 'de');
                        } else {
                            renderForYouResults(tracks);
                        }
                    })
                    .catch(error => {
                        console.error("Error fetching 'For You' tracks:", error);
                        forYouResultsContainer.innerHTML = `<div class="for-you-section"><p data-i18n="error">Fehler beim Laden der Übungen.</p></div>`;
                        loadTranslations(localStorage.getItem('lang') || 'de');
                    });
            });
        });
    }
});