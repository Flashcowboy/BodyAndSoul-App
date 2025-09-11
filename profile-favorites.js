document.addEventListener('DOMContentLoaded', () => {
    const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
    const favoritesContainer = document.querySelector('.section .settings-list');

    // Clear placeholder items
    favoritesContainer.innerHTML = '';

    if (favorites.length === 0) {
        const noFavorites = document.createElement('div');
        noFavorites.textContent = 'Noch keine Favoriten hinzugefügt.';
        noFavorites.style.textAlign = 'center';
        noFavorites.style.padding = '20px';
        favoritesContainer.appendChild(noFavorites);
        return;
    }

    favorites.forEach(fav => {
        const favoriteItem = document.createElement('div');
        favoriteItem.classList.add('setting-item');
        favoriteItem.style.cursor = 'pointer';

        const label = document.createElement('span');
        label.classList.add('label');
        label.textContent = fav.title;

        const action = document.createElement('span');
        action.classList.add('action');
        action.textContent = '>';

        favoriteItem.appendChild(label);
        favoriteItem.appendChild(action);

        favoriteItem.addEventListener('click', () => {
            window.location.href = `player.html?audio=${encodeURIComponent(fav.audioSrc)}&title=${encodeURIComponent(fav.title)}`;
        });

        favoritesContainer.appendChild(favoriteItem);
    });
});