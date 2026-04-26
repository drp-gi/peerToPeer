const userEmail = localStorage.getItem('userEmail');
if (!userEmail) window.location.href = 'index.html';

let currentChatEmail = null;
let currentChatName = null;
let messageInterval = null;
let sessionInterval = null;
let currentSession = null;
let sessionTimerInterval = null;

function updateCreditsDisplay(amount) {
    document.getElementById('topCreditsBadge').textContent = amount;
}

async function loadCredits() {
    try {
        const response = await fetch('http://localhost:3000/get-user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await response.json();
        if (data.success) {
            updateCreditsDisplay(data.credits);
            localStorage.setItem('tandem_credits', data.credits);
        }
    } catch (error) {
        console.error('Error loading credits:', error);
    }
}

async function loadConnections() {
    try {
        const response = await fetch('http://localhost:3000/get-connections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await response.json();
        
        const connectionsList = document.getElementById('connectionsList');
        
        if (data.connections && data.connections.length > 0) {
            connectionsList.innerHTML = data.connections.map(conn => `
                <div class="connection-item" onclick="selectChat('${conn.connected_email}', '${escapeHtml(conn.connected_name || conn.connected_username)}')">
                    <div class="connection-avatar">
                        ${conn.connected_profile_pic ? 
                            `<img src="${conn.connected_profile_pic}" alt="">` :
                            `<div class="avatar-placeholder">${(conn.connected_name || conn.connected_username || 'U').charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <div class="connection-info">
                        <div class="connection-name">${escapeHtml(conn.connected_name || conn.connected_username)}</div>
                        <div class="connection-preview" id="status_${conn.connected_email}">Click to chat</div>
                    </div>
                </div>
            `).join('');
        } else {
            connectionsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👋</div>
                    <h4>No connections yet</h4>
                    <p>Go to Find Mentors to connect with people who can teach you what you want to learn!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading connections:', error);
        document.getElementById('connectionsList').innerHTML = '<div class="empty-state">Error loading connections</div>';
    }
}

async function checkUserSessionStatus(email) {
    try {
        const response = await fetch('http://localhost:3000/get-active-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        const data = await response.json();
        return data.session && data.session.status === 'active';
    } catch (error) {
        return false;
    }
}

async function updateConnectionStatuses() {
    const connections = document.querySelectorAll('.connection-item');
    for (const conn of connections) {
        const email = conn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        if (email) {
            const isInSession = await checkUserSessionStatus(email);
            const previewSpan = document.getElementById(`status_${email}`);
            if (previewSpan) {
                if (isInSession) {
                    previewSpan.innerHTML = '<span style="color:#e05555;">🔴 In a session</span>';
                } else {
                    previewSpan.innerHTML = 'Available to chat';
                }
            }
        }
    }
}

function formatMessageTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    });
}

function formatMessageDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    const msgDate = new Date(date);
    msgDate.setHours(0, 0, 0, 0);
    
    if (msgDate.getTime() === today.getTime()) {
        return 'Today';
    } else if (msgDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString([], { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    }
}

function groupMessagesByDate(messages) {
    const groups = {};
    messages.forEach(msg => {
        const date = new Date(msg.created_at);
        const dateKey = date.toDateString();
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(msg);
    });
    return groups;
}

async function selectChat(chatEmail, chatName) {
    currentChatEmail = chatEmail;
    currentChatName = chatName;
    
    document.querySelectorAll('.connection-item').forEach(item => {
        item.classList.remove('active');
    });
    const items = document.querySelectorAll('.connection-item');
    for (let item of items) {
        if (item.querySelector('.connection-name')?.textContent === chatName) {
            item.classList.add('active');
            break;
        }
    }
    
    await loadMessages(chatEmail, chatName);
    await loadActiveSession();
    
    if (messageInterval) clearInterval(messageInterval);
    messageInterval = setInterval(() => loadMessages(chatEmail, chatName, true), 3000);
    
    if (sessionInterval) clearInterval(sessionInterval);
    sessionInterval = setInterval(() => loadActiveSession(), 5000);
}

async function loadActiveSession() {
    try {
        const response = await fetch('http://localhost:3000/get-active-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await response.json();
        
        console.log('Active session data:', data);
        
        if (data.success && data.session) {
            currentSession = data.session;
            const isLearner = data.session.user_role === 'learner';
            
            if (data.session.status === 'pending' && !isLearner) {
                showSessionRequestUI(data.session);
            } else if (data.session.status === 'active') {
                showActiveSessionUI(data.session);
                startSessionTimer(data.session.session_start);
            } else {
                hideSessionUI();
            }
            
            if (currentChatEmail && currentChatEmail === (isLearner ? data.session.tutor_email : data.session.learner_email)) {
                updateChatHeaderSessionStatus(data.session.status === 'active');
            }
        } else {
            currentSession = null;
            hideSessionUI();
            if (currentChatEmail) {
                updateChatHeaderSessionStatus(false);
            }
        }
        
        updateConnectionStatuses();
    } catch (error) {
        console.error('Error loading active session:', error);
    }
}

function startSessionTimer(startTime) {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    
    const start = new Date(startTime);
    const end = new Date(start.getTime() + 30 * 60000);
    
    function updateTimer() {
        const now = new Date();
        const remaining = end - now;
        
        if (remaining <= 0) {
            clearInterval(sessionTimerInterval);
            const timerDisplay = document.getElementById('sessionTimerDisplay');
            if (timerDisplay) timerDisplay.textContent = "00:00";
        } else {
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const timerDisplay = document.getElementById('sessionTimerDisplay');
            if (timerDisplay) {
                timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
    }
    
    updateTimer();
    sessionTimerInterval = setInterval(updateTimer, 1000);
}

function showSessionRequestUI(session) {
    const modal = document.getElementById('sessionModal');
    const modalTitle = document.getElementById('sessionModalTitle');
    const modalBody = document.getElementById('sessionModalBody');
    
    modalTitle.textContent = 'Session Request';
    modalBody.innerHTML = `
        <div class="session-info">
            <p><strong>${escapeHtml(session.learner_name)}</strong> wants to learn:</p>
            <p class="session-subject">📚 ${escapeHtml(session.subject || 'General')}</p>
            ${session.session_notes ? `<p class="session-notes">💬 Notes: ${escapeHtml(session.session_notes)}</p>` : ''}
        </div>
        <div class="session-actions">
            <button class="session-btn-accept" onclick="acceptSessionRequest(${session.id}, '${session.tutor_email}', '${session.learner_email}')">Accept Session</button>
            <button class="session-btn-reject" onclick="rejectSessionRequest(${session.id})">Reject</button>
        </div>
    `;
    modal.style.display = 'flex';
}

function showActiveSessionUI(session) {
    const modal = document.getElementById('sessionModal');
    const modalTitle = document.getElementById('sessionModalTitle');
    const modalBody = document.getElementById('sessionModalBody');
    const isLearner = session.user_role === 'learner';
    
    modalTitle.textContent = 'Active Session';
    modalBody.innerHTML = `
        <div class="session-timer" id="sessionTimerDisplay">30:00</div>
        <div class="session-info">
            <p><strong>${isLearner ? escapeHtml(session.tutor_name) : escapeHtml(session.learner_name)}</strong></p>
            <p>Topic: ${escapeHtml(session.subject || 'General')}</p>
            <p class="session-status-active">● Session in progress</p>
        </div>
        <div class="session-actions">
            <button class="session-btn-complete" id="completeSessionBtn">Complete Session</button>
        </div>
    `;
    modal.style.display = 'flex';
    
    // Attach event listener directly here
    const completeBtn = document.getElementById('completeSessionBtn');
    if (completeBtn) {
        // Remove any existing listeners
        const newBtn = completeBtn.cloneNode(true);
        completeBtn.parentNode.replaceChild(newBtn, completeBtn);
        newBtn.addEventListener('click', function() {
            console.log('Complete button clicked!');
            completeCurrentSession();
        });
    }
}

function hideSessionUI() {
    const modal = document.getElementById('sessionModal');
    if (modal) modal.style.display = 'none';
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
}

function updateChatHeaderSessionStatus(inSession) {
    const statusDiv = document.querySelector('.chat-header-status');
    if (statusDiv) {
        if (inSession) {
            statusDiv.innerHTML = '<span style="color:#e05555;">🔴 In a session</span>';
        } else {
            statusDiv.textContent = 'Connected';
        }
    }
}

async function acceptSessionRequest(sessionId, tutorEmail, learnerEmail) {
    try {
        const response = await fetch('http://localhost:3000/accept-session-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, tutorEmail, learnerEmail })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Session accepted! Timer started.');
            await loadCredits();
            await loadActiveSession();
            hideSessionUI();
        } else {
            showToast(data.message || 'Failed to accept session');
        }
    } catch (error) {
        console.error('Error accepting session:', error);
        showToast('Error accepting session');
    }
}

async function rejectSessionRequest(sessionId) {
    try {
        const response = await fetch('http://localhost:3000/reject-session-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Session request rejected');
            hideSessionUI();
            await loadActiveSession();
        } else {
            showToast('Failed to reject session');
        }
    } catch (error) {
        console.error('Error rejecting session:', error);
        showToast('Error rejecting session');
    }
}

async function completeCurrentSession() {
    console.log('=== COMPLETE SESSION CALLED ===');
    console.log('currentSession object:', currentSession);
    
    if (!currentSession) {
        console.error('No current session found');
        showToast('No active session found. Please refresh the page.');
        return;
    }
    
    if (!currentSession.id) {
        console.error('Session has no ID:', currentSession);
        showToast('Invalid session data. Please refresh the page.');
        return;
    }
    
    console.log('Session ID:', currentSession.id);
    console.log('Session status:', currentSession.status);
    
    // Show rating modal
    showRatingModal();
}

function showRatingModal() {
    const modal = document.getElementById('ratingModal');
    if (!modal) {
        console.error('Rating modal not found');
        // If modal not found, just complete the session without rating
        completeSessionWithoutRating();
        return;
    }
    modal.style.display = 'flex';
    
    let selectedRating = 0;
    const stars = document.querySelectorAll('#ratingStars span');
    stars.forEach(star => {
        star.onclick = () => {
            selectedRating = parseInt(star.getAttribute('data-rating'));
            stars.forEach(s => {
                const rating = parseInt(s.getAttribute('data-rating'));
                if (rating <= selectedRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        };
    });
    
    const submitBtn = document.getElementById('submitRatingBtn');
    if (submitBtn) {
        // Remove old listener and add new one
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        newSubmitBtn.onclick = async () => {
            const feedback = document.getElementById('ratingFeedback').value;
            await submitSessionCompletion(selectedRating || 5, feedback);
            closeRatingModal();
        };
    }
    
    const skipBtn = document.getElementById('skipRatingBtn');
    if (skipBtn) {
        const newSkipBtn = skipBtn.cloneNode(true);
        skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
        newSkipBtn.onclick = async () => {
            await submitSessionCompletion(null, null);
            closeRatingModal();
        };
    }
}

function closeRatingModal() {
    const modal = document.getElementById('ratingModal');
    if (modal) modal.style.display = 'none';
    const feedback = document.getElementById('ratingFeedback');
    if (feedback) feedback.value = '';
    const stars = document.querySelectorAll('#ratingStars span');
    stars.forEach(s => s.classList.remove('active'));
}

async function completeSessionWithoutRating() {
    console.log('Completing session without rating');
    if (!currentSession || !currentSession.id) return;
    
    try {
        const response = await fetch('http://localhost:3000/complete-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionId: currentSession.id, 
                rating: null, 
                feedback: null 
            })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Session completed!');
            await loadCredits();
            await loadActiveSession();
            hideSessionUI();
        } else {
            showToast(data.message || 'Error completing session');
        }
    } catch (error) {
        console.error('Error completing session:', error);
        showToast('Error completing session');
    }
}

async function submitSessionCompletion(rating, feedback) {
    console.log('submitSessionCompletion called');
    console.log('Session ID:', currentSession?.id);
    console.log('Rating:', rating);
    console.log('Feedback:', feedback);
    
    if (!currentSession || !currentSession.id) {
        showToast('Error: No active session found');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/complete-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionId: currentSession.id, 
                rating: rating, 
                feedback: feedback 
            })
        });
        const data = await response.json();
        
        console.log('Complete session response:', data);
        
        if (data.success) {
            showToast('✅ Session completed!');
            await loadCredits();
            await loadActiveSession();
            hideSessionUI();
            if (currentChatEmail && currentChatName) {
                await loadMessages(currentChatEmail, currentChatName);
            }
        } else {
            showToast(data.message || 'Error completing session');
        }
    } catch (error) {
        console.error('Error completing session:', error);
        showToast('Error completing session');
    }
}

function showSessionRequestModal(tutorEmail, tutorName) {
    const modal = document.getElementById('sessionRequestModal');
    const tutorInfo = document.getElementById('sessionRequestTutorInfo');
    if (tutorInfo) tutorInfo.innerHTML = `<strong>${escapeHtml(tutorName)}</strong>`;
    
    const subjectInput = document.getElementById('sessionSubject');
    const notesInput = document.getElementById('sessionNotes');
    if (subjectInput) subjectInput.value = '';
    if (notesInput) notesInput.value = '';
    
    const sendBtn = document.getElementById('sendSessionRequestBtn');
    if (sendBtn) {
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        newSendBtn.onclick = () => sendSessionRequest(tutorEmail);
    }
    
    if (modal) modal.style.display = 'flex';
}

function closeSessionRequestModal() {
    const modal = document.getElementById('sessionRequestModal');
    if (modal) modal.style.display = 'none';
}

function closeSessionModal() {
    const modal = document.getElementById('sessionModal');
    if (modal) modal.style.display = 'none';
}

async function sendSessionRequest(tutorEmail) {
    const subject = document.getElementById('sessionSubject').value.trim();
    const notes = document.getElementById('sessionNotes').value.trim();
    
    if (!subject) {
        showToast('Please enter a subject/topic');
        return;
    }
    
    const credits = parseInt(localStorage.getItem('tandem_credits') || '5');
    if (credits < 1) {
        showToast('❌ Not enough credits! You need at least 1 credit to request a session.');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/send-session-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                learnerEmail: userEmail,
                tutorEmail: tutorEmail,
                subject: subject,
                sessionNotes: notes
            })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Session request sent! Waiting for tutor to accept.');
            closeSessionRequestModal();
            await loadActiveSession();
        } else {
            showToast(data.message || 'Failed to send session request');
        }
    } catch (error) {
        console.error('Error sending session request:', error);
        showToast('Error sending session request');
    }
}

async function loadMessages(chatEmail, chatName, isPolling = false) {
    try {
        const response = await fetch('http://localhost:3000/get-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user1Email: userEmail, user2Email: chatEmail })
        });
        const data = await response.json();
        
        const chatArea = document.getElementById('chatArea');
        const otherUserInSession = await checkUserSessionStatus(chatEmail);
        
        if (!isPolling) {
            const connectionItem = document.querySelector('.connection-item.active');
            let profilePic = '';
            if (connectionItem) {
                const avatarImg = connectionItem.querySelector('.connection-avatar img');
                if (avatarImg) profilePic = avatarImg.src;
            }
            
            chatArea.innerHTML = `
                <div class="chat-header">
                    <div class="chat-header-avatar">
                        ${profilePic ? 
                            `<img src="${profilePic}" alt="${chatName}">` :
                            `<div class="avatar-placeholder">${chatName.charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <div class="chat-header-info">
                        <div class="chat-header-name">${escapeHtml(chatName)}</div>
                        <div class="chat-header-status">${otherUserInSession ? '<span style="color:#e05555;">🔴 In a session</span>' : 'Connected'}</div>
                    </div>
                    <div class="chat-header-actions">
                        <button class="session-request-btn" id="sessionRequestBtn_${chatEmail}" ${otherUserInSession ? 'disabled style="opacity:0.5;"' : ''}>
                            📅 Request Session
                        </button>
                    </div>
                </div>
                <div class="messages-area" id="messagesArea"></div>
                <div class="message-input-area">
                    <input type="text" class="message-input" id="messageInput" placeholder="Type a message..." ${otherUserInSession ? 'disabled style="background:#f5f5f5;"' : ''} onkeypress="if(event.key==='Enter') sendMessage()">
                    <button class="send-btn" id="sendMessageBtn" ${otherUserInSession ? 'disabled style="opacity:0.5;"' : ''}>Send</button>
                </div>
            `;
            
            // Attach event listener for session request button
            const sessionBtn = document.getElementById(`sessionRequestBtn_${chatEmail}`);
            if (sessionBtn && !otherUserInSession) {
                const newBtn = sessionBtn.cloneNode(true);
                sessionBtn.parentNode.replaceChild(newBtn, sessionBtn);
                newBtn.onclick = () => showSessionRequestModal(chatEmail, chatName);
            }
            
            // Attach send message listener
            const sendMsgBtn = document.getElementById('sendMessageBtn');
            if (sendMsgBtn && !otherUserInSession) {
                const newSendBtn = sendMsgBtn.cloneNode(true);
                sendMsgBtn.parentNode.replaceChild(newSendBtn, sendMsgBtn);
                newSendBtn.onclick = sendMessage;
            }
            
            const messageInput = document.getElementById('messageInput');
            if (messageInput && !otherUserInSession) {
                messageInput.onkeypress = (e) => {
                    if (e.key === 'Enter') sendMessage();
                };
            }
        }
        
        const messagesArea = document.getElementById('messagesArea');
        if (messagesArea) {
            if (data.messages && data.messages.length > 0) {
                const groupedMessages = groupMessagesByDate(data.messages);
                let html = '';
                
                for (const [dateKey, msgs] of Object.entries(groupedMessages)) {
                    const dateLabel = formatMessageDate(msgs[0].created_at);
                    html += `<div class="message-date-separator"><span>${dateLabel}</span></div>`;
                    
                    msgs.forEach(msg => {
                        const time = formatMessageTime(msg.created_at);
                        html += `
                            <div class="message ${msg.sender_email === userEmail ? 'message-sent' : 'message-received'}">
                                <div class="message-text">${escapeHtml(msg.message)}</div>
                                <div class="message-time">${time}</div>
                            </div>
                        `;
                    });
                }
                
                messagesArea.innerHTML = html;
                messagesArea.scrollTop = messagesArea.scrollHeight;
            } else {
                messagesArea.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">💬</div>
                        <h4>No messages yet</h4>
                        <p>Say hello to start the conversation!</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput?.value.trim();
    
    if (!message || !currentChatEmail) return;
    
    const otherUserInSession = await checkUserSessionStatus(currentChatEmail);
    if (otherUserInSession) {
        showToast('This user is currently in a session and cannot receive messages.');
        return;
    }
    
    try {
        await fetch('http://localhost:3000/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail: userEmail,
                receiverEmail: currentChatEmail,
                message: message
            })
        });
        
        if (messageInput) messageInput.value = '';
        await loadMessages(currentChatEmail, currentChatName);
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error sending message');
    }
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

async function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (messageInterval) clearInterval(messageInterval);
            if (sessionInterval) clearInterval(sessionInterval);
            if (sessionTimerInterval) clearInterval(sessionTimerInterval);
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
}

// Make functions global
window.selectChat = selectChat;
window.sendMessage = sendMessage;
window.acceptSessionRequest = acceptSessionRequest;
window.rejectSessionRequest = rejectSessionRequest;
window.completeCurrentSession = completeCurrentSession;
window.showSessionRequestModal = showSessionRequestModal;
window.closeSessionRequestModal = closeSessionRequestModal;
window.closeSessionModal = closeSessionModal;
window.closeRatingModal = closeRatingModal;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    loadCredits();
    loadConnections();
    setupLogout();
    loadActiveSession();
    
    setInterval(() => {
        loadConnections();
        updateConnectionStatuses();
    }, 30000);
});