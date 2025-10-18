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
    // Notify dynamic components (player explanation, for-you cards, etc.)
    try { window.dispatchEvent(new Event('languageChanged')); } catch(_) {}
    try { window.dispatchEvent(new Event('lang-changed')); } catch(_) {}
    } catch (error) {
        console.error('Translation Error:', error);
    }
}

// 1.3. Background Music Configuration (removed)
// Runtime background-music selection and mixing have been removed. Premixed files will be used instead.

// 1.4. Subscription helper (global)
/**
 * Returns true if the current user has an active subscription (and not expired), else false.
 * Safe to call on any page. Does not show UI or redirect by itself.
 */
async function hasActiveSubscription() {
    try {
        const user = (window.auth && window.auth.currentUser) ? window.auth.currentUser : null;
        if (!user || !window.db) return false;
        const doc = await window.db.collection('User_Profiles').doc(user.uid).get();
        if (!doc.exists) return false;
        const data = doc.data() || {};
        const sub = data.subscription || {};
        if (sub.active === true) {
            if (sub.expiresAt && typeof sub.expiresAt.toDate === 'function') {
                return sub.expiresAt.toDate() >= new Date();
            }
            return true;
        }
    } catch(_) {}
    return false;
}
try { window.hasActiveSubscription = hasActiveSubscription; } catch(_) {}

// 1.5. Paywall UI + access helpers (global)
function createPaywallOverlay() {
        if (document.getElementById('paywall-overlay')) return document.getElementById('paywall-overlay');
        const wrap = document.createElement('div');
        wrap.id = 'paywall-overlay';
        wrap.style.position = 'fixed';
        wrap.style.inset = '0';
        wrap.style.background = 'rgba(0,0,0,0.72)';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        wrap.style.zIndex = '9999';
        wrap.innerHTML = `
            <div style="max-width:480px;width:90%;background:#ffffff;border-radius:18px;padding:28px 26px;font-family:inherit;position:relative;box-shadow:0 10px 28px rgba(0,0,0,0.35);">
                <button id="paywall-close" aria-label="close" style="position:absolute;top:8px;right:10px;background:transparent;border:none;font-size:20px;line-height:1;cursor:pointer;color:#555">×</button>
                <h2 data-i18n="paywall_headline" style="margin:0 0 10px 0;font-size:22px;line-height:1.25;text-align:center;">Freischalten erforderlich</h2>
                <p data-i18n="paywall_intro" style="font-size:14px;line-height:1.5;margin:0 0 18px 0;text-align:center;">Dieser Bereich ist exklusiv für Abonnenten verfügbar.</p>
                <ul style="list-style:none;padding:0;margin:0 0 18px 0;font-size:14px;line-height:1.45;color:#222;">
                    <li style="display:flex;gap:8px;margin-bottom:6px;">✅ <span data-i18n="paywall_point1">Exklusive Bonus-Audios</span></li>
                    <li style="display:flex;gap:8px;margin-bottom:6px;">✅ <span data-i18n="paywall_point2">Regelmäßige neue Inhalte</span></li>
                    <li style="display:flex;gap:8px;margin-bottom:6px;">✅ <span data-i18n="paywall_point3">Alle Grund- & Aufbauübungen ohne Limit</span></li>
                </ul>
                <div style="text-align:center;margin-bottom:16px;">
                    <span data-i18n="paywall_price_hint" style="font-size:13px;color:#555;">Ab nur XX,XX € / Monat</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <button id="paywall-checkout" data-i18n="paywall_cta" style="background:#3b5bdb;color:#fff;border:none;padding:14px 18px;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;">Jetzt freischalten</button>
                    <button id="paywall-login" data-i18n="paywall_login" style="background:#eceff4;color:#222;border:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;">Ich habe schon ein Abo</button>
                </div>
                <p data-i18n="paywall_privacy" style="margin:14px 0 0 0;font-size:11px;line-height:1.4;color:#666;text-align:center;">Zahlung über sicheren externen Anbieter.</p>
            </div>`;
        document.body.appendChild(wrap);
        // apply i18n for newly added nodes
        try { loadTranslations(localStorage.getItem('lang') || 'de'); } catch(_) {}
        wrap.querySelector('#paywall-close')?.addEventListener('click', ()=> wrap.remove());
        wrap.addEventListener('click', (ev)=> { if(ev.target === wrap) wrap.remove(); });
        const checkoutBtn = wrap.querySelector('#paywall-checkout');
        const loginBtn = wrap.querySelector('#paywall-login');
        if (checkoutBtn) checkoutBtn.addEventListener('click', startCheckoutFlow);
        if (loginBtn) loginBtn.addEventListener('click', refreshSubscriptionAndRetry);
        return wrap;
}

