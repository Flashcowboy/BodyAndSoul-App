document.addEventListener('DOMContentLoaded', () => {
    // Path helper for building links back to root
    function getPathToRoot() {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const isFile = parts.length && parts[parts.length - 1].includes('.');
        const depth = Math.max(0, parts.length - (isFile ? 1 : 0));
        if (depth === 0) return './';
        return '../'.repeat(depth);
    }

    // Prefer the favorites section specifically, not any settings list
    const favoritesTitleEl = document.querySelector('h3[data-i18n="profile_favorites_title"]');
    const favoritesContainer = favoritesTitleEl ? favoritesTitleEl.parentElement.querySelector('.settings-list') : document.querySelector('.section .settings-list');
    
    if (!favoritesContainer) return;

    favoritesContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Favoriten werden geladen...</p>';

    // Key derivation helper shared across render and backfill
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

    let latestFavs = {};
    const renderFavorites = (favoritesMap) => {
        latestFavs = favoritesMap || {};
        const favorites = Object.values(favoritesMap || {});
        favoritesContainer.innerHTML = '';
        if (favorites.length === 0) {
            const noFavorites = document.createElement('div');
            noFavorites.setAttribute('data-i18n', 'profile_favorites_empty');
            noFavorites.textContent = 'Noch keine Favoriten hinzugefügt.';
            noFavorites.style.textAlign = 'center';
            noFavorites.style.padding = '20px';
            favoritesContainer.appendChild(noFavorites);
            loadTranslations(localStorage.getItem('lang') || 'de');
            return;
        }
        const lang = localStorage.getItem('lang') || 'de';
        const dict = (window.__i18n && window.__i18n.lang === lang) ? (window.__i18n.dict || null) : null;
        favorites
            .sort((a, b) => {
                const ka = deriveKey(a); const kb = deriveKey(b);
                const la = (dict && ka && dict[ka]) ? dict[ka] : (a[`title_${lang}`] || a.title || '');
                const lb = (dict && kb && dict[kb]) ? dict[kb] : (b[`title_${lang}`] || b.title || '');
                return (la || '').localeCompare(lb || '');
            })
            .forEach(fav => {
                const favoriteItem = document.createElement('div');
                favoriteItem.classList.add('setting-item');
                favoriteItem.style.cursor = 'pointer';
                favoriteItem.style.alignItems = 'flex-start';

                const label = document.createElement('span');
                label.classList.add('label');
                label.style.display = 'block';
                label.style.lineHeight = '1.3';
                label.style.whiteSpace = 'normal';
                label.style.wordBreak = 'break-word';
                label.style.flex = '1 1 auto';
                label.style.paddingRight = '8px';
                const key = deriveKey(fav);
                const localized = (dict && key && dict[key]) ? dict[key] : (fav[`title_${lang}`] || fav.title || fav.id || '');
                label.innerHTML = localized; // allow HTML tags

                const action = document.createElement('span');
                action.classList.add('action');
                action.textContent = '>';

                favoriteItem.appendChild(label);
                favoriteItem.appendChild(action);

                favoriteItem.addEventListener('click', () => {
                    const src = (fav.audioSrc || '').replace(/_(de|en)\.m4a$/, '.m4a');
                    if (!src) return;
                    const plainTitle = (localized || '').replace(/<[^>]*>/g, '');
                    let url = `${getPathToRoot()}structure/player.html?audio=${encodeURIComponent(src)}&title=${encodeURIComponent(plainTitle)}&courseId=${encodeURIComponent(fav.id || '')}`;
                    if (key) url += `&titleKey=${encodeURIComponent(key)}`;
                    window.location.href = url;
                });

                favoritesContainer.appendChild(favoriteItem);
            });
    };

    // Wait for Firebase to be ready (auth/db available)
    const onReady = (fn) => {
        if (window.auth && window.db) return fn();
        let tries = 0; const max = 50;
        const t = setInterval(() => {
            tries++;
            if (window.auth && window.db) { clearInterval(t); fn(); }
            else if (tries >= max) { clearInterval(t); }
        }, 100);
    };

    onReady(() => {
    const unsubscribe = window.auth.onAuthStateChanged(user => {
        if (user) {
            const userDocRef = window.db.collection('User_Profiles').doc(user.uid);
            userDocRef.onSnapshot(async doc => {
                if (doc.exists) {
                    const favs = doc.data().favorites || {};
                    // Backfill titleKey where possible for consistency
                    const updates = {};
                    Object.values(favs).forEach(f => {
                        const k = deriveKey(f);
                        if (k && !f.titleKey) updates[`favorites.${f.id}.titleKey`] = k;
                    });
                    if (Object.keys(updates).length) {
                        try { await userDocRef.update(updates); } catch(_) {}
                    }
                    renderFavorites(favs);
                } else {
                    favoritesContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Benutzerprofil nicht gefunden.</p>';
                }
            }, error => {
                console.error("Error getting favorites:", error);
                favoritesContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Fehler beim Laden der Favoriten.</p>';
            });
        } else {
            favoritesContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Bitte einloggen, um Favoriten zu sehen.</p>';
        }
    });
    });

    // Re-render on language change (use cached favorites, small delay to ensure __i18n is updated)
    window.addEventListener('lang-changed', () => {
        setTimeout(() => renderFavorites(latestFavs), 150);
    });
});
