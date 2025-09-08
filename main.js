

// ==========================================================================
// --- 2. AUTH GUARD (Global Scope) ---
// ==========================================================================
if (auth) {
    auth.onAuthStateChanged(user => {
        const path = window.location.pathname;
        const isProtectedPage = path.includes('/structure/');
        const isAuthPage = path.endsWith('login.html') || path.endsWith('register.html');

        const pathToRoot = (() => {
            if (path.includes('/structure/subcategories/')) return '../../';
            if (path.includes('/structure/')) return '../';
            return './';
        })();

        if (isProtectedPage && !user) {
            return window.location.replace(`${pathToRoot}login.html`);
        }
        if (isAuthPage && user) {
            return window.location.replace(`${pathToRoot}structure/categories.html`);
        }
    });
}

// ==========================================================================
// --- 3. DOM-RELATED LOGIC ---
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- Helper Functions ---
    function getPathToRoot() {
        const path = window.location.pathname;
        if (path.includes('/structure/subcategories/')) return '../../';
        if (path.includes('/structure/')) return '../';
        return './';
    }

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

    function initializeLanguage() {
        const lang = localStorage.getItem('lang') || 'de';
        loadTranslations(lang);
    }

    initializeLanguage();

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
    document.querySelectorAll('.subcategory-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const cardId = e.currentTarget.id;
            const lang = localStorage.getItem('lang') || 'de';
            const trackTitle = e.currentTarget.querySelector('h2').textContent;
            if (cardId) {
                const audioFilePath = `${pathToRoot}assets/audio/subcategories/${lang}/${cardId}_${lang}.mp3`;
                window.location.href = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioFilePath)}&title=${encodeURIComponent(trackTitle)}`;
            }
        });
    });

    // ==========================================================================
    // --- 5. Audio Player LOGIC ---
    // ==========================================================================
   
    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const rewindBtn = document.getElementById('rewind-btn');
        const forwardBtn = document.getElementById('forward-btn');
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const currentTimeSpan = document.getElementById('current-time');
        const durationSpan = document.getElementById('duration');
        const trackTitleElement = document.getElementById('track-title');
        const urlParams = new URLSearchParams(window.location.search);
        const audioSrc = decodeURIComponent(urlParams.get('audio') || '');
        const trackTitle = decodeURIComponent(urlParams.get('title') || '');

        if (audioSrc) audioPlayer.src = audioSrc;
        if (trackTitle && trackTitleElement) trackTitleElement.textContent = trackTitle;

        if(playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (audioPlayer.paused) {
                    audioPlayer.play();
                    playPauseBtn.src = `${pathToRoot}assets/images/icons/pause_icon_black.png`;
                } else {
                    audioPlayer.pause();
                    playPauseBtn.src = `${pathToRoot}assets/images/icons/play_icon_black.png`;
                }
            });
        }
        if(rewindBtn) rewindBtn.addEventListener('click', () => { audioPlayer.currentTime -= 15; });
        if(forwardBtn) forwardBtn.addEventListener('click', () => { audioPlayer.currentTime += 15; });
        
        audioPlayer.addEventListener('timeupdate', () => {
            const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            if(progressBar) progressBar.style.width = `${progress}%`;
            if(currentTimeSpan) currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
        });
        audioPlayer.addEventListener('loadedmetadata', () => {
            if(durationSpan) durationSpan.textContent = formatTime(audioPlayer.duration);
        });
        
        let isDragging = false;

        const handleDragStart = (e) => {
            isDragging = true;
            handleDragMove(e);
        };

        const handleDragEnd = () => {
            isDragging = false;
        };

        const handleDragMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
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

            progressContainer.addEventListener('touchstart', handleDragStart);
            document.addEventListener('touchend', handleDragEnd);
            document.addEventListener('touchmove', handleDragMove);
        }
    }

    // ==========================================================================
    // --- 6. Register Page Logic (Publicly Accessible) ---
    // ==========================================================================
    /*
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
                        console.log("DEBUG: User created in Auth. UID:", cred.user.uid);
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
                            listeningTime: 0,
                            sessions: 0,
                            streak: 0
                        };
                        console.log("DEBUG: Attempting to write to Firestore with this data:", userProfileData);
                        return db.collection('User_Profiles').doc(cred.user.uid).set(userProfileData);
                    })
                    .then(() => {
                        console.log("DEBUG: Firestore write SUCCEEDED. Redirecting to success page.");
                        window.location.href = `${pathToRoot}registration_success.html`;
                    })
                    .catch((err) => {
                        // --- TEMPORARY DEBUGGING BLOCK ---
                        console.error("--- REGISTRATION ERROR CATCH BLOCK ---");
                        console.error("Full error object:", err);
                        console.error("Error code:", err.code);
                        console.error("Error message:", err.message);
                        alert("Ein Fehler ist aufgetreten. Bitte die Entwicklerkonsole prüfen.");
                        // Temporarily disabled redirect to see the console logs.
                        window.location.href = `${pathToRoot}registration_error.html`; 
                    });
            });
        }
    }
        */

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
                            const profileUsername = document.querySelector('.profile-info h2');
                            if (profileUsername) {
                                const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                                profileUsername.textContent = fullName || 'Unbekannter Nutzer';
                            }
                            document.querySelector('.profile-info p').textContent = userData.email;
                            
                            if (userData.profileImageUrl) {
                                profileAvatarImg.src = userData.profileImageUrl;
                            } else {
                                profileAvatarImg.src = '../assets/images/profile_img.jpg';
                            }

                            const statsGrid = document.querySelector('.stats-grid');
                            if (statsGrid) {
                                statsGrid.querySelector('[data-i18n="profile_stats_sessions"]').previousElementSibling.textContent = userData.sessions || 0;
                                statsGrid.querySelector('[data-i18n="profile_stats_listening_time"]').previousElementSibling.textContent = `${userData.listeningTime || 0}h`;
                                statsGrid.querySelector('[data-i18n="profile_stats_streak"]').previousElementSibling.textContent = userData.streak || 0;
                            }
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
                                                profileUsername.textContent = newName.trim();
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

                    // Handle file upload
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
        // --- Logic for the "For You" Section on categories.html ---
            if (path.endsWith('categories.html')) {
                const forYouResultsContainer = document.getElementById('for-you-results');
                const moodButtons = document.querySelectorAll('.mood-button');

                // Function to render the category cards
                function renderForYouCards(tracks) {
                    let html = '';
                    if (tracks.length === 0) {
                        html = `<p data-i18n="noResults">Keine passenden Übungen gefunden.</p>`;
                    } else {
                        tracks.forEach(track => {
                            const lang = localStorage.getItem('lang') || 'de';
                            const titleKey = `title_${lang}`;
                            const title = track[titleKey] || track.title_de; // Fallback to German
                            const imagePath = track.image_path ? `${pathToRoot}${track.image_path}` : `${pathToRoot}assets/images/categories/cat_01.png`; // Fallback image
                            const audioPath = track.path;
                            const docId = track.id; // Assuming you pass the document ID

                            html += `
                                <div class="category-card" onclick="window.location.href = '${pathToRoot}structure/player.html?audio=${encodeURIComponent(audioPath)}&title=${encodeURIComponent(title)}';">
                                    <img src="${imagePath}" alt="${title}">
                                    <div class="card-text">
                                        <h2>${title}</h2>
                                    </div>
                                </div>
                            `;
                        });
                    }
                    forYouResultsContainer.innerHTML = html;
                    loadTranslations(localStorage.getItem('lang') || 'de'); // Reload translations for new elements
                }

                moodButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        const selectedTag = button.getAttribute('data-tag');
                        
                        // Highlight the selected button
                        moodButtons.forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');

                        // Clear previous results
                        forYouResultsContainer.innerHTML = `<p data-i18n="loading">Lädt...</p>`;

                        // Fetch data from Firestore
                        db.collection('audio_tracks') // Adjust collection name if different
                            .where('tags', 'array-contains', selectedTag)
                            .limit(3) // Suggest only 3 tracks for a clean UI
                            .get()
                            .then(snapshot => {
                                const tracks = [];
                                snapshot.forEach(doc => {
                                    tracks.push({ id: doc.id, ...doc.data() });
                                });
                                renderForYouCards(tracks);
                            })
                            .catch(error => {
                                console.error("Error fetching tracks:", error);
                                forYouResultsContainer.innerHTML = `<p data-i18n="error">Fehler beim Laden der Übungen.</p>`;
                                loadTranslations(localStorage.getItem('lang') || 'de');
                            });
                    });
                });
            }
    }
});
