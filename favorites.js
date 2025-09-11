document.addEventListener('DOMContentLoaded', () => {
    const favorites = JSON.parse(localStorage.getItem('favorites')) || [];

    function getPathToRoot() {
        const path = window.location.pathname;
        if (path.includes('/structure/subcategories/')) return '../../';
        if (path.includes('/structure/')) return '../';
        return './';
    }
    const pathToRoot = getPathToRoot();

    document.querySelectorAll('.subcategory-card').forEach(card => {
        const cardId = card.id;
        const lang = localStorage.getItem('lang') || 'de';
        const trackTitle = card.querySelector('h2').textContent;
        const audioFilePath = `${pathToRoot}assets/audio/subcategories/${lang}/${cardId}_${lang}.m4a`;

        const icon = card.querySelector('.favorite-icon');

        const isFavorite = favorites.some(fav => fav.id === cardId);

        if (isFavorite) {
            icon.src = `${pathToRoot}assets/images/icons/heart_active.png`;
        } else {
            icon.src = `${pathToRoot}assets/images/icons/heart_inactive.png`;
        }

        icon.addEventListener('click', (event) => {
            event.stopPropagation();
            let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
            const isFavorite = favorites.some(fav => fav.id === cardId);

            if (isFavorite) {
                // remove from favorites
                const newFavorites = favorites.filter(fav => fav.id !== cardId);
                localStorage.setItem('favorites', JSON.stringify(newFavorites));
                icon.src = `${pathToRoot}assets/images/icons/heart_inactive.png`;
            } else {
                // add to favorites
                const newFavorite = {
                    id: cardId,
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