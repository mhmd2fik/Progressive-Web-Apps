Mahmoud mohamed /20226097
Mohamed ahmed farag/20226151
Mohamed tawfik/20226087
Abdelrahman amer/20226056
Alhassan tamem/20226132


NotePad PWA: Offline-First Note Taking App
Project DescriptionThe **NotePad PWA** is a modern, responsive, and highly reliable note-taking application designed to showcase the power of Progressive Web App (PWA) technologies. Built with vanilla HTML, CSS, and JavaScript, this project features a **Cache-First** strategy using Service Workers to guarantee availability and functionality, even under unreliable or nonexistent network conditions.

The application uses a clean, two-panel interface with a vibrant green (`#259d84`) and white theme for a user-friendly and modern experience.

Key Features* **Offline-First Reliability:** Utilizes a Service Worker to cache the entire application shell (`index.html`, `styles.css`, `app.js`) upon first load, ensuring instant loading on subsequent visits, regardless of network status.
* **Persistent Local Storage:** All notes are saved immediately to the client-side database (**IndexedDB**), providing robust, persistent data storage that survives page reloads and browser restarts.
* **Automatic Sync Simulation:** Implements a mechanism to track pending changes (`synced: 0`) and simulates background synchronization with a server endpoint whenever the connection is restored (`online` event or manual sync).
* **Modern Two-Panel UI:** Features a dedicated notes list sidebar and a spacious editing panel, optimized for both desktop and mobile use.
* **PWA Installability:** Includes a complete `manifest.json` allowing users to install the application directly to their device's home screen or desktop.

Technologies Used* **HTML5:** Semantic and modern application structure.
* **CSS3:** Flexbox/Grid for layout, custom properties for the modern color palette.
* **Vanilla JavaScript (ES6+):** For application logic, DOM manipulation, and PWA APIs.
* **Service Worker API:** Core offline capabilities (App Shell Caching, Fetch interception).
* **IndexedDB API:** Persistent, transactional storage for note data.
* **Node.js/Express:** Simple local server for development and testing (required for Service Worker functionality).

##🛠️ Installation and SetupTo run this PWA locally, you need a simple web server because Service Workers only function over `localhost` or HTTPS.

###Prerequisites1. [Node.js](https://nodejs.org/) and npm installed.

###Steps to Run1. **Clone the Repository (or create the files):**
Ensure you have the following files in your root directory:
* `index.html`
* `styles.css`
* `app.js`
* `sw.js`
* `manifest.json`
* `server.js` (The Node.js server file provided previously)


2. **Install Dependencies:**
Open your terminal in the project directory and install Express:
```bash
npm install express

```


3. **Start the Server:**
Run the simple server script:
```bash
node server.js

```


The server will start at `http://localhost:8080`.
4. **Access the App:**
Open your web browser (preferably Chrome or Edge) and navigate to:
`http://localhost:8080/`

Testing the PWA CapabilitiesUse the Developer Tools (F12) in your browser to test the core offline and data synchronization features:

1. **Test App Shell Caching:**
* Go to the **Network** tab and select **"Disable cache."**
* Perform a hard refresh (Ctrl+Shift+R).
* In the **Network** tab, check the **Service Workers** section to see which files are served from the cache.


2. **Test Data Persistence (IndexedDB):**
* Go to the **Application** tab \rightarrow **IndexedDB**. You should see the `NotePadDB` database.
* Create several notes while online. Verify they appear in the database.


3. **Test Offline Saving & Sync:**
* Go to the **Network** tab and check the **"Offline"** box.
* Create a new note. The app will confirm it's "Saved locally."
* Uncheck the **"Offline"** box. The app will automatically trigger the `syncPendingNotes` function and show a notification for successful synchronization.
