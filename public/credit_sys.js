// Initialize System
if (!localStorage.getItem('studyCredits')) {
    localStorage.setItem('studyCredits', '10');
}
if (!localStorage.getItem('sessionStatus')) {
    localStorage.setItem('sessionStatus', 'inactive'); // inactive, pending, or active
}

function getCredits() {
    return parseInt(localStorage.getItem('studyCredits'));
}

function getStatus() {
    return localStorage.getItem('sessionStatus');
}

function updateSystem(credits, status) {
    if (credits !== null) localStorage.setItem('studyCredits', credits);
    if (status !== null) localStorage.setItem('sessionStatus', status);
    
    // Manually trigger render for the current tab
    renderUI();
}

// This is the "Magic" - It listens for changes made in OTHER tabs
window.addEventListener('storage', (event) => {
    renderUI();
});

// Run on load
window.onload = renderUI;