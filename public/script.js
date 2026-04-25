// ELEMENTS
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const getStartedBtn = document.getElementById('getStartedBtn');
const loginBtn = document.getElementById('loginBtn');
const closeBtn = document.querySelector('.close');      

// SHOW REGISTER FORM
getStartedBtn.onclick = () => {
    authModal.style.display = 'flex';
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
};

// SHOW LOGIN FORM
loginBtn.onclick = () => {
    authModal.style.display = 'flex';
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
};

// CLOSE MODAL
closeBtn.onclick = () => {
    authModal.style.display = 'none';
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
};

// REGISTER
registerForm.onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const res = await fetch('https://tandem-yq99.onrender.com/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        if (data.success) {
            alert('Registered successfully!');
            authModal.style.display = 'none';

            localStorage.setItem('userEmail', email);
            localStorage.setItem('userName', name);

            window.location.href = 'complete-profile.html';
        } else {
            alert(`❌ ${data.message || 'Registration failed'}`);
        }

    } catch (err) {
        console.error("Error connecting to server:", err);
        alert('❌ Error connecting to server');
    }
};

// LOGIN
loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('https://tandem-yq99.onrender.com/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        
        if (data.success) {
            localStorage.clear();
            
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userName', data.name);
            localStorage.setItem('tandem_username', data.username || '');
            localStorage.setItem('tandem_bio', data.bio || '');
            localStorage.setItem('tandem_achievements', data.achievements || '');
            localStorage.setItem('tandem_skills', data.skills || '[]');
            localStorage.setItem('tandem_growth', data.growth || '[]');
            
            const creditsFromDB = data.credits || 5;
            localStorage.setItem('tandem_credits', creditsFromDB);
            
            if (data.profile_pic) {
                localStorage.setItem('tandem_profile_pic', data.profile_pic);
            }
            if (data.grade_level) {
                localStorage.setItem('tandem_grade', data.grade_level);
            }
            
            // Check if profile is completed
            const hasSkills = data.skills && JSON.parse(data.skills || '[]').length > 0;
            const hasGrowth = data.growth && JSON.parse(data.growth || '[]').length > 0;
            const hasGrade = data.grade_level;
            
            if (hasSkills && hasGrowth && hasGrade) {
                localStorage.setItem('profile_completed', 'true');
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'complete-profile.html';
            }
        } else {
            alert(`❌ ${data.message || 'Login failed'}`);
        }

    } catch(err) {
        console.error(err);
        alert('❌ Error connecting to server');
    }
};