function getPathToRoot() {
    const path = window.location.pathname;
    if (path.includes('/structure/basics/')) return '../../';
    if (path.includes('/structure/subcategories/')) return '../../';
    if (path.includes('/structure/')) return '../';
    return './';
}

// ==========================================================================
// --- 2. AUTH GUARD (Global Scope) ---
// ==========================================================================
if (auth) {
    auth.onAuthStateChanged(user => {
        const path = window.location.pathname;
        const isProtectedPage = path.includes('/structure/');
        const isAuthPage = path.endsWith('login.html') || path.endsWith('register.html');

        const pathToRoot = getPathToRoot();

        if (isProtectedPage && !user) {
            return window.location.replace(`${pathToRoot}login.html`);
        }
        if (isAuthPage && user) {
            return window.location.replace(`${pathToRoot}structure/categories.html`);
        }
    });
}

const bgMusicTracks = [
    { id: 'none', title: 'Ohne Musik', path: '' },
    { id: 'birdparadise', title: 'Vogelgezwitscher', path: `${getPathToRoot()}assets/audio/bg_music/birdparadise.m4a` }
];

function showBgMusicModal(trackTitle, mainAudioPath) {
    // Remove existing modal if any
    const existingModal = document.getElementById('bg-music-modal');
    if (existingModal) existingModal.remove();

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'bg-music-modal';
    modal.style.cssText = 'position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center;';

    // Create modal content
    let modalContentHtml = `
        <div style="background: white; padding: 25px; border-radius: 10px; width: 90%; max-width: 400px; text-align: center;">
            <h3 style="margin-top: 0;">Hintergrundmusik wählen</h3>
            <p>für: <strong>${trackTitle}</strong></p>
            <ul style="list-style: none; padding: 0; margin: 0;">
    `;

    bgMusicTracks.forEach(track => {
        modalContentHtml += `
            <li class="bg-music-option" data-path="${track.path}" style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;">
                ${track.title}
            </li>
        `;
    });

    modalContentHtml += `</ul><button id="close-modal-btn" style="margin-top: 20px; padding: 10px 20px; border: none; border-radius: 5px; background: #ccc;">Abbrechen</button></div>`;
    
    modal.innerHTML = modalContentHtml;
    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelector('#close-modal-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'bg-music-modal') { // Click on backdrop
            modal.remove();
        }
    });

    modal.querySelectorAll('.bg-music-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const bgAudioPath = e.currentTarget.dataset.path;
            let finalUrl = `${getPathToRoot()}structure/player.html?audio=${encodeURIComponent(mainAudioPath)}&title=${encodeURIComponent(trackTitle)}`;
            if (bgAudioPath) {
                finalUrl += `&bg_audio=${encodeURIComponent(bgAudioPath)}`;
            }
            window.location.href = finalUrl;
        });
    });
}

