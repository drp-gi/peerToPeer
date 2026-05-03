// API base URL
const API = 'http://localhost:3000';
const BOT_EMAIL = '__tandem_ai_bot__';

const userEmail = localStorage.getItem('userEmail');
if (!userEmail) window.location.href = 'index.html';

// Chat state
let currentChatEmail   = null;
let currentChatName    = null;
let isBotChat          = false;
let messageInterval    = null;
let sessionInterval    = null;
let currentSession     = null;
let sessionTimerInterval = null;
let ratingData         = { rating: 0, tags: new Set() };
let pendingSessionCompletion = null; // { sessionId, elapsedSeconds }

// Bot conversation history — persistent via localStorage
const BOT_HISTORY_KEY = `tandem_bot_history_${userEmail}`;
let botHistory = [];
try { botHistory = JSON.parse(localStorage.getItem(BOT_HISTORY_KEY) || '[]'); } catch(e) { botHistory = []; }

function saveBotHistory() {
    // Keep last 40 messages to avoid localStorage bloat
    const toSave = botHistory.slice(-40);
    localStorage.setItem(BOT_HISTORY_KEY, JSON.stringify(toSave));
}

// Rating tags
const POS_TAGS = ['Clear explanation','Patient','Knowledgeable','Engaging','Helpful','Punctual','Improved my skills'];
const NEG_TAGS = ['Hard to follow','Often late','Ended early','Unprepared'];
const STAR_LABELS = ['','Needs work','Below average','Average','Good','Excellent'];

// ── Credits ───────────────────────────────────────────────────
// FIX 1: Removed the local updateCreditsDisplay() and loadCredits() functions
// that conflicted with credit-sync.js. credit-sync.js is now the single source
// of truth and handles topCreditsBadge on this page.
//
// FIX 2: submitSessionRequest() was using parseFloat() to read credits from
// localStorage which could cause "1.5 < 1" style comparison bugs when the
// stored value was a decimal. Replaced with Math.round(Number(...)).
//
// FIX 3: The socket.on('credits-updated') handler was calling the local
// updateCreditsDisplay() — removed it so credit-sync.js's own socket listener
// handles all real-time credit updates consistently.
//
// FIX 4: doCompleteSession() called the now-removed loadCredits() after session
// completion. Replaced with window.syncCredits() exposed by credit-sync.js.

// ── Generic fetch helper ──────────────────────────────────────

async function post(path, body) {
    const r = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return r.json();
}

// ── Check if learner has an unrated completed session ─────────
// Learner cannot start a new session until they rate their last one

async function checkUnratedSession(tutorEmail) {
    try {
        const r = await fetch(`${API}/get-unrated-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ learnerEmail: userEmail, tutorEmail })
        });
        const d = await r.json();
        return d.session || null;
    } catch(e) { return null; }
}

// ── Connections list ──────────────────────────────────────────

async function loadConnections() {
    try {
        const data = await post('/get-connections', { email: userEmail });
        const list = document.getElementById('connectionsList');
        if (data.connections && data.connections.length) {
            list.innerHTML = data.connections.map(c => `
                <div class="connection-item" id="connItem_${c.connected_email}" onclick="selectChat('${c.connected_email}','${esc(c.connected_name||c.connected_username)}')">
                    <div class="connection-avatar">
                        ${c.connected_profile_pic
                            ? `<img src="${c.connected_profile_pic}" alt="">`
                            : `<div class="avatar-placeholder" style="font-size:16px;font-weight:700;color:#29b6d8;">${(c.connected_name||c.connected_username||'U').charAt(0).toUpperCase()}</div>`}
                    </div>
                    <div class="connection-info">
                        <div class="connection-name">${esc(c.connected_name||c.connected_username)}</div>
                        <div class="connection-preview" id="status_${c.connected_email}">Click to chat</div>
                    </div>
                </div>`).join('');
        } else {
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&#x1F44B;</div><h4>No connections yet</h4><p>Go to Find Mentors!</p></div>`;
        }
    } catch(e) { document.getElementById('connectionsList').innerHTML = '<div class="empty-state">Error loading</div>'; }
}

async function checkUserSessionStatus(email) {
    try {
        const d = await post('/get-active-session', { email });
        return d.session && d.session.status === 'active';
    } catch(e) { return false; }
}

async function updateConnectionStatuses() {
    for (const conn of document.querySelectorAll('.connection-item')) {
        const email = conn.id?.replace('connItem_', '');
        if (!email) continue;
        const inSess = await checkUserSessionStatus(email);
        const el = document.getElementById(`status_${email}`);
        if (el) el.innerHTML = inSess ? '<span style="color:#e05555;">In a session</span>' : 'Available to chat';
    }
}

// ── Mobile nav ────────────────────────────────────────────────

function mobileBackToList() {
    document.getElementById('connectionsSidebar').classList.remove('mobile-hidden');
    document.getElementById('chatArea').classList.remove('mobile-active');
    document.getElementById('mobileBackBtn').style.display = 'none';
}

