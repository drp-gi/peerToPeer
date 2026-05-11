// Credits system
function getCredits() {
  const stored = localStorage.getItem('tandem_credits');
  if (stored === null || stored === 'undefined') {
    localStorage.setItem('tandem_credits', '5');
    return 5;
  }
  return parseInt(stored, 10);
}
 
function updateCreditsDisplay(amount) {
  const el = document.getElementById('topCreditsBadge');
  if (el) el.textContent = amount;
}
 
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast-show');
  setTimeout(() => toast.classList.remove('toast-show'), 3500);
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
 
// ============ DATA ============
let allMentors = [];
// Track pending requests from the server (not localStorage — avoids stale data)
let pendingEmails = new Set();
 
// ============ LOAD MENTORS ============
async function loadMentors() {
  const email = localStorage.getItem('userEmail');
  if (!email) { renderMentors([]); return; }
 
  try {
    // Fetch matches and pending requests in parallel
    const [matchRes, pendingRes] = await Promise.all([
      fetch('/get-swipe-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }),
      fetch('/get-pending-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // get requests I SENT (as learner) — tutor_email is the mentor
        // We'll use a different approach: check connection_requests where learner_email = me
        body: JSON.stringify({ email })
      })
    ]);
 
    const matchData = await matchRes.json();
 
    // Filter out system/AI accounts
    const SYSTEM_EMAILS = ['system', '__tandem_ai_bot__'];
    allMentors = (matchData.matches || [])
      .filter(m => !SYSTEM_EMAILS.includes(m.email) && m.email !== 'system')
      .map(m => ({
        ...m,
        skills: Array.isArray(m.skills) ? m.skills
          : (() => { try { return JSON.parse(m.skills || '[]'); } catch(e) { return []; } })(),
        growth: Array.isArray(m.growth) ? m.growth
          : (() => { try { return JSON.parse(m.growth || '[]'); } catch(e) { return []; } })(),
      }));
    allMentors.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
 
    // Users excluded by backend = already have pending/accepted requests with them
    // The backend already removes them from matches, so anyone NOT in matches
    // who was there before = pending. We track this via a separate endpoint.
    // For now: pending is derived from what the backend already excluded.
    // We reset pendingEmails each load so it stays fresh.
    pendingEmails = new Set();
 
  } catch (error) {
    console.error('Error loading mentors:', error);
    allMentors = [];
  }
 
  renderMentors(allMentors);
}
 
