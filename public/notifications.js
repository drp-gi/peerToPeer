(function () {
  'use strict';

  const API = '';
  const POLL = 5000;

  function esc(t) {
    if (!t) return '';
    const d = document.createElement('div'); d.textContent = t; return d.innerHTML;
  }

  function timeAgo(ds) {
    if (!ds) return '';
    const m = Math.floor((Date.now()-new Date(ds))/60000);
    if (m<1) return 'just now'; if (m<60) return `${m}m ago`;
    const h=Math.floor(m/60); if (h<24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  }

  function fmtDT(s) {
    if (!s) return ''; return new Date(s).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
  }


  function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch(e) {}
}

  function showToast(msg) {
    const t=document.getElementById('toast'); if(!t) return;
    t.textContent=msg; t.classList.add('toast-show');
    setTimeout(()=>t.classList.remove('toast-show'),3500);
  }

  const META = {
    session_request:       { icon:'📅', cls:'session',  label:'Session Request' },
    session_scheduled:     { icon:'🗓️', cls:'schedule', label:'Schedule Proposed' },
    session_confirmed:     { icon:'✅', cls:'schedule', label:'Session Confirmed' },
    session_started:       { icon:'🟢', cls:'session',  label:'Session Started' },
    session_rejected:      { icon:'❌', cls:'session',  label:'Session Declined' },
    schedule_accepted:     { icon:'✅', cls:'schedule', label:'Schedule Confirmed' },
    schedule_declined:     { icon:'❌', cls:'schedule', label:'Schedule Declined' },
    reschedule_request:    { icon:'🔄', cls:'schedule', label:'New Time Suggested' },
    session_extended:      { icon:'⏰', cls:'session',  label:'Session Extended' },
    new_message:           { icon:'💬', cls:'message',  label:'New Message' },
    credit_gain:           { icon:'💰', cls:'credit',   label:'Credits Earned' },
    credit_loss:           { icon:'💸', cls:'credit',   label:'Credits Spent' },
    connection_request:    { icon:'🤝', cls:'session',  label:'Connection Request' },
    connection_accepted:   { icon:'🎉', cls:'session',  label:'Connected!' },
    connection_rejected:   { icon:'❌', cls:'session',  label:'Declined' },
    connection_request_sent:{ icon:'📨', cls:'session', label:'Request Sent' },
  };

  function renderItem(n) {
    const meta = META[n.type]||{ icon:'🔔', cls:'system', label:n.type };
    const data = n.data ? (typeof n.data==='string' ? JSON.parse(n.data) : n.data) : {};
    let actions = '';

    if (n.type==='connection_request' && !n.is_read && data.learner_email) {
      const pills = (data.subject||'').split(',').map(s=>s.trim()).filter(Boolean)
        .map(s=>`<span style="background:#2d3a6b;color:#a0b4f0;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;">${esc(s)}</span>`).join('');
      actions = `
        ${pills ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;">${pills}</div>` : ''}
        ${data.message ? `<div style="font-size:11.5px;color:#888;font-style:italic;margin-top:4px;">"${esc(data.message)}"</div>` : ''}
        <div class="notif-actions">
          <button class="notif-btn notif-btn-accept" onclick="notifAcceptConnection('${esc(data.learner_email)}',${n.id})">✓ Accept</button>
          <button class="notif-btn notif-btn-decline" onclick="notifRejectConnection('${esc(data.learner_email)}',${n.id})">✗ Reject</button>
        </div>`;
    }

    if (n.type==='session_request' && !n.is_read && data.session_id && data.learner_email) {
      const typeLabel = data.session_type==='group' ? '👥 Group' : '👤 One-on-One';
      const modeLabel = data.session_mode==='face_to_face' ? '🏫 Face-to-Face' : '💻 Online';
      const prefLine  = data.preferred_time ? `<div style="font-size:11px;color:#7c6af7;margin-top:4px;">⏰ Learner prefers: <strong>${fmtDT(data.preferred_time)}</strong></div>` : '';
      actions = `
        <div style="font-size:11.5px;color:#9ca3af;margin:4px 0;">${typeLabel} · ${modeLabel}</div>
        ${prefLine}
        <div class="notif-schedule-form" id="schedForm_${n.id}">
          <div class="notif-actions" style="margin-bottom:8px;">
            <button class="notif-btn notif-btn-accept" onclick="notifAcceptSessionRequest('${esc(String(data.session_id))}','${esc(data.learner_email)}',${n.id})" style="background:#4caf7d;">✓ Accept Now</button>
          </div>
          <label>📅 Or propose a specific time</label>
          <input type="datetime-local" id="schedTime_${n.id}" min="${new Date().toISOString().slice(0,16)}">
          <div class="notif-actions" style="margin-top:6px;">
            <button class="notif-btn notif-btn-accept" onclick="notifProposeSchedule(${n.id},'${esc(String(data.session_id))}','${esc(data.learner_email)}')">Send Schedule</button>
            <button class="notif-btn notif-btn-decline" onclick="notifRejectSession('${esc(String(data.session_id))}',${n.id})">Reject</button>
          </div>
        </div>`;
    }

    if (n.type==='session_scheduled' && !n.is_read) {
      const pretty = fmtDT(data.scheduled_time);
      actions = `
        <div class="notif-time" style="margin:6px 0;">Proposed: <strong style="color:#a89af9;">${esc(pretty)}</strong></div>
        <div class="notif-actions" style="flex-wrap:wrap;">
          <button class="notif-btn notif-btn-accept" onclick="notifAcceptSchedule('${esc(String(data.session_id))}',${n.id})">✅ Accept</button>
          <button class="notif-btn notif-btn-decline" onclick="toggleCounterForm(${n.id})">🔄 Suggest New Time</button>
          <button class="notif-btn notif-btn-decline" style="background:#1a0a0a;" onclick="notifCancelSchedule('${esc(String(data.session_id))}',${n.id})">❌ Cancel</button>
        </div>
        <div id="counterForm_${n.id}" style="display:none;margin-top:8px;">
          <div class="notif-schedule-form">
            <label>Your preferred time</label>
            <input type="datetime-local" id="counterTime_${n.id}" min="${new Date().toISOString().slice(0,16)}">
            <div class="notif-actions">
              <button class="notif-btn notif-btn-accept" onclick="notifCounterPropose('${esc(String(data.session_id))}',${n.id})">📨 Send</button>
            </div>
          </div>
        </div>`;
    }

    if (n.type==='reschedule_request' && !n.is_read && data.session_id) {
      const pretty = fmtDT(data.new_time);
      actions = `
        <div class="notif-time" style="margin:6px 0;">Learner suggests: <strong style="color:#a89af9;">${esc(pretty)}</strong></div>
        <div class="notif-schedule-form" id="reschedForm_${n.id}">
          <label>Accept learner's time, or propose a new one</label>
          <input type="datetime-local" id="reschedTime_${n.id}" min="${new Date().toISOString().slice(0,16)}">
          <div class="notif-actions">
            <button class="notif-btn notif-btn-accept" onclick="notifAcceptLearnerTime('${esc(String(data.session_id))}',${n.id},'${esc(data.new_time||'')}')">✅ Accept Their Time</button>
            <button class="notif-btn" style="background:#2d3a6b;color:#a0b4f0;" onclick="notifRePropose(${n.id},'${esc(String(data.session_id))}','${esc(data.learner_email||'')}')">📨 Propose New Time</button>
          </div>
        </div>`;
    }

    if (n.type==='schedule_accepted' && !n.is_read && data.session_id) {
      actions = `
        <div class="notif-actions">
          <button class="notif-btn notif-btn-accept" onclick="notifStartSession('${esc(String(data.session_id))}',${n.id})">🟢 Start Session</button>
        </div>`;
    }

    if (n.type==='session_confirmed' && data.session_id && data.session_mode!=='face_to_face') {
      const myEmail  = localStorage.getItem('userEmail')||'';
      const myName   = localStorage.getItem('tandem_username')||localStorage.getItem('userName')||myEmail;
      const tutorEmail = esc(data.tutor_email||'');
      const vcParams = new URLSearchParams({ email:myEmail, peer:tutorEmail, session:String(data.session_id), subject:esc(data.subject||'Session'), name:myName, role:'learner' });
      actions = `
        <div class="notif-time" style="margin:4px 0;">📅 ${esc(fmtDT(data.scheduled_time))}</div>
        <div class="notif-actions">
          <a class="notif-btn notif-btn-view" href="video-call.html?${vcParams}" target="_blank">📹 Open Call Page</a>
          <a class="notif-btn notif-btn-view" href="calendar.html" style="text-decoration:none;">📋 View Calendar</a>
        </div>`;
    }

    if (n.type==='session_started' && !n.is_read && data.session_id && data.session_mode!=='face_to_face') {
      const myEmail  = localStorage.getItem('userEmail')||'';
      const myName   = localStorage.getItem('tandem_username')||localStorage.getItem('userName')||myEmail;
      const tutorEmail = esc(data.tutor_email||'');
      const vcParams = new URLSearchParams({ email:myEmail, peer:tutorEmail, session:String(data.session_id), subject:esc(data.subject||'Session'), name:myName, role:'learner' });
      actions = `
        <div class="notif-actions">
          <a class="notif-btn notif-btn-accept" href="video-call.html?${vcParams}" target="_blank" onclick="markOneReadExposed(${n.id})">📹 Join Call Now</a>
        </div>`;
    }

    if (n.type==='new_message') {
      actions = `
        <div class="notif-actions">
          <button class="notif-btn notif-btn-view" onclick="openChatWith('${esc(data.sender_email||'')}',${n.id})">Open Chat</button>
        </div>`;
    }

    return `
      <div class="notif-item ${n.is_read?'':'unread'}" id="notifItem_${n.id}">
        <div class="notif-icon ${meta.cls}">${meta.icon}</div>
        <div class="notif-body">
          <div class="notif-title">${esc(n.title||meta.label)}</div>
          <div class="notif-sub">${esc(n.body||'')}</div>
          ${actions}
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
        ${n.is_read?'':'<div class="notif-dot"></div>'}
      </div>`;
  }

  async function fetchNotifications() {
    const email = localStorage.getItem('userEmail'); if (!email) return;
    try {
      const res = await fetch(`${API}/get-notifications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      const data = await res.json(); if (!data.success) return;
      const list=document.getElementById('notifList'), badge=document.getElementById('notifBadge');
      const unread=data.notifications.filter(n=>!n.is_read).length;
      if (!list) return;
      list.innerHTML = data.notifications.length
        ? data.notifications.map(renderItem).join('')
        : `<div class="notif-empty"><div class="notif-empty-icon">🔔</div><span>You're all caught up!</span></div>`;
        const isFirstLoad = !badge?.dataset.prev;
        const prevUnread = parseInt(badge?.dataset.prev || '0');
        if (badge) {
          badge.textContent = unread>9?'9+':unread;
          badge.style.display = unread>0?'flex':'none';
          if (!isFirstLoad && unread > prevUnread) playNotifSound();
          badge.dataset.prev = String(unread);
        }
    } catch(e){ console.error(e); }
  }

  async function markAllRead() {
    const email=localStorage.getItem('userEmail'); if (!email) return;
    try { await fetch(`${API}/mark-notifications-read`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}); fetchNotifications(); } catch(e){}
  }

  async function markOneRead(id) {
    const email=localStorage.getItem('userEmail'); if (!email) return;
    try { await fetch(`${API}/mark-notification-read`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,notifId:id})}); } catch(e){}
  }

  window.markOneReadExposed = (id) => markOneRead(id);
  window.toggleCounterForm = (notifId) => {
    const el=document.getElementById(`counterForm_${notifId}`);
    if (el) el.style.display=el.style.display==='none'?'block':'none';
  };

  window.notifAcceptConnection = async (learnerEmail, notifId) => {
    const tutorEmail=localStorage.getItem('userEmail');
    try {
      const r=await(await fetch(`${API}/get-pending-requests`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:tutorEmail})})).json();
      const match=(r.requests||[]).find(x=>x.learner_email===learnerEmail);
      if (!match){showToast('Request not found.');await markOneRead(notifId);fetchNotifications();return;}
      const d=await(await fetch(`${API}/accept-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:match.id,tutorEmail,learnerEmail})})).json();
      if (d.success){showToast('✅ Connection accepted!');await markOneRead(notifId);fetchNotifications();if(typeof refreshAllRequests==='function')refreshAllRequests();}
      else showToast(d.message||'Failed');
    } catch(e){showToast('Error');}
  };

  window.notifRejectConnection = async (learnerEmail, notifId) => {
    const tutorEmail=localStorage.getItem('userEmail');
    try {
      const r=await(await fetch(`${API}/get-pending-requests`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:tutorEmail})})).json();
      const req=(r.requests||[]).find(x=>x.learner_email===learnerEmail);
      if (!req){showToast('Not found.');await markOneRead(notifId);fetchNotifications();return;}
      await fetch(`${API}/reject-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:req.id})});
      showToast('Rejected.');await markOneRead(notifId);fetchNotifications();
      if(typeof refreshAllRequests==='function')refreshAllRequests();
    } catch(e){showToast('Error');}
  };

  window.notifAcceptSessionRequest = async (sessionId, learnerEmail, notifId) => {
    const tutorEmail = localStorage.getItem('userEmail');
    try {
      const d=await(await fetch(`${API}/accept-session-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,tutorEmail,learnerEmail})})).json();
      if(d.success){
        showToast('✅ Session accepted! Scheduled immediately.');
        await markOneRead(notifId);
        fetchNotifications();
        if(typeof loadActiveSession==='function')loadActiveSession();
      } else {
        showToast(d.message||'Failed to accept session');
      }
    } catch(e){ showToast('Error accepting session'); }
  };

  window.notifProposeSchedule = async (notifId, sessionId, learnerEmail) => {
    const input=document.getElementById(`schedTime_${notifId}`);
    if (!input||!input.value){showToast('⚠️ Pick a date and time first.');return;}
    const tutorEmail=localStorage.getItem('userEmail');
    const tutorName=localStorage.getItem('tandem_username')||localStorage.getItem('userName')||'Your mentor';
    try {
      const d=await(await fetch(`${API}/propose-schedule`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,tutorEmail,learnerEmail,scheduledTime:input.value,tutorName})})).json();
      if(d.success){showToast('✅ Schedule sent!');await markOneRead(notifId);fetchNotifications();}
      else showToast(d.message||'Failed');
    } catch(e){showToast('Error');}
  };

  window.notifRejectSession = async (sessionId, notifId) => {
    try {
      await fetch(`${API}/reject-session-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId})});
      showToast('Session rejected.');await markOneRead(notifId);fetchNotifications();
    } catch(e){showToast('Error');}
  };

  window.notifAcceptSchedule = async (sessionId, notifId) => {
    const learnerEmail=localStorage.getItem('userEmail');
    const learnerName=localStorage.getItem('tandem_username')||localStorage.getItem('userName')||'Learner';
    try {
      const d=await(await fetch(`${API}/respond-schedule`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,learnerEmail,learnerName,accepted:true})})).json();
      if(d.success){showToast('✅ Confirmed! Check Calendar for details.');await markOneRead(notifId);fetchNotifications();if(typeof loadCreditsFromDatabase==='function')loadCreditsFromDatabase();}
      else showToast(d.message||'Error');
    } catch(e){showToast('Error');}
  };

  window.notifCounterPropose = async (sessionId, notifId) => {
    const input=document.getElementById(`counterTime_${notifId}`);
    if (!input||!input.value){showToast('⚠️ Pick your preferred time.');return;}
    const learnerEmail=localStorage.getItem('userEmail');
    const learnerName=localStorage.getItem('tandem_username')||localStorage.getItem('userName')||'Learner';
    try {
      const d=await(await fetch(`${API}/respond-schedule`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,learnerEmail,learnerName,accepted:false,newTime:input.value})})).json();
      if(d.success){showToast('🔄 New time sent to mentor.');await markOneRead(notifId);fetchNotifications();}
      else showToast(d.message||'Error');
    } catch(e){showToast('Error');}
  };

  window.notifCancelSchedule = async (sessionId, notifId) => {
    if (!confirm('Cancel this session entirely?')) return;
    const learnerEmail=localStorage.getItem('userEmail');
    const learnerName=localStorage.getItem('tandem_username')||localStorage.getItem('userName')||'Learner';
    try {
      await fetch(`${API}/respond-schedule`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,learnerEmail,learnerName,accepted:false,newTime:null})});
      showToast('Session cancelled.');await markOneRead(notifId);fetchNotifications();
    } catch(e){showToast('Error');}
  };

  window.notifAcceptLearnerTime = async (sessionId, notifId, newTime) => {
    const tutorEmail=localStorage.getItem('userEmail');
    const tutorName=localStorage.getItem('tandem_username')||localStorage.getItem('userName')||'Your mentor';
    try {
      const sessRes = await fetch(`${API}/get-active-session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:tutorEmail})});
      const sessData = await sessRes.json();
      const learnerEmail = sessData.session?.learner_email||'';
      const d=await(await fetch(`${API}/propose-schedule`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,tutorEmail,learnerEmail,scheduledTime:newTime,tutorName})})).json();
      if(d.success){showToast('✅ Accepted learner\'s time!');await markOneRead(notifId);fetchNotifications();}
      else showToast(d.message||'Error');
    } catch(e){showToast('Error');}
  };

  window.notifRePropose = async (notifId, sessionId, learnerEmail) => {
    const input=document.getElementById(`reschedTime_${notifId}`);
    if (!input||!input.value){showToast('⚠️ Pick a new time first.');return;}
    const tutorEmail=localStorage.getItem('userEmail');
    const tutorName=localStorage.getItem('tandem_username')||localStorage.getItem('userName')||'Your mentor';
    try {
      const d=await(await fetch(`${API}/propose-schedule`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,tutorEmail,learnerEmail,scheduledTime:input.value,tutorName})})).json();
      if(d.success){showToast('✅ New schedule sent!');await markOneRead(notifId);fetchNotifications();}
      else showToast(d.message||'Error');
    } catch(e){showToast('Error');}
  };

  window.notifStartSession = async (sessionId, notifId) => {
    const tutorEmail=localStorage.getItem('userEmail');
    try {
      const d=await(await fetch(`${API}/start-session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,tutorEmail})})).json();
      if(d.success){
        showToast('🟢 Session started! Open your Calendar to join the call.');
        await markOneRead(notifId);
        fetchNotifications();
        if(typeof loadCreditsFromDatabase==='function') loadCreditsFromDatabase();
      } else showToast(d.message||'Error starting session');
    } catch(e){showToast('Error');}
  };

  window.openChatWith = async (senderEmail, notifId) => {
    await markOneRead(notifId);
    sessionStorage.setItem('openChatWith', senderEmail);
    window.location.href='messages.html';
  };

  function setupBell() {
    const wrap=document.getElementById('notifBellWrap');
    const dd=document.getElementById('notifDropdown');
    const ma=document.getElementById('notifMarkAll');
    if (!wrap||!dd) return;
    wrap.addEventListener('click', e=>{e.stopPropagation();const open=dd.classList.contains('open');dd.classList.toggle('open',!open);if(!open)fetchNotifications();});
    document.addEventListener('click', ()=>dd.classList.remove('open'));
    dd.addEventListener('click', e=>e.stopPropagation());
    if (ma) ma.addEventListener('click', markAllRead);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setupBell();
    fetchNotifications();
    setInterval(fetchNotifications, POLL);
  });

  window.fetchNotifications = fetchNotifications;
})();