/**
 * rating-modal.js
 * Drop-in enhanced session rating + structured feedback system.
 * Include on any page that has sessions (messages.html, calendar.html, video-call.html).
 * 
 * Usage:
 *   showRatingModal({ sessionId, tutorName, subject, onSubmit })
 *   onSubmit receives: { rating, feedback, feedbackTags }
 */

(function () {
  'use strict';

  const POSITIVE_TAGS = [
    { label: '✨ Clear explanation',  value: 'clear explanation' },
    { label: '😊 Patient & kind',     value: 'patient' },
    { label: '🧠 Very knowledgeable', value: 'knowledgeable' },
    { label: '🎯 Engaging sessions',  value: 'engaging' },
    { label: '🙌 Super helpful',      value: 'helpful' },
    { label: '⏰ Always on time',     value: 'punctual' },
    { label: '📈 Improved my skills', value: 'improved_skills' },
  ];
  const NEGATIVE_TAGS = [
    { label: '😕 Hard to understand', value: 'hard_to_understand' },
    { label: '🕐 Often late',         value: 'often_late' },
    { label: '📵 Ended early',        value: 'ended_early' },
    { label: '🤷 Not well-prepared',  value: 'not_prepared' },
  ];

  function injectModal() {
    if (document.getElementById('tandemRatingOverlay')) return; // already injected
    const html = `
      <div id="tandemRatingOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:20px;">
        <div id="tandemRatingBox" style="background:#fff;border-radius:20px;width:100%;max-width:440px;overflow:hidden;font-family:'Baloo 2',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.2);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#29b6d8,#1fa0be);padding:20px 24px;color:#fff;">
            <div style="font-size:20px;font-weight:700;margin-bottom:2px;">Rate Your Session 🌟</div>
            <div style="font-size:13px;opacity:.85;" id="ratingModalMeta"></div>
          </div>

          <!-- Body -->
          <div style="padding:20px 24px;">

            <!-- Stars -->
            <div style="margin-bottom:16px;">
              <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:8px;">How would you rate this session?</div>
              <div id="ratingStarsRow" style="display:flex;gap:8px;">
                ${[1,2,3,4,5].map(i => `
                  <span data-val="${i}" onclick="tandemSetRating(${i})" style="font-size:36px;cursor:pointer;color:#ddd;transition:transform .15s,color .15s;line-height:1;">★</span>
                `).join('')}
              </div>
              <div id="ratingLabel" style="font-size:12px;color:#aaa;margin-top:6px;height:16px;"></div>
            </div>

            <!-- Feedback tags -->
            <div id="feedbackTagSection" style="margin-bottom:16px;display:none;">
              <div id="posTagsLabel" style="font-size:13px;font-weight:700;color:#333;margin-bottom:8px;">What went well?</div>
              <div id="positiveTags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>
              <div id="negTagsLabel" style="font-size:13px;font-weight:700;color:#333;margin-bottom:8px;">Anything to improve?</div>
              <div id="negativeTags" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
            </div>

            <!-- Written feedback -->
            <div style="margin-bottom:16px;">
              <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:6px;">Leave a note for the mentor (optional)</div>
              <textarea id="ratingFeedbackText" rows="3" placeholder="Share what helped you most, or any suggestions…"
                style="width:100%;padding:10px 12px;border:1.5px solid #e0e4ea;border-radius:10px;font-size:13px;font-family:'Open Sans',sans-serif;resize:vertical;outline:none;box-sizing:border-box;transition:border-color .2s;"></textarea>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:10px;">
              <button onclick="tandemSkipRating()" style="flex:1;padding:11px;border:1.5px solid #e0e4ea;border-radius:10px;background:#fff;color:#778899;font-size:14px;font-weight:600;cursor:pointer;font-family:'Baloo 2',sans-serif;">
                Skip
              </button>
              <button onclick="tandemSubmitRating()" id="submitRatingBtn" style="flex:2;padding:11px;border:none;border-radius:10px;background:linear-gradient(135deg,#29b6d8,#1fa0be);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Baloo 2',sans-serif;box-shadow:0 4px 14px rgba(41,182,216,.3);">
                Submit Rating
              </button>
            </div>
          </div>

        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('ratingFeedbackText').addEventListener('focus', function() { this.style.borderColor = '#29b6d8'; });
    document.getElementById('ratingFeedbackText').addEventListener('blur', function() { this.style.borderColor = '#e0e4ea'; });
  }

  const RATING_LABELS = ['', 'Needs improvement', 'Below average', 'Average', 'Good', 'Excellent! ⭐'];
  let currentRating = 0;
  let selectedTags = new Set();
  let _onSubmit = null;
  let _onSkip = null;

  window.tandemSetRating = function(val) {
    currentRating = val;
    const stars = document.querySelectorAll('#ratingStarsRow span');
    stars.forEach((s, i) => {
      s.style.color = i < val ? '#f5a623' : '#ddd';
      s.style.transform = i < val ? 'scale(1.1)' : 'scale(1)';
    });
    document.getElementById('ratingLabel').textContent = RATING_LABELS[val] || '';
    // Show tag section after any rating
    const tagSection = document.getElementById('feedbackTagSection');
    if (tagSection) tagSection.style.display = 'block';
  };

  function renderTags() {
    function makeTags(containerId, tags) {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = tags.map(t => `
        <span onclick="tandemToggleTag('${t.value}', this)"
              style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;
                     cursor:pointer;border:1.5px solid #e0e4ea;background:#f7f9fc;color:#445566;
                     transition:all .15s;" data-val="${t.value}">
          ${t.label}
        </span>`).join('');
    }
    makeTags('positiveTags', POSITIVE_TAGS);
    makeTags('negativeTags', NEGATIVE_TAGS);
  }

  window.tandemToggleTag = function(val, el) {
    if (selectedTags.has(val)) {
      selectedTags.delete(val);
      el.style.background = '#f7f9fc'; el.style.color = '#445566'; el.style.borderColor = '#e0e4ea';
    } else {
      selectedTags.add(val);
      el.style.background = '#29b6d8'; el.style.color = '#fff'; el.style.borderColor = '#29b6d8';
    }
  };

  window.tandemSubmitRating = function() {
    const feedback = document.getElementById('ratingFeedbackText')?.value.trim() || '';
    const tags = [...selectedTags];
    if (_onSubmit) _onSubmit({ rating: currentRating || null, feedback, feedbackTags: tags });
    closeModal();
  };

  window.tandemSkipRating = function() {
    if (_onSkip) _onSkip();
    else if (_onSubmit) _onSubmit({ rating: null, feedback: '', feedbackTags: [] });
    closeModal();
  };

  function closeModal() {
    const overlay = document.getElementById('tandemRatingOverlay');
    if (overlay) overlay.style.display = 'none';
    // reset
    currentRating = 0;
    selectedTags = new Set();
    const textarea = document.getElementById('ratingFeedbackText');
    if (textarea) textarea.value = '';
    const tagSec = document.getElementById('feedbackTagSection');
    if (tagSec) tagSec.style.display = 'none';
    document.querySelectorAll('#ratingStarsRow span').forEach(s => { s.style.color = '#ddd'; s.style.transform = 'scale(1)'; });
    document.getElementById('ratingLabel').textContent = '';
  }

  /**
   * Public API
   * @param {object} opts
   * @param {string} opts.sessionId
   * @param {string} [opts.tutorName]
   * @param {string} [opts.subject]
   * @param {function} opts.onSubmit  - called with { rating, feedback, feedbackTags }
   * @param {function} [opts.onSkip]
   */
  window.showTandemRatingModal = function({ sessionId, tutorName, subject, onSubmit, onSkip }) {
    injectModal();
    renderTags();
    _onSubmit = onSubmit;
    _onSkip   = onSkip || null;

    const meta = document.getElementById('ratingModalMeta');
    if (meta) {
      const parts = [];
      if (tutorName) parts.push(`with ${tutorName}`);
      if (subject)   parts.push(`📚 ${subject}`);
      meta.textContent = parts.join(' · ');
    }

    const overlay = document.getElementById('tandemRatingOverlay');
    overlay.style.display = 'flex';
  };

})();
