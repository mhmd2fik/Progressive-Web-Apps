const DB_NAME = 'NotePadDB';
const DB_VERSION = 2; // NEW VERSION
const NOTE_STORE = 'notes';

let db;
let currentNoteId = null;

// Get all necessary elements
const notesList = document.getElementById('notesList');
const noteSearch = document.getElementById('noteSearch');
const newNoteBtn = document.getElementById('newNoteBtn');
const saveBtn = document.getElementById('saveBtn'); 
const deleteBtn = document.getElementById('deleteBtn');
const noteTitleInput = document.getElementById('noteTitle');
const noteContentInput = document.getElementById('noteContent');
const editorForm = document.getElementById('editorForm'); 
const editorContent = document.getElementById('editorContent');
const syncStatus = document.getElementById('syncStatus');
const installBtn = document.getElementById('installBtn');
const charCountSpan = document.getElementById('charCount');
const lastSavedSpan = document.getElementById('lastSaved');
const syncBtn = document.getElementById('syncBtn');

// --- IndexedDB Setup ---

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // The object store configuration remains the same, but the version is higher.
            if (!db.objectStoreNames.contains(NOTE_STORE)) {
                const store = db.createObjectStore(NOTE_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('synced_status', 'synced', { unique: false });
            }
        };
    });
}

// --- Data Synchronization Logic ---

function updateConnectionStatus() {
    const isOnline = navigator.onLine;
    syncStatus.querySelector('.status-text').textContent = isOnline ? 'Online' : 'Offline Mode';
    const dot = syncStatus.querySelector('.status-dot');
    dot.className = isOnline ? 'status-dot online' : 'status-dot offline';
    
    if (isOnline) {
        if ('sync' in navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(reg => {
                reg.sync.register('sync-pending-notes')
                    .then(() => console.log('Auto-Sync registered on reconnect.'))
                    .catch(err => console.warn('Auto-Sync failed (may not be needed):', err));
            });
        }
        syncPendingNotes(); 
    }
}

async function syncPendingNotes() {
    if (!navigator.onLine) {
        showNotification('Cannot sync: Currently offline.', 'warning');
        return;
    }
    
    if (!db) await openDatabase();
    const transaction = db.transaction([NOTE_STORE], 'readwrite');
    const store = transaction.objectStore(NOTE_STORE);
    const index = store.index('synced_status');
    
    // CRITICAL FIX: Query for the number 0 (Unsynced), not the boolean false
    const request = index.getAll(IDBKeyRange.only(0)); 

    request.onsuccess = (event) => {
        const unsyncedNotes = event.target.result;
        if (unsyncedNotes.length === 0) {
            showNotification('Sync complete. All notes are up-to-date.', 'success');
            return;
        }

        showNotification(`Syncing ${unsyncedNotes.length} pending notes...`, 'info');
        
        simulateServerSync(unsyncedNotes)
            .then(syncedNotes => {
                const updateTx = db.transaction([NOTE_STORE], 'readwrite');
                const updateStore = updateTx.objectStore(NOTE_STORE);
                
                syncedNotes.forEach(note => {
                    // Update sync status to 1 (Synced)
                    note.synced = 1; 
                    updateStore.put(note);
                });
                
                updateTx.oncomplete = () => {
                    console.log('IndexedDB sync flags updated.');
                    loadNotes();
                    showNotification('Synchronization successful!', 'success');
                };
            })
            .catch(error => {
                console.error('Server sync simulation failed:', error);
                showNotification('Synchronization failed. Check connection.', 'danger');
            });
    };
    request.onerror = () => showNotification('Error reading local sync data.', 'danger');
}

function simulateServerSync(notes) {
    console.log('SIMULATING SERVER API CALL:', notes);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() > 0.1) {
                resolve(notes); 
            } else {
                reject(new Error("Simulated API failure")); 
            }
        }, 1500);
    });
}

// --- Note CRUD Operations (Local First) ---

async function saveNoteToDB(title, content) {
    if (!db) await openDatabase();
    
    const baseNote = {
        title: title || 'Untitled Note',
        content: content, 
        timestamp: new Date().getTime(),
        // CRITICAL FIX: Use 0 (Unsynced) instead of false
        synced: 0 
    };

    let noteToSave;

    if (currentNoteId) {
        noteToSave = { ...baseNote, id: currentNoteId };
    } else {
        noteToSave = baseNote; 
    }
    
    const transaction = db.transaction([NOTE_STORE], 'readwrite');
    const store = transaction.objectStore(NOTE_STORE);
    
    if (currentNoteId) {
        store.put(noteToSave); 
    } else {
        const request = store.add(noteToSave);
        request.onsuccess = (e) => {
            currentNoteId = e.target.result;
            noteToSave.id = currentNoteId; 
            displayNoteInEditor(noteToSave); 
        };
    }
    
    transaction.oncomplete = () => {
        console.log("Note saved locally.");
        loadNotes(); 
        lastSavedSpan.textContent = `Last saved: ${new Date().toLocaleTimeString()}`;
        showNotification('Note saved locally.', 'info');
        
        if (navigator.onLine) {
            syncPendingNotes();
        }
    };
    transaction.onerror = (e) => console.error('Error saving note:', e);
}

