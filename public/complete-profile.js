// Profile Picture
const profileInput = document.getElementById("profilePic");
const profileCircle = document.getElementById("profilePicCircle");
let profilePicData = null;

profileCircle.addEventListener("click", () => profileInput.click());

profileInput.addEventListener("change", () => {
    const file = profileInput.files[0];
    if(file){
        const reader = new FileReader();
        reader.onload = (e) => {
            profileCircle.innerHTML = `<img src="${e.target.result}" alt="Profile Picture">`;
            profilePicData = e.target.result;
        }
        reader.readAsDataURL(file);
    }
});

// Tag Inputs
function setupTagInput(inputId, containerId){
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    input.addEventListener("keypress", e=>{
        if(e.key==="Enter"){
            e.preventDefault();
            const val = input.value.trim();
            if(val){
                const tag = document.createElement("div");
                tag.className = "profile-tag-ui";
                tag.innerHTML = `${val}<span class="profile-tag-remove-ui">&times;</span>`;
                tag.querySelector("span").addEventListener("click", ()=>tag.remove());
                container.appendChild(tag);
                input.value = "";
            }
        }
    });
}

setupTagInput("skillInput", "skillTags");
setupTagInput("growthInput", "growthTags");

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