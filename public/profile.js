// ============================================================
// profile.js  — All logic for profile.html
// ============================================================

// ========== MASTER LIST OF ALL ACADEMIC SUBJECTS ==========
const ALL_ACADEMIC_SUBJECTS = [
    // Mathematics
    "Algebra", "Geometry", "Trigonometry", "Calculus", "Statistics", "Probability", 
    "Arithmetic", "Pre-Calculus", "Linear Algebra", "Discrete Mathematics", "Number Theory",
    
    // Sciences
    "Biology", "Chemistry", "Physics", "Earth Science", "Environmental Science", 
    "Astronomy", "Anatomy", "Physiology", "Genetics", "Organic Chemistry", 
    "Biochemistry", "Botany", "Zoology", "Marine Biology", "Ecology",
    
    // Computer Science & Technology
    "Programming", "Python", "Java", "JavaScript", "C++", "HTML/CSS", "SQL", 
    "Data Structures", "Algorithms", "Web Development", "App Development", 
    "Cybersecurity", "Artificial Intelligence", "Machine Learning", "Data Science",
    
    // Language Arts & Literature
    "Reading Comprehension", "Creative Writing", "Essay Writing", "Grammar", 
    "Vocabulary", "Literature Analysis", "Poetry", "Journalism", "Public Speaking",
    "Debate", "English", "Spanish", "French", "German", "Mandarin", "Japanese",
    
    // History & Social Studies
    "World History", "US History", "European History", "Ancient Civilizations",
    "Geography", "Political Science", "Economics", "Sociology", "Psychology",
    "Philosophy", "Anthropology", "Archaeology", "Civics", "Government",
    
    // Business & Finance
    "Accounting", "Finance", "Marketing", "Management", "Entrepreneurship",
    "Business Law", "Microeconomics", "Macroeconomics", "Business Ethics",
    
    // Arts & Humanities
    "Art History", "Visual Arts", "Drawing", "Painting", "Sculpture", "Digital Art",
    "Music Theory", "Music History", "Film Studies", "Theater", "Dance",
    
    // Physical Education & Health
    "Physical Education", "Health Sciences", "Nutrition", "Sports Science",
    "First Aid", "Human Development", "Wellness",
    
    // Study & Academic Skills
    "Research Methods", "Academic Writing", "Critical Thinking", "Problem Solving",
    "Time Management", "Note Taking", "Test Preparation", "Study Strategies",
    "Presentation Skills", "Group Collaboration", "Scientific Writing"
];

// Function to get growth subjects (excludes selected skills)
function getGrowthSubjectsExcludingSkills(selectedSkills) {
    const selectedSkillsLower = selectedSkills.map(s => s.toLowerCase());
    return ALL_ACADEMIC_SUBJECTS.filter(subject => 
        !selectedSkillsLower.includes(subject.toLowerCase())
    );
}

const GRADE_LABELS = {
  elementary:   { icon: "🎒", label: "Elementary",  range: "Grades 1–6" },
  junior_high:  { icon: "📚", label: "Junior High", range: "Grades 7–10" },
  senior_high:  { icon: "🎓", label: "Senior High", range: "Grades 11–12" },
  college:      { icon: "🏛️", label: "College",     range: "Undergraduate" },
  postgrad:     { icon: "🔬", label: "Post-Grad",   range: "Masters / PhD" },
  professional: { icon: "💼", label: "Professional",range: "Working Adult" },
};

// ── State ────────────────────────────────────────────────────
let editSkillsSelected = new Set();
let editGrowthSelected  = new Set();
let editPicData    = null;
let editGradeLevel = '';
let GROWTH_SUGGESTIONS = getGrowthSubjectsExcludingSkills([]);

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

// ── Function to update growth dropdown when skills change ──
function updateGrowthDropdownOptions() {
    const selectedSkills = Array.from(editSkillsSelected);
    const newGrowthSuggestions = getGrowthSubjectsExcludingSkills(selectedSkills);
    
    const currentGrowthSelections = Array.from(editGrowthSelected);
    const validSelections = currentGrowthSelections.filter(item => 
        newGrowthSuggestions.includes(item)
    );
    
    GROWTH_SUGGESTIONS = newGrowthSuggestions;
    
    editGrowthSelected.clear();
    validSelections.forEach(item => editGrowthSelected.add(item));
    
    renderEditOptions('growth', '');
    renderEditTags('growth');
    updateGrowthTriggerLabel();
}

