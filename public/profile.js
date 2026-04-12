// ============================================================
// profile.js  — All logic for profile.html
// Handles: view mode, edit mode, multi-select dropdowns,
//          saving changes to backend + localStorage, logout
// ============================================================

const SKILL_SUGGESTIONS = [
  "Public Speaking","Leadership","Time Management","Confidence Building","Networking",
  "Creative Writing","Content Writing","Copywriting","Emotional Intelligence","Critical Thinking",
  "Problem Solving","Decision Making","Negotiation","Active Listening","Communication Skills",
  "Teamwork","Collaboration","Research Skills","Reading Comprehension","Note-Taking",
  "Academic Writing","Essay Writing","Analytical Thinking","Mathematical Reasoning","Scientific Thinking",
  "Productivity","Goal Setting","Self-Discipline","Mindfulness","Adaptability","Responsibility",
  "Initiative Taking","Foreign Language Learning","Music","Photography","Cooking","Fitness",
  "Creative Thinking","Design Thinking","Content Creation","JavaScript","Python","TypeScript",
  "Node.js","React","HTML & CSS","SQL","Git","Figma","UI/UX Design","Graphic Design",
  "Video Editing","Photo Editing","SEO","Marketing","Data Analysis","Excel","Data Visualization",
  "Basic AI Literacy","Exam Preparation","Memorization Techniques","Speed Reading",
  "Class Participation","Group Project Management","Homework Planning","Research Paper Writing",
  "Thesis Writing","Laboratory Skills","Citation (APA/MLA)","Time Management in Exams"
];

const GROWTH_SUGGESTIONS = [
  "Procrastination","Poor Time Management","Lack of Study Habits","Easily Distracted",
  "Short Attention Span","Overthinking","Low Confidence","Public Speaking",
  "Shyness in Class Participation","Weak Writing Skills","Poor Reading Comprehension",
  "Difficulty Understanding Lessons","Poor Memory Retention","Exam Anxiety","Weak Listening Skills",
  "Poor Communication Skills","Difficulty in Group Work","Avoiding Leadership Roles",
  "Lack of Initiative","Peer Pressure Susceptibility","Overuse of Social Media",
  "Poor Digital Discipline","Disorganized Notes and Files","Inconsistent Academic Performance",
  "Financial Literacy","Cooking","Fitness","Foreign Language","Music","Photography","Reading"
];

// ── State ────────────────────────────────────────────────────
let editSkillsSelected = new Set();
let editGrowthSelected  = new Set();
let editPicData = null;   // base64 of newly chosen pic, or null

// ── Helpers ──────────────────────────────────────────────────
function encryptEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  return local[0] + '*'.repeat(Math.max(local.length - 1, 1)) + '@' + domain;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('toast-show');
  setTimeout(() => t.classList.remove('toast-show'), 3500);
}

function getCredits() {
  const v = localStorage.getItem('tandem_credits');
  return (v === null || v === 'undefined') ? 5 : parseInt(v, 10);
}

// ── Render VIEW mode ─────────────────────────────────────────
function renderView() {
  const username   = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'User';
  const bio        = localStorage.getItem('tandem_bio') || '';
  const pic        = localStorage.getItem('tandem_profile_pic');
  const skillsRaw  = localStorage.getItem('tandem_skills') || '[]';
  const growthRaw  = localStorage.getItem('tandem_growth') || '[]';
  let skills = [], growth = [];
  try { skills = JSON.parse(skillsRaw); } catch(e) {}
  try { growth = JSON.parse(growthRaw);  } catch(e) {}

  // Avatar in profile card
  const pfAvatar = document.getElementById('pfAvatar');
  if (pic) {
    pfAvatar.innerHTML = `<img src="${pic}" alt="Profile Pic">`;
  }

  document.getElementById('pfName').textContent   = username.toUpperCase();
  document.getElementById('pfHandle').textContent = '@' + (username.toLowerCase().replace(/\s+/g,'_'));
  document.getElementById('pfBio').textContent    = bio || 'Enter Bio';
  document.getElementById('viewBio').textContent  = bio || 'Edit caption.';

  // Skills tags
  const skillsEl = document.getElementById('viewSkills');
  skillsEl.innerHTML = skills.length
    ? skills.map(s => `<span class="skill-tag">${s}</span>`).join('')
    : '<span style="color:#bbb;font-size:13px;">No skills added yet.</span>';

  // Growth tags
  const growthEl = document.getElementById('viewGrowth');
  growthEl.innerHTML = growth.length
    ? growth.map(g => `<span class="skill-tag-growth">${g}</span>`).join('')
    : '<span style="color:#bbb;font-size:13px;">No learning goals added yet.</span>';

  // Credits topbar
  document.getElementById('topCreditsBadge').textContent = getCredits();
}

