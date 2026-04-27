// Encrypt email
function encryptEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 1) return email;
  return local[0] + '*'.repeat(local.length - 1) + '@' + domain;
}

// Load user info
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
      await fetch('https://tandem-yq99.onrender.com/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credits: amount })
      });
    } catch(err) {
      console.error('Error saving credits:', err);
    }
  }
}

function updateCreditsDisplay(amount) {
  const totalEl = document.getElementById('totalCredits');
  if (totalEl) totalEl.textContent = amount;
  const topBadgeEl = document.getElementById('topCreditsBadge');
  if (topBadgeEl) topBadgeEl.textContent = amount;
}

// Check if profile is completed
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

// Escape HTML for safety
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show toast notification
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
    const confirmed = confirm('Are you sure you want to log out?');
    if (!confirmed) return;

    const email = localStorage.getItem('userEmail');
    const currentCredits = getCredits();

    if (email && currentCredits) {
      try {
        await fetch('https://tandem-yq99.onrender.com/update-credits ', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, credits: currentCredits })
        });
      } catch(err) {
        console.error('Error saving credits:', err);
      }
    }

    setTimeout(() => {
      localStorage.clear();
      window.location.href = 'index.html';
    }, 500);
  });
}

// Load credits from database
async function loadCreditsFromDatabase() {
  const email = localStorage.getItem('userEmail');
  if (!email) return false;
  
  try {
    const response = await fetch('https://tandem-yq99.onrender.com/get-user-data', {
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
      return true;
    }
  } catch (error) {
    console.error('Error loading credits:', error);
  }
  return false;
}

// Load pending connection requests (connection requests, NOT session requests)
async function loadPendingRequests() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    
    try {
        const response = await fetch('https://tandem-yq99.onrender.com/get-pending-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        
        const section = document.getElementById('pendingRequestsSection');
        const container = document.getElementById('pendingRequestsList');
        
        if (data.requests && data.requests.length > 0) {
            section.style.display = 'block';
            container.innerHTML = data.requests.map(req => `
                <div class="pending-card">
                    <div class="pending-avatar">
                        ${req.learner_profile_pic ? 
                            `<img src="${req.learner_profile_pic}" alt="">` :
                            `<div class="avatar-placeholder">${(req.learner_name || 'U').charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <div class="pending-info">
                        <div class="pending-name">${escapeHtml(req.learner_name || req.learner_username)}</div>
                        <div class="pending-subject">📚 Wants to learn: ${escapeHtml(req.subject || 'General')}</div>
                        <div class="pending-message">💬 ${escapeHtml(req.message || 'No message')}</div>
                        <div class="pending-grade">🎓 Grade: ${escapeHtml(req.learner_grade || 'Not specified')}</div>
                    </div>
                    <div class="pending-actions">
                        <button class="btn-accept" data-request-id="${req.id}" data-learner-email="${req.learner_email}">✓ Accept Connection</button>
                        <button class="btn-reject" data-request-id="${req.id}">✗ Reject</button>
                    </div>
                </div>
            `).join('');
            
            // Add event listeners to buttons
            document.querySelectorAll('.btn-accept').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const requestId = btn.getAttribute('data-request-id');
                    const learnerEmail = btn.getAttribute('data-learner-email');
                    acceptConnectionRequest(requestId, learnerEmail);
                });
            });
            
            document.querySelectorAll('.btn-reject').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const requestId = btn.getAttribute('data-request-id');
                    rejectConnectionRequest(requestId);
                });
            });
        }
    } catch (error) {
        console.error('Error loading pending requests:', error);
    }
}

// Load pending SESSION requests (for tutoring sessions)
async function loadPendingSessionRequests() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    
    try {
        const response = await fetch('https://tandem-yq99.onrender.com/get-pending-session-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tutorEmail: email })
        });
        const data = await response.json();
        
        const section = document.getElementById('pendingRequestsSection');
        const container = document.getElementById('pendingRequestsList');
        
        if (data.sessions && data.sessions.length > 0) {
            section.style.display = 'block';
            
            // Get existing HTML or create empty
            let existingHTML = container.innerHTML;
            if (existingHTML.includes('No pending requests') || existingHTML === '') {
                existingHTML = '';
            }
            
            const sessionHTML = data.sessions.map(session => `
                <div class="pending-card session-request-card" style="border-left: 3px solid #f5a623;">
                    <div class="pending-avatar">
                        ${session.learner_profile_pic ? 
                            `<img src="${session.learner_profile_pic}" alt="">` :
                            `<div class="avatar-placeholder">${(session.learner_name || 'U').charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <div class="pending-info">
                        <div class="pending-name">${escapeHtml(session.learner_name || session.learner_username)}</div>
                        <div class="pending-subject">🎓 SESSION REQUEST: ${escapeHtml(session.subject || 'General')}</div>
                        <div class="pending-message">💬 ${escapeHtml(session.session_notes || 'No additional notes')}</div>
                        <div class="pending-grade">💰 This will earn you 1 credit when completed</div>
                    </div>
                    <div class="pending-actions">
                        <button class="btn-accept-session" data-session-id="${session.id}" data-learner-email="${session.learner_email}">✓ Accept Session</button>
                        <button class="btn-reject-session" data-session-id="${session.id}">✗ Reject</button>
                    </div>
                </div>
            `).join('');
            
            container.innerHTML = existingHTML + sessionHTML;
            
            // Add event listeners for session buttons
            document.querySelectorAll('.btn-accept-session').forEach(btn => {
                btn.removeEventListener('click', handleAcceptSession);
                btn.addEventListener('click', handleAcceptSession);
            });
            
            document.querySelectorAll('.btn-reject-session').forEach(btn => {
                btn.removeEventListener('click', handleRejectSession);
                btn.addEventListener('click', handleRejectSession);
            });
        }
    } catch (error) {
        console.error('Error loading session requests:', error);
    }
}

// Handler functions for session requests
async function handleAcceptSession(e) {
    e.stopPropagation();
    const sessionId = e.currentTarget.getAttribute('data-session-id');
    const learnerEmail = e.currentTarget.getAttribute('data-learner-email');
    const tutorEmail = localStorage.getItem('userEmail');
    await acceptSessionRequest(sessionId, tutorEmail, learnerEmail);
}

async function handleRejectSession(e) {
    e.stopPropagation();
    const sessionId = e.currentTarget.getAttribute('data-session-id');
    await rejectSessionRequest(sessionId);
}

async function acceptSessionRequest(sessionId, tutorEmail, learnerEmail) {
    const confirmed = confirm('Accept this session request?\n\n- The learner will spend 1 credit\n- You will earn 1 credit when you complete the session\n- A 30-minute timer will start\n\nDo you want to accept?');
    if (!confirmed) return;
    
    try {
        const response = await fetch('https://tandem-yq99.onrender.com/accept-session-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, tutorEmail, learnerEmail })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Session accepted! Timer started. Go to Messages to chat with the learner.');
            // Redirect to messages page
            setTimeout(() => {
                window.location.href = 'messages.html';
            }, 1500);
        } else {
            showToast(data.message || 'Failed to accept session');
        }
    } catch (error) {
        console.error('Error accepting session:', error);
        showToast('Error accepting session');
    }
}

async function rejectSessionRequest(sessionId) {
    const confirmed = confirm('Reject this session request?');
    if (!confirmed) return;
    
    try {
        await fetch('https://tandem-yq99.onrender.com/reject-session-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        showToast('Session request rejected');
        // Refresh the page to remove the request
        setTimeout(() => {
            location.reload();
        }, 1000);
    } catch (error) {
        console.error('Error rejecting session:', error);
        showToast('Error rejecting session');
    }
}

// Accept connection request (not session request)
async function acceptConnectionRequest(requestId, learnerEmail) {
    const tutorEmail = localStorage.getItem('userEmail');
    
    const confirmed = confirm('Accept this connection request? The learner will be able to message you and request sessions.');
    if (!confirmed) return;
    
    try {
        const response = await fetch('https://tandem-yq99.onrender.com/accept-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, tutorEmail, learnerEmail })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Connection accepted! You can now message each other.');
            loadPendingRequests();
            loadPendingSessionRequests();
        } else {
            showToast(data.message || 'Failed to accept request');
        }
    } catch (error) {
        console.error('Error accepting request:', error);
        showToast('Error accepting request');
    }
}

async function rejectConnectionRequest(requestId) {
    const confirmed = confirm('Reject this connection request?');
    if (!confirmed) return;
    
    try {
        await fetch('https://tandem-yq99.onrender.com/reject-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId })
        });
        showToast('Request rejected');
        loadPendingRequests();
        loadPendingSessionRequests();
    } catch (error) {
        console.error('Error rejecting request:', error);
        showToast('Error rejecting request');
    }
}

// Check if user has an active session
async function checkActiveSession() {
    const email = localStorage.getItem('userEmail');
    if (!email) return false;
    
    try {
        const response = await fetch('https://tandem-yq99.onrender.com/get-active-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        
        if (data.success && data.session && data.session.status === 'active') {
            // Show active session indicator in sidebar or topbar
            const activeSessionIndicator = document.getElementById('activeSessionIndicator');
            if (activeSessionIndicator) {
                activeSessionIndicator.style.display = 'flex';
            }
            return true;
        } else {
            const activeSessionIndicator = document.getElementById('activeSessionIndicator');
            if (activeSessionIndicator) {
                activeSessionIndicator.style.display = 'none';
            }
            return false;
        }
    } catch (error) {
        console.error('Error checking active session:', error);
        return false;
    }
}

// Make functions global
window.acceptConnectionRequest = acceptConnectionRequest;
window.rejectConnectionRequest = rejectConnectionRequest;
window.acceptSessionRequest = acceptSessionRequest;
window.rejectSessionRequest = rejectSessionRequest;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    window.location.href = 'index.html';
    return;
  }
  
  await loadCreditsFromDatabase();
  
  if (!checkProfileCompletion()) {
    return;
  }
  
  loadUserInfo();
  updateCreditsDisplay(getCredits());
  loadPendingRequests();
  loadPendingSessionRequests();
  checkActiveSession();
  setupLogout();
  
  // Refresh pending requests every 30 seconds
  setInterval(() => {
    loadPendingRequests();
    loadPendingSessionRequests();
    checkActiveSession();
  }, 30000);
});