function mobileSwitchToChat() {
    if (window.innerWidth <= 600) {
        document.getElementById('connectionsSidebar').classList.add('mobile-hidden');
        document.getElementById('chatArea').classList.add('mobile-active');
        document.getElementById('mobileBackBtn').style.display = 'flex';
    }
}

// ── Exit chat — clears all active state ───────────────────────

function exitChat() {
    currentChatEmail = null;
    currentChatName  = null;
    isBotChat = false;
    if (messageInterval) { clearInterval(messageInterval); messageInterval = null; }
    if (sessionInterval) { clearInterval(sessionInterval); sessionInterval = null; }

    document.querySelectorAll('.connection-item').forEach(i => i.classList.remove('active'));
    document.getElementById('botChatItem')?.classList.remove('active');

    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
        <div class="no-connection">
            <div class="no-connection-icon">&#x1F4AC;</div>
            <h4>No conversation selected</h4>
            <p>Pick a chat or talk to Tandem AI</p>
        </div>`;

    if (window.innerWidth <= 600) mobileBackToList();
}

// ── Select a human chat ───────────────────────────────────────

async function selectChat(chatEmail, chatName) {
    isBotChat = false;
    currentChatEmail = chatEmail;
    currentChatName  = chatName;

    document.querySelectorAll('.connection-item').forEach(i => i.classList.remove('active'));
    document.getElementById('botChatItem')?.classList.remove('active');
    document.getElementById(`connItem_${chatEmail}`)?.classList.add('active');

    mobileSwitchToChat();
    await loadMessages(chatEmail, chatName);
    await loadActiveSession();
    if (messageInterval) clearInterval(messageInterval);
    messageInterval = setInterval(() => loadMessages(chatEmail, chatName, true), 3000);
    if (sessionInterval) clearInterval(sessionInterval);
    sessionInterval = setInterval(() => loadActiveSession(), 5000);
}

// ── AI Bot chat ───────────────────────────────────────────────

function selectBotChat() {
    isBotChat = true;
    currentChatEmail = BOT_EMAIL;
    currentChatName  = 'Tandem Study AI';
    if (messageInterval) clearInterval(messageInterval);
    if (sessionInterval) clearInterval(sessionInterval);

    document.querySelectorAll('.connection-item').forEach(i => i.classList.remove('active'));
    document.getElementById('botChatItem')?.classList.add('active');
    mobileSwitchToChat();
    renderBotChat();
}

function renderBotChat() {
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
        <div class="chat-header">
            <div class="chat-header-avatar" style="background:linear-gradient(135deg,#29b6d8,#7c6af7);display:flex;align-items:center;justify-content:center;font-size:18px;">&#x1F916;</div>
            <div class="chat-header-info">
                <div class="chat-header-name">Tandem Study AI</div>
                <div class="chat-header-status" style="color:#4caf7d;">Always available</div>
            </div>
            <div class="chat-header-actions">
                <button class="exit-chat-btn" onclick="exitChat()">Exit chat</button>
            </div>
        </div>
        <div class="messages-area" id="messagesArea" style="background:#fafcff;"></div>
        <div class="message-input-area">
            <input type="text" class="message-input" id="messageInput" placeholder="Ask anything — subjects, study tips, explanations...">
            <button class="send-btn" id="sendMsgBtn">Send</button>
        </div>`;

    const area = document.getElementById('messagesArea');

    if (!botHistory.length) {
        appendBotMsg(area, 'Hi! I am the **Tandem Study AI**. I can help you with:\n\n• Explaining subjects and concepts\n• Study tips and strategies\n• Practice questions\n• Recommendations on what to learn next\n\nWhat would you like to know?');
    } else {
        botHistory.forEach(m => {
            if (m.role === 'user') appendUserBotMsg(area, m.content);
            else appendBotMsg(area, m.content);
        });
    }
    area.scrollTop = area.scrollHeight;

    document.getElementById('sendMsgBtn').onclick = sendBotMessage;
    document.getElementById('messageInput').onkeypress = e => { if (e.key === 'Enter') sendBotMessage(); };
}

function appendBotMsg(area, text) {
    const el = document.createElement('div');
    el.className = 'bot-message-wrap';
    el.innerHTML = `
        <div class="bot-avatar-mini">&#x1F916;</div>
        <div class="bot-message bot-bubble">${formatBotText(text)}</div>`;
    area.appendChild(el);
}
function appendUserBotMsg(area, text) {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:10px;';
    el.innerHTML = `<div class="bot-message bot-bubble-user">${esc(text)}</div>`;
    area.appendChild(el);
}
function formatBotText(t) {
    return esc(t)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/&bull;|• /g, '&bull; ');
}

