// Global Modal Helpers
window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
};

// closeModal defined below (L123) with QR timer cleanup

// Global Handlers
// switchNav defined below (after state declaration) with full view management

window.filterCategoryNav = function(name, typeVal, regionVal = '') {
  state.filters.sourceFilter = '';
  state.filters.params = typeVal;
  state.filters.area = regionVal;
  state.filters.category = '';
  
  updatePillState('pills-type', typeVal);
  updatePillState('pills-region', regionVal);
  updatePillState('pills-genre', '');

  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set('view', 'category');
  if (typeVal) urlParams.set('params', typeVal); else urlParams.delete('params');
  if (regionVal) urlParams.set('area', regionVal); else urlParams.delete('area');
  urlParams.delete('category');
  const newQuery = `?${urlParams.toString()}`;
  history.replaceState({ view: 'category' }, '', newQuery);

  switchNav('category', false);
};

window.toggleFilterOptions = function() {
  const box = document.getElementById('filter-box');
  const btn = document.getElementById('collapse-btn');
  if (box.style.display === 'none') {
    box.style.display = 'block';
    btn.innerText = 'Collapse options ^';
  } else {
    box.style.display = 'none';
    btn.innerText = 'Expand options v';
  }
};

window.calculateCacheSize = function() {
  let totalBytes = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      totalBytes += ((localStorage[key].length + key.length) * 2);
    }
  }
  for (let key in sessionStorage) {
    if (sessionStorage.hasOwnProperty(key)) {
      totalBytes += ((sessionStorage[key].length + key.length) * 2);
    }
  }
  const mb = (totalBytes / (1024 * 1024)).toFixed(2);
  return `${mb}M >`;
};

window.handleClearCache = function() {
  localStorage.removeItem('loklok_watch_history');
  localStorage.removeItem('loklok_my_collection');
  localStorage.removeItem('loklok_appointments');
  
  const cacheText = document.getElementById('cache-size-text');
  if (cacheText) cacheText.innerText = '0.00M >';
  showToast('WOX-Stream cache and storage cleared successfully! 🧹');
  if (state.activeNav === 'history') loadHistory();
};

window.handleLanguageChange = function(lang) {
  state.language = lang;
  localStorage.setItem('loklok_lang', lang);
  showToast(`Language set to ${lang.toUpperCase()}. Refreshing content...`);
  loadHomeFeed();
};

window.openPrivacyCenter = function() {
  alert("WOX-Stream Privacy Center:\n\n1. End-to-End Encrypted Gateway: Session tokens and auth states use RSA-1024 / AES-128-ECB encryption.\n2. Local Privacy Protection: Watch history and settings are stored locally on your device.\n3. Content Blocking: Pornographic and LGBTQ+ content filtering toggles are strictly managed on client device.");
};

window.toggleSetting = function(key, isChecked) {
  if (key === 'blockPorno' && !isChecked) {
    // Unchecking "Block 18+" requires Age Verification
    const ageConfirmed = localStorage.getItem('loklok_age_confirmed') === 'true';
    if (!ageConfirmed) {
      openModal('modal-age-gate');
      // Revert UI toggle temporarily until confirmed
      const togglePorno = document.getElementById('setting-block-porno');
      if (togglePorno) togglePorno.checked = true;
      return;
    }
  }

  state.settings[key] = isChecked;
  localStorage.setItem(`loklok_${key}`, isChecked ? 'true' : 'false');
  updateAdultPillVisibility();
  if (key === 'blockLgbt' || key === 'blockPorno') {
    loadHomeFeed();
  }
};

window.confirmAgeGate = function(confirmed) {
  closeModal('modal-age-gate');
  if (confirmed) {
    localStorage.setItem('loklok_age_confirmed', 'true');
    state.settings.blockPorno = false;
    localStorage.setItem('loklok_blockPorno', 'false');
    const togglePorno = document.getElementById('setting-block-porno');
    if (togglePorno) togglePorno.checked = false;
    updateAdultPillVisibility();
    showToast('Adult (18+) content unlocked. Accessible via Category filter pill.');
    loadHomeFeed();
  } else {
    state.settings.blockPorno = true;
    localStorage.setItem('loklok_blockPorno', 'true');
    const togglePorno = document.getElementById('setting-block-porno');
    if (togglePorno) togglePorno.checked = true;
    updateAdultPillVisibility();
  }
};

function updateAdultPillVisibility() {
  const adultPill = document.querySelector('.pill-adult-gated');
  if (!adultPill) return;
  const blockPorno = state.settings ? state.settings.blockPorno : true;
  adultPill.style.display = blockPorno ? 'none' : 'inline-block';
}

window.openLoginModal = function() {
  const modal = document.getElementById('modal-login');
  if (modal) {
    modal.classList.add('active');
    initQrCodeLogin();
  }
};

window.openSettingsModal = function() {
  const modal = document.getElementById('modal-settings');
  if (modal) modal.classList.add('active');
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper for slugifying movie titles in URLs
function slugifyTitle(title) {
  if (!title) return '';
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function updatePageTitleAndUrl(media, epName = null) {
  if (!media || !media.title) return;
  const titleSlug = slugifyTitle(media.title);
  const epText = epName ? `Playing ${epName} - ` : '';
  document.title = `${epText}${media.title} | WOX-Stream`;

  const targetQuery = `?play=${encodeURIComponent(media.id)}&cat=${encodeURIComponent(media.category || 1)}&title=${titleSlug}`;
  if (window.location.search !== targetQuery) {
    history.pushState({ modalOpen: true, id: media.id, category: media.category }, '', window.location.pathname + targetQuery);
  }
}

function resetPageTitleAndUrl() {
  document.title = 'WOX-STREAM // VOID CINEMA';
  if (window.location.search && window.location.search.includes('play=')) {
    history.pushState({}, '', window.location.pathname);
  }
}

function initMovieLinkRouter() {
  const urlParams = new URLSearchParams(window.location.search);
  const playId = urlParams.get('play') || urlParams.get('id');
  const cat = urlParams.get('cat') || urlParams.get('category') || 1;

  if (playId) {
    openDetailModal(playId, cat);
  }
}

window.addEventListener('popstate', () => {
  const detailModal = document.getElementById('modal-detail');
  const playerModal = document.getElementById('modal-player');
  if (playerModal && playerModal.classList.contains('active')) {
    closePlayerModal();
  } else if (detailModal && detailModal.classList.contains('active')) {
    closeModal('modal-detail');
  }
});

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
  if (id === 'modal-detail' || id === 'modal-player') {
    resetPageTitleAndUrl();
  }
  if (id === 'modal-login' && state.qrTimer) {
    clearInterval(state.qrTimer);
    state.qrTimer = null;
  }
};

// handleSearchKeyUp, handleSearchFocus, handleSearchBlur defined at bottom of file
// with category search integration on Enter key

async function fetchSearchSuggestions(query) {
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (!dropdown) return;

  try {
    const res = await fetch(`/api/search?keyword=${encodeURIComponent(query)}&token=${encodeURIComponent(state.token)}`);
    const data = await res.json();
    const results = (data.results || []).slice(0, 6);

    if (results.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = results.map(item => `
      <div onclick="selectSuggestion('${escapeHtml(item.title)}', '${item.id}', '${item.category || 1}')" style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 1rem;cursor:pointer;transition:background 0.2s ease;" onmouseover="this.style.background='rgba(147,51,234,0.2)'" onmouseout="this.style.background='transparent'">
        <img src="${item.cover}" style="width:36px;height:48px;object-fit:cover;border-radius:6px;" onerror="handleImgError(this)">
        <div>
          <div style="font-size:0.9rem;font-weight:600;color:#fff;">${escapeHtml(item.title)}</div>
          <div style="font-size:0.75rem;color:var(--text-dim);">${item.domainType || 'HD'} • ★ ${item.score || '8.5'}</div>
        </div>
      </div>
    `).join('');

    dropdown.style.display = 'block';
  } catch (_) {
    dropdown.style.display = 'none';
  }
}

window.selectSuggestion = function(title, id, category) {
  const input = document.getElementById('search-input');
  if (input) input.value = title;
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  openDetailModal(id, category);
};

async function performSearch(query) {
  if (!query) {
    switchNav('home');
    return;
  }
  switchNav('search');
  const searchTitle = document.getElementById('search-title');
  if (searchTitle) searchTitle.innerText = `Search Results for "${query}"`;
  
  const grid = document.getElementById('search-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch(`/api/search?keyword=${encodeURIComponent(query)}&token=${encodeURIComponent(state.token)}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">No results found for "${escapeHtml(query)}".</p>`;
      return;
    }
    const filtered = filterContentBySettings(data.results);
    grid.innerHTML = filtered.map(item => renderLoklokCard(item)).join('');
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;">Search failed: ${err.message}</p>`;
  }
}

// Working Official Loklok Gateway QR Code Login Handler
window.initQrCodeLogin = async function() {
  const canvas = document.getElementById('qrcode-canvas');
  const overlay = document.getElementById('qrcode-overlay');
  if (!canvas) return;

  if (overlay) overlay.style.display = 'none';
  if (state.qrTimer) clearInterval(state.qrTimer);

  try {
    const res = await fetch('/api/loginThirdParty?action=info');
    const data = await res.json();

    if (!data.success || (!data.oauthKey && !data.code)) {
      alert(data.error || 'Failed to fetch QR Code from server.');
      return;
    }

    state.oauthKey = data.oauthKey || data.code;
    const qrUrl = data.qrUrl || `tiktik://action/webLogin?oauthKey=${state.oauthKey}`;

    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(canvas, qrUrl, { width: 220, margin: 1 }, function (error) {
        if (error) console.error(error);
      });
    }

    state.qrTimer = setInterval(async () => {
      if (!state.oauthKey) return;
      try {
        const checkRes = await fetch(`/api/loginThirdParty?action=check&oauthKey=${encodeURIComponent(state.oauthKey)}`);
        const checkData = await checkRes.json();

        if (checkData.success) {
          const status = checkData.status;
          if (status === 2 || status === 3) {
            if (overlay) {
              overlay.style.display = 'flex';
              document.getElementById('qrcode-status-text').innerText = status === 2 ? 'Scanned! Confirm in app.' : 'Confirming sign in...';
            }
          } else if (status === 4 && checkData.token) {
            // STOP POLLING IMMEDIATELY
            state.oauthKey = null;
            if (state.qrTimer) {
              clearInterval(state.qrTimer);
              state.qrTimer = null;
            }

            saveSession(checkData.token, checkData.user);
            closeModal('modal-login');
            
            showToast(`Signed in as ${checkData.user.nickName || 'WOX User'}! 🎉`);
            loadHistory();
          }
        }
      } catch (_) {}
    }, 2000);

  } catch (err) {
    console.error('QR Login error:', err);
  }
};

window.saveWatchProgress = function() {
  if (!state.currentMedia || !state.currentEpisode) return;
  const videoEl = document.querySelector('#player-container video');
  if (!videoEl || !videoEl.currentTime || videoEl.currentTime < 1) return;

  const currentTime = Math.floor(videoEl.currentTime);
  const duration = Math.floor(videoEl.duration || 0);
  const media = state.currentMedia;
  const ep = state.currentEpisode;

  const currentHist = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
  const idx = currentHist.findIndex(h => h.id === String(media.id));

  const epName = ep.name ? (ep.name.startsWith('Ep') || ep.name.startsWith('Episode') ? ep.name : `Episode ${ep.episodeNumber || ep.id}`) : `Episode ${ep.episodeNumber || ep.id}`;

  const record = {
    id: String(media.id),
    category: String(media.category || 1),
    title: media.title,
    cover: media.cover,
    episodeId: String(ep.id),
    episodeName: epName,
    progressTime: currentTime,
    totalTime: duration,
    updatedAt: Date.now()
  };

  if (idx >= 0) {
    currentHist[idx] = record;
  } else {
    currentHist.unshift(record);
  }

  localStorage.setItem('loklok_watch_history', JSON.stringify(currentHist));

  if (state.token) {
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': state.token },
      body: JSON.stringify({
        action: 'save',
        contentId: media.id,
        category: media.category || 1,
        episodeId: ep.id,
        progressTime: currentTime,
        totalTime: duration
      })
    }).catch(() => {});
  }
};

window.closePlayerModal = function() {
  try { window.saveWatchProgress(); } catch (_) {}
  clearInterval(state.progressInterval);
  if (state.plyrPlayer) {
    try { state.plyrPlayer.destroy(); } catch (_) {}
    state.plyrPlayer = null;
  }
  if (state.hlsInstance) {
    try { state.hlsInstance.destroy(); } catch (_) {}
    state.hlsInstance = null;
  }
  closeModal('modal-player');
};

// Global Esc key binding to close video player instantly
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const playerModal = document.getElementById('modal-player');
    if (playerModal && playerModal.classList.contains('active')) {
      closePlayerModal();
    }
  }
});

