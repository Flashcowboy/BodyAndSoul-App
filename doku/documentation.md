# Dokumentation der Body & Soul App

## 1. Überblick über die App

Die Body & Soul App ist eine webbasierte Anwendung, die Nutzern Zugang zu Audioinhalten (z.B. Meditationen, Entspannungsübungen) bietet. Sie verfügt über grundlegende Benutzerverwaltungsfunktionen und einen Audio-Player.

### Kerntechnologien:

*   **Frontend:** HTML, CSS, JavaScript
*   **Backend-Services:** Google Firebase
    *   **Firebase Authentication:** Für Benutzerregistrierung, Login, Logout und Passwortverwaltung.
    *   **Cloud Firestore:** Eine NoSQL-Datenbank zum Speichern von Benutzerprofilen und anwendungsspezifischen Daten.
    *   **Firebase Storage:** Zum Speichern von hochgeladenen Dateien, insbesondere Profilbildern.

### Hauptfunktionen:

*   Benutzerauthentifizierung (Registrierung, Login, Passwort zurücksetzen, Logout)
*   Audio-Wiedergabe mit Fortschrittsbalken und Steuerelementen
*   Benutzerprofilverwaltung (Anzeige von Statistiken, Bearbeitung des Namens, **Upload und Anzeige von Profilbildern**)
*   Mehrsprachigkeit (Deutsch/Englisch)

---

## 2. Implementierung der Benutzerprofilverwaltung

Die Benutzerprofilverwaltung ist ein zentraler Bestandteil der App und nutzt mehrere Firebase-Dienste.

### 2.1. Firebase-Dienste im Einsatz

*   **Firebase Authentication:** Wird für die Identitätsverwaltung der Benutzer verwendet. Hier werden Benutzerkonten erstellt, Anmeldungen verifiziert und Passwörter zurückgesetzt.
*   **Cloud Firestore:** Dient als primäre Datenbank für benutzerbezogene Daten. Jedes Benutzerkonto in Firebase Authentication hat ein entsprechendes Dokument in Firestore, das zusätzliche Profilinformationen speichert.
*   **Firebase Storage:** Ist der Dienst zum Speichern von Dateien. Er wird speziell für das Hochladen und Speichern von Benutzerprofilbildern verwendet.

### 2.2. Benutzerregistrierung und Datenspeicherung

*   Bei der Registrierung eines neuen Benutzers über `auth.createUserWithEmailAndPassword()` wird ein neues Benutzerkonto in Firebase Authentication erstellt.
*   Gleichzeitig wird ein neues Dokument in der Firestore-Sammlung `users` angelegt. Die ID dieses Dokuments entspricht der eindeutigen Benutzer-ID (UID) von Firebase Authentication.
*   Dieses Dokument speichert anfängliche Benutzerdaten wie `email`, `name` (standardmäßig die E-Mail-Adresse), `createdAt` (Erstellungsdatum) und anwendungsspezifische Statistiken wie `listeningTime`, `sessions` und `streak`.

### 2.3. Benutzer-Login und Sitzungsverwaltung

*   Der Login erfolgt über `auth.signInWithEmailAndPassword()`.
*   Die Sitzungsverwaltung wird von Firebase Authentication übernommen.
*   Ein globaler `auth.onAuthStateChanged`-Listener in `main.js` dient als "Auth Guard":
    *   Er leitet angemeldete Benutzer von Authentifizierungsseiten (Login, Registrierung) zur Hauptanwendung (`categories.html`) weiter.
    *   Er leitet nicht angemeldete Benutzer von geschützten Seiten (im `structure`-Ordner) zur `login.html` um.

### 2.4. Funktionalität der Profilseite (`profile.html`)

Die `profile.html` ist das zentrale Element für die Benutzerprofilverwaltung.