// ============ RENDER MENTORS ============
function renderMentors(mentors) {
  const spinner = document.getElementById('listLoadingSpinner');
  const grid = document.getElementById('mentorsGrid');
 
  if (spinner) spinner.style.display = 'none';
  if (!grid) return;
  grid.style.display = 'grid';
 
  if (!mentors || mentors.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No mentors found</h3>
        <p>Try adjusting your search or check back later for new matches.</p>
      </div>`;
    return;
  }
 
  window._mentorList = mentors;
  grid.innerHTML = mentors.map((mentor, idx) => {
    const isPending = pendingEmails.has(mentor.email);
    const badge = getBadgeLabel(mentor.skills);
    const rating = parseFloat(mentor.rating) || 0;
    const stars = renderStars(rating);
 
    return `
    <div class="mentor-card" onclick="openMentorModal(window._mentorList[${idx}])">
      <div class="mentor-card-top">
        <div class="mentor-avatar-wrap">
          ${mentor.profile_pic
            ? `<img src="${mentor.profile_pic}" alt="${mentor.username || mentor.name}" class="mentor-avatar-img">`
            : `<div class="mentor-avatar-initials">${(mentor.username || mentor.name || '?').charAt(0).toUpperCase()}</div>`
          }
          ${mentor.matchScore ? `<div class="match-pill">${Math.round(mentor.matchScore)}%</div>` : ''}
        </div>
        <div class="mentor-card-info">
              <div class="mentor-card-name">
                ${mentor.name || mentor.username || 'Unknown'}
                <span style="display:block; font-size:12px; font-weight:400; color:#94a3b8; margin-top:1px;">
                  @${mentor.username || mentor.name || ''}
                </span>
              </div>
          <div class="mentor-card-rating">
            <span class="stars-display">${stars}</span>
            <span class="rating-val">${rating.toFixed(1)}</span>
          </div>
          <span class="mentor-badge-chip" style="background:${badge.bg};color:${badge.color};">${badge.label}</span>
        </div>
      </div>
 
      <p class="mentor-card-bio">${mentor.bio || 'Ready to help you learn and grow!'}</p>
 
      <div class="mentor-skills-row">
        ${mentor.skills && mentor.skills.length
          ? mentor.skills.slice(0, 4).map(s => `<span class="skill-chip">${s}</span>`).join('')
          : '<span class="skill-chip muted">No skills listed</span>'}
      </div>
 
      <button class="mentor-connect-btn ${isPending ? 'btn-pending' : ''}"
              onclick="event.stopPropagation(); ${isPending ? '' : `openMentorModal(window._mentorList[${idx}])`}"
              ${isPending ? 'disabled' : ''}>
        ${isPending ? 'Request Pending' : 'View Profile & Connect'}
      </button>
    </div>`;
  }).join('');
}
 
// ============ FILTER & SORT ============
function applyFilterSort() {
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const sortBy = document.getElementById('sortSelect')?.value || 'match';
 
  let results = [...allMentors];
 
  if (searchTerm) {
    results = results.filter(m =>
      (m.username && m.username.toLowerCase().includes(searchTerm)) ||
      (m.name && m.name.toLowerCase().includes(searchTerm)) ||
      (m.skills && m.skills.some(s => s.toLowerCase().includes(searchTerm)))
    );
  }
 
  if (sortBy === 'match') results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  else if (sortBy === 'rating') results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sortBy === 'name') results.sort((a, b) => (a.username || a.name || '').localeCompare(b.username || b.name || ''));
 
  renderMentors(results);
}
 
// ============ BADGE ============
function getBadgeLabel(skills) {
  const count = (skills && skills.length) || 0;
  if (count >= 8) return { label: 'Expert', color: '#7F77DD', bg: '#EEEDFE' };
  if (count >= 4) return { label: 'Average', color: '#185FA5', bg: '#E6F1FB' };
  return { label: 'Foundational', color: '#0F6E56', bg: '#E1F5EE' };
}
 
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
 
// ============ MENTOR PROFILE MODAL ============
function openMentorModal(mentor) {
  const overlay = document.getElementById('mentorModalOverlay');
  if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
  const modal = document.getElementById('mentorModal');
 
  const avatarEl = document.getElementById('modalAvatar');
  if (mentor.profile_pic) {
    avatarEl.innerHTML = `<img src="${mentor.profile_pic}" alt="${mentor.username || mentor.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.innerHTML = `<span style="font-size:2rem;font-weight:600;color:#185FA5;">${(mentor.username || mentor.name || '?').charAt(0).toUpperCase()}</span>`;
  }
 

document.getElementById('modalName').innerHTML = `
  ${mentor.name || mentor.username || 'Unknown'}
  <span style="display:block; font-size:14px; font-weight:400; color:#778899; margin-top:2px;">
    @${mentor.username || mentor.name || ''}
  </span>`;
  document.getElementById('modalBio').textContent = mentor.bio || 'Passionate about helping others learn and grow.';
 
  const rating = parseFloat(mentor.rating) || 0;
  document.getElementById('modalRatingStars').textContent = renderStars(rating);
  document.getElementById('modalRatingNum').textContent = rating.toFixed(1);
 
  const badge = getBadgeLabel(mentor.skills);
  const badgeEl = document.getElementById('modalBadge');
  badgeEl.textContent = badge.label;
  badgeEl.style.background = badge.bg;
  badgeEl.style.color = badge.color;
 
  const matchEl = document.getElementById('modalMatch');
  if (mentor.matchScore) {
    matchEl.textContent = `${Math.round(mentor.matchScore)}% Match`;
    matchEl.style.display = 'inline-block';
  } else {
    matchEl.style.display = 'none';
  }
 
  const skillsEl = document.getElementById('modalSkills');
  skillsEl.innerHTML = mentor.skills && mentor.skills.length
    ? mentor.skills.map(s => `<span class="modal-skill-tag">${s}</span>`).join('')
    : '<span style="color:#aaa;font-size:13px;">No skills listed</span>';
 
  const subjectRatingsEl = document.getElementById('modalSubjectRatings');
  if (mentor.skills && mentor.skills.length && rating > 0) {
    subjectRatingsEl.innerHTML = mentor.skills.slice(0, 4).map(skill => {
      const variance = (Math.random() * 0.8 - 0.4);
      const subRating = Math.min(5, Math.max(1, rating + variance)).toFixed(1);
      return `<div class="subject-rating-row">
        <span class="subject-name">${skill}</span>
        <span class="subject-stars">${renderStars(parseFloat(subRating))}</span>
        <span class="subject-num">${subRating}</span>
      </div>`;
    }).join('');
    document.getElementById('modalSubjectSection').style.display = 'block';
  } else {
    document.getElementById('modalSubjectSection').style.display = 'none';
  }
 
  document.getElementById('modalFeedback').innerHTML = rating >= 4
    ? `<div class="feedback-pill">"Very helpful and patient!"</div>`
    : rating >= 2
    ? `<div class="feedback-pill">"Good at explaining concepts."</div>`
    : `<div class="feedback-pill">No feedback yet — be the first to connect!</div>`;
 
  const isPending = pendingEmails.has(mentor.email);
  const connectBtn = document.getElementById('modalConnectBtn');
  if (isPending) {
    connectBtn.textContent = 'Request Pending';
    connectBtn.disabled = true;
    connectBtn.style.opacity = '0.6';
    connectBtn.onclick = null;
  } else {
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
    connectBtn.style.opacity = '1';
    connectBtn.onclick = () => { closeMentorModal(); openSubjectModal(mentor); };
  }
 
  document.getElementById('modalPassBtn').onclick = () => closeMentorModal();
 
  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('modal-open')));
}
 
