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

// Update credits in localStorage AND database
async function setCredits(amount) {
  console.log('Setting credits to:', amount);
  localStorage.setItem('tandem_credits', String(amount));
  updateCreditsDisplay(amount);
  
  // Save to backend immediately when credits change
  const email = localStorage.getItem('userEmail');
  if (email) {
    try {
      const response = await fetch('http://localhost:3000/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          credits: amount, 
          last_login_date: localStorage.getItem('tandem_last_login_date') || '' 
        })
      });
      const data = await response.json();
      if (data.success) {
        console.log('✅ Credits saved to database:', amount);
      } else {
        console.error('Failed to save credits to database');
      }
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

// Daily login system
const REWARD_MAP = { 0: 5, 1: 1, 2: 2, 3: 1, 4: 2, 5: 1, 6: 2 };

function getTodayPH() {
  const now = new Date();
  const phDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const phDayIndex = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
  ).getDay();
  return { dateStr: phDateStr, dayIndex: phDayIndex };
}

function setupDailyLogin() {
  const { dateStr, dayIndex } = getTodayPH();
  const lastClaimed = localStorage.getItem('tandem_last_login_date');
  const alreadyClaimed = (lastClaimed === dateStr);

  const todayReward = REWARD_MAP[dayIndex];
  const todayCreditsEl = document.getElementById('todayRewardAmount');
  if (todayCreditsEl) todayCreditsEl.textContent = todayReward;

  const dayCards = document.querySelectorAll('.day-card');
  dayCards.forEach(card => {
    const cardDay = parseInt(card.getAttribute('data-day'), 10);

    if (cardDay === dayIndex) {
      card.classList.add('day-today');
      if (alreadyClaimed) {
        card.classList.add('day-claimed');
      }
    }

    if (cardDay === dayIndex && !alreadyClaimed) {
      card.classList.add('day-clickable');
      card.addEventListener('click', () => claimDailyLogin(dateStr, todayReward));
    } else if (alreadyClaimed && cardDay === dayIndex) {
      card.title = 'Already claimed today!';
    }
  });
}

async function claimDailyLogin(dateStr, reward) {
  console.log('Claiming daily login - Reward:', reward);
  const current = getCredits();
  const newTotal = current + reward;
  console.log(`Current credits: ${current}, New total: ${newTotal}`);
  
  await setCredits(newTotal);
  localStorage.setItem('tandem_last_login_date', dateStr);
  
  // Also save the last_login_date to database
  const email = localStorage.getItem('userEmail');
  if (email) {
    try {
      await fetch('http://localhost:3000/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          credits: newTotal, 
          last_login_date: dateStr 
        })
      });
    } catch(err) {
      console.error('Error saving last login date:', err);
    }
  }

  const todayCard = document.querySelector('.day-card.day-today');
  if (todayCard) {
    todayCard.classList.add('day-claimed');
    todayCard.classList.remove('day-clickable');
  }

  showToast(`+${reward} credit${reward > 1 ? 's' : ''} added! Total: ${newTotal} credits 🎉`);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast-show');
  setTimeout(() => toast.classList.remove('toast-show'), 3500);
}

// Logout - saves credits to database before clearing session
async function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async () => {
    const confirmed = confirm('Are you sure you want to log out?');
    if (!confirmed) return;

    const email = localStorage.getItem('userEmail');
    const currentCredits = getCredits();
    const lastLoginDate = localStorage.getItem('tandem_last_login_date');
    
    console.log('Logging out - Final credits to save:', currentCredits);
    
    // Save credits to database before logout
    if (email && currentCredits) {
      try {
        const response = await fetch('http://localhost:3000/update-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email, 
            credits: currentCredits, 
            last_login_date: lastLoginDate || '' 
          })
        });
        const data = await response.json();
        if (data.success) {
          console.log('✅ Credits saved successfully before logout');
        }
      } catch(err) {
        console.error('Error saving credits:', err);
      }
    }
    
    // Small delay to ensure database update completes
    setTimeout(() => {
      localStorage.clear();
      window.location.href = 'index.html';
    }, 500);
  });
}

// Load credits from database on page load
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
      console.log('📥 Loading credits from database:', dbCredits);
      localStorage.setItem('tandem_credits', dbCredits);
      localStorage.setItem('tandem_last_login_date', data.last_login_date || '');
      updateCreditsDisplay(dbCredits);
      return true;
    }
  } catch (error) {
    console.error('Error loading credits:', error);
  }
  return false;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    window.location.href = 'index.html';
    return;
  }
  
  console.log('Dashboard loading for user:', userEmail);
  
  // Load credits from database first
  await loadCreditsFromDatabase();
  
  loadUserInfo();
  const credits = getCredits();
  console.log('Final credits displayed:', credits);
  updateCreditsDisplay(credits);
  setupDailyLogin();
  setupLogout();
});