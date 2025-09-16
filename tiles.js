(function (global) {
    'use strict';

    function getPathToRoot() {
        const path = window.location.pathname;
        if (path.includes('/structure/basics/')) return '../../';
        if (path.includes('/structure/subcategories/')) return '../../';
        if (path.includes('/structure/')) return '../';
        return './';
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

    global.Tiles = {
        initSubcategoryCards,
    initCourseCards,
    initCategoryCards
    };

})(window);