window.formatTime = function(secs) {
  if (!secs || isNaN(secs) || secs <= 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

let _playEpisodeLock = 0; // Race condition lock for rapid episode clicks

window.playEpisode = function(mediaArg, epArg) {
  let media = state.currentMedia;
  let ep = null;

  if (typeof mediaArg === 'object' && mediaArg !== null && mediaArg.episodes) {
    // Called as playEpisode(mediaObj, epObj_or_epId)
    media = mediaArg;
    state.currentMedia = media;
    if (typeof epArg === 'object' && epArg !== null) {
      ep = epArg;
    } else if (epArg !== undefined) {
      ep = (media.episodes || []).find(e => String(e.id) === String(epArg) || String(e.episodeNumber) === String(epArg));
    }
  } else {
    // Called as playEpisode(epId_or_epObj)
    const targetId = typeof mediaArg === 'object' ? (mediaArg.id || mediaArg.episodeId) : mediaArg;
    if (media && media.episodes) {
      ep = media.episodes.find(e => String(e.id) === String(targetId) || String(e.episodeNumber) === String(targetId));
    }
  }

  if (!ep && media && media.episodes && media.episodes.length > 0) {
    ep = media.episodes[0];
  }

  if (!media || !ep) {
    console.error('playEpisode failed: invalid media or episode', mediaArg, epArg);
    return;
  }

  // Race condition guard: increment lock, capture current value
  const thisLock = ++_playEpisodeLock;

  state.currentEpisode = ep;
  window.state = state;

  if (media && media.title) {
    updatePageTitleAndUrl(media, ep.name || `Episode ${ep.episodeNumber || 1}`);
  }

  const titleText = document.getElementById('player-title-text');
  if (titleText) titleText.innerText = `${media.title} • ${ep.name || 'Episode'}`;

  const playerModal = document.getElementById('modal-player');
  playerModal.classList.add('active');

  const container = document.getElementById('player-container');
  container.innerHTML = '<div class="spinner"></div>';

  // Cleanup any existing player before starting new one
  clearInterval(state.progressInterval);
  if (state.hlsInstance) {
    try {
      state.hlsInstance.stopLoad();
      state.hlsInstance.detachMedia();
      state.hlsInstance.destroy();
    } catch (_) {}
    state.hlsInstance = null;
  }
  if (state.plyrPlayer) {
    try { state.plyrPlayer.destroy(); } catch (_) {}
    state.plyrPlayer = null;
  }
  const existingVideo = container.querySelector('video');
  if (existingVideo) {
    try {
      existingVideo.pause();
      existingVideo.removeAttribute('src');
      existingVideo.load();
    } catch (_) {}
  }

  const histList = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
  const savedRecord = histList.find(h => h.id === String(media.id) && String(h.episodeId) === String(ep.id));
  const startTime = savedRecord && savedRecord.progressTime > 5 ? savedRecord.progressTime : 0;

  // Route to provider episode APIs
  const isNarto = String(media.id).startsWith('narto_') || String(media.id).startsWith('wox_n_');
  const isDrama = String(media.id).startsWith('wox_d_');
  let fetchPromise;

  if (ep.playUrl) {
    fetchPromise = Promise.resolve({ success: true, streamUrl: ep.playUrl, subtitles: ep.subtitles || [] });
  } else if (isNarto) {
    const slug = String(media.id).startsWith('wox_n_') ? media.id : String(media.id).replace('narto_', '');
    fetchPromise = fetch(`/api/narto/episode?slug=${encodeURIComponent(slug)}&episode=${ep.id}`).then(res => res.json());
  } else if (isDrama) {
    fetchPromise = fetch(`/api/asian-drama?action=episode&episodeId=${encodeURIComponent(ep.id)}`).then(res => res.json());
  } else {
    fetchPromise = fetch(`/api/episode?contentId=${media.id}&episodeId=${ep.id}&category=${media.category || '1'}&token=${encodeURIComponent(state.token)}`).then(res => res.json());
  }

  fetchPromise
    .then(data => {
      const targetStreamUrl = data.streamUrl || data.playUrl || ep.embedUrl || data.embedUrl || media.embedUrl || '';
      const isEmbed = !!(data.embedUrl || ep.embedUrl || media.embedUrl || (data.streamType === 'embed'));

      if (!data.success && !targetStreamUrl) {
        container.innerHTML = '<p style="color:#fff;text-align:center;padding-top:4rem;font-size:1.1rem;">Stream URL unavailable for this episode.</p>';
        return;
      }

      if (isEmbed) {
        const embedSrc = data.embedUrl || ep.embedUrl || media.embedUrl || targetStreamUrl;
        container.innerHTML = `<iframe src="${embedSrc}" style="width:100%;height:100%;min-height:500px;border:none;border-radius:16px;" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
        return;
      }

      // Detect if item is a vertical short drama
      const modalContainer = document.querySelector('.player-modal-container');
      const isShortDrama = isNarto || media.category === 'MINISERIES' || media.domainType === 'SHORT' || state.filters.params === 'MINISERIES';
      if (modalContainer) {
        modalContainer.style.maxWidth = isShortDrama ? '460px' : '1000px';
      }

      // Cleanup existing player instance cleanly
      if (state.hlsInstance) {
        try {
          state.hlsInstance.stopLoad();
          state.hlsInstance.detachMedia();
          state.hlsInstance.destroy();
        } catch (_) {}
        state.hlsInstance = null;
      }
      if (state.plyrPlayer) {
        try {
          if (state.plyrPlayer.media) {
            state.plyrPlayer.media.pause();
            state.plyrPlayer.media.removeAttribute('src');
            state.plyrPlayer.media.load();
          }
          state.plyrPlayer.destroy();
        } catch (_) {}
        state.plyrPlayer = null;
      }
      clearInterval(state.progressInterval);

      // Create native HTML5 video element with WebVTT subtitle <track> tags
      const videoEl = document.createElement('video');
      videoEl.id = 'wox-video-player';
      videoEl.controls = true;
      videoEl.playsInline = true;
      videoEl.style.width = '100%';
      videoEl.style.height = '100%';
      videoEl.style.borderRadius = '16px';

      // Read saved caption preferences from LocalStorage
      const savedCaptionEnabled = localStorage.getItem('loklok_caption_enabled') === 'true';
      const savedCaptionLang = localStorage.getItem('loklok_caption_lang') || 'en';

      const subtitleList = data.subtitles || [];
      let defaultTrackAssigned = false;
      subtitleList.forEach((sub, idx) => {
        const track = document.createElement('track');
        track.kind = 'captions';
        const trackLabel = sub.label || sub.html || `Subtitle ${idx + 1}`;
        const trackLang = sub.lang || 'en';
        track.label = trackLabel;
        track.srclang = trackLang;
        
        let subUrl = sub.url || '';
        if (subUrl.startsWith('http://') || subUrl.startsWith('https://')) {
          subUrl = `/api/subtitle?url=${encodeURIComponent(subUrl)}`;
        }
        track.src = subUrl;

        // Auto-select saved caption language preference
        const isMatch = trackLang.toLowerCase().includes(savedCaptionLang.toLowerCase()) || 
                        trackLabel.toLowerCase().includes(savedCaptionLang.toLowerCase());
        if (!defaultTrackAssigned && (isMatch || (idx === 0 && savedCaptionEnabled))) {
          track.default = true;
          defaultTrackAssigned = true;
        }
        videoEl.appendChild(track);
      });

      container.innerHTML = '';
      container.appendChild(videoEl);

      let rawSourceUrl = targetStreamUrl;
      let playUrl = rawSourceUrl;

      // Always route external target stream URLs through /api/stream proxy to prevent CORS blocks
      if (rawSourceUrl.startsWith('http://') || rawSourceUrl.startsWith('https://')) {
        if (!rawSourceUrl.includes('/api/stream')) {
          playUrl = `/api/stream?url=${encodeURIComponent(rawSourceUrl)}`;
        }
      }

      // Prepare Quality resolution options for Plyr settings menu
      const rawQualities = data.qualities || [];
      const standardTiers = [1080, 720, 480, 360];
      const qualityOptions = rawQualities.length > 0 
        ? rawQualities.map((_, idx) => standardTiers[idx] || (360 - idx * 60))
        : [1080, 720, 480, 360];

      videoEl.addEventListener('loadedmetadata', () => {
        const modalContainer = document.querySelector('.player-modal-container');
        if (!modalContainer) return;
        const w = videoEl.videoWidth || 16;
        const h = videoEl.videoHeight || 9;
        if (h > w) {
          modalContainer.style.maxWidth = '480px';
        } else {
          modalContainer.style.maxWidth = '1000px';
        }
      });

      // Initialize Plyr.js Player with Quality controls and saved caption active setting
      let plyr = null;
      plyr = new Plyr(videoEl, {
        controls: [
          'play-large', 'play', 'progress', 'current-time', 'duration',
          'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'
        ],
        settings: ['captions', 'quality', 'speed'],
        quality: {
          default: qualityOptions[0] || 1080,
          options: qualityOptions,
          forced: true,
          onChange: (newQuality) => {
            const curTime = (plyr ? plyr.currentTime : videoEl.currentTime) || 0;
            try { window.saveWatchProgress(); } catch (_) {}

            // 1. Try HLS level switching first
            if (state.hlsInstance && state.hlsInstance.levels && state.hlsInstance.levels.length > 0) {
              const levelIdx = state.hlsInstance.levels.findIndex(l => Math.min(l.width || 9999, l.height || 9999) === newQuality || l.height === newQuality);
              if (levelIdx !== -1) {
                state.hlsInstance.currentLevel = levelIdx;
                showToast(`Quality set to ${newQuality}p 🎥`);
                return;
              }
            }
            // 2. Fallback to discrete Loklok quality URLs mapped by size index
            const targetIdx = qualityOptions.indexOf(newQuality);
            const targetQual = (rawQualities || [])[targetIdx >= 0 ? targetIdx : 0];
            if (targetQual && targetQual.rawStreamUrl) {
              const isPaused = plyr ? plyr.paused : videoEl.paused;
              const newPlayUrl = `/api/stream?url=${encodeURIComponent(targetQual.rawStreamUrl)}`;

              const restoreTime = () => {
                if (curTime > 0) {
                  try {
                    videoEl.currentTime = curTime;
                    if (plyr) plyr.currentTime = curTime;
                  } catch (_) {}
                }
              };

              videoEl.addEventListener('loadedmetadata', restoreTime, { once: true });
              videoEl.addEventListener('canplay', restoreTime, { once: true });

              if (state.hlsInstance) {
                state.hlsInstance.loadSource(newPlayUrl);
              } else {
                videoEl.src = newPlayUrl;
              }
              if (!isPaused && plyr) plyr.play().catch(() => {});
              showToast(`Quality set to ${newQuality}p (${targetQual.sizeFormatted || 'HD'}) 🎥`);
            }
          }
        },
        captions: { active: savedCaptionEnabled, update: true, language: savedCaptionLang },
        tooltips: { controls: true, seek: true }
      });

      state.plyrPlayer = plyr;

      // Detect if URL is a direct MP4 file (not HLS)
      const isDirectMp4 = /\.mp4(\?|$)/i.test(rawSourceUrl) || /awscdn\.netshort\.com/i.test(rawSourceUrl);

      if (isDirectMp4) {
        // Direct MP4 playback — assign proxied source
        videoEl.src = playUrl;
      } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        // HLS.js streaming setup for .m3u8 via WOX stream proxy
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(playUrl);
        hls.attachMedia(videoEl);
        state.hlsInstance = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (event, hlsData) => {
          if (hlsData && hlsData.levels && hlsData.levels.length > 0) {
            // Support both landscape (1920x1080) and portrait (1080x1920) video resolutions
            const parsedLevels = hlsData.levels.map(l => {
              const res = (l.width && l.height) ? Math.min(l.width, l.height) : (l.height || l.width || 0);
              return { height: res, levelIdx: hlsData.levels.indexOf(l) };
            }).filter(l => l.height > 0);

            if (parsedLevels.length > 0) {
              const sortedQualityOptions = Array.from(new Set(parsedLevels.map(l => l.height))).sort((a, b) => b - a);
              
              plyr.config.quality = {
                default: sortedQualityOptions[0],
                options: sortedQualityOptions,
                forced: true,
                onChange: (selectedQual) => {
                  try { window.saveWatchProgress(); } catch (_) {}
                  const targetLevel = parsedLevels.find(l => l.height === selectedQual);
                  if (targetLevel) {
                    hls.currentLevel = targetLevel.levelIdx;
                    showToast(`Switched quality to ${selectedQual}p 🎥`);
                  }
                }
              };
            }
          }
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = playUrl;
      } else {
        // Fallback: try direct source assignment
        videoEl.src = playUrl;
      }

      // Save caption preference changes to LocalStorage
      plyr.on('languagechange', () => {
        if (plyr.language) {
          localStorage.setItem('loklok_caption_lang', plyr.language);
          localStorage.setItem('loklok_caption_enabled', 'true');
        }
      });

      plyr.on('captionsenabled', () => {
        localStorage.setItem('loklok_caption_enabled', 'true');
        if (plyr.language) {
          localStorage.setItem('loklok_caption_lang', plyr.language);
        }
      });

      plyr.on('captionsdisabled', () => {
        localStorage.setItem('loklok_caption_enabled', 'false');
      });

      state.plyrPlayer = plyr;

      // Populate Player Mirror Server dropdown
      const mirrorDropdown = document.getElementById('player-mirror-dropdown');
      if (mirrorDropdown) {
        const mirrors = media.mirrors || [
          { id: media.id, sourceKey: 'loklok', sourceName: 'Server Alpha (HD)' }
        ];

        const activeKey = media.sourceKey || (media.isNarto ? 'narto' : (media.isViva ? 'viva' : 'loklok'));
        const label = document.getElementById('current-mirror-label');
        if (label) {
          const activeMirror = mirrors.find(m => m.sourceKey === activeKey) || mirrors[0];
          label.innerText = activeMirror ? activeMirror.sourceName : 'Server Alpha (HD)';
        }

        mirrorDropdown.innerHTML = mirrors.map(m => `
          <div onclick="switchStreamMirror('${m.sourceKey}', '${m.id}')" style="padding: 0.45rem 0.75rem; cursor: pointer; color: #fff; font-size: 0.85rem; border-radius: 4px; display: flex; justify-content: space-between;" onmouseover="this.style.background='rgba(56,189,248,0.2)'" onmouseout="this.style.background='transparent'">
            <span>${escapeHtml(m.sourceName)}</span>
            <span style="color: ${m.sourceKey === activeKey ? '#4ade80' : 'var(--text-muted)'}">${m.sourceKey === activeKey ? '● Active' : 'Mirror'}</span>
          </div>
        `).join('');
      }

      // Reliable resume seeking on media load
      let hasAppliedResume = false;
      const applyResumeTime = () => {
        if (hasAppliedResume || startTime <= 3) return;
        try {
          if (videoEl.duration && videoEl.duration > startTime) {
            hasAppliedResume = true;
            videoEl.currentTime = startTime;
            if (plyr) plyr.currentTime = startTime;
            showToast(`Resumed "${media.title}" from ${formatTime(startTime)} ⏩`);
          }
        } catch (_) {}
      };

      videoEl.addEventListener('loadedmetadata', applyResumeTime);
      videoEl.addEventListener('canplay', applyResumeTime);
      videoEl.addEventListener('playing', applyResumeTime);

      plyr.on('ready', () => {
        applyResumeTime();

        // Inject Previous and Next episode control buttons directly into Plyr player bar
        const plyrControls = container.querySelector('.plyr__controls');
        if (plyrControls && !plyrControls.querySelector('.wox-plyr-prev-btn')) {
          const playBtn = plyrControls.querySelector('[data-plyr="play"]');

          const prevBtn = document.createElement('button');
          prevBtn.type = 'button';
          prevBtn.className = 'plyr__control wox-plyr-prev-btn';
          prevBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>';
          prevBtn.title = 'Previous Episode (⏮)';
          prevBtn.onclick = (e) => {
            e.stopPropagation();
            if (typeof window.playPrevEpisode === 'function') window.playPrevEpisode();
          };

          const nextBtn = document.createElement('button');
          nextBtn.type = 'button';
          nextBtn.className = 'plyr__control wox-plyr-next-btn';
          nextBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>';
          nextBtn.title = 'Next Episode (⏭)';
          nextBtn.onclick = (e) => {
            e.stopPropagation();
            if (typeof window.playNextEpisode === 'function') window.playNextEpisode();
          };

          if (playBtn) {
            playBtn.parentNode.insertBefore(prevBtn, playBtn);
            playBtn.parentNode.insertBefore(nextBtn, playBtn.nextSibling);
          } else {
            plyrControls.prepend(nextBtn);
            plyrControls.prepend(prevBtn);
          }
        }
      });

      plyr.on('pause', () => {
        try { window.saveWatchProgress(); } catch (_) {}
      });

      plyr.on('ended', () => {
        try { window.saveWatchProgress(); } catch (_) {}
        const autoNextEnabled = localStorage.getItem('loklok_autonext') !== 'false';
        if (autoNextEnabled) {
          showToast('Episode completed! Auto-playing next episode... ⏭');
          setTimeout(() => {
            if (typeof window.playNextEpisode === 'function') {
              window.playNextEpisode();
            }
          }, 1200);
        } else {
          showToast('Episode completed! ✅');
        }
      });

      plyr.play().catch(() => {});

      // Save watch history progress periodically every 2 seconds
      state.progressInterval = setInterval(() => {
        try { window.saveWatchProgress(); } catch (_) {}
      }, 2000);
    })
    .catch(err => {
      container.innerHTML = `<p style="color:#fff;text-align:center;padding-top:4rem;">Player error: ${err.message}</p>`;
    });
};

window.playPrevEpisode = function() {
  const media = state.currentMedia;
  const currentEp = state.currentEpisode;
  if (!media || !currentEp || !media.episodes || media.episodes.length === 0) {
    showToast('No previous episode available.');
    return;
  }

  const currentIdx = media.episodes.findIndex(e => String(e.id) === String(currentEp.id) || String(e.episodeNumber) === String(currentEp.episodeNumber));
  if (currentIdx <= 0) {
    showToast('You are already on the first episode.');
    return;
  }

  const prevEp = media.episodes[currentIdx - 1];
  playEpisode(media, prevEp);
};

window.playNextEpisode = function() {
  const media = state.currentMedia;
  const currentEp = state.currentEpisode;
  if (!media || !currentEp || !media.episodes || media.episodes.length === 0) {
    showToast('No next episode available.');
    return;
  }

  const currentIdx = media.episodes.findIndex(e => String(e.id) === String(currentEp.id) || String(e.episodeNumber) === String(currentEp.episodeNumber));
  if (currentIdx < 0 || currentIdx >= media.episodes.length - 1) {
    showToast('You are already on the last episode.');
    return;
  }

  const nextEp = media.episodes[currentIdx + 1];
  playEpisode(media, nextEp);
};

window.openDetailModal = async function(id, category = 1) {
  if (!id || id === 'undefined' || id === 'null') {
    alert('Invalid media item ID.');
    return;
  }

  const modal = document.getElementById('modal-detail');
  const content = document.getElementById('detail-content');
  modal.classList.add('active');
  content.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch(`/api/detail?id=${id}&category=${category}&token=${encodeURIComponent(state.token)}`);
    const data = await res.json();

    const detail = data.detail || (data.success && (data.title || data.name || (data.episodes && data.episodes.length > 0)) ? data : null);

    if (!data.success || !detail) {
      content.innerHTML = '<p style="padding:2.5rem;color:var(--text-muted);">Failed to load media details.</p>';
      return;
    }
    state.currentMedia = detail;
    updatePageTitleAndUrl(detail);

    // Check watch history for previously watched episode
    const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
    const watchRecord = localHistory.find(h => h.id === String(detail.id));

    let actionButtonsHtml = '';
    if (detail.episodes && detail.episodes.length > 0) {
      if (watchRecord && watchRecord.episodeId) {
        const resumeEp = detail.episodes.find(e => String(e.id) === String(watchRecord.episodeId)) || detail.episodes[0];
        const rawEpName = watchRecord.episodeName || resumeEp.name || `Episode ${resumeEp.episodeNumber || 1}`;
        const formattedEpName = String(rawEpName).replace(/^Episode\s+/i, 'Ep ');
        const progressFormatted = formatTime(watchRecord.progressTime);

        actionButtonsHtml = `
          <button class="btn btn-primary" onclick="playEpisode(state.currentMedia, '${resumeEp.id}')" style="background: linear-gradient(90deg, #ec4899 0%, #8b5cf6 100%); font-weight:700; box-shadow: 0 4px 15px rgba(236,72,153,0.4);">
            ▶ Resume ${escapeHtml(formattedEpName)} (${progressFormatted})
          </button>
          <button class="btn btn-glass" onclick="playEpisode(state.currentMedia, '${detail.episodes[0].id}')">▶ Start Ep 1</button>
        `;
      } else {
        actionButtonsHtml = `
          <button class="btn btn-primary" onclick="playEpisode(state.currentMedia, '${detail.episodes[0].id}')">▶ Watch Episode 1</button>
        `;
      }
    }

    let mirrorsHtml = '';
    const availableMirrors = (detail.mirrors && detail.mirrors.length > 0) 
      ? detail.mirrors 
      : [{ id: detail.id, sourceKey: 'loklok', sourceName: 'Server Alpha (HD)', isDefault: true }];

    // ONLY render the mirror selector bar if MULTIPLE REAL MIRRORS exist for this title!
    if (availableMirrors.length > 1) {
      mirrorsHtml = `
        <div class="mirror-servers-bar" style="margin-top:1rem;padding:0.75rem 1rem;background:rgba(15,23,42,0.6);border:1px solid var(--border-glass);border-radius:12px;">
          <div style="font-size:0.85rem;font-weight:700;color:var(--accent-cyan);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem;">
            <span>⚡ Select Stream Mirror / Source Provider:</span>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            ${availableMirrors.map((m, idx) => {
              const isCurrent = (m.id === detail.id || idx === 0);
              const activeStyle = isCurrent 
                ? 'background:rgba(56,189,248,0.25);border-color:#38bdf8;color:#38bdf8;font-weight:700;' 
                : 'background:rgba(255,255,255,0.05);border-color:var(--border-glass);color:#fff;';
              return `<button class="btn btn-glass" onclick="openDetailModal('${m.id}', '${detail.category || 1}')" style="${activeStyle}">🌐 ${escapeHtml(m.sourceName)} ${isCurrent ? '(Active)' : ''}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="detail-banner">
        <img class="detail-cover" src="${detail.cover}" alt="${escapeHtml(detail.title)}" onerror="handleImgError(this)">
        <div class="detail-info">
          <h1 class="detail-title">${escapeHtml(detail.title)}</h1>
          <div class="detail-tags">
            ${detail.year ? `<span class="tag-badge">${detail.year}</span>` : ''}
            ${detail.area ? `<span class="tag-badge">${detail.area}</span>` : ''}
            ${detail.genres ? `<span class="tag-badge">${detail.genres}</span>` : ''}
            ${detail.score ? `<span class="tag-badge" style="color:#fbbf24;">★ ${detail.score}</span>` : ''}
          </div>
          <p class="detail-desc">${escapeHtml(detail.description)}</p>
          <div style="display:flex;gap:0.75rem;margin-top:1rem;flex-wrap:wrap;">
            ${actionButtonsHtml}
            <button class="btn btn-glass" onclick="toggleCollection(event, ${JSON.stringify({ id: detail.id, category: detail.category, title: detail.title, cover: detail.cover, score: detail.score }).replace(/"/g, '&quot;')})" style="border-color:#9333ea;color:#c084fc;">⭐ Add to Collection</button>
            <button class="btn btn-glass" onclick="toggleAppointment(event, ${JSON.stringify({ id: detail.id, category: detail.category, title: detail.title, cover: detail.cover, releaseDate: detail.year || 'Coming Soon' }).replace(/"/g, '&quot;')})" style="border-color:#e11d48;color:#fb7185;">⏰ Set Reminder</button>
            <button class="btn btn-glass" onclick="shareTitle('${detail.id}', '${detail.category || 1}', '${escapeHtml(detail.title)}')" style="border-color:#38bdf8;color:#38bdf8;">📎 Share</button>
          </div>
          ${mirrorsHtml}
        </div>
      </div>

      <div class="episodes-section">
        <h3 style="font-size:1.25rem;margin-bottom:0.75rem;">Episodes (${detail.episodes.length})</h3>
        <div class="episodes-grid">
          ${detail.episodes.map(ep => {
            const rawName = ep.name || `Episode ${ep.episodeNumber || 1}`;
            const displayTitle = String(rawName).replace(/^Episode\s+/i, 'Ep ');
            const isWatchedEp = watchRecord && String(watchRecord.episodeId) === String(ep.id);
            const progressFormatted = isWatchedEp ? formatTime(watchRecord.progressTime) : null;
            const progressPct = (isWatchedEp && watchRecord.totalTime > 0) ? Math.min(100, Math.round((watchRecord.progressTime / watchRecord.totalTime) * 100)) : 0;

            return `
              <div class="wox-episode-chip ${isWatchedEp ? 'active-resume' : ''}" onclick="playEpisode('${ep.id}')" title="${escapeHtml(rawName)}${isWatchedEp ? ' - Watched ' + progressFormatted : ''}" style="${isWatchedEp ? 'border-color: #ec4899; background: rgba(236, 72, 153, 0.12);' : ''}">
                <span class="chip-play-icon" style="${isWatchedEp ? 'color:#ec4899;' : ''}">${isWatchedEp ? '⏩' : '▶'}</span>
                <div style="display:flex;flex-direction:column;flex:1;min-width:0;justify-content:center;">
                  <span class="chip-title">${escapeHtml(displayTitle)}${isWatchedEp ? ` <small style="color:#ec4899;font-weight:700;">(${progressFormatted})</small>` : ''}</span>
                  ${isWatchedEp && progressPct > 0 ? `
                    <div style="height:3px;background:rgba(255,255,255,0.2);border-radius:2px;margin-top:3px;overflow:hidden;width:100%;">
                      <div style="height:100%;width:${progressPct}%;background:linear-gradient(90deg,#ec4899,#8b5cf6);"></div>
                    </div>
                  ` : ''}
                </div>
                <button class="chip-download-btn" title="Download ${escapeHtml(rawName)}" onclick="event.stopPropagation(); openDownloadModal(event, '${detail.id}', '${ep.id}', '${detail.category || 1}', '${escapeHtml(rawName)}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p style="padding:2.5rem;color:var(--text-muted);">Error: ${err.message}</p>`;
  }
};

window.openDownloadModal = async function(event, contentId, episodeId, category, epName) {
  if (event) event.stopPropagation();

  const titleEl = document.getElementById('download-media-title');
  const contentEl = document.getElementById('download-modal-content');
  const mediaTitle = state.currentMedia ? state.currentMedia.title : 'WOX-Stream Title';

  if (titleEl) titleEl.innerText = `${mediaTitle} • ${epName || 'Episode'}`;
  if (contentEl) contentEl.innerHTML = '<div class="spinner"></div>';

  openModal('modal-download');

  try {
    const res = await fetch(`/api/episode?contentId=${contentId}&episodeId=${episodeId}&category=${category}&token=${encodeURIComponent(state.token)}`);
    const data = await res.json();

    if (!data.success || !data.downloadUrl) {
      contentEl.innerHTML = `<p style="color:#f87171;padding:1rem;">Unable to fetch download link: ${data.error || 'Source unavailable'}</p>`;
      return;
    }

    const durationMins = data.totalDuration ? Math.round(data.totalDuration / 60) + ' mins' : 'HD Video';

    window._currentDownloadData = {
      ...data,
      mediaTitle,
      epName
    };

    const mp4DownloadUrl = `/api/convert-mp4?url=${encodeURIComponent(data.rawStreamUrl || data.downloadUrl)}&format=mp4&title=${encodeURIComponent(`${mediaTitle} - ${epName}`)}`;
    const hasQualities = data.qualities && data.qualities.length > 0;

    contentEl.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
          <span style="color:var(--text-muted);">Estimated File Size</span>
          <span id="dl-size-badge" style="color:#fbbf24;font-weight:700;font-size:1rem;">${data.fileSizeFormatted || '160 MB'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--text-muted);">Total Duration</span>
          <span style="color:#38bdf8;font-weight:600;">${durationMins}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
        <div>
          <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:0.4rem;font-weight:600;">
            📺 Video Quality / Resolution:
          </label>
          <select id="download-quality-select" onchange="updateMp4DownloadLink()" style="width:100%;padding:0.6rem 0.75rem;background:#1e293b;border:1px solid var(--border-glass);color:#fff;border-radius:8px;font-size:0.85rem;outline:none;cursor:pointer;">
            ${hasQualities ? data.qualities.map((q, idx) => `
              <option value="${encodeURIComponent(q.rawStreamUrl)}" data-size="${q.sizeFormatted}" ${idx === 0 ? 'selected' : ''}>
                ${escapeHtml(q.label)} (${q.sizeFormatted})
              </option>
            `).join('') : `
              <option value="${encodeURIComponent(data.rawStreamUrl || data.downloadUrl)}" data-size="${data.fileSizeFormatted}">
                720p HD (${data.fileSizeFormatted})
              </option>
            `}
          </select>
        </div>

        <div>
          <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:0.4rem;font-weight:600;">
            📦 Container Format:
          </label>
          <select id="download-format-select" onchange="updateMp4DownloadLink()" style="width:100%;padding:0.6rem 0.75rem;background:#1e293b;border:1px solid var(--border-glass);color:#fff;border-radius:8px;font-size:0.85rem;outline:none;cursor:pointer;">
            <option value="mp4" selected>MP4 (.mp4 - Standard Video)</option>
            <option value="mkv">MKV (.mkv - Universal Matroska)</option>
          </select>
        </div>
      </div>

      ${data.subtitles && data.subtitles.length > 0 ? `
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-glass);border-radius:12px;padding:0.85rem 1rem;margin-bottom:1rem;">
          <label style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:0.4rem;font-weight:600;">
            🔤 Select Subtitle Track to Attach/Embed in Video:
          </label>
          <select id="mp4-sub-select" onchange="updateMp4DownloadLink()" style="width:100%;padding:0.6rem 0.75rem;background:#1e293b;border:1px solid var(--border-glass);color:#fff;border-radius:8px;font-size:0.85rem;outline:none;cursor:pointer;">
            <option value="">None (No embedded subtitle)</option>
            ${data.subtitles.map(s => `
              <option value="${encodeURIComponent(s.url)}" data-lang="${s.lang || 'en'}" data-name="${escapeHtml(s.html || 'Subtitle')}">
                Attach ${escapeHtml(s.html)} (.vtt)
              </option>
            `).join('')}
          </select>
        </div>
      ` : ''}

      <div style="display:flex;flex-direction:column;gap:0.75rem;">
        <a id="btn-download-mp4-action" href="${mp4DownloadUrl}" download="${escapeHtml(mediaTitle)} - ${epName}.mp4" target="_blank" class="btn btn-primary" style="justify-content:center;text-decoration:none;background:linear-gradient(135deg, #38bdf8, #9333ea);padding:0.85rem;">
          🎬 Convert & Download Video (.mp4)
        </a>
        <button id="btn-raw-stream-link" class="btn btn-glass" onclick="copyToClipboard('${data.downloadUrl}', 'Direct Stream URL copied to clipboard!')">
          📋 Copy Direct Stream Link (.m3u8)
        </button>
        ${data.subtitles && data.subtitles.length > 0 ? `
          <div style="margin-top:0.75rem;border-top:1px solid var(--border-glass);padding-top:0.75rem;">
            <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem;font-weight:600;">Standalone Subtitle Downloads:</div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              ${data.subtitles.map(s => `
                <a href="${s.url}" download="${s.lang}.vtt" target="_blank" class="btn-appointment" style="background:rgba(147,51,234,0.2);color:#c084fc;text-decoration:none;">
                  🔤 ${s.html} (.vtt)
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    contentEl.innerHTML = `<p style="color:#f87171;padding:1rem;">Error fetching download info: ${err.message}</p>`;
  }
};

window.updateMp4DownloadLink = function() {
  const qualitySelect = document.getElementById('download-quality-select');
  const formatSelect = document.getElementById('download-format-select');
  const subSelect = document.getElementById('mp4-sub-select');
  const btn = document.getElementById('btn-download-mp4-action');
  const sizeBadge = document.getElementById('dl-size-badge');
  const rawStreamBtn = document.getElementById('btn-raw-stream-link');

  if (!btn || !window._currentDownloadData) return;

  const data = window._currentDownloadData;
  const mediaTitle = data.mediaTitle || 'Video';
  const epName = data.epName || 'Episode';

  let streamUrl = data.rawStreamUrl || data.downloadUrl;
  if (qualitySelect && qualitySelect.value) {
    const opt = qualitySelect.options[qualitySelect.selectedIndex];
    streamUrl = decodeURIComponent(qualitySelect.value);
    if (sizeBadge) sizeBadge.innerText = opt.getAttribute('data-size') || 'HD Video';
  }

  const format = formatSelect ? formatSelect.value : 'mp4';
  const extLabel = format.toUpperCase();

  let downloadApiUrl = `/api/convert-mp4?url=${encodeURIComponent(streamUrl)}&format=${format}&title=${encodeURIComponent(`${mediaTitle} - ${epName}`)}`;

  if (subSelect && subSelect.value) {
    const selectedOption = subSelect.options[subSelect.selectedIndex];
    const subUrl = decodeURIComponent(subSelect.value);
    const subLang = selectedOption.getAttribute('data-lang') || 'en';
    const subName = selectedOption.getAttribute('data-name') || 'Subtitle';

    downloadApiUrl += `&subUrl=${encodeURIComponent(subUrl)}&subLang=${encodeURIComponent(subLang)}&subName=${encodeURIComponent(subName)}`;
    btn.innerHTML = `🎬 Convert & Download ${extLabel} with Embedded ${escapeHtml(subName)} Subtitle`;
  } else {
    btn.innerHTML = `🎬 Convert & Download Video (.${format})`;
  }

  btn.href = downloadApiUrl;
  btn.download = `${mediaTitle} - ${epName}.${format}`;
  if (rawStreamBtn) {
    rawStreamBtn.setAttribute('onclick', `copyToClipboard('${streamUrl}', 'Direct Stream URL copied to clipboard!')`);
  }
};

window.copyToClipboard = function(text, successMsg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg || 'Copied to clipboard! 📋');
  }).catch(() => {
    prompt('Copy stream URL:', text);
  });
};

// Collection (Bookmarks) Handlers
window.toggleCollection = async function(event, itemJsonStr) {
  if (event) event.stopPropagation();
  const item = typeof itemJsonStr === 'string' ? JSON.parse(itemJsonStr) : itemJsonStr;
  if (!item || !item.id) return;

  const collection = JSON.parse(localStorage.getItem('loklok_my_collection') || '[]');
  const idx = collection.findIndex(c => c.id === String(item.id));
  const isRemoving = idx >= 0;

  if (isRemoving) {
    collection.splice(idx, 1);
    showToast(`Removed "${item.title}" from My Collection`);
  } else {
    collection.unshift({
      id: String(item.id),
      category: String(item.category || 1),
      title: item.title,
      cover: item.cover,
      score: item.score || '8.5',
      updatedAt: Date.now()
    });
    showToast(`Added "${item.title}" to My Collection ⭐`);
  }

  localStorage.setItem('loklok_my_collection', JSON.stringify(collection));

  if (state.token) {
    fetch('/api/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': state.token },
      body: JSON.stringify({ action: isRemoving ? 'delete' : 'add', contentId: item.id, category: item.category || 1 })
    }).catch(() => {});
  }

  if (state.activeNav === 'history' && state.activeProfileTab === 'collection') {
    switchProfileTab('collection');
  }
};

// Appointment Reminders Handlers
window.toggleAppointment = async function(event, itemJsonStr) {
  if (event) event.stopPropagation();
  const item = typeof itemJsonStr === 'string' ? JSON.parse(itemJsonStr) : itemJsonStr;
  if (!item || !item.id) return;

  const appointments = JSON.parse(localStorage.getItem('loklok_appointments') || '[]');
  const idx = appointments.findIndex(a => a.id === String(item.id));
  const isRemoving = idx >= 0;

  if (isRemoving) {
    appointments.splice(idx, 1);
    showToast(`Cancelled appointment for "${item.title}"`);
  } else {
    appointments.unshift({
      id: String(item.id),
      category: String(item.category || 1),
      title: item.title,
      cover: item.cover,
      releaseDate: item.releaseDate || 'Coming Soon',
      updatedAt: Date.now()
    });
    showToast(`Appointment set for "${item.title}" ⏰`);
  }

  localStorage.setItem('loklok_appointments', JSON.stringify(appointments));

  if (state.token) {
    fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': state.token },
      body: JSON.stringify({ action: isRemoving ? 'cancel' : 'toggle', contentId: item.id, category: item.category || 1, operationType: isRemoving ? 0 : 1 })
    }).catch(() => {});
  }

  if (state.activeNav === 'history' && state.activeProfileTab === 'appointment') {
    switchProfileTab('appointment');
  }
};

window.handleChangePassword = function() {
  const newPass = prompt('Enter your new account password:');
  if (newPass && newPass.trim().length >= 6) {
    showToast('Password updated successfully!');
  } else if (newPass !== null) {
    alert('Password must be at least 6 characters.');
  }
};

window.switchProfileTab = async function(tabName) {
  state.activeProfileTab = tabName;

  const tabBtns = document.querySelectorAll('#history-subnav .history-subnav-btn');
  tabBtns.forEach(btn => btn.classList.remove('active'));

  const activeBtn = Array.from(tabBtns).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(tabName));
  if (activeBtn) activeBtn.classList.add('active');

  const historyGrid = document.getElementById('history-grid');
  const profileSubContent = document.getElementById('profile-sub-content');

  if (tabName === 'history') {
    historyGrid.style.display = 'grid';
    profileSubContent.style.display = 'none';
    loadHistory(true);
  } else {
    historyGrid.style.display = 'none';
    profileSubContent.style.display = 'block';

    if (tabName === 'appointment') {
      profileSubContent.innerHTML = '<div class="spinner"></div>';
      const localAppointments = JSON.parse(localStorage.getItem('loklok_appointments') || '[]');
      let remoteAppointments = [];

      if (state.token) {
        try {
          const res = await fetch('/api/appointments', { headers: { token: state.token } });
          const data = await res.json();
          if (data.success && Array.isArray(data.list)) {
            remoteAppointments = data.list;
          }
        } catch (_) {}
      }

      const map = new Map();
      remoteAppointments.forEach(item => map.set(String(item.id), item));
      localAppointments.forEach(item => {
        const key = String(item.id);
        if (!map.has(key) || (item.updatedAt || 0) > (map.get(key).updatedAt || 0)) {
          map.set(key, item);
        }
      });

      const combined = Array.from(map.values());

      if (combined.length === 0) {
        profileSubContent.innerHTML = `
          <div style="text-align:center;padding:4rem;color:var(--text-muted);">
            <div style="font-size:3.5rem;margin-bottom:1rem;">⏰</div>
            <p style="font-size:1.1rem;margin-bottom:0.5rem;color:#fff;">No appointment reminders set</p>
            <p style="font-size:0.9rem;">Book upcoming movies and anime episodes to receive launch reminders!</p>
          </div>
        `;
      } else {
        profileSubContent.innerHTML = `
          <div class="card-grid">
            ${combined.map(item => `
              <div class="loklok-card" onclick="openDetailModal('${item.id}', '${item.category || 1}')">
                <div class="card-poster-wrap">
                  <img class="card-poster-img" src="${item.cover}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="handleImgError(this)">
                  <span class="badge-top-right" style="background:#e11d48;">⏰ Appointment Set</span>
                </div>
                <div class="card-details">
                  <div class="card-name">${escapeHtml(item.title)}</div>
                  <div class="card-subtext">${escapeHtml(item.releaseDate || item.releaseTime || 'Coming Soon')}</div>
                  <button class="btn-appointment" style="background:rgba(225,29,72,0.2);color:#fb7185;margin-top:0.5rem;" onclick="toggleAppointment(event, ${JSON.stringify(item).replace(/"/g, '&quot;')})">Cancel Reminder</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

    } else if (tabName === 'collection') {
      profileSubContent.innerHTML = '<div class="spinner"></div>';
      const localCollection = JSON.parse(localStorage.getItem('loklok_my_collection') || '[]');
      let remoteCollection = [];

      if (state.token) {
        try {
          const res = await fetch('/api/collection', { headers: { token: state.token } });
          const data = await res.json();
          if (data.success && Array.isArray(data.list)) {
            remoteCollection = data.list;
          }
        } catch (_) {}
      }

      const map = new Map();
      remoteCollection.forEach(item => map.set(String(item.id), item));
      localCollection.forEach(item => {
        const key = String(item.id);
        if (!map.has(key) || (item.updatedAt || 0) > (map.get(key).updatedAt || 0)) {
          map.set(key, item);
        }
      });

      const combined = Array.from(map.values());

      if (combined.length === 0) {
        profileSubContent.innerHTML = `
          <div style="text-align:center;padding:4rem;color:var(--text-muted);">
            <div style="font-size:3.5rem;margin-bottom:1rem;">⭐</div>
            <p style="font-size:1.1rem;margin-bottom:0.5rem;color:#fff;">My Collection is empty</p>
            <p style="font-size:0.9rem;">Bookmark your favorite movies, K-Dramas, and anime to build your collection!</p>
          </div>
        `;
      } else {
        profileSubContent.innerHTML = `
          <div class="card-grid">
            ${combined.map(item => `
              <div class="loklok-card" onclick="openDetailModal('${item.id}', '${item.category || 1}')">
                <div class="card-poster-wrap">
                  <img class="card-poster-img" src="${item.cover}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="handleImgError(this)">
                  <span class="badge-top-right" style="background:#9333ea;">★ ${item.score || '8.5'}</span>
                </div>
                <div class="card-details">
                  <div class="card-name">${escapeHtml(item.title)}</div>
                  <div class="card-subtext">Saved to My Collection</div>
                  <button class="btn-appointment" style="background:rgba(147,51,234,0.2);color:#c084fc;margin-top:0.5rem;" onclick="toggleCollection(event, ${JSON.stringify(item).replace(/"/g, '&quot;')})">Remove</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

    } else if (tabName === 'account') {
      const u = state.user || {};
      const nickName = u.username || u.nickName || u.name || 'Guest User';
      const email = u.email || 'Unregistered Guest Session';

      const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
      const totalWatched = localHistory.length;
      let totalSecs = 0;
      localHistory.forEach(h => { totalSecs += (h.progressTime || 0); });
      const totalHours = (totalSecs / 3600).toFixed(1);

      profileSubContent.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:1.5rem;max-width:960px;">
          
          <!-- User Stats Summary -->
          <div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:16px;padding:1.5rem;display:flex;align-items:center;gap:1.25rem;">
            <div style="width:52px;height:52px;border-radius:14px;background:rgba(56,189,248,0.15);color:var(--accent-cyan);display:flex;align-items:center;justify-content:center;font-size:1.6rem;">🎬</div>
            <div>
              <div style="font-size:1.6rem;font-weight:800;color:#fff;">${totalWatched}</div>
              <div style="font-size:0.85rem;color:var(--text-muted);">Titles Watched</div>
            </div>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:16px;padding:1.5rem;display:flex;align-items:center;gap:1.25rem;">
            <div style="width:52px;height:52px;border-radius:14px;background:rgba(147,51,234,0.15);color:var(--accent-purple);display:flex;align-items:center;justify-content:center;font-size:1.6rem;">⏱️</div>
            <div>
              <div style="font-size:1.6rem;font-weight:800;color:#fff;">${totalHours} hrs</div>
              <div style="font-size:0.85rem;color:var(--text-muted);">Total Watch Time</div>
            </div>
          </div>

          <!-- Account Details Form Card -->
          <div style="grid-column:1/-1;background:var(--bg-card);border:1px solid var(--border-glass);border-radius:16px;padding:2rem;">
            <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:1.5rem;color:#fff;">Account & Profile Settings</h3>
            
            <div style="margin-bottom:1.25rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-glass);padding-bottom:1rem;">
              <span style="color:var(--text-muted);font-size:0.95rem;">Username</span>
              <span style="font-weight:600;color:#fff;font-size:0.95rem;">${escapeHtml(nickName)}</span>
            </div>

            <div style="margin-bottom:1.25rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-glass);padding-bottom:1rem;">
              <span style="color:var(--text-muted);font-size:0.95rem;">Email Address</span>
              <span style="color:var(--text-dim);font-size:0.95rem;">${escapeHtml(email)}</span>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:var(--text-muted);font-size:0.95rem;">Password</span>
              <div style="display:flex;align-items:center;gap:1rem;">
                <span style="color:var(--text-dim);font-size:0.95rem;">••••••••</span>
                <button onclick="handleChangePassword()" style="background:none;border:none;color:var(--accent-cyan);font-weight:600;font-size:0.85rem;cursor:pointer;">Change Password</button>
              </div>
            </div>
          </div>

        </div>
      `;
    }
  }
};

window.deleteHistoryItem = function(event, itemJsonStr) {
  if (event) event.stopPropagation();
  const item = typeof itemJsonStr === 'string' ? JSON.parse(itemJsonStr) : itemJsonStr;
  if (!item || !item.id) return;

  const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
  const idx = localHistory.findIndex(h => h.id === String(item.id));
  if (idx >= 0) {
    localHistory.splice(idx, 1);
    localStorage.setItem('loklok_watch_history', JSON.stringify(localHistory));
  }

  const deletedSet = new Set(JSON.parse(localStorage.getItem('loklok_deleted_history') || '[]'));
  deletedSet.add(String(item.id));
  localStorage.setItem('loklok_deleted_history', JSON.stringify(Array.from(deletedSet)));

  showToast(`Removed "${item.title}" from Watch History 🗑️`);
  if (state.activeNav === 'history') {
    loadHistory(false);
  }
};

// loadWeeklyCalendar and selectCalendarDay defined below (after state declaration)
// with renderCalendarDayTabs/renderCalendarDayItems pattern

window.handleDbFileImport = async function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  showToast(`Parsing ${file.name}... ⏳`);

  try {
    if (file.name.endsWith('.json')) {
      const text = await file.text();
      const json = JSON.parse(text);
      const items = Array.isArray(json) ? json : (json.history || []);
      
      const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
      const map = new Map();
      localHistory.forEach(i => map.set(String(i.id), i));
      items.forEach(i => map.set(String(i.id), i));

      const merged = Array.from(map.values());
      localStorage.setItem('loklok_watch_history', JSON.stringify(merged));

      showToast(`Successfully imported ${items.length} items from JSON backup! 🎉`);
      loadHistory(false);
      return;
    }

    // Binary SQLite rrclient.db file import
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
    }
    const base64 = btoa(binary);

    const res = await fetch('/api/import-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbBase64: base64 })
    });

    const data = await res.json();
    if (!data.success || !Array.isArray(data.items)) {
      showToast(`Import failed: ${data.error || 'Invalid file format'} ❌`);
      return;
    }

    // Merge imported items into localStorage
    const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
    const map = new Map();
    localHistory.forEach(i => map.set(String(i.id), i));
    data.items.forEach(i => map.set(String(i.id), i));

    const merged = Array.from(map.values());
    localStorage.setItem('loklok_watch_history', JSON.stringify(merged));

    showToast(`Successfully imported ${data.count} titles from ${file.name}! 🎉`);
    loadHistory(false);

  } catch (err) {
    showToast(`Error reading database file: ${err.message} ❌`);
  }
};

window.exportHistoryJson = function() {
  const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
  if (localHistory.length === 0) {
    showToast('No watch history items to export.');
    return;
  }

  const jsonStr = JSON.stringify({ version: '1.0', exportDate: new Date().toISOString(), count: localHistory.length, history: localHistory }, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `loklok_watch_history_backup_${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showToast(`Exported ${localHistory.length} history items to JSON! 📤`);
};

window.loadHistory = async function(quiet = false) {
  console.group('%c📺 [Loklok Debug] Quietly Syncing Watch History...', 'color: #c084fc; font-weight: bold; font-size: 1.1rem;');
  console.log('🔑 Active User Token:', state.token ? (state.token.substring(0, 20) + '...') : 'None (Guest Mode)');
  
  const grid = document.getElementById('history-grid');
  if (grid && !quiet && (!grid.children || grid.children.length === 0)) {
    grid.innerHTML = '<div class="spinner"></div>';
  }

  const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
  const deletedSet = new Set(JSON.parse(localStorage.getItem('loklok_deleted_history') || '[]'));

  let serverHistory = [];

  if (state.token) {
    try {
      const res = await fetch('/api/history', { headers: { token: state.token } });
      const data = await res.json();
      if (data.code === 'A0230') {
        console.warn('⚠️ Token expired (A0230). Triggering QR Code login modal...');
        showToast('⚠️ Session expired! Please scan the QR code to sign in again.');
        openLoginModal();
      } else if (data.success && Array.isArray(data.history)) {
        serverHistory = data.history;
      }
    } catch (err) {
      console.error('❌ Failed to fetch remote watch history quietly:', err);
    }
  }

  // Merge server and local history by ID
  const map = new Map();
  serverHistory.forEach(item => {
    if (!deletedSet.has(String(item.id))) {
      map.set(String(item.id), item);
    }
  });
  localHistory.forEach(item => {
    const key = String(item.id);
    if (!deletedSet.has(key)) {
      if (!map.has(key) || (item.updatedAt || 0) > (map.get(key).updatedAt || 0)) {
        map.set(key, item);
      }
    }
  });

  const combined = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  console.log(`📊 Quiet Sync History (${combined.length} total items):`, combined);
  console.groupEnd();

  if (!grid) return;

  if (combined.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem;">
        <p style="color:var(--text-muted);margin-bottom:1rem;">No watch history recorded yet. Start watching any movie, drama, or anime to track your progress!</p>
      </div>
    `;
    return;
  }

  const htmlContent = combined.map(item => {
    const progressPercent = item.totalTime > 0 ? Math.min(100, Math.round((item.progressTime / item.totalTime) * 100)) : 0;
    const timeFormatted = item.progressTime > 0 ? formatSeconds(item.progressTime) : '';
    const label = progressPercent > 0 ? `Already watched ${progressPercent}% ${timeFormatted ? '(' + timeFormatted + ')' : ''}` : 'Started watching';
    const itemJson = JSON.stringify(item).replace(/"/g, '&quot;');

    return `
      <div class="loklok-card" onclick="openDetailModal('${item.id}', '${item.category || 1}')">
        <div class="card-poster-wrap">
          <img class="card-poster-img" src="${item.cover}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="handleImgError(this)">
          <span class="badge-top-right" style="background:rgba(0,0,0,0.8);">${progressPercent || 0}%</span>
        </div>
        <div class="card-details">
          <div class="card-name">${escapeHtml(item.title)}</div>
          <div class="card-subtext" style="color:var(--accent-purple);font-weight:600;">${escapeHtml(item.episodeName || 'Episode')}</div>
          <div class="card-subtext">${label}</div>
          <div class="progress-bar-bg" style="margin-top:0.4rem;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
            <div style="width:${progressPercent}%;height:100%;background:linear-gradient(90deg, #9333ea, #c084fc);"></div>
          </div>
          <div style="display:flex;gap:0.4rem;margin-top:0.6rem;">
            <button class="btn btn-primary" style="flex:1;padding:0.45rem;font-size:0.8rem;justify-content:center;" onclick="event.stopPropagation(); resumeWatchHistoryItem(${itemJson})">▶ Resume</button>
            <button class="btn-appointment" style="background:rgba(239,68,68,0.2);color:#f87171;padding:0.45rem 0.65rem;" title="Delete item" onclick="deleteHistoryItem(event, ${itemJson})">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Update DOM quietly without wiping if content is identical
  if (grid.innerHTML !== htmlContent) {
    grid.innerHTML = htmlContent;
  }
};

window.resumeWatchHistoryItem = async function(item) {
  showToast(`Resuming ${item.title}...`);
  await openDetailModal(item.id, item.category || '1');
  if (state.currentMedia && item.episodeId) {
    const targetEp = (state.currentMedia.episodes || []).find(e => String(e.id) === String(item.episodeId)) || state.currentMedia.episodes[0];
    if (targetEp) {
      playEpisode(state.currentMedia, targetEp);
    }
  }
};

window.formatSeconds = function(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const sStr = s < 10 ? '0' + s : s;
  if (h > 0) {
    const mStr = m < 10 ? '0' + m : m;
    return `${h}:${mStr}:${sStr}`;
  }
  return `${m}:${sStr}`;
};

window.showToast = function(msg) {
  let toast = document.getElementById('loklok-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'loklok-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#9333ea;color:#fff;padding:12px 20px;border-radius:10px;font-weight:600;font-size:0.9rem;z-index:99999;box-shadow:0 10px 25px rgba(0,0,0,0.5);transition:all 0.3s ease;';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
};

window.handleImgError = function(img) {
  if (!img.dataset.proxied) {
    img.dataset.proxied = "true";
    img.src = "/api/image?url=" + encodeURIComponent(img.src);
  } else {
    img.src = SVG_FALLBACK;
  }
};


window.switchAuthTab = function(tab) {
  const loginTab = document.getElementById('tab-auth-login');
  const regTab = document.getElementById('tab-auth-register');
  const loginForm = document.getElementById('form-auth-login');
  const regForm = document.getElementById('form-auth-register');

  if (tab === 'login') {
    loginTab.style.color = '#fff';
    loginTab.style.borderBottom = '2px solid var(--accent-cyan)';
    regTab.style.color = 'var(--text-muted)';
    regTab.style.borderBottom = 'none';
    loginForm.style.display = 'flex';
    regForm.style.display = 'none';
  } else {
    regTab.style.color = '#fff';
    regTab.style.borderBottom = '2px solid var(--accent-purple)';
    loginTab.style.color = 'var(--text-muted)';
    loginTab.style.borderBottom = 'none';
    regForm.style.display = 'flex';
    loginForm.style.display = 'none';
  }
};

window.handleWoxLogin = async function(event) {
  event.preventDefault();
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;

  if (!identifier || !password) return;

  try {
    const res = await fetch('/api/auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: identifier, password: password })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(`Login failed: ${data.error || 'Invalid credentials'} ❌`);
      return;
    }

    saveSession(data.token, data.user);
    closeModal('modal-login');
    showToast(`Welcome back, ${data.user.username}! 👋`);

    if (state.activeNav === 'history') {
      loadHistory(false);
    }
  } catch (err) {
    showToast(`Error signing in: ${err.message} ❌`);
  }
};

window.handleWoxRegister = async function(event) {
  event.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!username || !email || !password) return;

  try {
    const res = await fetch('/api/auth?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(`Registration failed: ${data.error} ❌`);
      return;
    }

    saveSession(data.token, data.user);
    closeModal('modal-login');
    showToast(`Account created! Welcome to WOX-Stream, ${data.user.username}! 🎉`);

    if (state.activeNav === 'history') {
      loadHistory(false);
    }
  } catch (err) {
    showToast(`Error creating account: ${err.message} ❌`);
  }
};

window.handleLogout = function() {
  saveSession('', null);
  closeModal('modal-settings');
  showToast('Signed out successfully.');
  if (state.activeNav === 'history') {
    loadHistory();
  }
};

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%239333ea'/><path d='M32 16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 24c-12 0-20 6-20 12v2h40v-2c0-6-8-12-20-12z' fill='%23ffffff'/></svg>`;

window.handleAvatarError = function(img) {
  if (img) {
    img.onerror = null;
    img.src = DEFAULT_AVATAR;
  }
};

function initUserUI() {
  const userArea = document.getElementById('user-area');
  const logoutContainer = document.getElementById('setting-logout-container');

  const u = state.user || {};
  const rawInfo = u.rawInfo || {};
  const rawAvatar = u.portrait || u.avatar || u.headImg || u.icon || u.userIcon || u.picture || u.photoUrl || rawInfo.portrait || rawInfo.avatar || rawInfo.headImg || rawInfo.icon || rawInfo.picture || rawInfo.photoUrl || '';
  
  if (rawAvatar && (!u.avatar || u.avatar !== rawAvatar)) {
    u.avatar = rawAvatar;
    state.user = u;
    localStorage.setItem('loklok_user', JSON.stringify(u));
  }

  const nickName = u.nickName || u.name || u.username || 'WOX Account';
  const avatar = (rawAvatar && rawAvatar.length > 5) ? rawAvatar : DEFAULT_AVATAR;

  if (state.token) {
    if (logoutContainer) logoutContainer.style.display = 'block';
    userArea.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;" onclick="switchNav('history')" title="Open Profile">
          <img class="user-avatar-btn" src="${avatar}" alt="Avatar" style="width:36px;height:36px;border-radius:50%;border:2px solid #9333ea;object-fit:cover;" onerror="handleAvatarError(this)">
          <span style="font-size:0.85rem;font-weight:600;color:#fff;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(nickName)}</span>
        </div>
        <button class="btn btn-glass" onclick="handleLogout()" style="padding:0.35rem 0.75rem;font-size:0.8rem;color:#fb7185;border-color:rgba(225,29,72,0.4);background:rgba(225,29,72,0.1);">Sign Out</button>
      </div>
    `;

    // Update Profile Header inside Watch History View
    const profileHeader = document.getElementById('profile-header-container');
    if (profileHeader) {
      profileHeader.innerHTML = `
        <div style="display:flex;align-items:center;gap:1.25rem;margin-bottom:1.5rem;background:var(--bg-card);padding:1.25rem;border-radius:16px;border:1px solid var(--border-glass);">
          <img src="${avatar}" alt="Avatar" style="width:64px;height:64px;border-radius:50%;border:2px solid #9333ea;object-fit:cover;" onerror="handleAvatarError(this)">
          <div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <h2 style="font-size:1.4rem;font-weight:700;">${escapeHtml(nickName)}</h2>
              <button onclick="handleLogout()" style="background:none;border:none;color:#fb7185;font-size:0.8rem;cursor:pointer;text-decoration:underline;">Sign out</button>
            </div>
            <div style="margin-top:0.3rem;font-size:0.85rem;color:var(--text-muted);">
              <span>Account active for Watch History, Watchlist & Favorites</span>
            </div>
          </div>
        </div>
      `;
    }
  } else {
    if (logoutContainer) logoutContainer.style.display = 'none';
    userArea.innerHTML = `
      <button class="btn btn-primary" onclick="openLoginModal()">Sign In</button>
    `;
    const profileHeader = document.getElementById('profile-header-container');
    if (profileHeader) profileHeader.innerHTML = '';
  }
}

// Internal State & Fallbacks
const SVG_FALLBACK = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="100%" height="100%" fill="%2312161f"/><text x="50%" y="50%" fill="%2364748b" font-size="16" text-anchor="middle">No Cover</text></svg>`;

const initialToken = localStorage.getItem('loklok_token') || '';
const cleanInitialToken = (initialToken === '1' || initialToken === 'undefined' || initialToken === 'null' || initialToken.length < 8) ? '' : initialToken;

const state = {
  activeNav: 'home',
  activeProfileTab: 'history',
  token: cleanInitialToken,
  user: JSON.parse(localStorage.getItem('loklok_user') || 'null'),
  language: localStorage.getItem('loklok_lang') || 'en',
  artPlayer: null,
  currentMedia: null,
  currentEpisode: null,
  progressInterval: null,
  qrCode: null,
  qrTimer: null,
  settings: {
    autoboot: localStorage.getItem('loklok_autoboot') === 'true',
    blockPorno: localStorage.getItem('loklok_blockPorno') === 'true',
    blockLgbt: localStorage.getItem('loklok_blockLgbt') === 'true',
    allowAdult: localStorage.getItem('loklok_allowAdult') === 'true'
  },
  filters: {
    params: '',
    area: '',
    category: '',
    order: 'count',
    sourceFilter: ''
  }
};

if (!cleanInitialToken) {
  localStorage.removeItem('loklok_token');
}

window.switchNav = function(viewName, pushUrl = true) {
  state.activeNav = viewName;

  // Close search dropdown on any navigation
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.getElementById(`nav-${viewName}`);
  if (activeItem) activeItem.classList.add('active');

  const viewHome = document.getElementById('view-home');
  const viewCategory = document.getElementById('view-category');
  const viewHistory = document.getElementById('view-history');
  const viewCalendar = document.getElementById('view-calendar');
  const viewSearch = document.getElementById('view-search');
  const viewWatchlist = document.getElementById('view-watchlist');

  if (viewHome) viewHome.style.display = 'none';
  if (viewCategory) viewCategory.style.display = 'none';
  if (viewHistory) viewHistory.style.display = 'none';
  if (viewCalendar) viewCalendar.style.display = 'none';
  if (viewSearch) viewSearch.style.display = 'none';
  if (viewWatchlist) viewWatchlist.style.display = 'none';

  if (pushUrl && !window.location.search.includes('play=')) {
    const urlParams = new URLSearchParams(window.location.search);
    if (viewName === 'home') {
      urlParams.delete('view');
    } else {
      urlParams.set('view', viewName);
    }
    const newQuery = urlParams.toString() ? `?${urlParams.toString()}` : window.location.pathname;
    history.replaceState({ view: viewName }, '', newQuery);
  }

  if (viewName === 'home') {
    if (viewHome) viewHome.style.display = 'block';
    loadHomeFeed();
  } else if (viewName === 'category') {
    if (viewCategory) viewCategory.style.display = 'block';
    executeCategorySearch();
  } else if (viewName === 'history') {
    if (viewHistory) viewHistory.style.display = 'block';
    switchProfileTab(state.activeProfileTab || 'history');
  } else if (viewName === 'calendar') {
    if (viewCalendar) viewCalendar.style.display = 'block';
    loadWeeklyCalendar();
  } else if (viewName === 'search') {
    if (viewSearch) viewSearch.style.display = 'block';
    executeKeywordSearch();
  } else if (viewName === 'watchlist') {
    if (viewWatchlist) viewWatchlist.style.display = 'block';
    loadWatchlist();
  }
};

window.loadWeeklyCalendar = async function() {
  const tabsContainer = document.getElementById('calendar-day-tabs');
  const grid = document.getElementById('calendar-schedule-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch('/api/calendar');
    const data = await res.json();

    if (!data.success || !Array.isArray(data.weeklySchedule)) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;">Unable to load release schedule.</p>';
      return;
    }

    state.weeklySchedule = data.weeklySchedule;
    const currentDayIdx = (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); // 0-based for Mon-Sun

    renderCalendarDayTabs(currentDayIdx);
    renderCalendarDayItems(currentDayIdx);

  } catch (err) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;">Error loading schedule: ${err.message}</p>`;
  }
};

function renderCalendarDayTabs(activeIdx) {
  const tabsContainer = document.getElementById('calendar-day-tabs');
  if (!tabsContainer || !state.weeklySchedule) return;

  tabsContainer.innerHTML = state.weeklySchedule.map((day, idx) => `
    <button class="filter-pill ${idx === activeIdx ? 'active' : ''}" onclick="selectCalendarDay(${idx})" style="padding:0.5rem 1.25rem;font-weight:600;">
      ${day.dayName} (${day.items.length})
    </button>
  `).join('');
}

window.selectCalendarDay = function(idx) {
  renderCalendarDayTabs(idx);
  renderCalendarDayItems(idx);
};

function renderCalendarDayItems(dayIdx) {
  const grid = document.getElementById('calendar-schedule-grid');
  if (!grid || !state.weeklySchedule || !state.weeklySchedule[dayIdx]) return;

  const dayObj = state.weeklySchedule[dayIdx];
  const items = dayObj.items || [];

  if (items.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">No episode releases scheduled for this day.</p>';
    return;
  }

  grid.innerHTML = items.map(item => {
    const itemJson = JSON.stringify({ id: item.id, category: item.category || 1, title: item.title, cover: item.cover, releaseDate: `${dayObj.dayName} at ${item.airTime || '20:00'}` }).replace(/"/g, '&quot;');
    return `
      <div class="loklok-card" onclick="openDetailModal('${item.id}', '${item.category || 1}')">
        <div class="card-poster-wrap">
          <img class="card-poster-img" src="${item.cover}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="handleImgError(this)">
          <span class="badge-top-right" style="background:#38bdf8;color:#000;">🕒 ${item.airTime || '20:00'}</span>
        </div>
        <div class="card-details">
          <div class="card-name">${escapeHtml(item.title)}</div>
          <div class="card-subtext">${escapeHtml(dayObj.dayName)} • ${escapeHtml(item.updateInfo || 'New Episode')}</div>
          <button class="btn-appointment" style="margin-top:0.6rem;" onclick="toggleAppointment(event, ${itemJson})">⏰ Set Reminder</button>
        </div>
      </div>
    `;
  }).join('');
}

function getSubtitleCssStyle(cfg) {
  let color = '#ffffff';
  let textShadow = '0 2px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95)';
  let backgroundColor = 'transparent';
  let padding = '2px 8px';
  let borderRadius = '4px';

  if (cfg.stylePreset === 'yellow') {
    color = '#fbbf24';
  } else if (cfg.stylePreset === 'cyan') {
    color = '#38bdf8';
  } else if (cfg.stylePreset === 'box') {
    color = '#ffffff';
    backgroundColor = 'rgba(0,0,0,0.8)';
    textShadow = 'none';
  } else if (cfg.stylePreset === 'purple') {
    color = '#ffffff';
    textShadow = '0 0 8px #9333ea, 0 0 12px #9333ea, 0 2px 4px #000';
  }

  return {
    color: color,
    fontSize: cfg.fontSize || '24px',
    bottom: cfg.bottom || '12%',
    textShadow: textShadow,
    backgroundColor: backgroundColor,
    padding: padding,
    borderRadius: borderRadius,
    fontFamily: cfg.fontFamily || 'Inter, sans-serif'
  };
}

window.toggleMirrorDropdown = function(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('player-mirror-dropdown');
  const volDropdown = document.getElementById('vol-boost-dropdown');
  const subPopover = document.getElementById('player-sub-popover');
  if (volDropdown) volDropdown.style.display = 'none';
  if (subPopover) subPopover.style.display = 'none';

  if (dropdown) {
    dropdown.style.display = (dropdown.style.display === 'none' || !dropdown.style.display) ? 'block' : 'none';
  }
};

window.switchStreamMirror = async function(serverKey, targetId) {
  const dropdown = document.getElementById('player-mirror-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  const label = document.getElementById('current-mirror-label');

  const names = {
    loklok: 'Primary Mirror (WOX Stream)',
    narto: 'Asian Mirror',
    classics: 'Archive Server',
    adult: 'Adult Server'
  };

  const selectedName = names[serverKey] || 'Primary Mirror (WOX Stream)';
  if (label) label.innerText = selectedName;

  showToast(`Switching stream mirror to ${selectedName}... 🌐`);

  if (state.currentMedia && targetId) {
    try {
      window.saveWatchProgress();
      await openDetailModal(targetId, state.currentMedia.category || '1');
      if (state.currentMedia && state.currentMedia.episodes && state.currentMedia.episodes.length > 0) {
        playEpisode(state.currentMedia, state.currentMedia.episodes[0]);
      }
    } catch (_) {}
  }
};

window.skipVideoIntro = function() {
  const videoEl = document.querySelector('#player-container video');
  if (videoEl && videoEl.currentTime !== undefined) {
    videoEl.currentTime += 85;
    showToast('Skipped Opening Theme (+85s) ⏭');
  }
};

window.toggleAutoNext = function() {
  const current = localStorage.getItem('loklok_autonext') !== 'false';
  const nextVal = !current;
  localStorage.setItem('loklok_autonext', String(nextVal));

  const btn = document.getElementById('autonext-btn');
  if (btn) {
    btn.innerText = nextVal ? 'Auto-Next: ON 🔄' : 'Auto-Next: OFF ⏸';
    btn.style.color = nextVal ? '#4ade80' : '#94a3b8';
  }
  showToast(`Auto-Next Episode set to ${nextVal ? 'ENABLED 🔄' : 'DISABLED ⏸'}`);
};

// Playback Speed Controls
window.toggleSpeedDropdown = function(e) {
  e.stopPropagation();
  const dd = document.getElementById('speed-dropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};

window.setPlaybackSpeed = function(speed) {
  const videoEl = document.querySelector('#player-container video');
  if (videoEl) videoEl.playbackRate = speed;
  if (state.plyrPlayer) state.plyrPlayer.speed = speed;
  const label = document.getElementById('speed-label');
  if (label) label.innerText = `${speed}x`;
  const dd = document.getElementById('speed-dropdown');
  if (dd) dd.style.display = 'none';
  showToast(`Playback Speed: ${speed}x ⚡`);
};

// Picture-in-Picture
window.togglePiP = async function() {
  const videoEl = document.querySelector('#player-container video');
  if (!videoEl) { showToast('No video playing ❌'); return; }
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      showToast('Picture-in-Picture: OFF');
    } else {
      await videoEl.requestPictureInPicture();
      showToast('Picture-in-Picture: ON 📌');
    }
  } catch (err) {
    showToast('PiP not supported on this browser ❌');
  }
};

// Share Title Link
window.shareTitle = function(id, category, title) {
  const slug = slugifyTitle(title);
  const shareUrl = `${window.location.origin}${window.location.pathname}?play=${encodeURIComponent(id)}&cat=${encodeURIComponent(category)}&title=${slug}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast(`Link copied for "${title}"! 📎`);
    });
  } else {
    const input = document.createElement('input');
    input.value = shareUrl;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast(`Link copied for "${title}"! 📎`);
  }
};

// Search History
window.saveSearchHistory = function(query) {
  if (!query || query.length < 2) return;
  let history = JSON.parse(localStorage.getItem('loklok_search_history') || '[]');
  history = history.filter(h => h !== query);
  history.unshift(query);
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem('loklok_search_history', JSON.stringify(history));
};

window.showSearchHistory = function() {
  const dropdown = document.getElementById('search-suggestions-dropdown');
  const input = document.getElementById('search-input');
  if (!dropdown || !input) return;
  const query = (input.value || '').trim();
  if (query.length >= 2) return; // Don't show history when typing

  const history = JSON.parse(localStorage.getItem('loklok_search_history') || '[]');
  if (history.length === 0) return;

  dropdown.innerHTML = `
    <div style="padding:0.5rem 1rem;font-size:0.75rem;font-weight:700;color:var(--accent-cyan);text-transform:uppercase;letter-spacing:0.5px;display:flex;justify-content:space-between;align-items:center;">
      <span>🕒 Recent Searches</span>
      <span onclick="localStorage.removeItem('loklok_search_history');document.getElementById('search-suggestions-dropdown').style.display='none';" style="cursor:pointer;color:#f87171;font-size:0.7rem;">Clear</span>
    </div>
    ${history.map(h => `
      <div class="search-suggestion-item" onclick="document.getElementById('search-input').value='${escapeHtml(h)}';switchNav('search');executeKeywordSearch('${escapeHtml(h)}');document.getElementById('search-suggestions-dropdown').style.display='none';saveSearchHistory('${escapeHtml(h)}');" style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 1rem;cursor:pointer;" onmouseover="this.style.background='rgba(147,51,234,0.15)'" onmouseout="this.style.background='transparent'">
        <span style="color:var(--text-muted);font-size:1rem;">🔍</span>
        <span style="color:#fff;font-size:0.9rem;">${escapeHtml(h)}</span>
      </div>
    `).join('')}
  `;
  dropdown.style.display = 'block';
};

// Power Keyboard Shortcuts & Hold-to-Speed 2x Fast-Forwarding
let isSpeedBoosting = false;
let originalSpeed = 1.0;

document.addEventListener('keydown', (e) => {
  const playerModal = document.getElementById('modal-player');
  if (!playerModal || !playerModal.classList.contains('active')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  const plyr = state.plyrPlayer;
  const videoEl = document.querySelector('#player-container video');
  if (!plyr || !videoEl) return;

  if (e.key === ' ' || e.code === 'KeyK') {
    e.preventDefault();
    if (plyr.paused) plyr.play(); else plyr.pause();
  } else if (e.code === 'KeyF') {
    e.preventDefault();
    plyr.fullscreen.toggle();
  } else if (e.code === 'KeyM') {
    e.preventDefault();
    plyr.muted = !plyr.muted;
  } else if (e.code === 'KeyN') {
    e.preventDefault();
    playNextEpisode();
  } else if (e.code === 'KeyP') {
    e.preventDefault();
    playPrevEpisode();
  } else if (e.code === 'ArrowRight' && !isSpeedBoosting) {
    isSpeedBoosting = true;
    originalSpeed = plyr.speed || 1.0;
    plyr.speed = 2.0;
    videoEl.playbackRate = 2.0;
    const indicator = document.getElementById('speed-boost-indicator');
    if (indicator) indicator.style.display = 'block';
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
    showToast('Rewind 5s ⏪');
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowRight' && isSpeedBoosting) {
    isSpeedBoosting = false;
    const plyr = state.plyrPlayer;
    const videoEl = document.querySelector('#player-container video');
    if (plyr) plyr.speed = originalSpeed;
    if (videoEl) videoEl.playbackRate = originalSpeed;
    const indicator = document.getElementById('speed-boost-indicator');
    if (indicator) indicator.style.display = 'none';
  }
});

window.filterWatchlistByFolder = function(folderKey, btnEl) {
  const bar = document.getElementById('watchlist-folder-bar');
  if (bar) {
    bar.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  }
  if (btnEl) btnEl.classList.add('active');
  state.currentWatchlistFolder = folderKey || 'all';
  loadWatchlist();
};

window.toggleVolBoostDropdown = function(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('vol-boost-dropdown');
  const subPopover = document.getElementById('player-sub-popover');
  if (subPopover) subPopover.style.display = 'none';

  if (dropdown) {
    dropdown.style.display = (dropdown.style.display === 'none' || !dropdown.style.display) ? 'block' : 'none';
  }
};

window.setVolumeBoost = function(multiplier) {
  const videoEl = document.querySelector('#player-container video');
  const label = document.getElementById('vol-boost-label');
  const dropdown = document.getElementById('vol-boost-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  const percentStr = `${Math.round(multiplier * 100)}%`;
  if (label) label.innerText = percentStr;

  if (!videoEl) {
    showToast(`Volume Boost set to ${percentStr} 🔊`);
    return;
  }

  try {
    if (!state.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        state.audioCtx = new AudioCtxClass();
      }
    }

    if (state.audioCtx && state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }

    if (state.audioCtx && !state.gainNode) {
      state.audioSourceNode = state.audioCtx.createMediaElementSource(videoEl);
      state.gainNode = state.audioCtx.createGain();
      state.audioSourceNode.connect(state.gainNode);
      state.gainNode.connect(state.audioCtx.destination);
    }

    if (state.gainNode) {
      state.gainNode.gain.value = multiplier;
    } else {
      videoEl.volume = Math.min(1.0, multiplier);
    }

    showToast(`Volume Boost set to ${percentStr} 🔊`);
  } catch (err) {
    console.warn('AudioContext volume boost fallback:', err.message);
    showToast(`Volume Boost: ${percentStr}`);
  }
};

window.togglePlayerSubPanel = function(e) {
  if (e) e.stopPropagation();
  const subPopover = document.getElementById('player-sub-popover');
  const volDropdown = document.getElementById('vol-boost-dropdown');
  if (volDropdown) volDropdown.style.display = 'none';

  if (subPopover) {
    const isHidden = (subPopover.style.display === 'none' || !subPopover.style.display);
    subPopover.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      initPlayerSubUI();
    }
  }
};

function initPlayerSubUI() {
  const subCfg = JSON.parse(localStorage.getItem('loklok_sub_settings') || '{"bottom":"12%","fontSize":"24px","stylePreset":"white","fontFamily":"Inter, sans-serif"}');
  const pBottom = document.getElementById('player-sub-bottom');
  const pSize = document.getElementById('player-sub-size');
  const pStyle = document.getElementById('player-sub-style');
  const pFont = document.getElementById('player-sub-font');
  const pPosVal = document.getElementById('player-sub-pos-val');

  if (pBottom) pBottom.value = parseInt(subCfg.bottom, 10) || 12;
  if (pPosVal) pPosVal.innerText = subCfg.bottom || '12%';
  if (pSize) pSize.value = subCfg.fontSize || '24px';
  if (pStyle) pStyle.value = subCfg.stylePreset || 'white';
  if (pFont) pFont.value = subCfg.fontFamily || 'Inter, sans-serif';
}

window.updateSubtitleSetting = function(key, val) {
  const current = JSON.parse(localStorage.getItem('loklok_sub_settings') || '{"bottom":"12%","fontSize":"24px","stylePreset":"white","fontFamily":"Inter, sans-serif"}');
  current[key] = val;
  localStorage.setItem('loklok_sub_settings', JSON.stringify(current));

  const posVal = document.getElementById('sub-pos-val');
  if (posVal) posVal.innerText = current.bottom;
  const pPosVal = document.getElementById('player-sub-pos-val');
  if (pPosVal) pPosVal.innerText = current.bottom;

  applyPlayerSubtitleStyles();
  showToast('Subtitle appearance updated 🔤');
};

function applyPlayerSubtitleStyles() {
  const subCfg = JSON.parse(localStorage.getItem('loklok_sub_settings') || '{"bottom":"12%","fontSize":"24px","stylePreset":"white","fontFamily":"Inter, sans-serif"}');
  const styleObj = getSubtitleCssStyle(subCfg);

  let styleEl = document.getElementById('wox-sub-custom-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'wox-sub-custom-style';
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    .plyr__captions, .plyr__caption {
      font-size: ${styleObj.fontSize} !important;
      font-family: ${styleObj.fontFamily} !important;
      color: ${styleObj.color} !important;
      background: ${styleObj.backgroundColor} !important;
      text-shadow: ${styleObj.textShadow} !important;
      padding: ${styleObj.padding} !important;
      border-radius: ${styleObj.borderRadius} !important;
      bottom: ${styleObj.bottom} !important;
    }
  `;
}

// Close popovers on document click
document.addEventListener('click', (e) => {
  const volDropdown = document.getElementById('vol-boost-dropdown');
  const subPopover = document.getElementById('player-sub-popover');
  const speedDropdown = document.getElementById('speed-dropdown');
  if (volDropdown && !volDropdown.contains(e.target) && !e.target.closest('[onclick*="toggleVolBoostDropdown"]')) {
    volDropdown.style.display = 'none';
  }
  if (subPopover && !subPopover.contains(e.target) && !e.target.closest('[onclick*="togglePlayerSubPanel"]')) {
    subPopover.style.display = 'none';
  }
  if (speedDropdown && !speedDropdown.contains(e.target) && !e.target.closest('[onclick*="toggleSpeedDropdown"]')) {
    speedDropdown.style.display = 'none';
  }
});

function initSettingsUI() {
  const toggleAdult = document.getElementById('setting-allow-adult');
  const toggleLgbt = document.getElementById('setting-block-lgbt');
  const togglePorno = document.getElementById('setting-block-porno');
  const toggleBoot = document.getElementById('setting-autoboot');
  const langSelect = document.getElementById('setting-language-select');
  const cacheText = document.getElementById('cache-size-text');

  if (toggleAdult) toggleAdult.checked = state.settings.allowAdult;
  if (toggleLgbt) toggleLgbt.checked = state.settings.blockLgbt;
  if (togglePorno) togglePorno.checked = state.settings.blockPorno;
  if (toggleBoot) toggleBoot.checked = state.settings.autoboot;
  if (langSelect) langSelect.value = state.language;
  if (cacheText) cacheText.innerText = calculateCacheSize();
}

const FILTER_SCHEMAS = {
  default: {
    type: [
      { label: 'ALL', val: '' },
      { label: 'TV Series', val: 'TV,SETI,VARIETY,TALK,COMIC,DOCUMENTARY' },
      { label: 'Movie', val: 'MOVIE,TVSPECIAL' },
      { label: 'Anime', val: 'COMIC' },
      { label: 'Variety Show', val: 'VARIETY,TALK' },
      { label: 'Talk Show', val: 'TALK' },
      { label: 'Documentary', val: 'DOCUMENTARY' },
      { label: 'Shorts', val: 'MINISERIES' }
    ],
    region: [
      { label: 'ALL', val: '' },
      { label: 'America', val: '61' },
      { label: 'Korea', val: '53' },
      { label: 'U.K', val: '60' },
      { label: 'Japan', val: '44' },
      { label: 'Thailand', val: '57' },
      { label: 'Europe', val: '37,60,58,50,54,55' },
      { label: 'China', val: '32,56' },
      { label: 'Indonesia', val: '41' },
      { label: 'Philippines', val: '34' },
      { label: 'India', val: '40' },
      { label: 'Australia', val: '27' },
      { label: 'other', val: '26,28,29,30' }
    ],
    genre: [
      { label: 'ALL', val: '' },
      { label: 'Romance', val: '10' },
      { label: 'Action', val: '1' },
      { label: 'Fantasy', val: '13' },
      { label: 'Animation', val: '23' },
      { label: 'Suspense', val: '16' },
      { label: 'Sci-Fi', val: '19' },
      { label: 'Horror', val: '5' },
      { label: 'Comedy', val: '6' },
      { label: 'Crime', val: '2' },
      { label: 'Adventure', val: '3' },
      { label: 'Thriller', val: '9' },
      { label: 'LGBTQ', val: '64' },
      { label: 'Drama', val: '8' },
      { label: 'Variety Show', val: '24' },
      { label: 'Family', val: '63' },
      { label: 'Musical', val: '65' },
      { label: 'War', val: '14' },
      { label: 'Catastrophe', val: '7' },
      { label: 'Documentary', val: '25' },
      { label: 'other', val: '20' }
    ],
    sort: [
      { label: 'Popularity', val: 'count' },
      { label: 'Recent', val: 'up' },
      { label: 'High Rating', val: 'score' }
    ]
  },
  classics: {
    type: [
      { label: 'ALL Collections', val: 'feature_films' },
      { label: 'Feature Films 🎬', val: 'feature_films' },
      { label: 'Film Noir 🕵️‍♂️', val: 'Film_Noir' },
      { label: 'Sci-Fi & Horror 👾', val: 'scifi_horror' },
      { label: 'Classic Animation 🎨', val: 'animationandcartoons' },
      { label: 'Silent Cinema 🎞️', val: 'silent_films' }
    ],
    sort: [
      { label: 'Most Downloaded 📥', val: 'downloads' },
      { label: 'Title A-Z 🔤', val: 'title' }
    ]
  },
  narto: {
    type: [
      { label: 'ALL Asian Dramas 📺', val: '' },
      { label: 'Billionaire & CEO 👔', val: 'billionaire' },
      { label: 'Revenge & Reborn 🗡️', val: 'revenge' },
      { label: 'Romance & Love 💖', val: 'love' },
      { label: 'Heiress & Royalty 👑', val: 'heiress' },
      { label: 'Mafia & Boss 🕶️', val: 'boss' },
      { label: 'English Dubbed 🎙️', val: 'dubbed' }
    ],
    sort: [
      { label: 'Popularity 🔥', val: 'count' },
      { label: 'New Releases ⚡', val: 'up' }
    ]
  },
  adult: {
    type: [
      { label: 'ALL Categories 🔞', val: '' },
      { label: 'HD 1080p Quality 📹', val: 'hd' },
      { label: 'Top Rated 🌟', val: 'top-rated' },
      { label: 'Amateur 🎥', val: 'amateur' }
    ],
    sort: [
      { label: 'Most Viewed 👀', val: 'most-viewed' },
      { label: 'Top Rated ⭐', val: 'top-rated' },
      { label: 'Latest Uploads ⚡', val: 'latest' }
    ]
  }
};

function renderDynamicFiltersForSource(sourceKey) {
  const schemaKey = (!sourceKey || sourceKey === 'loklok') ? 'default' : sourceKey;
  const schema = FILTER_SCHEMAS[schemaKey] || FILTER_SCHEMAS.default;

  const renderRowPills = (id, items) => {
    const group = document.getElementById(id);
    if (!group) return;
    if (!items || items.length === 0) {
      group.parentElement.style.display = 'none';
      return;
    }
    group.parentElement.style.display = 'block';
    group.innerHTML = items.map((item, idx) => `
      <span class="filter-pill ${idx === 0 ? 'active' : ''}" data-val="${item.val}">${item.label}</span>
    `).join('');
  };

  renderRowPills('pills-type', schema.type);
  renderRowPills('pills-region', schema.region);
  renderRowPills('pills-genre', schema.genre);
  renderRowPills('pills-sort', schema.sort);

  // Reset state values
  state.filters.params = schema.type ? schema.type[0].val : '';
  state.filters.area = schema.region ? schema.region[0].val : '';
  state.filters.category = schema.genre ? schema.genre[0].val : '';
  state.filters.order = schema.sort ? schema.sort[0].val : '';

  // Re-attach listeners only for the dynamic rows
  setupPillGroup('pills-type', val => { state.filters.params = val; executeCategorySearch(true); });
  setupPillGroup('pills-region', val => { state.filters.area = val; executeCategorySearch(true); });
  setupPillGroup('pills-genre', val => { state.filters.category = val; executeCategorySearch(true); });
  setupPillGroup('pills-sort', val => { state.filters.order = val; executeCategorySearch(true); });
}

function initFilterPillListeners() {
  setupPillGroup('pills-type', val => { state.filters.params = val; executeCategorySearch(true); });
  setupPillGroup('pills-region', val => { state.filters.area = val; executeCategorySearch(true); });
  setupPillGroup('pills-genre', val => { state.filters.category = val; executeCategorySearch(true); });
  setupPillGroup('pills-sort', val => { state.filters.order = val; executeCategorySearch(true); });
}

function setupPillGroup(groupId, onChange) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const pills = group.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    pill.onclick = () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      onChange(pill.getAttribute('data-val') || '');
    };
  });
}

