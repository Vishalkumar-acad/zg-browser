/**
 * Unit Test Suite: History Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.6
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { HistoryManager } = require('../../src/main/history-manager');

describe('History Manager', () => {
  it('adds browsing entries and sorts newest first', () => {
    const hm = new HistoryManager();

    hm.addEntry({ url: 'https://duckduckgo.com', title: 'DuckDuckGo' });
    hm.addEntry({ url: 'https://github.com', title: 'GitHub' });

    const res = hm.list();
    assert.equal(res.entries.length, 2);
    assert.equal(res.entries[0].url, 'https://github.com');
  });

  it('strictly excludes ephemeral private browsing tabs from history', () => {
    const hm = new HistoryManager();

    const entry = hm.addEntry({
      url: 'https://private-session.com',
      title: 'Secret Page',
      isEphemeral: true
    });

    assert.equal(entry, null);
    assert.equal(hm.size, 0);

    const res = hm.list();
    assert.equal(res.entries.length, 0);
  });

  it('filters history entries by query string', () => {
    const hm = new HistoryManager();

    hm.addEntry({ url: 'https://news.ycombinator.com', title: 'Hacker News' });
    hm.addEntry({ url: 'https://github.com/trending', title: 'GitHub Trending' });
    hm.addEntry({ url: 'https://reddit.com/r/programming', title: 'Reddit' });

    const searchHacker = hm.list({ query: 'hacker' });
    assert.equal(searchHacker.entries.length, 1);
    assert.equal(searchHacker.entries[0].title, 'Hacker News');

    const searchGit = hm.list({ query: 'github' });
    assert.equal(searchGit.entries.length, 1);
    assert.equal(searchGit.entries[0].url, 'https://github.com/trending');
  });

  it('deletes single entry by ID', () => {
    const hm = new HistoryManager();

    const e1 = hm.addEntry({ url: 'https://site1.com', title: 'Site 1' });
    const e2 = hm.addEntry({ url: 'https://site2.com', title: 'Site 2' });

    assert.equal(hm.size, 2);

    const delRes = hm.deleteEntry(e1.id);
    assert.equal(delRes.ok, true);
    assert.equal(hm.size, 1);

    const list = hm.list();
    assert.equal(list.entries[0].id, e2.id);
  });

  it('clears history completely or by time range', () => {
    const hm = new HistoryManager();

    const now = Date.now();
    // Entry 2 hours ago
    const oldEntry = hm.addEntry({ url: 'https://old.com', title: 'Old' });
    oldEntry.visitedAt = now - (2 * 60 * 60 * 1000);

    // Entry 10 mins ago
    const recentEntry = hm.addEntry({ url: 'https://recent.com', title: 'Recent' });
    recentEntry.visitedAt = now - (10 * 60 * 1000);

    assert.equal(hm.size, 2);

    // Clear hour: should only remove recentEntry
    hm.clear('hour');
    assert.equal(hm.size, 1);
    assert.equal(hm.list().entries[0].url, 'https://old.com');

    // Clear all: should remove everything
    hm.clear('all');
    assert.equal(hm.size, 0);
  });
});
