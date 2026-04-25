// Encrypt email
function encryptEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 1) return email;
  return local[0] + '*'.repeat(local.length - 1) + '@' + domain;
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

function updateCreditsDisplay(amount) {
  const totalEl = document.getElementById('topCreditsBadge');
  if (totalEl) totalEl.textContent = amount;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast-show');
  setTimeout(() => toast.classList.remove('toast-show'), 3500);
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

// Tinder-style Swipe Matching State
let currentMatches = [];
let currentIndex = 0;
let swipedMentors = JSON.parse(localStorage.getItem('swipedMentors') || '{}');
let allMentorsForList = [];

// View toggle
let currentView = 'swipe';

async function loadSwipeMatches() {
  const email = localStorage.getItem('userEmail');
  if (!email) return;

  const swipeLoading = document.getElementById('swipeLoading');
  const swipeCardContainer = document.getElementById('swipeCardContainer');
  const swipeEmpty = document.getElementById('swipeEmpty');

  if (currentView === 'swipe') {
    swipeLoading.style.display = 'flex';
    swipeCardContainer.style.display = 'none';
    swipeEmpty.style.display = 'none';
  }

  try {
    const response = await fetch('https://tandem-yq99.onrender.com/get-swipe-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (data.success && data.matches && data.matches.length > 0) {
      allMentorsForList = data.matches;
      
      currentMatches = data.matches.filter(mentor => {
        return !swipedMentors[mentor.email];
      });
      
      currentMatches.sort((a, b) => b.matchScore - a.matchScore);
      allMentorsForList.sort((a, b) => b.matchScore - a.matchScore);
      
      if (currentMatches.length > 0 && currentView === 'swipe') {
        currentIndex = 0;
        swipeLoading.style.display = 'none';
        swipeCardContainer.style.display = 'block';
        swipeEmpty.style.display = 'none';
        displayCurrentMatch();
        updateSwipeCounter();
      } else if (currentView === 'swipe') {
        swipeLoading.style.display = 'none';
        swipeCardContainer.style.display = 'none';
        swipeEmpty.style.display = 'flex';
      }
      
      if (currentView === 'list') {
        renderListMentors(allMentorsForList);
      }
    } else {
      if (currentView === 'swipe') {
        swipeLoading.innerHTML = `
          <div class="no-matches">
            <p>✨ No users available at the moment. Check back later!</p>
          </div>
        `;
        swipeLoading.style.display = 'flex';
        swipeCardContainer.style.display = 'none';
        swipeEmpty.style.display = 'none';
      } else {
        renderListMentors([]);
      }
    }
  } catch (error) {
    console.error('Error loading matches:', error);
    if (currentView === 'swipe') {
      swipeLoading.innerHTML = `
        <div class="no-matches">
          <p>Unable to load matches. Please try again later.</p>
        </div>
      `;
    }
  }
}

function displayCurrentMatch() {
  if (currentIndex >= currentMatches.length) {
    showNoMoreMatches();
    return;
  }

  const mentor = currentMatches[currentIndex];
  const swipeCard = document.getElementById('swipeCard');
  
  swipeCard.classList.remove('swipe-left-animation', 'swipe-right-animation');
  void swipeCard.offsetWidth;
  
  const swipeAvatar = document.getElementById('swipeAvatar');
  if (mentor.profile_pic) {
    swipeAvatar.innerHTML = `<img src="${mentor.profile_pic}" alt="${mentor.username || mentor.name}">`;
  } else {
    swipeAvatar.innerHTML = `<svg viewBox="0 0 60 60" fill="none">
      <circle cx="30" cy="22" r="13" fill="#a0c4d8"/>
      <ellipse cx="30" cy="52" rx="20" ry="14" fill="#a0c4d8"/>
    </svg>`;
  }
  
  document.getElementById('swipeName').textContent = mentor.username || mentor.name;
  document.getElementById('swipeBio').textContent = mentor.bio || 'Passionate about helping others learn and grow.';
  
  const skillsHtml = mentor.skills && mentor.skills.length 
    ? mentor.skills.slice(0, 5).map(s => `<span class="skill-tag">${s}</span>`).join('')
    : '<span style="color:#aaa;">No skills listed</span>';
  document.getElementById('swipeSkills').innerHTML = skillsHtml;
  
  const matchPercent = Math.round(mentor.matchScore || 0);
  document.getElementById('swipeMatchBadge').innerHTML = `<span class="match-badge-large">${matchPercent}% Match</span>`;
}

function updateSwipeCounter() {
  const remaining = currentMatches.length - currentIndex;
  document.getElementById('swipeCounter').textContent = remaining;
}

function showNoMoreMatches() {
  const swipeCardContainer = document.getElementById('swipeCardContainer');
  const swipeEmpty = document.getElementById('swipeEmpty');
  
  swipeCardContainer.style.display = 'none';
  swipeEmpty.style.display = 'flex';
}

// SEND CONNECTION REQUEST (instead of auto-connect)
async function swipeRight() {
  if (currentIndex >= currentMatches.length) return;
  
  const mentor = currentMatches[currentIndex];
  const swipeCard = document.getElementById('swipeCard');
  
  const subject = prompt(`What subject would you like to learn from ${mentor.username || mentor.name}?`);
  if (!subject) return;
  
  const message = prompt('Optional: Add a message (e.g., your current level, what you want to focus on)');
  
  const learnerEmail = localStorage.getItem('userEmail');
  const learnerGrade = localStorage.getItem('tandem_grade') || '';
  
  try {
    const response = await fetch('https://tandem-yq99.onrender.com/send-connection-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learnerEmail,
        tutorEmail: mentor.email,
        subject,
        message: message || '',
        learnerGradeLevel: learnerGrade,
        tutorGradeLevel: mentor.grade_level || ''
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(`✅ Connection request sent to ${mentor.username || mentor.name}! They will respond soon.`);
      
      swipedMentors[mentor.email] = 'right';
      localStorage.setItem('swipedMentors', JSON.stringify(swipedMentors));
      
      swipeCard.classList.add('swipe-right-animation');
      
      setTimeout(() => {
        currentIndex++;
        updateSwipeCounter();
        
        if (currentIndex < currentMatches.length) {
          displayCurrentMatch();
        } else {
          showNoMoreMatches();
        }
      }, 300);
    } else {
      showToast(data.message || 'Failed to send request');
    }
  } catch (error) {
    console.error('Error sending request:', error);
    showToast('Error sending request');
  }
}

async function swipeLeft() {
  if (currentIndex >= currentMatches.length) return;
  
  const mentor = currentMatches[currentIndex];
  const swipeCard = document.getElementById('swipeCard');
  
  swipedMentors[mentor.email] = 'left';
  localStorage.setItem('swipedMentors', JSON.stringify(swipedMentors));
  
  swipeCard.classList.add('swipe-left-animation');
  
  setTimeout(() => {
    currentIndex++;
    updateSwipeCounter();
    
    if (currentIndex < currentMatches.length) {
      displayCurrentMatch();
    } else {
      showNoMoreMatches();
    }
  }, 300);
}

// List View Functions
function renderListMentors(mentors) {
  const listLoadingSpinner = document.getElementById('listLoadingSpinner');
  const mentorsGrid = document.getElementById('mentorsGrid');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');

  if (listLoadingSpinner) listLoadingSpinner.style.display = 'none';
  if (mentorsGrid) mentorsGrid.style.display = 'grid';

  let filteredMentors = [...mentors];

  function filterAndSort() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    let results = filteredMentors;

    if (searchTerm) {
      results = results.filter(mentor => 
        (mentor.username && mentor.username.toLowerCase().includes(searchTerm)) ||
        (mentor.name && mentor.name.toLowerCase().includes(searchTerm)) ||
        (mentor.skills && mentor.skills.some(s => s.toLowerCase().includes(searchTerm)))
      );
    }

    const sortBy = sortSelect ? sortSelect.value : 'match';
    if (sortBy === 'match') {
      results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (sortBy === 'rating') {
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'name') {
      results.sort((a, b) => ((a.username || a.name) || '').localeCompare((b.username || b.name) || ''));
    }

    if (mentorsGrid) {
      mentorsGrid.innerHTML = results.map(mentor => `
        <div class="mentor-card">
          <div class="mentor-card-header">
            <div class="mentor-avatar">
              ${mentor.profile_pic ? 
                `<img src="${mentor.profile_pic}" alt="${mentor.username || mentor.name}">` :
                `<svg viewBox="0 0 60 60" fill="none">
                  <circle cx="30" cy="22" r="13" fill="#a0c4d8"/>
                  <ellipse cx="30" cy="52" rx="20" ry="14" fill="#a0c4d8"/>
                </svg>`
              }
            </div>
            <div class="mentor-info">
              <div class="mentor-name">${mentor.username || mentor.name}</div>
              <div class="mentor-rating">
                <span class="rating-star">★</span> ${(mentor.rating || 0).toFixed(1)}
              </div>
              ${mentor.matchScore ? `<div class="match-badge">${Math.round(mentor.matchScore)}% Match</div>` : ''}
            </div>
          </div>
          <div class="mentor-bio">${mentor.bio || 'Ready to learn and help others grow!'}</div>
          <div class="mentor-skills">
            ${mentor.skills && mentor.skills.length ? mentor.skills.slice(0, 5).map(s => `<span class="skill-tag">${s}</span>`).join('') : ''}
          </div>
          <button class="btn-book" onclick="sendConnectionRequest('${mentor.email}', '${mentor.username || mentor.name}', '${mentor.grade_level || ''}')">📚 Request Session</button>
        </div>
      `).join('');
    }
  }

  if (searchInput) searchInput.addEventListener('input', filterAndSort);
  if (sortSelect) sortSelect.addEventListener('change', filterAndSort);
  filterAndSort();
}

// Send connection request from list view
async function sendConnectionRequest(tutorEmail, tutorName, tutorGrade) {
  const credits = getCredits();
  if (credits < 1) {
    showToast('❌ Not enough credits! You need at least 1 credit to request a session.');
    return;
  }

  const subject = prompt(`What would you like to learn from ${tutorName}?`);
  if (!subject) return;
  
  const message = prompt('Add a message for the tutor (optional)');

  const learnerEmail = localStorage.getItem('userEmail');
  const learnerGrade = localStorage.getItem('tandem_grade') || '';

  try {
    const response = await fetch('https://tandem-yq99.onrender.com/send-connection-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learnerEmail,
        tutorEmail,
        subject,
        message: message || '',
        learnerGradeLevel: learnerGrade,
        tutorGradeLevel: tutorGrade
      })
    });

    const data = await response.json();

    if (data.success) {
      showToast(`✅ Connection request sent to ${tutorName}!`);
    } else {
      showToast(data.message || 'Failed to send request.');
    }
  } catch (error) {
    console.error('Error sending request:', error);
    showToast('Error sending request. Please try again.');
  }
}