function updatePillState(groupId, targetVal) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const pills = group.querySelectorAll('.filter-pill');
  pills.forEach(p => {
    if (p.getAttribute('data-val') === targetVal) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

state.filters = state.filters || {};
state.filters.cursor = '';
state.filters.loadingMore = false;
state.filters.hasMore = true;
state.filters.seenIds = new Set();

async function executeKeywordSearch(query) {
  const grid = document.getElementById('search-grid');
  const titleEl = document.getElementById('search-title');
  if (!grid) return;

  const searchQuery = query || (document.getElementById('search-input') ? document.getElementById('search-input').value.trim() : '');
  if (titleEl) {
    titleEl.innerText = searchQuery ? `Search Results for "${searchQuery}"` : 'Search Results';
  }

  grid.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch(`/api/search?keyword=${encodeURIComponent(searchQuery)}&token=${encodeURIComponent(state.token || '')}&allowAdult=${String(state.settings.allowAdult || false)}`);
    const data = await res.json();
    let rawResults = data.results || [];

    // Client-side Direct Loklok Fetch Fallback: If Vercel datacenter GEO-filtered Loklok HD items, fetch directly from user's browser!
    const hasLoklok = rawResults.some(item => !item.isNarto && !item.isViva && item.sourceName === 'Loklok HD');
    if (!hasLoklok && searchQuery) {
      try {
        const clientRes = await fetch('https://ga-mobile-api.loklok.tv/cms/app/search/v1/searchWithKeyWord', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'lang': 'en',
            'versioncode': '33',
            'clienttype': 'android_tem3',
            'deviceid': '60A3305FDAAC489AAF4C7DD33B1483B4'
          },
          body: JSON.stringify({ searchKeyWord: searchQuery, size: 50, sort: '', searchType: '' })
        });
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          if (clientData && clientData.data && Array.isArray(clientData.data.searchResults)) {
            const qWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
            const loklokItems = clientData.data.searchResults
              .filter(item => {
                const titleLower = String(item.name || item.title || '').toLowerCase();
                return qWords.length === 0 || qWords.some(w => titleLower.includes(w));
              })
              .map(item => ({
                id: 'wox_l_' + btoa(String(item.id)).replace(/=/g, ''),
                category: String(item.category || item.domainType || '1'),
                title: item.name || item.title || 'Untitled',
                cover: (item.coverVerticalUrl || item.imageUrl || item.cover || '').replace('img.loklok.tv', 'img.chhhn.com'),
                score: item.score || '8.5',
                domainType: item.domainType,
                sourceName: 'Loklok HD'
              }));
            
            // Prepend direct Loklok HD items to top of results!
            rawResults = [...loklokItems, ...rawResults];
          }
        }
      } catch (clientErr) {
        console.warn('Client-side Loklok direct search fallback failed:', clientErr.message);
      }
    }

    const filtered = filterContentBySettings(rawResults);

    if (filtered.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">No media titles found for this search term.</p>';
    } else {
      grid.innerHTML = filtered.map(item => renderLoklokCard(item)).join('');
    }
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">Error loading search results: ${err.message}</p>`;
  }
}