function closeMentorModal() {
  const modal = document.getElementById('mentorModal');
  const overlay = document.getElementById('mentorModalOverlay');
  modal.classList.remove('modal-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
}
 
// ============ SUBJECT MODAL ============
function openSubjectModal(mentor) {
  const subOverlay = document.getElementById('subjectModalOverlay');
  if (subOverlay.parentElement !== document.body) document.body.appendChild(subOverlay);
  const subModal = document.getElementById('subjectModal');
 
  document.getElementById('subjectMentorName').textContent = mentor.username || mentor.name;
  document.getElementById('subjectMessage').value = '';
 
  const group = document.getElementById('subjectInput');
  const skills = mentor.skills && mentor.skills.length ? mentor.skills : [];
  group.classList.remove('error');
  group.innerHTML = skills.length
    ? skills.map(s => `
        <label class="skill-checkbox-label">
          <input type="checkbox" value="${s}"> ${s}
        </label>`).join('')
    : '<span style="color:#aaa;font-size:13px;">No skills listed</span>';
 
  group.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.parentElement.classList.toggle('checked', cb.checked);
    });
  });
 
  document.getElementById('subjectConfirmBtn').onclick = async () => {
    const checked = [...group.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
    const message = document.getElementById('subjectMessage').value.trim();
    if (!checked.length) { group.classList.add('error'); return; }
    group.classList.remove('error');
    const subject = checked.join(', ');
    closeSubjectModal();
    await sendConnectionRequest(mentor, subject, message);
  };
 
  document.getElementById('subjectCancelBtn').onclick = closeSubjectModal;
 
  subOverlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => subModal.classList.add('modal-open')));
}
 
function closeSubjectModal() {
  const subModal = document.getElementById('subjectModal');
  const subOverlay = document.getElementById('subjectModalOverlay');
  subModal.classList.remove('modal-open');
  setTimeout(() => { subOverlay.style.display = 'none'; }, 220);
}
 
// ============ SEND CONNECTION REQUEST ============
async function sendConnectionRequest(mentor, subject, message) {
  const learnerEmail = localStorage.getItem('userEmail');
  const learnerGrade = localStorage.getItem('tandem_grade') || '';
 
  try {
    const response = await fetch('/send-connection-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learnerEmail,
        tutorEmail: mentor.email,
        subject,
        message: message || '',
        learnerGradeLevel: learnerGrade,
        tutorGradeLevel: mentor.grade_level || ''
      })
    });
 
    const data = await response.json();
 
    if (data.success) {
      showToast(`✅ Connection request sent to ${mentor.username || mentor.name}!`);
      pendingEmails.add(mentor.email);
      renderMentors(allMentors);
      // Refresh notifications immediately so the sent confirmation appears
      if (typeof fetchNotifications === 'function') fetchNotifications();
    } else {
      showToast(data.message || 'Failed to send request.');
    }
  } catch (error) {
    console.error('Error sending request:', error);
    showToast('Error sending request. Please try again.');
  }
}
 
// ============ LOGOUT ============
async function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to log out?')) return;
    const email = localStorage.getItem('userEmail');
    const currentCredits = getCredits();
    if (email && currentCredits) {
      try {
        await fetch('/update-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, credits: currentCredits })
        });
      } catch (err) { console.error('Error saving credits:', err); }
    }
    setTimeout(() => { localStorage.clear(); window.location.href = 'index.html'; }, 300);
  });
}
 
// ============ LOAD CREDITS ============
async function loadCredits() {
  const email = localStorage.getItem('userEmail');
  if (!email) return;
  try {
    const response = await fetch('/get-user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('tandem_credits', data.credits || 5);
      updateCreditsDisplay(data.credits || 5);
    }
  } catch (error) { console.error('Error loading credits:', error); }
}
 
// ============ GLOBALS ============
window.openMentorModal = openMentorModal;
window.closeMentorModal = closeMentorModal;
window.closeSubjectModal = closeSubjectModal;
 
// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) { window.location.href = 'index.html'; return; }
  if (!checkProfileCompletion()) return;
 
  await loadCredits();
  updateCreditsDisplay(getCredits());
  setupLogout();
 
  document.getElementById('searchInput')?.addEventListener('input', applyFilterSort);
  document.getElementById('sortSelect')?.addEventListener('change', applyFilterSort);
 
  document.getElementById('mentorModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'mentorModalOverlay') closeMentorModal();
  });
  document.getElementById('subjectModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'subjectModalOverlay') closeSubjectModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMentorModal(); closeSubjectModal(); }
  });
 
  // Dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('darkMode', isDark);
    });
  }

  // Load dark mode preference
  const savedDarkMode = localStorage.getItem('darkMode');
  if (savedDarkMode === 'true') {
    document.body.classList.add('dark-mode');
  }
 
  await loadMentors();
});
