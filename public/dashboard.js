// --- UTILITY FUNCTIONS ---
function encryptEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 1) return email;
  return local[0] + '*'.repeat(local.length - 1) + '@' + domain;
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

// --- USER & CREDITS ---
function loadUserInfo() {
  const username = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'User';
  const email = localStorage.getItem('userEmail') || '';
  const profilePic = localStorage.getItem('tandem_profile_pic') || null;

  const profileUsernameEl = document.getElementById('profileUsername');
  if (profileUsernameEl) profileUsernameEl.textContent = username.toUpperCase();

  const profileEmailEl = document.getElementById('profileEmail');
  if (profileEmailEl) profileEmailEl.textContent = encryptEmail(email);

  if (profilePic) {
    const avatarContainer = document.getElementById('avatarContainer');
    if (avatarContainer) {
      avatarContainer.innerHTML = `<img src="${profilePic}" alt="Profile Picture" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }
  }
}

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

// --- CALENDAR LOGIC ---
let viewDate = new Date(2026, 4, 1);
let calendarEvents = [
    { id: 101, type: 'invitation', title: 'Calculus Intro', mentor: 'Dr. Aris', date: '2026-05-12', time: '14:00' },
    { id: 102, type: 'session', title: 'Python Basics', mentor: 'Sarah J.', date: '2026-05-01', time: '10:00' }
];

function initCalendarPage() {
    if (!document.getElementById('calendarGrid')) return;
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('monthLabel');
    const sidebar = document.getElementById('sidebarContent');
    if(!grid || !label) return;
    
    grid.innerHTML = '';
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    label.textContent = `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(viewDate)} ${year}`;

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const div = document.createElement('div');
        div.className = 'weekday';
        div.textContent = day;
        grid.appendChild(div);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        const today = new Date();
        if(d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) cell.classList.add('day-today');

        cell.innerHTML = `<span class="day-num">${d}</span>`;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        calendarEvents.filter(e => e.date === dateStr).forEach(e => {
            const m = document.createElement('div');
            m.className = `marker ${e.type}`;
            m.textContent = e.title;
            cell.appendChild(m);
        });
        grid.appendChild(cell);
    }
    if(sidebar) renderSidebar(sidebar);
}

function renderSidebar(container) {
    if (calendarEvents.length === 0) {
        container.innerHTML = '<p style="color:#666; font-size:13px;">No upcoming activities.</p>';
        return;
    }
    container.innerHTML = calendarEvents.map(ev => {
        const isInvite = ev.type === 'invitation';
        return `
            <div class="invite-card" style="border-left-color: ${isInvite ? '#ffd700' : '#a0c4d8'}">
                <div style="color:#a0c4d8; font-size:11px; font-weight:bold;">${ev.date} @ ${ev.time}</div>
                <div style="color:white; font-size:15px; margin:5px 0;">${ev.title}</div>
                <div style="color:#aaa; font-size:12px; margin-bottom: 10px;">Mentor: ${ev.mentor}</div>
                ${isInvite ? `
                    <div class="invite-actions">
                        <button class="btn-acc" onclick="handleInvite(${ev.id}, 'accept')">Accept</button>
                        <button class="btn-dec" onclick="handleInvite(${ev.id}, 'decline')">Decline</button>
                    </div>` : `
                    <div style="margin-top: 10px;">
                        <div style="color: #4CAF50; font-size: 11px; margin-bottom: 8px;">● Confirmed</div>
                        <a href="${ev.meet_link}" target="_blank" class="join-link-btn">Join Google Meet</a>
                    </div>`}
            </div>`;
    }).join('');
}

// --- ACTION HANDLERS ---
window.handleInvite = async function(id, action) {
    if (action === 'accept') {
        const item = calendarEvents.find(e => e.id === id);
        if (!item) return;
        showToast("Generating secure meeting link...");
        try {
            const response = await fetch('http://localhost:3000/create-meet-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: item.title, startTime: `${item.date}T${item.time}:00` })
            });
            const data = await response.json();
            if (data.success) {
                item.type = 'session'; 
                item.meet_link = data.meetLink;
                showToast("✅ Invitation Accepted!");
            } else { throw new Error(); }
        } catch (error) {
            item.meet_link = `https://meet.google.com/lookup/${Math.random().toString(36).substring(7)}`;
            item.type = 'session';
            showToast("⚠️ Link generated offline.");
        }
    } else {
        calendarEvents = calendarEvents.filter(e => e.id !== id);
        showToast("Invitation Declined.");
    }
    renderCalendar(); 
};

window.moveMonth = (offset) => { viewDate.setMonth(viewDate.getMonth() + offset); renderCalendar(); };

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) { window.location.href = 'index.html'; return; }
  
  await loadCreditsFromDatabase();
  // Only proceed if profile is completed
  if (localStorage.getItem('profile_completed') === 'true') {
      loadUserInfo();
      updateCreditsDisplay(getCredits());
      loadPendingRequests();
      loadPendingSessionRequests();
      checkActiveSession();
      setupLogout();
      initCalendarPage(); // Initialize calendar here
  } else {
      window.location.href = 'complete-profile.html';
  }
});