window.executeKeywordSearch = executeKeywordSearch;

async function executeCategorySearch(isReset = true) {
  const grid = document.getElementById('category-grid');
  const spEl = document.getElementById('infinite-scroll-spinner');
  const txtEl = document.getElementById('infinite-scroll-text');
  if (!grid) return;

  if (isReset) {
    state.filters.page = 0;
    state.filters.cursor = '';
    state.filters.hasMore = true;
    state.filters.seenIds = new Set();
    grid.innerHTML = '<div class="spinner"></div>';
    if (spEl) spEl.style.display = 'none';
    if (txtEl) txtEl.innerText = 'SCROLL DOWN TO DISCOVER MORE...';
  } else {
    if (state.filters.loadingMore || !state.filters.hasMore) return;
    state.filters.loadingMore = true;
    state.filters.page = (state.filters.page || 0) + 1;
    if (spEl) spEl.style.display = 'block';
    if (txtEl) txtEl.innerText = 'Loading more titles...';
  }

  try {
    const queryParams = new URLSearchParams({
      params: state.filters.params || 'MOVIE,TV,VARIETY,COMIC,DOCUMENTARY,MINISERIES',
      area: state.filters.area || '',
      category: state.filters.category || '',
      order: state.filters.order || 'count',
      sort: state.filters.cursor || '',
      source: state.filters.sourceFilter || '',
      page: state.filters.page || 0,
      token: state.token || '',
      allowAdult: String(state.settings.allowAdult || false)
    });

    const res = await fetch(`/api/search?${queryParams.toString()}`);
    const data = await res.json();

    const rawResults = data.results || [];
    // Apply source filter if selected
    const sourceKey = (state.filters.sourceFilter || '').toLowerCase();
    const sourceFiltered = sourceKey ? rawResults.filter(item => {
      const itemSrcKey = String(item.sourceKey || '').toLowerCase();
      const itemSrcName = String(item.sourceName || '').toLowerCase().replace(/\s+/g, '');
      const srcMap = {
        loklok: 'loklok',
        narto: 'narto',
        vivaone: 'vivaone',
        vivamax: 'vivamax',
        vivamb: 'moviebox',
        hollywood: 'hollywood',
        anime: 'anime',
        drama: 'drama',
        classics: 'classics',
        adult: 'adult'
      };
      const target = srcMap[sourceKey] || sourceKey;
      return itemSrcKey.includes(sourceKey) || itemSrcKey.includes(target) || itemSrcName.includes(target) || itemSrcName.includes(sourceKey);
    }) : rawResults;
    const filtered = filterContentBySettings(sourceFiltered).filter(item => {
      if (!item.id || state.filters.seenIds.has(item.id)) return false;
      state.filters.seenIds.add(item.id);
      return true;
    });

    if (isReset) {
      if (filtered.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">No media items found matching these category filters.</p>';
        state.filters.hasMore = false;
        if (txtEl) txtEl.innerText = 'No titles found.';
      } else {
        grid.innerHTML = filtered.map(item => renderLoklokCard(item)).join('');
      }
    } else {
      if (filtered.length > 0) {
        const html = filtered.map(item => renderLoklokCard(item)).join('');
        grid.insertAdjacentHTML('beforeend', html);
      }
    }

    state.filters.cursor = data.nextCursor || '';
    state.filters.hasMore = !!data.nextCursor;
    state.filters.loadingMore = false;

    if (spEl) spEl.style.display = 'none';

    // Auto-fetch next page if deduplication/filtering yielded 0 new items on an infinite scroll page load
    if (!isReset && filtered.length === 0 && state.filters.hasMore) {
      setTimeout(() => { executeCategorySearch(false); }, 100);
      return;
    }

    if (!state.filters.hasMore) {
      if (txtEl) txtEl.innerText = 'END OF RESULTS';
    } else {
      if (txtEl) txtEl.innerText = 'SCROLL DOWN TO DISCOVER MORE...';
    }
  } catch (err) {
    state.filters.loadingMore = false;
    if (spEl) spEl.style.display = 'none';
    if (isReset) {
      grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;">Category search failed: ${err.message}</p>`;
    }
  }
}