async function sendBotMessage() {
    const inp = document.getElementById('messageInput');
    const msg = inp?.value.trim();
    if (!msg) return;
    inp.value = '';

    const area = document.getElementById('messagesArea');
    appendUserBotMsg(area, msg);
    botHistory.push({ role: 'user', content: msg });
    area.scrollTop = area.scrollHeight;

    const thinking = document.createElement('div');
    thinking.className = 'bot-message-wrap';
    thinking.id = 'botThinking';
    thinking.innerHTML = `<div class="bot-avatar-mini">&#x1F916;</div><div class="bot-thinking"><div class="bot-dot"></div><div class="bot-dot"></div><div class="bot-dot"></div></div>`;
    area.appendChild(thinking);
    area.scrollTop = area.scrollHeight;

    const userGrowth = JSON.parse(localStorage.getItem('tandem_growth') || '[]');
    const userSkills = JSON.parse(localStorage.getItem('tandem_skills') || '[]');
    const grade = localStorage.getItem('tandem_grade') || '';

    const systemPrompt = `You are the Tandem Study AI, a knowledgeable and helpful academic tutor assistant built into the Tandem peer-tutoring platform.

Student context:
- Learning goals: ${userGrowth.join(', ') || 'general academics'}
- Current skills: ${userSkills.join(', ') || 'various subjects'}
- Grade level: ${grade || 'not specified'}

Your role:
- Answer ANY message naturally, including greetings. If someone says "hi", respond warmly and ask what they need help with.
- Explain academic concepts clearly and thoroughly.
- Suggest study strategies personalized to the student.
- Recommend subjects to study next based on their goals.
- If asked about finding a human mentor, tell them to use the Find Mentors section.
- Keep responses concise but complete. Use **bold** for key terms. Use bullet points with • for lists.
- Never just repeat an introductory message — always respond meaningfully to what the user said.`;

    const messages = botHistory.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
        const response = await fetch(`${API}/ai-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, systemPrompt })
        });
        const data = await response.json();
        const reply = data.reply || getBotFallback(msg, userGrowth);
        botHistory.push({ role: 'assistant', content: reply });
        saveBotHistory();
        thinking.remove();
        appendBotMsg(area, reply);
    } catch(e) {
        thinking.remove();
        const fallback = getBotFallback(msg, userGrowth);
        botHistory.push({ role: 'assistant', content: fallback });
        saveBotHistory();
        appendBotMsg(area, fallback);
    }
    area.scrollTop = area.scrollHeight;
}

function getBotFallback(msg, growth) {
    const m = msg.toLowerCase();
    if (/^(hi|hello|hey|sup|yo|howdy|greetings)/.test(m)) {
        const subj = growth[0] || 'your subjects';
        return `Hi there! Great to hear from you. I am here to help with **${subj}** or any other academic topic.\n\nWhat would you like to explore today? You can ask me to:\n• Explain a concept\n• Give you practice questions\n• Suggest a study plan\n• Recommend what to learn next`;
    }
    if (m.includes('study tip') || m.includes('how to study')) {
        return `Here are proven study strategies:\n\n• **Pomodoro Technique** — 25 min focused study, 5 min break\n• **Active recall** — test yourself instead of re-reading\n• **Spaced repetition** — review material at increasing intervals\n• **Teach it back** — explain concepts aloud as if teaching someone\n• **Mind maps** — visualize connections between ideas\n\nWant tips for a specific subject?`;
    }
    if (m.includes('recommend') || m.includes('what should i study')) {
        const subj = growth[0] || 'your chosen subject';
        return `Based on your learning goals, I suggest focusing on **${subj}**.\n\nA good study path:\n1. Master the fundamentals first\n2. Practice with worked examples\n3. Find a mentor for guided sessions\n4. Test yourself regularly\n\nYou can find mentors who teach ${subj} in the **Find Mentors** section.`;
    }
    if (m.includes('math') || m.includes('algebra') || m.includes('calculus')) {
        return `For Math success:\n\n• Practice daily — even 20 minutes matters\n• **Never skip steps** — write everything out\n• Work backwards from answers to understand solutions\n• Khan Academy is great for free video explanations\n• Finding a mentor for 1-on-1 help is highly effective for Math!\n\nWhat specific Math topic can I explain?`;
    }
    return `That is a great question! I am having a brief connection issue, but I am here to help with:\n\n• **Concept explanations** — ask me about any subject\n• **Study strategies** — tips for better learning\n• **Practice questions** — ask me to quiz you\n• **Learning roadmaps** — what to study next\n\nWhat subject would you like to explore?`;
}

// ── Active session management ─────────────────────────────────

async function loadActiveSession() {
    if (isBotChat) return;
    try {
        const data = await post('/get-active-session', { email: userEmail });
        if (data.success && data.session) {
            currentSession = data.session;
            const isLearner = data.session.user_role === 'learner';
            if (data.session.status === 'pending' && !isLearner) {
                showSessionRequestUI(data.session);
            } else if (data.session.status === 'active') {
                showActiveSessionUI(data.session);
            } else {
                hideSessionUI();
            }
        } else {
            currentSession = null;
            hideSessionUI();
        }
        updateConnectionStatuses();
    } catch(e) { console.error(e); }
}

function showSessionRequestUI(session) {
    document.getElementById('sessionModalTitle').textContent = 'Incoming Session Request';
    document.getElementById('sessionModalBody').innerHTML = `
        <div class="session-info">
            <p><strong>${esc(session.learner_name||session.learner_username)}</strong> wants to learn:</p>
            <p style="font-weight:600;color:#29b6d8;margin-top:4px;">&#x1F4DA; ${esc(session.subject||'General')}</p>
            <p style="font-size:12px;color:#888;margin-top:4px;">
                ${session.session_type==='group'?'Group':'One-on-One'} &middot;
                ${session.session_mode==='face_to_face'?'Face-to-Face':'Online'}
                ${session.preferred_time?` &middot; ${new Date(session.preferred_time).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})}`:''}</p>
            ${session.session_notes?`<p class="session-notes">"${esc(session.session_notes)}"</p>`:''}
        </div>
        <p style="font-size:12px;color:#888;margin:10px 0 5px;">Propose a schedule:</p>
        <input type="datetime-local" id="mentorScheduleInput" class="session-input" min="${new Date().toISOString().slice(0,16)}">
        <div class="session-actions" style="margin-top:10px;">
            <button class="session-btn-accept" onclick="notifAcceptSessionRequestInline(${session.id},'${session.learner_email}')">Accept Now</button>
            <button class="session-btn-accept" style="background:#4caf7d;" onclick="mentorProposeSchedule(${session.id},'${session.learner_email}')">Propose Time</button>
            <button class="session-btn-reject" onclick="rejectSessionRequest(${session.id})">Reject</button>
        </div>`;
    document.getElementById('sessionModal').style.display = 'flex';
}

async function notifAcceptSessionRequestInline(sessionId, learnerEmail) {
    const d = await post('/accept-session-request', { sessionId, tutorEmail: userEmail, learnerEmail });
    if (d.success) { showToast('Session accepted!'); hideSessionUI(); await loadActiveSession(); }
    else showToast(d.message || 'Failed');
}

async function mentorProposeSchedule(sessionId, learnerEmail) {
    const input = document.getElementById('mentorScheduleInput');
    if (!input?.value) { showToast('Pick a date and time.'); return; }
    const tutorName = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'Your mentor';
    const d = await post('/propose-schedule', { sessionId, tutorEmail: userEmail, learnerEmail, scheduledTime: input.value, tutorName });
    if (d.success) { showToast('Schedule sent!'); hideSessionUI(); await loadActiveSession(); }
    else showToast(d.message || 'Failed');
}

function showActiveSessionUI(session) {
    const isLearner = session.user_role === 'learner';
    const peerEmail = isLearner ? session.tutor_email : session.learner_email;
    const myName    = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || userEmail;
    const vcParams  = new URLSearchParams({ email: userEmail, peer: peerEmail, session: session.id, subject: session.subject||'Session', name: myName, role: session.user_role||'learner' });
    const vcUrl     = `video-call.html?${vcParams}`;
    const isOnline  = session.session_mode !== 'face_to_face';

    document.getElementById('sessionModalTitle').textContent = 'Active Session';
    document.getElementById('sessionModalBody').innerHTML = `
        <div class="session-timer" id="sessionTimerDisplay" style="font-size:38px;font-weight:700;text-align:center;color:#f5a623;font-variant-numeric:tabular-nums;margin-bottom:8px;">
            ${isOnline ? 'Waiting to join...' : '00:00'}
        </div>
        <div class="session-info">
            <p><strong>${esc(isLearner ? (session.tutor_name||session.tutor_username) : (session.learner_name||session.learner_username))}</strong></p>
            <p style="margin-top:3px;">&#x1F4DA; ${esc(session.subject||'General')}</p>
            <p style="font-size:12px;color:#888;margin-top:2px;">${session.session_type==='group'?'Group':'One-on-One'} &middot; ${isOnline?'Online':'Face-to-Face'}</p>
            <p class="session-status-active">In progress</p>
        </div>
        <div class="session-actions" style="flex-direction:column;gap:8px;margin-top:12px;">
            ${isOnline
                ? `<a href="${vcUrl}" target="_blank" class="session-btn-accept" style="text-decoration:none;text-align:center;display:block;" id="joinCallBtn">Join Video Call</a>`
                : `<p style="font-size:12px;color:#888;text-align:center;">Meet at the agreed location</p>`}
            <button class="session-btn-complete" id="completeSessionBtn">Complete Session</button>
        </div>`;

    document.getElementById('sessionModal').style.display = 'flex';
    const btn = document.getElementById('completeSessionBtn');
    if (btn) { const nb = btn.cloneNode(true); btn.parentNode.replaceChild(nb, btn); nb.onclick = () => triggerRatingModal(); }
}

function startSessionTimer(startTime, durationMs) {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    const end = new Date(startTime).getTime() + durationMs;
    function tick() {
        const rem = end - Date.now();
        const el = document.getElementById('sessionTimerDisplay');
        if (!el) return;
        if (rem <= 0) { clearInterval(sessionTimerInterval); el.textContent = '00:00'; return; }
        const m = String(Math.floor(rem / 60000)).padStart(2, '0');
        const s = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
        el.textContent = `${m}:${s}`;
    }
    tick();
    sessionTimerInterval = setInterval(tick, 1000);
}

function hideSessionUI() {
    const m = document.getElementById('sessionModal');
    if (m) m.style.display = 'none';
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
}

// ── Rating modal ──────────────────────────────────────────────

function initRatingTags() {
    const pos = document.getElementById('posTags');
    const neg = document.getElementById('negTags');
    if (pos) pos.innerHTML = POS_TAGS.map(t => `<span class="feedback-tag" onclick="toggleTag(this,'${t}')">${t}</span>`).join('');
    if (neg) neg.innerHTML = NEG_TAGS.map(t => `<span class="feedback-tag" onclick="toggleTag(this,'${t}')">${t}</span>`).join('');
}
window.toggleTag = (el, val) => {
    el.classList.toggle('selected');
    if (el.classList.contains('selected')) ratingData.tags.add(val);
    else ratingData.tags.delete(val);
};

function triggerRatingModal(sessionId, peerName, subject, elapsedSecs) {
    const sid   = sessionId || currentSession?.id;
    const sName = peerName  || (currentSession?.user_role === 'learner' ? (currentSession?.tutor_name || currentSession?.tutor_username) : (currentSession?.learner_name || currentSession?.learner_username)) || 'your mentor';
    const subj  = subject   || currentSession?.subject || 'Session';
    const elSec = typeof elapsedSecs === 'number' ? elapsedSecs : 0;

    pendingSessionCompletion = { sessionId: sid, elapsedSeconds: elSec };
    ratingData = { rating: 0, tags: new Set() };

    initRatingTags();
    document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('lit'));
    document.getElementById('starLabel').textContent = '';
    const rt = document.getElementById('ratingText'); if (rt) rt.value = '';
    document.getElementById('ratingMeta').textContent = `with ${sName} — ${subj}`;
    document.getElementById('ratingOverlay').style.display = 'flex';

    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.onclick = () => {
            const v = parseInt(btn.dataset.v);
            ratingData.rating = v;
            document.querySelectorAll('.star-btn').forEach((b, i) => b.classList.toggle('lit', i < v));
            document.getElementById('starLabel').textContent = STAR_LABELS[v] || '';
        };
    });
}

window.submitRating = async (doSubmit) => {
    document.getElementById('ratingOverlay').style.display = 'none';
    if (!pendingSessionCompletion) return;
    const { sessionId, elapsedSeconds } = pendingSessionCompletion;
    const rating   = doSubmit ? (ratingData.rating || null) : null;
    const feedback = doSubmit ? (document.getElementById('ratingText')?.value.trim() || '') : '';
    const tags     = doSubmit ? [...ratingData.tags] : [];
    await doCompleteSession(sessionId, rating, feedback, elapsedSeconds, tags);
    pendingSessionCompletion = null;
};

async function doCompleteSession(sessionId, rating, feedback, elapsedSeconds, feedbackTags) {
    try {
        const d = await post('/complete-session', { sessionId, rating, feedback, elapsedSeconds: elapsedSeconds || 0, feedbackTags: feedbackTags || [] });
        if (d.success) {
            showToast('Session completed!');
            // FIX: Use credit-sync.js's syncCredits() instead of the removed local loadCredits()
            if (typeof window.syncCredits === 'function') window.syncCredits();
            await loadActiveSession();
            hideSessionUI();
            if (currentChatEmail && !isBotChat) await loadMessages(currentChatEmail, currentChatName);
        } else showToast(d.message || 'Error completing session');
    } catch(e) { showToast('Error completing session'); }
}

// ── Face-to-face timer confirmation ──────────────────────────

let f2fSessionId = null;

window.showF2fStartOverlay = function(sessionId) {
    f2fSessionId = sessionId;
    document.getElementById('f2fStartOverlay').style.display = 'flex';
};

window.confirmF2fStart = async function() {
    document.getElementById('f2fStartOverlay').style.display = 'none';
    if (!f2fSessionId) return;
    try {
        const d = await post('/learner-confirm-f2f', { sessionId: f2fSessionId, learnerEmail: userEmail });
        if (d.success) { showToast('Timer started!'); await loadActiveSession(); }
        else showToast(d.message || 'Error');
    } catch(e) { showToast('Error confirming session'); }
};

window.declineF2fStart = function() {
    document.getElementById('f2fStartOverlay').style.display = 'none';
    showToast('Let your mentor know when you are ready.');
};

// ── Session request modal ─────────────────────────────────────

async function showSessionRequestModal(tutorEmail, tutorName) {
    const unrated = await checkUnratedSession(tutorEmail);
    if (unrated) {
        showToast('Please rate your last session before requesting a new one.');
        triggerRatingModal(unrated.id, tutorName, unrated.subject, unrated.elapsed_seconds || 0);
        return;
    }

    let subjects = [];
    try {
        const d = await post('/get-requestable-subjects', { learnerEmail: userEmail, tutorEmail });
        subjects = d.subjects || [];
    } catch(e) {}

    const subjectOptions = subjects.length
        ? subjects.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')
        : '<option value="">No subjects available</option>';
    const minDT = new Date().toISOString().slice(0, 16);

    document.getElementById('sessionRequestModal').style.display = 'flex';
    document.getElementById('sessionRequestModal').querySelector('.session-modal-content').innerHTML = `
        <div class="session-modal-header">
            <h3>Request a Session</h3>
            <button class="session-modal-close" onclick="closeSessionRequestModal()">&times;</button>
        </div>
        <div class="session-modal-body" style="padding:16px;display:flex;flex-direction:column;gap:10px;">
            <p style="font-size:13px;color:#555;margin:0;">with <strong>${esc(tutorName)}</strong></p>
            <div>
                <label style="font-size:12px;font-weight:600;color:#333;display:block;margin-bottom:5px;">Subject *</label>
                <select id="sessSubjectSelect" class="session-input" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;">
                    <option value="">Select a subject...</option>${subjectOptions}
                </select>
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px;display:block;">Session Type *</label>
                <div style="display:flex;gap:7px;">
                    <label id="typeCardSolo" style="flex:1;border:2px solid #29b6d8;border-radius:9px;padding:9px;cursor:pointer;text-align:center;">
                        <input type="radio" name="sessType" value="solo" style="display:none;" checked>
                        <div style="font-size:16px;">&#x1F464;</div><div style="font-size:11px;font-weight:600;color:#333;">One-on-One</div>
                    </label>
                    <label id="typeCardGroup" style="flex:1;border:2px solid #ddd;border-radius:9px;padding:9px;cursor:pointer;text-align:center;">
                        <input type="radio" name="sessType" value="group" style="display:none;">
                        <div style="font-size:16px;">&#x1F465;</div><div style="font-size:11px;font-weight:600;color:#333;">Group</div>
                    </label>
                </div>
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px;display:block;">Mode *</label>
                <div style="display:flex;gap:7px;">
                    <label id="modeCardOnline" style="flex:1;border:2px solid #29b6d8;border-radius:9px;padding:9px;cursor:pointer;text-align:center;">
                        <input type="radio" name="sessMode" value="online" style="display:none;" checked>
                        <div style="font-size:16px;">&#x1F4BB;</div><div style="font-size:11px;font-weight:600;color:#333;">Online</div>
                    </label>
                    <label id="modeCardFace" style="flex:1;border:2px solid #ddd;border-radius:9px;padding:9px;cursor:pointer;text-align:center;">
                        <input type="radio" name="sessMode" value="face_to_face" style="display:none;">
                        <div style="font-size:16px;">&#x1F3EB;</div><div style="font-size:11px;font-weight:600;color:#333;">Face-to-Face</div>
                    </label>
                </div>
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#333;display:block;margin-bottom:5px;">Preferred Date &amp; Time *</label>
                <input type="datetime-local" id="sessDateTime" min="${minDT}" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;">
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#333;display:block;margin-bottom:5px;">Notes (optional)</label>
                <textarea id="sessNotes" rows="2" placeholder="Your level, what to focus on..." style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;"></textarea>
            </div>
            <div style="background:#fef9c3;border:1px solid #f5a623;border-radius:7px;padding:8px;font-size:12px;color:#854d0e;">
                1 credit will be deducted when the mentor starts the session.
            </div>
            <div style="display:flex;gap:8px;">
                <button class="session-btn-send" style="flex:2;" onclick="submitSessionRequest('${esc(tutorEmail)}','${esc(tutorName)}')">Send Request</button>
                <button class="session-btn-cancel" style="flex:1;" onclick="closeSessionRequestModal()">Cancel</button>
            </div>
        </div>`;

    ['typeCardSolo','typeCardGroup'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => {
            ['typeCardSolo','typeCardGroup'].forEach(x => document.getElementById(x).style.borderColor = '#ddd');
            document.getElementById(id).style.borderColor = '#29b6d8';
            document.getElementById(id).querySelector('input').checked = true;
        });
    });
    ['modeCardOnline','modeCardFace'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => {
            ['modeCardOnline','modeCardFace'].forEach(x => document.getElementById(x).style.borderColor = '#ddd');
            document.getElementById(id).style.borderColor = '#29b6d8';
            document.getElementById(id).querySelector('input').checked = true;
        });
    });
}

async function submitSessionRequest(tutorEmail, tutorName) {
    const subject   = document.getElementById('sessSubjectSelect')?.value;
    const typeRadio = document.querySelector('input[name="sessType"]:checked');
    const modeRadio = document.querySelector('input[name="sessMode"]:checked');
    const dtInput   = document.getElementById('sessDateTime')?.value;
    const notes     = document.getElementById('sessNotes')?.value || '';
    if (!subject) { showToast('Select a subject.'); return; }
    if (!dtInput) { showToast('Choose a date and time.'); return; }
    // FIX: was parseFloat() which could produce incorrect comparisons on decimal
    // values like 0.5. Math.round(Number()) ensures a clean integer check.
    const credits = Math.round(Number(localStorage.getItem('tandem_credits') || '5'));
    if (credits < 1) { showToast('Not enough credits!'); return; }
    const d = await post('/send-session-request', {
        learnerEmail: userEmail, tutorEmail, subject,
        sessionNotes: notes, sessionType: typeRadio?.value || 'solo',
        sessionMode: modeRadio?.value || 'online', preferredTime: dtInput
    });
    if (d.success) { showToast('Request sent!'); closeSessionRequestModal(); await loadActiveSession(); }
    else showToast(d.message || 'Failed');
}

async function rejectSessionRequest(sessionId) {
    const d = await post('/reject-session-request', { sessionId });
    if (d.success) { showToast('Rejected'); hideSessionUI(); await loadActiveSession(); }
}

function closeSessionRequestModal() { document.getElementById('sessionRequestModal').style.display = 'none'; }
function closeSessionModal()        { document.getElementById('sessionModal').style.display = 'none'; }

// ── Human messages ────────────────────────────────────────────

function formatMessageTime(ds) { return new Date(ds).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }); }
function formatMessageDate(ds) {
    const d = new Date(ds), t = new Date(); t.setHours(0, 0, 0, 0);
    const y = new Date(t); y.setDate(y.getDate() - 1);
    const md = new Date(d); md.setHours(0, 0, 0, 0);
    if (md.getTime() === t.getTime()) return 'Today';
    if (md.getTime() === y.getTime()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function groupMessagesByDate(msgs) {
    return msgs.reduce((g, m) => { const k = new Date(m.created_at).toDateString(); (g[k] = g[k] || []).push(m); return g; }, {});
}

async function loadMessages(chatEmail, chatName, isPolling = false) {
    if (isBotChat) return;
    try {
        const data = await post('/get-messages', { user1Email: userEmail, user2Email: chatEmail });
        const chatArea = document.getElementById('chatArea');
        const otherInSess = await checkUserSessionStatus(chatEmail);

        if (!isPolling) {
            const connItem = document.getElementById(`connItem_${chatEmail}`);
            let pic = '';
            if (connItem) { const img = connItem.querySelector('.connection-avatar img'); if (img) pic = img.src; }

            const myS = currentSession;
            const sharedActive = myS && myS.status === 'active' &&
                ((myS.learner_email === userEmail && myS.tutor_email === chatEmail) ||
                 (myS.tutor_email === userEmail && myS.learner_email === chatEmail));
            const myName = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || userEmail;
            const vcParams = sharedActive ? new URLSearchParams({ email: userEmail, peer: chatEmail, session: myS.id, subject: myS.subject || 'Session', name: myName, role: myS.user_role || 'learner' }) : null;
            const vcBtn = (sharedActive && myS?.session_mode !== 'face_to_face')
                ? `<a href="video-call.html?${vcParams}" target="_blank" class="video-call-btn">Video Call</a>` : '';

            chatArea.innerHTML = `
                <div class="chat-header">
                    <div class="chat-header-avatar">
                        ${pic ? `<img src="${pic}" alt="">` : `<div style="font-size:16px;font-weight:700;color:#29b6d8;">${chatName.charAt(0).toUpperCase()}</div>`}
                    </div>
                    <div class="chat-header-info">
                        <div class="chat-header-name">${esc(chatName)}</div>
                        <div class="chat-header-status">${otherInSess ? '<span style="color:#e05555;">In a session</span>' : 'Connected'}</div>
                    </div>
                    <div class="chat-header-actions">
                        ${vcBtn}
                        <button class="session-request-btn" id="sessReqBtn" ${otherInSess ? 'disabled style="opacity:0.5;"' : ''}>Request Session</button>
                        <button class="exit-chat-btn" onclick="exitChat()">Exit</button>
                    </div>
                </div>
                <div class="messages-area" id="messagesArea"></div>
                <div class="message-input-area">
                    <input type="text" class="message-input" id="messageInput" placeholder="Type a message..." ${otherInSess ? 'disabled' : ''}>
                    <button class="send-btn" id="sendMsgBtn" ${otherInSess ? 'disabled' : ''}>Send</button>
                </div>`;

            const sessBtn = document.getElementById('sessReqBtn');
            if (sessBtn && !otherInSess) sessBtn.onclick = () => showSessionRequestModal(chatEmail, chatName);
            const sendBtn = document.getElementById('sendMsgBtn');
            if (sendBtn && !otherInSess) sendBtn.onclick = sendHumanMessage;
            const inp = document.getElementById('messageInput');
            if (inp && !otherInSess) inp.onkeypress = e => { if (e.key === 'Enter') sendHumanMessage(); };
        }

        const area = document.getElementById('messagesArea');
        if (area) {
            if (data.messages?.length) {
                const grouped = groupMessagesByDate(data.messages);
                let html = '';
                for (const [, msgs] of Object.entries(grouped)) {
                    html += `<div class="message-date-separator"><span>${formatMessageDate(msgs[0].created_at)}</span></div>`;
                    msgs.forEach(m => {
                        html += `<div class="message ${m.sender_email === userEmail ? 'message-sent' : 'message-received'}">
                            <div class="message-text">${esc(m.message)}</div>
                            <div class="message-time">${formatMessageTime(m.created_at)}</div>
                        </div>`;
                    });
                }
                area.innerHTML = html;
                area.scrollTop = area.scrollHeight;
            } else {
                area.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&#x1F4AC;</div><h4>No messages yet</h4><p>Say hello!</p></div>`;
            }
        }
    } catch(e) { console.error(e); }
}

