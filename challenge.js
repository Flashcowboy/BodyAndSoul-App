// Challenge Module: handles 14-day challenge progress across pages
// Firestore structure:
// Collection: userChallenges
//   Document ID: <uid>_<challengeId>
//     Fields: startedAt (Timestamp), updatedAt (Timestamp), days: { <YYYY-MM-DD>: { completedAt: Timestamp, duration: number } }
// We derive completedDayCount = Object.keys(days).length (max 14)
// challengeId can be derived from subcategory or course context (e.g., 'basics', 'sleep', etc.) passed via URL param `challengeId` or fallback to page slug.

(function(global){
  const state = {
    challengeId: null,
    days: {},
    loaded: false,
    maxDays: 14,
  };

  function getChallengeId(){
    if(state.challengeId) return state.challengeId;
    const params = new URLSearchParams(location.search);
    const explicit = params.get('challengeId');
    if(explicit){ state.challengeId = explicit; return explicit; }
    // Fallback: use first path segment after last slash w/o extension
    const path = location.pathname.split('/').pop().replace(/\.html$/,'');
    state.challengeId = path; // e.g., basics_breathing
    return state.challengeId;
  }

  async function loadProgress(){
    await waitForAuth();
    const user = global.auth && global.auth.currentUser;
    if(!user || !global.db){ return; }
    const challengeId = getChallengeId();
    const docRef = global.db.collection('userChallenges').doc(`${user.uid}_${challengeId}`);
    const snap = await docRef.get();
    if(snap.exists){
      const data = snap.data();
      state.days = data.days || {};
    }
    state.loaded = true;
  }

  async function recordCompletion(durationSeconds){
    await waitForAuth();
    const user = global.auth && global.auth.currentUser;
    if(!user || !global.db) return;
    const challengeId = getChallengeId();
    const today = new Date().toISOString().slice(0,10);
    const docRef = global.db.collection('userChallenges').doc(`${user.uid}_${challengeId}`);

    await global.db.runTransaction(async (tx)=>{
      const doc = await tx.get(docRef);
      let data = { startedAt: global.firebase.firestore.FieldValue.serverTimestamp(), days: {} };
      if(doc.exists){ data = doc.data(); }
      if(!data.days) data.days = {};
      if(!data.days[today]){
        data.days[today] = { completedAt: global.firebase.firestore.FieldValue.serverTimestamp(), duration: durationSeconds || 0 };
      }
      data.updatedAt = global.firebase.firestore.FieldValue.serverTimestamp();
      tx.set(docRef, data, { merge: true });
      state.days = data.days;
    });
  }

  function renderTimeline(containerSelector='#course-timeline-container'){
    const params = new URLSearchParams(location.search);
    const isChallenge = params.get('challenge') === 'true';
    if(!isChallenge) return; // Only render in challenge mode
  const container = document.querySelector(containerSelector);
    if(!container) return;
    const wrapper = container.querySelector('.timeline-wrapper') || (function(){
      const w = document.createElement('div');
      w.className = 'timeline-wrapper';
      container.appendChild(w); return w;
    })();

    wrapper.innerHTML = ''; // reset
    const line = document.createElement('div');
    line.className = 'timeline-line';
    wrapper.appendChild(line);

    const completedDays = Object.keys(state.days).length;
    // Determine how many nodes to show: at least completedDays+1 (next) capped by maxDays
    const showCount = Math.min(state.maxDays, Math.max(completedDays + 1, completedDays));

    for(let i=1;i<=showCount;i++){
      const node = document.createElement('div');
      node.className = 'timeline-node';
      const circle = document.createElement('div');
      circle.className = 'node-circle';
      circle.textContent = i;
      const label = document.createElement('div');
      label.className = 'node-label';
      label.textContent = 'Tag ' + i;
      if(i <= completedDays){
        node.classList.add('completed');
      } else if(i === completedDays + 1){
        node.classList.add('active');
        label.textContent += ' (Nächste Übung)';
      }
      node.appendChild(circle); node.appendChild(label); wrapper.appendChild(node);
    }

    // Expand container with animation
    requestAnimationFrame(()=>{
      const height = wrapper.scrollHeight;
      container.style.height = height + 'px';
      container.style.padding = '20px';
      // Prevent the timeline from intercepting clicks on tiles above/below
      container.style.pointerEvents = 'none';
      wrapper.style.pointerEvents = 'none';
    });
  }

  async function initChallengeTimeline(){
    const params = new URLSearchParams(location.search);
    if(params.get('challenge') !== 'true') return; // only when challenge active
    await loadProgress();
    renderTimeline();
  }

  async function resetChallengeProgress(){
    await waitForAuth();
    const user = global.auth && global.auth.currentUser;
    if(!user || !global.db) return;
    const challengeId = getChallengeId();
    await global.db.collection('userChallenges').doc(`${user.uid}_${challengeId}`).delete();
    state.days = {}; state.loaded = false;
    console.log('Challenge progress reset for', challengeId);
    await loadProgress();
    renderTimeline();
  }

  function waitForAuth(){
    return new Promise(resolve=>{
      if(global.auth && global.auth.currentUser) return resolve();
      const unsub = global.auth.onAuthStateChanged(()=>{ unsub(); resolve(); });
    });
  }

  // Expose API
  global.Challenge = { initChallengeTimeline, recordCompletion, resetChallengeProgress, loadProgress, renderTimeline };

  // Auto-init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', ()=>{ initChallengeTimeline(); });

})(window);