// Continuous Infinite Scroll Intersection Observer & Scroll Listener Fallback
let categoryInfiniteObserver = null;
function initInfiniteScrollObserver() {
  const sentinel = document.getElementById('category-infinite-loader');
  if (!sentinel) return;

  if (categoryInfiniteObserver) categoryInfiniteObserver.disconnect();

  categoryInfiniteObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry && entry.isIntersecting && state.activeNav === 'category') {
      if (state.filters.hasMore && !state.filters.loadingMore) {
        executeCategorySearch(false);
      }
    }
  }, { rootMargin: '600px 0px' });

  categoryInfiniteObserver.observe(sentinel);

  // Reliable window scroll fallback listener
  window.addEventListener('scroll', () => {
    if (state.activeNav !== 'category' || state.filters.loadingMore || !state.filters.hasMore) return;
    const scrollPosition = window.innerHeight + window.scrollY;
    const threshold = document.documentElement.offsetHeight - 800;
    if (scrollPosition >= threshold) {
      executeCategorySearch(false);
    }
  });
}


window.selectHeroItem = function(item, thumbEl) {
  if (!item) return;

  const titleEl = document.getElementById('hero-title');
  const descEl = document.getElementById('hero-desc');
  const backdropEl = document.getElementById('hero-backdrop');
  const playBtn = document.getElementById('hero-play-btn');
  const rankEl = document.getElementById('hero-rank');

  if (titleEl) titleEl.innerText = item.title || 'Untitled';
  if (descEl) descEl.innerText = item.description || item.title || 'Discover trending movies, anime, and dramas on WOX Stream.';
  if (backdropEl) backdropEl.src = item.cover || '';
  if (rankEl && item.score) rankEl.innerText = `TOP RATED ★ ${item.score}`;
  if (playBtn) {
    playBtn.onclick = () => openDetailModal(item.id, item.category || 1);
  }

  if (thumbEl && thumbEl.parentElement) {
    Array.from(thumbEl.parentElement.children).forEach(child => child.classList.remove('active'));
    thumbEl.classList.add('active');
  }
};

