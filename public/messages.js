// API base URL
const API = 'http://localhost:3000';
const BOT_EMAIL = '__tandem_ai_bot__';

const userEmail = localStorage.getItem('userEmail');
if (!userEmail) window.location.href = 'index.html';

// Chat state
let currentChatEmail     = null;
let currentChatName      = null;
let isBotChat            = false;
let messageInterval      = null;
let sessionInterval      = null;
let currentSession       = null;
let sessionTimerInterval = null;
let ratingData           = { rating: 0, tags: new Set() };
let pendingSessionCompletion = null;
let currentMode          = 'buddy';
let currentTopic         = '';

// ── Learning Memory System ────────────────────────────────────
const MEMORY_KEY      = `tandem_learning_memory_${userEmail}`;
const BOT_HISTORY_KEY = `tandem_bot_history_${userEmail}`;

function getMemory() {
    try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}'); } catch(e) { return {}; }
}
function saveMemory(mem) { localStorage.setItem(MEMORY_KEY, JSON.stringify(mem)); }

function recordStruggle(topic) {
    if (!topic) return;
    const mem = getMemory();
    if (!mem.weakTopics) mem.weakTopics = [];
    if (!mem.weakTopics.includes(topic)) { mem.weakTopics.unshift(topic); mem.weakTopics = mem.weakTopics.slice(0,10); saveMemory(mem); }
}
function recordMastery(topic) {
    if (!topic) return;
    const mem = getMemory();
    if (!mem.masteredTopics) mem.masteredTopics = [];
    if (!mem.masteredTopics.includes(topic)) { mem.masteredTopics.unshift(topic); mem.masteredTopics = mem.masteredTopics.slice(0,10); }
    if (mem.weakTopics) mem.weakTopics = mem.weakTopics.filter(t => t !== topic);
    saveMemory(mem);
}
function incrementConfusion() {
    const mem = getMemory(); mem.confusionCount = (mem.confusionCount||0)+1; mem.lastConfusion = Date.now(); saveMemory(mem); return mem.confusionCount;
}
function resetConfusion() { const mem = getMemory(); mem.confusionCount = 0; saveMemory(mem); }
function getConfusionCount() { return getMemory().confusionCount || 0; }

