/**
 * Zero-Gravity Browser - Renderer Components Orchestrator
 * Single Source of Truth: Blueprint v2.3 Section 4.1, 4.3, 4.4, 4.6, 4.9
 * 
 * Vanilla ES6+ HTML5 Web Components Controller
 * Communicates strictly via Preload contextBridge window.zgAPI
 */

async function initApp() {
  const api = window.zgAPI;
  if (!api) {
    console.warn('zgAPI not available');
    return;
  }

  // --- DOM Elements: Browser Chrome (Persistent Top Bar) ---
  const browserChrome = document.getElementById('browser-chrome');
  const hoverTrigger = document.getElementById('hover-trigger');
  const overlaysRoot = document.getElementById('overlays-root');

  // Tabs Row
  const tabstripContainer = document.getElementById('tabstrip-container');
  const btnNewTab = document.getElementById('btn-new-tab');
  const btnDistractionFree = document.getElementById('btn-distraction-free');
  const btnScratchpadToggle = document.getElementById('btn-scratchpad-toggle');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');

  // Navigation & Address Bar Row
  const navBackBtn = document.getElementById('nav-back-btn');
  const navForwardBtn = document.getElementById('nav-forward-btn');
  const navReloadBtn = document.getElementById('nav-reload-btn');
  const omnibarInput = document.getElementById('omnibar-input');
  const omnibarSecurityBadge = document.getElementById('omnibar-security-badge');
  const privacyBadge = document.getElementById('privacy-badge');
  const trackerBlockedCount = document.getElementById('tracker-blocked-count');
  const btnHistoryToggle = document.getElementById('btn-history-toggle');
  const btnPaletteToggle = document.getElementById('btn-palette-toggle');

  // --- DOM Elements: Overlays ---
  const overlayCommandPalette = document.getElementById('overlay-command-palette');
  const commandInput = document.getElementById('command-input');
  const commandList = document.getElementById('command-list');

  const overlayFindBar = document.getElementById('overlay-find-bar');
  const findInput = document.getElementById('find-input');
  const findCount = document.getElementById('find-count');
  const findPrevBtn = document.getElementById('find-prev-btn');
  const findNextBtn = document.getElementById('find-next-btn');
  const findCloseBtn = document.getElementById('find-close-btn');

  const overlayHistoryPanel = document.getElementById('overlay-history-panel');
  const historyList = document.getElementById('history-list');
  const historyClearHourBtn = document.getElementById('history-clear-hour-btn');
  const historyClearAllBtn = document.getElementById('history-clear-all-btn');
  const historyCloseBtn = document.getElementById('history-close-btn');

  // Settings Modal Elements
  const overlaySettingsPanel = document.getElementById('overlay-settings-panel');
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  const settingsTabButtons = document.querySelectorAll('.settings-tab-btn');
  const settingsTabContents = document.querySelectorAll('.settings-tab-content');

  // Settings Tab 1: General
  const settingsThemeSelect = document.getElementById('settings-theme-select');
  const settingsNewTabInput = document.getElementById('settings-newtab-input');
  const settingsSearchSelect = document.getElementById('settings-search-select');
  const settingsCustomSearchContainer = document.getElementById('settings-custom-search-container');
  const settingsCustomSearchInput = document.getElementById('settings-custom-search-input');
  const settingsSaveGeneralBtn = document.getElementById('settings-save-general-btn');

  // Settings Tab 2: Privacy
  const settingsTrackerCheck = document.getElementById('settings-tracker-check');
  const settingsAllowlistInput = document.getElementById('settings-allowlist-input');
  const settingsAllowlistAddBtn = document.getElementById('settings-allowlist-add-btn');
  const settingsAllowlistList = document.getElementById('settings-allowlist-list');
  const settingsClearDataBtn = document.getElementById('settings-clear-data-btn');

  // Settings Tab 3: Vault
  const settingsExportJsonBtn = document.getElementById('settings-export-json-btn');
  const settingsExportMdBtn = document.getElementById('settings-export-md-btn');
  const settingsVaultRepoInput = document.getElementById('settings-vault-repo-input');
  const settingsSaveVaultBtn = document.getElementById('settings-save-vault-btn');
  const settingsSafeStorageStatus = document.getElementById('settings-safestorage-status');
  const settingsVaultSyncStatus = document.getElementById('settings-vault-sync-status');

  // Settings Tab 4: About
  const aboutAppVersion = document.getElementById('about-app-version');
  const aboutElectronVersion = document.getElementById('about-electron-version');
  const aboutChromeVersion = document.getElementById('about-chrome-version');
  const aboutNodeVersion = document.getElementById('about-node-version');
  const aboutCreditsList = document.getElementById('about-credits-list');

  // Downloads, Cert Error, Permissions
  const overlayDownloadBar = document.getElementById('overlay-download-bar');
  const downloadList = document.getElementById('download-list');
  const downloadBarCloseBtn = document.getElementById('download-bar-close-btn');

  const overlayCertError = document.getElementById('overlay-cert-error');
  const certErrorText = document.getElementById('cert-error-text');
  const certErrorCloseBtn = document.getElementById('cert-error-close-btn');

  const overlayPermissionPrompt = document.getElementById('overlay-permission-prompt');
  const permissionPromptText = document.getElementById('permission-prompt-text');
  const permissionPersistCheck = document.getElementById('permission-persist-check');
  const permissionAllowBtn = document.getElementById('permission-allow-btn');
  const permissionDenyBtn = document.getElementById('permission-deny-btn');

  // Scratchpad Drawer
  const scratchpadDrawer = document.getElementById('scratchpad-drawer');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const scratchpadEditor = document.getElementById('scratchpad-editor');
  const scratchpadStatus = document.getElementById('scratchpad-status');

  // --- State ---
  let activeOverlay = null; // 'command-palette' | 'find-bar' | 'history' | 'settings' | 'downloads' | 'permission' | 'cert-error'
  let scratchpadOpen = false;
  let distractionFree = false;
  let activeTabId = null;
  let activePermissionRequestId = null;

  // --- Overlay Coordinator ---
  async function showOverlay(overlayId, extraParam) {
    if (activeOverlay === overlayId) {
      await hideAllOverlays();
      return;
    }

    // Expand bounds over website view in Main FIRST so full modal is visible
    try {
      await api.ui.toggleOverlay(overlayId, true);
    } catch (err) {
      console.warn('api.ui.toggleOverlay error:', err);
    }

    hideAllOverlays(false);
    activeOverlay = overlayId;
    overlaysRoot.hidden = false;

    if (overlayId === 'command-palette') {
      overlayCommandPalette.hidden = false;
      commandInput.value = '';
      commandInput.focus();
      renderCommandList('');
    } else if (overlayId === 'find-bar') {
      overlayFindBar.hidden = false;
      findInput.focus();
      findInput.select();
    } else if (overlayId === 'history') {
      overlayHistoryPanel.hidden = false;
      try { await loadHistory(); } catch {}
    } else if (overlayId === 'settings') {
      overlaySettingsPanel.hidden = false;
      if (extraParam) {
        switchSettingsTab(extraParam);
      }
      try { await loadSettings(); } catch {}
      try { await loadAboutInfo(); } catch {}
      try { await loadAllowlist(); } catch {}
    } else if (overlayId === 'downloads') {
      overlayDownloadBar.hidden = false;
    } else if (overlayId === 'cert-error') {
      overlayCertError.hidden = false;
    } else if (overlayId === 'permission') {
      overlayPermissionPrompt.hidden = false;
    }
  }

  async function hideAllOverlays(notifyMain = true) {
    overlayCommandPalette.hidden = true;
    overlayFindBar.hidden = true;
    overlayHistoryPanel.hidden = true;
    overlaySettingsPanel.hidden = true;
    overlayDownloadBar.hidden = true;
    overlayCertError.hidden = true;
    overlayPermissionPrompt.hidden = true;

    if (!scratchpadOpen) {
      overlaysRoot.hidden = true;
    }

    const prev = activeOverlay;
    activeOverlay = null;

    if (notifyMain && prev) {
      await api.ui.toggleOverlay(prev, false);
    }
  }

  // --- Scratchpad Drawer Coordinator ---
  async function toggleScratchpad(visible) {
    scratchpadOpen = typeof visible === 'boolean' ? visible : !scratchpadOpen;
    scratchpadDrawer.hidden = !scratchpadOpen;
    if (scratchpadOpen) {
      scratchpadEditor.focus();
    }
    await api.ui.toggleScratchpad(scratchpadOpen);
  }

  // --- Distraction-Free UI Mode Coordinator ---
  async function toggleDistractionFreeMode() {
    distractionFree = !distractionFree;
    browserChrome.hidden = distractionFree;
    hoverTrigger.hidden = !distractionFree;
    await api.ui.toggleDistractionFree(distractionFree);
  }

  // 4px top hover trigger when distraction-free is active
  hoverTrigger.addEventListener('mouseenter', () => {
    if (distractionFree) {
      browserChrome.hidden = false;
    }
  });

  browserChrome.addEventListener('mouseleave', () => {
    if (distractionFree && !activeOverlay) {
      browserChrome.hidden = true;
    }
  });

  // --- Wire Top Chrome Buttons ---
  btnDistractionFree.addEventListener('click', toggleDistractionFreeMode);
  btnScratchpadToggle.addEventListener('click', () => toggleScratchpad());
  btnSettingsToggle.addEventListener('click', () => showOverlay('settings'));
  btnHistoryToggle.addEventListener('click', () => showOverlay('history'));
  btnPaletteToggle.addEventListener('click', () => showOverlay('command-palette'));

  privacyBadge.addEventListener('click', () => {
    showOverlay('settings', 'privacy');
  });

  navBackBtn.addEventListener('click', async () => {
    await api.nav.back('active');
  });

  navForwardBtn.addEventListener('click', async () => {
    await api.nav.forward('active');
  });

  navReloadBtn.addEventListener('click', async () => {
    await api.nav.reload('active');
  });

  drawerCloseBtn.addEventListener('click', () => toggleScratchpad(false));

  // --- Tabstrip Management ---
  btnNewTab.addEventListener('click', async () => {
    await api.tabs.create();
    omnibarInput.focus();
    omnibarInput.select();
  });

  api.tabs.onTabsUpdated((data) => {
    if (!data || !data.tabs) return;
    activeTabId = data.activeId;

    tabstripContainer.innerHTML = '';

    data.tabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${tab.id === data.activeId ? 'active' : ''} ${tab.isEphemeral ? 'ephemeral' : ''}`;
      tabEl.title = tab.url;

      const titleSpan = document.createElement('span');
      titleSpan.textContent = tab.isCrashed ? '💥 Crashed' : (tab.title || 'New Tab');
      titleSpan.style.flex = '1';
      titleSpan.style.overflow = 'hidden';
      titleSpan.style.textOverflow = 'ellipsis';
      tabEl.appendChild(titleSpan);

      if (tab.isEphemeral) {
        const privBadge = document.createElement('span');
        privBadge.textContent = '🔒';
        privBadge.style.fontSize = '10px';
        tabEl.appendChild(privBadge);
      }

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await api.tabs.close(tab.id);
      });
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', async () => {
        await api.tabs.switch(tab.id);
      });

      tabstripContainer.appendChild(tabEl);
    });

    tabstripContainer.appendChild(btnNewTab);

    // Sync active tab URL and navigation buttons with omnibar
    const activeTab = data.tabs.find((t) => t.id === data.activeId);
    if (activeTab && omnibarInput && document.activeElement !== omnibarInput) {
      omnibarInput.value = (activeTab.url && activeTab.url !== 'about:blank') ? activeTab.url : '';
      if (activeTab.url && activeTab.url.startsWith('https://')) {
        omnibarSecurityBadge.textContent = '🔒';
      } else if (activeTab.url && activeTab.url.startsWith('zg://')) {
        omnibarSecurityBadge.textContent = '🛡️';
      } else {
        omnibarSecurityBadge.textContent = '🌐';
      }
      navBackBtn.disabled = !activeTab.canGoBack;
      navForwardBtn.disabled = !activeTab.canGoForward;
    }

    // Update tracker blocked count for active tab
    updateTrackerStats();
  });

  // --- Navigation & Omnibar Sync ---
  api.nav.onNavUpdated((data) => {
    if (data.tabId === activeTabId) {
      if (document.activeElement !== omnibarInput) {
        omnibarInput.value = (data.url && data.url !== 'about:blank') ? data.url : '';
      }

      if (data.url && data.url.startsWith('https://')) {
        omnibarSecurityBadge.textContent = '🔒';
      } else if (data.url && data.url.startsWith('zg://')) {
        omnibarSecurityBadge.textContent = '🛡️';
      } else {
        omnibarSecurityBadge.textContent = '🌐';
      }

      navBackBtn.disabled = !data.canGoBack;
      navForwardBtn.disabled = !data.canGoForward;

      updateTrackerStats();
    }
  });

  async function updateTrackerStats() {
    try {
      const res = await api.privacy.getBlockedStats('active');
      const stats = (res && res.data) || res;
      if (stats && typeof stats.count === 'number') {
        trackerBlockedCount.textContent = String(stats.count);
      }
    } catch {}
  }

  // --- Omnibar Search & Navigation Execution ---
  omnibarInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const raw = omnibarInput.value.trim();
      if (!raw) return;

      // Handle internal zg:// routes directly
      if (raw === 'zg://settings') {
        showOverlay('settings', 'general');
        return;
      }
      if (raw === 'zg://about') {
        showOverlay('settings', 'about');
        return;
      }
      if (raw === 'zg://history') {
        showOverlay('history');
        return;
      }

      let targetUrl = raw;

      if (!raw.startsWith('http://') && !raw.startsWith('https://') && !raw.startsWith('zg://')) {
        if (raw.includes('.') && !raw.includes(' ') && !raw.startsWith('?')) {
          targetUrl = 'https://' + raw;
        } else {
          // Resolve search query with user-selected search engine
          const settingsRes = await api.settings.get();
          const settingsData = (settingsRes && settingsRes.data) || settingsRes || {};
          const settings = settingsData.settings || {};
          const engine = (settings.searchEngine || 'duckduckgo').toLowerCase();
          const customUrl = settings.customSearchUrl || '';

          if (engine === 'custom' && customUrl) {
            targetUrl = customUrl.includes('%s')
              ? customUrl.replace(/%s/g, encodeURIComponent(raw))
              : customUrl + (customUrl.includes('?') ? '&q=' : '?q=') + encodeURIComponent(raw);
          } else if (engine === 'google') {
            targetUrl = `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
          } else if (engine === 'brave') {
            targetUrl = `https://search.brave.com/search?q=${encodeURIComponent(raw)}`;
          } else if (engine === 'startpage') {
            targetUrl = `https://www.startpage.com/sp/search?query=${encodeURIComponent(raw)}`;
          } else if (engine.startsWith('http://') || engine.startsWith('https://')) {
            targetUrl = engine.includes('%s')
              ? engine.replace(/%s/g, encodeURIComponent(raw))
              : engine + encodeURIComponent(raw);
          } else {
            // Default: DuckDuckGo
            targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(raw)}`;
          }
        }
      }

      await hideAllOverlays();
      await api.nav.go('active', targetUrl);
    }
  });

  // --- Find in Page ---
  findInput.addEventListener('input', async () => {
    const text = findInput.value;
    if (text) {
      await api.find.start('active', text, false);
    } else {
      await api.find.stop('active');
      findCount.textContent = '0/0';
    }
  });

  findNextBtn.addEventListener('click', async () => {
    if (findInput.value) {
      await api.find.next('active', findInput.value, true);
    }
  });

  findPrevBtn.addEventListener('click', async () => {
    if (findInput.value) {
      await api.find.next('active', findInput.value, false);
    }
  });

  findCloseBtn.addEventListener('click', async () => {
    await api.find.stop('active');
    await hideAllOverlays();
  });

  api.find.onFindResult((res) => {
    if (res && res.matches !== undefined) {
      findCount.textContent = `${res.activeMatchOrdinal || 0}/${res.matches}`;
    }
  });

  // --- Command Palette ---
  function renderCommandList(filter) {
    const items = commandList.querySelectorAll('.command-item');
    items.forEach((item) => {
      const text = item.querySelector('span').textContent.toLowerCase();
      item.hidden = Boolean(filter && !text.includes(filter.toLowerCase()));
    });
  }

  commandInput.addEventListener('input', () => {
    renderCommandList(commandInput.value);
  });

  commandList.addEventListener('click', async (e) => {
    const target = e.target.closest('.command-item');
    if (!target) return;
    const action = target.getAttribute('data-action');
    await hideAllOverlays();

    if (action === 'new-tab') {
      await api.tabs.create();
      omnibarInput.focus();
      omnibarInput.select();
    } else if (action === 'close-tab') {
      if (activeTabId) await api.tabs.close(activeTabId);
    } else if (action === 'open-scratchpad') {
      toggleScratchpad();
    } else if (action === 'open-history') {
      showOverlay('history');
    } else if (action === 'open-settings') {
      showOverlay('settings', 'general');
    } else if (action === 'open-about') {
      showOverlay('settings', 'about');
    } else if (action === 'toggle-distraction-free') {
      await toggleDistractionFreeMode();
    }
  });

  // --- History Panel ---
  async function loadHistory() {
    const res = await api.history.list({ limit: 50 });
    historyList.innerHTML = '';
    if (res && res.ok && res.data && res.data.entries) {
      res.data.entries.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'panel-item';

        const textDiv = document.createElement('div');
        textDiv.className = 'panel-item-text';
        textDiv.textContent = item.title || item.url;
        textDiv.title = item.url;
        textDiv.style.cursor = 'pointer';
        textDiv.addEventListener('click', async () => {
          await hideAllOverlays();
          await api.nav.go('active', item.url);
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'zg-btn-icon';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await api.history.deleteEntry(item.id);
          li.remove();
        });

        li.appendChild(textDiv);
        li.appendChild(delBtn);
        historyList.appendChild(li);
      });
    }
  }

  historyClearHourBtn.addEventListener('click', async () => {
    await api.history.clear('hour');
    await loadHistory();
  });

  historyClearAllBtn.addEventListener('click', async () => {
    await api.history.clear('all');
    await loadHistory();
  });

  historyCloseBtn.addEventListener('click', () => hideAllOverlays());

  // --- Settings Modal Tabs Navigation ---
  function switchSettingsTab(tabName) {
    settingsTabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    settingsTabContents.forEach((sec) => {
      sec.hidden = sec.id !== `settings-tab-${tabName}`;
    });
  }

  settingsTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      switchSettingsTab(tabName);
    });
  });

  settingsCloseBtn.addEventListener('click', () => hideAllOverlays());

  // --- Settings Tab 1: General & Search ---
  async function loadSettings() {
    const res = await api.settings.get();
    const data = (res && res.data) || res;
    if (data && data.settings) {
      const s = data.settings;
      if (s.theme) settingsThemeSelect.value = s.theme;
      if (s.newTabUrl) settingsNewTabInput.value = s.newTabUrl;

      const engine = s.searchEngine || 'duckduckgo';
      settingsSearchSelect.value = ['duckduckgo', 'google', 'brave', 'startpage', 'custom'].includes(engine)
        ? engine
        : 'custom';

      if (s.customSearchUrl) {
        settingsCustomSearchInput.value = s.customSearchUrl;
      }
      settingsCustomSearchContainer.hidden = settingsSearchSelect.value !== 'custom';

      if (typeof s.trackerBlockingEnabled === 'boolean') {
        settingsTrackerCheck.checked = s.trackerBlockingEnabled;
      }

      if (s.githubRepo) {
        settingsVaultRepoInput.value = s.githubRepo;
        settingsVaultSyncStatus.textContent = `Connected (${s.githubRepo})`;
      }
    }
  }

  settingsSearchSelect.addEventListener('change', () => {
    settingsCustomSearchContainer.hidden = settingsSearchSelect.value !== 'custom';
  });

  settingsSaveGeneralBtn.addEventListener('click', async () => {
    const patch = {
      theme: settingsThemeSelect.value,
      newTabUrl: settingsNewTabInput.value.trim() || 'about:blank',
      searchEngine: settingsSearchSelect.value
    };

    if (settingsSearchSelect.value === 'custom') {
      patch.customSearchUrl = settingsCustomSearchInput.value.trim();
    }

    await api.settings.update(patch);
    settingsSaveGeneralBtn.textContent = 'Saved!';
    setTimeout(() => {
      settingsSaveGeneralBtn.textContent = 'Save General Settings';
    }, 1500);
  });

  // --- Settings Tab 2: Privacy & Allowlist ---
  settingsTrackerCheck.addEventListener('change', async () => {
    await api.privacy.toggleTrackerBlocking(settingsTrackerCheck.checked);
    await api.settings.update({ trackerBlockingEnabled: settingsTrackerCheck.checked });
  });

  async function loadAllowlist() {
    settingsAllowlistList.innerHTML = '';
    try {
      const res = await api.privacy.getAllowlist();
      const data = (res && res.data) || res;
      if (data && Array.isArray(data.domains)) {
        data.domains.forEach((dom) => {
          const chip = document.createElement('li');
          chip.className = 'allowlist-chip';
          chip.innerHTML = `
            <span>${dom}</span>
            <button class="allowlist-chip-remove" title="Remove allowlist exception">✕</button>
          `;
          chip.querySelector('.allowlist-chip-remove').addEventListener('click', async () => {
            await api.privacy.allowlistSite(dom, false);
            chip.remove();
          });
          settingsAllowlistList.appendChild(chip);
        });
      }
    } catch {}
  }

  settingsAllowlistAddBtn.addEventListener('click', async () => {
    const domain = settingsAllowlistInput.value.trim().toLowerCase();
    if (domain) {
      await api.privacy.allowlistSite(domain, true);
      settingsAllowlistInput.value = '';
      await loadAllowlist();
    }
  });

  settingsClearDataBtn.addEventListener('click', async () => {
    await api.privacy.clearSiteData('*');
    settingsClearDataBtn.textContent = 'Cleared!';
    setTimeout(() => {
      settingsClearDataBtn.textContent = 'Clear All Browsing Data';
    }, 1500);
  });

  // --- Settings Tab 3: Scratchpad & Vault ---
  settingsExportJsonBtn.addEventListener('click', async () => {
    await api.storage.export('json');
  });

  settingsExportMdBtn.addEventListener('click', async () => {
    await api.storage.export('markdown');
  });

  settingsSaveVaultBtn.addEventListener('click', async () => {
    const repo = settingsVaultRepoInput.value.trim();
    if (repo) {
      await api.settings.update({ githubRepo: repo });
      settingsVaultSyncStatus.textContent = `Configured (${repo})`;
      settingsSaveVaultBtn.textContent = 'Saved!';
      setTimeout(() => {
        settingsSaveVaultBtn.textContent = 'Save Vault Settings';
      }, 1500);
    }
  });

  // --- Settings Tab 4: About & Versioning ---
  async function loadAboutInfo() {
    try {
      const res = await api.system.getAbout();
      const info = (res && res.data) || res;
      if (info) {
        aboutAppVersion.textContent = `v${info.version || '0.1.0'}`;
        if (info.versions) {
          aboutElectronVersion.textContent = `Electron ${info.versions.electron}`;
          aboutChromeVersion.textContent = `Chromium ${info.versions.chrome}`;
          aboutNodeVersion.textContent = `Node.js ${info.versions.node}`;
        }

        if (info.security) {
          settingsSafeStorageStatus.textContent = info.security.safeStorageAvailable
            ? 'Available (Encrypted OS Keyring)'
            : 'Unavailable (Fail-Closed: Token storage refused to protect secrets)';
        }

        if (Array.isArray(info.credits)) {
          aboutCreditsList.innerHTML = '';
          info.credits.forEach((c) => {
            const item = document.createElement('div');
            item.className = 'credit-item';
            item.innerHTML = `
              <div>
                <strong>${c.name}</strong>
                <div style="font-size: 11px; color: var(--zg-text-secondary);">${c.description}</div>
              </div>
              <span class="credit-license">${c.license}</span>
            `;
            aboutCreditsList.appendChild(item);
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load about info:', err);
    }
  }

  // --- Downloads ---
  downloadBarCloseBtn.addEventListener('click', () => hideAllOverlays());

  api.downloads.onDownloadUpdated((d) => {
    showOverlay('downloads');
    let itemEl = document.getElementById(`download-${d.downloadId}`);
    if (!itemEl) {
      itemEl = document.createElement('div');
      itemEl.id = `download-${d.downloadId}`;
      itemEl.className = `download-item ${d.isDangerous ? 'dangerous' : ''}`;
      downloadList.appendChild(itemEl);
    }

    itemEl.innerHTML = `
      <div class="download-header">
        <span>${d.isDangerous ? '⚠️ ' : ''}${d.filename}</span>
        <span>${d.state} (${d.progress}%)</span>
      </div>
      <div class="download-progress-bar">
        <div class="download-progress-fill" style="width: ${d.progress}%;"></div>
      </div>
    `;
  });

  // --- Certificate Errors ---
  certErrorCloseBtn.addEventListener('click', () => hideAllOverlays());

  api.system.onCertError((err) => {
    certErrorText.textContent = `The certificate presented by ${err.url} failed validation [${err.errorCode}]. Navigation was rejected.`;
    showOverlay('cert-error');
  });

  // --- Permission Prompts ---
  api.permissions.onPermissionPrompt((req) => {
    activePermissionRequestId = req.requestId;
    permissionPromptText.textContent = `"${req.origin}" is requesting access to "${req.permission}".`;
    permissionPersistCheck.checked = false;
    showOverlay('permission');
  });

  permissionAllowBtn.addEventListener('click', async () => {
    if (activePermissionRequestId) {
      await api.permissions.respond(activePermissionRequestId, true, permissionPersistCheck.checked);
      activePermissionRequestId = null;
    }
    await hideAllOverlays();
  });

  permissionDenyBtn.addEventListener('click', async () => {
    if (activePermissionRequestId) {
      await api.permissions.respond(activePermissionRequestId, false, permissionPersistCheck.checked);
      activePermissionRequestId = null;
    }
    await hideAllOverlays();
  });

  // --- Global Keyboard Shortcuts ---
  window.addEventListener('keydown', async (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Cmd/Ctrl+L: Focus Omnibar
    if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      omnibarInput.focus();
      omnibarInput.select();
      return;
    }

    // Cmd/Ctrl+T: New Tab
    if (mod && e.key.toLowerCase() === 't') {
      e.preventDefault();
      await api.tabs.create();
      omnibarInput.focus();
      omnibarInput.select();
      return;
    }

    // Cmd/Ctrl+W: Close Tab
    if (mod && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (activeTabId) await api.tabs.close(activeTabId);
      return;
    }

    // Cmd/Ctrl+R: Reload
    if (mod && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      await api.nav.reload('active');
      return;
    }

    // Cmd/Ctrl+K: Command Palette
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      activeOverlay === 'command-palette' ? hideAllOverlays() : showOverlay('command-palette');
      return;
    }

    // Cmd/Ctrl+F: Find in Page
    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      activeOverlay === 'find-bar' ? hideAllOverlays() : showOverlay('find-bar');
      return;
    }

    // Cmd/Ctrl+H: History
    if (mod && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      activeOverlay === 'history' ? hideAllOverlays() : showOverlay('history');
      return;
    }

    // Cmd/Ctrl+,: Settings
    if (mod && e.key === ',') {
      e.preventDefault();
      activeOverlay === 'settings' ? hideAllOverlays() : showOverlay('settings');
      return;
    }

    // Cmd/Ctrl+Shift+E: Scratchpad
    if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      toggleScratchpad();
      return;
    }

    // Cmd/Ctrl+Shift+D: Distraction-Free Mode
    if (mod && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      await toggleDistractionFreeMode();
      return;
    }

    // Escape: Dismiss active overlays or scratchpad
    if (e.key === 'Escape') {
      if (activeOverlay) {
        e.preventDefault();
        await hideAllOverlays();
      } else if (scratchpadOpen) {
        e.preventDefault();
        await toggleScratchpad(false);
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
