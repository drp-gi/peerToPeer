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
      await fetch('http://localhost:3000/update-credits', {
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
        await fetch('http://localhost:3000/update-credits', {
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
    const response = await fetch('http://localhost:3000/get-user-data', {
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

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast-show');
  setTimeout(() => toast.classList.remove('toast-show'), 3500);
}

// Load pending requests for tutor view
async function loadPendingRequests() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    
    try {
        const response = await fetch('http://localhost:3000/get-pending-requests', {
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
                        <button class="btn-accept" data-request-id="${req.id}" data-learner-email="${req.learner_email}">✓ Accept</button>
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
                    acceptRequest(requestId, learnerEmail);
                });
            });
            
            document.querySelectorAll('.btn-reject').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const requestId = btn.getAttribute('data-request-id');
                    rejectRequest(requestId);
                });
            });
        } else {
            section.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading pending requests:', error);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function acceptRequest(requestId, learnerEmail) {
    const tutorEmail = localStorage.getItem('userEmail');
    
    const confirmed = confirm('Accept this connection request? The learner will spend 1 credit when you complete the session.');
    if (!confirmed) return;
    
    try {
        const response = await fetch('http://localhost:3000/accept-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, tutorEmail, learnerEmail })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Connection accepted! You can now message each other.');
            loadPendingRequests();
        } else {
            showToast(data.message || 'Failed to accept request');
        }
    } catch (error) {
        console.error('Error accepting request:', error);
        showToast('Error accepting request');
    }
}

async function rejectRequest(requestId) {
    const confirmed = confirm('Reject this connection request?');
    if (!confirmed) return;
    
    try {
        await fetch('http://localhost:3000/reject-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId })
        });
        showToast('Request rejected');
        loadPendingRequests();
    } catch (error) {
        console.error('Error rejecting request:', error);
        showToast('Error rejecting request');
    }
}

// Make functions global
window.acceptRequest = acceptRequest;
window.rejectRequest = rejectRequest;

// Initialize
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
  loadPendingRequests();  // <-- This loads pending connection requests
  setupLogout();
});