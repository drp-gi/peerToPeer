const userEmail = localStorage.getItem('userEmail');
if (!userEmail) window.location.href = 'index.html';

function updateCreditsDisplay(amount) {
    document.getElementById('topCreditsBadge').textContent = amount;
}

async function loadCredits() {
    try {
        const response = await fetch('http://localhost:3000/get-user-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await response.json();
        if (data.success) {
            updateCreditsDisplay(data.credits);
        }
    } catch (error) {
        console.error('Error loading credits:', error);
    }
}

// Format date with user's local timezone
function formatLedgerDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString([], { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

async function loadLedger() {
    try {
        const response = await fetch('http://localhost:3000/get-ledger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const data = await response.json();
        
        const container = document.getElementById('ledgerList');
        let totalEarned = 0;
        let totalSpent = 0;
        
        if (data.transactions && data.transactions.length > 0) {
            data.transactions.forEach(t => {
                if (t.to_email === userEmail) totalEarned += t.amount;
                if (t.from_email === userEmail) totalSpent += t.amount;
            });
            
            document.getElementById('totalEarned').textContent = totalEarned;
            document.getElementById('totalSpent').textContent = totalSpent;
            
            container.innerHTML = data.transactions.map(t => {
                const isReceived = t.to_email === userEmail;
                return `
                    <div class="ledger-item ${isReceived ? 'received' : 'sent'}">
                        <div class="ledger-icon">${isReceived ? '📥' : '📤'}</div>
                        <div class="ledger-details">
                            <div class="ledger-title">
                                ${isReceived ? `Received from ${escapeHtml(t.from_name || t.from_username)}` : `Sent to ${escapeHtml(t.to_name || t.to_username)}`}
                            </div>
                            <div class="ledger-type">${t.type === 'session_payment' ? 'Session Payment' : t.type}</div>
                            <div class="ledger-date">${formatLedgerDate(t.created_at)}</div>
                        </div>
                        <div class="ledger-amount ${isReceived ? 'positive' : 'negative'}">
                            ${isReceived ? '+' : '-'}${t.amount} credit${t.amount !== 1 ? 's' : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<div class="empty-state">No transactions yet. Complete a session to see transactions here.</div>';
        }
    } catch (error) {
        console.error('Error loading ledger:', error);
        document.getElementById('ledgerList').innerHTML = '<div class="empty-state">Error loading transactions</div>';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadCredits();
    loadLedger();
    setupLogout();
});