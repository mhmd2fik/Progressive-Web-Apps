// Offline-First PWA Note Taking App
// Advanced Caching and Service Worker Implementation

class NoteApp {
    constructor() {
        this.db = null;
        this.notes = [];
        this.currentNoteId = null;
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        
        this.init();
    }

    async init() {
        await this.initIndexedDB();
        this.loadNotes();
        this.setupEventListeners();
        this.setupNetworkListeners();
        this.updateNetworkStatus();
        this.updateStorageInfo();
        
        // Auto-sync when online
        setInterval(() => this.autoSync(), 30000);
    }

    // ============== IndexedDB Management ==============
    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('NotePadDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Notes object store
                if (!db.objectStoreNames.contains('notes')) {
                    const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
                    noteStore.createIndex('title', 'title', { unique: false });
                    noteStore.createIndex('timestamp', 'timestamp', { unique: false });
                    noteStore.createIndex('synced', 'synced', { unique: false });
                }

                // Sync queue store
                if (!db.objectStoreNames.contains('syncQueue')) {
                    db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // ============== CRUD Operations ==============
    async loadNotes() {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.getAll();

            request.onsuccess = () => {
                this.notes = request.result.sort((a, b) => b.timestamp - a.timestamp);
                this.renderNotesList();
                this.updateCachedCount();
                resolve();
            };
        });
    }