// ── Render VIEW mode ─────────────────────────────────────────
function renderView() {
  const username   = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || 'User';
  const bio        = localStorage.getItem('tandem_bio') || '';
  const pic        = localStorage.getItem('tandem_profile_pic');
  const skillsRaw  = localStorage.getItem('tandem_skills') || '[]';
  const growthRaw  = localStorage.getItem('tandem_growth') || '[]';
  const achievements = localStorage.getItem('tandem_achievements') || 'No achievements yet.';
  let skills = [], growth = [];
  
  try { 
    skills = typeof skillsRaw === 'string' ? JSON.parse(skillsRaw) : skillsRaw; 
    if (typeof skills === 'string') skills = JSON.parse(skills);
  } catch(e) { 
    console.error("Error parsing skills:", e);
    skills = []; 
  }

  try { 
    growth = typeof growthRaw === 'string' ? JSON.parse(growthRaw) : growthRaw;
    if (typeof growth === 'string') growth = JSON.parse(growth);
  } catch(e) { 
    console.error("Error parsing growth:", e);
    growth = []; 
  }

  const pfAvatar = document.getElementById('pfAvatar');
  if (pic) {
    pfAvatar.innerHTML = `<img src="${pic}" alt="Profile Pic">`;
  }
  
  document.getElementById('pfName').textContent   = username.toUpperCase();
  document.getElementById('pfHandle').textContent = '@' + (username.toLowerCase().replace(/\s+/g,'_'));
  document.getElementById('pfBio').textContent    = bio || 'Enter Bio';
  document.getElementById('viewBio').textContent  = bio || 'Edit caption.';

  const skillsEl = document.getElementById('viewSkills');
  skillsEl.innerHTML = skills.length
    ? skills.map(s => `<span class="skill-tag">${s}</span>`).join('')
    : '<span style="color:#bbb;font-size:13px;">No skills added yet.</span>';

  const growthEl = document.getElementById('viewGrowth');
  growthEl.innerHTML = growth.length
    ? growth.map(g => `<span class="skill-tag-growth">${g}</span>`).join('')
    : '<span style="color:#bbb;font-size:13px;">No growth subjects added yet.</span>';

  const gradeKey   = localStorage.getItem('tandem_grade') || '';
  const gradeBadge = document.getElementById('viewGradeBadge');
  const gradeLabel = document.getElementById('viewGradeLabel');
  if (gradeKey && GRADE_LABELS[gradeKey]) {
    const g = GRADE_LABELS[gradeKey];
    gradeBadge.innerHTML = `${g.icon} ${g.label} <span style="opacity:0.7;font-weight:400;">(${g.range})</span>`;
    gradeBadge.style.display = 'inline-flex';
    gradeLabel.textContent = '';
  } else {
    gradeBadge.style.display = 'none';
    gradeLabel.textContent = 'Set your grade level to get better matches.';
  }

  const achievementsEl = document.getElementById('pfAchievements'); 
  if (achievementsEl) {
    achievementsEl.textContent = achievements;
  }
  
  document.getElementById('topCreditsBadge').textContent = getCredits();
}

// ── Render EDIT mode ─────────────────────────────────────────
function renderEdit() {
  const username  = localStorage.getItem('tandem_username') || localStorage.getItem('userName') || '';
  const bio       = localStorage.getItem('tandem_bio') || '';
  const pic       = localStorage.getItem('tandem_profile_pic');
  const skillsRaw = localStorage.getItem('tandem_skills') || '[]';
  const growthRaw = localStorage.getItem('tandem_growth') || '[]';
  const achievements = localStorage.getItem('tandem_achievements') || '';
  let skills = [], growth = [];
  try { skills = JSON.parse(skillsRaw); } catch(e) {}
  try { growth = JSON.parse(growthRaw);  } catch(e) {}

  document.getElementById('editName').value = username;
  document.getElementById('editBio').value  = bio;
  document.getElementById('editHandle').textContent = '@' + (username.toLowerCase().replace(/\s+/g,'_'));
  document.getElementById('editAchievements').value = achievements;

  const editAv = document.getElementById('editAvatar');
  editAv.innerHTML = pic
    ? `<img src="${pic}" alt="Profile Pic">`
    : `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
         <circle cx="30" cy="22" r="13" fill="#a0c4d8"/>
         <ellipse cx="30" cy="52" rx="20" ry="14" fill="#a0c4d8"/>
       </svg>`;

  GROWTH_SUGGESTIONS = getGrowthSubjectsExcludingSkills(skills);
  
  editSkillsSelected = new Set(skills);
  editGrowthSelected  = new Set(growth);
  editPicData = null;
  editGradeLevel = localStorage.getItem('tandem_grade') || '';

  renderEditTags('skills');
  renderEditTags('growth');
  renderEditOptions('skills', '');
  renderEditOptions('growth', '');
  renderGradeCards();
  updateGrowthTriggerLabel();
}