function startCheckoutFlow(){
        const user = (window.auth && window.auth.currentUser) ? window.auth.currentUser : null;
        if(!user){
                window.location.href = `${pathToRoot}login.html`;
                return;
        }
        const baseUrl = 'https://www.checkout-ds24.com/product/639653';
        const url = `${baseUrl}?email=${encodeURIComponent(user.email)}&custom_uid=${encodeURIComponent(user.uid)}`;
        window.open(url, '_blank');
}

async function refreshSubscriptionAndRetry(){
        try {
                const ok = await hasActiveSubscription();
                if (ok) document.getElementById('paywall-overlay')?.remove();
        } catch(_) {}
}

async function ensureSubscriptionAccess(opts){
    // opts: { onAllowed?: fn, onBlocked?: fn, redirectTo?: string }
    const user = (window.auth && window.auth.currentUser) ? window.auth.currentUser : null;
    const buyUrl = (opts && opts.redirectTo) || `${pathToRoot}structure/store/abo-buy-2025-uiiuZZTtg8io.html`;
    if(!user){
        if (opts && typeof opts.onBlocked === 'function') opts.onBlocked();
        try { window.location.href = buyUrl; } catch(_) {}
        return false;
    }
    const ok = await hasActiveSubscription();
    if (ok) {
        if (opts && typeof opts.onAllowed === 'function') opts.onAllowed();
        return true;
    }
    if (opts && typeof opts.onBlocked === 'function') opts.onBlocked();
    try { window.location.href = buyUrl; } catch(_) {}
    return false;
}
try {
        window.createPaywallOverlay = createPaywallOverlay;
        window.ensureSubscriptionAccess = ensureSubscriptionAccess;
        window.startCheckoutFlow = startCheckoutFlow;
} catch(_) {}


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

    // 3.1.a Global auto-binding: guard elements that require subscription
    (function autoBindSubscriptionGuards(){
        const bindOne = (el) => {
            if (el.__paywallBound) return;
            el.__paywallBound = true;
            el.addEventListener('click', async (e) => {
                // If a nested element handled it already, ignore
                if (e.defaultPrevented) return;
                const allowHref = el.getAttribute('data-allow-href') || '';
                const ok = await (window.ensureSubscriptionAccess ? window.ensureSubscriptionAccess({}) : Promise.resolve(false));
                if (ok) {
                    if (allowHref) window.location.href = allowHref;
                } else {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { capture: true });
        };
        document.querySelectorAll('[data-require-subscription]')
            .forEach(bindOne);
        // Observe late-added nodes (e.g., content injection)
        const mo = new MutationObserver((muts) => {
            for (const m of muts) {
                m.addedNodes && m.addedNodes.forEach(node => {
                    if (!(node instanceof Element)) return;
                    if (node.matches && node.matches('[data-require-subscription]')) bindOne(node);
                    node.querySelectorAll && node.querySelectorAll('[data-require-subscription]').forEach(bindOne);
                });
            }
        });
        try { mo.observe(document.body, { childList: true, subtree: true }); } catch(_) {}
    })();


    // =================================================================================================
    //                  --- Favorite Drawer in Footer Menu ---
    // =================================================================================================

    // Initialize Favorites Drawer in footer (footer HTML is injected via fetch and scripts there don't run)
    (function initFooterFavoritesDrawer() {
        const MAX_TRIES = 50;
        let tries = 0;
        const interval = setInterval(() => {
            tries++;
            const btn = document.getElementById('footer-favorites-btn');
            const backBtn = document.getElementById('footer-back-btn');
            const drawer = document.getElementById('favorites-drawer');
            const closeBtn = document.getElementById('favorites-drawer-close');
            const listEl = document.getElementById('favorites-list');
            const helpTab = document.getElementById('help-tab');
            const helpWrap = document.getElementById('help-wrap');
            const helpPanel = document.getElementById('help-panel');
            const helpCloseBtn = document.getElementById('help-close-btn');
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
                // Ensure container styles support multi-line rows consistently
                listEl.style.overflowY = 'auto';
                listEl.style.padding = '8px 10px';
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

                // Helper: derive i18n key from favorite (titleKey -> id -> filename from audioSrc)
                const deriveKey = (f) => {
                    if (f && f.titleKey) return f.titleKey;
                    if (f && f.id && /^[A-Za-z0-9_]+$/.test(f.id)) return f.id;
                    if (f && f.audioSrc) {
                        const last = f.audioSrc.split('/').pop() || '';
                        let base = last.replace(/\.m4a$/i, '');
                        base = base.replace(/_(de|en)$/i, '');
                        return base;
                    }
                    return '';
                };

                // Auto-backfill missing localized titles and titleKey into user's favorites if we have metadata
                if (window.db && currentUserId) {
                    const updatePayload = {};
                    favArray.forEach(f => {
                        const meta = audioMetaCache[f.id];
                        if (!meta) return;
                        if (!f.title_de && meta.title_de) updatePayload[`favorites.${f.id}.title_de`] = meta.title_de;
                        if (!f.title_en && meta.title_en) updatePayload[`favorites.${f.id}.title_en`] = meta.title_en;
                        const dk = deriveKey(f);
                        if (!f.titleKey && dk) updatePayload[`favorites.${f.id}.titleKey`] = dk;
                    });
                    if (Object.keys(updatePayload).length) {
                        try { await window.db.collection('User_Profiles').doc(currentUserId).update(updatePayload); } catch(_) {}
                    }
                }

                // Sort by localized title for a stable order per language
                const dict = (window.__i18n && window.__i18n.lang === lang) ? (window.__i18n.dict || null) : null;
                const localizedTitle = (f) => {
                    const meta = audioMetaCache[f.id];
                    let text = (meta && (meta[`title_${lang}`])) || f[`title_${lang}`];
                    const keyFromFav = deriveKey(f);
                    if (!text && dict && keyFromFav && dict[keyFromFav]) text = dict[keyFromFav];
                    return text || f.title || f.id || 'Unbenannter Track';
                };
                favArray.sort((a, b) => localizedTitle(a).localeCompare(localizedTitle(b)));

                favArray.forEach((f, idx) => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'flex-start';
                    row.style.justifyContent = 'space-between';
                    row.style.padding = '10px 8px';
                    // Keep bottom border even on last item to preserve visual height consistency
                    row.style.borderBottom = '1px solid #f0f0f0';
                    // Ensure rows can grow for multiline titles and still be tappable
                    row.style.minHeight = '36px';
                    row.style.cursor = 'pointer';

                    const title = document.createElement('span');
                    // Ensure multi-line titles render fully on mobile
                    title.style.display = 'block';
                    title.style.lineHeight = '1.3';
                    title.style.whiteSpace = 'normal';
                    title.style.wordBreak = 'break-word';
                    title.style.overflowWrap = 'anywhere';
                    title.style.flex = '1 1 auto';
                    title.style.paddingRight = '8px';
                    const meta = audioMetaCache[f.id];
                    const keyFromFav = deriveKey(f);
                    // Prefer dictionary (i18n) first so HTML like <br> is honored; then metadata; then stored titles
                    let localized = '';
                    if (dict && keyFromFav && dict[keyFromFav]) {
                        localized = dict[keyFromFav];
                    } else if (meta && meta[`title_${lang}`]) {
                        localized = meta[`title_${lang}`];
                    } else if (f[`title_${lang}`]) {
                        localized = f[`title_${lang}`];
                    } else {
                        localized = f.title;
                    }
                    // Allow HTML tags in labels
                    title.innerHTML = localized || f.title || f.id || 'Unbenannter Track';

                    const play = document.createElement('img');
                    play.src = `${pathToRoot}assets/images/icons/play_icon_white_small.png`;
                    play.alt = 'Play';
                    play.style.width = '20px';
                    play.style.height = '20px';
                    row.appendChild(title);
                    row.appendChild(play);
                    row.addEventListener('click', () => {
                        if (!f.audioSrc) return;
                        // Strip HTML for the player title
                        const plainTitle = (localized || f.title || '').replace(/<[^>]*>/g, '');
                        // Normalize older stored paths like genanxiety_01_01_de.m4a -> genanxiety_01_01.m4a
                        const normalizedSrc = f.audioSrc.replace(/_(de|en)\.m4a$/, '.m4a');
                        let url = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(normalizedSrc)}&title=${encodeURIComponent(plainTitle)}&courseId=${encodeURIComponent(f.id || '')}`;
                        const keyParam = keyFromFav;
                        if (keyParam) url += `&titleKey=${encodeURIComponent(keyParam)}`;
                        window.location.href = url;
                    });
                    listEl.appendChild(row);
                });
            };


    // =================================================================================================
    //             --- Back-Button Logik ---
    // =================================================================================================

            // Central Back Navigation: history-first, then logical fallbacks
            const navigateBack = () => {
                const ref = document.referrer || '';
                const cameFromPlayer = /\/structure\/player\.html(\?|#|$)/.test(ref) || /player\.html(\?|#|$)/.test(ref);
                const canGoBack = window.history && window.history.length > 1 && !cameFromPlayer;
                if (canGoBack) {
                    window.history.back();
                    return;
                }
                // Map detail/leaf pages to their nearest overview; default to categories
                const path = window.location.pathname;
                const toOverview = () => { window.location.href = `${pathToRoot}structure/categories.html`; };
                if (/\/structure\/anxiety\//.test(path)) {
                    // All anxiety detail pages → anxiety overview
                    window.location.href = `${pathToRoot}structure/subcategories/subcat03_anxiety.html`;
                } else if (/\/structure\/basics\//.test(path)) {
                    // Basics detail pages → basics overview or categories
                    window.location.href = `${pathToRoot}structure/subcategories/subcat02_basics.html`;
                } else if (/\/structure\/subcategories\//.test(path)) {
                    // If already on an overview, go to categories
                    toOverview();
                } else if (/\/structure\/player\.html$/.test(path)) {
                    // Player → categories to avoid bounce
                    toOverview();
                } else {
                    toOverview();
                }
            };

            // Bind Back button in footer if present
            if (backBtn) {
                backBtn.addEventListener('click', (e) => { e.preventDefault(); navigateBack(); });
            }

            // Emergency panel interactions
            const openHelp = () => {
                if (!helpWrap) return;
                helpWrap.style.right = 'auto';
                helpWrap.style.left = '50%';
                helpWrap.style.transform = 'translate(-50%, -50%)';
            };
            const closeHelp = () => {
                if (!helpWrap) return;
                helpWrap.style.left = '';
                helpWrap.style.right = '0';
                helpWrap.style.transform = 'translate(calc(100% - 28px), -50%)';
            };
            if (helpTab) helpTab.addEventListener('click', (e) => { e.preventDefault(); openHelp(); });
            if (helpCloseBtn) helpCloseBtn.addEventListener('click', (e) => { e.preventDefault(); closeHelp(); });

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
            // Re-render slightly delayed so async loadTranslations has time to set window.__i18n
            window.addEventListener('lang-changed', () => setTimeout(() => renderFavorites(latestFavs), 150));
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
        const favoriteIcon = document.querySelector('.player-container .favorite-icon');
    const loadingIndicator = document.getElementById('audio-loading-indicator');

        // --- Favorites handling (Player) ---
        // Compute a stable favorite ID from the current audio source path
        function getFavoriteIdFromAudioSrc(src) {
            try {
                const clean = decodeURIComponent((src || '').split('?')[0].split('#')[0]);
                const file = clean.substring(clean.lastIndexOf('/') + 1);
                let base = file.replace(/\.m4a$/i, '');
                // Backward-compat: strip only a language suffix exactly at the end
                base = base.replace(/_(de|en)$/i, '');
                return base;
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

        // Keep heart icon in sync with user favorites while on the player page
        if (auth && db) {
            auth.onAuthStateChanged(user => {
                if (!user) return;
                db.collection('User_Profiles').doc(user.uid)
                    .onSnapshot(() => { refreshFavoriteIcon(); });
            });
        }

    // Background music selection and playback removed; using single premixed audio per track.

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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
    // Playback flags
    let userInitiatedPlayAt = 0;

        const tryResumeMainAudio = () => {
            if (audioPlayer.ended) return;
            const p = audioPlayer.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        };
        
    const urlParams = new URLSearchParams(window.location.search);
    const audioSrc = decodeURIComponent(urlParams.get('audio') || '');
    const trackTitle = decodeURIComponent(urlParams.get('title') || '');
    const titleKeyParam = urlParams.get('titleKey');
    const courseId = decodeURIComponent(urlParams.get('courseId') || '');
        const trackProgress = urlParams.get('trackProgress') === 'true';
        const isChallenge = urlParams.get('challenge') === 'true';

    if (audioSrc) {
        try {
            audioPlayer.src = new URL(audioSrc, window.location.href).href;
        } catch (_) {
            audioPlayer.src = audioSrc;
        }
            // Show loading indicator early for potentially large files
            if (loadingIndicator) loadingIndicator.style.display = 'block';
    }
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
    // --- Dynamic Panel Explanation Text ---
    // panel-text element shows a short explanation specific to the current exercise.
    // Key pattern: <audioBaseName>-text (e.g., basics_01_01-text)
    // Fallback: the generic 'panelText' key already on the element.
    (function applyPanelExplanation(){
        const panelEl = document.querySelector('.panel-text');
        if(!panelEl) return;
        // Prefer explicit base query parameter if present (&base=...)
        const explicitBase = (urlParams.get('base') || '').trim();
        let baseForKey = '';
        if (explicitBase) {
            // sanitize: keep alphanumerics, underscore, hyphen only
            baseForKey = explicitBase.replace(/[^a-z0-9_\-]/gi,'');
        }
        if (!baseForKey) {
            // Derive base name from audio source (strip path, extension, trailing _de/_en)
            const src = audioSrc || audioPlayer?.src || '';
            if(!src) return;
            try {
                const clean = decodeURIComponent(src.split('?')[0].split('#')[0]);
                let file = clean.substring(clean.lastIndexOf('/')+1);
                file = file.replace(/\.(m4a|mp3|wav|aif|aiff)$/i,'');
                file = file.replace(/_(de|en)$/i,'');
                baseForKey = file;
            } catch(_) { /* ignore */ }
        }
        if(!baseForKey) return;
        const explanationKey = `${baseForKey}-text`;
        const applyIfAvailable = () => {
            const dict = (window.__i18n && window.__i18n.dict) || {};
            if(dict[explanationKey]){
                panelEl.setAttribute('data-i18n', explanationKey);
                panelEl.innerHTML = dict[explanationKey];
                return true;
            }
            return false;
        };
        if(!applyIfAvailable()){
            let attempts = 0;
            const maxAttempts = 20; // ~2s if 100ms interval
            const interval = setInterval(()=>{
                attempts++;
                if(applyIfAvailable() || attempts >= maxAttempts){
                    clearInterval(interval);
                }
            },100);
        }
        window.addEventListener('languageChanged', applyIfAvailable);
    })();
    // Initialize favorite icon state for the loaded track
    refreshFavoriteIcon();
        
    let sessionMarkedAsComplete = false;


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

        // iOS standalone (PWA) sometimes requires an initial user gesture to "unlock" media.
        // We'll perform a hidden play->pause once on first touchend/click to satisfy the gesture requirement.
        let iosUnlocked = false;
        const attemptIOSUnlock = () => {
            if (iosUnlocked) return;
            iosUnlocked = true;
            try {
                const p = audioPlayer.play();
                if (p && typeof p.then === 'function') {
                    p.then(() => { audioPlayer.pause(); }).catch(() => { iosUnlocked = false; });
                }
            } catch(_) { iosUnlocked = false; }
        };
        window.addEventListener('touchend', attemptIOSUnlock, { once: true, passive: true });
        window.addEventListener('click', attemptIOSUnlock, { once: true, passive: true });

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                userInitiatedPlayAt = Date.now();
                if (audioPlayer.paused) {
                    const p = audioPlayer.play();
                    if (p && typeof p.catch === 'function') p.catch((err) => {
                        console.warn('audioPlayer.play() blocked:', {
                            name: err && err.name,
                            message: err && err.message,
                            code: err && err.code,
                            stack: err && err.stack,
                            context: {
                                standalone: window.matchMedia('(display-mode: standalone)').matches,
                                autoplayPolicy: 'iOS may require fresh gesture',
                                readyState: audioPlayer.readyState,
                                paused: audioPlayer.paused,
                                src: audioPlayer.currentSrc
                            }
                        });
                    });
                } else {
                    audioPlayer.pause();
                }
            });
        }
        audioPlayer.addEventListener('play', () => {
            playPauseBtn.src = `${pathToRoot}assets/images/icons/pause_icon_black.png`;
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        });
        audioPlayer.addEventListener('pause', () => {
            playPauseBtn.src = `${pathToRoot}assets/images/icons/play_icon_black.png`;
        });
        audioPlayer.addEventListener('playing', () => {});
        audioPlayer.addEventListener('ended', () => {});
        if(rewindBtn) rewindBtn.addEventListener('click', () => { audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 15); });
        if(forwardBtn) forwardBtn.addEventListener('click', () => { audioPlayer.currentTime += 15; });
        audioPlayer.addEventListener('timeupdate', () => {
            if (audioPlayer.duration) {
                const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                if(progressBar) progressBar.style.width = `${progress}%`;
                if(currentTimeSpan) currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
                if (progress >= 95 && !sessionMarkedAsComplete) {
                    sessionMarkedAsComplete = true;
                    markSessionComplete();
                }
                // If we have some buffered and playback is progressing, hide loader
                if (!audioPlayer.paused && audioPlayer.currentTime > 0 && loadingIndicator) loadingIndicator.style.display = 'none';
            }
        });
        audioPlayer.addEventListener('seeking', () => {
            // no-op for BG since premixed-only
        });
        audioPlayer.addEventListener('loadedmetadata', () => {
            if(durationSpan) durationSpan.textContent = formatTime(audioPlayer.duration);
            refreshFavoriteIcon();
            if (audioPlayer.readyState >= 1 && loadingIndicator) loadingIndicator.style.display = 'none';
        });
        const onStall = () => {
            const justInteracted = (Date.now() - userInitiatedPlayAt) < 500;
            if (justInteracted) return;
            // Only nudge resume if we are actually waiting/stalled
            tryResumeMainAudio();
        };
        audioPlayer.addEventListener('waiting', onStall);
        audioPlayer.addEventListener('stalled', onStall);
        audioPlayer.addEventListener('error', () => {
            const err = audioPlayer.error;
            console.warn('audioPlayer error', { code: err && err.code, src: audioPlayer.currentSrc });
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        });
        audioPlayer.addEventListener('waiting', () => { if (loadingIndicator) loadingIndicator.style.display = 'block'; });
        audioPlayer.addEventListener('stalled', () => { if (loadingIndicator) loadingIndicator.style.display = 'block'; });
        audioPlayer.addEventListener('canplay', () => { if (loadingIndicator) loadingIndicator.style.display = 'none'; });
        audioPlayer.addEventListener('canplaythrough', () => { if (loadingIndicator) loadingIndicator.style.display = 'none'; });
        if (backToOverviewBtn) backToOverviewBtn.addEventListener('click', () => {
            // Only hide the completion screen and show the player again
            if (completionScreen) completionScreen.style.display = 'none';
            if (playerContainer) playerContainer.style.display = 'flex';
        });
        const completionCloseBtn = document.getElementById('completion-close-button');
        if (completionCloseBtn) {
            completionCloseBtn.addEventListener('click', () => {
                if (completionScreen) completionScreen.style.display = 'none';
                if (playerContainer) playerContainer.style.display = 'flex';
            });
        }
        
        let isDragging = false;
        const updateFromPointer = (clientX) => {
            if (!audioPlayer.duration) return;
            const rect = progressContainer.getBoundingClientRect();
            const x = Math.max(rect.left, Math.min(clientX, rect.right));
            const ratio = (x - rect.left) / rect.width;
            audioPlayer.currentTime = ratio * audioPlayer.duration;
        };
        const onPointerMove = (e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            const clientX = (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
            updateFromPointer(clientX);
        };
        if (progressContainer) {
            progressContainer.addEventListener('mousedown', (e) => { isDragging = true; updateFromPointer(e.clientX); });
            document.addEventListener('mouseup', () => { isDragging = false; });
            document.addEventListener('mousemove', onPointerMove);
            progressContainer.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); isDragging = true; if (e.touches.length) updateFromPointer(e.touches[0].clientX); }, { passive: false });
            document.addEventListener('touchend', () => { isDragging = false; }, { passive: true });
            document.addEventListener('touchmove', onPointerMove, { passive: false });
            progressContainer.addEventListener('click', (e) => { updateFromPointer(e.clientX); });
        }

    // No BG resync needed in premixed-only mode

        // Media Session API: better OS integration and lock screen controls
        if ('mediaSession' in navigator) {
            try {
                const titleText = (trackTitleElement?.textContent || '').trim() || 'Audio';
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: titleText,
                    artist: 'Body & Soul',
                    artwork: [
                        { src: `${pathToRoot}assets/images/logo_192.png`, sizes: '192x192', type: 'image/png' },
                        { src: `${pathToRoot}assets/images/logo_512.png`, sizes: '512x512', type: 'image/png' }
                    ]
                });

                navigator.mediaSession.setActionHandler('play', () => audioPlayer.play());
                navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
                navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                    const offset = details.seekOffset || 10;
                    audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - offset);
                });
                navigator.mediaSession.setActionHandler('seekforward', (details) => {
                    const offset = details.seekOffset || 10;
                    audioPlayer.currentTime = Math.min(audioPlayer.duration || Infinity, audioPlayer.currentTime + offset);
                });
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    if (details.fastSeek && 'fastSeek' in audioPlayer) {
                        audioPlayer.fastSeek(details.seekTime);
                    } else {
                        audioPlayer.currentTime = details.seekTime;
                    }
                });

                const updatePositionState = () => {
                    try {
                        if (navigator.mediaSession.setPositionState && isFinite(audioPlayer.duration)) {
                            navigator.mediaSession.setPositionState({
                                duration: audioPlayer.duration || 0,
                                playbackRate: audioPlayer.playbackRate || 1,
                                position: audioPlayer.currentTime || 0
                            });
                        }
                    } catch (_) {}
                };
                audioPlayer.addEventListener('timeupdate', updatePositionState);
                audioPlayer.addEventListener('loadedmetadata', updatePositionState);
                audioPlayer.addEventListener('play', () => { try { navigator.mediaSession.playbackState = 'playing'; } catch (_) {} });
                audioPlayer.addEventListener('pause', () => { try { navigator.mediaSession.playbackState = 'paused'; } catch (_) {} });
            } catch (_) { /* ignore media session errors */ }
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
                    const base = e.currentTarget.dataset.base;
                    const titleKey = e.currentTarget.dataset.titleKey;
                    const plainTitle = (e.currentTarget.dataset.title || base || '').replace(/<[^>]*>/g,'');
                    if (audioPath && base) {
                        let url = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioPath)}&title=${encodeURIComponent(plainTitle)}&base=${encodeURIComponent(base)}`;
                        if (titleKey) url += `&titleKey=${encodeURIComponent(titleKey)}`;
                        window.location.href = url;
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
            // Dynamic headline via i18n key moodResultHeadline
            header.setAttribute('data-i18n', 'moodResultHeadline');
            // Fallback text until translations applied
            header.textContent = 'Vorschläge';
            section.appendChild(header);

            tracks.forEach(track => {
                const lang = localStorage.getItem('lang') || 'de';
                const filename_from_db = track.path || '';
                const baseName = filename_from_db.split('.')[0];
                if (!baseName) return;
                const audioPath = `${pathToRoot}assets/audio/subcategories/${lang}/${baseName}.m4a`;
                const titleKey = baseName;
                const dict = (window.__i18n && window.__i18n.lang === lang) ? (window.__i18n.dict || {}) : {};
                const localized = dict[titleKey] || baseName;
                const card = document.createElement('div');
                card.className = 'result-card';
                card.dataset.audioPath = audioPath;
                card.dataset.base = baseName;
                card.dataset.titleKey = titleKey;
                card.dataset.title = localized;
                const titleSpan = document.createElement('span');
                titleSpan.className = 'result-card-title';
                titleSpan.setAttribute('data-i18n', titleKey);
                titleSpan.textContent = localized;
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