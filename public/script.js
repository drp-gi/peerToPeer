// ELEMENTS
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const getStartedBtn = document.getElementById('getStartedBtn');  //register
const loginBtn = document.getElementById('loginBtn');               //login
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






// =========================================
//Update your script.js to POST data to backend, meaning when user inputs
// their name,email, password on register it WILL add data to backend
// =========================================


// REGISTER
    registerForm.onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const res = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        console.log("Server response:", data); // 🔹 DEBUG

        if (data.success) {
            alert('Registered successfully!');
            authModal.style.display = 'none';

            // store user info for the profile page
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userName', name);

            // redirect to profile page
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
                    const res = await fetch('http://localhost:3000/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
          });

            const data = await res.json();
            if(data.success){
                alert(`Welcome back, ${data.name}!`);
                authModal.style.display = 'none';
                // redirect to dashboard or store user session here
            } else {
            alert(`❌ ${data.message || 'Login failed'}`);
            }

            } catch(err) {
                console.error(err);
                alert('❌ Error connecting to server');
            }
        };
