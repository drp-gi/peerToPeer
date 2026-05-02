(function () {
  'use strict';
 
  const API = 'http://localhost:3000';
  const POLL_INTERVAL = 5000; // 5 seconds
 
  // ── Helpers ─────────────────────────────────────────────
  function esc(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
 
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
 
  function formatDateTime(dtStr) {
    if (!dtStr) return '';
    return new Date(dtStr).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }
 
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('toast-show');
    setTimeout(() => t.classList.remove('toast-show'), 3500);
  }
 
  // ── Icon mapping ─────────────────────────────────────────
  const TYPE_META = {
    session_request:    { icon: '📅', cls: 'session',  label: 'Session Request' },
    session_scheduled:  { icon: '🗓️', cls: 'schedule', label: 'Schedule Proposed' },
    session_accepted:   { icon: '✅', cls: 'session',  label: 'Session Accepted' },
    session_rejected:   { icon: '❌', cls: 'session',  label: 'Session Rejected' },
    schedule_accepted:  { icon: '✅', cls: 'schedule', label: 'Schedule Confirmed' },
    schedule_declined:  { icon: '❌', cls: 'schedule', label: 'Schedule Declined' },
    new_message:        { icon: '💬', cls: 'message',  label: 'New Message' },
    credit_gain:        { icon: '💰', cls: 'credit',   label: 'Credits Earned' },
    credit_loss:        { icon: '💸', cls: 'credit',   label: 'Credits Spent' },
    connection_request: { icon: '🤝', cls: 'session',  label: 'Connection Request' },
    connection_accepted:    { icon: '🎉', cls: 'session',  label: 'Connected!' },
    connection_rejected:    { icon: '❌', cls: 'session',  label: 'Connection Declined' },
    connection_request_sent:{ icon: '📨', cls: 'session',  label: 'Request Sent' },
  };
 
  // ── Render one notification item ─────────────────────────
  function renderItem(n) {
    const meta = TYPE_META[n.type] || { icon: '🔔', cls: 'system', label: n.type };
    const data = n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : {};
 
    let actionsHTML = '';
 
    // --- Mentor receives a connection request ---
        if (n.type === 'connection_request' && !n.is_read && data.learner_email) {
      const subjects = (data.subject || '').split(',').map(s => s.trim()).filter(Boolean);
      const subjectPills = subjects.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;">
            ${subjects.map(s => `<span style="background:#2d3a6b;color:#a0b4f0;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;">${esc(s)}</span>`).join('')}
          </div>`
        : '';

      const msgLine = data.message
        ? `<div style="font-size:11.5px;color:#888;font-style:italic;margin-top:4px;">"${esc(data.message)}"</div>`
        : '';

      const safeEmail = esc(data.learner_email);
      actionsHTML = `
        ${subjectPills}
        ${msgLine}
        <div class="notif-actions">
          <button class="notif-btn notif-btn-accept"
                  data-learner="${safeEmail}" data-notif="${n.id}"
                  onclick="notifAcceptConnection(this.dataset.learner, ${n.id})">
            ✓ Accept
          </button>
          <button class="notif-btn notif-btn-decline"
                  data-learner="${safeEmail}" data-notif="${n.id}"
                  onclick="notifRejectConnection(this.dataset.learner, ${n.id})">
            ✗ Reject
          </button>
        </div>`;
    }
 
    // --- Mentor sees a session request → they propose a schedule ---
    if (n.type === 'session_request' && !n.is_read && data.session_id && data.learner_email) {
  const safeSessionId = esc(String(data.session_id));
  const safeLearnerEmail = esc(data.learner_email);
  actionsHTML = `
    <div class="notif-schedule-form" id="schedForm_${n.id}">
      <label>📅 Propose a date &amp; time for the session</label>
      <input type="datetime-local" id="schedTime_${n.id}"
             min="${new Date().toISOString().slice(0,16)}">
      <div class="notif-actions">
        <button class="notif-btn notif-btn-accept"
                onclick="notifProposeSchedule(${n.id}, '${safeSessionId}', '${safeLearnerEmail}')">
          Send Schedule
        </button>
        <button class="notif-btn notif-btn-decline"
                onclick="notifRejectSession('${safeSessionId}', ${n.id})">
          Reject
        </button>
      </div>
    </div>`;
}
 
    // --- Learner sees a proposed schedule → accept or decline ---
    if (n.type === 'session_scheduled' && !n.is_read) {
      const pretty = data.scheduled_time ? formatDateTime(data.scheduled_time) : '(no time set)';
      actionsHTML = `
        <div class="notif-actions">
          <button class="notif-btn notif-btn-accept"
                  onclick="notifAcceptSchedule('${esc(data.session_id)}', ${n.id})">
            ✅ Accept
          </button>
          <button class="notif-btn notif-btn-decline"
                  onclick="notifDeclineSchedule('${esc(data.session_id)}', ${n.id})">
            ❌ Decline
          </button>
        </div>
        <div class="notif-time">Proposed time: <strong style="color:#a89af9">${esc(pretty)}</strong></div>`;
    }
 
    // --- View message link ---
    // --- View message link ---
    if (n.type === 'new_message') {
      const senderEmail = data.sender_email ? esc(data.sender_email) : '';
      actionsHTML = `
        <div class="notif-actions">
          <button class="notif-btn notif-btn-view"
                  onclick="openChatWith('${senderEmail}', ${n.id})">
            Open Chat
          </button>
        </div>`;
    }
    
    return `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" id="notifItem_${n.id}">
        <div class="notif-icon ${meta.cls}">${meta.icon}</div>
        <div class="notif-body">
          <div class="notif-title">${esc(n.title || meta.label)}</div>
          <div class="notif-sub">${esc(n.body || '')}</div>
          ${actionsHTML}
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
        ${n.is_read ? '' : '<div class="notif-dot"></div>'}
      </div>`;
  }
 
  // ── Fetch & render notifications ─────────────────────────
  async function fetchNotifications() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
 
    try {
      const res = await fetch(`${API}/get-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!data.success) return;
 
      const list   = document.getElementById('notifList');
      const badge  = document.getElementById('notifBadge');
      const unread = data.notifications.filter(n => !n.is_read).length;
 
      if (!list) return;
 
      if (data.notifications.length === 0) {
        list.innerHTML = `
          <div class="notif-empty">
            <div class="notif-empty-icon">🔔</div>
            <span>You're all caught up!</span>
          </div>`;
      } else {
        list.innerHTML = data.notifications.map(renderItem).join('');
      }
 
      if (badge) {
        if (unread > 0) {
          badge.textContent = unread > 9 ? '9+' : unread;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Notification fetch error:', err);
    }
  }
 
  // ── Mark all read ────────────────────────────────────────
  async function markAllRead() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    try {
      await fetch(`${API}/mark-notifications-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      fetchNotifications();
    } catch (err) { console.error(err); }
  }
 
  // ── Mark one notification read ───────────────────────────
  async function markOneRead(notifId) {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    try {
      await fetch(`${API}/mark-notification-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, notifId })
      });
    } catch (err) { console.error(err); }
  }
 
  // ── Action: Accept connection request from notification ──
  window.notifAcceptConnection = async function (learnerEmail, notifId) {
    const tutorEmail = localStorage.getItem('userEmail');
 
    // Find the pending request ID from dashboard state or fetch it
    try {
      // Get pending requests to find the request ID
      const reqRes = await fetch(`${API}/get-pending-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tutorEmail })
      });
      const reqData = await reqRes.json();
      const match = (reqData.requests || []).find(r => r.learner_email === learnerEmail);
 
      if (!match) {
        showToast('Request not found or already handled.');
        await markOneRead(notifId);
        fetchNotifications();
        return;
      }
 
      const res = await fetch(`${API}/accept-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: match.id, tutorEmail, learnerEmail })
      });
      const data = await res.json();
 
      if (data.success) {
        showToast('✅ Connection accepted!');
        await markOneRead(notifId);
        fetchNotifications();
        // Refresh dashboard cards if function exists
        if (typeof refreshAllRequests === 'function') refreshAllRequests();
      } else {
        showToast(data.message || 'Failed to accept');
      }
    } catch (err) {
      console.error(err);
      showToast('Error accepting connection');
    }
  };
 
  // ── Action: Reject connection request from notification ──
  window.notifRejectConnection = async function (learnerEmail, notifId) {
    const tutorEmail = localStorage.getItem('userEmail');
 
    try {
      const reqRes = await fetch(`${API}/get-pending-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tutorEmail })
      });
      const reqData = await reqRes.json();
 
      // Match by learner email specifically
      const req = (reqData.requests || []).find(r => r.learner_email === learnerEmail);
 
      if (!req) {
        showToast('Request not found or already handled.');
        await markOneRead(notifId);
        fetchNotifications();
        return;
      }
 
      await fetch(`${API}/reject-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: req.id })
      });
 
      showToast('Connection request rejected.');
      await markOneRead(notifId);
      fetchNotifications();
      if (typeof refreshAllRequests === 'function') refreshAllRequests();
    } catch (err) {
      console.error(err);
      showToast('Error rejecting connection');
    }
  };
 
  // ── Action: Mentor proposes a schedule ───────────────────
  window.notifProposeSchedule = async function (notifId, sessionId, learnerEmail) {
    const input = document.getElementById(`schedTime_${notifId}`);
    if (!input || !input.value) {
      showToast('⚠️ Please pick a date and time first.');
      return;
    }
    const tutorEmail = localStorage.getItem('userEmail');
    const tutorName  = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'Your mentor';
 
    try {
      const res = await fetch(`${API}/propose-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, tutorEmail, learnerEmail,
          scheduledTime: input.value,
          tutorName
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Schedule sent to learner!');
        await markOneRead(notifId);
        fetchNotifications();
      } else {
        showToast(data.message || 'Failed to send schedule');
      }
    } catch (err) {
      console.error(err);
      showToast('Error sending schedule');
    }
  };

  // ── Action: Open chat with specific person ───────────────
  window.openChatWith = async function (senderEmail, notifId) {
    await markOneRead(notifId);
    // Store the target email so messages.js can auto-open it
    sessionStorage.setItem('openChatWith', senderEmail);
    window.location.href = 'messages.html';
  };

 
  // ── Action: Mentor rejects session request ───────────────
  window.notifRejectSession = async function (sessionId, notifId) {
    try {
      await fetch(`${API}/reject-session-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      showToast('Session request rejected.');
      await markOneRead(notifId);
      fetchNotifications();
    } catch (err) {
      showToast('Error rejecting session');
    }
  };
 
  // ── Action: Learner accepts proposed schedule ────────────
  window.notifAcceptSchedule = async function (sessionId, notifId) {
    const learnerEmail = localStorage.getItem('userEmail');
    const learnerName  = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'Learner';
    try {
      const res = await fetch(`${API}/respond-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, learnerEmail, learnerName, accepted: true })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Schedule accepted! Check Messages to start your session.');
        await markOneRead(notifId);
        fetchNotifications();
        if (typeof loadCreditsFromDatabase === 'function') loadCreditsFromDatabase();
      } else {
        showToast(data.message || 'Error accepting schedule');
      }
    } catch (err) {
      showToast('Error accepting schedule');
    }
  };
 
  // ── Action: Learner declines proposed schedule ───────────
  window.notifDeclineSchedule = async function (sessionId, notifId) {
    const learnerEmail = localStorage.getItem('userEmail');
    const learnerName  = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'Learner';
    try {
      const res = await fetch(`${API}/respond-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, learnerEmail, learnerName, accepted: false })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Schedule declined. The session has been cancelled.');
        await markOneRead(notifId);
        fetchNotifications();
      } else {
        showToast(data.message || 'Error declining schedule');
      }
    } catch (err) {
      showToast('Error declining schedule');
    }
  };
 
  // ── Bell toggle ──────────────────────────────────────────
  function setupBell() {
    const wrap     = document.getElementById('notifBellWrap');
    const dropdown = document.getElementById('notifDropdown');
    const markAll  = document.getElementById('notifMarkAll');
 
    if (!wrap || !dropdown) return;
 
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      dropdown.classList.toggle('open', !isOpen);
      if (!isOpen) fetchNotifications();
    });
 
    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
    });
 
    dropdown.addEventListener('click', e => e.stopPropagation());
 
    if (markAll) markAll.addEventListener('click', markAllRead);
  }
 
  // ── Boot ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    setupBell();
    fetchNotifications();
    setInterval(fetchNotifications, POLL_INTERVAL);
  });
 
  // Expose so other scripts can trigger a refresh
  window.fetchNotifications = fetchNotifications;
 
})();