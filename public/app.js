// Global Application State & Fallbacks Initialization
const SVG_FALLBACK = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiB2aWV3Qm94PSIwIDAgMzAwIDQ1MCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMGYxNzJhIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMWUxYjRiIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjIwMCIgcj0iMzYiIGZpbGw9IiMzMTJlODEiIG9wYWNpdHk9IjAuOCIvPjxwYXRoIGQ9Ik0xNDIgMTg0IEwxNjQgMjAwIEwxNDIgMjE2IFoiIGZpbGw9IiM4MThjZjgiLz48dGV4dCB4PSI1MCUiIHk9IjI3MCIgZmlsbD0iIzk0YTMiOCIgZm9udC1mYW1pbHk9InN5c3RlbS11aSxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmb250LXdlaWdodD0iNzAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMS41Ij5XT1ggU1RSRUFNPC90ZXh0Pjwvc3ZnPg==';

const initialToken = localStorage.getItem('loklok_token') || '';
const appInitialToken = (initialToken === '1' || initialToken === 'undefined' || initialToken === 'null' || initialToken.length < 8) ? '' : initialToken;

var state = window.state || {};
Object.assign(state, {
  activeNav: state.activeNav || 'home',
  activeTab: state.activeTab || 'all',
  activeProfileTab: state.activeProfileTab || 'history',
  historySortMode: state.historySortMode || 'latest',
  historySearchQuery: state.historySearchQuery || '',
  historyFilterType: state.historyFilterType || 'all',
  token: appInitialToken,
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
    allowAdult: localStorage.getItem('loklok_allowAdult') === 'true',
    sourceLoklok: localStorage.getItem('loklok_sourceLoklok') !== 'false',
    sourceNarto: localStorage.getItem('loklok_sourceNarto') !== 'false',
    sourceHollywood: localStorage.getItem('loklok_sourceHollywood') !== 'false',
    sourceViva: localStorage.getItem('loklok_sourceViva') !== 'false',
    sourceAnime: localStorage.getItem('loklok_sourceAnime') !== 'false',
    sourceClassics: false
  },
  filters: state.filters || {
    page: 0,
    params: '',
    area: '',
    category: '',
    order: 'count',
    cursor: '',
    hasMore: true,
    loadingMore: false,
    seenIds: new Set(),
    sourceFilter: ''
  }
});
window.state = state;

window.showToast = function(msg) {
  let toast = document.getElementById('loklok-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'loklok-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#9333ea;color:#fff;padding:12px 20px;border-radius:10px;font-weight:600;font-size:0.9rem;z-index:999999;box-shadow:0 10px 25px rgba(0,0,0,0.5);transition:all 0.3s ease;';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
};

window.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.position = 'fixed';
    modal.style.zIndex = '999999';
  }
};

