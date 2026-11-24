/**
 * Zero-Gravity Browser - Minimal Vanilla JS UI Controller
 * Uses window.zgAPI exposed via Preload contextBridge
 */

document.addEventListener('DOMContentLoaded', () => {
  const hoverTrigger = document.getElementById('hover-trigger');
  const overlaysRoot = document.getElementById('overlays-root');
  const omnibarOverlay = document.getElementById('overlay-omnibar');
  const omnibarInput = document.getElementById('omnibar-input');
  const scratchpadDrawer = document.getElementById('scratchpad-drawer');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');

  let omnibarVisible = false;
  let scratchpadVisible = false;

  // Toggle Omnibar
  async function setOmnibarVisible(visible) {
    omnibarVisible = visible;
    if (visible) {
      overlaysRoot.hidden = false;
      omnibarOverlay.hidden = false;
      omnibarInput.focus();
      omnibarInput.select();
    } else {
      omnibarOverlay.hidden = true;
      overlaysRoot.hidden = true;
    }
    if (window.zgAPI && window.zgAPI.ui) {
      await window.zgAPI.ui.toggleOverlay('omnibar', visible);
    }
  }

  // Toggle Scratchpad
  async function setScratchpadVisible(visible) {
    scratchpadVisible = visible;
    scratchpadDrawer.hidden = !visible;
    if (window.zgAPI && window.zgAPI.ui) {
      await window.zgAPI.ui.toggleScratchpad(visible);
    }
  }

  // Top 4px hover trigger
  if (hoverTrigger) {
    hoverTrigger.addEventListener('mouseenter', () => {
      if (!omnibarVisible) {
        setOmnibarVisible(true);
      }
    });
  }

  // Close button on drawer
  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', () => {
      setScratchpadVisible(false);
    });
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Cmd/Ctrl+L: Omnibar
    if (mod && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setOmnibarVisible(!omnibarVisible);
      return;
    }

    // Cmd/Ctrl+Shift+E: Scratchpad
    if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      setScratchpadVisible(!scratchpadVisible);
      return;
    }

    // Escape: Dismiss active overlays
    if (e.key === 'Escape') {
      if (omnibarVisible) {
        e.preventDefault();
        setOmnibarVisible(false);
      } else if (scratchpadVisible) {
        e.preventDefault();
        setScratchpadVisible(false);
      }
    }
  });

  // Omnibar Enter -> Navigate
  if (omnibarInput) {
    omnibarInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const query = omnibarInput.value.trim();
        if (query && window.zgAPI && window.zgAPI.nav) {
          // If query doesn't look like URL, use search engine
          let targetUrl = query;
          if (!query.startsWith('http://') && !query.startsWith('https://')) {
            if (query.includes('.') && !query.includes(' ')) {
              targetUrl = 'https://' + query;
            } else {
              targetUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(query);
            }
          }
          await setOmnibarVisible(false);
          // Send navigation to current active tab
          await window.zgAPI.nav.go('active', targetUrl);
        }
      }
    });
  }

  // System Event Listeners
  if (window.zgAPI && window.zgAPI.system) {
    window.zgAPI.system.onCertError((err) => {
      const banner = document.getElementById('overlay-cert-error');
      const text = document.getElementById('cert-error-text');
      if (banner && text) {
        text.textContent = `Security Warning: Certificate error [${err.errorCode}] for ${err.url}. Navigation blocked.`;
        overlaysRoot.hidden = false;
        banner.hidden = false;
      }
    });
  }
});
