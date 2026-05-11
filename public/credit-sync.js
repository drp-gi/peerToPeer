/**
 * credit-sync.js  — v2 (bugfix)
 * Include on EVERY page after socket.io.js.
 * Single source of truth for credits. Keeps ALL credit elements in sync.
 *
 * Fixes:
 *  - Uses Math.round() instead of parseFloat() to prevent decimal display
 *  - Updates EVERY credits element on the page (topCreditsBadge, totalCredits,
 *    creditBannerVal) so dashboard dual-display never drifts
 *  - Guards against missing elements gracefully
 *  - Exposes window.syncCredits and window.updateCreditBadge for other scripts
 */
(function () {
  'use strict';

  const API = '';

  function updateAllCreditDisplays(amount) {
    const rounded = Math.round(Number(amount));

    // Topbar badge (all pages)
    const badge = document.getElementById('topCreditsBadge');
    if (badge) badge.textContent = rounded;

    // Dashboard "X Credits" line under profile header
    const totalEl = document.getElementById('totalCredits');
    if (totalEl) totalEl.textContent = rounded;

    // Quests page banner
    const bannerVal = document.getElementById('creditBannerVal');
    if (bannerVal) bannerVal.textContent = `${rounded} credit${rounded !== 1 ? 's' : ''}`;

    // Persist to localStorage
    localStorage.setItem('tandem_credits', String(rounded));
  }

  async function pollCredits() {
    const email = localStorage.getItem('userEmail');
    if (!email) return;
    try {
      const res = await fetch(`${API}/get-user-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) updateAllCreditDisplays(data.credits);
    } catch (e) { /* network hiccup — keep showing cached value */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const email = localStorage.getItem('userEmail');
    if (!email) return;

    // Show cached value immediately so the UI isn't blank
    const cached = localStorage.getItem('tandem_credits');
    if (cached !== null) updateAllCreditDisplays(cached);

    // Then fetch the accurate server value
    pollCredits();

    // Poll every 15 s as fallback
    setInterval(pollCredits, 15000);

    // Real-time via Socket.io if the page loaded the socket script
    const socketSrc = document.querySelector('script[src*="socket.io"]');
    if (socketSrc) {
      const checkSocket = setInterval(() => {
        if (typeof io !== 'undefined') {
          clearInterval(checkSocket);
          const socket = io(API);
          socket.on('connect', () => socket.emit('register-user', { email }));
          socket.on('credits-updated', ({ credits }) => updateAllCreditDisplays(credits));
        }
      }, 200);
    }
  });

  // Sync credits when another tab changes localStorage
  window.addEventListener('storage', (e) => {
    if (e.key === 'tandem_credits' && e.newValue !== null) {
      updateAllCreditDisplays(e.newValue);
    }
  });

  // Public API used by other scripts
  window.syncCredits       = pollCredits;
  window.updateCreditBadge = updateAllCreditDisplays;
})();