function renderEditOptions(type, search) {
  const suggestions = type === 'skills' ? ALL_ACADEMIC_SUBJECTS : GROWTH_SUGGESTIONS;
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
      
      if (type === 'skills') {
        updateGrowthDropdownOptions();
      }
      
      renderEditOptions(type, search);
      renderEditTags(type);
      if (type === 'growth') updateGrowthTriggerLabel();
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
      
      if (t === 'skills') {
        updateGrowthDropdownOptions();
      } else {
        renderEditOptions(t, '');
        renderEditTags(t);
      }
      
      renderEditOptions(t, '');
      renderEditTags(t);
      if (t === 'growth') updateGrowthTriggerLabel();
    });
  });
}

function renderGradeCards() {
  document.querySelectorAll('.grade-card').forEach(card => {
    const g = card.getAttribute('data-grade');
    card.classList.toggle('selected', g === editGradeLevel);
    card.onclick = () => {
      editGradeLevel = (editGradeLevel === g) ? '' : g;
      renderGradeCards();
    };
  });
  document.getElementById('editGradeLevel').value = editGradeLevel;
}

function updateGrowthTriggerLabel() {
  const placeholder = document.getElementById('editGrowthPlaceholder');
  if (!placeholder) return;
  const count = editGrowthSelected.size;
  if (count === 0) {
    placeholder.innerHTML = 'Select subjects...';
  } else {
    placeholder.innerHTML = `<span class="ef-count-badge">${count}</span> subject${count !== 1 ? 's' : ''} selected`;
  }
}

function setupDropdown(triggerId, dropdownId, searchId, type) {
  const trigger  = document.getElementById(triggerId);
  const dropdown = document.getElementById(dropdownId);
  const search   = document.getElementById(searchId);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
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

async function saveProfile() {
  const name   = document.getElementById('editName').value.trim();
  const bio    = document.getElementById('editBio').value.trim();
  const achievements = document.getElementById('editAchievements').value.trim();
  const skills = Array.from(editSkillsSelected);
  const growth = Array.from(editGrowthSelected);
  const email  = localStorage.getItem('userEmail');

  if (!name) { showToast('Please enter your name.'); return; }

  localStorage.setItem('tandem_username', name);
  localStorage.setItem('tandem_bio', bio);
  localStorage.setItem('tandem_achievements', achievements);
  localStorage.setItem('tandem_skills', JSON.stringify(skills));
  localStorage.setItem('tandem_growth', JSON.stringify(growth));
  localStorage.setItem('tandem_grade', editGradeLevel);
  if (editPicData) localStorage.setItem('tandem_profile_pic', editPicData);
  
  // Mark profile as completed
  if (skills.length > 0 && growth.length > 0 && editGradeLevel) {
    localStorage.setItem('profile_completed', 'true');
  }

  if (email) {
    try {
      const res = await fetch('https://tandem-yq99.onrender.com/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username: name,
          bio,
          achievements,
          skills,
          growth,
          grade_level: editGradeLevel,
          profile_pic: editPicData || localStorage.getItem('tandem_profile_pic') || null
        })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Save failed. Try again.');
        return;
      }
    } catch (err) {
      console.warn('Backend unreachable, saved locally only:', err);
    }
  }

  showToast('Profile updated! ✅');
  switchToView();
}

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

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to log out?')) return;
    const email        = localStorage.getItem('userEmail');
    const credits      = getCredits();
    if (email) {
      try {
        await fetch('https://tandem-yq99.onrender.com/update-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, credits })
        });
      } catch(e) { /* ignore */ }
    }
    setTimeout(() => {
      localStorage.clear();
      window.location.href = 'index.html';
    }, 300);
  });
}

document.addEventListener('DOMContentLoaded', () => {
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

  document.addEventListener('click', () => {
    document.querySelectorAll('.ef-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.ef-select-trigger.open').forEach(t => t.classList.remove('open'));
  });

  setupLogout();
});