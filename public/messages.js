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
let pendingSessionCompletion = null;

// Bot conversation history
const BOT_HISTORY_KEY = `tandem_bot_history_${userEmail}`;
let botHistory = [];
try { botHistory = JSON.parse(localStorage.getItem(BOT_HISTORY_KEY) || '[]'); } catch(e) { botHistory = []; }

function saveBotHistory() {
    const toSave = botHistory.slice(-40);
    localStorage.setItem(BOT_HISTORY_KEY, JSON.stringify(toSave));
}

// Rating tags
const POS_TAGS = ['Clear explanation','Patient','Knowledgeable','Engaging','Helpful','Punctual','Improved my skills'];
const NEG_TAGS = ['Hard to follow','Often late','Ended early','Unprepared'];
const STAR_LABELS = ['','Needs work','Below average','Average','Good','Excellent'];

// ── Generic fetch helper ──────────────────────────────────────

async function post(path, body) {
    const r = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return r.json();
}

// ── Check unrated session ─────────────────────────────────────

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

// ── Exit chat ─────────────────────────────────────────────────

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

// ── Select human chat ─────────────────────────────────────────

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
            <input type="text" class="message-input" id="messageInput" placeholder="Ask me anything — subjects, study tips, quizzes...">
            <button class="send-btn" id="sendMsgBtn">Send</button>
        </div>`;

    const area = document.getElementById('messagesArea');
    const userName = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'there';

    if (!botHistory.length) {
        const welcomeMsg = `Hi ${userName}! 👋 I am your **Tandem Study AI**!\n\nI can help you with a lot of things. Just tell me what you need:\n\n• **Any subject** — Math, Science, English, Programming, Networking, and more\n• **Study strategies** — tips to learn faster and retain more\n• **Practice questions** — ask me to quiz you on anything\n• **Learning roadmaps** — what to study next based on your goals\n• **Tandem platform** — how credits, sessions, and quests work\n\nWhat would you like to explore today?`;
        appendBotMsg(area, welcomeMsg);
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
        .replace(/• /g, '&bull; ');
}

// ── SMART BOT MESSAGE SENDER ──────────────────────────────────

async function sendBotMessage() {
    const inp = document.getElementById('messageInput');
    const msg = inp?.value.trim();
    if (!msg) return;
    inp.value = '';

    // Disable while waiting
    if (inp) inp.disabled = true;
    const sendBtn = document.getElementById('sendMsgBtn');
    if (sendBtn) sendBtn.disabled = true;

    const area = document.getElementById('messagesArea');
    appendUserBotMsg(area, msg);
    botHistory.push({ role: 'user', content: msg });
    area.scrollTop = area.scrollHeight;

    // Show thinking animation
    const thinking = document.createElement('div');
    thinking.className = 'bot-message-wrap';
    thinking.id = 'botThinking';
    thinking.innerHTML = `
        <div class="bot-avatar-mini">&#x1F916;</div>
        <div class="bot-thinking">
            <div class="bot-dot"></div>
            <div class="bot-dot"></div>
            <div class="bot-dot"></div>
        </div>`;
    area.appendChild(thinking);
    area.scrollTop = area.scrollHeight;

    // Get user data from localStorage
    const userName   = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'there';
    const credits    = localStorage.getItem('tandem_credits') || '0';
    const userGrowth = (() => { try { return JSON.parse(localStorage.getItem('tandem_growth') || '[]'); } catch(e) { return []; } })();
    const userSkills = (() => { try { return JSON.parse(localStorage.getItem('tandem_skills') || '[]'); } catch(e) { return []; } })();
    const grade      = localStorage.getItem('tandem_grade') || '';

    // Build smart system prompt
    const systemPrompt = `You are Tandem Study AI — a smart, friendly, and knowledgeable academic tutor built into Tandem, a peer-to-peer learning platform for Filipino students.

STUDENT PROFILE:
- Name: ${userName}
- Grade level: ${grade || 'not specified'}
- Learning goals (wants to learn): ${userGrowth.length ? userGrowth.join(', ') : 'general academics'}
- Current skills (already knows): ${userSkills.length ? userSkills.join(', ') : 'various subjects'}
- Credits remaining: ${credits}

PLATFORM KNOWLEDGE:
- 1 credit = 30 minutes of mentor session time
- New users start with 5 credits
- Learners spend credits to book mentor sessions
- Mentors earn credits by teaching others
- Sessions are rated with stars after completion
- Quests give bonus credits for achieving milestones
- To find a human mentor, go to the Find Mentors section

