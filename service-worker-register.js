// Service Worker Registration and Management

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('service-worker.js', {
                scope: '/'
            });
            
            console.log('Service Worker registered:', registration);
            document.getElementById('swStatus').textContent = 'Active';
            
            // Check for updates periodically
            setInterval(() => {
                registration.update();
            }, 60000);

            // Listen for service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated') {
                        console.log('Service Worker updated');
                        showUpdateNotification();
                    }
                });
            });

        } catch (error) {
            console.error('Service Worker registration failed:', error);
            document.getElementById('swStatus').textContent = 'Failed';
        }
    });

    // Handle service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'CACHE_UPDATE') {
            console.log('Cache updated:', event.data.payload);
        }
    });
}

function showUpdateNotification() {
    const notification = document.getElementById('notification');
    notification.textContent = 'App updated! Refresh to see changes.';
    notification.className = 'notification show success';
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Unregister service worker if needed (for development)
window.unregisterServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
        console.log('Service Worker unregistered');
    }
};
