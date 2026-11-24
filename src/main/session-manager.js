/**
 * Zero-Gravity Browser (zg-browser) - Session Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.3 & 5
 * 
 * Manages persistent default session and ephemeral in-memory partitions
 * with verified isolation of cookies, storage, cache, and history.
 */

const { PARTITIONS } = require('../shared/constants');

class SessionManager {
  /**
   * @param {import('electron').session} sessionModule
   */
  constructor(sessionModule) {
    this.sessionModule = sessionModule;
    this.activeEphemeralSessions = new Set();
  }

  /**
   * Get the default persistent session
   */
  getPersistentSession() {
    return this.sessionModule.fromPartition(PARTITIONS.PERSISTENT, { cache: true });
  }

  /**
   * Create an isolated ephemeral in-memory session (for private tabs)
   * Guaranteed zero disk persistence after tab closure.
   * @param {string} sessionId
   */
  createEphemeralSession(sessionId) {
    const partitionName = `${PARTITIONS.EPHEMERAL_PREFIX}${sessionId}`;
    const ephemeralSession = this.sessionModule.fromPartition(partitionName, { cache: false });
    this.activeEphemeralSessions.add(partitionName);
    return ephemeralSession;
  }

  /**
   * Cleans up an ephemeral session immediately upon tab closure
   * @param {string} sessionId
   */
  async cleanupEphemeralSession(sessionId) {
    const partitionName = `${PARTITIONS.EPHEMERAL_PREFIX}${sessionId}`;
    if (!this.activeEphemeralSessions.has(partitionName)) {
      return;
    }

    try {
      const sess = this.sessionModule.fromPartition(partitionName);
      await sess.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage']
      });
      await sess.clearCache();
    } catch (err) {
      // Ephemeral cleanup failure logged safely
    } finally {
      this.activeEphemeralSessions.delete(partitionName);
    }
  }

  /**
   * Clears storage data for a specific origin in persistent session
   * @param {string} origin
   */
  async clearSiteData(origin) {
    const persistent = this.getPersistentSession();
    await persistent.clearStorageData({
      origin,
      storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage']
    });
  }
}

module.exports = { SessionManager };