// ==========================================================================
// --- 3. DOM-RELATED LOGIC ---
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {

    
    // --- Funktion für die Ermittlung der Abspielposition im Player ---
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    

    const pathToRoot = getPathToRoot();

    // --- Translations ---
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`${pathToRoot}locales/${lang}.json`);
            if (!response.ok) throw new Error('Language file not found');
            const translations = await response.json();
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

    const lang = localStorage.getItem('lang') || 'de';
    loadTranslations(lang);

    // --- Page-specific Logic ---
    const path = window.location.pathname;

    // Index Page
    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
        document.querySelectorAll('.lang-button').forEach(button => {
            button.addEventListener('click', () => {
                localStorage.setItem('lang', button.getAttribute('data-lang'));
                window.location.href = `${pathToRoot}login.html`;
            });
        });
    }

    // ==========================================================================
    // --- 4. Subcategory Cards ---
    // ==========================================================================
    // --- FAVORITES LOGIC ---
    let userFavorites = {};

    function updateFavoriteIcons() {
        document.querySelectorAll('.subcategory-card').forEach(card => {
            const baseName = card.dataset.audioBaseName || card.id;
            const icon = card.querySelector('.favorite-icon');
            if (icon) {
                const isFavorite = !!userFavorites[baseName];
                icon.src = isFavorite
                    ? `${getPathToRoot()}assets/images/icons/heart_active.png`
                    : `${getPathToRoot()}assets/images/icons/heart_inactive.png`;
            }
        });
    }

    auth.onAuthStateChanged(user => {
        if (user && db) {
            const userDocRef = db.collection('User_Profiles').doc(user.uid);
            userDocRef.onSnapshot(doc => {
                if (doc.exists) {
                    userFavorites = doc.data().favorites || {};
                } else {
                    userFavorites = {};
                }
                updateFavoriteIcons();
            }, err => {
                console.error("Error fetching user favorites:", err);
                userFavorites = {};
                updateFavoriteIcons();
            });
        } else {
            userFavorites = {};
            updateFavoriteIcons();
        }
    });

    document.querySelectorAll('.subcategory-card').forEach(card => {
        const audioBaseName = card.dataset.audioBaseName;
        const cardId = card.id;
        const baseName = audioBaseName || cardId;
        const icon = card.querySelector('.favorite-icon');

        if (!baseName) return;

        card.addEventListener('click', (e) => {
            if (icon && icon.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                
                const currentUser = auth.currentUser;
                if (!currentUser || !db) {
                    alert("Bitte einloggen, um Favoriten zu speichern.");
                    return;
                }
                const userDocRef = db.collection('User_Profiles').doc(currentUser.uid);

                const lang = localStorage.getItem('lang') || 'de';
                const currentPagePath = window.location.pathname;
                const audioSubFolder = currentPagePath.includes('/structure/basics/') ? 'basics/' : '';
                const audioFilePath = `${getPathToRoot()}assets/audio/subcategories/${audioSubFolder}${lang}/${baseName}_${lang}.m4a`;

                const favoriteData = {
                    id: baseName,
                    title: card.querySelector('.card-text') ? card.querySelector('.card-text').innerHTML.trim() : '',
                    audioSrc: audioFilePath
                };

                if (userFavorites[baseName]) {
                    // Remove favorite
                    userDocRef.update({
                        [`favorites.${baseName}`]: firebase.firestore.FieldValue.delete()
                    }).catch(err => console.error("Error removing favorite:", err));
                } else {
                    // Add favorite
                    userDocRef.update({
                        [`favorites.${baseName}`]: favoriteData
                    }).catch(err => console.error("Error adding favorite:", err));
                }
                return;
            }

            // --- Handle Navigation Click ---
            const href = card.dataset.href;
            if (href) {
                window.location.href = href;
                return;
            }
            
            const freshCardTextElement = card.querySelector('.card-text');
            const freshTrackTitle = freshCardTextElement ? freshCardTextElement.innerHTML.trim() : '';
            const lang = localStorage.getItem('lang') || 'de';
            const currentPagePath = window.location.pathname;
            const audioSubFolder = currentPagePath.includes('/structure/basics/') ? 'basics/' : '';
            const audioFilePath = `${getPathToRoot()}assets/audio/subcategories/${audioSubFolder}${lang}/${baseName}_${lang}.m4a`;
            showBgMusicModal(freshTrackTitle, audioFilePath);
        });
    });

    // ==========================================================================
    // --- 5. Audio Player LOGIC ---
    // ==========================================================================
   
    const audioPlayer = document.getElementById('audio-player');
    const bgPlayer = document.getElementById('audio-player-bg');

    if (audioPlayer) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        let audioContext;
        let gainNode;
        let bgAudioSource;
        let isWebAudioInitialized = false;

        // --- Get DOM Elements ---
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
        
        // --- Get URL Params ---
        const urlParams = new URLSearchParams(window.location.search);
        const audioSrc = decodeURIComponent(urlParams.get('audio') || '');
        const bgAudioSrc = decodeURIComponent(urlParams.get('bg_audio') || '');
        const trackTitle = decodeURIComponent(urlParams.get('title') || '');

        // --- Set Audio Sources ---
        if (audioSrc) audioPlayer.src = audioSrc;
        if (trackTitle && trackTitleElement) trackTitleElement.innerHTML = trackTitle;
        if (bgAudioSrc && bgPlayer) {
            bgPlayer.src = bgAudioSrc;
            bgPlayer.loop = true;
            if (bgVolumeSlider && !isIOS) {
                bgPlayer.volume = bgVolumeSlider.value / 100;
            }
            if (bgVolumeContainer) bgVolumeContainer.style.display = 'flex';
        }

        // --- State ---
        let sessionMarkedAsComplete = false;
        let fadeOutInterval = null;

        // --- Sync and Fade Logic ---
        const startFadeOut = () => {
            if (!bgPlayer || fadeOutInterval) return;
            const fadeDuration = 10; // seconds
            const fadeSteps = 50;
            const interval = (fadeDuration * 1000) / fadeSteps;

            const getVolume = () => (isIOS && gainNode) ? gainNode.gain.value : bgPlayer.volume;
            const setVolume = (vol) => {
                if (isIOS && gainNode) {
                    gainNode.gain.value = vol;
                } else {
                    bgPlayer.volume = vol;
                }
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

        // --- Helper Functions for Streak Logic (unchanged) ---
        const isSameDay = (date1, date2) => {
            if (!date1 || !date2) return false;
            return date1.getFullYear() === date2.getFullYear() &&
                   date1.getMonth() === date2.getMonth() &&
                   date1.getDate() === date2.getDate();
        };

        const isYesterday = (date) => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return isSameDay(date, yesterday);
        };

        // --- Core Function to Update Stats (unchanged) ---
        async function markSessionComplete() {
            const user = auth.currentUser;
            if (!user || !db) return;

            if(playerContainer) playerContainer.style.display = 'none';
            if(completionScreen) completionScreen.style.display = 'flex';

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
                    
                    let newStreak = currentStreak;
                    if (lastSessionDate && isSameDay(lastSessionDate, new Date())) {
                        newStreak = currentStreak;
                    } else if (lastSessionDate && isYesterday(lastSessionDate)) {
                        newStreak = currentStreak + 1;
                    } else {
                        newStreak = 1;
                    }

                    const newSessions = currentSessions + 1;
                    const newLastSessionDate = new Date();
                    const newListeningTime = currentListeningTime + audioPlayer.duration;

                    transaction.update(userDocRef, {
                        sessions: newSessions,
                        streak: newStreak,
                        lastSessionDate: newLastSessionDate,
                        listeningTime: newListeningTime
                    });

                    if(completionStats) {
                        completionStats.innerHTML = `
                            <p>Sessions: ${newSessions}</p>
                            <p>Streak: ${newStreak} Tage</p>
                        `;
                    }
                });
            } catch (error) {
                console.error("Transaction failed: ", error);
                if(completionStats) completionStats.innerHTML = "<p>Fehler beim Speichern.</p>";
            }
        }

        // --- Event Listeners ---
        if(playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (audioPlayer.paused) {
                    audioPlayer.play();
                } else {
                    audioPlayer.pause();
                }
            });
        }

        audioPlayer.addEventListener('play', () => {
            if (isIOS && !isWebAudioInitialized && bgPlayer && bgAudioSrc) {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    gainNode = audioContext.createGain();
                    bgAudioSource = audioContext.createMediaElementSource(bgPlayer);
                    bgAudioSource.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                }
                if (bgVolumeSlider) {
                    gainNode.gain.value = bgVolumeSlider.value / 100;
                }
                isWebAudioInitialized = true;
            }

            if (bgPlayer && bgAudioSrc) {
                bgPlayer.currentTime = audioPlayer.currentTime;
                bgPlayer.play();
            }
            playPauseBtn.src = `${pathToRoot}assets/images/icons/pause_icon_black.png`;
        });

        audioPlayer.addEventListener('pause', () => {
            if (bgPlayer && bgAudioSrc) {
                bgPlayer.pause();
            }
            playPauseBtn.src = `${pathToRoot}assets/images/icons/play_icon_black.png`;
        });

        if(rewindBtn) rewindBtn.addEventListener('click', () => { 
            audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 15);
        });
        if(forwardBtn) forwardBtn.addEventListener('click', () => { 
            audioPlayer.currentTime += 15; 
        });
        
        audioPlayer.addEventListener('timeupdate', () => {
            if (audioPlayer.duration) {
                const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                if(progressBar) progressBar.style.width = `${progress}%`;
                if(currentTimeSpan) currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);

                if (bgPlayer && bgAudioSrc && (audioPlayer.duration - audioPlayer.currentTime) <= 10) {
                    startFadeOut();
                }

                if (progress >= 95 && !sessionMarkedAsComplete) {
                    sessionMarkedAsComplete = true;
                    markSessionComplete();
                }
            }
        });

        audioPlayer.addEventListener('seeking', () => {
            if (bgPlayer && bgAudioSrc) {
                bgPlayer.currentTime = audioPlayer.currentTime;
            }
        });

        audioPlayer.addEventListener('loadedmetadata', () => {
            if(durationSpan) durationSpan.textContent = formatTime(audioPlayer.duration);
        });

        if (bgVolumeSlider) {
            bgVolumeSlider.addEventListener('input', (e) => {
                const volumeValue = e.target.value / 100;
                if (isIOS && gainNode) {
                    gainNode.gain.value = volumeValue;
                } else if (bgPlayer) {
                    bgPlayer.volume = volumeValue;
                }
            });
        }

        if (backToOverviewBtn) {
            backToOverviewBtn.addEventListener('click', () => {
                window.location.href = 'categories.html';
            });
        }
        
        // --- Dragging Logic (Progress Bar) ---
        let isDragging = false;
        const handleDragStart = (e) => {
            if (e.type.startsWith('touch')) e.preventDefault();
            isDragging = true; 
            handleDragMove(e); 
        };
        const handleDragEnd = () => { isDragging = false; };
        const handleDragMove = (e) => {
            if (!isDragging) return;
            if (e.type.startsWith('touch')) e.preventDefault();
            
            const totalWidth = progressContainer.clientWidth;
            const rect = progressContainer.getBoundingClientRect();
            const clickX = (e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX) - rect.left;
            const boundedClickX = Math.max(0, Math.min(clickX, totalWidth));
            const progress = boundedClickX / totalWidth;
            const newTime = progress * audioPlayer.duration;

            if (!isNaN(newTime) && isFinite(newTime)) {
                if (progressBar) progressBar.style.width = `${progress * 100}%`;
                if (currentTimeSpan) currentTimeSpan.textContent = formatTime(newTime);
                audioPlayer.currentTime = newTime;
            }
        };

        if (progressContainer) {
            progressContainer.addEventListener('mousedown', handleDragStart);
            document.addEventListener('mouseup', handleDragEnd);
            document.addEventListener('mousemove', handleDragMove);
            progressContainer.addEventListener('touchstart', handleDragStart, { passive: false });
            document.addEventListener('touchend', handleDragEnd);
            document.addEventListener('touchmove', handleDragMove, { passive: false });
        }
    }

    // ==========================================================================
    // --- 6. Register Page Logic (Publicly Accessible) ---
    // ==========================================================================
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
                            uid: cred.user.uid,
                            email: cred.user.email,
                            firstName: document.getElementById('firstName').value,
                            lastName: document.getElementById('lastName').value,
                            street: document.getElementById('street').value,
                            zipCode: document.getElementById('zipCode').value,
                            city: document.getElementById('city').value,
                            country: document.getElementById('country').value,
                            birthdate: document.getElementById('birthdate').value,
                            mobile: document.getElementById('mobile').value,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            
                            // Existing stats
                            listeningTime: 0,
                            sessions: 0,
                            
                            // New fields for Gamification (Idea 2)
                            streak: 0,
                            lastSessionDate: null,
                            unlockedBadges: []
                        };
                        return db.collection('User_Profiles').doc(cred.user.uid).set(userProfileData);
                    })
                    .then(() => {
                        window.location.href = `${pathToRoot}registration_success.html`;
                    })
                    .catch((err) => {
                        console.error("Registration Error:", err);
                        alert("Fehler bei der Registrierung: " + err.message);
                        window.location.href = `${pathToRoot}registration_error.html`; 
                    });
            });
        }
    }

    // ==========================================================================
    // --- 7. Firebase-dependent Logic (User must be authenticated) ---
    // ==========================================================================
    if (auth && db && storage) {
        // Login Page
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

            // --- Forgot Password Logic ---
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
                        .then(() => {
                            alert('Eine E-Mail zum Zurücksetzen des Passworts wurde an ' + email + ' gesendet. Bitte überprüfen Sie Ihren Posteingang.');
                        })
                        .catch((error) => {
                            console.error('Error sending password reset email:', error);
                            alert('Fehler beim Senden der E-Mail: ' + error.message);
                        });
                });
            }
        }

        // Password Reset Page
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

        // Profile Page Logic
        if (path.endsWith('profile.html')) {

            const logoutButton = document.getElementById('logout-btn');
            if (logoutButton) {
                logoutButton.addEventListener('click', () => {
                    if (confirm("Möchten Sie sich wirklich ausloggen?")) {
                        auth.signOut().then(() => {
                            window.location.href = `${pathToRoot}login.html`;
                        }).catch(err => {
                            console.error("Logout error:", err);
                            alert("Fehler beim Ausloggen.");
                        });
                    }
                });
            }

            // Language Switcher Logic
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
                });
            }

            auth.onAuthStateChanged(user => {
                if (user) {
                    const userDocRef = db.collection('User_Profiles').doc(user.uid);
                    const profileAvatarImg = document.getElementById('profile-avatar-img');
                    const profileImageUpload = document.getElementById('profile-image-upload');

                    userDocRef.get().then((doc) => {
                        if (doc.exists) {
                            const userData = doc.data();
                            
                            // --- Populate Profile Header ---
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

                            // --- Populate Stats Grid ---
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

                            
                            
                            // --- Settings Listeners ---
                            const editProfileButton = document.querySelector('[data-i18n="profile_settings_edit_profile"]');
                            if (editProfileButton) {
                                editProfileButton.parentElement.addEventListener('click', () => {
                                    const currentName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                                    const newName = prompt("Geben Sie Ihren neuen Vor- und Nachnamen ein:", currentName);
                                    if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
                                        const nameParts = newName.trim().split(' ');
                                        const firstName = nameParts.shift() || '';
                                        const lastName = nameParts.join(' ');
                                        userDocRef.update({ 
                                            firstName: firstName,
                                            lastName: lastName
                                        })
                                            .then(() => {
                                                if(profileUsername) profileUsername.textContent = newName.trim();
                                                alert("Name erfolgreich aktualisiert!");
                                            })
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

                    // Handle profile image click
                    if (profileAvatarImg) {
                        profileAvatarImg.addEventListener('click', () => {
                            if (profileImageUpload) profileImageUpload.click();
                        });
                    }

                    // Handle profile picture file upload
                    if (profileImageUpload) {
                        profileImageUpload.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (!file) return;

                            alert("Profilbild wird hochgeladen...");

                            const storageRef = storage.ref(`profile_images/${user.uid}`);
                            
                            const uploadTask = storageRef.put(file);

                            uploadTask.on('state_changed', 
                                (snapshot) => {
                                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                    console.log('Upload is ' + progress + '% done');
                                }, 
                                (error) => {
                                    console.error("Upload error:", error);
                                    alert("Fehler beim Hochladen des Bildes.");
                                }, 
                                () => {
                                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                                        profileAvatarImg.src = downloadURL;
                                        userDocRef.update({ profileImageUrl: downloadURL })
                                            .then(() => alert("Profilbild erfolgreich aktualisiert!"))
                                            .catch(err => {
                                                console.error("Error updating Firestore:", err);
                                                alert("Fehler beim Speichern des Bild-Links.");
                                            });
                                    });
                                }
                            );
                        });
                    }
                }
            });
        }

        // ==========================================================================
        // --- Logic for the "For You" Section on categories.html ---
        // ==========================================================================

        if (path.endsWith('categories.html')) {
            const forYouResultsContainer = document.getElementById('for-you-results');
            const moodButtons = document.querySelectorAll('.mood-button');

            // Attaches click listeners to the result cards
            function addResultCardListeners() {
                document.querySelectorAll('#for-you-results .result-card').forEach(card => {
                    card.addEventListener('click', (e) => {
                        const audioPath = e.currentTarget.dataset.audioPath;
                        const title = e.currentTarget.dataset.title;

                        if (audioPath && title) {
                            const fullUrl = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioPath)}&title=${encodeURIComponent(title)}`;
                            window.location.href = fullUrl;
                        }
                    });
                });
            }

            // Renders the fetched tracks inside a new, separate card
            function renderForYouResults(tracks) {
                if (tracks.length === 0) {
                    forYouResultsContainer.innerHTML = '';
                    return;
                }

                let html = '<div class="for-you-section">';
                html += '<h4 data-i18n="forYouSuggestions">Deine Vorschläge</h4>';

                tracks.forEach(track => {
                    const lang = localStorage.getItem('lang') || 'de';
                    const title = track[`title_${lang}`] || track.title_de || 'Unbenannter Track';
                    
                    // FINAL CORRECTED LOGIC: Use the 'path' field from DB and treat it as the base name.
                    const filename_from_db = track.path; // e.g., "subcat02_01.m4a"
                    let audioPath = '';
                    if (filename_from_db) {
                        // Remove extension to get the base name, e.g., "subcat02_01"
                        const filename_base = filename_from_db.split('.')[0];
                        audioPath = `${pathToRoot}assets/audio/subcategories/${lang}/${filename_base}_${lang}.m4a`;
                    }

                    if (audioPath) {
                        html += `
                            <div class="result-card" data-audio-path="${audioPath}" data-title="${title}">
                                <span class="result-card-title">${title}</span>
                                <img class="result-card-play-icon" src="${pathToRoot}assets/images/icons/play_icon_white.png" alt="Play">
                            </div>
                        `;
                    }
                });

                html += '</div>';
                forYouResultsContainer.innerHTML = html;
                loadTranslations(localStorage.getItem('lang') || 'de');
                addResultCardListeners(); // Add listeners after rendering
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

                    db.collection('audio_files')
                        .where('tags', 'array-contains', selectedTag)
                        .limit(3)
                        .get()
                        .then(snapshot => {
                            const tracks = [];
                            snapshot.forEach(doc => {
                                tracks.push({ id: doc.id, ...doc.data() });
                            });
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
    }
});