async function sendHumanMessage() {
    const inp = document.getElementById('messageInput');
    const msg = inp?.value.trim();
    if (!msg || !currentChatEmail) return;
    if (await checkUserSessionStatus(currentChatEmail)) { showToast('User is in a session.'); return; }
    await post('/send-message', { senderEmail: userEmail, receiverEmail: currentChatEmail, message: msg });
    if (inp) inp.value = '';
    await loadMessages(currentChatEmail, currentChatName);
}

// ── Utilities ─────────────────────────────────────────────────

function esc(t) {
    if (!t) return '';
    const d = document.createElement('div'); d.textContent = t; return d.innerHTML;
}
function showToast(msg) {
    const t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('toast-show');
    setTimeout(() => t.classList.remove('toast-show'), 3500);
}

// ── Expose globals ────────────────────────────────────────────

window.selectChat                      = selectChat;
window.selectBotChat                   = selectBotChat;
window.exitChat                        = exitChat;
window.sendHumanMessage                = sendHumanMessage;
window.rejectSessionRequest            = rejectSessionRequest;
window.mentorProposeSchedule           = mentorProposeSchedule;
window.notifAcceptSessionRequestInline = notifAcceptSessionRequestInline;
window.showSessionRequestModal         = showSessionRequestModal;
window.closeSessionRequestModal        = closeSessionRequestModal;
window.closeSessionModal               = closeSessionModal;
window.submitSessionRequest            = submitSessionRequest;
window.triggerRatingModal              = triggerRatingModal;
window.mobileBackToList                = mobileBackToList;
window.loadActiveSession               = loadActiveSession;

