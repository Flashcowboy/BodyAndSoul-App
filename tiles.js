(function (global) {
    'use strict';

    function getPathToRoot() {
        const path = window.location.pathname;
        const parts = path.split('/').filter(Boolean);
        const isFile = parts.length && parts[parts.length - 1].includes('.');
        const depth = Math.max(0, parts.length - (isFile ? 1 : 0));
        if (depth === 0) return './';
        return '../'.repeat(depth);
    }
    const pathToRoot = getPathToRoot();

    const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    const isYesterday = (date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return isSameDay(date, yesterday);
    };

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
            const icon = card.querySelector('.favorite-icon');
            if (!baseName) return;

            card.dataset.clickBound = '1';
            card.addEventListener('click', async (e) => {
                // Favorite icon click
                if (icon && icon.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();

                    const currentUser = authUser || (global.auth ? global.auth.currentUser : null) || await getCurrentUserWithWait();
                    if (!currentUser || !global.db) {
                        alert('Bitte einloggen, um Favoriten zu speichern.');
                        return;
                    }
                    const userDocRef = global.db.collection('User_Profiles').doc(currentUser.uid);

                    const lang = localStorage.getItem('lang') || 'de';
                    const currentPagePath = window.location.pathname;
                    const audioSubFolder = currentPagePath.includes('/structure/basics/') ? 'basics/' : '';
                    const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${baseName}_${lang}.m4a`;

                    const favoriteData = {
                        id: baseName,
                        title: card.querySelector('.card-text span') ? card.querySelector('.card-text span').innerHTML.trim() : '',
                        audioSrc: audioFilePath
                    };

                    if (userFavorites[baseName]) {
                        userDocRef.update({ [`favorites.${baseName}`]: global.firebase.firestore.FieldValue.delete() })
                            .catch(err => console.error('Error removing favorite:', err));
                    } else {
                        userDocRef.update({ [`favorites.${baseName}`]: favoriteData })
                            .catch(err => console.error('Error adding favorite:', err));
                    }
                    return;
                }

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

                const freshCardTextElement = card.querySelector('.card-text span');
                const freshTrackTitle = freshCardTextElement ? freshCardTextElement.textContent.trim() : '';
                const lang = localStorage.getItem('lang') || 'de';
                const currentPagePath = window.location.pathname;
                const audioSubFolder = currentPagePath.includes('/structure/basics/') ? 'basics/' : '';
                const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${baseName}_${lang}.m4a`;

                let playerUrl = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioFilePath)}&title=${encodeURIComponent(freshTrackTitle)}&courseId=${encodeURIComponent(courseId)}`;
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
        document.addEventListener('click', async (evt) => {
            const card = evt.target.closest && evt.target.closest('.subcategory-card');
            if (!card || card.classList.contains('course-card')) return;
            if (card.dataset.clickBound === '1') return; // already has a listener
            const icon = card.querySelector('.favorite-icon');
            if (icon && icon.contains(evt.target)) return; // let favorite handler handle it

            const audioBaseName = card.dataset.audioBaseName || card.id;
            if (!audioBaseName) return;

            // Build title and path
            const freshCardTextElement = card.querySelector('.card-text span');
            const freshTrackTitle = freshCardTextElement ? freshCardTextElement.textContent.trim() : '';
            const lang = localStorage.getItem('lang') || 'de';
            const currentPagePath = window.location.pathname;
            const audioSubFolder = currentPagePath.includes('/structure/basics/') ? 'basics/' : '';
            const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${audioBaseName}_${lang}.m4a`;
            const courseId = card.id.substring(0, card.id.lastIndexOf('_'));

            let playerUrl = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioFilePath)}&title=${encodeURIComponent(freshTrackTitle)}&courseId=${encodeURIComponent(courseId)}`;
            if (pageIsChallenge) playerUrl += '&challenge=true';
            try { console.debug('[Tiles] Delegated navigate to player:', playerUrl); } catch(_){ }
            window.location.href = playerUrl;
        }, true);
    }

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

    function initCategoryCards() {
        const cards = document.querySelectorAll('.category-card');
        if (!cards.length) return;
        cards.forEach(card => {
            const href = card.getAttribute('data-href');
            if (!href) return;
            card.addEventListener('click', () => { window.location.href = href; });
        });
    }

    // Accordion: Show only subcategory-card by default; expand its following subcategory-audiocard siblings on click
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
        initSubcategoryAudioAccordion
    };

})(window);
