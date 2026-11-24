/**
 * Zero-Gravity Browser - Scratchpad Drawer Controller (scratchpad.js)
 * Single Source of Truth: Blueprint v2.3 Section 4.7
 * 
 * Features:
 * - Smart debounced auto-save (500ms after last keystroke)
 * - Dirty-state change detection (no blind periodic disk writes)
 * - Workspace tag extraction (@project, #tag) via syntax-lite.js
 * - Storage error handling & crash recovery
 */

const { ScratchpadStorage } = require('../utils/storage');
const { extractWorkspaceTags } = require('../utils/syntax-lite');

class ScratchpadController {
  /**
   * @param {Object} options
   * @param {HTMLTextAreaElement} options.editorEl
   * @param {HTMLElement} options.statusEl
   * @param {number} [options.debounceMs=500]
   */
  constructor({ editorEl, statusEl, debounceMs = 500 } = {}) {
    this.editorEl = editorEl;
    this.statusEl = statusEl;
    this.debounceMs = debounceMs;
    this.storage = new ScratchpadStorage();

    this.activeNoteId = 'default_note';
    this.lastSavedContent = '';
    this.saveTimer = null;
    this.isDirty = false;
  }

  /**
   * Initializes storage and loads active note draft
   */
  async init() {
    await this.storage.init();
    const note = await this.storage.getNote(this.activeNoteId);

    if (note && note.content) {
      this.lastSavedContent = note.content;
      if (this.editorEl) {
        this.editorEl.value = note.content;
      }
    }

    this._updateStatus('Saved');
    this._attachEvents();
  }

  _attachEvents() {
    if (!this.editorEl || typeof this.editorEl.addEventListener !== 'function') return;

    this.editorEl.addEventListener('input', () => {
      const current = this.editorEl.value;

      // Dirty check: only mark dirty if content actually changed
      if (current !== this.lastSavedContent) {
        this.isDirty = true;
        this._updateStatus('Unsaved changes');

        // Reset debounce timer
        if (this.saveTimer) clearTimeout(this.saveTimer);

        this.saveTimer = setTimeout(() => {
          this.save();
        }, this.debounceMs);
      } else {
        this.isDirty = false;
        this._updateStatus('Saved');
      }
    });
  }

  /**
   * Saves current content to IndexedDB if dirty
   */
  async save() {
    if (!this.isDirty || !this.editorEl) return;

    const content = this.editorEl.value;
    const { projects, tags } = extractWorkspaceTags(content);
    const title = projects.length > 0 ? projects[0] : (tags.length > 0 ? tags[0] : 'Scratchpad Note');

    this._updateStatus('Saving...');

    try {
      await this.storage.saveNote({
        id: this.activeNoteId,
        title,
        content,
        tags: [...projects, ...tags]
      });

      this.lastSavedContent = content;
      this.isDirty = false;
      this._updateStatus('Saved');
    } catch {
      this._updateStatus('Save failed');
    }
  }

  _updateStatus(text) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }

  /**
   * Forces flush of any pending edits before close or sync
   */
  async flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.isDirty) {
      await this.save();
    }
  }
}

module.exports = { ScratchpadController };