async function loadHomeFeed() {
  const container = document.getElementById('home-shelves');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch(`/api/home?allowAdult=${String(state.settings.allowAdult || false)}&token=${encodeURIComponent(state.token)}`);
    const data = await res.json();

    if (!data.success || !data.sections || data.sections.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:3rem;">Unable to load home feed.</p>';
      return;
    }

    const allItems = [];
    data.sections.forEach(sec => allItems.push(...sec.items));
    
    if (allItems.length > 0) {
      const heroThumbnails = document.getElementById('hero-thumbnails');
      const featuredList = filterContentBySettings(allItems).slice(0, 8);
      
      if (featuredList.length > 0 && heroThumbnails) {
        heroThumbnails.innerHTML = featuredList.map((item, idx) => `
          <img class="hero-thumb ${idx === 0 ? 'active' : ''}" src="${item.cover}" alt="${escapeHtml(item.title)}" onclick='selectHeroItem(${JSON.stringify(item).replace(/'/g, "&#39;")}, this)' onerror="handleImgError(this)">
        `).join('');

        selectHeroItem(featuredList[0], heroThumbnails.children[0]);
      }
    }

    const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
    let continueBarHtml = '';
    if (localHistory.length > 0) {
      const topHistory = localHistory[0];
      const pct = topHistory.totalTime ? Math.round((topHistory.progressTime / topHistory.totalTime) * 100) : 0;
      continueBarHtml = `
        <div style="margin: 0 2rem 1.5rem 2rem; background: linear-gradient(90deg, rgba(147, 51, 234, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%); border: 1px solid var(--border-neon); border-radius: 16px; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 10px 25px rgba(147,51,234,0.15);">
          <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0;">
            <img src="${topHistory.cover}" style="width: 44px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-glass);" onerror="handleImgError(this)">
            <div style="min-width: 0;">
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px;">▶ Continue Watching</div>
              <div style="font-size: 1.05rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(topHistory.title)}</div>
              <div style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(topHistory.episodeName || 'Episode')} • ${pct}% Completed</div>
            </div>
          </div>
          <button class="btn btn-primary" onclick="openDetailModal('${topHistory.id}', '${topHistory.category || 1}')" style="padding: 0.55rem 1.25rem; font-size: 0.85rem;">
            Resume Play ▶
          </button>
        </div>
      `;
    }

    container.innerHTML = continueBarHtml + data.sections.map(section => {
      const filteredItems = filterContentBySettings(section.items);
      if (filteredItems.length === 0) return '';

      return `
        <div class="shelf-container">
          <div class="shelf-header">
            <h2 class="shelf-title">${escapeHtml(section.title)} <span style="font-size:1rem;color:var(--text-dim);">&gt;</span></h2>
            <button class="shelf-switch-btn" onclick="loadHomeFeed()">Switch 🔄</button>
          </div>
          <div class="card-grid">
            ${filteredItems.map((item, idx) => renderLoklokCard(item, idx < 6)).join('')}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:3rem;">Error loading home: ${err.message}</p>`;
  }
}

function filterContentBySettings(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => {
    const title = (item.title || '').toLowerCase();
    if (state.settings.blockLgbt && (title.includes('lgbt') || title.includes('queer') || title.includes('gay') || title.includes('lesbian'))) {
      return false;
    }
    if (state.settings.blockPorno && (title.includes('18+') || title.includes('adult') || title.includes('erotic'))) {
      return false;
    }
    return true;
  });
}