// ── Real-time via Socket.io ───────────────────────────────────
// FIX: Removed the local socket.on('credits-updated') handler that called the
// now-deleted updateCreditsDisplay(). credit-sync.js registers its own
// 'credits-updated' listener and is the single handler for real-time updates.

if (typeof io !== 'undefined') {
    const socket = io(API);
    socket.on('connect', () => socket.emit('register-user', { email: userEmail }));
    socket.on('f2f-session-started', ({ sessionId }) => {
        if (currentSession?.id === sessionId && currentSession?.user_role === 'learner') {
            window.showF2fStartOverlay(sessionId);
        }
    });
}

// ── Init ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // FIX: Removed loadCredits() call — credit-sync.js handles this on DOMContentLoaded
    loadConnections();
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        [messageInterval, sessionInterval, sessionTimerInterval].forEach(i => clearInterval(i));
        localStorage.clear();
        window.location.href = 'index.html';
    });
    loadActiveSession();

    const autoOpen = sessionStorage.getItem('openChatWith');
    if (autoOpen) {
        sessionStorage.removeItem('openChatWith');
        setTimeout(async () => {
            if (autoOpen === BOT_EMAIL) { selectBotChat(); return; }
            try {
                const data = await post('/get-connections', { email: userEmail });
                const conn = (data.connections || []).find(c => c.connected_email === autoOpen);
                if (conn) selectChat(conn.connected_email, conn.connected_username || conn.connected_name);
            } catch(e) {}
        }, 600);
    }

    const showRating = sessionStorage.getItem('showRatingOnLoad');
    if (showRating === '1') {
        sessionStorage.removeItem('showRatingOnLoad');
        const elapsed = parseInt(sessionStorage.getItem('lastSessionElapsed') || '0');
        const sid     = sessionStorage.getItem('lastSessionId') || '';
        setTimeout(() => {
            if (sid) triggerRatingModal(sid, '', '', elapsed);
        }, 800);
    }

    setInterval(() => { loadConnections(); updateConnectionStatuses(); }, 30000);
});