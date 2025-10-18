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
    // Files are stored as /assets/audio/miniplayer/<base>_<lang>.m4a (flat, no lang folders)
    function buildSrc(l){
        const safe = (l || 'de').replace(/[^a-z]/gi,'').substring(0,2);
        return `${window.location.origin}/assets/audio/miniplayer/${audioBaseName}_${safe}.m4a`;
    }
    const audioSrc = buildSrc(lang);

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
    function reloadForLang(newLang){
        audio.src = buildSrc(newLang);
        audio.pause();
        icon.src = playIcon;
    }
    window.addEventListener('storage', (e) => {
        if (e.key === 'lang') reloadForLang(e.newValue || 'de');
    });
    // React to internal language change events fired by loadTranslations
    window.addEventListener('lang-changed', (e) => {
        const newLang = (e && e.detail && e.detail.lang) || (localStorage.getItem('lang') || 'de');
        reloadForLang(newLang);
    });

    // Stop audio when leaving the page
    window.addEventListener('beforeunload', () => {
        audio.pause();
    });
});