// ── Render EDIT mode ─────────────────────────────────────────
function renderEdit() {
  const username  = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || '';
  const bio       = localStorage.getItem('tandem_bio') || '';
  const pic       = localStorage.getItem('tandem_profile_pic');
  const skillsRaw = localStorage.getItem('tandem_skills') || '[]';
  const growthRaw = localStorage.getItem('tandem_growth') || '[]';
  let skills = [], growth = [];
  try { skills = JSON.parse(skillsRaw); } catch(e) {}
  try { growth = JSON.parse(growthRaw);  } catch(e) {}

  // Pre-fill form fields
  document.getElementById('editName').value = username;
  document.getElementById('editBio').value  = bio;
  document.getElementById('editHandle').textContent = '@' + (username.toLowerCase().replace(/\s+/g,'_'));

  // Avatar in edit form
  const editAv = document.getElementById('editAvatar');
  editAv.innerHTML = pic
    ? `<img src="${pic}" alt="Profile Pic">`
    : `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
         <circle cx="30" cy="22" r="13" fill="#a0c4d8"/>
         <ellipse cx="30" cy="52" rx="20" ry="14" fill="#a0c4d8"/>
       </svg>`;

  // Pre-load selected sets
  editSkillsSelected = new Set(skills);
  editGrowthSelected  = new Set(growth);
  editPicData = null;

  renderEditTags('skills');
  renderEditTags('growth');
  renderEditOptions('skills', '');
  renderEditOptions('growth', '');
}

// ── Multi-select dropdown helpers ────────────────────────────
function renderEditOptions(type, search) {
  const suggestions = type === 'skills' ? SKILL_SUGGESTIONS : GROWTH_SUGGESTIONS;
  const selected    = type === 'skills' ? editSkillsSelected : editGrowthSelected;
  const listEl      = document.getElementById(type === 'skills' ? 'editSkillsOptions' : 'editGrowthOptions');

  const filtered = search
    ? suggestions.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    : suggestions;

  listEl.innerHTML = filtered.map(item => `
    <div class="ef-option ${selected.has(item) ? 'selected' : ''}" data-value="${item}">
      ${item}
    </div>
  `).join('');

  listEl.querySelectorAll('.ef-option').forEach(el => {
    el.addEventListener('click', () => {
      const val = el.getAttribute('data-value');
      if (selected.has(val)) selected.delete(val);
      else selected.add(val);
      renderEditOptions(type, search);
      renderEditTags(type);
    });
  });
}

function renderEditTags(type) {
  const selected = type === 'skills' ? editSkillsSelected : editGrowthSelected;
  const tagsEl   = document.getElementById(type === 'skills' ? 'editSkillsTags' : 'editGrowthTags');

  tagsEl.innerHTML = Array.from(selected).map(item => `
    <span class="ef-tag">
      ${item}
      <span class="ef-tag-x" data-value="${item}" data-type="${type}">&times;</span>
    </span>
  `).join('');

  tagsEl.querySelectorAll('.ef-tag-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const val  = btn.getAttribute('data-value');
      const t    = btn.getAttribute('data-type');
      const sel  = t === 'skills' ? editSkillsSelected : editGrowthSelected;
      sel.delete(val);
      renderEditOptions(t, '');
      renderEditTags(t);
    });
  });
}

