/**
 * credit-sync.js
 * Include on EVERY page after socket.io.js.
 * Keeps the topbar credits badge in sync via Socket.io + 15s polling fallback.
 * No animation — plain number update only.
 */
(function () {
  'use strict';

  const API = 'http://localhost:3000';

  function updateBadge(amount) {
    const badge = document.getElementById('topCreditsBadge');
    if (badge) badge.textContent = amount;
    localStorage.setItem('tandem_credits', String(amount));
  }

  async function pollCredits() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    try {
      const res  = await fetch(`${API}/get-user-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) updateBadge(data.credits);
    } catch(e) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    const email = localStorage.getItem('userEmail');
    if (!email) return;

    // Set from cache immediately
    const cached = localStorage.getItem('tandem_credits');
    if (cached) updateBadge(parseFloat(cached));

    // Then fetch accurate value
    pollCredits();
    setInterval(pollCredits, 15000);

    // Real-time via Socket.io if loaded on this page
    const socketSrc = document.querySelector('script[src*="socket.io"]');
    if (socketSrc) {
      const checkSocket = setInterval(() => {
        if (typeof io !== 'undefined') {
          clearInterval(checkSocket);
          const socket = io(API);
          socket.on('connect', () => socket.emit('register-user', { email }));
          socket.on('credits-updated', ({ credits }) => updateBadge(credits));
        }
      }, 200);
    }
  });

  // Sync across browser tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'tandem_credits' && e.newValue) updateBadge(parseFloat(e.newValue));
  });

  window.syncCredits       = pollCredits;
  window.updateCreditBadge = updateBadge;
})();