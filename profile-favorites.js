document.addEventListener('DOMContentLoaded', () => {
    const favoritesContainer = document.querySelector('.section .settings-list');
    
    if (!favoritesContainer) return;

    favoritesContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Favoriten werden geladen...</p>';

    auth.onAuthStateChanged(user => {
        if (user) {
            const userDocRef = db.collection('User_Profiles').doc(user.uid);

            userDocRef.onSnapshot(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const favoritesMap = userData.favorites || {};
                    const favorites = Object.values(favoritesMap);

                    favoritesContainer.innerHTML = '';

                    if (favorites.length === 0) {
                        const noFavorites = document.createElement('div');
                        noFavorites.setAttribute('data-i18n', 'profile_favorites_empty');
                        noFavorites.textContent = 'Noch keine Favoriten hinzugefügt.';
                        noFavorites.style.textAlign = 'center';
                        noFavorites.style.padding = '20px';
                        favoritesContainer.appendChild(noFavorites);
                        // Manually trigger translation for this element
                        loadTranslations(localStorage.getItem('lang') || 'de');
                        return;
                    }

                    favorites.sort((a, b) => a.title.localeCompare(b.title)).forEach(fav => {
                        const favoriteItem = document.createElement('div');
                        favoriteItem.classList.add('setting-item');
                        favoriteItem.style.cursor = 'pointer';

                        const label = document.createElement('span');
                        label.classList.add('label');
                        label.innerHTML = fav.title; // Use innerHTML to render HTML tags

                        const action = document.createElement('span');
                        action.classList.add('action');
                        action.textContent = '>';

                        favoriteItem.appendChild(label);
                        favoriteItem.appendChild(action);

                        favoriteItem.addEventListener('click', () => {
                            const pathToRoot = getPathToRoot();
                            const playerUrl = `${pathToRoot}structure/player.html?audio=${encodeURIComponent(fav.audioSrc)}&title=${encodeURIComponent(fav.title)}`;
                            window.location.href = playerUrl;
                        });

                        favoritesContainer.appendChild(favoriteItem);
                    });
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
