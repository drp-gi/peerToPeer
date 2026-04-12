// Profile Picture
const profileInput = document.getElementById("profilePic");
const profileCircle = document.getElementById("profilePicCircle");
let profilePicData = null;

profileCircle.addEventListener("click", () => profileInput.click());

profileInput.addEventListener("change", () => {
    const file = profileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) { height = height * (MAX_SIZE / width); width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width = width * (MAX_SIZE / height); height = MAX_SIZE; }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            profilePicData = canvas.toDataURL('image/jpeg', 0.7);
            profileCircle.innerHTML = `<img src="${profilePicData}" alt="Profile Picture">`;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

// ========== NEW: Multi-select dropdown functionality ==========

// Skills Data
const SKILL_SUGGESTIONS = [
    "Public Speaking", "Leadership", "Time Management", "Confidence Building", "Networking", 
    "Creative Writing", "Content Writing", "Copywriting", "Emotional Intelligence", 
    "Critical Thinking", "Problem Solving", "Decision Making", "Negotiation", "Active Listening", 
    "Communication Skills", "Teamwork", "Collaboration", "Research Skills", "Reading Comprehension", 
    "Note-Taking", "Academic Writing", "Essay Writing", "Analytical Thinking", "Mathematical Reasoning", 
    "Scientific Thinking", "Productivity", "Goal Setting", "Self-Discipline", "Mindfulness", 
    "Adaptability", "Responsibility", "Initiative Taking", "Foreign Language Learning", "Music", 
    "Photography", "Cooking", "Fitness", "Creative Thinking", "Design Thinking", "Content Creation", 
    "JavaScript", "Python", "TypeScript", "Node.js", "React", "HTML & CSS", "SQL", "Git", "Figma", 
    "UI/UX Design", "Graphic Design", "Video Editing", "Photo Editing", "SEO", "Marketing", 
    "Data Analysis", "Excel", "Data Visualization", "Basic AI Literacy", "Exam Preparation", 
    "Memorization Techniques", "Speed Reading", "Class Participation", "Group Project Management", 
    "Homework Planning", "Research Paper Writing", "Thesis Writing", "Laboratory Skills", 
    "Citation (APA/MLA)", "Time Management in Exams"
];

// Growth Areas Data
const GROWTH_SUGGESTIONS = [
    "Procrastination", "Poor Time Management", "Lack of Study Habits", "Easily Distracted", 
    "Short Attention Span", "Overthinking", "Low Confidence", "Public Speaking", 
    "Shyness in Class Participation", "Weak Writing Skills", "Poor Reading Comprehension", 
    "Difficulty Understanding Lessons", "Poor Memory Retention", "Exam Anxiety", 
    "Weak Listening Skills", "Poor Communication Skills", "Difficulty in Group Work", 
    "Avoiding Leadership Roles", "Lack of Initiative", "Peer Pressure Susceptibility", 
    "Overuse of Social Media", "Poor Digital Discipline", "Disorganized Notes and Files", 
    "Inconsistent Academic Performance", "Financial Literacy", "Cooking", "Fitness", 
    "Foreign Language", "Music", "Photography", "Reading"
];

// Class to handle multi-select dropdown
class MultiSelectDropdown {
    constructor(triggerId, optionsId, searchId, listId, containerId, suggestions) {
        this.trigger = document.getElementById(triggerId);
        this.optionsContainer = document.getElementById(optionsId);
        this.searchInput = document.getElementById(searchId);
        this.optionsList = document.getElementById(listId);
        this.tagsContainer = document.getElementById(containerId);
        this.suggestions = suggestions;
        this.selectedItems = new Set();
        this.filteredItems = [...suggestions];
        
        this.init();
    }
    
    init() {
        // Toggle dropdown on trigger click
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeDropdown();
        });
        
        // Prevent closing when clicking inside dropdown
        this.optionsContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.filterOptions(e.target.value);
        });
        
        // Render initial options
        this.renderOptions();
    }
    
    toggleDropdown() {
        const isOpen = this.optionsContainer.classList.contains('open');
        if (isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    openDropdown() {
        // Close all other dropdowns first
        document.querySelectorAll('.custom-options.open').forEach(dropdown => {
            dropdown.classList.remove('open');
        });
        
        this.optionsContainer.classList.add('open');
        this.searchInput.value = '';
        this.filteredItems = [...this.suggestions];
        this.renderOptions();
        this.searchInput.focus();
    }
    
    closeDropdown() {
        this.optionsContainer.classList.remove('open');
    }
    
    filterOptions(searchTerm) {
        const term = searchTerm.toLowerCase();
        this.filteredItems = this.suggestions.filter(item => 
            item.toLowerCase().includes(term)
        );
        this.renderOptions();
    }
    
    renderOptions() {
        if (this.filteredItems.length === 0) {
            this.optionsList.innerHTML = '<div class="no-results">No results found</div>';
            return;
        }
        
        this.optionsList.innerHTML = this.filteredItems.map(item => `
            <div class="option-item ${this.selectedItems.has(item) ? 'selected' : ''}" data-value="${item}">
                <input type="checkbox" ${this.selectedItems.has(item) ? 'checked' : ''}>
                <span>${item}</span>
            </div>
        `).join('');
        
        // Add click handlers to options
        this.optionsList.querySelectorAll('.option-item').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.getAttribute('data-value');
                this.toggleSelection(value);
            });
        });
    }
    
    toggleSelection(value) {
        if (this.selectedItems.has(value)) {
            this.selectedItems.delete(value);
        } else {
            this.selectedItems.add(value);
        }
        this.renderOptions();
        this.renderTags();
    }
    
    renderTags() {
        const selectedArray = Array.from(this.selectedItems);
        
        if (selectedArray.length === 0) {
            this.tagsContainer.innerHTML = '<div class="empty-tags-message">No items selected</div>';
            this.trigger.querySelector('span').textContent = 'Select options...';
            return;
        }
        
        this.trigger.querySelector('span').textContent = `${selectedArray.length} item(s) selected`;
        
        this.tagsContainer.innerHTML = selectedArray.map(item => `
            <div class="tag-item">
                <span>${item}</span>
                <i class="fas fa-times remove-tag" data-value="${item}"></i>
            </div>
        `).join('');
        
        // Add remove functionality to tags
        this.tagsContainer.querySelectorAll('.remove-tag').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = removeBtn.getAttribute('data-value');
                this.selectedItems.delete(value);
                this.renderOptions();
                this.renderTags();
            });
        });
    }
    
    getSelectedItems() {
        return Array.from(this.selectedItems);
    }
}