YOUR PERSONALITY:
- Friendly and encouraging like a kuya or ate (older sibling) tutor
- Always address the student by their name: ${userName}
- Use simple, conversational Filipino-friendly English
- Be warm, patient, and supportive
- Celebrate when students understand something
- Never make the student feel bad for not knowing something

YOUR RESPONSE RULES — VERY IMPORTANT:
1. ALWAYS respond to EVERY message — never ignore anything
2. When someone says hi, hello, hey, kumusta, kamusta — greet them warmly by name and ask what they need help with today
3. When someone asks about what you can do — list your capabilities and then ask what they want to explore
4. When someone picks a topic (like "quiz me" or "I want to study Math") — immediately engage with that specific topic using their learning goals and skills as context
5. When someone asks about a subject — give a clear, thorough explanation with examples
6. When someone wants practice questions — generate 3-5 questions appropriate for their grade level
7. When someone asks for a study plan — create a personalized one based on their learning goals
8. When someone asks about credits or the platform — explain clearly and helpfully
9. NEVER say you cannot help — always find a way to assist
10. Keep responses well-structured with bullet points and bold key terms

SUBJECT EXPERTISE:
- Mathematics (Algebra, Calculus, Geometry, Statistics, Trigonometry)
- Science (Biology, Chemistry, Physics, Earth Science)
- English (Grammar, Writing, Reading Comprehension, Literature)
- Filipino / Araling Panlipunan
- Computer Science (Programming, Web Dev, Networking, Databases)
- Networking (Subnetting, IPv4, IPv6, Cisco, CCNA topics)
- History and Social Studies
- Economics and Business

SPECIAL INSTRUCTIONS:
- If the student mentions a subject from their learning goals, prioritize helping with that
- If they ask to be quizzed, create questions at their grade level
- If they ask what to study next, recommend based on their growth areas
- Always end with a follow-up question to keep them engaged
- Use Filipino examples when relevant (palengke, Jollibee, piso, barangay, etc.)`;

    // Send last 20 messages for context
    const messages = botHistory.slice(-20).map(m => ({ role: m.role, content: m.content }));

    let reply = null;

    try {
        const response = await fetch(`${API}/ai-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, systemPrompt, userEmail })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        console.log('AI response:', data);

        if (data.success && data.reply) {
            reply = data.reply;
        } else {
            console.warn('No AI reply, using fallback:', data);
            reply = null;
        }
    } catch(e) {
        console.error('Bot fetch error:', e);
        reply = null;
    }

    // Remove thinking dots
    document.getElementById('botThinking')?.remove();

    // Re-enable input
    if (inp) inp.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    inp?.focus();

    // Use fallback only if API completely failed
    if (!reply) {
        reply = getBotFallback(msg, userGrowth, userName, credits, grade);
    }

    botHistory.push({ role: 'assistant', content: reply });
    saveBotHistory();
    appendBotMsg(area, reply);
    area.scrollTop = area.scrollHeight;
}

// ── SMART FALLBACK (when API fails) ──────────────────────────