// ── Mode Detector ─────────────────────────────────────────────
function detectMode(msg, history = []) {
    const m = msg.toLowerCase().trim();

    // Support — frustration signals
    if (/i (don'?t|cant|can't|give up|hate|am lost|feel lost|so confused|so hard|too hard|impossible|stupid|dumb|useless|hopeless)/.test(m) ||
        /this (sucks|is hard|doesn'?t make sense|makes no sense)/.test(m) ||
        /^(ugh|argh|ano ba|grabe|ayaw ko|pagod na|stress)/.test(m)) return 'support';

    // Quiz
    if (/quiz|test me|examine|practice (question|problem)|give me (a )?question|exam prep|flashcard/.test(m)) return 'quiz';

    // Planner
    if (/study plan|schedule|roadmap|how (do i|should i) study|when (should|do) i|plan for|prepare for|review for|before (the )?exam/.test(m)) return 'planner';

    // Buddy — casual
    if (/^(hi|hello|hey|sup|yo|hoy|oi|kumusta|kamusta|musta|good (morning|afternoon|evening)|magandang|bye|goodbye|salamat|thanks|thank you|ingat|sige|done|ok na|how are you|kamusta ka)/.test(m)) return 'buddy';

    return 'tutor';
}

function detectConfusion(msg) {
    const m = msg.toLowerCase();
    return /i (don'?t|still don'?t|still can'?t) (get|understand|follow)|what\?|huh\?|confused|nalilito|hindi ko gets|ano ulit|can you (explain|say) (again|differently|simpler)|i'?m lost|not (getting|understanding)|ano ibig sabihin/.test(m);
}
function detectUnderstanding(msg) {
    const m = msg.toLowerCase();
    return /(i (get|understand|see) (it|now|na)|makes sense|gets na|ah (i see|ok|gets)|now i (get|understand)|clear na|so basically|so ganon pala|oh so)/.test(m);
}

// ── Bot history ───────────────────────────────────────────────
let botHistory = [];
try { botHistory = JSON.parse(localStorage.getItem(BOT_HISTORY_KEY) || '[]'); } catch(e) { botHistory = []; }
function saveBotHistory() { localStorage.setItem(BOT_HISTORY_KEY, JSON.stringify(botHistory.slice(-40))); }

// Rating data
const POS_TAGS    = ['Clear explanation','Patient','Knowledgeable','Engaging','Helpful','Punctual','Improved my skills'];
const NEG_TAGS    = ['Hard to follow','Often late','Ended early','Unprepared'];
const STAR_LABELS = ['','Needs work','Below average','Average','Good','Excellent'];

// ── Generic fetch helper ──────────────────────────────────────
async function post(path, body) {
    const r = await fetch(`${API}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    return r.json();
}

async function checkUnratedSession(tutorEmail) {
    try {
        const r = await fetch(`${API}/get-unrated-session`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ learnerEmail: userEmail, tutorEmail }) });
        const d = await r.json(); return d.session || null;
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
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i data-lucide="users" style="width:28px;height:28px;stroke:#cbd5e1;stroke-width:1.5;"></i></div><h4>No connections yet</h4><p>Go to Find Mentors!</p></div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    } catch(e) { document.getElementById('connectionsList').innerHTML = '<div class="empty-state">Error loading</div>'; }
}

async function checkUserSessionStatus(email) {
    try { const d = await post('/get-active-session', { email }); return d.session && d.session.status === 'active'; } catch(e) { return false; }
}
async function updateConnectionStatuses() {
    for (const conn of document.querySelectorAll('.connection-item')) {
        const email = conn.id?.replace('connItem_', ''); if (!email) continue;
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

// ── Exit chat ─────────────────────────────────────────────────
function exitChat() {
    currentChatEmail = null; currentChatName = null; isBotChat = false;
    if (messageInterval) { clearInterval(messageInterval); messageInterval = null; }
    if (sessionInterval) { clearInterval(sessionInterval); sessionInterval = null; }
    document.querySelectorAll('.connection-item').forEach(i => i.classList.remove('active'));
    document.getElementById('botChatItem')?.classList.remove('active');
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
        <div class="no-connection">
            <div class="no-connection-icon"><i data-lucide="message-circle" style="width:40px;height:40px;stroke:#cbd5e1;stroke-width:1.5;"></i></div>
            <h4>No conversation selected</h4>
            <p>Pick a chat or talk to Tandem AI</p>
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (window.innerWidth <= 600) mobileBackToList();
}

// ── Select human chat ─────────────────────────────────────────
async function selectChat(chatEmail, chatName) {
    isBotChat = false; currentChatEmail = chatEmail; currentChatName = chatName;
    document.querySelectorAll('.connection-item').forEach(i => i.classList.remove('active'));
    document.getElementById('botChatItem')?.classList.remove('active');
    document.getElementById(`connItem_${chatEmail}`)?.classList.add('active');
    mobileSwitchToChat();
    await loadMessages(chatEmail, chatName); await loadActiveSession();
    if (messageInterval) clearInterval(messageInterval);
    messageInterval = setInterval(() => loadMessages(chatEmail, chatName, true), 3000);
    if (sessionInterval) clearInterval(sessionInterval);
    sessionInterval = setInterval(() => loadActiveSession(), 5000);
}

// ── AI Bot chat ───────────────────────────────────────────────
function selectBotChat() {
    isBotChat = true; currentChatEmail = BOT_EMAIL; currentChatName = 'Tandem Study AI';
    if (messageInterval) clearInterval(messageInterval);
    if (sessionInterval) clearInterval(sessionInterval);
    document.querySelectorAll('.connection-item').forEach(i => i.classList.remove('active'));
    document.getElementById('botChatItem')?.classList.add('active');
    mobileSwitchToChat(); renderBotChat();
}

// ── SVG icons ─────────────────────────────────────────────────
const BOT_ICON_LG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="12" y1="16" x2="12" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>`;
const BOT_ICON_SM = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>`;

const MODE_LABELS = {
    tutor:   '📖 Tutor mode',
    quiz:    '🧠 Quiz mode',
    planner: '📅 Planner mode',
    buddy:   '💬 Study companion',
    support: '❤️ Here for you',
};

// ── Inject suggestion bar styles once ────────────────────────
function injectSuggestionStyles() {
    if (document.getElementById('botSuggestionsStyle')) return;
    const s = document.createElement('style');
    s.id = 'botSuggestionsStyle';
    s.textContent = `
        #botSuggestionsBar {
            display: none;
            flex-wrap: wrap;
            gap: 8px;
            padding: 10px 16px 10px;
            justify-content: center;
            align-items: center;
            flex-shrink: 0;
            background: #f8fbff;
            border-top: 1px solid #eaeff5;
        }
        #botSuggestionsBar.visible { display: flex; }
        .bot-chip {
            background: #fff;
            border: 1.5px solid #29b6d8;
            color: #1a8fad;
            border-radius: 20px;
            padding: 6px 15px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.15s ease;
            white-space: nowrap;
            line-height: 1.4;
            box-shadow: 0 1px 3px rgba(41,182,216,0.08);
        }
        .bot-chip:hover { background: #29b6d8; color: #fff; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(41,182,216,0.25); }
        .bot-chip:active { transform: translateY(0); }
        .bot-chip.chip-amber { border-color: #f59e0b; color: #92400e; }
        .bot-chip.chip-amber:hover { background: #f59e0b; color: #fff; box-shadow: 0 3px 8px rgba(245,158,11,0.25); }
        .bot-chip.chip-green { border-color: #4caf7d; color: #1e6641; }
        .bot-chip.chip-green:hover { background: #4caf7d; color: #fff; box-shadow: 0 3px 8px rgba(76,175,125,0.25); }
        .bot-chip.chip-purple { border-color: #7c6af7; color: #4c3abf; }
        .bot-chip.chip-purple:hover { background: #7c6af7; color: #fff; box-shadow: 0 3px 8px rgba(124,106,247,0.25); }
    `;
    document.head.appendChild(s);
}

function renderBotChat() {
    injectSuggestionStyles();
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
        <div class="chat-header">
            <div class="chat-header-avatar" style="background:linear-gradient(135deg,#29b6d8,#7c6af7);display:flex;align-items:center;justify-content:center;">
                ${BOT_ICON_LG}
            </div>
            <div class="chat-header-info">
                <div class="chat-header-name">Tandem Study AI</div>
                <div class="chat-header-status" id="botModeLabel" style="color:#4caf7d;">💬 Study companion</div>
            </div>
            <div class="chat-header-actions">
                <button class="exit-chat-btn" onclick="exitChat()">Exit chat</button>
            </div>
        </div>
        <div class="messages-area" id="messagesArea" style="background:#fafcff;"></div>
        <div id="botSuggestionsBar"></div>
        <div class="message-input-area">
            <input type="text" class="message-input" id="messageInput" placeholder="Ask me anything...">
            <button class="send-btn" id="sendMsgBtn">Send</button>
        </div>`;

    const area = document.getElementById('messagesArea');
    const userName = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'there';
    const mem = getMemory();

    if (!botHistory.length) {
        const weakNote = mem.weakTopics?.length
            ? `\n\nI also remember you've been working through **${mem.weakTopics[0]}** — we can pick that up anytime.`
            : '';
        const welcomeMsg = `Hey ${userName}! I'm your Tandem peer learning companion.\n\nI adapt to what you need:\n\n• **Tutor mode** — step-by-step explanations\n• **Quiz mode** — interactive knowledge testing\n• **Planner mode** — personalized study schedules\n• **Support mode** — when things get hard${weakNote}\n\nWhat are we working on today?`;
        appendBotMsg(area, welcomeMsg, [
            { text: 'Explain something to me', color: 'blue' },
            { text: 'Quiz me!', color: 'amber' },
            { text: 'Build me a study plan', color: 'purple' },
            { text: "I'm stuck and frustrated", color: 'green' },
        ]);
    } else {
        botHistory.forEach(m => {
            if (m.role === 'user') appendUserBotMsg(area, m.content);
            else appendBotMsg(area, m.content, []);
        });
    }
    area.scrollTop = area.scrollHeight;
    document.getElementById('sendMsgBtn').onclick = sendBotMessage;
    document.getElementById('messageInput').onkeypress = e => { if (e.key === 'Enter') sendBotMessage(); };
}

// ── Message rendering ─────────────────────────────────────────
function appendBotMsg(area, text, chips = []) {
    const el = document.createElement('div');
    el.className = 'bot-message-wrap';
    el.innerHTML = `
        <div class="bot-avatar-mini" style="background:linear-gradient(135deg,#29b6d8,#7c6af7);">${BOT_ICON_SM}</div>
        <div class="bot-message bot-bubble">${formatBotText(text)}</div>`;
    area.appendChild(el);
    if (chips && chips.length) renderChips(chips);
}

function appendUserBotMsg(area, text) {
    hideChips();
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:10px;';
    el.innerHTML = `<div class="bot-message bot-bubble-user">${esc(text)}</div>`;
    area.appendChild(el);
}

function renderChips(chips) {
    const bar = document.getElementById('botSuggestionsBar');
    if (!bar) return;
    bar.innerHTML = chips.map(c => {
        const text  = typeof c === 'string' ? c : c.text;
        const color = typeof c === 'object' ? (c.color || 'blue') : 'blue';
        const cls   = color === 'amber' ? 'chip-amber' : color === 'green' ? 'chip-green' : color === 'purple' ? 'chip-purple' : '';
        return `<button class="bot-chip ${cls}" onclick="useSuggestion('${esc(text)}')">${esc(text)}</button>`;
    }).join('');
    bar.classList.add('visible');
}

function hideChips() {
    const bar = document.getElementById('botSuggestionsBar');
    if (bar) { bar.classList.remove('visible'); bar.innerHTML = ''; }
}

function useSuggestion(text) {
    const inp = document.getElementById('messageInput');
    if (inp) { inp.value = text; inp.focus(); }
    hideChips(); sendBotMessage();
}

function updateModeLabel(mode) {
    const el = document.getElementById('botModeLabel');
    if (el) el.textContent = MODE_LABELS[mode] || '💬 Study companion';
}

function formatBotText(t) {
    return esc(t)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/• /g, '&bull;&nbsp;');
}

// ── Build layered system prompt ───────────────────────────────
function buildSystemPrompt(mode, userName, grade, growth, skills, credits, confusionCount, memory) {
    const base = `You are Tandem Study AI — a warm, brilliant peer learning companion on Tandem, a Filipino peer-to-peer learning platform. You think through things WITH the learner, not at them.

LEARNER PROFILE:
- Name: ${userName}
- Grade: ${grade || 'not specified'}
- Learning goals: ${growth.length ? growth.join(', ') : 'general academics'}
- Current skills: ${skills.length ? skills.join(', ') : 'various'}
- Credits: ${credits} (1 credit = 30 min with a real human mentor)
${memory.weakTopics?.length ? `- Previously struggled with: ${memory.weakTopics.slice(0,5).join(', ')}` : ''}
${memory.masteredTopics?.length ? `- Has shown mastery in: ${memory.masteredTopics.slice(0,5).join(', ')}` : ''}

RESPONSE QUALITY RULES — CRITICAL:
- NEVER give a one-liner. Every response must be at least 3-5 sentences minimum.
- When someone says "Explain something to me" or clicks a chip — ASK what topic they want help with AND give a warm, engaging opener. Never just say "Sure! What topic?" alone.
- When someone says "Quiz me!" — immediately pick a subject from their learning goals and ask a real question. Don't just say you'll quiz them.
- When someone says "Build me a study plan" — immediately ask 2 specific questions (deadline? hours per day?) in an engaging way, not just one bland sentence.
- When someone says "I'm stuck and frustrated" — give a warm 3-4 sentence emotional acknowledgment before anything else.
- When someone asks to explain a topic — actually START explaining it right away, step by step. Don't just ask what they know first every single time.
- Match response length to the request: casual greetings = 2-3 sentences, explanations = detailed paragraphs, quiz = full question with context.
- Use **bold** for key terms. Use bullet points for lists. Be visually organized.
- Speak like a smart, warm Filipino student peer — not a robot, not a textbook.

ALWAYS:
- Address ${userName} by name occasionally (not every message)
- Use Filipino-friendly relaxed English; occasional "oo", "ganon", "kaya mo yan" are fine
- Never make the learner feel bad for not knowing something
- Celebrate effort, not just correct answers

SUGGESTIONS — MANDATORY AT END OF EVERY RESPONSE:
Output exactly this on the last line (no extra whitespace inside):
[SUGGESTIONS:{"s":["chip 1","chip 2","chip 3"]}]
Max 3-4 chips. Each under 38 chars. Make them contextually relevant to what was just discussed — NOT generic.`;

    const modes = {
        tutor: `
MODE: TUTOR — Deep, guided understanding
- Ask what they already know before explaining
- Explain step by step; check in after each step: "Does that track?"
- Use Filipino examples: jeepney, palengke, sari-sari, piso, DepEd, CHED
- After explaining: "Can you say that back in your own words?"
- If wrong: "Almost — here's where it diverges..."
- Don't give the full answer immediately; guide them toward it
${confusionCount >= 2 ? `\nSIMPLIFY: User has expressed confusion ${confusionCount}x. Use simpler language, shorter sentences, more analogies. Start from basics. Don't assume prior knowledge.` : ''}
${confusionCount >= 4 ? `\nESCALATE: Gently suggest a mentor session: "You have ${credits} credits — that's ${Math.floor(Number(credits)*30)} minutes with a live mentor who can walk through this with you in real time."` : ''}`,

        quiz: `
MODE: QUIZ MASTER — Interactive, one question at a time
- Ask ONE question then wait for their answer
- After correct: celebrate briefly, increase difficulty slightly
- After wrong: "What made you think that?" — don't just give the answer
- Track difficulty: start easy, ramp based on performance
- End with a quick summary: what they know vs. need to review
- If they struggled on >half: suggest a mentor session`,

        planner: `
MODE: STUDY PLANNER — Structured, personalized schedule
- Ask: available time per day, upcoming deadlines, weakest subjects
- Structure by week (less overwhelming than day-by-day)
- Be specific: "Mon/Wed: 30 mins on [topic] using [method]"
- Include review days and rest — sustainable beats intense
- Mention Tandem mentor sessions where credits allow
- End with: "Want me to adjust anything?"`,

        buddy: `
MODE: STUDY BUDDY — Casual, warm, natural
- Match their energy — relaxed, friendly, genuine
- Greetings get warm natural responses (not robotic)
- Farewells: brief and warm
- Small talk: engage briefly then gently see if they want to learn
- Don't force academic content — let it emerge`,

        support: `
MODE: SUPPORT — Compassion first, learning second
- Acknowledge the feeling BEFORE anything: "That sounds really frustrating — I get it"
- Normalize: "A lot of people hit this wall, you're not alone"
- Reframe failure: "Getting it wrong just means you're finding what to fix"
- Keep it short and warm — don't overwhelm with content
- Suggest a break or mentor session if they're really stuck
- Be like a supportive ate/kuya, not a guidance counselor
- Only ease back into learning after they seem ready`,
    };

    return base + (modes[mode] || modes.tutor);
}

// ── SMART BOT MESSAGE SENDER ──────────────────────────────────
async function sendBotMessage() {
    const inp = document.getElementById('messageInput');
    const msg = inp?.value.trim();
    if (!msg) return;
    inp.value = '';
    hideChips();

    // Detect mode and update tracking
    currentMode = detectMode(msg, botHistory);
    updateModeLabel(currentMode);

    if (detectConfusion(msg)) {
        incrementConfusion();
        if (currentTopic) recordStruggle(currentTopic);
    } else if (detectUnderstanding(msg)) {
        resetConfusion();
        if (currentTopic) recordMastery(currentTopic);
    }

    if (inp) inp.disabled = true;
    const sendBtn = document.getElementById('sendMsgBtn');
    if (sendBtn) sendBtn.disabled = true;

    const area = document.getElementById('messagesArea');
    appendUserBotMsg(area, msg);
    botHistory.push({ role: 'user', content: msg });
    area.scrollTop = area.scrollHeight;

    // Thinking dots
    const thinking = document.createElement('div');
    thinking.className = 'bot-message-wrap'; thinking.id = 'botThinking';
    thinking.innerHTML = `
        <div class="bot-avatar-mini" style="background:linear-gradient(135deg,#29b6d8,#7c6af7);">${BOT_ICON_SM}</div>
        <div class="bot-thinking"><div class="bot-dot"></div><div class="bot-dot"></div><div class="bot-dot"></div></div>`;
    area.appendChild(thinking);
    area.scrollTop = area.scrollHeight;

    // User context
    const userName  = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'there';
    const credits   = localStorage.getItem('tandem_credits') || '0';
    const growth    = (() => { try { return JSON.parse(localStorage.getItem('tandem_growth') || '[]'); } catch(e) { return []; } })();
    const skills    = (() => { try { return JSON.parse(localStorage.getItem('tandem_skills') || '[]'); } catch(e) { return []; } })();
    const grade     = localStorage.getItem('tandem_grade') || '';
    const memory    = getMemory();
    const confusion = getConfusionCount();

    const systemPrompt = buildSystemPrompt(currentMode, userName, grade, growth, skills, credits, confusion, memory);
    const messages = botHistory.slice(-30).map(m => ({ role: m.role, content: m.content }));

    let reply = null;
    let chips = [];

    try {
        const response = await fetch(`${API}/ai-chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, systemPrompt, userEmail })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.success && data.reply) {
            reply = data.reply;

            // Extract topic from first bolded term
            const topicMatch = reply.match(/\*\*([^*]{3,30})\*\*/);
            if (topicMatch) currentTopic = topicMatch[1];

            // Parse suggestion chips
            const suggMatch = reply.match(/\[SUGGESTIONS:\{"s":\[(.+?)\]\}\]/s);
            if (suggMatch) {
                try { chips = JSON.parse(`[${suggMatch[1]}]`); } catch(e) { chips = []; }
                reply = reply.replace(/\[SUGGESTIONS:\{"s":\[.+?\]\}\]/gs, '').trim();
            }
        }
    } catch(e) { console.error('Bot fetch error:', e); reply = null; }

    document.getElementById('botThinking')?.remove();
    if (inp) inp.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    inp?.focus();

    if (!reply) {
        const fb = getFallback(msg, currentMode, growth, userName, credits, memory);
        reply = fb.text; chips = fb.chips;
    }

    // Smart escalation injection when confused for too long
    if (confusion >= 4 && currentTopic && !reply.includes('mentor')) {
        reply += `\n\nBy the way — you have **${credits} credit(s)** on Tandem. That's up to ${Math.floor(Number(credits)*30)} minutes with a real human mentor who can walk through this live with you. Sometimes that 1-on-1 is all it takes.`;
        chips = ['Book a mentor session', 'Try explaining it differently', 'Start from scratch', 'Move to a new topic'].map(t => ({ text: t, color: t.includes('mentor') ? 'amber' : 'blue' }));
    }

    botHistory.push({ role: 'assistant', content: reply });
    saveBotHistory();
    appendBotMsg(area, reply, chips.map(c => typeof c === 'string' ? { text: c, color: 'blue' } : c));
    area.scrollTop = area.scrollHeight;
}

// ── Mode-aware fallback ───────────────────────────────────────
function getFallback(msg, mode, growth, userName, credits, memory) {
    const m = msg.toLowerCase().trim();
    const subj = growth[0] || 'Math';
    const subj2 = growth[1] || 'Science';

    if (/^(bye|goodbye|salamat|thanks|thank you|ingat|sige na|ok na|done)/.test(m)) {
        return {
            text: `Take care, ${userName}! The effort you put in today counts — every session, every question, every "I get it now" moment adds up.\n\nCome back whenever you want to dig deeper. Ingat ka! 💙`,
            chips: [{ text: 'One last question', color: 'blue' }, { text: 'Quiz me before I go!', color: 'amber' }]
        };
    }
    if (/^(hi|hello|hey|sup|yo|hoy|kumusta|kamusta|musta|good|magandang|how are you)/.test(m)) {
        const note = memory.weakTopics?.length
            ? `\n\nAnd hey — last time we were working through **${memory.weakTopics[0]}**. Want to pick that back up, or try something new?`
            : `\n\nWhat are we tackling today? I can explain a topic step by step, quiz you, build a study plan, or just be here if things feel overwhelming.`;
        return {
            text: `Hey ${userName}! Good to see you. 👋 I'm your Tandem study companion — I learn alongside you, not at you.${note}`,
            chips: [{ text: `Explain ${subj} to me`, color: 'blue' }, { text: 'Quiz me!', color: 'amber' }, { text: 'Make me a study plan', color: 'purple' }, { text: "I'm stressed about school", color: 'green' }]
        };
    }
    if (/explain something|explain a topic|teach me/i.test(m)) {
        return {
            text: `I'd love to! What topic do you want to dig into, ${userName}?\n\nI can break down anything from **${subj}** to **${subj2}** — or something completely different. Just name it and I'll start from wherever you are right now.\n\nAlso quick question: are you starting fresh on this topic, or do you already have some background and just need a clearer explanation?`,
            chips: [{ text: `Explain ${subj}`, color: 'blue' }, { text: `Explain ${subj2}`, color: 'blue' }, { text: 'Something from my goals', color: 'purple' }, { text: 'Surprise me!', color: 'amber' }]
        };
    }
    if (/quiz me/i.test(m)) {
        return {
            text: `Let's go! 🧠 I'll quiz you on **${subj}** — one question at a time so we can really track what you know.\n\nHere's your first question:\n\n**${subj === 'Math' ? 'If a jeepney travels 60 km/h for 2.5 hours, how far does it go?' : `What is the first thing you think of when you hear the word "${subj}"? Explain it in your own words.`}**\n\nTake your time — there's no rush. I'll give you feedback after you answer!`,
            chips: [{ text: 'Easy mode please', color: 'green' }, { text: 'I know this one!', color: 'blue' }, { text: `Quiz me on ${subj2} instead`, color: 'amber' }]
        };
    }
    if (/study plan|schedule/i.test(m)) {
        return {
            text: `Smart move, ${userName} — having a study plan makes everything less overwhelming. Let me build you a personalized one!\n\nI just need two things:\n\n**1.** Do you have a specific deadline? (an exam, a project, a quiz?)\n**2.** Realistically, how many hours can you study per day?\n\nOnce I know that, I'll map out a week-by-week plan that's actually doable — not one of those impossible 8-hours-a-day schedules. 😄`,
            chips: [{ text: 'Exam in 3 days', color: 'amber' }, { text: 'Exam next week', color: 'blue' }, { text: 'No deadline, general prep', color: 'purple' }, { text: 'Only 1 hour a day', color: 'green' }]
        };
    }
    if (mode === 'support' || /stuck|frustrated|stressed|overwhelmed|give up|ayaw ko|pagod/i.test(m)) {
        return {
            text: `Hey ${userName} — I hear you. 💙 What you're feeling right now is completely normal. Learning is genuinely hard sometimes, and hitting a wall doesn't mean you're bad at this — it means you're pushing yourself.\n\nTake a breath. Seriously.\n\nLet's slow down and figure out what specifically feels confusing. Sometimes it's just one concept blocking everything else, and once we clear that, everything clicks.\n\n**What's the thing that's giving you the most trouble right now?**`,
            chips: [{ text: 'Start from the very basics', color: 'blue' }, { text: 'Explain it differently', color: 'blue' }, { text: 'I want to try again', color: 'green' }, { text: 'Book a real mentor instead', color: 'amber' }]
        };
    }
    return {
        text: `I'm here, ${userName}! 💙 Looks like there was a small hiccup on my end, but I'm ready to help.\n\nWhat would you like to work on? I can:\n\n• **Explain** any topic step by step\n• **Quiz** you to test your knowledge\n• **Build** a personalized study plan\n• **Support** you if things feel hard\n\nJust tell me what you need!`,
        chips: [{ text: `Explain ${subj}`, color: 'blue' }, { text: 'Quiz me!', color: 'amber' }, { text: `Help with ${subj2}`, color: 'purple' }, { text: 'I need support', color: 'green' }]
    };
}

// ── Active session management ─────────────────────────────────
async function loadActiveSession() {
    if (isBotChat) return;
    try {
        const data = await post('/get-active-session', { email: userEmail });
        if (data.success && data.session) {
            currentSession = data.session;
            const isLearner = data.session.user_role === 'learner';
            if (data.session.status === 'pending' && !isLearner) showSessionRequestUI(data.session);
            else if (data.session.status === 'active') showActiveSessionUI(data.session);
            else hideSessionUI();
        } else { currentSession = null; hideSessionUI(); }
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
            ${isOnline ? `<a href="${vcUrl}" target="_blank" class="session-btn-accept" style="text-decoration:none;text-align:center;display:block;" id="joinCallBtn">Join Video Call</a>` : `<p style="font-size:12px;color:#888;text-align:center;">Meet at the agreed location</p>`}
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
        const rem = end - Date.now(); const el = document.getElementById('sessionTimerDisplay'); if (!el) return;
        if (rem <= 0) { clearInterval(sessionTimerInterval); el.textContent = '00:00'; return; }
        el.textContent = `${String(Math.floor(rem/60000)).padStart(2,'0')}:${String(Math.floor((rem%60000)/1000)).padStart(2,'0')}`;
    }
    tick(); sessionTimerInterval = setInterval(tick, 1000);
}

function hideSessionUI() {
    const m = document.getElementById('sessionModal'); if (m) m.style.display = 'none';
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
}

// ── Rating modal ──────────────────────────────────────────────
function initRatingTags() {
    const pos = document.getElementById('posTags'); const neg = document.getElementById('negTags');
    if (pos) pos.innerHTML = POS_TAGS.map(t => `<span class="feedback-tag" onclick="toggleTag(this,'${t}')">${t}</span>`).join('');
    if (neg) neg.innerHTML = NEG_TAGS.map(t => `<span class="feedback-tag" onclick="toggleTag(this,'${t}')">${t}</span>`).join('');
}
window.toggleTag = (el, val) => { el.classList.toggle('selected'); if (el.classList.contains('selected')) ratingData.tags.add(val); else ratingData.tags.delete(val); };

function triggerRatingModal(sessionId, peerName, subject, elapsedSecs) {
    const sid   = sessionId || currentSession?.id;
    const sName = peerName || (currentSession?.user_role==='learner' ? (currentSession?.tutor_name||currentSession?.tutor_username) : (currentSession?.learner_name||currentSession?.learner_username)) || 'your mentor';
    const subj  = subject || currentSession?.subject || 'Session';
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
            const v = parseInt(btn.dataset.v); ratingData.rating = v;
            document.querySelectorAll('.star-btn').forEach((b,i) => b.classList.toggle('lit', i < v));
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
        const d = await post('/complete-session', { sessionId, rating, feedback, elapsedSeconds: elapsedSeconds||0, feedbackTags: feedbackTags||[] });
        if (d.success) {
            showToast('Session completed!');
            if (typeof window.syncCredits === 'function') window.syncCredits();
            await loadActiveSession(); hideSessionUI();
            if (currentChatEmail && !isBotChat) await loadMessages(currentChatEmail, currentChatName);
        } else showToast(d.message || 'Error completing session');
    } catch(e) { showToast('Error completing session'); }
}

let f2fSessionId = null;
window.showF2fStartOverlay = function(sid) { f2fSessionId = sid; document.getElementById('f2fStartOverlay').style.display = 'flex'; };
window.confirmF2fStart = async function() {
    document.getElementById('f2fStartOverlay').style.display = 'none'; if (!f2fSessionId) return;
    try { const d = await post('/learner-confirm-f2f', { sessionId: f2fSessionId, learnerEmail: userEmail }); if (d.success) { showToast('Timer started!'); await loadActiveSession(); } else showToast(d.message||'Error'); } catch(e) { showToast('Error'); }
};
window.declineF2fStart = function() { document.getElementById('f2fStartOverlay').style.display = 'none'; showToast('Let your mentor know when you are ready.'); };

// ── Session request modal ─────────────────────────────────────
async function showSessionRequestModal(tutorEmail, tutorName) {
    const unrated = await checkUnratedSession(tutorEmail);
    if (unrated) { showToast('Please rate your last session first.'); triggerRatingModal(unrated.id, tutorName, unrated.subject, unrated.elapsed_seconds||0); return; }
    let subjects = [];
    try { const d = await post('/get-requestable-subjects', { learnerEmail: userEmail, tutorEmail }); subjects = d.subjects||[]; } catch(e) {}
    const subjectOptions = subjects.length ? subjects.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('') : '<option value="">No subjects available</option>';
    const minDT = new Date().toISOString().slice(0,16);
    document.getElementById('sessionRequestModal').style.display = 'flex';
    document.getElementById('sessionRequestModal').querySelector('.session-modal-content').innerHTML = `
        <div class="session-modal-header"><h3>Request a Session</h3><button class="session-modal-close" onclick="closeSessionRequestModal()">&times;</button></div>
        <div class="session-modal-body" style="padding:16px;display:flex;flex-direction:column;gap:10px;">
            <p style="font-size:13px;color:#555;margin:0;">with <strong>${esc(tutorName)}</strong></p>
            <div><label style="font-size:12px;font-weight:600;color:#333;display:block;margin-bottom:5px;">Subject *</label>
                <select id="sessSubjectSelect" class="session-input" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;"><option value="">Select a subject...</option>${subjectOptions}</select></div>
            <div><label style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px;display:block;">Session Type *</label>
                <div style="display:flex;gap:7px;">
                    <label id="typeCardSolo" style="flex:1;border:2px solid #29b6d8;border-radius:9px;padding:9px;cursor:pointer;text-align:center;"><input type="radio" name="sessType" value="solo" style="display:none;" checked><div style="font-size:16px;">&#x1F464;</div><div style="font-size:11px;font-weight:600;color:#333;">One-on-One</div></label>
                    <label id="typeCardGroup" style="flex:1;border:2px solid #ddd;border-radius:9px;padding:9px;cursor:pointer;text-align:center;"><input type="radio" name="sessType" value="group" style="display:none;"><div style="font-size:16px;">&#x1F465;</div><div style="font-size:11px;font-weight:600;color:#333;">Group</div></label>
                </div></div>
            <div><label style="font-size:12px;font-weight:600;color:#333;margin-bottom:6px;display:block;">Mode *</label>
                <div style="display:flex;gap:7px;">
                    <label id="modeCardOnline" style="flex:1;border:2px solid #29b6d8;border-radius:9px;padding:9px;cursor:pointer;text-align:center;"><input type="radio" name="sessMode" value="online" style="display:none;" checked><div style="font-size:16px;">&#x1F4BB;</div><div style="font-size:11px;font-weight:600;color:#333;">Online</div></label>
                    <label id="modeCardFace" style="flex:1;border:2px solid #ddd;border-radius:9px;padding:9px;cursor:pointer;text-align:center;"><input type="radio" name="sessMode" value="face_to_face" style="display:none;"><div style="font-size:16px;">&#x1F3EB;</div><div style="font-size:11px;font-weight:600;color:#333;">Face-to-Face</div></label>
                </div></div>
            <div><label style="font-size:12px;font-weight:600;color:#333;display:block;margin-bottom:5px;">Preferred Date &amp; Time *</label>
                <input type="datetime-local" id="sessDateTime" min="${minDT}" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;"></div>
            <div><label style="font-size:12px;font-weight:600;color:#333;display:block;margin-bottom:5px;">Notes (optional)</label>
                <textarea id="sessNotes" rows="2" placeholder="Your level, what to focus on..." style="width:100%;padding:9px;border:1px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;"></textarea></div>
            <div style="background:#fef9c3;border:1px solid #f5a623;border-radius:7px;padding:8px;font-size:12px;color:#854d0e;">1 credit will be deducted when the mentor starts the session.</div>
            <div style="display:flex;gap:8px;">
                <button class="session-btn-send" style="flex:2;" onclick="submitSessionRequest('${esc(tutorEmail)}','${esc(tutorName)}')">Send Request</button>
                <button class="session-btn-cancel" style="flex:1;" onclick="closeSessionRequestModal()">Cancel</button>
            </div>
        </div>`;
    ['typeCardSolo','typeCardGroup'].forEach(id => { document.getElementById(id)?.addEventListener('click', () => { ['typeCardSolo','typeCardGroup'].forEach(x=>document.getElementById(x).style.borderColor='#ddd'); document.getElementById(id).style.borderColor='#29b6d8'; document.getElementById(id).querySelector('input').checked=true; }); });
    ['modeCardOnline','modeCardFace'].forEach(id => { document.getElementById(id)?.addEventListener('click', () => { ['modeCardOnline','modeCardFace'].forEach(x=>document.getElementById(x).style.borderColor='#ddd'); document.getElementById(id).style.borderColor='#29b6d8'; document.getElementById(id).querySelector('input').checked=true; }); });
}

async function submitSessionRequest(tutorEmail, tutorName) {
    const subject=document.getElementById('sessSubjectSelect')?.value, typeRadio=document.querySelector('input[name="sessType"]:checked'), modeRadio=document.querySelector('input[name="sessMode"]:checked'), dtInput=document.getElementById('sessDateTime')?.value, notes=document.getElementById('sessNotes')?.value||'';
    if (!subject) { showToast('Select a subject.'); return; }
    if (!dtInput) { showToast('Choose a date and time.'); return; }
    if (Math.round(Number(localStorage.getItem('tandem_credits')||'5')) < 1) { showToast('Not enough credits!'); return; }
    const d = await post('/send-session-request', { learnerEmail:userEmail, tutorEmail, subject, sessionNotes:notes, sessionType:typeRadio?.value||'solo', sessionMode:modeRadio?.value||'online', preferredTime:dtInput });
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
function formatMessageTime(ds) { return new Date(ds).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:true}); }
function formatMessageDate(ds) {
    const d=new Date(ds),t=new Date(); t.setHours(0,0,0,0); const y=new Date(t); y.setDate(y.getDate()-1); const md=new Date(d); md.setHours(0,0,0,0);
    if (md.getTime()===t.getTime()) return 'Today'; if (md.getTime()===y.getTime()) return 'Yesterday';
    return d.toLocaleDateString([],{month:'short',day:'numeric'});
}
function groupMessagesByDate(msgs) { return msgs.reduce((g,m)=>{const k=new Date(m.created_at).toDateString();(g[k]=g[k]||[]).push(m);return g;},{}); }

async function loadMessages(chatEmail, chatName, isPolling = false) {
    if (isBotChat) return;
    try {
        const data = await post('/get-messages', { user1Email: userEmail, user2Email: chatEmail });
        const chatArea = document.getElementById('chatArea');
        const otherInSess = await checkUserSessionStatus(chatEmail);
        if (!isPolling) {
            const connItem = document.getElementById(`connItem_${chatEmail}`); let pic = '';
            if (connItem) { const img = connItem.querySelector('.connection-avatar img'); if (img) pic = img.src; }
            const myS = currentSession;
            const sharedActive = myS && myS.status==='active' && ((myS.learner_email===userEmail&&myS.tutor_email===chatEmail)||(myS.tutor_email===userEmail&&myS.learner_email===chatEmail));
            const myName = localStorage.getItem('tandem_username')||localStorage.getItem('userName')||userEmail;
            const vcParams = sharedActive ? new URLSearchParams({email:userEmail,peer:chatEmail,session:myS.id,subject:myS.subject||'Session',name:myName,role:myS.user_role||'learner'}) : null;
            const vcBtn = (sharedActive && myS?.session_mode!=='face_to_face') ? `<a href="video-call.html?${vcParams}" target="_blank" class="video-call-btn">Video Call</a>` : '';
            chatArea.innerHTML = `
                <div class="chat-header">
                    <div class="chat-header-avatar">${pic?`<img src="${pic}" alt="">`: `<div style="font-size:16px;font-weight:700;color:#29b6d8;">${chatName.charAt(0).toUpperCase()}</div>`}</div>
                    <div class="chat-header-info"><div class="chat-header-name">${esc(chatName)}</div><div class="chat-header-status">${otherInSess?'<span style="color:#e05555;">In a session</span>':'Connected'}</div></div>
                    <div class="chat-header-actions">${vcBtn}<button class="session-request-btn" id="sessReqBtn" ${otherInSess?'disabled style="opacity:0.5;"':''}>Request Session</button><button class="exit-chat-btn" onclick="exitChat()">Exit</button></div>
                </div>
                <div class="messages-area" id="messagesArea"></div>
                <div class="message-input-area">
                    <input type="text" class="message-input" id="messageInput" placeholder="Type a message..." ${otherInSess?'disabled':''}>
                    <button class="send-btn" id="sendMsgBtn" ${otherInSess?'disabled':''}>Send</button>
                </div>`;
            const sessBtn=document.getElementById('sessReqBtn'); if(sessBtn&&!otherInSess) sessBtn.onclick=()=>showSessionRequestModal(chatEmail,chatName);
            const sendBtn=document.getElementById('sendMsgBtn'); if(sendBtn&&!otherInSess) sendBtn.onclick=sendHumanMessage;
            const inp=document.getElementById('messageInput'); if(inp&&!otherInSess) inp.onkeypress=e=>{if(e.key==='Enter')sendHumanMessage();};
        }
        const area = document.getElementById('messagesArea');
        if (area) {
            if (data.messages?.length) {
                const grouped = groupMessagesByDate(data.messages); let html = '';
                for (const [,msgs] of Object.entries(grouped)) {
                    html += `<div class="message-date-separator"><span>${formatMessageDate(msgs[0].created_at)}</span></div>`;
                    msgs.forEach(m => {
                        const isMe = m.sender_email === userEmail;
                        if (isMe) {
                            html += `<div class="message message-sent"><div class="message-text">${esc(m.message)}</div><div class="message-time">${formatMessageTime(m.created_at)}</div></div>`;
                        } else {
                            const connItem = document.getElementById(`connItem_${m.sender_email}`);
                            const img = connItem?.querySelector('.connection-avatar img');
                            const initial = (chatName || 'U').charAt(0).toUpperCase();
                            const avatarHtml = img
                                ? `<img src="${img.src}" alt="" style="width:100%;height:100%;object-fit:cover;">`
                                : `<div style="font-size:13px;font-weight:700;color:#29b6d8;">${initial}</div>`;
                            html += `
                                <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;">
                                    <div style="width:28px;height:28px;border-radius:50%;background:#dbeafe;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                                        ${avatarHtml}
                                    </div>
                                    <div class="message message-received" style="margin-bottom:0;">
                                        <div class="message-text">${esc(m.message)}</div>
                                        <div class="message-time">${formatMessageTime(m.created_at)}</div>
                                    </div>
                                </div>`;
                        }
                    });
                }
                area.innerHTML = html; area.scrollTop = area.scrollHeight;
            } else {
                area.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&#x1F4AC;</div><h4>No messages yet</h4><p>Say hello!</p></div>`;
            }
        }
    } catch(e) { console.error(e); }
}

async function sendHumanMessage() {
    const inp = document.getElementById('messageInput'); const msg = inp?.value.trim();
    if (!msg||!currentChatEmail) return;
    if (await checkUserSessionStatus(currentChatEmail)) { showToast('User is in a session.'); return; }
    await post('/send-message', { senderEmail: userEmail, receiverEmail: currentChatEmail, message: msg });
    if (inp) inp.value = ''; await loadMessages(currentChatEmail, currentChatName);
}

// ── Utilities ─────────────────────────────────────────────────
function esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('toast-show'); setTimeout(()=>t.classList.remove('toast-show'),3500); }

// ── Expose globals ────────────────────────────────────────────
window.selectChat                      = selectChat;
window.selectBotChat                   = selectBotChat;
window.exitChat                        = exitChat;
window.sendHumanMessage                = sendHumanMessage;
window.useSuggestion                   = useSuggestion;
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

// ── Socket.io ─────────────────────────────────────────────────
if (typeof io !== 'undefined') {
    const socket = io(API);
    socket.on('connect', () => socket.emit('register-user', { email: userEmail }));
    socket.on('f2f-session-started', ({ sessionId }) => {
        if (currentSession?.id===sessionId && currentSession?.user_role==='learner') window.showF2fStartOverlay(sessionId);
    });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadConnections();
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        [messageInterval,sessionInterval,sessionTimerInterval].forEach(i=>clearInterval(i));
        localStorage.clear(); window.location.href = 'index.html';
    });
    loadActiveSession();

    const autoOpen = sessionStorage.getItem('openChatWith');
    if (autoOpen) {
        sessionStorage.removeItem('openChatWith');
        setTimeout(async () => {
            if (autoOpen===BOT_EMAIL) { selectBotChat(); return; }
            try { const data=await post('/get-connections',{email:userEmail}); const conn=(data.connections||[]).find(c=>c.connected_email===autoOpen); if(conn) selectChat(conn.connected_email,conn.connected_username||conn.connected_name); } catch(e) {}
        }, 900);
    }

    const showRating = sessionStorage.getItem('showRatingOnLoad');
    if (showRating==='1') {
        sessionStorage.removeItem('showRatingOnLoad');
        const elapsed=parseInt(sessionStorage.getItem('lastSessionElapsed')||'0'), sid=sessionStorage.getItem('lastSessionId')||'';
        setTimeout(()=>{ if(sid) triggerRatingModal(sid,'','',elapsed); }, 800);
    }

    setInterval(()=>{ loadConnections(); updateConnectionStatuses(); }, 30000);
    
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
});