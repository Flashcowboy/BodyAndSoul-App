document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            const urlParams = new URLSearchParams(window.location.search);
            const isChallenge = urlParams.get('challenge') === 'true';

            if (isChallenge) {
                // Assuming the course ID can be derived from the first subcategory card's ID
                const firstCard = document.querySelector('.subcategory-card');
                if (!firstCard) return;

                const cardId = firstCard.id; // e.g., "subcat_basics_02_01"
                const courseId = cardId.substring(0, cardId.lastIndexOf('_')); // e.g., "subcat_basics_02"

                if (!courseId) return;

                const db = firebase.firestore();
                const userCourseRef = db.collection('userCourses').doc(`${user.uid}_${courseId}`);

                userCourseRef.get().then((doc) => {
                    if (doc.exists) {
                        // Course already started, do nothing special
                        console.log("Course already started.");
                    } else {
                        // Course not started yet, ask for confirmation
                        const confirmationMessage = "Möchten Sie diesen 14-tägigen Kurs wirklich starten? Dieser Schritt kann nicht rückgängig gemacht werden.";
                        if (confirm(confirmationMessage)) {
                            // User confirmed, save to Firestore
                            userCourseRef.set({
                                userId: user.uid,
                                courseId: courseId,
                                startDate: firebase.firestore.FieldValue.serverTimestamp(),
                                status: 'started'
                            }).then(() => {
                                console.log("Course started and saved to Firestore.");
                            }).catch(error => {
                                console.error("Error starting course: ", error);
                            });
                        } else {
                            // User cancelled, redirect
                            console.log("Course start cancelled by user.");
                            // Redirect to the previous page or a default page
                            if (document.referrer) {
                                window.history.back();
                            } else {
                                window.location.href = '/index.html'; // Fallback
                            }
                        }
                    }
                }).catch(error => {
                    console.error("Error checking course status: ", error);
                });
            }
        } else {
            // User is not logged in
            console.log("User is not logged in. Course logic will not run.");
        }
    });
});
