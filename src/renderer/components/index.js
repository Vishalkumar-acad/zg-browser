/**
 * Zero-Gravity Browser - Renderer Components Orchestrator
 * Single Source of Truth: Blueprint v2.3 Section 4.1, 4.3, 4.4, 4.6, 4.9
 * 
 * Vanilla ES6+ HTML5 Web Components Controller
 * Communicates strictly via Preload contextBridge window.zgAPI
 */

document.addEventListener('DOMContentLoaded', async () => {
  const api = window.zgAPI;
  if (!api) {
    console.warn('zgAPI not available');
    return;
  }

  // --- DOM Elements ---
  const hoverTrigger = document.getElementById('hover-trigger');
  const overlaysRoot = document.getElementById('overlays-root');

  // Overlays
  const overlayTabstrip = document.getElementById('overlay-tabstrip');
  const tabstripContainer = document.getElementById('tabstrip-container');
  const btnNewTab = document.getElementById('btn-new-tab');

  const overlayOmnibar = document.getElementById('overlay-omnibar');
  const omnibarInput = document.getElementById('omnibar-input');
  const omnibarSecurityBadge = document.getElementById('omnibar-security-badge');

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

  const overlaySettingsPanel = document.getElementById('overlay-settings-panel');
  const settingsThemeSelect = document.getElementById('settings-theme-select');
  const settingsSearchSelect = document.getElementById('settings-search-select');
  const settingsTrackerCheck = document.getElementById('settings-tracker-check');
  const settingsCloseBtn = document.getElementById('settings-close-btn');

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

  const scratchpadDrawer = document.getElementById('scratchpad-drawer');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const scratchpadEditor = document.getElementById('scratchpad-editor');
  const scratchpadStatus = document.getElementById('scratchpad-status');

  // --- State ---
  let activeOverlay = null; // 'omnibar' | 'tabstrip' | 'command-palette' | 'find-bar' | 'history' | 'settings' | 'downloads' | 'permission' | 'cert-error'
  let scratchpadOpen = false;
  let activeTabId = null;
  let activePermissionRequestId = null;

  // --- Overlay Coordinator (Notifies Main to expand/collapse WebContentsView bounds) ---
  async function showOverlay(overlayId) {
    // Hide previous
    hideAllOverlays(false);

    activeOverlay = overlayId;
    overlaysRoot.hidden = false;

    if (overlayId === 'omnibar') {
      overlayOmnibar.hidden = false;
      omnibarInput.focus();
      omnibarInput.select();
    } else if (overlayId === 'tabstrip') {
      overlayTabstrip.hidden = false;
    } else if (overlayId === 'command-palette') {
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
      await loadHistory();
    } else if (overlayId === 'settings') {
      overlaySettingsPanel.hidden = false;
      await loadSettings();
    } else if (overlayId === 'downloads') {
      overlayDownloadBar.hidden = false;
    } else if (overlayId === 'cert-error') {
      overlayCertError.hidden = false;
    } else if (overlayId === 'permission') {
      overlayPermissionPrompt.hidden = false;
    }

    // Inform Main process to expand bounds over website view
    await api.ui.toggleOverlay(overlayId, true);
  }

  async function hideAllOverlays(notifyMain = true) {
    overlayOmnibar.hidden = true;
    overlayTabstrip.hidden = true;
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
      // Collapse UI view back to 4px strip so website gets mouse events
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

  // --- 4px Top Hover Trigger ---
  hoverTrigger.addEventListener('mouseenter', () => {
    if (!activeOverlay) {
      showOverlay('omnibar');
    }
  });

  drawerCloseBtn.addEventListener('click', () => toggleScratchpad(false));

  // --- Tab Management ---
  btnNewTab.addEventListener('click', async () => {
    await api.tabs.create();
    showOverlay('omnibar');
  });

  api.tabs.onTabsUpdated((data) => {
    if (!data || !data.tabs) return;
    activeTabId = data.activeId;

    // Preserve new tab button
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
  });

  // --- Navigation Updates ---
  api.nav.onNavUpdated((data) => {
    if (data.tabId === activeTabId && omnibarInput && document.activeElement !== omnibarInput) {
      omnibarInput.value = (data.url && data.url !== 'about:blank') ? data.url : '';
      omnibarSecurityBadge.textContent = data.url && data.url.startsWith('https://') ? '🔒' : '🌐';
    }
  });

  // --- Omnibar Navigation ---
  omnibarInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const query = omnibarInput.value.trim();
      if (!query) return;

      let targetUrl = query;
      if (!query.startsWith('http://') && !query.startsWith('https://') && !query.startsWith('zg://')) {
        if (query.includes('.') && !query.includes(' ')) {
          targetUrl = 'https://' + query;
        } else {
          // Use search engine
          const settings = await api.settings.get();
          const searchBase = (settings && settings.data && settings.data.settings && settings.data.settings.searchEngine)
            || 'https://duckduckgo.com/?q=';
          targetUrl = searchBase + encodeURIComponent(query);
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
      showOverlay('omnibar');
    } else if (action === 'close-tab') {
      if (activeTabId) await api.tabs.close(activeTabId);
    } else if (action === 'open-scratchpad') {
      toggleScratchpad();
    } else if (action === 'open-history') {
      showOverlay('history');
    } else if (action === 'open-settings') {
      showOverlay('settings');
    } else if (action === 'toggle-distraction-free') {
      await api.ui.toggleDistractionFree();
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

  // --- Settings Panel ---
  async function loadSettings() {
    const res = await api.settings.get();
    if (res && res.ok && res.data && res.data.settings) {
      const s = res.data.settings;
      if (s.theme) settingsThemeSelect.value = s.theme;
      if (s.searchEngine) settingsSearchSelect.value = s.searchEngine;
      if (typeof s.trackerBlockingEnabled === 'boolean') settingsTrackerCheck.checked = s.trackerBlockingEnabled;
    }
  }

  settingsThemeSelect.addEventListener('change', async () => {
    await api.settings.update({ theme: settingsThemeSelect.value });
  });

  settingsSearchSelect.addEventListener('change', async () => {
    await api.settings.update({ searchEngine: settingsSearchSelect.value });
  });

  settingsTrackerCheck.addEventListener('change', async () => {
    await api.settings.update({ trackerBlockingEnabled: settingsTrackerCheck.checked });
  });

  settingsCloseBtn.addEventListener('click', () => hideAllOverlays());

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

    // Cmd/Ctrl+L: Omnibar
    if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      activeOverlay === 'omnibar' ? hideAllOverlays() : showOverlay('omnibar');
      return;
    }

    // Cmd/Ctrl+T: New Tab / Tabstrip
    if (mod && e.key.toLowerCase() === 't') {
      e.preventDefault();
      activeOverlay === 'tabstrip' ? hideAllOverlays() : showOverlay('tabstrip');
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
});