function getBotFallback(msg, growth = [], userName = 'there', credits = '0', grade = '') {
    const m = msg.toLowerCase().trim();
    const name = userName;
    const subj = growth[0] || 'your subjects';

    // Greetings
    if (/^(hi|hello|hey|sup|yo|howdy|kumusta|kamusta|musta|good morning|good afternoon|good evening|magandang|hola)/.test(m)) {
        return `Hello ${name}! 👋 Great to see you!\n\nI am your **Tandem Study AI** and I am here to help you learn. Here is what I can do for you:\n\n• **Any subject** — Math, Science, English, Programming, Networking, and more\n• **Study strategies** — tips to help you learn faster\n• **Practice questions** — ask me to quiz you on anything\n• **Learning roadmaps** — what to study next based on your goals\n• **Tandem platform** — how credits, sessions, and quests work\n\nYou are learning **${subj}** right now. Want to start with that, or is there something else on your mind?`;
    }

    // What can you do
    if (m.includes('what can you do') || m.includes('what can you help') || m.includes('help me') || m.includes('capabilities') || m.includes('features')) {
        return `Great question, ${name}! Here is everything I can help you with:\n\n• **Explain any subject** — just ask me to explain a topic and I will break it down clearly\n• **Quiz you** — say "quiz me on Math" or "give me practice questions about networking"\n• **Study plans** — ask me to make a study schedule for you\n• **Study tips** — I know the best strategies to help you learn and retain more\n• **Learning roadmap** — I will recommend what to study next based on your goals\n• **Tandem help** — questions about credits, sessions, and how the platform works\n\nSince you are learning **${subj}**, want me to start there? Just say the word!`;
    }

    // Quiz request
    if (m.includes('quiz') || m.includes('test me') || m.includes('practice question') || m.includes('give me question')) {
        const topic = growth[0] || 'general knowledge';
        return `Sure thing, ${name}! Let us do a quick quiz on **${topic}**! 📝\n\nHere are 3 practice questions for you:\n\n**Question 1:** What is the most fundamental concept in ${topic} that beginners should master first?\n\n**Question 2:** Can you give a real-world example of how ${topic} is used in everyday life?\n\n**Question 3:** What is the biggest challenge most students face when learning ${topic}?\n\nTake your time and answer any one of them — I will give you feedback and explain the correct answer! Which one do you want to start with?`;
    }

    // Study tips
    if (m.includes('study tip') || m.includes('how to study') || m.includes('paano mag-aral') || m.includes('study strategy') || m.includes('learn faster')) {
        return `Here are the most effective study strategies, ${name}! 📚\n\n• **Pomodoro Technique** — study for 25 minutes, then rest for 5 minutes. Repeat 4 times then take a longer break\n• **Active recall** — instead of re-reading, close the book and try to recall what you learned from memory\n• **Spaced repetition** — review material after 1 day, then 3 days, then 1 week — this locks it into long-term memory\n• **Teach it back** — explain the concept out loud as if you are teaching someone else. If you cannot explain it, you do not know it yet\n• **Mind mapping** — draw visual connections between ideas to see the big picture\n• **Practice problems** — for Math and Science, doing problems is more effective than reading\n\nFor **${subj}** specifically, the most important thing is consistent daily practice — even just 20 minutes a day makes a huge difference!\n\nWant me to make a personalized study schedule for you?`;
    }

    // Study plan / roadmap
    if (m.includes('study plan') || m.includes('study schedule') || m.includes('what should i study') || m.includes('roadmap') || m.includes('recommend')) {
        const subjects = growth.length ? growth.join(', ') : 'your chosen subjects';
        return `Here is a personalized learning roadmap for you, ${name}! 🗺️\n\nBased on your learning goals (${subjects}), here is what I recommend:\n\n**Week 1-2: Build the Foundation**\n• Focus on the fundamentals of ${growth[0] || 'your first subject'}\n• Spend 30-45 minutes daily\n• Find a mentor on Tandem for guided learning\n\n**Week 3-4: Practice and Apply**\n• Solve practice problems every day\n• Ask your mentor to quiz you\n• Review mistakes immediately\n\n**Week 5+: Level Up**\n• Move to more advanced topics\n• Teach concepts to others to test your understanding\n• Track your progress through Tandem sessions\n\nRemember — you have **${credits} credits** on Tandem! Each credit gives you 30 minutes with a real human mentor. Want me to suggest which subject to tackle first?`;
    }

    // Credits / platform
    if (m.includes('credit') || m.includes('how does tandem') || m.includes('how do i use') || m.includes('session') || m.includes('mentor')) {
        return `Here is how **Tandem** works, ${name}! 💳\n\n**Credits System:**\n• You currently have **${credits} credits**\n• 1 credit = 30 minutes of mentor session time\n• Learners spend credits to book sessions\n• Mentors earn credits by teaching\n\n**How to get more credits:**\n• Complete quests (check the Quests section!)\n• Become a mentor yourself and teach others\n• Log in daily for streak bonuses\n\n**How to book a session:**\n1. Go to **Find Mentors**\n2. Connect with a mentor who teaches what you need\n3. Send a session request\n4. When accepted, join the session!\n\nAfter each session, rate your mentor with stars to help others find great tutors.\n\nDo you want to know more about anything specific?`;
    }

    // Math
    if (m.includes('math') || m.includes('algebra') || m.includes('calculus') || m.includes('geometry') || m.includes('trigonometry') || m.includes('statistics')) {
        return `Let us talk about **Math**, ${name}! 🔢\n\nMath can feel scary but it is actually very logical — once you understand the pattern, it clicks!\n\n**Tips for Math success:**\n• Never skip steps — write everything out even if it feels slow\n• Practice daily — even 15-20 minutes is enough\n• When stuck, work backwards from the answer to understand the solution\n• Khan Academy has great free video explanations\n• A Tandem mentor can give you personalized 1-on-1 help!\n\n**What specific Math topic do you need help with?** I can explain:\n• Algebra (equations, factoring, quadratics)\n• Calculus (limits, derivatives, integrals)\n• Geometry (shapes, proofs, theorems)\n• Statistics (mean, median, probability)\n• Trigonometry (sin, cos, tan, identities)`;
    }

    // Networking / IT
    if (m.includes('subnet') || m.includes('network') || m.includes('ip address') || m.includes('cisco') || m.includes('ccna') || m.includes('ipv6') || m.includes('router') || m.includes('switch')) {
        return `Let us talk about **Networking**, ${name}! 🌐\n\nHere are some key concepts:\n\n• **/24 network** = 256 total addresses, 254 usable hosts\n• **/26 network** = 64 addresses, 4 subnets from a /24\n• **Block size** = 256 minus the last octet of subnet mask\n• **IPv6** = 128 bits total, interface ID starts at bit 64\n• **/26 mask** = 255.255.255.192 in decimal\n\n**Fast subnetting trick:**\n1. Find borrowed bits: new prefix minus old prefix\n2. Subnets = 2^(borrowed bits)\n3. Block size = 256 minus last octet of mask\n\nWhat specific networking topic do you want me to explain? I can help with:\n• Subnetting (IPv4 and IPv6)\n• CCNA topics\n• Routing and switching\n• Network protocols`;
    }

    // Programming
    if (m.includes('python') || m.includes('javascript') || m.includes('programming') || m.includes('code') || m.includes('coding') || m.includes('html') || m.includes('css') || m.includes('java') || m.includes('c++')) {
        return `Let us talk about **Programming**, ${name}! 💻\n\n**Tips for learning to code:**\n• Start with the basics — variables, loops, conditions, functions\n• Practice every day — even just writing small programs\n• Read error messages carefully — they tell you exactly what is wrong\n• Build small projects you actually care about\n• Stack Overflow and documentation are your best friends\n\n**What I can help you with:**\n• Explain any programming concept\n• Debug your code logic\n• Explain how algorithms work\n• Help you understand data structures\n• Web development (HTML, CSS, JavaScript)\n\nWhat specific programming language or concept do you want to learn? Just ask and I will explain it step by step!`;
    }

    // Science
    if (m.includes('science') || m.includes('biology') || m.includes('chemistry') || m.includes('physics') || m.includes('earth science')) {
        return `Let us talk about **Science**, ${name}! 🔬\n\nScience is all about understanding the world around us through observation and experimentation.\n\n**What I can explain:**\n• **Biology** — cells, genetics, ecosystems, human body\n• **Chemistry** — elements, reactions, periodic table, bonding\n• **Physics** — forces, energy, motion, electricity, waves\n• **Earth Science** — weather, geology, space, environment\n\n**Study tips for Science:**\n• Understand concepts first, memorize second\n• Draw diagrams — visual learning works great for science\n• Connect concepts to real life (like how a jeepney engine uses physics!)\n• Practice solving problems, not just reading theory\n\nWhich Science subject do you need help with? Tell me the specific topic and I will explain it clearly!`;
    }

    // English
    if (m.includes('english') || m.includes('grammar') || m.includes('writing') || m.includes('essay') || m.includes('reading')) {
        return `Let us talk about **English**, ${name}! ✍️\n\n**What I can help you with:**\n• Grammar rules and usage\n• Essay writing and structure\n• Reading comprehension strategies\n• Vocabulary building\n• Literary analysis\n\n**Tips for improving English:**\n• Read every day — books, articles, anything you enjoy\n• Write regularly — even a short journal entry helps\n• Watch English shows with subtitles\n• Practice speaking out loud — do not be shy!\n• Learn 5 new vocabulary words per day\n\n**For essays, always remember:**\n1. Strong thesis statement\n2. Body paragraphs with evidence\n3. Clear conclusion that restates your point\n\nWhat specific English topic do you want to practice? Grammar, writing, or something else?`;
    }

    // Default smart fallback
    return `Hi ${name}! 😊 I am having a quick connection issue right now, but I am still here to help!\n\nYou can ask me about:\n• **Any subject** — Math, Science, English, Filipino, History, Programming, Networking\n• **Study tips** — the best strategies to learn faster and remember more\n• **Practice questions** — say "quiz me on [subject]" and I will test you\n• **Study roadmaps** — what to study next based on your goals in ${subj}\n• **Tandem credits** — how the platform works\n\nWhat would you like to explore today, ${name}?`;
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