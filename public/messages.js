const userEmail = localStorage.getItem('userEmail');
if (!userEmail) window.location.href = 'index.html';

let currentChatEmail = null;
let messageInterval = null;

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
                        <div class="connection-preview">Click to chat</div>
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

// Format time with user's local timezone
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
    
    // Reset time to compare just dates
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

// Group messages by date
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
    
    // Update UI - highlight active connection
    document.querySelectorAll('.connection-item').forEach(item => {
        item.classList.remove('active');
    });
    // Find and highlight the clicked item
    const items = document.querySelectorAll('.connection-item');
    for (let item of items) {
        if (item.querySelector('.connection-name')?.textContent === chatName) {
            item.classList.add('active');
            break;
        }
    }
    
    // Load messages
    await loadMessages(chatEmail, chatName);
    
    // Start polling for new messages
    if (messageInterval) clearInterval(messageInterval);
    messageInterval = setInterval(() => loadMessages(chatEmail, chatName, true), 3000);
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
        
        if (!isPolling) {
            // Get profile pic for header
            const connectionItem = document.querySelector(`.connection-item.active`);
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
                        <div class="chat-header-status">Connected</div>
                    </div>
                </div>
                <div class="messages-area" id="messagesArea"></div>
                <div class="message-input-area">
                    <input type="text" class="message-input" id="messageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendMessage()">
                    <button class="send-btn" onclick="sendMessage()">Send</button>
                </div>
            `;
        }
        
        const messagesArea = document.getElementById('messagesArea');
        if (messagesArea) {
            if (data.messages && data.messages.length > 0) {
                // Group messages by date
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
    const message = messageInput.value.trim();
    
    if (!message || !currentChatEmail) return;
    
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
        
        messageInput.value = '';
        // Get current chat name
        const chatName = document.querySelector('.chat-header-name')?.textContent || 'User';
        await loadMessages(currentChatEmail, chatName);
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
    toast.textContent = message;
    toast.classList.add('toast-show');
    setTimeout(() => toast.classList.remove('toast-show'), 3500);
}

async function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (messageInterval) clearInterval(messageInterval);
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
}

// Make functions global
window.selectChat = selectChat;
window.sendMessage = sendMessage;

document.addEventListener('DOMContentLoaded', () => {
    loadCredits();
    loadConnections();
    setupLogout();
});