    async saveNote(title, content) {
        const note = {
            id: this.currentNoteId || this.generateId(),
            title: title || 'Untitled',
            content: content,
            timestamp: Date.now(),
            synced: false,
            lastModified: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.put(note);

            request.onsuccess = () => {
                this.currentNoteId = note.id;
                
                // Add to sync queue if online
                if (this.isOnline) {
                    this.queueSync(note);
                }
                
                this.loadNotes().then(() => {
                    this.renderNotesList();
                    this.showNotification('Note saved successfully!', 'success');
                    resolve(note);
                });
            };

            request.onerror = () => reject(request.error);
        });
    }

    async deleteNote(noteId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.delete(noteId);

            request.onsuccess = () => {
                if (this.currentNoteId === noteId) {
                    this.currentNoteId = null;
                    this.showEditor(false);
                }
                
                this.loadNotes().then(() => {
                    this.renderNotesList();
                    this.showNotification('Note deleted', 'success');
                    resolve();
                });
            };

            request.onerror = () => reject(request.error);
        });
    }

    // ============== Sync Management ==============
    async queueSync(note) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.add({
                action: 'save',
                note: note,
                timestamp: Date.now()
            });

            request.onsuccess = resolve;
        });
    }

    async autoSync() {
        if (!this.isOnline) return;
        
        const transaction = this.db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const request = store.getAll();

        request.onsuccess = () => {
            const queue = request.result;
            if (queue.length > 0) {
                this.syncWithServer(queue);
            }
        };
    }

    async syncWithServer(queue) {
        try {
            for (const item of queue) {
                const response = await fetch('http://localhost:3000/api/notes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(item.note)
                });

                if (response.ok) {
                    // Mark as synced
                    const transaction = this.db.transaction(['notes'], 'readwrite');
                    const store = transaction.objectStore('notes');
                    const note = item.note;
                    note.synced = true;
                    store.put(note);

                    // Remove from sync queue
                    const queueTransaction = this.db.transaction(['syncQueue'], 'readwrite');
                    const queueStore = queueTransaction.objectStore('syncQueue');
                    queueStore.delete(item.id);
                }
            }
            this.loadNotes();
            this.showNotification('Synced with server', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.showNotification('Failed to sync with server', 'warning');
        }
    }

    // ============== UI Event Handlers ==============
    setupEventListeners() {
        // New note
        document.getElementById('newNoteBtn').addEventListener('click', () => this.newNote());

        // Save note
        document.getElementById('saveBtn').addEventListener('click', () => this.handleSaveNote());

        // Delete note
        document.getElementById('deleteBtn').addEventListener('click', () => this.handleDeleteNote());

        // Cancel editing
        document.getElementById('cancelBtn').addEventListener('click', () => this.showEditor(false));

        // Sync button
        document.getElementById('syncBtn').addEventListener('click', () => this.handleManualSync());

        // Install button
        if (document.getElementById('installBtn')) {
            document.getElementById('installBtn').addEventListener('click', () => this.installApp());
        }

        // Character count
        document.getElementById('noteContent').addEventListener('input', (e) => {
            document.getElementById('charCount').textContent = `${e.target.value.length} characters`;
            this.updateLastSaved();
        });

        // PWA install event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            document.getElementById('installBtn').style.display = 'flex';
        });
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateNetworkStatus();
            this.showNotification('Back online!', 'success');
            this.autoSync();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateNetworkStatus();
            this.showNotification('You are offline - changes will sync when online', 'warning');
        });
    }

    newNote() {
        this.currentNoteId = null;
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        document.getElementById('charCount').textContent = '0 characters';
        document.getElementById('lastSaved').textContent = 'Not saved';
        document.getElementById('deleteBtn').style.display = 'none';
        this.showEditor(true);
        document.getElementById('noteTitle').focus();
    }

    async loadNoteForEditing(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        this.currentNoteId = noteId;
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteContent').value = note.content;
        document.getElementById('charCount').textContent = `${note.content.length} characters`;
        document.getElementById('lastSaved').textContent = new Date(note.timestamp).toLocaleString();
        document.getElementById('deleteBtn').style.display = 'flex';
        
        this.showEditor(true);
        document.getElementById('noteContent').focus();
    }

    handleSaveNote() {
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value;

        if (!title && !content) {
            this.showNotification('Please add a title or content', 'warning');
            return;
        }

        this.saveNote(title, content);
        this.showEditor(false);
    }

    handleDeleteNote() {
        if (confirm('Are you sure you want to delete this note?')) {
            this.deleteNote(this.currentNoteId);
        }
    }

    handleManualSync() {
        if (!this.isOnline) {
            this.showNotification('You are offline', 'warning');
            return;
        }
        this.autoSync();
    }

    installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    this.showNotification('App installed successfully!', 'success');
                }
                this.deferredPrompt = null;
            });
        }
    }

    showEditor(show) {
        const editorForm = document.getElementById('editorForm');
        const editorContent = document.getElementById('editorContent');
        
        if (show) {
            editorForm.style.display = 'flex';
            editorContent.style.display = 'none';
        } else {
            editorForm.style.display = 'none';
            editorContent.style.display = 'flex';
        }
    }

    // ============== UI Rendering ==============
    renderNotesList() {
        const notesList = document.getElementById('notesList');
        
        if (this.notes.length === 0) {
            notesList.innerHTML = '<div class="empty-state">No notes yet. Create one!</div>';
            return;
        }

        notesList.innerHTML = this.notes.map(note => `
            <div class="note-item ${this.currentNoteId === note.id ? 'active' : ''}" 
                 data-id="${note.id}" 
                 onclick="app.loadNoteForEditing('${note.id}')">
                <strong>${this.escapeHtml(note.title)}</strong>
                <div class="note-item-meta">
                    ${note.synced ? '✓' : '⏱'} ${new Date(note.timestamp).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    }

    updateNetworkStatus() {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (this.isOnline) {
            statusDot.classList.remove('offline');
            statusDot.classList.add('online');
            statusText.textContent = 'Online';
            document.getElementById('syncBtn').disabled = false;
        } else {
            statusDot.classList.remove('online');
            statusDot.classList.add('offline');
            statusText.textContent = 'Offline';
            document.getElementById('syncBtn').disabled = true;
        }
    }

    updateLastSaved() {
        document.getElementById('lastSaved').textContent = 'Unsaved changes';
    }

    updateCachedCount() {
        document.getElementById('cachedCount').textContent = this.notes.length;
    }

    async updateStorageInfo() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const usage = Math.round(estimate.usage / 1024);
            const quota = Math.round(estimate.quota / 1024 / 1024);
            document.getElementById('storageUsage').textContent = `${usage} KB`;
            document.getElementById('storageMax').textContent = `${quota} MB`;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // ============== Utility Methods ==============
    generateId() {
        return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Initialize app
const app = new NoteApp();