function setupDropdown(triggerId, dropdownId, searchId, type) {
  const trigger  = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  const search   = document.getElementById(searchId);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    // Close all other dropdowns
    document.querySelectorAll('.ef-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.ef-select-trigger.open').forEach(t => t.classList.remove('open'));
    if (!isOpen) {
      dropdown.classList.add('open');
      trigger.classList.add('open');
      search.value = '';
      renderEditOptions(type, '');
      search.focus();
    }
  });

  search.addEventListener('input', () => {
    renderEditOptions(type, search.value);
  });

  dropdown.addEventListener('click', e => e.stopPropagation());
}

// ── Profile picture upload in edit mode ─────────────────────
function setupEditPicUpload() {
  const editAv    = document.getElementById('editAvatar');
  const picInput  = document.getElementById('editPicInput');

  editAv.addEventListener('click', () => picInput.click());

  picInput.addEventListener('change', () => {
    const file = picInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 300;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = h * (MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = w * (MAX / h); h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        editPicData = canvas.toDataURL('image/jpeg', 0.7);
        editAv.innerHTML = `<img src="${editPicData}" alt="Profile Pic">`;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Save changes ─────────────────────────────────────────────
async function saveProfile() {
  const name   = document.getElementById('editName').value.trim();
  const bio    = document.getElementById('editBio').value.trim();
  const skills = Array.from(editSkillsSelected);
  const growth = Array.from(editGrowthSelected);
  const email  = localStorage.getItem('userEmail');

  if (!name) { showToast('Please enter your name.'); return; }

  // Update localStorage immediately
  localStorage.setItem('tandem_username', name);
  localStorage.setItem('tandem_bio', bio);
  localStorage.setItem('tandem_skills', JSON.stringify(skills));
  localStorage.setItem('tandem_growth', JSON.stringify(growth));
  if (editPicData) localStorage.setItem('tandem_profile_pic', editPicData);

  // Persist to backend
  if (email) {
    try {
      const res = await fetch('http://localhost:3000/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username: name,
          skills,
          growth,
          profile_pic: editPicData || localStorage.getItem('tandem_profile_pic') || null
        })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Save failed. Try again.');
        return;
      }
    } catch (err) {
      // Backend offline — still saved locally
      console.warn('Backend unreachable, saved locally only:', err);
    }
  }

  showToast('Profile updated! ✅');
  switchToView();
}

// ── Toggle view / edit ───────────────────────────────────────
function switchToEdit() {
  document.getElementById('viewMode').style.display = 'none';
  document.getElementById('editMode').style.display = 'block';
  renderEdit();
}
function switchToView() {
  document.getElementById('editMode').style.display = 'none';
  document.getElementById('viewMode').style.display = 'block';
  renderView();
}

// ── Logout ───────────────────────────────────────────────────
function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to log out?')) return;
    const email        = localStorage.getItem('userEmail');
    const credits      = getCredits();
    const lastLogin    = localStorage.getItem('tandem_last_login_date') || '';
    if (email) {
      try {
        await fetch('http://localhost:3000/update-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, credits, last_login_date: lastLogin })
        });
      } catch(e) { /* ignore */ }
    }
    setTimeout(() => {
      localStorage.clear();
      window.location.href = 'index.html';
    }, 300);
  });
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Guard: redirect if not logged in
  if (!localStorage.getItem('userEmail')) {
    window.location.href = 'index.html';
    return;
  }

  renderView();
  setupEditPicUpload();
  setupDropdown('editSkillsTrigger', 'editSkillsDropdown', 'editSkillsSearch', 'skills');
  setupDropdown('editGrowthTrigger', 'editGrowthDropdown', 'editGrowthSearch', 'growth');

  document.getElementById('editBtn').addEventListener('click', switchToEdit);
  document.getElementById('cancelEditBtn').addEventListener('click', switchToView);
  document.getElementById('saveEditBtn').addEventListener('click', saveProfile);

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.ef-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.ef-select-trigger.open').forEach(t => t.classList.remove('open'));
  });

  setupLogout();
});