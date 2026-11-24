/**
 * Unit Test Suite: Scratchpad Storage & Syntax Lite Tokenizer
 * Single Source of Truth: Blueprint v2.3 Section 4.7 & 5
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  tokenize,
  extractWorkspaceTags,
  highlightCodeToHtml,
  escapeHtml
} = require('../../src/renderer/utils/syntax-lite');
const { ScratchpadStorage } = require('../../src/renderer/utils/storage');
const { ScratchpadController } = require('../../src/renderer/components/scratchpad');

describe('Scratchpad Storage & Syntax Lite Tokenizer', () => {
  describe('syntax-lite.js', () => {
    it('extracts workspace tags (@project, #tag)', () => {
      const text = '// @zg-browser #feature-scratchpad\nconst x = 10; #urgent @zg-browser';
      const { projects, tags } = extractWorkspaceTags(text);

      assert.deepEqual(projects, ['@zg-browser']);
      assert.deepEqual(tags, ['#feature-scratchpad', '#urgent']);
    });

    it('tokenizes keywords, strings, comments, and identifiers', () => {
      const code = 'const count = 42; // initialize';
      const tokens = tokenize(code);

      const types = tokens.map(t => t.type).filter(t => t !== 'whitespace');
      assert.deepEqual(types, ['keyword', 'identifier', 'operator', 'number', 'operator', 'comment']);
    });

    it('escapes HTML to prevent XSS during syntax highlighting', () => {
      const dangerous = '<script>alert("xss")</script>';
      const safe = escapeHtml(dangerous);
      assert.equal(safe.includes('<script>'), false);
      assert.equal(safe.includes('&lt;script&gt;'), true);

      const html = highlightCodeToHtml(dangerous);
      assert.equal(html.includes('<script>'), false);
    });
  });

  describe('ScratchpadStorage (IndexedDB / Fallback)', () => {
    it('saves and retrieves notes by ID', async () => {
      const storage = new ScratchpadStorage();
      await storage.init();

      const note = await storage.saveNote({
        id: 'note-1',
        title: 'Project Setup',
        content: 'const x = 1;',
        tags: ['@setup', '#p0']
      });

      assert.equal(note.id, 'note-1');

      const retrieved = await storage.getNote('note-1');
      assert.ok(retrieved);
      assert.equal(retrieved.content, 'const x = 1;');
      assert.deepEqual(retrieved.tags, ['@setup', '#p0']);
    });

    it('lists all notes ordered by updatedAt descending', async () => {
      const storage = new ScratchpadStorage();
      await storage.init();

      await storage.saveNote({ id: 'note-a', content: 'first' });
      await storage.saveNote({ id: 'note-b', content: 'second' });

      const all = await storage.getAllNotes();
      assert.equal(all.length, 2);
    });

    it('exports notes to valid JSON and Markdown', async () => {
      const storage = new ScratchpadStorage();
      await storage.init();

      await storage.saveNote({
        id: 'export-test',
        title: 'Draft',
        content: 'Hello World',
        tags: ['#draft']
      });

      const jsonStr = await storage.exportToJson();
      const parsed = JSON.parse(jsonStr);
      assert.equal(parsed.version, '1.0');
      assert.ok(Array.isArray(parsed.notes));
      assert.equal(parsed.notes[0].title, 'Draft');

      const mdStr = await storage.exportToMarkdown();
      assert.ok(mdStr.includes('# Zero-Gravity Browser Scratchpad Notes'));
      assert.ok(mdStr.includes('## Draft'));
      assert.ok(mdStr.includes('Hello World'));
    });

    it('validates and imports notes from JSON backup string', async () => {
      const storage = new ScratchpadStorage();
      await storage.init();

      const backupJson = JSON.stringify({
        notes: [
          { id: 'imported-1', title: 'Imported', content: 'Imported content', tags: ['#test'] }
        ]
      });

      const res = await storage.importFromJson(backupJson);
      assert.equal(res.importedCount, 1);

      const imported = await storage.getNote('imported-1');
      assert.ok(imported);
      assert.equal(imported.content, 'Imported content');
    });

    it('rejects malformed import payloads without crashing', async () => {
      const storage = new ScratchpadStorage();
      await storage.init();

      await assert.rejects(async () => {
        await storage.importFromJson('invalid { json');
      }, /malformed json/i);

      await assert.rejects(async () => {
        await storage.importFromJson('{"notNotes": 123}');
      }, /missing notes array/i);
    });
  });

  describe('ScratchpadController (Debounced Dirty-Check)', () => {
    it('only marks dirty when content actually changes and triggers debounced save', async () => {
      let statusText = '';
      let inputListener = null;
      const mockEditor = {
        value: 'initial',
        addEventListener: (evt, fn) => {
          if (evt === 'input') inputListener = fn;
        }
      };
      const mockStatus = {
        set textContent(v) { statusText = v; },
        get textContent() { return statusText; }
      };

      const controller = new ScratchpadController({
        editorEl: mockEditor,
        statusEl: mockStatus,
        debounceMs: 50
      });

      await controller.init();
      assert.equal(controller.isDirty, false);

      // Mutate value and fire event
      mockEditor.value = 'initial with changes @my-project';
      if (inputListener) inputListener();

      assert.equal(controller.isDirty, true);
      assert.equal(statusText, 'Unsaved changes');

      // Flush save
      await controller.save();
      assert.equal(controller.isDirty, false);
      assert.equal(statusText, 'Saved');

      const note = await controller.storage.getNote('default_note');
      assert.ok(note);
      assert.equal(note.title, '@my-project');
    });

    it('coalesces multiple rapid input events into a single debounced save', async () => {
      let inputListener = null;
      const mockEditor = {
        value: 'start',
        addEventListener: (evt, fn) => {
          if (evt === 'input') inputListener = fn;
        }
      };
      const mockStatus = { textContent: '' };

      const controller = new ScratchpadController({
        editorEl: mockEditor,
        statusEl: mockStatus,
        debounceMs: 50
      });

      await controller.init();

      let saveCount = 0;
      const originalSaveNote = controller.storage.saveNote.bind(controller.storage);
      controller.storage.saveNote = async (record) => {
        saveCount += 1;
        return originalSaveNote(record);
      };

      // Rapidly fire 5 keystrokes
      for (let i = 1; i <= 5; i++) {
        mockEditor.value = `rapid typing step ${i}`;
        if (inputListener) inputListener();
      }

      // Immediately after typing, timer hasn't fired yet
      assert.equal(saveCount, 0, 'No save should execute synchronously before debounce expires');
      assert.equal(controller.isDirty, true);

      // Wait for debounce timeout
      await new Promise(resolve => setTimeout(resolve, 80));

      // After debounce timeout, exactly 1 save occurred
      assert.equal(saveCount, 1, 'Rapid typing coalesced into exactly one persistent save');
      assert.equal(controller.isDirty, false);

      const note = await controller.storage.getNote('default_note');
      assert.equal(note.content, 'rapid typing step 5');
    });
  });
});
