// Profile Picture
const profileInput = document.getElementById("profilePic");
const profileCircle = document.getElementById("profilePicCircle");
let profilePicData = null;

profileCircle.addEventListener("click", () => profileInput.click());




profileInput.addEventListener("change", () => {             //replaced this as im having troubles with profile picture uploading, this is to resize the image before sending to backend, so it can be uploaded and user can proceed to dashboard
    const file = profileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Draw the image onto a small canvas to shrink it
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 300; // resize to max 300x300 pixels
            let width = img.width;
            let height = img.height;

            // Scale down proportionally
            if (width > height) {
                if (width > MAX_SIZE) {
                    height = height * (MAX_SIZE / width);
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width = width * (MAX_SIZE / height);
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert the shrunk image to base64
            profilePicData = canvas.toDataURL('image/jpeg', 0.7); // 0.7 = 70% quality
            profileCircle.innerHTML = `<img src="${profilePicData}" alt="Profile Picture">`;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});  



// Tag Inputs
// Suggestions list for each field
const SKILL_SUGGESTIONS = [
  "Public Speaking", "Leadership", "Time Management", "Confidence Building", "Networking", "Creative Writing", "Content Writing", "Copywriting", 
  "Emotional Intelligence", "Critical Thinking", "Problem Solving", "Decision Making", "Negotiation", "Active Listening", "Communication Skills", 
  "Teamwork", "Collaboration", "Research Skills", "Reading Comprehension", "Note-Taking", "Academic Writing", "Essay Writing", "Analytical Thinking", 
  "Mathematical Reasoning", "Scientific Thinking", "Productivity", "Goal Setting", "Self-Discipline", "Mindfulness", "Adaptability", "Responsibility", 
  "Initiative Taking", "Foreign Language Learning", "Music", "Photography", "Cooking", "Fitness", "Creative Thinking", "Design Thinking", "Content Creation", 
  "JavaScript", "Python", "TypeScript", "Node.js", "React", "HTML & CSS", "SQL", "Git", "Figma", "UI/UX Design", "Graphic Design", "Video Editing", "Photo Editing", 
  "SEO", "Marketing", "Data Analysis", "Excel", "Data Visualization", "Basic AI Literacy", "Exam Preparation", "Memorization Techniques", "Speed Reading", 
  "Class Participation", "Group Project Management", "Homework Planning", "Research Paper Writing", "Thesis Writing", "Laboratory Skills", "Citation (APA/MLA)", 
  "Time Management in Exams"
];

const GROWTH_SUGGESTIONS = [
  "Procrastination", "Poor Time Management", "Lack of Study Habits", "Easily Distracted", "Short Attention Span", "Overthinking", 
  "Low Confidence", "Public Speaking", "Shyness in Class Participation", "Weak Writing Skills", "Poor Reading Comprehension", 
  "Difficulty Understanding Lessons", "Poor Memory Retention", "Exam Anxiety", "Weak Listening Skills", "Poor Communication Skills", "Difficulty in Group Work", 
  "Avoiding Leadership Roles", "Lack of Initiative", "Peer Pressure Susceptibility", "Overuse of Social Media", "Poor Digital Discipline", 
  "Disorganized Notes and Files", "Inconsistent Academic Performance", "Public Speaking", "Leadership", "Time Management", "Confidence",
  "Networking", "Creative Writing", "Emotional Intelligence", "Critical Thinking",
  "Decision Making", "Negotiation", "Active Listening", "Productivity",
  "Goal Setting", "Mindfulness", "Financial Literacy", "Cooking",
  "Fitness", "Foreign Language", "Music", "Photography", "Reading"
];

function setupTagInput(inputId, containerId, suggestions) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);

  // --- Creating a the dropdown div for the dropdown skills 
  const dropdown = document.createElement('div');
  dropdown.className = 'profile-dropdown-ui';       //class name of our div
  input.parentNode.insertBefore(dropdown, input.nextSibling); // we place that new div right after the input field in the page

  let activeIndex = -1;

  function addTag(value) {
    const val = value.trim();
    if (!val) return;
    const tag = document.createElement('div');
    tag.className = 'profile-tag-ui';
    tag.innerHTML = `${val}<span class="profile-tag-remove-ui">&times;</span>`;
    tag.querySelector('span').addEventListener('click', () => tag.remove());
    container.appendChild(tag);
    input.value = '';
    closeDropdown();
  }

  function openDropdown(items) {
    dropdown.innerHTML = '';
    activeIndex = -1;
    if (items.length === 0) { closeDropdown(); return; }
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'profile-dropdown-item-ui';
      div.textContent = item;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault(); // stop blur from firing before click
        addTag(item);
      });
      dropdown.appendChild(div);
    });
    dropdown.style.display = 'block';
  }

  function closeDropdown() {
    dropdown.style.display = 'none';
    activeIndex = -1;
  }

  function updateActive() {
    const items = dropdown.querySelectorAll('.profile-dropdown-item-ui');
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    if (activeIndex >= 0) items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  // Show dropdown as user types
  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    if (!val) { closeDropdown(); return; }
    const matches = suggestions
      .filter(s => s.toLowerCase().includes(val))
      .slice(0, 8);
    openDropdown(matches);
  });

  // Keyboard navigation, this shows dropdown when user types something
  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.profile-dropdown-item-ui');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      updateActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        addTag(items[activeIndex].textContent); // pick highlighted suggestion
      } else {
        addTag(input.value); // or add whatever they typed
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  // Close when user clicks away
  input.addEventListener('blur', () => {
    setTimeout(closeDropdown, 150);
  });
}

// Update your two calls to pass in the suggestions list
setupTagInput('skillInput', 'skillTags', SKILL_SUGGESTIONS);
setupTagInput('growthInput', 'growthTags', GROWTH_SUGGESTIONS);

// Display name
const userName = localStorage.getItem('userName');
document.getElementById('displayNameText').textContent = userName || 'New User';

// Form submit
document.getElementById('profileForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const email = localStorage.getItem('userEmail');
    const username = document.getElementById('usernameInput').value.trim();

    const skills = Array.from(document.querySelectorAll('#skillTags .profile-tag-ui'))
                        .map(tag => tag.textContent.replace('×','').trim());
    const growth = Array.from(document.querySelectorAll('#growthTags .profile-tag-ui'))
                        .map(tag => tag.textContent.replace('×','').trim());

    try{
        const res = await fetch('http://localhost:3000/complete-profile', {
            method:'POST',
            headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify({ email, username, skills, growth, profile_pic: profilePicData })
        });
        const data = await res.json();
        if(data.success){
            alert('Profile saved! Redirecting to dashboard...');
            window.location.href = 'dashboard.html';
        } else alert(data.message || 'Error saving profile');
    } catch(err){
        console.error(err);
        alert('Error connecting to server');
    }
});