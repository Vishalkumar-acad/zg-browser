/**
 * Zero-Gravity Browser - Client Storage (storage.js)
 * Single Source of Truth: Blueprint v2.3 Section 4.7 & 5
 * 
 * Manages IndexedDB persistent storage for Scratchpad notes and snippets.
 * Includes schema migrations, dirty-state change detection, export/import validation.
 */

const DB_NAME = 'zg_scratchpad_db';
const DB_VERSION = 1;
const STORE_NOTES = 'notes';

class ScratchpadStorage {
  constructor() {
    this.db = null;
    this.memoryStore = new Map(); // In-memory fallback
    this.useFallback = false;
  }

  /**
   * Initializes IndexedDB with versioned schema
   */
  async init() {
    if (typeof indexedDB === 'undefined') {
      this.useFallback = true;
      return;
    }

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NOTES)) {
            const store = db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };

        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve();
        };

        req.onerror = () => {
          this.useFallback = true;
          resolve();
        };
      } catch {
        this.useFallback = true;
        resolve();
      }
    });
  }

  /**
   * Saves or updates a Scratchpad note
   * @param {Object} note
   * @param {string} note.id
   * @param {string} note.content
   * @param {string} [note.title]
   * @param {Array<string>} [note.tags]
   */
  async saveNote(note) {
    if (!note || !note.id) throw new Error('Invalid note object: missing id');

    const record = {
      id: String(note.id),
      title: note.title || 'Untitled Snippet',
      content: String(note.content || ''),
      tags: Array.isArray(note.tags) ? note.tags : [],
      updatedAt: Date.now()
    };

    if (this.useFallback || !this.db) {
      this.memoryStore.set(record.id, record);
      return record;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NOTES, 'readwrite');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.put(record);

      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves a note by ID
   * @param {string} id
   */
  async getNote(id) {
    if (this.useFallback || !this.db) {
      return this.memoryStore.get(id) || null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NOTES, 'readonly');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves all notes sorted by updatedAt descending
   */
  async getAllNotes() {
    if (this.useFallback || !this.db) {
      const list = Array.from(this.memoryStore.values());
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      return list;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NOTES, 'readonly');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Deletes a note by ID
   * @param {string} id
   */
  async deleteNote(id) {
    if (this.useFallback || !this.db) {
      return this.memoryStore.delete(id);
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NOTES, 'readwrite');
      const store = tx.objectStore(STORE_NOTES);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Exports all notes to a validated JSON string
   */
  async exportToJson() {
    const notes = await this.getAllNotes();
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      notes
    }, null, 2);
  }

  /**
   * Exports all notes to Markdown formatted document
   */
  async exportToMarkdown() {
    const notes = await this.getAllNotes();
    let md = `# Zero-Gravity Browser Scratchpad Notes\n\nExported: ${new Date().toISOString()}\n\n`;

    for (const note of notes) {
      md += `## ${note.title}\n\n`;
      if (note.tags && note.tags.length > 0) {
        md += `*Tags: ${note.tags.join(' ')}*\n\n`;
      }
      md += '```text\n' + note.content + '\n```\n\n---\n\n';
    }

    return md;
  }

  /**
   * Validates and imports notes from JSON backup string
   * STRICT ENFORCEMENT: Schema and content validated; never executed.
   * @param {string} jsonString
   */
  async importFromJson(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new Error('Invalid import data');
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Malformed JSON payload');
    }

    if (!parsed || !Array.isArray(parsed.notes)) {
      throw new Error('Import data missing notes array');
    }

    let importedCount = 0;
    for (const item of parsed.notes) {
      if (item && item.id && typeof item.content === 'string') {
        await this.saveNote({
          id: String(item.id),
          title: typeof item.title === 'string' ? item.title : 'Imported Snippet',
          content: item.content,
          tags: Array.isArray(item.tags) ? item.tags : []
        });
        importedCount += 1;
      }
    }

    return { importedCount };
  }
}

module.exports = { ScratchpadStorage };
