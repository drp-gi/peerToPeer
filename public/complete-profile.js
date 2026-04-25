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
function getGrowthSubjects(selectedSkills) {
    const selectedSkillsLower = selectedSkills.map(s => s.toLowerCase());
    return ALL_ACADEMIC_SUBJECTS.filter(subject => 
        !selectedSkillsLower.includes(subject.toLowerCase())
    );
}

// Class to handle multi-select dropdown
class MultiSelectDropdown {
    constructor(triggerId, optionsId, searchId, listId, containerId, suggestions, isGrowth = false, onSkillsChange = null) {
        this.trigger = document.getElementById(triggerId);
        this.optionsContainer = document.getElementById(optionsId);
        this.searchInput = document.getElementById(searchId);
        this.optionsList = document.getElementById(listId);
        this.tagsContainer = document.getElementById(containerId);
        this.allSuggestions = [...suggestions];
        this.suggestions = [...suggestions];
        this.isGrowth = isGrowth;
        this.onSkillsChange = onSkillsChange;
        this.selectedItems = new Set();
        this.filteredItems = [...this.suggestions];
        
        this.init();
    }
    
    init() {
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        document.addEventListener('click', () => {
            this.closeDropdown();
        });
        
        this.optionsContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        this.searchInput.addEventListener('input', (e) => {
            this.filterOptions(e.target.value);
        });
        
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
        
        if (!this.isGrowth && this.onSkillsChange) {
            this.onSkillsChange(Array.from(this.selectedItems));
        }
    }
    
    renderTags() {
        const selectedArray = Array.from(this.selectedItems);
        
        if (selectedArray.length === 0) {
            this.tagsContainer.innerHTML = '<div class="empty-tags-message">No items selected</div>';
            this.trigger.querySelector('span').textContent = this.isGrowth ? 'Select Learning Areas...' : 'Select Skills...';
            return;
        }
        
        this.trigger.querySelector('span').textContent = `${selectedArray.length} item(s) selected`;
        
        this.tagsContainer.innerHTML = selectedArray.map(item => `
            <div class="tag-item">
                <span>${item}</span>
                <i class="fas fa-times remove-tag" data-value="${item}"></i>
            </div>
        `).join('');
        
        this.tagsContainer.querySelectorAll('.remove-tag').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = removeBtn.getAttribute('data-value');
                this.selectedItems.delete(value);
                this.renderOptions();
                this.renderTags();
                
                if (!this.isGrowth && this.onSkillsChange) {
                    this.onSkillsChange(Array.from(this.selectedItems));
                }
            });
        });
    }
    
    getSelectedItems() {
        return Array.from(this.selectedItems);
    }
    
    updateSuggestions(newSuggestions) {
        this.suggestions = [...newSuggestions];
        this.filteredItems = [...newSuggestions];
        const validSelected = Array.from(this.selectedItems).filter(item => 
            newSuggestions.includes(item)
        );
        this.selectedItems.clear();
        validSelected.forEach(item => this.selectedItems.add(item));
        this.renderOptions();
        this.renderTags();
    }
}

// Initialize dropdowns
let skillsDropdown, growthDropdown;

function updateGrowthSuggestions(selectedSkills) {
    const newGrowthSuggestions = getGrowthSubjects(selectedSkills);
    if (growthDropdown) {
        growthDropdown.updateSuggestions(newGrowthSuggestions);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    skillsDropdown = new MultiSelectDropdown(
        'skillsTrigger', 'skillsOptions', 'skillsSearch', 'skillsList', 'skillTags', 
        ALL_ACADEMIC_SUBJECTS, false, updateGrowthSuggestions
    );
    
    growthDropdown = new MultiSelectDropdown(
        'growthTrigger', 'growthOptions', 'growthSearch', 'growthList', 'growthTags', 
        ALL_ACADEMIC_SUBJECTS, true, null
    );
});

const userName = localStorage.getItem('userName');
document.getElementById('displayNameText').textContent = userName || 'New User';

document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = localStorage.getItem('userEmail');
    const username = document.getElementById('usernameInput').value.trim();
    const gradeLevel = document.getElementById('gradeLevelSelect').value;

    const skills = skillsDropdown.getSelectedItems();
    const growth = growthDropdown.getSelectedItems();

    if (!username) {
        alert('Please enter a username');
        return;
    }

    if (!gradeLevel) {
        alert('Please select your grade level');
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
        const res = await fetch('https://tandem-yq99.onrender.com/complete-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email, 
                username, 
                skills, 
                growth, 
                grade_level: gradeLevel,
                profile_pic: profilePicData 
            })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('tandem_username', username);
            localStorage.setItem('tandem_grade', gradeLevel);
            localStorage.setItem('tandem_skills', JSON.stringify(skills));
            localStorage.setItem('tandem_growth', JSON.stringify(growth));
            if (profilePicData) {
                localStorage.setItem('tandem_profile_pic', profilePicData);
            }
            if (localStorage.getItem('tandem_credits') === null) {
                localStorage.setItem('tandem_credits', '5');
            }
            
            // Mark profile as completed
            localStorage.setItem('profile_completed', 'true');

            alert('Profile completed! Redirecting to dashboard...');
            window.location.href = 'dashboard.html';
        } else {
            alert(data.message || 'Error saving profile');
        }
    } catch (err) {
        console.error(err);
        alert('Error connecting to server');
    }
});

document.querySelectorAll('.custom-select-trigger').forEach(trigger => {
    trigger.addEventListener('click', function() {
        this.classList.toggle('open');
    });
});

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