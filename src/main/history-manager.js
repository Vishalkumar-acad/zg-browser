/**
 * Zero-Gravity Browser (zg-browser) - History Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.6
 * 
 * Manages profile-aware browsing history.
 * STRICT ENFORCEMENT: Ephemeral private browsing sessions are NEVER recorded.
 */

const crypto = require('crypto');

class HistoryManager {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxEntries=5000] - In-memory safety cap
   */
  constructor({ maxEntries = 5000 } = {}) {
    this.maxEntries = maxEntries;
    this.seq = 0;
    // Map<entryId, HistoryEntry>
    this.entries = new Map();
  }

  /**
   * Records a browsing visit
   * @param {Object} item
   * @param {string} item.url
   * @param {string} [item.title]
   * @param {boolean} [item.isEphemeral=false] - If true, strictly ignored!
   */
  addEntry({ url, title, isEphemeral = false }) {
    // 1. Strict ephemeral partition privacy guard
    if (isEphemeral) {
      return null;
    }

    if (!url || typeof url !== 'string' || url === 'about:blank') {
      return null;
    }

    // Do not record internal UI chrome navigations into history
    if (url.startsWith('zg://')) {
      return null;
    }

    this.seq += 1;
    const entryId = crypto.randomUUID();
    const entry = {
      id: entryId,
      url,
      title: title || url,
      visitedAt: Date.now(),
      seq: this.seq
    };

    this.entries.set(entryId, entry);

    // Evict oldest if exceeding capacity
    if (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }

    return entry;
  }

  /**
   * Lists history entries with optional query filter and limit
   * @param {Object} [options]
   * @param {string} [options.query]
   * @param {number} [options.limit=50]
   */
  list({ query, limit = 50 } = {}) {
    let all = Array.from(this.entries.values());

    if (query && typeof query === 'string' && query.trim()) {
      const q = query.toLowerCase();
      all = all.filter(e => e.url.toLowerCase().includes(q) || (e.title && e.title.toLowerCase().includes(q)));
    }

    // Sort newest first with sequence tie-breaker
    all.sort((a, b) => (b.visitedAt - a.visitedAt) || (b.seq - a.seq));

    const clampedLimit = Math.max(1, Math.min(limit, 1000));
    return {
      entries: all.slice(0, clampedLimit)
    };
  }

  /**
   * Deletes a single history entry
   * @param {string} entryId
   */
  deleteEntry(entryId) {
    const deleted = this.entries.delete(entryId);
    return { ok: deleted };
  }

  /**
   * Clears history by range
   * @param {'hour' | 'day' | 'all'} [range='all']
   */
  clear(range = 'all') {
    if (range === 'all') {
      this.entries.clear();
      return { ok: true };
    }

    const now = Date.now();
    let threshold = 0;
    if (range === 'hour') {
      threshold = now - (60 * 60 * 1000);
    } else if (range === 'day') {
      threshold = now - (24 * 60 * 60 * 1000);
    }

    for (const [id, entry] of this.entries.entries()) {
      if (entry.visitedAt >= threshold) {
        this.entries.delete(id);
      }
    }

    return { ok: true };
  }

  /**
   * Returns current count of stored history entries
   */
  get size() {
    return this.entries.size;
  }
}

module.exports = { HistoryManager };