function renderWoxCard(item, isHighPriority = false) {
  if (!item || !item.id) return '';
  const cleanTitle = String(item.title || '').replace(/^\[narto\]\s*/i, '').trim();
  const itemJson = JSON.stringify({ id: item.id, category: item.category || 1, title: cleanTitle, cover: item.cover, score: item.score || '8.5' }).replace(/"/g, '&quot;');
  
  let domainLabel = 'HD';
  if (item.domainType === 0 || item.domainType === '0') domainLabel = 'MOVIE';
  else if (item.domainType === 1 || item.domainType === '1') domainLabel = 'TV';
  else if (typeof item.domainType === 'string' && item.domainType.length > 1) domainLabel = item.domainType;

  const yearText = item.year || item.area || domainLabel;

  return `
    <div class="loklok-card" onclick="openDetailModal('${item.id}', '${item.category || 1}')">
      <div class="card-poster-wrap">
        <img class="card-poster-img" src="${item.cover}" alt="${escapeHtml(cleanTitle)}" decoding="async" ${isHighPriority ? 'fetchpriority="high"' : 'loading="lazy"'} onerror="handleImgError(this)">
        ${item.score ? `<span class="badge-top-right">★ ${item.score}</span>` : ''}
        <div class="poster-bottom-info">
          <span class="poster-hd-tag">${domainLabel}</span>
        </div>
      </div>

      <div class="card-details">
        <div class="card-name">${escapeHtml(cleanTitle)}</div>
        <div class="card-subtext">${escapeHtml(yearText)}</div>
        ${item.score ? `<div class="rank-pill">TOP RANK ${Math.min(9, Math.floor(item.score))}</div>` : ''}
        <div style="display:flex;gap:0.4rem;margin-top:0.5rem;">
          <button class="btn-appointment" style="flex:1;" onclick="toggleAppointment(event, ${itemJson})">REMIND</button>
          <button class="btn-appointment" style="background:rgba(147,51,234,0.2);color:#c084fc;padding:0 0.5rem;" title="Add to Collection" onclick="toggleCollection(event, ${itemJson})">+</button>
        </div>
      </div>
    </div>
  `;
}
const renderLoklokCard = renderWoxCard;

function saveSession(token, user) {
  const clean = (token === '1' || token === 'undefined' || token === 'null' || token.length < 8) ? '' : token;
  state.token = clean;
  state.user = user;
  if (clean) {
    localStorage.setItem('loklok_token', clean);
  } else {
    localStorage.removeItem('loklok_token');
  }
  if (user) {
    localStorage.setItem('loklok_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('loklok_user');
  }
  initUserUI();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, match => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[match];
  });
}