*   **Datenladung:** Beim Laden der Profilseite wird das Benutzerdokument aus Firestore abgerufen. Benutzername, E-Mail und Statistiken werden auf der Seite angezeigt.
*   **Namen bearbeiten:** Benutzer können ihren Namen über eine Eingabeaufforderung ändern. Die Änderung wird im `name`-Feld des Benutzerdokuments in Firestore aktualisiert.
*   **Passwort zurücksetzen:** Über die Profilseite kann eine E-Mail zum Zurücksetzen des Passworts an die registrierte E-Mail-Adresse des Benutzers gesendet werden.
*   **Logout:** Der Logout-Button ruft `auth.signOut()` auf, beendet die Benutzersitzung und leitet zur `login.html` weiter.
*   **Profilbildverwaltung (Neu implementiert):**
    *   **HTML-Änderungen (`profile.html`):**
        *   Das `<img>`-Tag für das Profilbild hat nun die ID `profile-avatar-img`.
        *   Ein verstecktes `<input type="file" id="profile-image-upload" accept="image/*" style="display: none;">` wurde hinzugefügt, um die Dateiauswahl zu ermöglichen.
        *   Das Firebase Storage SDK (`firebase-storage.js`) wurde in die Seite eingebunden.
    *   **JavaScript-Logik (`main.js`):**
        *   `firebase.storage()` wird initialisiert.
        *   Die Hauptbedingung für Firebase-abhängige Logik wurde auf `if (auth && db && storage)` erweitert.
        *   **Laden des Profilbilds:** Beim Abrufen der Benutzerdaten aus Firestore wird geprüft, ob `userData.profileImageUrl` existiert. Wenn ja, wird der `src` des `profile-avatar-img` auf diese URL gesetzt; andernfalls wird ein Standardbild verwendet.
        *   **Hochladen des Profilbilds:**
            *   Ein Klick auf das `profile-avatar-img` löst einen Klick auf das versteckte `profile-image-upload`-Eingabefeld aus.
            *   Wenn eine Datei ausgewählt wird, wird diese in Firebase Storage unter dem Pfad `profile_images/{user.uid}` hochgeladen.
            *   Nach erfolgreichem Upload wird die Download-URL des Bildes abgerufen.
            *   Diese `downloadURL` wird im Feld `profileImageUrl` des Benutzerdokuments in Firestore gespeichert.
            *   Das `profile-avatar-img` auf der Seite wird sofort mit der neuen URL aktualisiert, um visuelles Feedback zu geben.

### 2.5. Überprüfung in der Firebase Console

Um die Benutzerdaten und hochgeladenen Profilbilder in der Firebase Console zu überprüfen, navigieren Sie zu den entsprechenden Diensten:

*   **Benutzerdaten (Profil-Einstellungen):**
    *   Gehen Sie zu **"Firestore Database"**.
    *   Navigieren Sie zur Sammlung `users`.
    *   Suchen Sie das Dokument, das der Benutzer-ID (UID) des jeweiligen Benutzers entspricht. Hier finden Sie Felder wie `email`, `name`, `listeningTime`, `sessions`, `streak` und `profileImageUrl`.
    *   Direkter Link: [https://console.firebase.google.com/project/body-and-soul-app/firestore/data/~2Fusers](https://console.firebase.google.com/project/body-and-soul-app/firestore/data/~2Fusers)

*   **Profilbilder:**
    *   Gehen Sie zu **"Storage"** (oder "Cloud Storage").
    *   Stellen Sie sicher, dass der richtige Speicher-Bucket ausgewählt ist (standardmäßig `body-and-soul-app.appspot.com` oder ähnlich).
    *   Navigieren Sie im "Files"-Tab (Dateien) zum Ordner `profile_images`.
    *   Dort sollten Sie die hochgeladenen Bilder finden, benannt nach der Benutzer-ID (UID) des jeweiligen Benutzers.
    *   Direkter Link: [https://console.firebase.google.com/project/body-and-soul-app/storage](https://console.firebase.google.com/project/body-and-soul-app/storage)

Stellen Sie sicher, dass Sie in der Firebase Console mit dem Google-Konto angemeldet sind, das Zugriff auf das Firebase-Projekt `body-and-soul-app` hat.

---

## 3. Audio-Player-Verbesserungen

Der Audio-Player in `player.html` wurde um wichtige Funktionen erweitert:

*   **Drag-Funktionalität auf Mobilgeräten:** Der Fortschrittsbalken kann nun auch auf mobilen Geräten per Drag & Drop bedient werden, um die Abspielposition zu ändern.
*   **Reaktionsschnelle UI-Aktualisierung:** Während des Ziehens des Fortschrittsbalkens werden die visuelle Anzeige des Balkens und die aktuelle Zeitanzeige manuell aktualisiert. Dies gewährleistet ein sofortiges visuelles Feedback und eine reibungslose Benutzererfahrung, auch wenn die tatsächliche Audio-Positionierung durch den Browser leicht verzögert wird.

---

## 4. Projektstruktur

Die folgende Struktur zeigt die Organisation der bisher erstellten Dateien und Verzeichnisse innerhalb des Projekts:

```
/Applications/XAMPP/xamppfiles/htdocs/
├───.DS_Store
├───.firebaserc
├───favicon.ico
├───index.html
├───login_error.html
├───login.html
├───main.js
├───manifest.json
├───password_reset.html
├───register.html
├───registration_error.html
├───registration_success.html
├───service-worker.js
├───styles.css
├───.git/...
├───assets/
│   ├───.DS_Store
│   ├───audio/
│   │   ├───.DS_Store
│   │   ├───AT_Aufwachen_Abnehmen_mit Einleitung.mp3
│   │   ├───AT_Aufwachen_Abnehmen_ohne Einleitung.mp3
│   │   ├───AT_Aufwachen_für Anfänger_mit Einleitung.mp3
│   │   ├───AT_Aufwachen_für Anfänger_ohne Einleitung.mp3
│   │   ├───AT_Aufwachen_für Fortgeschrittene_mit Einleitung.mp3
│   │   ├───AT_Aufwachen_für Fortgeschrittene_ohne Einleitung.mp3
│   │   ├───AT_Einschlafen_Abnehmen_ohne Einleitung.mp3
│   │   ├───AT_Einschlafen_für Anfänger_mit Einleitung.mp3
│   │   ├───AT_Einschlafen_für Anfänger_ohne Einleitung.mp3
│   │   ├───AT_Einschlafen_für Fortgeschrittene_mit Einleitung.mp3
│   │   ├───AT_Einschlafen_für Fortgeschrittene_ohne Einleitung.mp3
│   │   ├───sample_audio1.mp3
│   │   └───Subcategories/
│   │       ├───.DS_Store
│   │       ├───de/
│   │       │   ├───AT_Aufwachen_Abnehmen_mit Einleitung.mp3
│   │       │   ├───AT_Aufwachen_Abnehmen_ohne Einleitung.mp3
│   │       │   ├───AT_Aufwachen_für Anfänger_mit Einleitung.mp3
│   │       │   ├───AT_Aufwachen_für Anfänger_ohne Einleitung.mp3
│   │       │   ├───AT_Aufwachen_für Fortgeschrittene_mit Einleitung.mp3
│   │       │   ├───AT_Aufwachen_für Fortgeschrittene_ohne Einleitung.mp3
│   │       │   ├───AT_Einschlafen_Abnehmen_ohne Einleitung.mp3
│   │       │   ├───AT_Einschlafen_für Anfänger_mit Einleitung.mp3
│   │       │   ├───AT_Einschlafen_für Anfänger_ohne Einleitung.mp3
│   │       │   ├───AT_Einschlafen_für Fortgeschrittene_mit Einleitung.mp3
│   │       │   ├───AT_Einschlafen_für Fortgeschrittene_ohne Einleitung.mp3
│   │       │   ├───subcat02_01_de.mp3
│   │       │   └───subcat02_03_de.mp3
│   │       └───en/
│   │           ├───subcat02_01_en.mp3
│   │           └───subcat02_03_en.mp3
│   └───images/
│       ├───.DS_Store
│       ├───profile_img.JPG
│       ├───splash_screen_bg.png
│       ├───splash_screen.png
│       ├───categories/
│       │   ├───.DS_Store
│       │   ├───cat_01.png
│   │       ├───cat_02.png
│   │       └───cat_03.png
│       ├───icons/
│       │   ├───.DS_Store
│       │   ├───bell.png
│       │   ├───Body&Soul_logo__bg192.png
│       │   ├───Body&Soul_logo__bg512.png
│       │   ├───calendar.png
│       │   ├───contact.png
│       │   ├───email.png
│       │   ├───forward15_icon_black.png
│       │   ├───gear.png
│       │   ├───heart.png
│       │   ├───home.png
│       │   ├───lotus.png
│       │   ├───moon.png
│       │   ├───music.png
│       │   ├───pause_Icon_black.png
│       │   ├───pause_Icon_white.png
│       │   ├───phone.png
│       │   ├───play_Icon_black.png
│       │   ├───play_Icon_white.png
│       │   ├───rewind15_icon_black.png
│       │   ├───watch.png
│       │   └───yoga.png
│       └───subcategories/
│           ├───.DS_Store
│           ├───subcat_01/
│           └───subcat_02/
│               ├───subcat_01.png
│               ├───subcat_02.png
│               ├───subcat_03.png
│               ├───subcat_04.png
│               ├───subcat_05.png
│               └───subcat_06.png
├───locales/
│   ├───.DS_Store
│   ├───de.json
│   └───en.json
└───structure/
    ├───.DS_Store
    ├───categories.html
    ├───player.html
    ├───profile.html
    ├───settings.html
    └───subcategories/
        ├───.DS_Store
        ├───subcat01_whatisat.html
        ├───subcat02_basics.html
        ├───subcat03_sleep.html
        ├───subcat04_success.html
        ├───subcat05_weightloss.html
        ├───subcat06_emotions.html
        ├───subcat07_health.html
        ├───subcat08_relaxed.html
        ├───subcat09_habits.html
        ├───subcat10_smokeless.html
        └───subcat11_selfconfidence.html
```
Profilbild mit Token, aus Firebase Storage
https://firebasestorage.googleapis.com/v0/b/body-and-soul-app.firebasestorage.app/o/profile_images%2FEtZBmwXQjgfBtHVAnR5Cv927DMl1?alt=media&token=a290cdc7-c467-4add-8e6e-48d16c4c8fce

