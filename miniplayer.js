document.addEventListener('DOMContentLoaded', () => {
    const miniplayer = document.getElementById('mini-player');
    if (!miniplayer) return;

    const icon = miniplayer.querySelector('img');
    const audioBaseName = miniplayer.dataset.audioBaseName;
    if (!audioBaseName) {
        console.error('Miniplayer: data-audio-basename attribute is missing!');
        return;
    }

    const lang = localStorage.getItem('lang') || 'de';
    // The path is relative to the HTML file, so we need to go up two levels.
    const audioSrc = `../../assets/audio/miniplayer/${audioBaseName}_${lang}.mp3`;

    const audio = new Audio(audioSrc);

    const playIcon = '../../assets/images/icons/play_icon_white_small.png';
    const pauseIcon = '../../assets/images/icons/pause_icon_white_small.png';

    miniplayer.addEventListener('click', () => {
        if (audio.paused) {
            // Pause all other audio elements on the page before playing a new one.
            document.querySelectorAll('audio').forEach(el => el.pause());
            audio.play();
        } else {
            audio.pause();
        }
    });

    audio.onplay = () => {
        icon.src = pauseIcon;
    };

    audio.onpause = () => {
        icon.src = playIcon;
    };

    audio.onended = () => {
        icon.src = playIcon;
    };

    // When the language changes, update the audio source
    window.addEventListener('storage', (e) => {
        if (e.key === 'lang') {
            const newLang = e.newValue || 'de';
            audio.src = `../../assets/audio/miniplayer/${audioBaseName}_${newLang}.mp3`;
            // Reset the player state
            audio.pause();
            icon.src = playIcon;
        }
    });

    // Stop audio when leaving the page
    window.addEventListener('beforeunload', () => {
        audio.pause();
    });
});
