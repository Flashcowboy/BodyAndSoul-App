(function (global) {
    'use strict';

    // Ensure a larger clickable area (hitbox) around a .favorite-icon without changing the icon size.
    // Returns an object { wrapper, icon } where wrapper is the new clickable container and icon is the img.
    function ensureFavoriteHitArea(card) {
        if (!card) return { wrapper: null, icon: null };
        const icon = card.querySelector('.favorite-icon');
        if (!icon) return { wrapper: null, icon: null };

        // If already wrapped, return existing wrapper
        if (icon.parentElement && icon.parentElement.classList && icon.parentElement.classList.contains('favorite-hit')) {
            return { wrapper: icon.parentElement, icon };
        }

        // Create wrapper hit area anchored to the top-right of the card
        const wrapper = document.createElement('div');
        wrapper.className = 'favorite-hit';
        const ws = wrapper.style;
        ws.position = 'absolute';
        ws.top = '0px';
        ws.right = '0px';
        ws.width = '36px';
        ws.height = '36px';
        // no centering; icon will be absolutely positioned inside
        ws.cursor = 'pointer';
        ws.zIndex = '2';
        ws.touchAction = 'manipulation';
        // Place wrapper in card, before icon, then move icon inside
        card.appendChild(wrapper);
        // Position icon closer to the corner within the hit area
        const cs = window.getComputedStyle(icon);
        icon.style.position = 'absolute';
        icon.style.top = '4px';
        icon.style.right = '4px';
        icon.style.margin = '0';
        // Keep icon size as originally defined by CSS (fallback to 15x15)
        const w = (cs.width && cs.width !== 'auto') ? cs.width : '';
        const h = (cs.height && cs.height !== 'auto') ? cs.height : '';
        if (w) icon.style.width = w; else if (!icon.style.width) icon.style.width = '15px';
        if (h) icon.style.height = h; else if (!icon.style.height) icon.style.height = '15px';
        // Let the wrapper receive the click, not the img
        icon.style.pointerEvents = 'none';
        wrapper.appendChild(icon);

        return { wrapper, icon };
    }

    // Small utility to compute relative path back to project root.
    // This ensures our links work from nested pages.
    function getPathToRoot() {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const isFile = parts.length && parts[parts.length - 1].includes('.');
        const depth = Math.max(0, parts.length - (isFile ? 1 : 0));
        if (depth === 0) return './';
        return '../'.repeat(depth);
    }
    const pathToRoot = getPathToRoot();
    // Determine audio subfolder (e.g., 'basics/') by context or naming.
    // Priority order:
    // 1) Explicit override via data-audio-subfolder on the element
    // 2) Page path contains /structure/basics/
    // 3) Heuristic: baseName contains "_basics_"
    function getAudioSubFolder(baseName, element) {
        // explicit override via data attribute if provided
        const explicit = element && element.dataset && element.dataset.audioSubfolder;
        if (explicit) return explicit.endsWith('/') ? explicit : explicit + '/';
        // page-based
        const byPage = window.location.pathname.includes('/structure/basics/');
        if (byPage) return 'basics/';
        // name-based heuristic
        if (baseName && baseName.includes('_basics_')) return 'basics/';
        return '';
    }

    const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    const isYesterday = (date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return isSameDay(date, yesterday);
    };

    // Binds behavior to high-level subcategory tiles (the bigger section cards).
    // - Handles favorites toggle (Firestore)
    // - Asks to count toward course progress (optional)
    // - Navigates to player with constructed audio path and localized title
    function initSubcategoryCards() {
        const path = window.location.pathname;
        if (!(path.includes('subcategories') || path.includes('basics'))) return;

    const pageParams = new URLSearchParams(window.location.search);
    const pageIsChallenge = pageParams.get('challenge') === 'true';

        let userFavorites = {};
        let authUser = null;
        let authReady = false;

        function updateFavoriteIcons() {
            document.querySelectorAll('.subcategory-card').forEach(card => {
                const baseName = card.dataset.audioBaseName || card.id;
                const icon = card.querySelector('.favorite-icon');
                if (icon) {
                    const isFavorite = !!userFavorites[baseName];
                    icon.src = isFavorite
                        ? `${pathToRoot}assets/images/icons/heart_active.png`
                        : `${pathToRoot}assets/images/icons/heart_inactive.png`;
                }
            });
        }

        if (global.auth && global.db) {
            global.auth.onAuthStateChanged(user => {
                if (user && global.db) {
                    authUser = user;
                    authReady = true;
                    const userDocRef = global.db.collection('User_Profiles').doc(user.uid);
                    userDocRef.onSnapshot(doc => {
                        if (doc.exists) {
                            userFavorites = doc.data().favorites || {};
                        } else {
                            userFavorites = {};
                        }
                        updateFavoriteIcons();
                    }, err => {
                        console.error('Error fetching user favorites:', err);
                        userFavorites = {};
                        updateFavoriteIcons();
                    });
                } else {
                    authUser = null;
                    authReady = true;
                    userFavorites = {};
                    updateFavoriteIcons();
                }
            });
        } else {
            // Fallback: just clear icons if auth/db not available
            userFavorites = {};
            updateFavoriteIcons();
        }

        function getCurrentUserWithWait(timeoutMs = 2000) {
            if (authUser) return Promise.resolve(authUser);
            if (authReady) return Promise.resolve(null);
            return new Promise(resolve => {
                const start = Date.now();
                const interval = setInterval(() => {
                    if (authReady || authUser || Date.now() - start > timeoutMs) {
                        clearInterval(interval);
                        resolve(authUser);
                    }
                }, 50);
            });
        }

        const subcatCards = document.querySelectorAll('.subcategory-card:not(.course-card)');
        if (subcatCards && subcatCards.length) {
            try { console.debug('[Tiles] Binding subcategory cards:', subcatCards.length); } catch(_){}
        }

    subcatCards.forEach(card => {
            const audioBaseName = card.dataset.audioBaseName;
            const cardId = card.id;
            const baseName = audioBaseName || cardId;
            const { wrapper: favHit, icon } = ensureFavoriteHitArea(card);
            if (!baseName) return;

            card.dataset.clickBound = '1';

            // Bind favorite toggle on enlarged hit area (wrapper)
            if (favHit && !favHit.dataset.bound) {
                favHit.dataset.bound = '1';
                favHit.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentUser = authUser || (global.auth ? global.auth.currentUser : null) || await getCurrentUserWithWait();
                    if (!currentUser || !global.db) {
                        alert('Bitte einloggen, um Favoriten zu speichern.');
                        return;
                    }
                    const userDocRef = global.db.collection('User_Profiles').doc(currentUser.uid);

                    const lang = localStorage.getItem('lang') || 'de';
                    const audioSubFolder = getAudioSubFolder(baseName, card);
                    const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${audioBaseName}.m4a`;

                    const rawTitleEl = card.querySelector('.audiocard-text, .card-text span, .card-text, .subcategory-audiocard-title, [data-title]');
                    const localizedTitle = rawTitleEl ? (rawTitleEl.textContent || rawTitleEl.innerText || rawTitleEl.getAttribute('data-title') || '').trim() : '';
                    const titleKey = rawTitleEl ? (rawTitleEl.getAttribute('data-i18n') || '') : '';
                    const snap = await userDocRef.get();
                    const existing = (snap.exists && snap.data().favorites && snap.data().favorites[baseName]) || {};
                    const favoriteData = {
                        ...existing,
                        id: baseName,
                        title: localizedTitle || existing.title || '',
                        audioSrc: audioFilePath,
                    };
                    favoriteData[`title_${lang}`] = localizedTitle || existing[`title_${lang}`] || existing.title || '';
                    if (titleKey) favoriteData.titleKey = titleKey;

                    if (userFavorites[baseName]) {
                        userDocRef.update({ [`favorites.${baseName}`]: global.firebase.firestore.FieldValue.delete() })
                            .catch(err => console.error('Error removing favorite:', err));
                    } else {
                        userDocRef.update({ [`favorites.${baseName}`]: favoriteData })
                            .catch(err => console.error('Error adding favorite:', err));
                    }
                }, true);
            }

            card.addEventListener('click', async (e) => {
                // Ignore clicks on the enlarged favorite hit area
                if (e.target.closest('.favorite-hit')) return; // handled by wrapper listener

                // Navigation click
                const href = card.dataset.href;
                if (href) {
                    window.location.href = href;
                    return;
                }

                // --- Play audio click with course progress logic ---
                const currentUser = authUser || (global.auth ? global.auth.currentUser : null);
                const courseId = card.id.substring(0, card.id.lastIndexOf('_'));
                let trackProgress = false;
                try {
                    if (currentUser && global.db && courseId) {
                        const userCourseRef = global.db.collection('userCourses').doc(`${currentUser.uid}_${courseId}`);
                        const userCourseDoc = await userCourseRef.get();

                        if (userCourseDoc.exists) {
                            const progressQuery = userCourseRef.collection('progress').orderBy('completedDate', 'desc').limit(1);
                            const progressSnapshot = await progressQuery.get();

                            let isNewDay = true;
                            if (!progressSnapshot.empty) {
                                const lastEntry = progressSnapshot.docs[0].data();
                                const lastDate = lastEntry.completedDate.toDate();
                                const today = new Date();
                                if (isSameDay(lastDate, today)) {
                                    isNewDay = false;
                                }
                            }

                            if (isNewDay) {
                                if (confirm('Soll diese Übung für deine Kurs-Statistik gezählt werden?')) {
                                    trackProgress = true;
                                }
                            }
                        }
                    }
                } catch (err) {
                    try { console.warn('Kurs-Statistik nicht verfügbar (Weiterleitung ohne Abfrage).', err); } catch(_){}
                }

                const freshCardTextElement = card.querySelector('.audiocard-text, .card-text span');
                const freshTrackTitle = freshCardTextElement ? freshCardTextElement.textContent.trim() : '';
                const freshTitleKey = freshCardTextElement ? (freshCardTextElement.getAttribute('data-i18n') || '') : '';
                const lang = localStorage.getItem('lang') || 'de';
                const audioSubFolder = getAudioSubFolder(baseName, card);
                const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${baseName}.m4a`;

                // Pass the explicit base name to player so explanation text can use it directly
                let playerUrl = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioFilePath)}&title=${encodeURIComponent(freshTrackTitle)}&courseId=${encodeURIComponent(courseId)}&base=${encodeURIComponent(baseName)}`;
                if (freshTitleKey) playerUrl += `&titleKey=${encodeURIComponent(freshTitleKey)}`;
                if (trackProgress) {
                    playerUrl += '&trackProgress=true';
                }
                if (pageIsChallenge) {
                    playerUrl += '&challenge=true';
                }
                try { console.debug('[Tiles] Navigate to player:', playerUrl); } catch(_){ }
                window.location.href = playerUrl;
            });
        });

    // Fallback delegation in case binding fails due to dynamic DOM changes
    // This listens at the document level and reacts if individual bindings were missed.
        document.addEventListener('click', (evt) => {
            const card = evt.target.closest && evt.target.closest('.subcategory-card');
            if (!card || card.classList.contains('course-card')) return;
            if (card.dataset.clickBound === '1') return; // already has per-card listener
            const icon = card.querySelector('.favorite-icon');
            if (icon && icon.contains(evt.target)) return; // legacy guard
            if (evt.target.closest && evt.target.closest('.favorite-hit')) return; // let favorite handler handle it

            const audioBaseName = card.dataset.audioBaseName || card.id;
            if (!audioBaseName) return;

            // Build title and path
            const freshCardTextElement = card.querySelector('.audiocard-text, .card-text span');
            const freshTrackTitle = freshCardTextElement ? freshCardTextElement.textContent.trim() : '';
            const lang = localStorage.getItem('lang') || 'de';
            const audioSubFolder = getAudioSubFolder(audioBaseName, card);
            const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${audioBaseName}.m4a`;
            const courseId = card.id.substring(0, card.id.lastIndexOf('_'));

            let playerUrl = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioFilePath)}&title=${encodeURIComponent(freshTrackTitle)}&courseId=${encodeURIComponent(courseId)}&base=${encodeURIComponent(audioBaseName)}`;
            if (pageIsChallenge) playerUrl += '&challenge=true';
            try { console.debug('[Tiles] Delegated navigate to player:', playerUrl); } catch(_){ }
            window.location.href = playerUrl;
        }, true);
    }

    // Binds behavior to course tiles and their challenge button (if any).
    function initCourseCards() {
        const cards = document.querySelectorAll('.course-card');
        if (!cards.length) return;

        cards.forEach(card => {
            const challengeButton = card.querySelector('.challenge-button');

            card.addEventListener('click', (e) => {
                if (e.target.closest('.challenge-button')) return; // Button handles its own
                if (card.dataset.href) window.location.href = card.dataset.href;
            });

            if (challengeButton) {
                challengeButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const challengeHref = challengeButton.dataset.challengeHref;
                    if (challengeHref) window.location.href = challengeHref;
                });
            }
        });
    }

    // Simple click navigation for category tiles using data-href.
    function initCategoryCards() {
        const cards = document.querySelectorAll('.category-card');
        if (!cards.length) return;
        cards.forEach(card => {
            const href = card.getAttribute('data-href');
            if (!href) return;
            card.addEventListener('click', () => { window.location.href = href; });
        });
    }

    // Handles clicks on concrete audio tiles (subcategory-audiocard)
    // - Prevents favorite icon clicks from triggering navigation
    // - Builds the final audio file path with lang and optional basics/ subfolder
    // - Derives courseId from the base name to enable progress tracking
    function initSubcategoryAudioCards() {
        const cards = Array.from(document.querySelectorAll('.subcategory-audiocard'));
        if (!cards.length) return;

        const pageParams = new URLSearchParams(window.location.search);
        const pageIsChallenge = pageParams.get('challenge') === 'true';

        // Remove legacy inline onclicks that navigate elsewhere
        cards.forEach(card => { if (card.hasAttribute('onclick')) card.removeAttribute('onclick'); });

        // Keep heart icons in sync with user's favorites (initial and live updates)
    function updateAudioFavoriteIcons(favs) {
            const allCards = document.querySelectorAll('.subcategory-audiocard');
            allCards.forEach(card => {
                const icon = card.querySelector('.favorite-icon');
                if (!icon) return;
                const baseName = card.dataset.audioBaseName || card.id;
                const isFav = !!(favs && favs[baseName]);
                icon.src = `${pathToRoot}assets/images/icons/${isFav ? 'heart_active' : 'heart_inactive'}.png`;
            });
        }

        if (global.auth && global.db && !global._tilesAudioFavSubscriptionBound) {
            global._tilesAudioFavSubscriptionBound = true;
            try {
                global.auth.onAuthStateChanged(user => {
                    if (!user) { updateAudioFavoriteIcons({}); return; }
                    const ref = global.db.collection('User_Profiles').doc(user.uid);
                    ref.onSnapshot(doc => {
                        const favs = doc.exists ? (doc.data().favorites || {}) : {};
                        updateAudioFavoriteIcons(favs);
                    }, () => updateAudioFavoriteIcons({}));
                });
            } catch(_) { /* noop */ }
        } else {
            // No auth/db available; default all to inactive
            updateAudioFavoriteIcons({});
        }

        cards.forEach(card => {
            // Bind favorite icon toggle on audiocard
            const favIcon = card.querySelector('.favorite-icon');
            const { wrapper: favHit } = ensureFavoriteHitArea(card);
            if (favHit && favHit.dataset.bound !== '1') {
                favHit.dataset.bound = '1';
                favHit.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        if (!(global.auth && global.db)) return alert('Bitte einloggen, um Favoriten zu speichern.');
                        const user = global.auth.currentUser;
                        if (!user) return alert('Bitte einloggen, um Favoriten zu speichern.');
                        const baseName = card.dataset.audioBaseName || card.id;
                        if (!baseName) return;
                        const lang = localStorage.getItem('lang') || 'de';
                        const audioSubFolder = getAudioSubFolder(baseName, card);
                        const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${baseName}.m4a`;
                        const titleEl = card.querySelector('.audiocard-text, .card-text span, .subcategory-audiocard-title, [data-title]');
                        const title = titleEl ? (titleEl.textContent || titleEl.getAttribute('data-title') || '').trim() : '';
                        const userDocRef = global.db.collection('User_Profiles').doc(user.uid);
                        const snap = await userDocRef.get();
                        const favs = snap.exists ? (snap.data().favorites || {}) : {};
                        if (favs[baseName]) {
                            await userDocRef.update({ [`favorites.${baseName}`]: global.firebase.firestore.FieldValue.delete() });
                            if (favIcon) favIcon.src = `${pathToRoot}assets/images/icons/heart_inactive.png`;
                        } else {
                            await userDocRef.update({ [`favorites.${baseName}`]: { id: baseName, title: title, audioSrc: audioFilePath } });
                            if (favIcon) favIcon.src = `${pathToRoot}assets/images/icons/heart_active.png`;
                        }
                    } catch (err) {
                        try { console.error('Favoriten-Umschalten fehlgeschlagen:', err); } catch(_){ }
                    }
                }, true);
            }
            if (card.dataset.audioBound === '1') return;
            card.dataset.audioBound = '1';
            card.addEventListener('click', (e) => {
                if (e.target.closest('.favorite-icon') || e.target.closest('.favorite-hit')) return; // handled above
                const challengeBtn = e.target.closest('.challenge-button');
                if (challengeBtn && challengeBtn.dataset.challengeHref) {
                    e.stopPropagation();
                    window.location.href = challengeBtn.dataset.challengeHref;
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                const baseName = card.dataset.audioBaseName || card.id;
                if (!baseName) return;

                const titleEl = card.querySelector('.audiocard-text, .card-text span, .subcategory-audiocard-title, [data-title]');
                const title = titleEl ? (titleEl.textContent || titleEl.getAttribute('data-title') || '').trim() : '';
                const titleKey = titleEl ? (titleEl.getAttribute('data-i18n') || '') : '';

                const lang = localStorage.getItem('lang') || 'de';
                const audioSubFolder = getAudioSubFolder(baseName, card);
                const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${baseName}.m4a`;

                // Derive courseId from baseName by trimming last _NN segment
                const lastUnderscore = baseName.lastIndexOf('_');
                const courseId = lastUnderscore > 0 ? baseName.substring(0, lastUnderscore) : baseName;

                let playerUrl = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioFilePath)}&title=${encodeURIComponent(title)}&courseId=${encodeURIComponent(courseId)}`;
                if (titleKey) playerUrl += `&titleKey=${encodeURIComponent(titleKey)}`;
                if (pageIsChallenge) playerUrl += '&challenge=true';
                window.location.href = playerUrl;
            }, true);
        });
    }

    // Accordion:
    // - Shows only the subcategory-card rows initially
    // - Groups subsequent subcategory-audiocard elements into a collapsible container
    // - Smooth open/close animations via max-height/opacity
    // - Idempotent: safe to call multiple times
    function initSubcategoryAudioAccordion() {
        const rootCards = Array.from(document.querySelectorAll('.subcategory-card'));
        const anyAudioCards = document.querySelector('.subcategory-audiocard');
        if (!rootCards.length || !anyAudioCards) return; // nothing to do

        // Build mapping: for each subcategory-card, create/find a wrapper that contains following .subcategory-audiocard until next .subcategory-card
        const groups = new Map(); // card -> { container, nodes }

        rootCards.forEach(card => {
            // If a wrapper is already present (idempotent init), use it; otherwise, create and move nodes into it
            let container = card.nextElementSibling;
            let collectedNodes = [];

            const ensureContainer = () => {
                if (!container || !container.classList || !container.classList.contains('subcategory-audiogroup')) {
                    container = document.createElement('div');
                    container.className = 'subcategory-audiogroup';
                    card.parentNode.insertBefore(container, card.nextSibling);
                }
            };

            if (container && container.classList && container.classList.contains('subcategory-audiogroup')) {
                collectedNodes = Array.from(container.children).filter(el => el.classList.contains('subcategory-audiocard'));
            } else {
                // Collect following audiocards until next subcategory-card
                let n = card.nextElementSibling;
                while (n && !n.classList.contains('subcategory-card')) {
                    const next = n.nextElementSibling; // keep reference before moving
                    if (n.classList.contains('subcategory-audiocard')) {
                        collectedNodes.push(n);
                    }
                    n = next;
                }
                if (collectedNodes.length) {
                    ensureContainer();
                    collectedNodes.forEach(node => container.appendChild(node));
                }
            }

            if (collectedNodes.length) {
                // Apply inline styles for smooth transitions
                const style = container.style;
                style.overflow = 'hidden';
                style.maxHeight = style.maxHeight || '0px';
                style.opacity = style.opacity || '0';
                style.transition = style.transition || 'max-height 300ms ease, opacity 300ms ease';
                style.willChange = style.willChange || 'max-height, opacity';
                style.pointerEvents = style.pointerEvents || 'none';

                groups.set(card, { container, nodes: collectedNodes });
            }
        });

    if (!groups.size) return;

        // Prevent inline onclick navigation on parent cards ONLY for those that act as accordion triggers
        rootCards.forEach(card => {
            if (card.hasAttribute('onclick') && groups.has(card)) card.removeAttribute('onclick');
        });

    let openCard = null;
        const closeAll = () => {
            groups.forEach(({ container }) => {
                container.style.maxHeight = '0px';
                container.style.opacity = '0';
                container.style.pointerEvents = 'none';
            });
            rootCards.forEach(c => c.classList.remove('open'));
            openCard = null;
        };

        const openGroup = (card) => {
            const group = groups.get(card);
            if (!group) return;
            const { container } = group;
            // Measure then expand to natural height for smooth animation
            const targetHeight = container.scrollHeight;
            container.style.maxHeight = targetHeight + 'px';
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
            card.classList.add('open');
            openCard = card;
        };

    rootCards.forEach(card => {
            if (card.dataset.accordionBound === '1') return; // idempotency
            card.dataset.accordionBound = '1';
            card.addEventListener('click', (e) => {
                if (!groups.has(card)) return; // card without audiocards behaves normally
                e.preventDefault();
                e.stopPropagation();
                if (openCard === card) {
                    closeAll();
                    return;
                }
                closeAll();
                // Next frame to ensure close styles applied before opening new
                requestAnimationFrame(() => openGroup(card));
            }, true);
        });

    // Start with all groups collapsed; they open on header click.

        // Keep open group's height accurate on resize
        window.addEventListener('resize', () => {
            if (!openCard) return;
            const group = groups.get(openCard);
            if (group && group.container) {
                group.container.style.maxHeight = group.container.scrollHeight + 'px';
            }
        });
    }

    global.Tiles = {
        initSubcategoryCards,
    initCourseCards,
    initCategoryCards,
    initSubcategoryAudioAccordion,
    initSubcategoryAudioCards
    };

})(window);