// Initialize dropdowns
const skillsDropdown = new MultiSelectDropdown(
    'skillsTrigger', 'skillsOptions', 'skillsSearch', 'skillsList', 'skillTags', SKILL_SUGGESTIONS
);

const growthDropdown = new MultiSelectDropdown(
    'growthTrigger', 'growthOptions', 'growthSearch', 'growthList', 'growthTags', GROWTH_SUGGESTIONS
);

// Display name
const userName = localStorage.getItem('userName');
document.getElementById('displayNameText').textContent = userName || 'New User';

// Form submit
document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = localStorage.getItem('userEmail');
    const username = document.getElementById('usernameInput').value.trim();

    // Get selected skills and growth areas from dropdowns
    const skills = skillsDropdown.getSelectedItems();
    const growth = growthDropdown.getSelectedItems();

    if (!username) {
        alert('Please enter a username');
        return;
    }

    if (skills.length === 0) {
        alert('Please select at least one skill');
        return;
    }

    if (growth.length === 0) {
        alert('Please select at least one learning area');
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/complete-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, skills, growth, profile_pic: profilePicData })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('tandem_username', username);
            if (profilePicData) {
                localStorage.setItem('tandem_profile_pic', profilePicData);
            }
            if (localStorage.getItem('tandem_credits') === null) {
                localStorage.setItem('tandem_credits', '5');
            }

            alert('Profile saved! Redirecting to dashboard...');
            window.location.href = 'dashboard.html';
        } else {
            alert(data.message || 'Error saving profile');
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to server');
    }
});

// Add this after initializing the dropdowns
// Handle chevron rotation
document.querySelectorAll('.custom-select-trigger').forEach(trigger => {
    trigger.addEventListener('click', function() {
        this.classList.toggle('open');
    });
});

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-options.open').forEach(dropdown => {
            dropdown.classList.remove('open');
        });
        document.querySelectorAll('.custom-select-trigger.open').forEach(trigger => {
            trigger.classList.remove('open');
        });
    }
});