// Make functions global
window.sendConnectionRequest = sendConnectionRequest;

// Toggle between views
function toggleView() {
  const swipeView = document.getElementById('swipeView');
  const listView = document.getElementById('listView');
  const showListViewBtn = document.getElementById('showListViewBtn');
  
  if (currentView === 'swipe') {
    currentView = 'list';
    swipeView.style.display = 'none';
    listView.style.display = 'block';
    showListViewBtn.innerHTML = '🃏 Swipe View';
    renderListMentors(allMentorsForList);
  } else {
    currentView = 'swipe';
    swipeView.style.display = 'block';
    listView.style.display = 'none';
    showListViewBtn.innerHTML = '📋 List View';
    loadSwipeMatches();
  }
}

// Refresh matches
function refreshMatches() {
  if (confirm('Refresh will reset your swipe history and show you all users again. Continue?')) {
    localStorage.removeItem('swipedMentors');
    swipedMentors = {};
    loadSwipeMatches();
    showToast('🔄 Matches refreshed!');
  }
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
        await fetch('https://tandem-yq99.onrender.com/update-credits', {
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
    }, 300);
  });
}

// Load credits
async function loadCredits() {
  const email = localStorage.getItem('userEmail');
  if (!email) return;
  
  try {
    const response = await fetch('https://tandem-yq99.onrender.com/get-user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('tandem_credits', data.credits || 5);
      updateCreditsDisplay(data.credits || 5);
    }
  } catch (error) {
    console.error('Error loading credits:', error);
  }
}

// Initialize swipe buttons
function initSwipeButtons() {
  const leftBtn = document.getElementById('swipeLeftBtn');
  const rightBtn = document.getElementById('swipeRightBtn');
  const refreshBtn = document.getElementById('refreshMatchesBtn');
  
  if (leftBtn) leftBtn.addEventListener('click', swipeLeft);
  if (rightBtn) rightBtn.addEventListener('click', swipeRight);
  if (refreshBtn) refreshBtn.addEventListener('click', refreshMatches);
  
  document.addEventListener('keydown', (e) => {
    if (currentView === 'swipe') {
      if (e.key === 'ArrowLeft') {
        swipeLeft();
      } else if (e.key === 'ArrowRight') {
        swipeRight();
      }
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    window.location.href = 'index.html';
    return;
  }
  
  if (!checkProfileCompletion()) {
    return;
  }

  await loadCredits();
  updateCreditsDisplay(getCredits());
  setupLogout();
  
  const showListViewBtn = document.getElementById('showListViewBtn');
  if (showListViewBtn) {
    showListViewBtn.addEventListener('click', toggleView);
  }
  
  await loadSwipeMatches();
  initSwipeButtons();
});