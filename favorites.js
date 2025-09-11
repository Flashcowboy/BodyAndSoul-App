document.addEventListener('DOMContentLoaded', () => {
    const favorites = JSON.parse(localStorage.getItem('favorites')) || [];

    function getPathToRoot() {
        const path = window.location.pathname;
        if (path.includes('/structure/basics/')) return '../../';
        if (path.includes('/structure/subcategories/')) return '../../';
        if (path.includes('/structure/')) return '../';
        return './';
    }
    const pathToRoot = getPathToRoot();

    document.querySelectorAll('.subcategory-card').forEach(card => {
        const audioBaseName = card.dataset.audioBaseName;
        const cardId = card.id;
        const baseName = audioBaseName || cardId;

        if (!baseName) return;

        const lang = localStorage.getItem('lang') || 'de';
        const trackTitle = card.querySelector('h2').textContent;
        
        const currentPagePath = window.location.pathname;
        const audioSubFolder = currentPagePath.includes('/structure/basics/') ? 'basics/' : '';
        const audioFilePath = `${pathToRoot}assets/audio/subcategories/${audioSubFolder}${lang}/${baseName}_${lang}.m4a`;

        const icon = card.querySelector('.favorite-icon');
        if (!icon) return;

        const isFavorite = favorites.some(fav => fav.id === baseName);

        if (isFavorite) {
            icon.src = `${pathToRoot}assets/images/icons/heart_active.png`;
        } else {
            icon.src = `${pathToRoot}assets/images/icons/heart_inactive.png`;
        }

        icon.addEventListener('click', (event) => {
            event.stopPropagation();
            let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
            const isFavorite = favorites.some(fav => fav.id === baseName);

            if (isFavorite) {
                const newFavorites = favorites.filter(fav => fav.id !== baseName);
                localStorage.setItem('favorites', JSON.stringify(newFavorites));
                icon.src = `${pathToRoot}assets/images/icons/heart_inactive.png`;
            } else {
                const newFavorite = {
                    id: baseName,
                    title: trackTitle,
                    audioSrc: audioFilePath
                };
                favorites.push(newFavorite);
                localStorage.setItem('favorites', JSON.stringify(favorites));
                icon.src = `${pathToRoot}assets/images/icons/heart_active.png`;
            }
        });
    });
});