// --- UI Management (Minor adjustment for sync marker logic) ---

async function loadNotes() {
    if (!db) await openDatabase();
    
    const transaction = db.transaction([NOTE_STORE], 'readonly');
    const store = transaction.objectStore(NOTE_STORE);
    const request = store.getAll();

    request.onsuccess = (event) => {
        const notes = event.target.result.reverse();
        renderNotesList(notes);
    };
}

function renderNotesList(notes) {
    notesList.innerHTML = '';
    
    if (notes.length === 0) {
        notesList.innerHTML = `<div class="empty-state"><p>No notes yet.</p><p>Click '+ New Note' to start writing!</p></div>`;
        document.getElementById('cachedCount').textContent = '0 notes';
        return;
    }

    notes.forEach(note => {
        const listItem = document.createElement('div');
        listItem.className = 'note-item';
        if (note.id === currentNoteId) {
            listItem.classList.add('active');
        }
        
        // CRITICAL FIX: Check if synced status is 0 (Unsynced)
        const syncMarker = note.synced === 0 ? '<span style="color:#dc3545; font-size: 0.9em; margin-left: 5px;" title="Unsynced changes">!</span>' : '';
        
        listItem.innerHTML = `
            <div class="note-title">${note.title}${syncMarker}</div>
            <div class="note-date">${new Date(note.timestamp).toLocaleDateString()}</div>
        `;
        listItem.dataset.id = note.id;
        listItem.addEventListener('click', () => {
            displayNoteInEditor(note);
            document.querySelectorAll('.note-item').forEach(item => item.classList.remove('active'));
            listItem.classList.add('active');
        });
        notesList.appendChild(listItem);
    });
    document.getElementById('cachedCount').textContent = `${notes.length} notes`;
}

function displayNoteInEditor(note) {
    editorContent.style.display = 'none';
    editorForm.style.display = 'flex';
    
    currentNoteId = note.id;
    noteTitleInput.value = note.title;
    noteContentInput.value = note.content;
    
    noteContentInput.dispatchEvent(new Event('input')); 
    lastSavedSpan.textContent = `Saved locally: ${new Date(note.timestamp).toLocaleTimeString()}`;
    deleteBtn.style.display = 'inline-block';
    
    document.querySelectorAll('.note-item').forEach(item => item.classList.remove('active'));
    const activeItem = document.querySelector(`.note-item[data-id="${note.id}"]`);
    if (activeItem) activeItem.classList.add('active');
}

function createNewNote() {
    currentNoteId = null;
    noteTitleInput.value = '';
    noteContentInput.value = '';
    
    editorContent.style.display = 'none';
    editorForm.style.display = 'flex';
    
    noteContentInput.dispatchEvent(new Event('input')); 
    lastSavedSpan.textContent = 'Not yet saved';
    deleteBtn.style.display = 'none'; 
    noteTitleInput.focus();
    
    document.querySelectorAll('.note-item').forEach(item => item.classList.remove('active'));
}

async function deleteNote() {
    if (!currentNoteId || !confirm('Are you sure you want to delete this note?')) return;
    
    if (!db) await openDatabase();
    const transaction = db.transaction([NOTE_STORE], 'readwrite');
    const store = transaction.objectStore(NOTE_STORE);
    store.delete(currentNoteId);
    
    transaction.oncomplete = () => {
        showNotification('Note deleted locally.', 'danger');
        createNewNote();
        loadNotes();
    };
}

// --- Interface Enhancements (Non-PWA Core Features) ---

function showNotification(message, type) {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.className = `notification show ${type}`;
    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}

function updateCharCount() {
    charCountSpan.textContent = `${noteContentInput.value.length} characters`;
}

// --- PWA Install Prompt ---

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
});

installBtn.addEventListener('click', () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                installBtn.style.display = 'none';
            }
            deferredPrompt = null;
        });
    }
});

// --- Initialization ---

window.addEventListener('load', async () => {
    await openDatabase();
    loadNotes();
    updateConnectionStatus();

    // Event Listeners
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    
    newNoteBtn.addEventListener('click', createNewNote);
    deleteBtn.addEventListener('click', deleteNote);
    noteContentInput.addEventListener('input', updateCharCount);
    syncBtn.addEventListener('click', syncPendingNotes);

    // Form Submission Listener
    editorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveNoteToDB(noteTitleInput.value, noteContentInput.value);
    });
    
    // Service Worker message handler for sync
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SYNC_TRIGGERED') {
            syncPendingNotes();
        }
    });
    
    createNewNote(); 
});