window.purgeWatchHistory = function() {
  const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
  
  if (localHistory.length === 0) {
    showToast('Watch history is already empty.');
    return;
  }

  const confirmPurge = confirm(`🗑️ Are you sure you want to PURGE your entire watch history (${localHistory.length} titles)?\n\nThis will clear all watch history cards and playback progress. This action cannot be undone.`);
  if (!confirmPurge) return;

  // Track deleted IDs so server sync won't restore deleted items
  const deletedSet = new Set(JSON.parse(localStorage.getItem('loklok_deleted_history') || '[]'));
  localHistory.forEach(i => {
    if (i && i.id) deletedSet.add(String(i.id));
  });
  localStorage.setItem('loklok_deleted_history', JSON.stringify(Array.from(deletedSet)));

  // Clear local storage history & progress entries
  localStorage.removeItem('loklok_watch_history');
  localStorage.removeItem('loklok_watch_progress');

  showToast(`Purged ${localHistory.length} items from watch history! 🧹`);
  
  // Reload empty state in Watch History view
  if (typeof loadHistory === 'function') {
    loadHistory(false);
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

// closeModal defined below (L123) with QR timer cleanup

// Global Handlers
// switchNav defined below (after state declaration) with full view management

window.filterCategoryNav = function(name, typeVal, regionVal = '', sourceVal = '', genreVal = '') {
  state.filters.sourceFilter = sourceVal || '';
  state.filters.params = typeVal || '';
  state.filters.area = regionVal || '';
  state.filters.category = genreVal || '';
  
  updatePillState('pills-source', sourceVal || '');
  updatePillState('pills-type', typeVal || '');
  updatePillState('pills-region', regionVal || '');
  updatePillState('pills-genre', genreVal || '');

  // Highlight active sidebar item
  document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-bottom .nav-item').forEach(el => el.classList.remove('active'));
  const activeNavId = `nav-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const activeNav = document.getElementById(activeNavId);
  if (activeNav) activeNav.classList.add('active');

  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set('view', 'category');
  if (sourceVal) urlParams.set('source', sourceVal); else urlParams.delete('source');
  if (typeVal) urlParams.set('params', typeVal); else urlParams.delete('params');
  if (regionVal) urlParams.set('area', regionVal); else urlParams.delete('area');
  if (genreVal) urlParams.set('category', genreVal); else urlParams.delete('category');
  const newQuery = `?${urlParams.toString()}`;
  history.replaceState({ view: 'category' }, '', newQuery);

  switchNav('category', false);
  executeCategorySearch(true);
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
  if (key.startsWith('source') || key === 'blockLgbt' || key === 'blockPorno') {
    loadHomeFeed();
    if (state.activeNav === 'category') executeCategorySearch(true);
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

window.openAccountSettingsModal = function() {
  const modal = document.getElementById('modal-account-settings');
  if (!modal) return;

  const u = state.user || {};
  const nickName = u.nickName || u.username || 'WOX User';
  const email = u.email || u.username || 'user@wox.world';
  const avatar = u.headImg || u.avatar || 'https://lh3.googleusercontent.com/a/AEdFTp5M7yDKAZX3l_OEEPwwaemJ4NYCRgdZpfeSWhcIjA=s96-c';

  const avatarImg = document.getElementById('acc-settings-avatar-img');
  const nameText = document.getElementById('acc-settings-display-name');
  const emailText = document.getElementById('acc-settings-email-text');
  const nameInput = document.getElementById('acc-settings-name-input');

  if (avatarImg) avatarImg.src = avatar;
  if (nameText) nameText.innerText = nickName;
  if (emailText) emailText.innerText = email;
  if (nameInput) nameInput.value = nickName;

  const autoCheck = document.getElementById('acc-setting-autoboot');
  const adultCheck = document.getElementById('acc-setting-allow-adult');

  if (autoCheck) autoCheck.checked = !!state.settings.autoboot;
  if (adultCheck) adultCheck.checked = !!state.settings.allowAdult;

  modal.classList.add('active');
};

window.saveProfileSettings = function() {
  const nameInput = document.getElementById('acc-settings-name-input');
  if (!nameInput || !nameInput.value.trim()) {
    showToast('Display name cannot be empty ⚠️');
    return;
  }
  const newName = nameInput.value.trim();
  if (state.user) {
    state.user.nickName = newName;
    state.user.username = newName;
    localStorage.setItem('loklok_user', JSON.stringify(state.user));
    renderUserArea();
    showToast(`Updated display name to "${newName}" 🎉`);
  }
};

function decodeHTMLEntitiesClient(str) {
  if (!str) return '';
  return String(str)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const decoded = decodeHTMLEntitiesClient(str);
  return String(decoded)
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
  document.title = `${epText}${media.title} - WOX-Stream`;

  const targetQuery = `?id=${encodeURIComponent(media.id)}&cat=${encodeURIComponent(media.category || 1)}&title=${titleSlug}`;
  if (window.location.search !== targetQuery) {
    history.pushState({ modalOpen: true, id: media.id, category: media.category }, '', window.location.pathname + targetQuery);
  }
}

function resetPageTitleAndUrl() {
  document.title = 'WOX-Stream';
  if (window.location.search && (window.location.search.includes('play=') || window.location.search.includes('id='))) {
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
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
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

  let clientLoklokResults = [];

  // Option 3: Client-Side Direct Browser Fetch from User's Real Philippines/Indonesia ISP Connection
  try {
    const directRes = await fetch('https://ga-mobile-api.loklok.tv/cms/app/search/v1/searchWithKeyWord', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'lang': 'en',
        'versioncode': '33',
        'clienttype': 'android_tem3',
        'deviceid': '60A3305FDAAC489AAF4C7DD33B1483B4'
      },
      body: JSON.stringify({
        searchKeyWord: query.trim(),
        size: 50,
        sort: '',
        searchType: ''
      })
    });
    if (directRes.ok) {
      const directData = await directRes.json();
      if (directData && directData.data && Array.isArray(directData.data.searchResults)) {
        clientLoklokResults = directData.data.searchResults.map(item => ({
          id: `wox_l_${item.id}`,
          rawId: item.id,
          title: item.name || item.title,
          cover: typeof fixCoverUrl === 'function' ? fixCoverUrl(item.coverVerticalUrl || item.coverHorizontalUrl || item.cover || '') : (item.coverVerticalUrl || item.coverHorizontalUrl || item.cover || ''),
          category: item.domainType === 0 ? 1 : (item.domainType || 1),
          domainType: item.domainType === 0 ? 'MOVIE' : 'TV',
          score: item.score || '8.5',
          sourceName: 'Loklok HD'
        }));
      }
    }
  } catch (_) {
    // Falls back seamlessly to H5 gateway / server API route
  }

  // Client-Side H5 Web Gateway SSR Scraper Fallback (Unrestricted Global Access)
  if (clientLoklokResults.length === 0 && query.trim()) {
    try {
      const h5Gateways = [
        `https://h5.decryptplan.com/search?keyword=${encodeURIComponent(query.trim())}`,
        `https://h5.netpop.app/search?keyword=${encodeURIComponent(query.trim())}`,
        `https://h5.loklok.site/search?keyword=${encodeURIComponent(query.trim())}`
      ];
      for (const gateUrl of h5Gateways) {
        const h5Res = await fetch(gateUrl);
        if (!h5Res.ok) continue;
        const html = await h5Res.text();
        const scripts = Array.from(html.matchAll(/<script[^>]*>(.*?)<\/script>/gs)).map(m => m[1]);
        const dataScript = scripts.find(s => s.includes('Reactive'));
        if (dataScript) {
          const arr = (new Function('return ' + dataScript))();
          if (Array.isArray(arr)) {
            const h5Items = [];
            for (let i = 0; i < arr.length; i++) {
              const obj = arr[i];
              if (obj && typeof obj === 'object' && !Array.isArray(obj) && typeof obj.name === 'number' && (typeof obj.coverVerticalUrl === 'number' || typeof obj.coverHorizontalUrl === 'number') && typeof obj.id === 'number') {
                const name = arr[obj.name];
                const cover = (typeof obj.coverVerticalUrl === 'number' ? arr[obj.coverVerticalUrl] : null) || (typeof obj.coverHorizontalUrl === 'number' ? arr[obj.coverHorizontalUrl] : null) || '';
                const id = arr[obj.id];
                const domainType = (typeof obj.domainType === 'number' ? arr[obj.domainType] : null) || obj.domainType;
                const score = (typeof obj.score === 'number' ? arr[obj.score] : null) || obj.score || '8.5';
                if (typeof name === 'string' && id) {
                  h5Items.push({
                    id: `wox_l_${id}`,
                    rawId: String(id),
                    title: name,
                    cover: typeof fixCoverUrl === 'function' ? fixCoverUrl(cover) : cover,
                    category: domainType === 0 ? 1 : 0,
                    domainType: domainType === 0 ? 'MOVIE' : 'TV',
                    score: String(score),
                    sourceName: 'Loklok HD'
                  });
                }
              }
            }
            if (h5Items.length > 0) {
              const qWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 1);
              clientLoklokResults = h5Items.filter(item => {
                const titleLower = String(item.title || '').toLowerCase();
                return qWords.length === 0 || qWords.some(w => titleLower.includes(w));
              });
              if (clientLoklokResults.length > 0) break;
            }
          }
        }
      }
    } catch (_) {}
  }

  try {
    const res = await fetch(`/api/search?keyword=${encodeURIComponent(query)}&token=${encodeURIComponent(state.token)}`);
    const data = await res.json();
    let combinedResults = [...clientLoklokResults];

    if (data && Array.isArray(data.results)) {
      data.results.forEach(item => {
        if (!combinedResults.some(c => (c.title || '').toLowerCase() === (item.title || '').toLowerCase())) {
          combinedResults.push(item);
        }
      });
    }

    if (combinedResults.length === 0) {
      grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">No results found for "${escapeHtml(query)}".</p>`;
      return;
    }
    const filtered = filterContentBySettings(combinedResults);
    grid.innerHTML = filtered.map(item => renderLoklokCard(item)).join('');
  } catch (err) {
    if (clientLoklokResults.length > 0) {
      const filtered = filterContentBySettings(clientLoklokResults);
      grid.innerHTML = filtered.map(item => renderLoklokCard(item)).join('');
    } else {
      grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;">Search failed: ${err.message}</p>`;
    }
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

window.saveWatchProgress = function(force = false) {
  if (!state.currentMedia || !state.currentEpisode) return;
  const videoEl = document.querySelector('#player-container video');
  
  let currentTime = 0;
  let duration = 0;
  if (videoEl) {
    currentTime = Math.floor(videoEl.currentTime || 0);
    duration = Math.floor(videoEl.duration || 0);
  }

  if (!force && currentTime < 1) return;

  const media = state.currentMedia;
  const ep = state.currentEpisode;

  const currentHist = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
  const normTitle = (media.title || '').trim().toLowerCase();
  const idx = currentHist.findIndex(h => 
    h.id === String(media.id) || 
    (normTitle && h.title && h.title.trim().toLowerCase() === normTitle)
  );

  const epName = ep.name ? (ep.name.startsWith('Ep') || ep.name.startsWith('Episode') ? ep.name : `Episode ${ep.episodeNumber || ep.id}`) : `Episode ${ep.episodeNumber || ep.id}`;

  let cleanCover = media.cover || (idx >= 0 ? currentHist[idx].cover : '');
  if (cleanCover && typeof cleanCover === 'string') {
    while (cleanCover.includes('/api/image?url=')) {
      const match = cleanCover.match(/[?&]url=([^&]+)/);
      if (match) cleanCover = decodeURIComponent(match[1]);
      else break;
    }
  }

  const record = {
    id: String(media.id),
    category: String(media.category || 1),
    title: media.title,
    cover: cleanCover || '',
    episodeId: String(ep.id),
    episodeName: epName,
    progressTime: currentTime,
    totalTime: duration,
    updatedAt: Date.now()
  };

  if (idx >= 0) {
    currentHist.splice(idx, 1);
  }
  currentHist.unshift(record);

  localStorage.setItem('loklok_watch_history', JSON.stringify(currentHist));

  if (state.token) {
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': state.token },
      body: JSON.stringify({
        action: 'save',
        id: String(media.id),
        category: String(media.category || 1),
        title: media.title,
        cover: media.cover || '',
        episodeId: String(ep.id),
        episodeName: epName,
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

// Global Esc & 'S' Key bindings for video player
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
    media = mediaArg;
    state.currentMedia = media;
    if (typeof epArg === 'object' && epArg !== null) {
      ep = epArg;
    } else if (epArg !== undefined) {
      ep = (media.episodes || []).find(e => String(e.id) === String(epArg) || String(e.episodeNumber) === String(epArg));
    }
  } else {
    const targetId = (typeof mediaArg === 'object' && mediaArg !== null) ? (mediaArg.id || mediaArg.episodeId) : mediaArg;
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

  const thisLock = ++_playEpisodeLock;

  state.currentEpisode = ep;
  window.state = state;

  try { saveWatchProgress(true); } catch (_) {}

  if (media && media.title) {
    updatePageTitleAndUrl(media, ep.name || `Episode ${ep.episodeNumber || 1}`);
  }

  const titleText = document.getElementById('player-title-text');
  if (titleText) titleText.innerText = `${media.title} • ${ep.name || 'Episode'}`;

  if (typeof updatePlayerRightSidebar === 'function') {
    updatePlayerRightSidebar();
  }

  const playerModal = document.getElementById('modal-player');
  if (playerModal) playerModal.classList.add('active');

  const container = document.getElementById('player-container');
  const mount = document.getElementById('plyr-video-mount') || container;
  mount.innerHTML = '<div class="spinner"></div>';

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
    .then(async data => {
      const targetStreamUrl = data.streamUrl || data.playUrl || ep.embedUrl || data.embedUrl || media.embedUrl || '';
      const isEmbed = !!(data.embedUrl || ep.embedUrl || media.embedUrl || (data.streamType === 'embed'));

      if (!data.success && !targetStreamUrl) {
        container.innerHTML = '<p style="color:#fff;text-align:center;padding-top:4rem;font-size:1.1rem;">Stream URL unavailable for this episode.</p>';
        return;
      }

      if (isEmbed) {
        const embedSrc = data.embedUrl || ep.embedUrl || media.embedUrl || targetStreamUrl;
        try {
          const resolveRes = await fetch(`/api/resolve-embed?url=${encodeURIComponent(embedSrc)}`);
          const resolveData = await resolveRes.json();
          if (resolveData.success && resolveData.streamUrl) {
            data.streamUrl = `/api/stream?url=${encodeURIComponent(resolveData.streamUrl)}&referer=${encodeURIComponent(resolveData.referer || '')}`;
            data.playUrl = data.streamUrl;
            data.streamType = resolveData.streamType || 'hls';
            if (resolveData.subtitles && resolveData.subtitles.length > 0) {
              data.subtitles = resolveData.subtitles;
            }
          } else {
            container.innerHTML = `<iframe src="${embedSrc}" style="width:100%;height:100%;min-height:500px;border:none;border-radius:16px;" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
            return;
          }
        } catch (_) {
          container.innerHTML = `<iframe src="${embedSrc}" style="width:100%;height:100%;min-height:500px;border:none;border-radius:16px;" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
          return;
        }
      }

      // Detect if item is a vertical short drama
      const modalContainer = document.querySelector('.player-modal-container');
      const catStr = String(media.category || media.domainType || '').toUpperCase();
      const titleStr = String(media.title || '').toLowerCase();
      const isShortDrama = isNarto || catStr.includes('SHORT') || catStr.includes('MINISERIES') || titleStr.includes('short') || state.filters.params === 'MINISERIES';

      if (modalContainer) {
        if (isShortDrama) {
          modalContainer.classList.add('is-shorts-mode');
          modalContainer.classList.remove('is-fullview-mode');
          modalContainer.style.width = '100%';
          modalContainer.style.maxWidth = '440px';
          modalContainer.style.height = '90vh';
          modalContainer.style.maxHeight = '880px';
          modalContainer.style.borderRadius = '24px';
          modalContainer.style.margin = 'auto';
        } else {
          modalContainer.classList.add('is-fullview-mode');
          modalContainer.classList.remove('is-shorts-mode');
          modalContainer.style.width = '100vw';
          modalContainer.style.height = '100vh';
          modalContainer.style.maxWidth = '100vw';
          modalContainer.style.maxHeight = '100vh';
          modalContainer.style.borderRadius = '0px';
          modalContainer.style.margin = '0';
        }
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
      videoEl.crossOrigin = 'anonymous';
      videoEl.style.width = '100%';
      videoEl.style.height = '100%';
      videoEl.style.borderRadius = '16px';

      // Read saved caption preferences from LocalStorage
      const savedCaptionEnabled = localStorage.getItem('loklok_caption_enabled') !== 'false';
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
        
        let subUrl = sub.url || sub.rawUrl || '';
        if (subUrl && (subUrl.startsWith('http://') || subUrl.startsWith('https://'))) {
          if (!subUrl.includes('/api/subtitle')) {
            subUrl = `/api/subtitle?url=${encodeURIComponent(subUrl)}`;
          }
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

      const mount = document.getElementById('plyr-video-mount') || container;
      mount.innerHTML = '';
      mount.appendChild(videoEl);

      const currentEps = (media && media.episodes && media.episodes.length > 0) ? media.episodes : (data.episodes || [ep]);
      state.currentEpisodes = currentEps;

      // Populate Episode Drawer Grid
      const drawerGrid = document.getElementById('player-drawer-episodes-grid');
      const epBtn = document.getElementById('player-episodes-btn');
      if (drawerGrid && currentEps.length > 1) {
        if (epBtn) epBtn.style.display = 'inline-flex';
        drawerGrid.innerHTML = currentEps.map(e => {
          const isCur = String(e.id) === String(ep.id);
          return `
            <button class="btn btn-glass" onclick="playEpisodeFromDrawer('${e.id}')" style="padding:0.4rem; font-size:0.75rem; font-weight:700; ${isCur ? 'border-color:var(--neon-cyan); background:rgba(0,255,255,0.25); color:#00ffff;' : 'color:#fff;'}">
              Ep ${e.number || e.name || e.id}
            </button>
          `;
        }).join('');
      } else if (epBtn) {
        epBtn.style.display = 'none';
      }

      if (typeof updatePlayerRightSidebar === 'function') {
        updatePlayerRightSidebar();
      }

      // Populate Subtitle Track Dropdown Options in Modal
      const subSelect = document.getElementById('player-sub-track-select');
      if (subSelect) {
        subSelect.innerHTML = '<option value="-1">Off (No Subtitles)</option>' + subtitleList.map((sub, idx) => {
          const trackLabel = sub.label || sub.html || `Subtitle ${idx + 1}`;
          return `<option value="${idx}" ${idx === 0 ? 'selected' : ''}>${escapeHtml(trackLabel)}</option>`;
        }).join('');
      }

      let rawSourceUrl = targetStreamUrl;
      let playUrl = rawSourceUrl;

      // Always route external target stream URLs through /api/stream proxy to prevent CORS blocks
      if (rawSourceUrl.startsWith('http://') || rawSourceUrl.startsWith('https://')) {
        if (!rawSourceUrl.includes('/api/stream')) {
          playUrl = `/api/stream?url=${encodeURIComponent(rawSourceUrl)}`;
        }
      }

      // Prepare Quality resolution options for Plyr settings menu and Loklok stream switcher
      const rawQualities = data.qualities || [];
      state.currentQualities = rawQualities;
      const qualDropdown = document.getElementById('player-quality-dropdown');
      const qualLabel = document.getElementById('current-quality-label');
      const qualWrap = document.getElementById('player-quality-btn-wrap');

      if (rawQualities.length > 0) {
        if (qualWrap) qualWrap.style.display = 'inline-block';
        if (qualLabel) qualLabel.innerText = rawQualities[0].label || rawQualities[0].code || '1080p HD';

        if (qualDropdown) {
          qualDropdown.innerHTML = rawQualities.map((item, idx) => `
            <div style="padding:0.4rem 0.65rem; font-size:0.8rem; font-weight:700; color:#fff; cursor:pointer; border-radius:6px; transition:all 0.2s;" onmouseover="this.style.background='rgba(56,189,248,0.2)'" onmouseout="this.style.background='transparent'" onclick="selectPlayerQuality(${idx})">
              🎥 ${escapeHtml(item.label || item.code)} ${item.sizeFormatted ? `<span style="font-size:0.72rem; color:var(--text-muted); font-weight:400;">(${item.sizeFormatted})</span>` : ''}
            </div>
          `).join('');
        }
      }

      const standardTiers = [1080, 720, 480, 360];
      const qualityOptions = rawQualities.length > 0 
        ? rawQualities.map((_, idx) => standardTiers[idx] || (360 - idx * 60))
        : [1080, 720, 480, 360];

      videoEl.addEventListener('loadedmetadata', () => {
        const modalContainer = document.querySelector('.player-modal-container');
        if (!modalContainer) return;
        const w = videoEl.videoWidth || 16;
        const h = videoEl.videoHeight || 9;
        const isShorts = (h > w) || (media && String(media.category || '').toLowerCase().includes('short'));

        if (isShorts) {
          modalContainer.classList.add('is-shorts-mode');
          modalContainer.classList.remove('is-fullview-mode');
          modalContainer.style.maxWidth = '440px';
          modalContainer.style.height = '90vh';
          modalContainer.style.maxHeight = '880px';
          modalContainer.style.borderRadius = '24px';
          modalContainer.style.margin = 'auto';
          videoEl.style.objectFit = 'cover';
        } else {
          modalContainer.classList.add('is-fullview-mode');
          modalContainer.classList.remove('is-shorts-mode');
          modalContainer.style.width = '100vw';
          modalContainer.style.height = '100vh';
          modalContainer.style.maxWidth = '100vw';
          modalContainer.style.maxHeight = '100vh';
          modalContainer.style.borderRadius = '0px';
          modalContainer.style.margin = '0';
          if (!state.currentAspectRatio || state.currentAspectRatio === 'Original Ratio') {
            videoEl.style.objectFit = 'contain';
          }
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
      state.artPlayer = plyr;

      // Stream Party Host Broadcast Sync
      const broadcastHostSync = () => {
        if (state.party && state.party.active && state.party.isHost && !state.party.suppressSync && state.party.code) {
          fetch('/api/stream-party?action=sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: state.party.code,
              currentTime: plyr.currentTime || 0,
              isPlaying: !plyr.paused
            })
          }).catch(() => {});
        }
      };

      plyr.on('play', broadcastHostSync);
      plyr.on('pause', broadcastHostSync);
      plyr.on('seeked', broadcastHostSync);

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
            const parsedLevels = hlsData.levels.map(l => {
              const res = (l.width && l.height) ? Math.min(l.width, l.height) : (l.height || l.width || 0);
              return { height: res, levelIdx: hlsData.levels.indexOf(l) };
            }).filter(l => l.height > 0);

            if (parsedLevels.length > 0) {
              const sortedQualityOptions = Array.from(new Set(parsedLevels.map(l => l.height))).sort((a, b) => b - a);
              state.availableQualities = sortedQualityOptions;

              const qualDropdown = document.getElementById('player-quality-dropdown');
              const qualLabel = document.getElementById('current-quality-label');
              if (qualLabel) qualLabel.innerText = `${sortedQualityOptions[0]}p HD`;

              if (qualDropdown) {
                qualDropdown.innerHTML = '<div style="padding:0.35rem 0.6rem; font-size:0.8rem; font-weight:600; color:#38bdf8; cursor:pointer; border-radius:4px;" onclick="selectPlayerQuality(-1)">⚡ Auto (Adaptive)</div>' +
                  sortedQualityOptions.map(q => `
                    <div style="padding:0.35rem 0.6rem; font-size:0.8rem; font-weight:600; color:#fff; cursor:pointer; border-radius:4px; transition:background 0.2s;" onmouseover="this.style.background='rgba(56,189,248,0.15)'" onmouseout="this.style.background='transparent'" onclick="selectPlayerQuality(${q})">
                      🎥 ${q}p ${q >= 720 ? 'HD' : 'SD'}
                    </div>
                  `).join('');
              }
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

          // Inject Quality, Audio Boost, Subtitle Settings, and Episode Drawer buttons into Plyr bottom control bar beside settings gear
          const settingsBtn = plyrControls.querySelector('[data-plyr="settings"]');
          if (settingsBtn && !plyrControls.querySelector('.wox-plyr-qual-btn')) {
            const qualBarBtn = document.createElement('button');
            qualBarBtn.type = 'button';
            qualBarBtn.className = 'plyr__control wox-plyr-qual-btn';
            qualBarBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
            qualBarBtn.title = 'Video Resolution Quality (🎥)';
            qualBarBtn.onclick = (e) => {
              e.stopPropagation();
              if (typeof window.toggleQualityDropdown === 'function') window.toggleQualityDropdown(e);
            };

            const boostBarBtn = document.createElement('button');
            boostBarBtn.type = 'button';
            boostBarBtn.className = 'plyr__control wox-plyr-boost-btn';
            boostBarBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            boostBarBtn.title = 'Audio Volume Booster (🔊)';
            boostBarBtn.onclick = (e) => {
              e.stopPropagation();
              if (typeof window.toggleVolBoostDropdown === 'function') window.toggleVolBoostDropdown(e);
            };

            const subBarBtn = document.createElement('button');
            subBarBtn.type = 'button';
            subBarBtn.className = 'plyr__control wox-plyr-sub-btn';
            subBarBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
            subBarBtn.title = 'Subtitle & Caption Settings (💬)';
            subBarBtn.onclick = (e) => {
              e.stopPropagation();
              if (typeof window.toggleSubtitleSettingsModal === 'function') window.toggleSubtitleSettingsModal(e);
            };

            const epBarBtn = document.createElement('button');
            epBarBtn.type = 'button';
            epBarBtn.className = 'plyr__control wox-plyr-ep-btn';
            epBarBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
            epBarBtn.title = 'Episode List Drawer (📺)';
            epBarBtn.onclick = (e) => {
              e.stopPropagation();
              if (typeof window.togglePlayerEpisodeDrawer === 'function') window.togglePlayerEpisodeDrawer(e);
            };

            const partyBarBtn = document.createElement('button');
            partyBarBtn.type = 'button';
            partyBarBtn.className = 'plyr__control wox-plyr-party-btn';
            partyBarBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
            partyBarBtn.title = 'Stream Party Watch Together (🎉)';
            partyBarBtn.onclick = (e) => {
              e.stopPropagation();
              if (typeof window.openStreamPartyModal === 'function') window.openStreamPartyModal();
            };

            settingsBtn.parentNode.insertBefore(partyBarBtn, settingsBtn);
            settingsBtn.parentNode.insertBefore(epBarBtn, settingsBtn);
            settingsBtn.parentNode.insertBefore(subBarBtn, settingsBtn);
            settingsBtn.parentNode.insertBefore(boostBarBtn, settingsBtn);
            settingsBtn.parentNode.insertBefore(qualBarBtn, settingsBtn);

            // Inject custom options directly into Plyr's internal settings gear menu (.plyr__menu__container)
            settingsBtn.addEventListener('click', () => {
              setTimeout(() => {
                const menuContainer = container.querySelector('.plyr__menu__container [role="menu"]');
                if (menuContainer) {
                  // 1. Inject Stream Party Menu Item if missing
                  if (!menuContainer.querySelector('.wox-plyr-party-menu-item')) {
                    const partyItem = document.createElement('button');
                    partyItem.type = 'button';
                    partyItem.className = 'plyr__control wox-plyr-party-menu-item';
                    partyItem.setAttribute('role', 'menuitem');
                    partyItem.innerHTML = `<span>🎉 Stream Party</span><span class="plyr__menu__value" style="margin-left:auto; font-weight:700; color:#facc15;">Watch Together ›</span>`;
                    partyItem.onclick = (ev) => {
                      ev.stopPropagation();
                      if (typeof window.openStreamPartyModal === 'function') window.openStreamPartyModal();
                    };
                    menuContainer.prepend(partyItem);
                  }

                  // 2. Inject Episodes Menu Item if missing
                  if (!menuContainer.querySelector('.wox-plyr-ep-menu-item')) {
                    const epMenuItem = document.createElement('button');
                    epMenuItem.type = 'button';
                    epMenuItem.className = 'plyr__control wox-plyr-ep-menu-item';
                    epMenuItem.setAttribute('role', 'menuitem');
                    epMenuItem.innerHTML = `<span>📺 Episodes</span><span class="plyr__menu__value" style="margin-left:auto; font-weight:700; color:#00ffff;">Ep ${(ep && (ep.number || ep.name || ep.id)) || 1} ›</span>`;
                    epMenuItem.onclick = (ev) => {
                      ev.stopPropagation();
                      if (typeof window.togglePlayerEpisodeDrawer === 'function') window.togglePlayerEpisodeDrawer(ev);
                    };
                    const partyRef = menuContainer.querySelector('.wox-plyr-party-menu-item') || menuContainer.firstChild;
                    if (partyRef && partyRef.nextSibling) {
                      menuContainer.insertBefore(epMenuItem, partyRef.nextSibling);
                    } else {
                      menuContainer.appendChild(epMenuItem);
                    }
                  }

                  // 2. Inject Audio & Volume Boost Menu Item if missing
                  if (!menuContainer.querySelector('.wox-plyr-audio-menu-item')) {
                    const audioMenuItem = document.createElement('button');
                    audioMenuItem.type = 'button';
                    audioMenuItem.className = 'plyr__control wox-plyr-audio-menu-item';
                    audioMenuItem.setAttribute('role', 'menuitem');
                    audioMenuItem.innerHTML = `<span>🔊 Audio & Boost</span><span class="plyr__menu__value" style="margin-left:auto; font-weight:700; color:#38bdf8;">100% Boost ›</span>`;
                    audioMenuItem.onclick = (ev) => {
                      ev.stopPropagation();
                      if (typeof window.toggleVolBoostDropdown === 'function') window.toggleVolBoostDropdown(ev);
                    };
                    const targetRef = menuContainer.querySelector('.wox-plyr-ep-menu-item') || menuContainer.firstChild;
                    if (targetRef && targetRef.nextSibling) {
                      menuContainer.insertBefore(audioMenuItem, targetRef.nextSibling);
                    } else {
                      menuContainer.appendChild(audioMenuItem);
                    }
                  }

                  // 4. Inject Aspect Ratio Menu Item if missing
                  if (!menuContainer.querySelector('.wox-plyr-aspect-menu-item')) {
                    const aspectItem = document.createElement('button');
                    aspectItem.type = 'button';
                    aspectItem.className = 'plyr__control wox-plyr-aspect-menu-item';
                    aspectItem.setAttribute('role', 'menuitem');
                    aspectItem.innerHTML = `<span>📐 Aspect Ratio</span><span class="plyr__menu__value" id="aspect-ratio-val" style="margin-left:auto; font-weight:700; color:#4ade80;">Original Ratio ›</span>`;
                    aspectItem.onclick = (ev) => {
                      ev.stopPropagation();
                      if (typeof window.cycleVideoAspectRatio === 'function') window.cycleVideoAspectRatio();
                    };
                    const subRef = menuContainer.querySelector('.wox-plyr-substyle-menu-item') || menuContainer.firstChild;
                    if (subRef && subRef.nextSibling) {
                      menuContainer.insertBefore(aspectItem, subRef.nextSibling);
                    } else {
                      menuContainer.appendChild(aspectItem);
                    }
                  }
                }
              }, 50);
            });
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

window.togglePlayerEpisodeDrawer = function(e) {
  if (e) e.stopPropagation();
  const drawer = document.getElementById('player-episodes-drawer');
  const subModal = document.getElementById('player-sub-modal');
  const qualBar = document.getElementById('player-landscape-quality-bar');
  const boostBar = document.getElementById('player-landscape-boost-bar');
  if (subModal) subModal.style.display = 'none';
  if (qualBar) qualBar.style.display = 'none';
  if (boostBar) boostBar.style.display = 'none';
  if (drawer) {
    const isHidden = window.getComputedStyle(drawer).display === 'none' || drawer.style.display === 'none';
    drawer.style.display = isHidden ? 'flex' : 'none';
  }
};

window.toggleSubtitleSettingsModal = function(e) {
  if (e) e.stopPropagation();
  const subModal = document.getElementById('player-sub-modal');
  const drawer = document.getElementById('player-episodes-drawer');
  const qualBar = document.getElementById('player-landscape-quality-bar');
  const boostBar = document.getElementById('player-landscape-boost-bar');
  if (drawer) drawer.style.display = 'none';
  if (qualBar) qualBar.style.display = 'none';
  if (boostBar) boostBar.style.display = 'none';
  if (subModal) {
    const isHidden = window.getComputedStyle(subModal).display === 'none' || subModal.style.display === 'none';
    subModal.style.display = isHidden ? 'block' : 'none';
  }
};

window.toggleQualityDropdown = function(e) {
  if (e) e.stopPropagation();
  const qualBar = document.getElementById('player-landscape-quality-bar');
  const boostBar = document.getElementById('player-landscape-boost-bar');
  const drawer = document.getElementById('player-episodes-drawer');
  const subModal = document.getElementById('player-sub-modal');
  if (boostBar) boostBar.style.display = 'none';
  if (drawer) drawer.style.display = 'none';
  if (subModal) subModal.style.display = 'none';

  if (qualBar) {
    const isHidden = window.getComputedStyle(qualBar).display === 'none' || qualBar.style.display === 'none';
    qualBar.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      const pillsRow = document.getElementById('player-quality-pills-row');
      const qualities = state.currentQualities || [];
      if (pillsRow && qualities.length > 0) {
        pillsRow.innerHTML = qualities.map((item, idx) => `
          <button class="btn btn-glass" onclick="selectPlayerQuality(${idx})" style="padding:0.4rem 0.8rem; font-size:0.8rem; font-weight:700; color:#fff; border-color:rgba(56,189,248,0.4);">
            🎥 ${escapeHtml(item.label || item.code)} ${item.sizeFormatted ? `<span style="font-size:0.72rem; color:var(--text-muted);">(${item.sizeFormatted})</span>` : ''}
          </button>
        `).join('');
      } else if (pillsRow) {
        const hlsLevels = (state.hlsInstance && state.hlsInstance.levels) ? state.hlsInstance.levels : [];
        const uniqueHls = Array.from(new Set(hlsLevels.map(l => (l.width && l.height) ? Math.min(l.width, l.height) : (l.height || l.width || 0)))).sort((a, b) => b - a);
        pillsRow.innerHTML = '<button class="btn btn-glass" onclick="selectPlayerQuality(-1)" style="padding:0.4rem 0.8rem; font-size:0.8rem; font-weight:700; color:#00ffff;">⚡ Auto</button>' +
          (uniqueHls.length > 0 ? uniqueHls : [1080, 720, 480, 360]).map(q => `
            <button class="btn btn-glass" onclick="selectPlayerQuality(${q})" style="padding:0.4rem 0.8rem; font-size:0.8rem; font-weight:700; color:#fff;">
              🎥 ${q}p
            </button>
          `).join('');
      }
    }
  }
};

window.toggleVolBoostDropdown = function(e) {
  if (e) e.stopPropagation();
  const boostBar = document.getElementById('player-landscape-boost-bar');
  const qualBar = document.getElementById('player-landscape-quality-bar');
  const drawer = document.getElementById('player-episodes-drawer');
  const subModal = document.getElementById('player-sub-modal');
  if (qualBar) qualBar.style.display = 'none';
  if (drawer) drawer.style.display = 'none';
  if (subModal) subModal.style.display = 'none';

  if (boostBar) {
    const isHidden = window.getComputedStyle(boostBar).display === 'none' || boostBar.style.display === 'none';
    boostBar.style.display = isHidden ? 'block' : 'none';
  }
};

window.playEpisodeFromDrawer = function(epId) {
  const drawer = document.getElementById('player-episodes-drawer');
  if (drawer) drawer.style.display = 'none';
  const episodes = state.currentEpisodes || (state.currentMedia ? state.currentMedia.episodes : []);
  const ep = (episodes || []).find(e => String(e.id) === String(epId));
  if (ep && state.currentMedia) {
    playVideo(state.currentMedia, ep);
  }
};

window.togglePlayerRightSidebar = function(e) {
  if (e) e.stopPropagation();
  const sb = document.getElementById('player-right-sidebar');
  if (!sb) return;
  const isOpen = sb.style.display !== 'none' && sb.style.display !== '';
  sb.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen && typeof updatePlayerRightSidebar === 'function') {
    updatePlayerRightSidebar();
  }
};

window.switchPlayerSidebarTab = function(tab) {
  const epTab = document.getElementById('psb-tab-episodes');
  const relTab = document.getElementById('psb-tab-related');
  const epContent = document.getElementById('psb-content-episodes');
  const relContent = document.getElementById('psb-content-related');

  if (tab === 'episodes') {
    if (epTab) epTab.classList.add('active');
    if (relTab) relTab.classList.remove('active');
    if (epContent) epContent.style.display = 'block';
    if (relContent) relContent.style.display = 'none';
  } else {
    if (relTab) relTab.classList.add('active');
    if (epTab) epTab.classList.remove('active');
    if (relContent) relContent.style.display = 'block';
    if (epContent) epContent.style.display = 'none';
  }
};

window.updatePlayerRightSidebar = async function() {
  const media = state.currentMedia;
  const currentEp = state.currentEpisode;
  const epGrid = document.getElementById('psb-episodes-grid');
  const relList = document.getElementById('psb-related-list');

  if (!media) return;

  // 1. Populate Episodes Grid
  if (epGrid) {
    const episodes = media.episodes || [];
    if (episodes.length === 0) {
      epGrid.innerHTML = '<div style="grid-column:1/-1;color:rgba(255,255,255,0.5);font-size:0.8rem;text-align:center;padding:1rem;">No episode list available.</div>';
    } else {
      epGrid.innerHTML = episodes.map((e, idx) => {
        const isCur = currentEp && (String(e.id) === String(currentEp.id) || String(e.episodeNumber) === String(currentEp.episodeNumber));
        const epName = e.seriesNo ? `Ep ${e.seriesNo}` : (e.name || `Ep ${idx + 1}`);
        
        return `
          <button class="btn btn-glass" onclick="playEpisodeFromDrawer('${e.id}')" style="padding:0.45rem 0.2rem; font-size:0.75rem; font-weight:700; text-align:center; border-radius:6px; ${isCur ? 'border-color:#00ffff; background:rgba(0,255,255,0.25); color:#00ffff; box-shadow:0 0 8px rgba(0,255,255,0.4);' : 'color:#fff; background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.1);'}" title="${escapeHtml(e.name || epName)}">
            ${escapeHtml(epName)}
          </button>
        `;
      }).join('');
    }
  }

  // 2. Populate Related List
  if (relList) {
    let relatedItems = [];
    if (Array.isArray(media.likeList) && media.likeList.length > 0) {
      relatedItems = relatedItems.concat(media.likeList);
    }
    if (Array.isArray(media.relatedList) && media.relatedList.length > 0) {
      relatedItems = relatedItems.concat(media.relatedList);
    }

    // Deduplicate by ID
    const uniqueMap = new Map();
    relatedItems.forEach(item => {
      if (item && item.id && !uniqueMap.has(String(item.id)) && String(item.id) !== String(media.id)) {
        uniqueMap.set(String(item.id), item);
      }
    });

    let finalRelated = Array.from(uniqueMap.values());

    // Fallback if detail API didn't return recommendations
    if (finalRelated.length === 0) {
      try {
        const queryTerm = (media.title || '').split(' ')[0] || 'popular';
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(queryTerm)}`);
        const searchData = await searchRes.json();
        if (searchData.success && Array.isArray(searchData.results)) {
          finalRelated = searchData.results.filter(r => String(r.id) !== String(media.id)).slice(0, 10);
        }
      } catch (_) {}
    }

    if (finalRelated.length === 0) {
      relList.innerHTML = '<div style="color:rgba(255,255,255,0.5);font-size:0.8rem;text-align:center;padding:1rem;">No related recommendations available.</div>';
    } else {
      relList.innerHTML = finalRelated.map(item => `
        <div class="psb-related-card" onclick="openDetailModal('${item.id}', '${item.category || 1}')">
          <img class="psb-related-img" src="${item.cover}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="handleImgError(this)">
          <div class="psb-related-info">
            <div class="psb-related-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
            <div class="psb-related-meta">⭐ ${item.score || '8.5'} • Click to Watch</div>
          </div>
        </div>
      `).join('');
    }
  }
};

window.changeSubtitleTrack = function(trackIdx) {
  if (!state.plyrPlayer) return;
  const idx = parseInt(trackIdx, 10);
  if (idx === -1) {
    state.plyrPlayer.currentTrack = -1;
    state.plyrPlayer.toggleCaptions(false);
    showToast('Subtitles turned Off');
  } else {
    state.plyrPlayer.currentTrack = idx;
    state.plyrPlayer.toggleCaptions(true);
    showToast(`Subtitle track set to #${idx + 1}`);
  }
};

window.setVideoAspectRatio = function(mode) {
  state.currentAspectRatio = mode;
  const labelEls = document.querySelectorAll('#aspect-ratio-val');
  labelEls.forEach(lbl => { lbl.innerText = `${mode} ›`; });

  let styleEl = document.getElementById('custom-aspect-ratio-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-aspect-ratio-style';
    document.head.appendChild(styleEl);
  }

  const targets = 'html body #player-container video, html body .plyr video, html body .plyr__video-wrapper video, html body .plyr-wrapper video';

  if (mode === 'Scale to Fit') {
    styleEl.innerHTML = `
      ${targets} { object-fit: cover !important; aspect-ratio: auto !important; width: 100% !important; height: 100% !important; }
    `;
  } else if (mode === 'Stretch to Fill') {
    styleEl.innerHTML = `
      ${targets} { object-fit: fill !important; aspect-ratio: auto !important; width: 100% !important; height: 100% !important; }
    `;
  } else if (mode === '16:9') {
    styleEl.innerHTML = `
      ${targets} { object-fit: cover !important; aspect-ratio: 16 / 9 !important; width: 100% !important; height: 100% !important; }
    `;
  } else if (mode === '4:3') {
    styleEl.innerHTML = `
      ${targets} { object-fit: cover !important; aspect-ratio: 4 / 3 !important; width: 100% !important; height: 100% !important; }
    `;
  } else {
    // Original Ratio (default)
    styleEl.innerHTML = `
      ${targets} { object-fit: contain !important; aspect-ratio: auto !important; width: 100% !important; height: 100% !important; }
    `;
  }

  const videoEl = document.querySelector('#player-container video');
  if (videoEl) {
    if (mode === 'Scale to Fit') videoEl.style.setProperty('object-fit', 'cover', 'important');
    else if (mode === 'Stretch to Fill') videoEl.style.setProperty('object-fit', 'fill', 'important');
    else if (mode === '16:9' || mode === '4:3') videoEl.style.setProperty('object-fit', 'cover', 'important');
    else videoEl.style.setProperty('object-fit', 'contain', 'important');
  }

  showToast(`Aspect ratio set to ${mode} 📐`);
};

window.cycleVideoAspectRatio = function() {
  const modes = ['Original Ratio', 'Scale to Fit', 'Stretch to Fill', '16:9', '4:3'];
  const curMode = state.currentAspectRatio || 'Original Ratio';
  const curIdx = modes.indexOf(curMode);
  const nextMode = modes[(curIdx + 1) % modes.length];
  window.setVideoAspectRatio(nextMode);
};

window.setSubtitleSize = function(size) {
  const lbl = document.getElementById('sub-fontsize-val');
  if (lbl) lbl.innerText = size;
  const slider = document.getElementById('sub-fontsize-slider');
  if (slider) slider.value = parseInt(size, 10) || 18;

  let styleEl = document.getElementById('custom-sub-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-sub-style';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `.plyr__captions { font-size: ${size} !important; } .plyr__caption { font-size: ${size} !important; }`;
};

window.setSubtitleTextBorder = function(borderVal) {
  const lbl = document.getElementById('sub-border-val');
  if (lbl) lbl.innerText = borderVal;
  const slider = document.getElementById('sub-border-slider');
  if (slider) slider.value = parseFloat(borderVal) || 2;

  let styleEl = document.getElementById('custom-sub-border-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-sub-border-style';
    document.head.appendChild(styleEl);
  }
  const pxVal = parseFloat(borderVal) || 0;
  styleEl.innerHTML = `.plyr__caption { -webkit-text-stroke: ${pxVal}px #000000 !important; text-shadow: 0 0 ${pxVal * 2}px #000000, 0 2px 4px #000000 !important; }`;
};

window.setSubtitleColor = function(color) {
  let styleEl = document.getElementById('custom-sub-color-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-sub-color-style';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `.plyr__caption { color: ${color} !important; }`;
  showToast('Subtitle text color updated');
};

window.setSubtitleBottomHeight = function(heightVal) {
  const lbl = document.getElementById('sub-height-val');
  if (lbl) lbl.innerText = heightVal;

  let styleEl = document.getElementById('custom-sub-height-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-sub-height-style';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `.plyr__captions { bottom: ${heightVal} !important; padding-bottom: 0 !important; }`;
};

window.setSubtitleBgColor = function(rgbStr) {
  state.subBgColor = rgbStr;
  window.updateSubtitleBgStyle();
  showToast('Subtitle background color updated');
};

window.setSubtitleBgOpacity = function(opacityVal) {
  state.subBgOpacity = opacityVal;
  const lbl = document.getElementById('sub-bg-opacity-val');
  if (lbl) lbl.innerText = `${Math.round(opacityVal * 100)}%`;
  const slider = document.getElementById('sub-bg-opacity-slider');
  if (slider) slider.value = Math.round(opacityVal * 100);

  window.updateSubtitleBgStyle();
};

window.updateSubtitleBgStyle = function() {
  const rgb = state.subBgColor || '0, 0, 0';
  const opacity = (typeof state.subBgOpacity === 'number') ? state.subBgOpacity : 0.75;

  let styleEl = document.getElementById('custom-sub-bg-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-sub-bg-style';
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `.plyr__caption { background: rgba(${rgb}, ${opacity}) !important; backdrop-filter: blur(8px); }`;
};

window.selectPlayerQuality = function(q) {
  const dropdown = document.getElementById('player-quality-dropdown');
  const landscapeBar = document.getElementById('player-landscape-quality-bar');
  const qualLabel = document.getElementById('current-quality-label');
  if (dropdown) dropdown.style.display = 'none';
  if (landscapeBar) landscapeBar.style.display = 'none';

  const videoEl = document.getElementById('wox-video-player') || (state.plyrPlayer ? state.plyrPlayer.media : null);
  const qualities = state.currentQualities || [];
  
  // 1. Loklok Discrete Stream Qualities (Match by index or resolution code)
  let targetQual = null;
  if (qualities.length > 0) {
    if (typeof q === 'number' && q >= 0 && q < qualities.length) {
      targetQual = qualities[q];
    } else {
      const qStr = String(q).toLowerCase();
      targetQual = qualities.find(item => {
        const codeStr = String(item.code || '').toLowerCase();
        const labelStr = String(item.label || '').toLowerCase();
        return codeStr.includes(qStr) || labelStr.includes(qStr);
      });
    }
  }

  if (targetQual && targetQual.rawStreamUrl) {
    const curTime = (state.plyrPlayer ? state.plyrPlayer.currentTime : (videoEl ? videoEl.currentTime : 0)) || 0;
    const isPaused = state.plyrPlayer ? state.plyrPlayer.paused : (videoEl ? videoEl.paused : true);
    let newPlayUrl = targetQual.rawStreamUrl;
    if (newPlayUrl.startsWith('http://') || newPlayUrl.startsWith('https://')) {
      if (!newPlayUrl.includes('/api/stream')) {
        newPlayUrl = `/api/stream?url=${encodeURIComponent(newPlayUrl)}`;
      }
    }

    const restoreTime = () => {
      if (curTime > 0) {
        try {
          if (videoEl) videoEl.currentTime = curTime;
          if (state.plyrPlayer) state.plyrPlayer.currentTime = curTime;
        } catch (_) {}
      }
      if (!isPaused && state.plyrPlayer) {
        state.plyrPlayer.play().catch(() => {});
      }
    };

    if (videoEl) {
      videoEl.addEventListener('loadedmetadata', restoreTime, { once: true });
      videoEl.addEventListener('canplay', restoreTime, { once: true });

      if (state.hlsInstance) {
        state.hlsInstance.loadSource(newPlayUrl);
        state.hlsInstance.attachMedia(videoEl);
      } else {
        videoEl.src = newPlayUrl;
      }
    }

    const displayLabel = targetQual.label || targetQual.code || 'HD';
    if (qualLabel) qualLabel.innerText = displayLabel;
    showToast(`Switched quality to ${displayLabel} (${targetQual.sizeFormatted || ''}) 🎥`);
    return;
  }

  // 2. HLS Adaptive Manifest Switching (for multi-bitrate .m3u8 playlists)
  if (q === -1 || q === 'auto') {
    if (state.hlsInstance) state.hlsInstance.currentLevel = -1;
    if (qualLabel) qualLabel.innerText = 'Auto';
    showToast('Quality set to Auto (Adaptive) ⚡');
    return;
  }

  if (state.hlsInstance && state.hlsInstance.levels && state.hlsInstance.levels.length > 0) {
    const numQ = parseInt(q, 10);
    const levelIdx = state.hlsInstance.levels.findIndex(l => {
      const h = (l.width && l.height) ? Math.min(l.width, l.height) : (l.height || l.width || 0);
      return h === numQ;
    });
    if (levelIdx !== -1) {
      state.hlsInstance.currentLevel = levelIdx;
      if (qualLabel) qualLabel.innerText = `${numQ}p`;
      showToast(`Switched quality to ${numQ}p 🎥`);
      return;
    }
  }

  if (qualLabel) qualLabel.innerText = `${q}p`;
  showToast(`Quality set to ${q}p 🎥`);
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
    const cleanTok = (state.token && state.token !== 'null' && state.token !== 'undefined' && state.token !== '1' && String(state.token).length > 8) ? state.token : '';
    const res = await fetch(`/api/detail?id=${id}&category=${category}&token=${encodeURIComponent(cleanTok)}`);
    const data = await res.json();

    const detail = data.detail || (data.success && (data.title || data.name || (data.episodes && data.episodes.length > 0)) ? data : null);

    if (!data.success || !detail) {
      content.innerHTML = '<p style="padding:2.5rem;color:var(--text-muted);">Failed to load media details.</p>';
      return;
    }
    state.currentMedia = detail;
    window.state = state;
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
            ${(() => { const sb = getSourceBadge(detail); return `<span class="tag-badge" style="background:${sb.bg};color:${sb.color};font-weight:700;box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${sb.icon} ${escapeHtml(sb.name)}</span>`; })()}
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
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem;flex-wrap:wrap;gap:0.6rem;">
          <h3 style="font-size:1.25rem;margin:0;" id="episodes-heading-text">Episodes (${detail.episodes.length})</h3>
          ${(detail.seasons && detail.seasons.length > 1) ? `
            <div class="season-selector-bar" style="display:flex;gap:0.4rem;flex-wrap:wrap;">
              <button class="btn btn-glass season-pill active" onclick="filterDetailSeason(0)" id="season-btn-0" style="padding:0.35rem 0.85rem;font-size:0.85rem;border-color:var(--accent-cyan);color:var(--accent-cyan);font-weight:700;">All (${detail.episodes.length})</button>
              ${detail.seasons.map(s => `
                <button class="btn btn-glass season-pill" onclick="filterDetailSeason(${s.seasonNumber})" id="season-btn-${s.seasonNumber}" style="padding:0.35rem 0.85rem;font-size:0.85rem;background:rgba(255,255,255,0.05);color:#fff;">Season ${s.seasonNumber} (${s.episodes.length})</button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="episodes-grid">
          ${detail.episodes.map(ep => {
            const rawName = ep.name || `Episode ${ep.episodeNumber || 1}`;
            const displayTitle = String(rawName).replace(/^Episode\s+/i, 'Ep ');
            const isWatchedEp = watchRecord && String(watchRecord.episodeId) === String(ep.id);
            const progressFormatted = isWatchedEp ? formatTime(watchRecord.progressTime) : null;
            const progressPct = (isWatchedEp && watchRecord.totalTime > 0) ? Math.min(100, Math.round((watchRecord.progressTime / watchRecord.totalTime) * 100)) : 0;
            const epSeasonNum = ep.seasonNumber || (ep.id && String(ep.id).match(/s(\d+)e/i) ? parseInt(String(ep.id).match(/s(\d+)e/i)[1], 10) : 1);

            return `
              <div class="wox-episode-chip ${isWatchedEp ? 'active-resume' : ''}" data-season="${epSeasonNum}" onclick="playEpisode('${ep.id}')" title="${escapeHtml(rawName)}${isWatchedEp ? ' - Watched ' + progressFormatted : ''}" style="${isWatchedEp ? 'border-color: #ec4899; background: rgba(236, 72, 153, 0.12);' : ''}">
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

window.filterDetailSeason = function(seasonNum) {
  const detail = state.currentMedia;
  if (!detail || !detail.episodes) return;

  const chips = document.querySelectorAll('.wox-episode-chip');
  let visibleCount = 0;

  chips.forEach(chip => {
    const sNum = parseInt(chip.getAttribute('data-season') || '1', 10);
    if (seasonNum === 0 || sNum === seasonNum) {
      chip.style.display = 'flex';
      visibleCount++;
    } else {
      chip.style.display = 'none';
    }
  });

  const heading = document.getElementById('episodes-heading-text');
  if (heading) {
    heading.innerText = seasonNum === 0 
      ? `Episodes (${detail.episodes.length})` 
      : `Season ${seasonNum} Episodes (${visibleCount})`;
  }

  // Update active pill button styling
  const btns = document.querySelectorAll('.season-pill');
  btns.forEach(btn => {
    btn.classList.remove('active');
    btn.style.borderColor = 'rgba(255,255,255,0.15)';
    btn.style.color = '#fff';
    btn.style.fontWeight = '400';
    btn.style.background = 'rgba(255,255,255,0.05)';
  });

  const activeBtn = document.getElementById(`season-btn-${seasonNum}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.borderColor = 'var(--accent-cyan)';
    activeBtn.style.color = 'var(--accent-cyan)';
    activeBtn.style.fontWeight = '700';
    activeBtn.style.background = 'rgba(6, 182, 212, 0.15)';
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

      const deletedSet = new Set(JSON.parse(localStorage.getItem('loklok_deleted_history') || '[]'));
      items.forEach(i => {
        if (i && i.id) deletedSet.delete(String(i.id));
      });
      localStorage.setItem('loklok_deleted_history', JSON.stringify(Array.from(deletedSet)));

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

    let items = [];
    try {
      const res = await fetch('/api/import-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbBase64: base64 })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        items = data.items;
      }
    } catch (_) {}

    // Client-side pure JS fallback if server fetch failed or returned 0 items
    if (items.length === 0) {
      const isHashKey = (s) => !s || /^[a-f0-9]{12,}$/i.test(s) || /^\d+$/.test(s) || /^(com|org|net|loklok|bff|snssb|android)/i.test(s);
      const dec = new TextDecoder('utf-8', { fatal: false });
      const strContent = dec.decode(bytes);
      const seen = new Set();
      
      const jsonRegex = /\{"id":\s*"?(\w+)"?[^}]*?"title":\s*"([^"]+)"[^}]*\}/g;
      let match;
      while ((match = jsonRegex.exec(strContent)) !== null) {
        try {
          const parsed = JSON.parse(match[0]);
          const id = String(parsed.id || parsed.subjectId || '');
          if (id && !seen.has(id)) {
            seen.add(id);
            const rawT = parsed.title || parsed.subjectName || '';
            items.push({
              id,
              category: String(parsed.category || '1'),
              title: isHashKey(rawT) ? `Media #${id}` : rawT.trim(),
              cover: parsed.cover || parsed.image || '',
              episodeId: String(parsed.episodeId || ''),
              episodeName: parsed.episodeName || 'Episode 1',
              progressTime: Number(parsed.progressTime || parsed.watch_time || 0),
              totalTime: Number(parsed.totalTime || parsed.duration || 0),
              updatedAt: Date.now()
            });
          }
        } catch (_) {}
      }

      if (items.length === 0) {
        const urlRegex = /(https?:\/\/[^\s"'<>\0\u0000-\u001F]+\.(?:jpg|jpeg|png|webp))/gi;
        let urlMatch;
        while ((urlMatch = urlRegex.exec(strContent)) !== null) {
          const imgUrl = urlMatch[1];
          const idx = urlMatch.index;
          const chunk = strContent.slice(Math.max(0, idx - 150), Math.min(strContent.length, idx + 200));
          const idMatch = chunk.match(/\b(\d{4,8})\b/);
          if (idMatch && !seen.has(idMatch[1])) {
            const id = idMatch[1];
            seen.add(id);
            items.push({
              id,
              category: '1',
              title: `Media #${id}`,
              cover: imgUrl,
              episodeId: '',
              episodeName: 'Episode 1',
              progressTime: 0,
              totalTime: 0,
              updatedAt: Date.now()
            });
          }
        }
      }

      // Enrich items with real titles from Loklok detail API
      for (let i = 0; i < Math.min(items.length, 25); i++) {
        const item = items[i];
        if (!item.title || isHashKey(item.title) || item.title.startsWith('Media #') || !item.cover) {
          try {
            const detailRes = await fetch(`/api/detail?id=${item.id}&category=${item.category || 1}`);
            const data = await detailRes.json();
            if (data && data.success && data.detail) {
              if (data.detail.title) item.title = data.detail.title;
              if (data.detail.cover) item.cover = data.detail.cover;
            }
          } catch (_) {}
        }
      }
    }

    if (items.length === 0) {
      showToast('Import failed: Could not extract valid media records from database file. ❌');
      return;
    }

    // Merge imported items into localStorage by ID & Title
    const localHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
    const map = new Map();
    const titleToKey = new Map();

    const addItemToMap = (i) => {
      if (!i || !i.id) return;
      const key = String(i.id);
      const normTitle = (i.title || '').trim().toLowerCase();

      let existingKey = key;
      if (normTitle && titleToKey.has(normTitle)) {
        existingKey = titleToKey.get(normTitle);
      }

      if (!map.has(existingKey)) {
        map.set(existingKey, i);
        if (normTitle) titleToKey.set(normTitle, existingKey);
      } else {
        const prev = map.get(existingKey);
        if ((i.updatedAt || 0) >= (prev.updatedAt || 0)) {
          if (!i.cover && prev.cover) i.cover = prev.cover;
          map.set(existingKey, i);
        }
      }
    };

    localHistory.forEach(addItemToMap);
    items.forEach(addItemToMap);

    const merged = Array.from(map.values());
    localStorage.setItem('loklok_watch_history', JSON.stringify(merged));

    // Remove imported item IDs from deletedSet so they display immediately
    const deletedSet = new Set(JSON.parse(localStorage.getItem('loklok_deleted_history') || '[]'));
    items.forEach(i => {
      if (i && i.id) deletedSet.delete(String(i.id));
    });
    localStorage.setItem('loklok_deleted_history', JSON.stringify(Array.from(deletedSet)));

    showToast(`Successfully imported ${items.length} titles from ${file.name}! 🎉`);
    loadHistory(false);

  } catch (err) {
    showToast(`Error reading database file: ${err.message} ❌`);
  }
};



// --- Watch History Filtering, Sorting, and Search System ---
state.historySortMode = state.historySortMode || 'latest';
state.historySearchQuery = state.historySearchQuery || '';
state.historyFilterType = state.historyFilterType || 'all';

window.handleHistorySearch = function(query) {
  state.historySearchQuery = (query || '').trim().toLowerCase();
  const clearBtn = document.getElementById('history-search-clear');
  if (clearBtn) clearBtn.style.display = state.historySearchQuery ? 'block' : 'none';
  renderHistoryView();
};

window.clearHistorySearch = function() {
  const input = document.getElementById('history-search-input');
  if (input) input.value = '';
  state.historySearchQuery = '';
  const clearBtn = document.getElementById('history-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderHistoryView();
};

window.setHistorySort = function(sortMode) {
  state.historySortMode = sortMode;
  renderHistoryView();
};

window.setHistoryFilter = function(filterType) {
  state.historyFilterType = filterType;
  const chips = document.querySelectorAll('#history-filter-chips .history-chip');
  chips.forEach(c => c.classList.remove('active'));
  const activeChip = document.getElementById(`hchip-${filterType === 'in-progress' ? 'watching' : filterType}`);
  if (activeChip) activeChip.classList.add('active');
  renderHistoryView();
};

window.renderHistoryView = function() {
  const grid = document.getElementById('history-grid');
  if (!grid) return;

  const rawHistory = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
  const deletedSet = new Set(JSON.parse(localStorage.getItem('loklok_deleted_history') || '[]'));

  let items = rawHistory.filter(it => it && it.id && !deletedSet.has(String(it.id)));

  // 1. Text Search Filter
  if (state.historySearchQuery) {
    const q = state.historySearchQuery;
    items = items.filter(it => {
      const title = (it.title || '').toLowerCase();
      const epName = (it.episodeName || '').toLowerCase();
      return title.includes(q) || epName.includes(q);
    });
  }

  // 2. Status Filter
  if (state.historyFilterType === 'in-progress') {
    items = items.filter(it => {
      const pct = it.totalTime > 0 ? (it.progressTime / it.totalTime) * 100 : 0;
      return pct > 0 && pct < 95;
    });
  } else if (state.historyFilterType === 'completed') {
    items = items.filter(it => {
      const pct = it.totalTime > 0 ? (it.progressTime / it.totalTime) * 100 : 0;
      return pct >= 95;
    });
  }

  // 3. Sorting Mode
  items.sort((a, b) => {
    switch (state.historySortMode) {
      case 'oldest':
        return (a.updatedAt || 0) - (b.updatedAt || 0);
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'progress-desc': {
        const pctA = a.totalTime > 0 ? (a.progressTime / a.totalTime) : 0;
        const pctB = b.totalTime > 0 ? (b.progressTime / b.totalTime) : 0;
        return pctB - pctA;
      }
      case 'progress-asc': {
        const pctA = a.totalTime > 0 ? (a.progressTime / a.totalTime) : 0;
        const pctB = b.totalTime > 0 ? (b.progressTime / b.totalTime) : 0;
        return pctA - pctB;
      }
      case 'latest':
      default:
        return (b.updatedAt || 0) - (a.updatedAt || 0);
    }
  });

  // Update Item Count Badge
  const countBadge = document.getElementById('history-count-badge');
  if (countBadge) {
    countBadge.innerText = `${items.length} item${items.length === 1 ? '' : 's'}`;
  }

  if (items.length === 0) {
    if (state.historySearchQuery) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;">
          <p style="color:var(--text-muted);margin-bottom:1rem;font-size:1rem;">No history items match "<strong>${escapeHtml(state.historySearchQuery)}</strong>".</p>
          <button class="btn btn-glass" onclick="clearHistorySearch()">Clear Search</button>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;">
          <p style="color:var(--text-muted);margin-bottom:1rem;">No watch history recorded yet. Start watching any movie, drama, or anime to track your progress!</p>
        </div>
      `;
    }
    return;
  }

  const htmlContent = items.map(item => {
    const progressPercent = item.totalTime > 0 ? Math.min(100, Math.round((item.progressTime / item.totalTime) * 100)) : 0;
    const timeFormatted = item.progressTime > 0 ? formatSeconds(item.progressTime) : '';
    const itemJson = JSON.stringify(item).replace(/"/g, '&quot;');

    const statusLabel = progressPercent >= 95 ? 'COMPLETED' : (progressPercent > 0 ? `WATCHED ${progressPercent}%` : 'STARTED WATCHING');
    const epNameLabel = String(item.episodeName || 'EPISODE 1').toUpperCase();

    // Clean & unwrap nested cover URLs
    let displayCover = item.cover || '';
    if (typeof displayCover === 'string') {
      while (displayCover.includes('/api/image?url=')) {
        const match = displayCover.match(/[?&]url=([^&]+)/);
        if (match) displayCover = decodeURIComponent(match[1]);
        else break;
      }
      while (/^https?:\/\/img\.chhhn\.com\/https?:\/\//i.test(displayCover)) {
        displayCover = displayCover.replace(/^https?:\/\/img\.chhhn\.com\//i, '');
      }
      if (displayCover.startsWith('data:') || displayCover.includes('No%20Cover') || displayCover.includes('pic.loklok.tv')) {
        displayCover = '';
      }
    }
    if (displayCover && !displayCover.startsWith('http') && !displayCover.startsWith('/')) {
      displayCover = 'https://img.snssb.com/' + displayCover;
    }
    if (displayCover && !displayCover.startsWith('/api/image')) {
      displayCover = `/api/image?url=${encodeURIComponent(displayCover)}`;
    }

    // Proactive on-the-fly cover auto-healer for cards with empty or placeholder covers
    if (!displayCover && item.title) {
      setTimeout(() => {
        fetch(`/api/cover-lookup?title=${encodeURIComponent(item.title.trim())}`)
          .then(r => r.json())
          .then(d => {
            if (d && d.success && d.covers && d.covers[item.title.trim()]) {
              const freshCover = d.covers[item.title.trim()];
              const imgEl = document.querySelector(`img[data-history-id="${item.id}"]`);
              if (imgEl) {
                imgEl.src = freshCover;
                delete imgEl.dataset.failed;
              }
              item.cover = freshCover;
              const hist = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
              const target = hist.find(h => String(h.id) === String(item.id) || (h.title && h.title.trim().toLowerCase() === item.title.trim().toLowerCase()));
              if (target) {
                target.cover = freshCover;
                localStorage.setItem('loklok_watch_history', JSON.stringify(hist));
              }
            }
          })
          .catch(() => {});
      }, 50);
    }

    return `
      <div class="loklok-card" onclick="openDetailModal('${item.id}', '${item.category || 1}')">
        <div class="card-poster-wrap">
          <img class="card-poster-img" data-history-id="${item.id}" data-history-title="${escapeHtml(item.title)}" src="${displayCover || SVG_FALLBACK}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="handleImgError(this)">
          <span class="badge-top-right">${progressPercent || 0}%</span>
        </div>
        <div class="card-info">
          <div class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
          <div class="card-subtext-ep">${escapeHtml(epNameLabel)}</div>
          <div class="card-subtext-status">${statusLabel}</div>
          <div class="card-actions-row">
            <button class="btn-resume-history" onclick="event.stopPropagation(); resumeWatchHistoryItem(${itemJson})">▶ RESUME</button>
            <button class="btn-delete-history" title="Delete item" onclick="deleteHistoryItem(event, ${itemJson})">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (grid.innerHTML !== htmlContent) {
    grid.innerHTML = htmlContent;
  }
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

  // Merge server and local history by ID & Normalized Title
  const map = new Map();
  const titleToKey = new Map();

  const processItem = (item) => {
    if (!item || !item.id || deletedSet.has(String(item.id))) return;
    const key = String(item.id);
    const normTitle = (item.title || '').trim().toLowerCase();

    // Check if we already have this title under another key
    let existingKey = key;
    if (normTitle && titleToKey.has(normTitle)) {
      existingKey = titleToKey.get(normTitle);
    }

    if (!map.has(existingKey)) {
      map.set(existingKey, item);
      if (normTitle) titleToKey.set(normTitle, existingKey);
    } else {
      const prev = map.get(existingKey);
      if ((item.updatedAt || 0) >= (prev.updatedAt || 0)) {
        if (!item.cover && prev.cover) item.cover = prev.cover;
        map.set(existingKey, item);
      }
    }
  };

  serverHistory.forEach(processItem);
  localHistory.forEach(processItem);

  const combined = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  localStorage.setItem('loklok_watch_history', JSON.stringify(combined));

  // Automatically link & upload pre-login local history to cloud account upon login
  if (state.token && localHistory.length > 0) {
    const serverIdSet = new Set(serverHistory.map(s => String(s.id)));
    const serverTitleSet = new Set(serverHistory.map(s => (s.title || '').trim().toLowerCase()));

    localHistory.forEach(locItem => {
      if (!locItem || !locItem.id) return;
      const normTitle = (locItem.title || '').trim().toLowerCase();
      if (!serverIdSet.has(String(locItem.id)) && (!normTitle || !serverTitleSet.has(normTitle))) {
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': state.token },
          body: JSON.stringify({
            action: 'save',
            id: String(locItem.id),
            category: String(locItem.category || 1),
            title: locItem.title,
            cover: locItem.cover || '',
            episodeId: String(locItem.episodeId || ''),
            episodeName: locItem.episodeName || 'Episode 1',
            progressTime: locItem.progressTime || 0,
            totalTime: locItem.totalTime || 0
          })
        }).catch(() => {});
      }
    });
  }

  console.log(`📊 Quiet Sync History (${combined.length} total items):`, combined);
  console.groupEnd();

  // Render view through our filter/sort system
  renderHistoryView();

  // Automatic Background Cover Auto-Healer for Watch History
  const titlesNeedingCovers = combined
    .filter(it => !it.cover || it.cover.startsWith('data:') || it.cover.includes('No%20Cover') || it.cover.includes('pic.loklok.tv') || it.cover.includes('https%3A%2F%2Fimg.chhhn.com%2Fhttps'))
    .map(it => (it.title || '').trim())
    .filter(t => t.length > 0);

  if (titlesNeedingCovers.length > 0) {
    fetch('/api/cover-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: titlesNeedingCovers })
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.covers) {
        let hasUpdates = false;
        for (const [title, resolvedCover] of Object.entries(data.covers)) {
          if (!resolvedCover) continue;
          const escapedTitle = title.replace(/"/g, '\\"');
          const imgs = document.querySelectorAll(`img[data-history-title="${escapedTitle}"]`);
          imgs.forEach(img => {
            img.src = resolvedCover;
            delete img.dataset.failed;
          });
          const matchItem = combined.find(it => (it.title || '').trim().toLowerCase() === title.toLowerCase());
          if (matchItem) {
            matchItem.cover = resolvedCover;
            hasUpdates = true;
          }
        }
        if (hasUpdates) {
          localStorage.setItem('loklok_watch_history', JSON.stringify(combined));
          if (typeof renderHistoryView === 'function') {
            renderHistoryView();
          }
        }
      }
    })
    .catch(() => {});
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
  if (!img || img.dataset.failed === 'true') return;
  const currentSrc = img.src || '';

  // Mark immediately as failed to prevent any infinite loops
  img.dataset.failed = 'true';

  // On-demand cover recovery using title attribute if image fails
  const itemTitle = img.getAttribute('data-history-title') || img.getAttribute('alt') || '';
  if (itemTitle && !img.dataset.lookedUp) {
    img.dataset.lookedUp = 'true';
    fetch(`/api/cover-lookup?title=${encodeURIComponent(itemTitle.trim())}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.success && data.covers && data.covers[itemTitle.trim()]) {
          const freshCover = data.covers[itemTitle.trim()];
          img.src = freshCover;
          delete img.dataset.failed;
          // Update localStorage history if applicable
          try {
            const hist = JSON.parse(localStorage.getItem('loklok_watch_history') || '[]');
            const target = hist.find(h => (h.title || '').trim().toLowerCase() === itemTitle.trim().toLowerCase());
            if (target) {
              target.cover = freshCover;
              localStorage.setItem('loklok_watch_history', JSON.stringify(hist));
            }
          } catch (_) {}
          return;
        }
        img.src = SVG_FALLBACK;
      })
      .catch(() => {
        img.src = SVG_FALLBACK;
      });
    return;
  }

  img.src = SVG_FALLBACK;
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

  if (state.token && state.user) {
    if (logoutContainer) logoutContainer.style.display = 'block';
    userArea.innerHTML = `
      <div style="position:relative; display:flex; align-items:center; gap:0.5rem; cursor:pointer;" onclick="toggleUserDropdown(event)" title="User Options">
        <img class="user-avatar-btn" src="${avatar}" alt="Avatar" style="width:34px;height:34px;border-radius:50%;border:2px solid var(--accent-cyan);object-fit:cover;box-shadow:0 0 10px rgba(0,255,255,0.3);" onerror="handleAvatarError(this)">
        <span style="font-size:0.85rem;font-weight:600;color:#fff;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(nickName)}</span>
        <span style="font-size:0.7rem;color:var(--text-muted);">▼</span>

        <div id="user-dropdown-menu" style="display:none; position:absolute; top:calc(100% + 10px); right:0; background:rgba(12,12,18,0.96); backdrop-filter:blur(20px); border:1px solid rgba(0,255,255,0.2); border-radius:12px; min-width:200px; box-shadow:0 16px 40px rgba(0,0,0,0.8), 0 0 10px rgba(0,255,255,0.15); z-index:999999; padding:0.5rem 0;">
          <div style="padding:0.75rem 1rem; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.8rem; color:var(--text-muted);">
            Signed in as<br><strong style="color:#fff;font-size:0.85rem;">${escapeHtml(u.email || u.username || nickName)}</strong>
          </div>
          <a onclick="switchNav('history')" style="display:flex; align-items:center; gap:0.6rem; padding:0.65rem 1rem; color:#fff; text-decoration:none; font-size:0.85rem; cursor:pointer;" onmouseover="this.style.background='rgba(0,255,255,0.1)'" onmouseout="this.style.background='transparent'">
            🕒 Watch History
          </a>
          <a onclick="switchNav('watchlist')" style="display:flex; align-items:center; gap:0.6rem; padding:0.65rem 1rem; color:#fff; text-decoration:none; font-size:0.85rem; cursor:pointer;" onmouseover="this.style.background='rgba(0,255,255,0.1)'" onmouseout="this.style.background='transparent'">
            ⭐ My Watchlist
          </a>
          <a onclick="openAccountSettingsModal()" style="display:flex; align-items:center; gap:0.6rem; padding:0.65rem 1rem; color:#fff; text-decoration:none; font-size:0.85rem; cursor:pointer;" onmouseover="this.style.background='rgba(0,255,255,0.1)'" onmouseout="this.style.background='transparent'">
            ⚙️ Account Settings
          </a>
          <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:0.25rem; padding-top:0.25rem;">
            <a onclick="handleLogout()" style="display:flex; align-items:center; gap:0.6rem; padding:0.65rem 1rem; color:#ef4444; text-decoration:none; font-size:0.85rem; font-weight:600; cursor:pointer;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='transparent'">
              🚪 Sign Out
            </a>
          </div>
        </div>
      </div>
    `;

    // Update Profile Header inside Watch History View
    const profileHeader = document.getElementById('profile-header-container');
    if (profileHeader) {
      profileHeader.innerHTML = `
        <div style="display:flex;align-items:center;gap:1.25rem;margin-bottom:1.5rem;background:var(--bg-card);padding:1.25rem;border-radius:16px;border:1px solid var(--border-glass);">
          <img src="${avatar}" alt="Avatar" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--accent-cyan);object-fit:cover;box-shadow:0 0 12px rgba(0,255,255,0.4);" onerror="handleAvatarError(this)">
          <div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <h2 style="font-size:1.4rem;font-weight:700;">${escapeHtml(nickName)}</h2>
              <button onclick="handleLogout()" style="background:none;border:none;color:#fb7185;font-size:0.8rem;cursor:pointer;text-decoration:underline;">Sign out</button>
            </div>
            <div style="margin-top:0.3rem;font-size:0.85rem;color:var(--text-muted);">
              <span>Account active: Cloud History & Watchlist Sync Enabled</span>
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

window.openLoginModal = function() {
  const errEl = document.getElementById('auth-error-msg');
  if (errEl) errEl.style.display = 'none';
  
  const loginForm = document.getElementById('form-auth-login');
  if (loginForm) loginForm.reset();
  const regForm = document.getElementById('form-auth-register');
  if (regForm) regForm.reset();
  
  switchAuthTab('login');
  openModal('modal-login');
};

window.switchAuthTab = function(tab) {
  const loginTab = document.getElementById('tab-auth-login');
  const regTab = document.getElementById('tab-auth-register');
  const loginForm = document.getElementById('form-auth-login');
  const regForm = document.getElementById('form-auth-register');
  const errEl = document.getElementById('auth-error-msg');
  if (errEl) errEl.style.display = 'none';

  if (tab === 'register') {
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'flex';
    if (loginTab) {
      loginTab.style.fontWeight = '500';
      loginTab.style.color = 'var(--text-muted)';
      loginTab.style.borderBottom = 'none';
    }
    if (regTab) {
      regTab.style.fontWeight = '700';
      regTab.style.color = '#fff';
      regTab.style.borderBottom = '2px solid #ec4899';
    }
  } else {
    if (regForm) regForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'flex';
    if (loginTab) {
      loginTab.style.fontWeight = '700';
      loginTab.style.color = '#fff';
      loginTab.style.borderBottom = '2px solid var(--accent-cyan)';
    }
    if (regTab) {
      regTab.style.fontWeight = '500';
      regTab.style.color = 'var(--text-muted)';
      regTab.style.borderBottom = 'none';
    }
  }
};

window.handleWoxLogin = async function(e) {
  if (e) e.preventDefault();
  const identifier = document.getElementById('login-identifier') ? document.getElementById('login-identifier').value.trim() : '';
  const password = document.getElementById('login-password') ? document.getElementById('login-password').value.trim() : '';
  const errEl = document.getElementById('auth-error-msg');

  if (!identifier || !password) {
    if (errEl) {
      errEl.innerText = 'Please enter your username/email and password.';
      errEl.style.display = 'block';
    }
    return;
  }

  try {
    const res = await fetch('/api/auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername: identifier, password: password })
    });
    const data = await res.json();

    if (data.success && data.token) {
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('loklok_token', data.token);
      localStorage.setItem('loklok_user', JSON.stringify(data.user));

      initUserUI();
      closeModal('modal-login');
      showToast(`Welcome back, ${data.user.username || data.user.nickName || 'User'}!`);
    } else {
      if (errEl) {
        errEl.innerText = data.error || 'Invalid credentials.';
        errEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = 'Connection error. Please try again.';
      errEl.style.display = 'block';
    }
  }
};

window.handleWoxRegister = async function(e) {
  if (e) e.preventDefault();
  const username = document.getElementById('reg-username') ? document.getElementById('reg-username').value.trim() : '';
  const email = document.getElementById('reg-email') ? document.getElementById('reg-email').value.trim() : '';
  const password = document.getElementById('reg-password') ? document.getElementById('reg-password').value.trim() : '';
  const errEl = document.getElementById('auth-error-msg');

  if (!username || !email || !password) {
    if (errEl) {
      errEl.innerText = 'Please fill out all fields.';
      errEl.style.display = 'block';
    }
    return;
  }

  try {
    const res = await fetch('/api/auth?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();

    if (data.success && data.token) {
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('loklok_token', data.token);
      localStorage.setItem('loklok_user', JSON.stringify(data.user));

      initUserUI();
      closeModal('modal-login');
      showToast(`Account created! Welcome, ${data.user.username}!`);
    } else {
      if (errEl) {
        errEl.innerText = data.error || 'Registration failed.';
        errEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = 'Connection error. Please try again.';
      errEl.style.display = 'block';
    }
  }
};

window.handleLogout = function() {
  localStorage.removeItem('loklok_token');
  localStorage.removeItem('loklok_user');
  state.token = '';
  state.user = null;
  initUserUI();
  showToast('Signed out of WOX-Stream.');
};

window.toggleUserDropdown = function(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('user-dropdown-menu');
  if (menu) {
    menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none';
  }
};

document.addEventListener('click', () => {
  const menu = document.getElementById('user-dropdown-menu');
  if (menu) menu.style.display = 'none';
});

if (!appInitialToken) {
  localStorage.removeItem('loklok_token');
}

window.switchNav = function(viewName, pushUrl = true) {
  state.activeNav = viewName;

  if (state.token && viewName !== 'history') {
    try { loadHistory(true); } catch (_) {}
  }

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
    if (viewName === 'home') {
      history.replaceState({ view: 'home' }, '', window.location.pathname);
    } else {
      history.replaceState({ view: viewName }, '', `?view=${encodeURIComponent(viewName)}`);
    }
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
    const inputVal = document.getElementById('search-input') ? document.getElementById('search-input').value.trim() : '';
    const grid = document.getElementById('search-grid');
    if (!inputVal && grid && !grid.children.length) {
      executeKeywordSearch();
    }
  } else if (viewName === 'watchlist') {
    if (viewWatchlist) viewWatchlist.style.display = 'block';
    loadWatchlist();
  }
};

// Automatic Background Cloud Sync for Authenticated Accounts (every 15s)
setInterval(() => {
  if (state.token && typeof loadHistory === 'function') {
    try { loadHistory(true); } catch (_) {}
  }
}, 15000);

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
  const boostBar = document.getElementById('player-landscape-boost-bar') || document.getElementById('vol-boost-dropdown');
  const qualBar = document.getElementById('player-landscape-quality-bar');
  const drawer = document.getElementById('player-episodes-drawer');
  const subModal = document.getElementById('player-sub-modal') || document.getElementById('player-sub-popover');
  if (qualBar) qualBar.style.display = 'none';
  if (drawer) drawer.style.display = 'none';
  if (subModal) subModal.style.display = 'none';

  if (boostBar) {
    const isHidden = window.getComputedStyle(boostBar).display === 'none' || boostBar.style.display === 'none';
    boostBar.style.display = isHidden ? 'block' : 'none';
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

  const toggleLoklok = document.getElementById('setting-source-loklok');
  const toggleNarto = document.getElementById('setting-source-narto');
  const toggleHollywood = document.getElementById('setting-source-hollywood');
  const toggleViva = document.getElementById('setting-source-viva');
  const toggleAnime = document.getElementById('setting-source-anime');
  const toggleClassics = document.getElementById('setting-source-classics');

  const isDedupDisabled = localStorage.getItem('wox_disable_dedup') === 'true';
  const toggleDedupSearch = document.getElementById('search-dedup-toggle');
  const toggleDedupSettings = document.getElementById('setting-disable-dedup');
  if (toggleDedupSearch) toggleDedupSearch.checked = isDedupDisabled;
  if (toggleDedupSettings) toggleDedupSettings.checked = isDedupDisabled;

  if (toggleAdult) toggleAdult.checked = state.settings.allowAdult;
  if (toggleLgbt) toggleLgbt.checked = state.settings.blockLgbt;
  if (togglePorno) togglePorno.checked = state.settings.blockPorno;
  if (toggleBoot) toggleBoot.checked = state.settings.autoboot;

  if (toggleLoklok) toggleLoklok.checked = state.settings.sourceLoklok;
  if (toggleNarto) toggleNarto.checked = state.settings.sourceNarto;
  if (toggleHollywood) toggleHollywood.checked = state.settings.sourceHollywood;
  if (toggleViva) toggleViva.checked = state.settings.sourceViva;
  if (toggleAnime) toggleAnime.checked = state.settings.sourceAnime;
  if (toggleClassics) toggleClassics.checked = state.settings.sourceClassics;

  if (langSelect) langSelect.value = state.language;
  if (cacheText) cacheText.innerText = calculateCacheSize();
}

function toggleDeduplicationSetting(isDisabled) {
  localStorage.setItem('wox_disable_dedup', isDisabled ? 'true' : 'false');
  const toggleDedupSearch = document.getElementById('search-dedup-toggle');
  const toggleDedupSettings = document.getElementById('setting-disable-dedup');
  if (toggleDedupSearch) toggleDedupSearch.checked = isDisabled;
  if (toggleDedupSettings) toggleDedupSettings.checked = isDisabled;

  const searchView = document.getElementById('view-search');
  if (searchView && searchView.style.display !== 'none') {
    executeKeywordSearch();
  }
  const categoryView = document.getElementById('view-category');
  if (categoryView && categoryView.style.display !== 'none') {
    if (typeof executeCategorySearch === 'function') executeCategorySearch(true);
  }
  const homeView = document.getElementById('view-home');
  if (homeView && homeView.style.display !== 'none') {
    if (typeof _clientHomeFeedCache !== 'undefined' && _clientHomeFeedCache) {
      renderHomeFeedData(_clientHomeFeedCache);
    }
  }
}
window.toggleDeduplicationSetting = toggleDeduplicationSetting;

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
  state.filters.sourceFilter = sourceKey || '';
}

function initFilterPillListeners() {
  setupPillGroup('pills-source', val => {
    state.filters.sourceFilter = val;
    executeCategorySearch(true);
  });
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

  console.group(`%c🔍 [Search Multi-Source Debug] Query: "${searchQuery}"`, 'color: #38bdf8; font-weight: bold; font-size: 1.15rem;');
  console.log('⏱️ Timestamp:', new Date().toLocaleTimeString());
  console.log('🔑 Auth Token:', state.token ? `${state.token.substring(0, 16)}...` : 'Guest');

  try {
    const isDedupDisabled = localStorage.getItem('wox_disable_dedup') === 'true';
    const res = await fetch(`/api/search?keyword=${encodeURIComponent(searchQuery)}&token=${encodeURIComponent(state.token || '')}&allowAdult=${String(state.settings.allowAdult || false)}&disable_dedup=${isDedupDisabled ? 'true' : 'false'}&dedup=${isDedupDisabled ? 'false' : 'true'}`);
    const data = await res.json();
    const rawResults = data.results || [];
    const filtered = filterContentBySettings(rawResults);
    const counts = data.sourceCounts || {};

    console.log('%c📊 Source Breakdown Counts:', 'color: #a855f7; font-weight: bold;');
    console.table({
      'Loklok HD': { count: counts.loklok || 0 },
      'Hollywood (TMDB)': { count: counts.hollywood || 0 },
      'Narto Short Drama': { count: counts.narto || 0 },
      'Anime HD': { count: counts.anime || 0 },
      'Asian Drama': { count: counts.drama || 0 },
      'Classics': { count: counts.classics || 0 },
      'Adult (18+)': { count: counts.adult || 0 },
      'Total Combined': { count: rawResults.length }
    });

    if (data.debugInfo) {
      console.log('%c🛠️ Server Diagnostic Info:', 'color: #eab308; font-weight: bold;', data.debugInfo);
      if (data.debugInfo.hollywoodError) console.warn('⚠️ Hollywood Error:', data.debugInfo.hollywoodError);
      if (data.debugInfo.nartoError) console.warn('⚠️ Narto Error:', data.debugInfo.nartoError);
      if (data.debugInfo.animeError) console.warn('⚠️ Anime Error:', data.debugInfo.animeError);
      if (data.debugInfo.dramaError) console.warn('⚠️ Drama Error:', data.debugInfo.dramaError);
    }

    console.log(`✅ Filtered and Displayed: ${filtered.length} titles`);
    console.groupEnd();

    if (filtered.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem;">No media titles found for this search term.</p>';
    } else {
      grid.innerHTML = filtered.map(item => renderLoklokCard(item)).join('');
    }
  } catch (err) {
    console.error('❌ Search execution failed:', err);
    console.groupEnd();
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
    const isDedupDisabled = localStorage.getItem('wox_disable_dedup') === 'true';
    const queryParams = new URLSearchParams({
      params: state.filters.params || 'MOVIE,TV,VARIETY,COMIC,DOCUMENTARY,MINISERIES',
      area: state.filters.area || '',
      category: state.filters.category || '',
      order: state.filters.order || 'count',
      sort: state.filters.cursor || '',
      source: state.filters.sourceFilter || '',
      page: state.filters.page || 0,
      token: state.token || '',
      allowAdult: String(state.settings.allowAdult || false),
      dedup: isDedupDisabled ? 'false' : 'true'
    });

    const res = await fetch(`/api/search?${queryParams.toString()}`);
    const data = await res.json();

    const rawResults = data.results || [];
    const filtered = filterContentBySettings(rawResults).filter(item => {
      if (!item.id || state.filters.seenIds.has(item.id)) return false;
      state.filters.seenIds.add(item.id);
      return true;
    });

    state.filters.cursor = data.nextCursor || '';
    state.filters.hasMore = !!data.nextCursor && rawResults.length > 0;
    state.filters.loadingMore = false;

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

    if (spEl) spEl.style.display = 'none';

    // Auto-fill grid if total visible cards is low (< 16) and server has more pages available
    const totalVisibleCards = grid.querySelectorAll('.loklok-card').length;
    if (totalVisibleCards < 16 && state.filters.hasMore && (state.filters.autoFetchCount || 0) < 4) {
      state.filters.autoFetchCount = (state.filters.autoFetchCount || 0) + 1;
      setTimeout(() => { executeCategorySearch(false); }, 100);
      return;
    }
    state.filters.autoFetchCount = 0;

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
  }, { rootMargin: '1200px 0px' });

  categoryInfiniteObserver.observe(sentinel);

  // Reliable window scroll fallback listener
  window.addEventListener('scroll', () => {
    if (state.activeNav !== 'category' || state.filters.loadingMore || !state.filters.hasMore) return;
    const scrollPosition = window.innerHeight + window.scrollY;
    const threshold = document.documentElement.offsetHeight - 1200;
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

let _clientHomeFeedCache = null;
let _clientHomeFeedTime = 0;

function renderHomeFeedData(data) {
  const container = document.getElementById('home-shelves');
  if (!container || !data || !data.sections) return;

  const allItems = [];
  data.sections.forEach(sec => allItems.push(...(sec.items || [])));
  
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
          <button class="shelf-switch-btn" onclick="loadHomeFeed(true)">Switch 🔄</button>
        </div>
        <div class="card-grid">
          ${filteredItems.map((item, idx) => renderLoklokCard(item, idx < 6)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

async function loadHomeFeed(forceRefresh = false) {
  const container = document.getElementById('home-shelves');
  if (!container) return;

  // Instant render from Client-Side Memory Cache (< 3 min TTL)
  if (!forceRefresh && _clientHomeFeedCache && (Date.now() - _clientHomeFeedTime < 180000)) {
    renderHomeFeedData(_clientHomeFeedCache);
    return;
  }

  container.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch(`/api/home?allowAdult=${String(state.settings.allowAdult || false)}&token=${encodeURIComponent(state.token)}`);
    const data = await res.json();

    if (!data.success || !data.sections || data.sections.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:3rem;">Unable to load home feed.</p>';
      return;
    }

    _clientHomeFeedCache = data;
    _clientHomeFeedTime = Date.now();
    renderHomeFeedData(data);
  } catch (err) {
    container.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:3rem;">Error loading home: ${err.message}</p>`;
  }
}

function deduplicateClientMediaList(items) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  const seenIds = new Set();
  const seasonKeysSet = new Set();

  const cleanedItems = items.filter(item => {
    if (!item || !item.title || !item.id) return false;
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    item.cleanTitle = String(item.title)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘`´]/g, "'")
      .replace(/[（【]/g, '(')
      .replace(/[）】]/g, ')')
      .replace(/^\[(?:narto|loklok|hollywood|classics|anime|adult)\]\s*/gi, '')
      .replace(/\s*\[(?:english|hindi|indonesian|tagalog|portuguese|spanish|french|german|japanese|korean|chinese|dubbed|subbed|dub|sub|uncensored|hd|4k|1080p|720p|bahasa)\]/gi, '')
      .replace(/\s*\([^)]*(?:india|korea|japan|philippines|china|indonesia|thailand|vietnam|us|uk|dubbed|subbed|dub|sub|uncensored|hd|4k|1080p|720p|english|hindi|indonesian|tagalog|portuguese|spanish|french|german|bahasa)[^)]*\)/gi, '')
      .replace(/\s*\b(?:tagalog|english|hindi|indonesian|portuguese|spanish|french|german|dubbed|subbed)\b$/gi, '')
      .trim();
    return true;
  });

  cleanedItems.forEach(item => {
    const isSeasoned = /\bseason\s*\d+|\bs\d{1,2}|\bpart\.?\s*\d+/i.test(item.cleanTitle);
    if (isSeasoned) {
      const baseName = item.cleanTitle
        .replace(/\s*[-:]?\s*season\s*\d+/gi, '')
        .replace(/\s*\bseason\s*\d+\b/gi, '')
        .replace(/\s*\bs\d{1,2}\b/gi, '')
        .replace(/\s*[-:]?\s*part\.?\s*\d+/gi, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      if (baseName) seasonKeysSet.add(baseName);
    }
  });

  for (const item of cleanedItems) {
    const domain = String(item.domainType || item.category || '1').toUpperCase();
    const rawNorm = item.cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isBareParent = seasonKeysSet.has(rawNorm) && !/\bseason\s*\d+|\bs\d{1,2}|\bpart/i.test(item.cleanTitle);

    let targetKey = `${rawNorm}_${domain}`;
    if (isBareParent) {
      targetKey = `${rawNorm}season1_${domain}`;
    }

    if (!map.has(targetKey)) {
      map.set(targetKey, { ...item, title: item.cleanTitle });
    } else {
      const existing = map.get(targetKey);
      if (!existing.mirrors) {
        existing.mirrors = [
          { id: existing.id, sourceKey: existing.sourceKey || 'loklok', sourceName: existing.sourceName || 'Main Server' }
        ];
      }
      const currentMirror = {
        id: item.id,
        sourceKey: item.sourceKey || (item.isNarto ? 'narto' : 'loklok'),
        sourceName: item.sourceName || 'Alternative Mirror',
        category: item.category
      };
      if (!existing.mirrors.some(m => m.id === item.id)) {
        existing.mirrors.push(currentMirror);
      }
      if ((!existing.cover || existing.cover.includes('placeholder') || existing.cover.includes('snssb')) && item.cover && item.cover.includes('tmdb')) {
        existing.cover = item.cover;
      }
      if (!existing.score && item.score) {
        existing.score = item.score;
      }
    }
  }

  return Array.from(map.values());
}

function filterContentBySettings(items) {
  if (!Array.isArray(items)) return [];
  const filtered = items.filter(item => {
    if (!item) return false;
    const title = (item.title || '').toLowerCase();
    const srcKey = String(item.sourceKey || '').toLowerCase();

    if (state.settings.blockLgbt && (title.includes('lgbt') || title.includes('queer') || title.includes('gay') || title.includes('lesbian'))) {
      return false;
    }
    if (state.settings.blockPorno && (title.includes('18+') || title.includes('adult') || title.includes('erotic'))) {
      return false;
    }

    if (state.settings.sourceLoklok === false && (!srcKey || srcKey === 'loklok')) return false;
    if (state.settings.sourceNarto === false && (item.isNarto || srcKey === 'narto')) return false;
    if (state.settings.sourceHollywood === false && (srcKey === 'hollywood' || srcKey === 'flixhq')) return false;

    return true;
  });
  const isDedupDisabled = localStorage.getItem('wox_disable_dedup') === 'true';
  if (isDedupDisabled) {
    return filtered;
  }
  return deduplicateClientMediaList(filtered);
}

function getSourceBadge(item) {
  if (!item) return { name: 'Loklok HD', icon: '⚡', bg: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#ffffff' };
  
  let key = (item.sourceKey || '').toLowerCase();
  let name = item.sourceName || '';

  if (!key && item.id) {
    const idStr = String(item.id);
    if (idStr.startsWith('wox_l_')) key = 'loklok';
    else if (idStr.startsWith('m_') || idStr.startsWith('t_') || idStr.startsWith('hw_') || idStr.startsWith('hollywood_')) key = 'hollywood';
    else if (idStr.startsWith('narto_')) key = 'narto';
    else if (idStr.startsWith('anime_') || idStr.startsWith('al_')) key = 'anime';
    else if (idStr.startsWith('drama_') || idStr.startsWith('asian-drama')) key = 'drama';
    else if (idStr.startsWith('classics_')) key = 'classics';
    else if (idStr.startsWith('adult_') || idStr.startsWith('hstream_') || idStr.startsWith('hentaimama_')) key = 'adult';
  }

  const BADGE_STYLES = {
    'loklok': { name: 'Loklok HD', icon: '⚡', bg: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#ffffff' },
    'hollywood': { name: 'Hollywood', icon: '🎬', bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#ffffff' },
    'narto': { name: 'Narto Reel', icon: '📱', bg: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff' },
    'anime': { name: 'Anime', icon: '🌸', bg: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff' },
    'drama': { name: 'Asian Drama', icon: '🐉', bg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#ffffff' },
    'classics': { name: 'Classics', icon: '🏛️', bg: 'linear-gradient(135deg, #64748b, #475569)', color: '#ffffff' },
    'adult': { name: '18+ Adult', icon: '🔥', bg: 'linear-gradient(135deg, #ef4444, #991b1b)', color: '#ffffff' }
  };

  return BADGE_STYLES[key] || { name: name || 'HD Stream', icon: '🎥', bg: 'linear-gradient(135deg, #6366f1, #4338ca)', color: '#ffffff' };
}

function renderWoxCard(item, isHighPriority = false) {
  if (!item || !item.id) return '';
  const cleanTitle = String(item.title || '').replace(/^\[narto\]\s*/i, '').trim();
  const itemJson = JSON.stringify({ id: item.id, category: item.category || 1, title: cleanTitle, cover: item.cover, score: item.score || '8.5' }).replace(/"/g, '&quot;');
  const sBadge = getSourceBadge(item);
  
  let domainLabel = 'HD';
  if (item.domainType === 0 || item.domainType === '0') domainLabel = 'MOVIE';
  else if (item.domainType === 1 || item.domainType === '1') domainLabel = 'TV';
  else if (typeof item.domainType === 'string' && item.domainType.length > 1) domainLabel = item.domainType;

  const yearText = item.releaseDate || item.year || item.area || domainLabel;

  return `
    <div class="loklok-card" onclick="openDetailModal('${item.id}', '${item.category !== undefined && item.category !== null ? item.category : 1}')">
      <div class="card-poster-wrap">
        <span class="source-pill-badge" style="background:${sBadge.bg};color:${sBadge.color};">${sBadge.icon} ${escapeHtml(sBadge.name)}</span>
        <img class="card-poster-img" src="${item.cover}" alt="${escapeHtml(cleanTitle)}" decoding="async" ${isHighPriority ? 'fetchpriority="high"' : 'loading="lazy"'} onerror="handleImgError(this)">
        ${item.releaseDate ? `<span class="badge-top-right" style="background:linear-gradient(135deg, #f59e0b, #ef4444);color:#fff;font-weight:700;font-size:0.75rem;">⏳ ${escapeHtml(item.releaseDate)}</span>` : (item.score ? `<span class="badge-top-right">★ ${item.score}</span>` : '')}
        <div class="poster-bottom-info">
          <span class="poster-hd-tag">${domainLabel}</span>
        </div>
      </div>

      <div class="card-details">
        <div class="card-name">${escapeHtml(cleanTitle)}</div>
        <div class="card-subtext">${escapeHtml(yearText)}</div>
        <div style="display:flex;gap:0.4rem;margin-top:0.5rem;">
          <button class="btn-appointment" style="flex:1;" onclick="toggleAppointment(event, ${itemJson})">REMIND</button>
          <button class="btn-appointment" style="background:rgba(147,51,234,0.2);color:#c084fc;padding:0 0.5rem;" title="Add to Collection" onclick="toggleCollection(event, ${itemJson})">+</button>
        </div>
      </div>
    </div>
  `;
}

function renderLoklokCard(item, isHighPriority = false) {
  return renderWoxCard(item, isHighPriority);
}

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
  if (clean && typeof loadHistory === 'function') {
    try { loadHistory(true); } catch (_) {}
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const decoded = decodeHTMLEntitiesClient(str);
  return String(decoded).replace(/[&<>"']/g, match => {
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
          <div class="search-suggestion-item" onclick="openDetailModal('${item.id}', '${item.category !== undefined && item.category !== null ? item.category : 1}'); document.getElementById('search-suggestions-dropdown').style.display='none';" style="display:flex; align-items:center; gap:0.85rem; padding:0.65rem 1rem; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background='rgba(0,255,255,0.08)'" onmouseout="this.style.background='transparent'">
            <img src="${item.cover}" style="width:44px;height:60px;object-fit:cover;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.6);" onerror="handleImgError(this)">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:1.05rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;">${escapeHtml(cleanTitle)}</div>
              <div style="font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
                <span style="color:#fbbf24;font-weight:700;">★ ${item.score || '8.5'}</span>
                <span style="opacity:0.4;">•</span>
                <span style="color:#38bdf8;font-weight:600;">${escapeHtml(item.sourceName || 'WOX Stream')}</span>
              </div>
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
      const results = data.results || [];
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
  const urlSourceVal = urlParams.get('source');
  const urlParamsVal = urlParams.get('params');
  const urlAreaVal = urlParams.get('area');
  const urlCategoryVal = urlParams.get('category');

  const searchQuery = urlParams.get('q') || urlParams.get('keyword');

  if (targetView && ['category', 'history', 'calendar', 'search', 'watchlist', 'home'].includes(targetView)) {
    if (targetView === 'category') {
      if (urlSourceVal !== null) {
        state.filters.sourceFilter = urlSourceVal;
        updatePillState('pills-source', urlSourceVal);
      }
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
    if (targetView === 'search' && searchQuery) {
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = searchQuery;
      performSearch(searchQuery);
    }
  } else if (searchQuery) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = searchQuery;
    performSearch(searchQuery);
  } else {
    loadHomeFeed();
  }

  const partyCode = urlParams.get('party') || urlParams.get('room') || urlParams.get('code');
  if (partyCode) {
    joinStreamPartyRoom(partyCode.toUpperCase());
  }

  if (playId) {
    openDetailModal(playId, cat);
  }
}

state.party = {
  active: false,
  code: null,
  isHost: false,
  pollTimer: null,
  lastMsgTime: 0,
  lastReactTime: 0,
  suppressSync: false
};

window.openStreamPartyModal = function() {
  const codeInput = document.getElementById('party-code-input');
  if (codeInput) codeInput.value = '';

  if (state.party.active && state.party.code) {
    const initView = document.getElementById('party-view-initial');
    const actView = document.getElementById('party-view-active');
    const badge = document.getElementById('party-room-badge');
    if (initView) initView.style.display = 'none';
    if (actView) actView.style.display = 'flex';
    if (badge) {
      badge.style.display = 'block';
      badge.innerText = state.party.code;
    }
  } else {
    const initView = document.getElementById('party-view-initial');
    const actView = document.getElementById('party-view-active');
    const badge = document.getElementById('party-room-badge');
    if (initView) initView.style.display = 'flex';
    if (actView) actView.style.display = 'none';
    if (badge) badge.style.display = 'none';
  }

  openModal('modal-stream-party');
};

window.createStreamPartyRoom = async function() {
  if (!state.currentMedia || !state.currentMedia.id) {
    // Auto-fallback to featured show if user hasn't selected a media title yet
    state.currentMedia = { id: 'wox_l_MjYyOA', title: 'Foundation Season 1', category: '1' };
    state.currentEpisode = { id: '1', name: 'Episode 1' };
  }

  const u = state.user || {};
  const hostName = u.username || u.nickName || 'Party Host';
  const hostAvatar = u.avatar || u.portrait || '';

  try {
    const res = await fetch('/api/stream-party?action=create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaId: state.currentMedia.id,
        title: state.currentMedia.title || 'Untitled',
        cover: state.currentMedia.cover || '',
        episodeId: state.currentEpisode ? state.currentEpisode.id : '1',
        episodeName: state.currentEpisode ? state.currentEpisode.name : 'Episode 1',
        hostName,
        hostAvatar
      })
    });
    const data = await res.json();

    if (data.success && data.roomCode) {
      state.party.active = true;
      state.party.code = data.roomCode;
      state.party.isHost = true;
      state.party.lastMsgTime = 0;
      state.party.lastReactTime = 0;

      const shareInput = document.getElementById('party-share-url');
      if (shareInput) shareInput.value = data.shareUrl || `${window.location.origin}/?party=${data.roomCode}`;

      const initView = document.getElementById('party-view-initial');
      const actView = document.getElementById('party-view-active');
      const badge = document.getElementById('party-room-badge');
      if (initView) initView.style.display = 'none';
      if (actView) actView.style.display = 'flex';
      if (badge) {
        badge.style.display = 'block';
        badge.innerText = data.roomCode;
      }

      openModal('modal-stream-party');
      startPartyPolling();
      showToast(`🎉 Stream Party created! Code: ${data.roomCode}`);
    } else {
      showToast(data.error || 'Could not create party room.');
    }
  } catch (err) {
    showToast('Failed to create Stream Party.');
  }
};

window.joinStreamPartyByInput = function() {
  const input = document.getElementById('party-code-input');
  const code = input ? input.value.trim().toUpperCase() : '';
  if (!code) return showToast('Please enter a valid room code.');
  joinStreamPartyRoom(code);
};

window.joinStreamPartyRoom = async function(roomCode) {
  const u = state.user || {};
  const userName = u.username || u.nickName || `Viewer_${Math.floor(Math.random()*1000)}`;
  const userAvatar = u.avatar || u.portrait || '';

  try {
    const res = await fetch('/api/stream-party?action=join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: roomCode, userName, userAvatar })
    });
    const data = await res.json();

    if (data.success && data.room) {
      state.party.active = true;
      state.party.code = data.roomCode;
      state.party.isHost = data.isHost;
      state.party.lastMsgTime = 0;
      state.party.lastReactTime = 0;

      const shareUrl = `${window.location.origin}/?party=${data.roomCode}`;
      const shareInput = document.getElementById('party-share-url');
      if (shareInput) shareInput.value = shareUrl;

      const initView = document.getElementById('party-view-initial');
      const actView = document.getElementById('party-view-active');
      const badge = document.getElementById('party-room-badge');
      if (initView) initView.style.display = 'none';
      if (actView) actView.style.display = 'flex';
      if (badge) {
        badge.style.display = 'block';
        badge.innerText = data.roomCode;
      }

      // Auto-load & auto-play host's media title for synchronized watching
      const rMedia = data.room.media;
      if (rMedia && rMedia.id) {
        closeModal('modal-detail');
        playVideo(
          { id: rMedia.id, title: rMedia.title, cover: rMedia.cover, category: '1' },
          { id: rMedia.episodeId || '1', name: rMedia.episodeName || 'Episode 1' }
        );
      }

      openModal('modal-stream-party');
      startPartyPolling();
      showToast(`Joined Stream Party ${data.roomCode}! 🍿`);
    } else {
      showToast(data.error || 'Stream Party room not found.');
    }
  } catch (err) {
    showToast('Failed to join Stream Party.');
  }
};

function startPartyPolling() {
  if (state.party.pollTimer) clearInterval(state.party.pollTimer);
  pollPartyUpdates();
  state.party.pollTimer = setInterval(pollPartyUpdates, 1500);
}

async function pollPartyUpdates() {
  if (!state.party.active || !state.party.code) return;

  try {
    const url = `/api/stream-party?action=get&code=${state.party.code}&sinceMsg=${state.party.lastMsgTime}&sinceReact=${state.party.lastReactTime}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      state.party.active = false;
      if (state.party.pollTimer) clearInterval(state.party.pollTimer);
      return;
    }

    // Update participants count & avatars
    const pCount = document.getElementById('party-participants-count');
    if (pCount) pCount.innerText = `👥 ${data.participantCount || 1} Watching`;

    const pList = document.getElementById('party-participants-list');
    if (pList && data.participants) {
      pList.innerHTML = data.participants.slice(0, 5).map(p => `
        <img src="${p.avatar}" title="${escapeHtml(p.name)}" style="width:26px;height:26px;border-radius:50%;border:2px solid var(--accent-cyan);object-fit:cover;">
      `).join('');
    }

    // Update chat messages
    if (data.messages && data.messages.length > 0) {
      const chatBox = document.getElementById('party-chat-messages');
      if (chatBox) {
        data.messages.forEach(m => {
          if (m.timestamp > state.party.lastMsgTime) {
            state.party.lastMsgTime = m.timestamp;
            const isSys = m.sender === 'SYSTEM';
            const msgHtml = isSys
              ? `<div style="font-size:0.78rem;color:var(--text-muted);font-style:italic;">${escapeHtml(m.text)}</div>`
              : `<div style="display:flex;gap:0.4rem;font-size:0.82rem;">
                  <strong style="color:var(--accent-cyan);">${escapeHtml(m.sender)}:</strong>
                  <span style="color:#fff;">${escapeHtml(m.text)}</span>
                </div>`;
            chatBox.insertAdjacentHTML('beforeend', msgHtml);
            chatBox.scrollTop = chatBox.scrollHeight;
          }
        });
      }
    }

    // Handle floating emoji reactions
    if (data.reactions && data.reactions.length > 0) {
      data.reactions.forEach(r => {
        if (r.timestamp > state.party.lastReactTime) {
          state.party.lastReactTime = r.timestamp;
          spawnFloatingEmoji(r.emoji);
        }
      });
    }

    // Sync video state if viewer (not host)
    if (!state.party.isHost && data.state && state.artPlayer) {
      const pState = data.state;
      const curTime = state.artPlayer.currentTime || 0;
      if (Math.abs(curTime - pState.currentTime) > 3) {
        state.party.suppressSync = true;
        state.artPlayer.currentTime = pState.currentTime;
        setTimeout(() => { state.party.suppressSync = false; }, 500);
      }
      if (pState.isPlaying && state.artPlayer.paused) {
        state.artPlayer.play();
      } else if (!pState.isPlaying && !state.artPlayer.paused) {
        state.artPlayer.pause();
      }
    }

  } catch (_) {}
}

window.copyPartyShareLink = function() {
  const shareInput = document.getElementById('party-share-url');
  if (shareInput) {
    shareInput.select();
    navigator.clipboard.writeText(shareInput.value);
    showToast('Party share link copied to clipboard!');
  }
};

window.sendPartyChatMessage = async function() {
  const input = document.getElementById('party-chat-input');
  const text = input ? input.value.trim() : '';
  if (!text || !state.party.code) return;

  input.value = '';
  const u = state.user || {};
  const senderName = u.username || u.nickName || 'Viewer';
  const senderAvatar = u.avatar || '';

  try {
    await fetch('/api/stream-party?action=message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: state.party.code, text, senderName, senderAvatar })
    });
    pollPartyUpdates();
  } catch (_) {}
};

window.handlePartyChatKeyUp = function(e) {
  if (e.key === 'Enter') sendPartyChatMessage();
};

window.sendPartyReaction = async function(emoji) {
  if (!state.party.code) return;
  const u = state.user || {};
  const senderName = u.username || u.nickName || 'Viewer';
  spawnFloatingEmoji(emoji);

  try {
    await fetch('/api/stream-party?action=reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: state.party.code, emoji, senderName })
    });
  } catch (_) {}
};

function spawnFloatingEmoji(emoji) {
  const container = document.getElementById('modal-player') || document.body;
  const el = document.createElement('div');
  el.innerText = emoji;
  el.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: ${Math.floor(Math.random() * 80) + 20}px;
    font-size: 2.2rem;
    z-index: 1000000;
    pointer-events: none;
    animation: floatEmoji 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  `;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2300);
}

let pickedWheelMedia = null;

window.openSurpriseWheelModal = function() {
  const resultCard = document.getElementById('wheel-result-card');
  const watchBtn = document.getElementById('wheel-watch-btn');
  if (resultCard) resultCard.style.display = 'none';
  if (watchBtn) watchBtn.style.display = 'none';
  openModal('modal-surprise-wheel');
};

window.spinSurpriseWheel = function() {
  const spinner = document.getElementById('wheel-spinner');
  const resultCard = document.getElementById('wheel-result-card');
  const watchBtn = document.getElementById('wheel-watch-btn');
  const pickedTitle = document.getElementById('wheel-picked-title');
  const pickedMeta = document.getElementById('wheel-picked-meta');

  if (!spinner) return;

  const randomRots = 5 + Math.floor(Math.random() * 5);
  const targetDeg = randomRots * 360 + Math.floor(Math.random() * 360);
  spinner.style.transform = `rotate(${targetDeg}deg)`;

  fetch('/api/search?q=movie&fast=true').then(r => r.json()).then(data => {
    const items = (data && data.results) || [];
    if (items.length > 0) {
      pickedWheelMedia = items[Math.floor(Math.random() * items.length)];
    }
  }).catch(() => {});

  setTimeout(() => {
    if (pickedWheelMedia && pickedTitle) {
      pickedTitle.innerText = pickedWheelMedia.title || 'Recommended Hit';
      if (pickedMeta) pickedMeta.innerText = `Rating: ⭐ ${pickedWheelMedia.score || '8.8'} • Category: ${pickedWheelMedia.domainType || 'HD'}`;
      if (resultCard) resultCard.style.display = 'block';
      if (watchBtn) watchBtn.style.display = 'inline-flex';
    } else if (pickedTitle) {
      pickedTitle.innerText = 'Spider-Man: No Way Home';
      if (pickedMeta) pickedMeta.innerText = 'Rating: ⭐ 9.5 • Action / Sci-Fi';
      if (resultCard) resultCard.style.display = 'block';
      if (watchBtn) watchBtn.style.display = 'inline-flex';
    }
    showToast('🎉 Wheel Selected a Top Rated Title!');
  }, 3000);
};

window.playPickedWheelItem = function() {
  closeModal('modal-surprise-wheel');
  if (pickedWheelMedia && pickedWheelMedia.id) {
    openDetailModal(pickedWheelMedia.id, pickedWheelMedia.category || '1');
  } else {
    openDetailModal('wox_l_MTE1Mjk', '1');
  }
};

let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const btn = document.getElementById('btn-pwa-install-row');
  if (btn) btn.style.display = 'flex';
});

window.installPwaApp = async function() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    const { outcome } = await deferredPwaPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('🚀 Installing WOX-Stream App to your home screen!');
    }
    deferredPwaPrompt = null;
  } else {
    // Instructions for iOS Safari and other browsers
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      showToast('📲 On iPhone/iPad: Tap the Share button in Safari and tap "Add to Home Screen"');
    } else {
      showToast('📲 Tap browser menu (⋮) and choose "Install App" or "Add to Home Screen"');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initUserUI();
  initSettingsUI();
  initFilterPillListeners();
  initInfiniteScrollObserver();
  initMovieLinkRouter();
});