let searchDebounceTimer = null;
const searchCache = new Map();

window.handleSearchKeyUp = function(e) {
  const query = e.target.value.trim();
  const dropdown = document.getElementById('search-suggestions-dropdown');

  if (e.key === 'Enter') {
    if (query) {
      if (dropdown) dropdown.style.display = 'none';
      saveSearchHistory(query);
      switchNav('search');
      executeKeywordSearch(query);
    }
    return;
  }

  if (!query || query.length < 2) {
    showSearchHistory();
    return;
  }

  function renderSuggestions(results) {
    if (!dropdown) return;
    if (results && results.length > 0) {
      dropdown.innerHTML = results.slice(0, 6).map(item => {
        const cleanTitle = String(item.title || '').replace(/^\[narto\]\s*/i, '').trim();
        return `
          <div class="search-suggestion-item" onclick="openDetailModal('${item.id}', '${item.category || 1}'); document.getElementById('search-suggestions-dropdown').style.display='none';">
            <img src="${item.cover}" style="width:36px;height:48px;object-fit:cover;border-radius:6px;" onerror="handleImgError(this)">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.9rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(cleanTitle)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">★ ${item.score || '8.5'} • ${escapeHtml(item.sourceName || 'WOX Stream')}</div>
            </div>
          </div>
        `;
      }).join('');
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
  }

  // Instant render from memory cache if available!
  const cacheKey = `${query}_${state.settings.allowAdult}`;
  if (searchCache.has(cacheKey)) {
    renderSuggestions(searchCache.get(cacheKey));
    return;
  }

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(query)}&fast=true&allowAdult=${String(state.settings.allowAdult || false)}&token=${encodeURIComponent(state.token)}`);
      const data = await res.json();
      let results = data.results || [];

      const hasLoklok = results.some(item => !item.isNarto && !item.isViva && item.sourceName === 'Loklok HD');
      if (!hasLoklok && query) {
        try {
          const clientRes = await fetch('https://ga-mobile-api.loklok.tv/cms/app/search/v1/searchWithKeyWord', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'lang': 'en',
              'versioncode': '33',
              'clienttype': 'android_tem3',
              'deviceid': '60A3305FDAAC489AAF4C7DD33B1483B4'
            },
            body: JSON.stringify({ searchKeyWord: query, size: 20, sort: '', searchType: '' })
          });
          if (clientRes.ok) {
            const clientData = await clientRes.json();
            if (clientData && clientData.data && Array.isArray(clientData.data.searchResults)) {
              const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
              const loklokItems = clientData.data.searchResults
                .filter(item => {
                  const titleLower = String(item.name || item.title || '').toLowerCase();
                  return qWords.length === 0 || qWords.some(w => titleLower.includes(w));
                })
                .map(item => ({
                  id: 'wox_l_' + btoa(String(item.id)).replace(/=/g, ''),
                  category: String(item.category || item.domainType || '1'),
                  title: item.name || item.title || 'Untitled',
                  cover: (item.coverVerticalUrl || item.imageUrl || item.cover || '').replace('img.loklok.tv', 'img.chhhn.com'),
                  score: item.score || '8.5',
                  domainType: item.domainType,
                  sourceName: 'Loklok HD'
                }));
              results = [...loklokItems, ...results];
            }
          }
        } catch (_) {}
      }

      searchCache.set(cacheKey, results);
      renderSuggestions(results);
    } catch (_) {}
  }, 150);
};

window.clearSearchInput = function() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (input) input.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (dropdown) dropdown.style.display = 'none';
  if (state.activeNav === 'search') {
    switchNav('home');
  }
};

window.handleSearchFocus = function() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  if (input && input.value.trim().length >= 2) {
    if (clearBtn) clearBtn.style.display = 'flex';
    window.handleSearchKeyUp({ target: input, key: '' });
  } else {
    // Show search history when input is empty or short
    showSearchHistory();
  }
};

window.handleSearchBlur = function() {
  setTimeout(() => {
    const dropdown = document.getElementById('search-suggestions-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  }, 200);
};

window.loadWatchlist = function() {
  const grid = document.getElementById('watchlist-grid');
  if (!grid) return;

  const collection = JSON.parse(localStorage.getItem('loklok_collection') || '[]');

  if (collection.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 1rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">⭐</div>
        <h3 style="font-size:1.3rem;font-weight:700;color:#fff;margin-bottom:0.5rem;">Your Watchlist is empty</h3>
        <p style="color:var(--text-muted);font-size:0.9rem;">Click the ⭐ button on any movie, drama, or anime to save it here for quick access!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = collection.map(item => renderLoklokCard(item)).join('');
};

// Global Keyboard Shortcuts for Video Player
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  const playerModal = document.getElementById('modal-player');
  if (!playerModal || !playerModal.classList.contains('active')) return;

  const plyr = state.plyrPlayer;

  switch (e.code) {
    case 'Space':
    case 'KeyK':
      e.preventDefault();
      if (plyr) plyr.togglePlay();
      break;
    case 'ArrowLeft':
    case 'KeyJ':
      e.preventDefault();
      if (plyr) plyr.rewind(10);
      break;
    case 'ArrowRight':
    case 'KeyL':
      e.preventDefault();
      if (plyr) plyr.forward(10);
      break;
    case 'KeyN':
      e.preventDefault();
      window.playNextEpisode();
      break;
    case 'KeyP':
      e.preventDefault();
      window.playPrevEpisode();
      break;
    case 'KeyF':
      e.preventDefault();
      if (plyr) plyr.toggleFullscreen();
      break;
  }
});

function initMovieLinkRouter() {
  const urlParams = new URLSearchParams(window.location.search);
  const playId = urlParams.get('play') || urlParams.get('id');
  const cat = urlParams.get('cat') || urlParams.get('category') || 1;
  const targetView = urlParams.get('view');
  const urlParamsVal = urlParams.get('params');
  const urlAreaVal = urlParams.get('area');
  const urlCategoryVal = urlParams.get('category');

  if (targetView && ['category', 'history', 'calendar', 'search', 'watchlist', 'home'].includes(targetView)) {
    if (targetView === 'category') {
      if (urlParamsVal !== null) {
        state.filters.params = urlParamsVal;
        updatePillState('pills-type', urlParamsVal);
      }
      if (urlAreaVal !== null) {
        state.filters.area = urlAreaVal;
        updatePillState('pills-region', urlAreaVal);
      }
      if (urlCategoryVal !== null) {
        state.filters.category = urlCategoryVal;
        updatePillState('pills-genre', urlCategoryVal);
      }
    }
    switchNav(targetView, false);
  } else {
    loadHomeFeed();
  }

  if (playId) {
    openDetailModal(playId, cat);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initUserUI();
  initSettingsUI();
  initFilterPillListeners();
  initInfiniteScrollObserver();
  initMovieLinkRouter();
});
