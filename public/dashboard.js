// Encrypt email
function encryptEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 1) return email;
  return local[0] + '*'.repeat(local.length - 1) + '@' + domain;
}
 
// Load user info
function loadUserInfo() {
  const fullName = localStorage.getItem('userName') || localStorage.getItem('tandem_username') || 'User';
  const username = localStorage.getItem('tandem_username') || '';
  const profilePic = localStorage.getItem('tandem_profile_pic') || null;

  const profileUsernameEl = document.getElementById('profileUsername');
  if (profileUsernameEl) profileUsernameEl.textContent = fullName;

  const profileEmailEl = document.getElementById('profileEmail');
  if (profileEmailEl) profileEmailEl.textContent = username ? '@' + username : '';
 
  if (profilePic) {
    const avatarContainer = document.getElementById('avatarContainer');
    if (avatarContainer) {
      avatarContainer.innerHTML = `<img src="${profilePic}" alt="Profile Picture"
        style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }
  }
}
 
// Credits system
function getCredits() {
  const stored = localStorage.getItem('tandem_credits');
  if (stored === null || stored === 'undefined') {
    localStorage.setItem('tandem_credits', '5');
    return 5;
  }
  return parseInt(stored, 10);
}
 
async function setCredits(amount) {
  localStorage.setItem('tandem_credits', String(amount));
  updateCreditsDisplay(amount);
  const email = localStorage.getItem('userEmail');
  if (email) {
    try {
      await fetch('http://localhost:3000/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credits: amount })
      });
    } catch(err) { console.error('Error saving credits:', err); }
  }
}
 
function updateCreditsDisplay(amount) {
  const totalEl = document.getElementById('totalCredits');
  if (totalEl) totalEl.textContent = amount;
  const topBadgeEl = document.getElementById('topCreditsBadge');
  if (topBadgeEl) topBadgeEl.textContent = amount;
}
 
function checkProfileCompletion() {
  const profileCompleted = localStorage.getItem('profile_completed') === 'true';
  const hasSkills = localStorage.getItem('tandem_skills') && JSON.parse(localStorage.getItem('tandem_skills') || '[]').length > 0;
  const hasGrowth = localStorage.getItem('tandem_growth') && JSON.parse(localStorage.getItem('tandem_growth') || '[]').length > 0;
  const hasGrade = localStorage.getItem('tandem_grade');
  if (!profileCompleted || !hasSkills || !hasGrowth || !hasGrade) {
    window.location.href = 'complete-profile.html';
    return false;
  }
  return true;
}
 
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
 
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast-show');
  setTimeout(() => toast.classList.remove('toast-show'), 3500);
}
 
// Logout
async function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    const email = localStorage.getItem('userEmail');
    const currentCredits = getCredits();
    if (email && currentCredits) {
      try {
        await fetch('http://localhost:3000/update-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, credits: currentCredits })
        });
      } catch(err) { console.error('Error saving credits:', err); }
    }
    setTimeout(() => { localStorage.clear(); window.location.href = 'index.html'; }, 500);
  });
}
 
// Load credits from database
async function loadCreditsFromDatabase() {
  const email = localStorage.getItem('userEmail');
  if (!email) return false;
  try {
    const response = await fetch('http://localhost:3000/get-user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (data.success) {
      const dbCredits = data.credits || 5;
      localStorage.setItem('tandem_credits', dbCredits);
      updateCreditsDisplay(dbCredits);
      localStorage.setItem('tandem_bio', data.bio || '');
      localStorage.setItem('tandem_achievements', data.achievements || '');
      localStorage.setItem('tandem_skills', data.skills || '[]');
      localStorage.setItem('tandem_growth', data.growth || '[]');
      localStorage.setItem('tandem_grade', data.grade_level || '');
      if (data.skills && JSON.parse(data.skills || '[]').length > 0 &&
          data.growth && JSON.parse(data.growth || '[]').length > 0 &&
          data.grade_level) {
        localStorage.setItem('profile_completed', 'true');
      }

      // Update the rating displayed next to the username in the profile header
      const rating = parseFloat(data.rating || 0);
      const ratingEl = document.getElementById('profileRating');
      if (ratingEl) ratingEl.textContent = rating > 0 ? rating.toFixed(1) : '0.0';

      return true;
    }
  } catch (error) { console.error('Error loading credits:', error); }
  return false;
}
 
// ============ RENDER SUBJECT TAGS ============
function renderSubjectTags(subject) {
  if (!subject) return '<span class="subject-tag">General</span>';
  return subject.split(',').map(s => s.trim()).filter(Boolean)
    .map(s => `<span class="subject-tag">${escapeHtml(s)}</span>`).join('');
}
 
// ============ PROFILE MODAL ============
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
 
function getBadge(skills) {
  const count = (skills && skills.length) || 0;
  if (count >= 8) return { label: 'Expert', color: '#7F77DD', bg: '#EEEDFE' };
  if (count >= 4) return { label: 'Average', color: '#185FA5', bg: '#E6F1FB' };
  return { label: 'Foundational', color: '#0F6E56', bg: '#E1F5EE' };
}
 
async function openProfileModal(email, name, profilePic) {
  const overlay = document.getElementById('profileModalOverlay');
  const modal = document.getElementById('profileModal');
  if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
 
  // Show immediately with loading state
  document.getElementById('pmName').textContent = name || 'Loading...';
  const avatarEl = document.getElementById('pmAvatar');
  if (profilePic) {
    avatarEl.innerHTML = `<img src="${profilePic}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.innerHTML = `<span style="font-size:2rem;font-weight:600;color:#185FA5;">${(name || '?').charAt(0).toUpperCase()}</span>`;
  }
  document.getElementById('pmStars').textContent = '☆☆☆☆☆';
  document.getElementById('pmRatingNum').textContent = '0.0';
  document.getElementById('pmBadge').textContent = '...';
  document.getElementById('pmBody').innerHTML = '<div class="pm-loading">Loading profile...</div>';
 
  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('modal-open')));
 
  // Fetch full user data
  try {
    const response = await fetch('http://localhost:3000/get-user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!data.success) { document.getElementById('pmBody').innerHTML = '<div class="pm-loading">Could not load profile.</div>'; return; }
 
    const skills = (() => { try { return JSON.parse(data.skills || '[]'); } catch(e) { return []; } })();
    const rating = parseFloat(data.rating || 0);
    const badge = getBadge(skills);
 
    // Update header
    document.getElementById('pmStars').textContent = renderStars(rating);
    document.getElementById('pmRatingNum').textContent = rating.toFixed(1);
    const badgeEl = document.getElementById('pmBadge');
    badgeEl.textContent = badge.label;
    badgeEl.style.background = badge.bg;
    badgeEl.style.color = badge.color;
 
    // Update avatar with fetched pic if we didn't have one
    if (!profilePic && data.profile_pic) {
      avatarEl.innerHTML = `<img src="${data.profile_pic}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
 
    // Subject ratings from skills
    const subjectHTML = skills.length && rating > 0
      ? skills.slice(0, 4).map(skill => {
          const v = (Math.random() * 0.8 - 0.4);
          const sr = Math.min(5, Math.max(1, rating + v)).toFixed(1);
          return `<div class="pm-subject-row">
            <span class="pm-subject-name">${escapeHtml(skill)}</span>
            <span class="pm-subject-stars">${renderStars(parseFloat(sr))}</span>
            <span class="pm-subject-num">${sr}</span>
          </div>`;
        }).join('')
      : '<span style="color:#aaa;font-size:13px;">No ratings yet</span>';
 
    const feedbackText = rating >= 4
      ? '"Very helpful and patient!"'
      : rating >= 2
      ? '"Good at explaining concepts."'
      : 'No feedback yet — be the first to connect!';
 
    document.getElementById('pmBody').innerHTML = `
      <p class="pm-label">About</p>
      <p class="pm-bio">${escapeHtml(data.bio || 'No bio provided.')}</p>
 
      <p class="pm-label">Skills &amp; Interests</p>
      <div class="pm-skills-wrap">
        ${skills.length
          ? skills.map(s => `<span class="pm-skill-tag">${escapeHtml(s)}</span>`).join('')
          : '<span style="color:#aaa;font-size:13px;">No skills listed</span>'}
      </div>
 
      ${skills.length && rating > 0 ? `
        <p class="pm-label">Subject Ratings</p>
        <div class="pm-subject-list">${subjectHTML}</div>
      ` : ''}
 
      <p class="pm-label">Feedback Highlights</p>
      <div class="pm-feedback">${feedbackText}</div>
    `;
  } catch (err) {
    document.getElementById('pmBody').innerHTML = '<div class="pm-loading">Could not load profile.</div>';
  }
}
 
function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  const overlay = document.getElementById('profileModalOverlay');
  modal.classList.remove('modal-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
}
 
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
 
// ============ UNIFIED REFRESH ============
async function refreshAllRequests() {
  const email = localStorage.getItem('userEmail');
  if (!email) return;
 
  try {
    // Fetch both in parallel
    const [connRes, sessRes] = await Promise.all([
      fetch('http://localhost:3000/get-pending-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }),
      fetch('http://localhost:3000/get-pending-session-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorEmail: email })
      })
    ]);
 
    const [connData, sessData] = await Promise.all([connRes.json(), sessRes.json()]);
 
    const requests = connData.requests || [];
    const sessions = sessData.sessions || [];
    const section = document.getElementById('pendingRequestsSection');
    const container = document.getElementById('pendingRequestsList');
 
    if (requests.length === 0 && sessions.length === 0) {
      section.style.display = 'none';
      container.innerHTML = '';
      return;
    }
 
    section.style.display = 'block';
 
    // Track which IDs are already rendered to avoid flicker on re-poll
    const existingConnIds = new Set([...container.querySelectorAll('.pending-card:not(.session-request-card)')].map(el => el.id));
    const existingSessIds = new Set([...container.querySelectorAll('.session-request-card')].map(el => el.id));
 
    const newConnIds = new Set(requests.map(r => `conn-card-${r.id}`));
    const newSessIds = new Set(sessions.map(s => `sess-card-${s.id}`));
 
    // Remove cards that are no longer in the server response
    existingConnIds.forEach(id => { if (!newConnIds.has(id)) document.getElementById(id)?.remove(); });
    existingSessIds.forEach(id => { if (!newSessIds.has(id)) document.getElementById(id)?.remove(); });
 
    // Add new connection cards that aren't already rendered
    requests.forEach(req => {
      if (!existingConnIds.has(`conn-card-${req.id}`)) {
        const div = document.createElement('div');
        div.className = 'pending-card';
        div.id = `conn-card-${req.id}`;
        div.innerHTML = `
          <div class="pending-avatar" onclick="openProfileModal('${req.learner_email}','${escapeHtml(req.learner_name || req.learner_username)}','${req.learner_profile_pic || ''}')" style="cursor:pointer;" title="View profile">
            ${req.learner_profile_pic
              ? `<img src="${req.learner_profile_pic}" alt="">`
              : `<div class="avatar-placeholder">${(req.learner_name || 'U').charAt(0).toUpperCase()}</div>`}
          </div>
          <div class="pending-info">
            <div class="pending-name" onclick="openProfileModal('${req.learner_email}','${escapeHtml(req.learner_name || req.learner_username)}','${req.learner_profile_pic || ''}')" style="cursor:pointer;text-decoration:underline dotted #aab;">${escapeHtml(req.learner_name || req.learner_username)}</div>
            <div class="pending-type-badge connection-badge">🔗 Connection Request</div>
            <div class="pending-subjects">${renderSubjectTags(req.subject)}</div>
            ${req.message ? `<div class="pending-message">"${escapeHtml(req.message)}"</div>` : ''}
            <div class="pending-grade">🎓 ${escapeHtml(req.learner_grade || 'Grade not specified')}</div>
          </div>
          <div class="pending-actions">
            <button class="btn-accept">✓ Accept</button>
            <button class="btn-reject">✗ Reject</button>
          </div>`;
        div.querySelector('.btn-accept').onclick = () => acceptConnectionRequest(req.id, req.learner_email, div.querySelector('.btn-accept'));
        div.querySelector('.btn-reject').onclick = () => rejectConnectionRequest(req.id, div.querySelector('.btn-reject'));
        container.prepend(div);
      }
    });
 
    // Add new session cards that aren't already rendered
    sessions.forEach(session => {
      if (!existingSessIds.has(`sess-card-${session.id}`)) {
        const div = document.createElement('div');
        div.className = 'pending-card session-request-card';
        div.id = `sess-card-${session.id}`;
        div.innerHTML = `
          <div class="pending-avatar" onclick="openProfileModal('${session.learner_email}','${escapeHtml(session.learner_name || session.learner_username)}','${session.learner_profile_pic || ''}')" style="cursor:pointer;" title="View profile">
            ${session.learner_profile_pic
              ? `<img src="${session.learner_profile_pic}" alt="">`
              : `<div class="avatar-placeholder">${(session.learner_name || 'U').charAt(0).toUpperCase()}</div>`}
          </div>
          <div class="pending-info">
            <div class="pending-name" onclick="openProfileModal('${session.learner_email}','${escapeHtml(session.learner_name || session.learner_username)}','${session.learner_profile_pic || ''}')" style="cursor:pointer;text-decoration:underline dotted #aab;">${escapeHtml(session.learner_name || session.learner_username)}</div>
            <div class="pending-type-badge session-badge">📅 Session Request</div>
            <div class="pending-subjects">${renderSubjectTags(session.subject)}</div>
            ${session.session_notes ? `<div class="pending-message">"${escapeHtml(session.session_notes)}"</div>` : ''}
            <div class="pending-grade">💰 Earns you 1 credit when completed</div>
          </div>
          <div class="pending-actions">
            <button class="btn-accept">✓ Accept</button>
            <button class="btn-reject">✗ Reject</button>
          </div>`;
        div.querySelector('.btn-accept').onclick = () => acceptSessionRequest(session.id, email, session.learner_email, div.querySelector('.btn-accept'));
        div.querySelector('.btn-reject').onclick = () => rejectSessionRequest(session.id, div.querySelector('.btn-reject'));
        container.appendChild(div);
      }
    });
 
  } catch (error) { console.error('Error refreshing requests:', error); }
}
 
// Keep old names as aliases so nothing else breaks
function loadPendingRequests() { return refreshAllRequests(); }
function loadPendingSessionRequests() { return refreshAllRequests(); }
 
// ============ ACCEPT CONNECTION REQUEST — no confirm ============
async function acceptConnectionRequest(requestId, learnerEmail, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  const tutorEmail = localStorage.getItem('userEmail');
  try {
    const response = await fetch('http://localhost:3000/accept-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, tutorEmail, learnerEmail })
    });
    const data = await response.json();
    if (data.success) {
      showToast('✅ Connection accepted!');
      const card = document.getElementById(`conn-card-${requestId}`);
      if (card) {
        card.style.opacity = '0';
        card.style.transition = 'opacity 0.3s';
        setTimeout(() => { card.remove(); checkSectionEmpty(); }, 300);
      }
    } else {
      showToast(data.message || 'Failed to accept');
      btn.disabled = false;
      btn.textContent = '✓ Accept';
    }
  } catch (error) {
    showToast('Error accepting request');
    btn.disabled = false;
    btn.textContent = '✓ Accept';
  }
}
 
// ============ REJECT CONNECTION REQUEST — no confirm ============
async function rejectConnectionRequest(requestId, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const response = await fetch('http://localhost:3000/reject-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    });
    const data = await response.json();
    if (data.success) {
      showToast('Request rejected');
      const card = document.getElementById(`conn-card-${requestId}`);
      if (card) {
        card.style.opacity = '0';
        card.style.transition = 'opacity 0.3s';
        setTimeout(() => { card.remove(); checkSectionEmpty(); }, 300);
      }
    } else {
      btn.disabled = false;
      btn.textContent = '✗ Reject';
    }
  } catch (error) {
    showToast('Error rejecting request');
    btn.disabled = false;
    btn.textContent = '✗ Reject';
  }
}
 
// ============ ACCEPT SESSION REQUEST — no confirm ============
async function acceptSessionRequest(sessionId, tutorEmail, learnerEmail, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const response = await fetch('http://localhost:3000/accept-session-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, tutorEmail, learnerEmail })
    });
    const data = await response.json();
    if (data.success) {
      showToast('✅ Session accepted! Go to Messages to begin.');
      const card = document.getElementById(`sess-card-${sessionId}`);
      if (card) {
        card.style.opacity = '0';
        card.style.transition = 'opacity 0.3s';
        setTimeout(() => { card.remove(); checkSectionEmpty(); }, 300);
      }
    } else {
      showToast(data.message || 'Failed to accept session');
      btn.disabled = false;
      btn.textContent = '✓ Accept';
    }
  } catch (error) {
    showToast('Error accepting session');
    btn.disabled = false;
    btn.textContent = '✓ Accept';
  }
}
 
// ============ REJECT SESSION REQUEST — no confirm ============
async function rejectSessionRequest(sessionId, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const response = await fetch('http://localhost:3000/reject-session-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    const data = await response.json();
    if (data.success) {
      showToast('Session request rejected');
      const card = document.getElementById(`sess-card-${sessionId}`);
      if (card) {
        card.style.opacity = '0';
        card.style.transition = 'opacity 0.3s';
        setTimeout(() => { card.remove(); checkSectionEmpty(); }, 300);
      }
    } else {
      btn.disabled = false;
      btn.textContent = '✗ Reject';
    }
  } catch (error) {
    showToast('Error rejecting session');
    btn.disabled = false;
    btn.textContent = '✗ Reject';
  }
}
 
// Hide section if no cards remain
function checkSectionEmpty() {
  const container = document.getElementById('pendingRequestsList');
  const section = document.getElementById('pendingRequestsSection');
  if (container && section && container.querySelectorAll('.pending-card').length === 0) {
    section.style.display = 'none';
  }
}
 
// Check active session
async function checkActiveSession() {
  const email = localStorage.getItem('userEmail');
  if (!email) return false;
  try {
    const response = await fetch('http://localhost:3000/get-active-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    const indicator = document.getElementById('activeSessionIndicator');
    if (data.success && data.session && data.session.status === 'active') {
      if (indicator) indicator.style.display = 'flex';
      return true;
    } else {
      if (indicator) indicator.style.display = 'none';
      return false;
    }
  } catch (error) { return false; }
}
 
// Make functions global
window.acceptConnectionRequest = acceptConnectionRequest;
window.rejectConnectionRequest = rejectConnectionRequest;
window.acceptSessionRequest = acceptSessionRequest;
window.rejectSessionRequest = rejectSessionRequest;
 
//for upcoming sessions page
async function loadUpcomingSessions() {
  const email = localStorage.getItem('userEmail');
  if (!email) return;
  try {
    const r = await fetch('http://localhost:3000/get-calendar-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await r.json();
    const section = document.getElementById('upcomingSessionsSection');
    const list    = document.getElementById('upcomingSessionsList');
    if (!data.success || !data.sessions?.length) { section.style.display = 'none'; return; }

    // Filter to upcoming confirmed/scheduled/active, sort by date, take top 3
    const now = Date.now();
    const upcoming = data.sessions
      .filter(s => ['confirmed','scheduled','active'].includes(s.status))
      .map(s => {
        const raw = s.scheduled_time || s.preferred_time || s.session_start || s.created_at;
        return { ...s, _date: raw ? new Date(raw.replace(' ','T')) : null };
      })
      .filter(s => s._date)
      .sort((a, b) => a._date - b._date)
      .slice(0, 3);

    if (!upcoming.length) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    list.innerHTML = upcoming.map(s => {
      const isLearner  = s.user_role === 'learner';
      const peer       = isLearner ? (s.tutor_username || s.tutor_name) : (s.learner_username || s.learner_name);
      const peerEmail  = isLearner ? s.tutor_email : s.learner_email;
      const isOnline   = s.session_mode !== 'face_to_face';
      const isGroup    = s.session_type === 'group';
      const d          = s._date;
      const day        = d.getDate();
      const month      = d.toLocaleString([], { month: 'short' }).toUpperCase();
      const time       = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const myName     = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || email;

      const statusCls  = s.status === 'scheduled' ? 'status-scheduled' : s.status === 'active' ? 'status-active' : '';
      const statusTag  = `<span class="upcoming-tag ${s.status}">${s.status === 'confirmed' ? 'Confirmed' : s.status === 'scheduled' ? 'Awaiting' : 'Active'}</span>`;
      const modeTag    = `<span class="upcoming-tag ${isOnline ? 'online' : 'f2f'}">${isOnline ? '💻 Online' : '🏫 In-person'}</span>`;
      const typeTag    = `<span class="upcoming-tag ${isGroup ? 'group' : 'solo'}">${isGroup ? '👥 Group' : '👤 1-on-1'}</span>`;

      let actionHtml = '';
      if (s.status === 'active' && isOnline) {
        const vc = new URLSearchParams({ email, peer: peerEmail, session: s.id, subject: s.subject || 'Session', name: myName, role: s.user_role });
        actionHtml = `<a href="video-call.html?${vc}" target="_blank">📹 Join</a>`;
      } else if (s.status === 'confirmed' && !isLearner && isOnline) {
        actionHtml = `<button onclick="dashStartSession(${s.id},'${peerEmail}','${escapeHtml(s.subject||'')}')">▶ Start</button>`;
      } else {
        actionHtml = `<a href="calendar.html">📅 View</a>`;
      }

      return `
        <div class="upcoming-card">
          <div class="upcoming-date-block ${statusCls}">
            <div class="upcoming-day">${day}</div>
            <div class="upcoming-month">${month}</div>
            <div class="upcoming-time">${time}</div>
          </div>
          <div class="upcoming-body">
            <div class="upcoming-subject">${escapeHtml(s.subject || 'Session')}</div>
            <div class="upcoming-peer">
              <div class="upcoming-peer-avatar">${peer ? peer.charAt(0).toUpperCase() : '?'}</div>
              <span>${isLearner ? 'Mentor' : 'Learner'}: <strong>${escapeHtml(peer || '—')}</strong></span>
            </div>
            <div class="upcoming-tags">${statusTag}${modeTag}${typeTag}</div>
          </div>
          <div class="upcoming-action">${actionHtml}</div>
        </div>`;
    }).join('');

  } catch(e) { console.error('Upcoming sessions error:', e); }
}

async function dashStartSession(sessionId, peerEmail, subject) {
  const email  = localStorage.getItem('userEmail');
  const myName = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || email;
  try {
    const r = await fetch('http://localhost:3000/start-session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, tutorEmail: email })
    });
    const d = await r.json();
    if (d.success) {
      showToast('✅ Session started!');
      const vc = new URLSearchParams({ email, peer: peerEmail, session: sessionId, subject: subject || 'Session', name: myName, role: 'tutor' });
      window.open(`video-call.html?${vc}`, '_blank', 'width=1100,height=700,resizable=yes');
      loadUpcomingSessions();
    } else showToast(d.message || 'Error starting session');
  } catch(e) { showToast('Error'); }
}
window.dashStartSession = dashStartSession;


// ─── SESSION HISTORY ──────────────────────────────────────────
async function loadSessionHistory() {
  const email = localStorage.getItem('userEmail');
  if (!email) return;
  try {
    const res = await fetch('http://localhost:3000/get-session-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!data.success || !data.sessions.length) return;

    const section = document.getElementById('sessionHistorySection');
    const list = document.getElementById('sessionHistoryList');
    if (!section || !list) return;
    section.style.display = 'block';

    list.innerHTML = data.sessions.map(s => {
      const elapsedSec = s.elapsed_seconds || 0;
      const mins = Math.floor(elapsedSec / 60);
      const durationLabel = mins >= 60
        ? `${Math.floor(mins/60)}h ${mins%60}m`
        : mins > 0 ? `${mins} min` : '< 1 min';

      const isLearner = s.role === 'learner';
      const roleIcon = isLearner ? '📖' : '🎓';
      const roleLabel = isLearner ? 'Learner' : 'Tutor';

      const dateStr = s.session_end
        ? new Date(s.session_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : (s.scheduled_time ? new Date(s.scheduled_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

      const ratingHtml = (s.rating && isLearner)
        ? `<div class="sh-rating">★ ${parseFloat(s.rating).toFixed(1)}</div>`
        : `<div class="sh-no-rating">—</div>`;

      return `
        <div class="sh-card">
          <div class="sh-role-badge ${s.role}">
            <div class="sh-role-icon">${roleIcon}</div>
            <div class="sh-role-label">${roleLabel}</div>
          </div>
          <div class="sh-info">
            <div class="sh-subject">${escapeHtml(s.subject || 'General Session')}</div>
            <div class="sh-peer">with ${escapeHtml(s.peer_name || 'Peer')}</div>
            <div class="sh-date">${dateStr}</div>
          </div>
          <div class="sh-right">
            <div class="sh-duration">⏱ ${durationLabel}</div>
            ${ratingHtml}
          </div>
        </div>`;
    }).join('');

    if (!data.sessions.length) {
      list.innerHTML = `<div class="sh-empty"><div class="sh-empty-icon">📋</div>No completed sessions yet.</div>`;
    }
  } catch(e) { console.warn('Session history unavailable:', e); }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) { window.location.href = 'index.html'; return; }
 
  await loadCreditsFromDatabase();
  if (!checkProfileCompletion()) return;
 
  loadUserInfo();
  updateCreditsDisplay(getCredits());
  await loadPendingRequests();
  await loadPendingSessionRequests();
  checkActiveSession();
  loadUpcomingSessions();
  loadSessionHistory();
  setupLogout();
 
  document.getElementById('profileModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'profileModalOverlay') closeProfileModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfileModal();
  });
 
  setInterval(() => {
    refreshAllRequests();
    checkActiveSession();
     loadUpcomingSessions();
  }, 5000);
});