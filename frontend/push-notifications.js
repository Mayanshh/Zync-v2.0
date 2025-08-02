// Global function to show critical warning (for testing or admin use)
window.showCriticalWarning = function(message) {
  const warning = {
    id: 'warning_' + Date.now(),
    message: message || 'This is a critical warning from the Zync moderation team.',
    timestamp: new Date().toISOString()
  };
  showWarningDetails(warning);
};


// Push Notifications Manager for Zync
(function() {
  'use strict';

  // Create global namespace
  window.ZyncNotifications = {
    notificationSystemInitialized: false,
    csrfToken: null,
    serviceWorkerRegistration: null,
    NOTIFICATION_POLLING_INTERVAL: 15000,
    shownNotifications: new Set(),
    currentSubscription: null,
    notificationSystemStarted: false,
    notificationPollingSetup: false,
    acknowledgedWarnings: new Set(),
    deliveredWarnings: new Set(),
    processedNotifications: new Set(),
    activeWarningModals: new Set(),
    globalWarningTracker: new Set()
  };

  // Check if we're in a secure context
  function isSecureContext() {
    return window.isSecureContext || location.protocol === 'https:';
  }

  // Check if notifications are supported
  function areNotificationsSupported() {
    const hasNotificationAPI = 'Notification' in window;
    const hasSecureContext = isSecureContext();

    return hasNotificationAPI && hasSecureContext;
  }

  // Check if push notifications are supported
  function arePushNotificationsSupported() {
    return 'PushManager' in window && 'serviceWorker' in navigator && areNotificationsSupported();
  }

  // Fetch CSRF token
  async function fetchCsrfToken() {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }

      const data = await response.json();
      window.ZyncNotifications.csrfToken = data.csrfToken;
      return data.csrfToken;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      throw error;
    }
  }

  // Setup polling for notifications (fallback)
  function setupNotificationPolling() {
    if (window.ZyncNotifications.notificationPollingSetup) {
      return;
    }
    window.ZyncNotifications.notificationPollingSetup = true;

    console.log('Setting up notification polling as fallback');

    // Poll for notifications
    const pollingInterval = setInterval(async () => {
      if (!localStorage.getItem('userId')) return;

      try {
        const response = await fetch('/api/pending-notifications', {
          credentials: 'same-origin'
        });

        if (response.ok) {
          const notifications = await response.json();
          // Enhanced filtering with comprehensive deduplication
          const newNotifications = notifications.filter(notification => {
            if (notification.type === 'warning') {
              // Extract and normalize warning ID comprehensively
              let warningId = notification.id ||
                notification.data?.warningId ||
                notification.data?._id;

              if (!warningId) {
                console.warn('Warning notification missing ID, skipping:', notification);
                return false;
              }

              // Comprehensive ID normalization - handle all possible formats
              const originalWarningId = warningId;
              if (typeof warningId === 'string') {
                warningId = warningId.replace(/^(stored_|warning_)/, '');
              }

              // Create all possible ID variations for comprehensive checking
              const idVariations = [
                warningId,
                `warning_${warningId}`,
                `stored_${warningId}`,
                originalWarningId
              ];

              // Check against all tracking systems with all ID variations
              const isAlreadyProcessed = idVariations.some(id =>
                window.ZyncNotifications.globalWarningTracker.has(id) ||
                window.ZyncNotifications.acknowledgedWarnings.has(id) ||
                window.ZyncNotifications.deliveredWarnings.has(id) ||
                window.ZyncNotifications.activeWarningModals.has(id) ||
                window.ZyncNotifications.processedNotifications.has(id) ||
                window.ZyncNotifications.processedNotifications.has(`warning_${id}`)
              );

              if (isAlreadyProcessed) {
                return false;
              }

              // Check if warning was already delivered via socket
              if (notification.id.startsWith('stored_')) {
                // This is a stored notification from polling
                // Check if the same warning was already delivered via socket
                const baseWarningId = warningId;
                const socketDelivered = window.ZyncNotifications.socketDeliveredWarnings?.has(baseWarningId);

                if (socketDelivered) {
                  // Mark as processed but don't display
                  idVariations.forEach(id => {
                    window.ZyncNotifications.globalWarningTracker.add(id);
                    window.ZyncNotifications.processedNotifications.add(id);
                  });
                  return false;
                }
              }

              // Add ALL variations to prevent any future duplicates
              idVariations.forEach(id => {
                window.ZyncNotifications.globalWarningTracker.add(id);
                window.ZyncNotifications.processedNotifications.add(id);
              });

              return true;
            } else {
              // Handle non-warning notifications
              const notificationKey = `${notification.type}_${notification.id}`;
              if (window.ZyncNotifications.processedNotifications.has(notificationKey)) {
                return false;
              }
              window.ZyncNotifications.processedNotifications.add(notificationKey);
              return true;
            }
          });

          if (newNotifications.length > 0) {
            newNotifications.forEach(notification => {
              if (notification.type === 'warning') {
                // Normalize warning for consistent display
                let warningId = notification.id || notification.data?.warningId || notification.data?._id;
                if (typeof warningId === 'string') {
                  warningId = warningId.replace(/^(stored_|warning_)/, '');
                }

                // Mark in all tracking systems
                window.ZyncNotifications.deliveredWarnings.add(warningId);
                window.ZyncNotifications.processedNotifications.add(`warning_${warningId}`);

                // Normalize warning data structure for consistent display
                const normalizedWarning = {
                  id: warningId,
                  message: notification.message,
                  timestamp: notification.data?.timestamp || notification.createdAt,
                  type: 'warning',
                  data: {
                    type: 'warning',
                    warningId: warningId,
                    timestamp: notification.data?.timestamp || notification.createdAt
                  }
                };

                showWarningDetails(normalizedWarning);
              } else {
                // Handle non-warning notifications
                const notificationKey = `${notification.type}_${notification.id}`;
                window.ZyncNotifications.processedNotifications.add(notificationKey);
                showNotification(notification);
              }
            });

            // Mark non-warning notifications as read on server
            const nonWarningNotifications = newNotifications.filter(n => n.type !== 'warning');
            if (nonWarningNotifications.length > 0) {
              fetch('/api/mark-notifications-read', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'CSRF-Token': window.ZyncNotifications.csrfToken
                },
                credentials: 'same-origin',
              }).catch(err => console.warn('Failed to mark notifications as read:', err));
            }
          }

          // Clean up tracking sets periodically to prevent memory bloat
          if (window.ZyncNotifications.globalWarningTracker.size > 200) {
            const trackerArray = Array.from(window.ZyncNotifications.globalWarningTracker);
            const keepTracking = trackerArray.slice(-100); // Keep last 100
            window.ZyncNotifications.globalWarningTracker = new Set(keepTracking);
          }
        }
      } catch (error) {
        console.warn('Notification polling failed:', error);
      }
    }, window.ZyncNotifications.NOTIFICATION_POLLING_INTERVAL);

    window.addEventListener('beforeunload', () => {
      clearInterval(pollingInterval);
    });
  }

  // Show browser notification
  function showBrowserNotification(title, message, icon = '/icons/icon-192x192.png') {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: icon,
          tag: 'zync-notification'
        });
      } catch (error) {
        console.warn('Failed to show notification:', error);
      }
    }
  }

  // Register service worker
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      window.ZyncNotifications.serviceWorkerRegistration = registration;

      await navigator.serviceWorker.ready;

      if (arePushNotificationsSupported()) {
        await setupPushSubscription(registration);
      }

      console.log('Service Worker registered successfully');
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      setupNotificationPolling();
      return false;
    }
  }

  // Setup push subscription
  async function setupPushSubscription(registration) {
    try {
      // Get VAPID public key
      const keyResponse = await fetch('/api/push-key');
      if (!keyResponse.ok) {
        throw new Error('Failed to get push key');
      }

      const { publicKey } = await keyResponse.json();

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to server
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': window.ZyncNotifications.csrfToken
        },
        credentials: 'same-origin',
        body: JSON.stringify({ subscription })
      });

      console.log('Push subscription successful');
    } catch (error) {
      console.error('Push subscription failed:', error);
      setupNotificationPolling();
    }
  }

  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function showNotification(notification) {
    // Check if this is a warning notification and route to critical modal
    if (notification.data && notification.data.type === 'warning') {
      showWarningDetails(notification);
      return;
    }

    if (areNotificationsSupported() && Notification.permission === 'granted') {
      try {
        if (notification.data && notification.data.fromUserId) {
          fetch(`/api/user/${notification.data.fromUserId}`)
            .then(response => {
              if (!response.ok) throw new Error('Failed to fetch user data');
              return response.json();
            })
            .then(userData => {
              if (userData.isAnonymous) {
                displayNativeNotification(notification, null);
              } else {
                displayNativeNotification(notification, userData.profilePicture);
              }
            })
            .catch(error => {
              console.error('Error fetching user data for notification:', error);
              displayNativeNotification(notification);
            });
        } else {
          displayNativeNotification(notification);
        }
      } catch (error) {
        console.error('Error showing native notification:', error);
        showVisualNotification(notification);
      }
    } else {
      showVisualNotification(notification);
    }
  }

  function displayNativeNotification(notification, profilePicture = null) {
    const notif = new Notification(`Zync: ${notification.title}`, {
      body: notification.message,
      icon: profilePicture || '/favicon.ico',
      badge: '/favicon.ico',
      image: profilePicture,
      tag: notification.id,
      requireInteraction: true,
      data: notification.data
    });

    notif.onclick = function() {
      window.focus();
      handleNotificationClick(notification);
      this.close();
    };

    playNotificationSound();
  }

  function showVisualNotification(notification) {
    const notificationEl = document.createElement('div');
    notificationEl.className = `in-app-notification ${notification.type || 'default'}`;

    if (notification.data && notification.data.fromUserId) {
      fetch(`/api/user/${notification.data.fromUserId}`)
        .then(response => response.json())
        .then(userData => {
          if (userData.isAnonymous) {
            createNotificationContent(notificationEl, 'Anonymous User', notification.message, '');
          } else {
            createNotificationContent(notificationEl, notification.title, notification.message, userData.profilePicture || '/favicon.ico');
          }
        })
        .catch(error => {
          console.error('Error fetching user data for notification:', error);
          createNotificationContent(notificationEl, notification.title, notification.message, '/favicon.ico');
        });
    } else {
      createNotificationContent(notificationEl, notification.title, notification.message, '/favicon.ico');
    }

    playNotificationSound();
  }

  function createNotificationContent(notificationEl, title, message, profilePicture) {
    notificationEl.innerHTML = `
      <div class="notification-header">
        <div class="notification-profile-container">
          ${profilePicture ?
            `<img src="${profilePicture}" alt="Profile Picture" class="notification-image">` :
            `<i class="fas fa-mask"></i>`}
        </div>
        <div class="notification-title-container">
          <strong class="notification-title">${title}</strong>
        </div>
        <button class="notification-close">&times;</button>
      </div>
      <div class="notification-body">${message}</div>
      <div class="notification-progress"></div>
    `;

    styleNotification(notificationEl);
    document.body.appendChild(notificationEl);

    setTimeout(() => {
      notificationEl.style.display = 'block';
      notificationEl.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      notificationEl.style.transform = 'translateY(0)';
      notificationEl.style.opacity = '1';

      const progressBar = notificationEl.querySelector('.notification-progress div');
      if (progressBar) {
        progressBar.style.transition = 'transform 5s linear';
        progressBar.style.transform = 'translateX(0%)';
      }
    }, 100);

    const closeBtn = notificationEl.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dismissNotification(notificationEl);
      });
    }

    notificationEl.addEventListener('click', (e) => {
      if (!e.target.classList.contains('notification-close')) {
        handleNotificationClick(notificationEl.notification);
        dismissNotification(notificationEl);
      }
    });

    notificationEl.notification = {
      title, message, profilePicture,
      data: notificationEl.dataset.notificationData ?
        JSON.parse(notificationEl.dataset.notificationData) : {}
    };

    setTimeout(() => {
      if (document.body.contains(notificationEl)) {
        dismissNotification(notificationEl);
      }
    }, 5000);
  }

  function handleNotificationClick(notification) {
    if (!notification || !notification.data) return;

    const data = notification.data;

    if (data.type === 'message' && data.fromUserId) {
      if (typeof window.openChat === 'function') {
        window.openChat(data.fromUserId);
      }
    } else if (data.type === 'request' && data.requestId && data.fromUserId) {
      if (typeof window.showConnectionRequestModal === 'function') {
        window.showConnectionRequestModal(data.requestId, data.fromUserId);
      }
    } else if (data.type === 'warning') {
      if (typeof window.showWarningDetails === 'function') {
        window.showWarningDetails(notification);
      }
    }
  }

  function styleNotification(notificationEl) {
    notificationEl.style.position = 'fixed';
    notificationEl.style.bottom = '20px';
    notificationEl.style.right = '20px';
    notificationEl.style.backgroundColor = '#fff';
    notificationEl.style.color = '#333';
    notificationEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
    notificationEl.style.borderRadius = '16px';
    notificationEl.style.padding = '0';
    notificationEl.style.zIndex = '9999';
    notificationEl.style.maxWidth = '350px';
    notificationEl.style.display = 'none';
    notificationEl.style.overflow = 'hidden';
    notificationEl.style.transform = 'translateY(20px)';
    notificationEl.style.opacity = '0';
    notificationEl.style.border = 'none';

    const progress = notificationEl.querySelector('.notification-progress');
    if (progress) {
      progress.style.height = '3px';
      progress.style.width = '100%';
      progress.style.backgroundColor = '#eee';
      progress.style.position = 'relative';
      progress.style.overflow = 'hidden';

      const progressBar = document.createElement('div');
      progressBar.style.height = '100%';
      progressBar.style.width = '100%';
      progressBar.style.backgroundColor = '#6c5ce7';
      progressBar.style.position = 'absolute';
      progressBar.style.left = '0';
      progressBar.style.top = '0';
      progressBar.style.transform = 'translateX(-100%)';
      progress.appendChild(progressBar);
    }
  }

  function dismissNotification(notificationEl) {
    notificationEl.style.opacity = '0';
    notificationEl.style.transform = 'translateY(20px)';
    setTimeout(() => {
      if (document.body.contains(notificationEl)) {
        document.body.removeChild(notificationEl);
      }
    }, 300);
  }

  function playNotificationSound() {
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Could not play notification sound:', e));
    } catch (err) {
      console.log('Audio playback not supported');
    }
  }

  function playCriticalNotificationSound() {
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 0.8;
      // Play multiple times for critical alerts
      audio.play().catch(e => console.log('Could not play critical notification sound:', e));
      setTimeout(() => audio.play().catch(e => {}), 200);
      setTimeout(() => audio.play().catch(e => {}), 400);
    } catch (err) {
      console.log('Audio playback not supported');
    }
  }

  function addWarningToMessages(warning) {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) return;

    // Check if warning conversation already exists
    let warningConversation = document.querySelector('.warning-conversation');

    if (!warningConversation) {
      warningConversation = document.createElement('div');
      warningConversation.className = 'conversation-item warning-conversation';
      warningConversation.innerHTML = `
        <div class="conversation-avatar">
          <i class="fas fa-bolt"></i>
        </div>
        <div class="conversation-info">
          <div class="conversation-name">
            Zync Team
            <span class="official-badge-small">Official</span>
          </div>
          <div class="conversation-preview">Critical warning message</div>
        </div>
        <div class="conversation-meta">
          <span class="conversation-time">Now</span>
          <span class="unread-badge critical">!</span>
        </div>
      `;

      // Insert at top of conversations
      conversationsList.insertBefore(warningConversation, conversationsList.firstChild);
    }

    // Update preview text
    const preview = warningConversation.querySelector('.conversation-preview');
    if (preview) {
      preview.textContent = warning.message || 'Critical warning message';
    }
  }

  function acknowledgeWarning(warningId, button) {
    // Normalize warning ID comprehensively
    if (typeof warningId === 'string') {
      warningId = warningId.replace(/^(stored_|warning_)/, '');
    }

    // Check if already being processed
    if (button.dataset.processing === 'true') {
      return;
    }

    // Mark as processing
    button.dataset.processing = 'true';

    // Update button state
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    button.disabled = true;
    button.style.opacity = '0.7';

    // Mark as acknowledged immediately in ALL tracking systems
    window.ZyncNotifications.acknowledgedWarnings.add(warningId);
    window.ZyncNotifications.deliveredWarnings.add(warningId);
    window.ZyncNotifications.processedNotifications.add(`warning_${warningId}`);
    window.ZyncNotifications.globalWarningTracker.add(warningId);

    // Send acknowledgment to server
    fetch('/api/acknowledge-warning', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': window.ZyncNotifications.csrfToken
      },
      body: JSON.stringify({ warningId: warningId })
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      if (data.message) {

        // Success - update button
        button.innerHTML = '<i class="fas fa-check-circle"></i> Acknowledged';
        button.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
        button.style.color = 'white';
        button.style.opacity = '1';

        // Show success message briefly
        if (typeof window.showToast === 'function') {
          window.showToast('Acknowledged', 'Warning has been acknowledged successfully.');
        }

        // Close modal after brief delay
        setTimeout(() => {
          const modal = button.closest('.critical-warning-modal');
          if (modal) {
            const modalWarningId = modal.getAttribute('data-warning-id');

            // Clean up tracking completely
            if (modalWarningId) {
              // Normalize the modal warning ID too
              const normalizedModalId = modalWarningId.replace(/^(stored_|warning_)/, '');
              window.ZyncNotifications.activeWarningModals.delete(normalizedModalId);
              window.ZyncNotifications.activeWarningModals.delete(modalWarningId); // Also try original
            }

            // Remove ALL event listeners
            if (modal._eventHandlers) {
              Object.entries(modal._eventHandlers).forEach(([event, handler]) => {
                document.removeEventListener(event, handler, { capture: true });
              });
            }
            if (modal._keydownHandler) {
              document.removeEventListener('keydown', modal._keydownHandler, { capture: true });
            }

            // Animate out
            modal.style.opacity = '0';
            const content = modal.querySelector('.critical-warning-content');
            if (content) {
              content.style.transform = 'scale(0.9)';
            }

            setTimeout(() => {
              if (modal.parentNode) {
                modal.remove();
              }
            }, 300);
          }
        }, 1000);
      } else {
        throw new Error('Acknowledgment failed - no success message');
      }
    })
    .catch(error => {
      console.error('Error acknowledging warning:', error);

      // Don't remove from tracking on error - keep modal open for user to try again
      console.warn('Warning acknowledgment failed, modal will remain open for retry');

      // Update button to show error
      button.innerHTML = '<i class="fas fa-exclamation-circle"></i> Try Again';
      button.disabled = false;
      button.style.background = 'linear-gradient(135deg, #e53e3e, #c53030)';
      button.style.color = 'white';
      button.style.opacity = '1';

      // Show error message
      if (typeof window.showToast === 'function') {
        window.showToast('Error', 'Failed to acknowledge warning. Please try again.');
      }

      // Reset button after a delay
      setTimeout(() => {
        button.innerHTML = '<i class="fas fa-check"></i> I Understand & Acknowledge';
        button.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        button.style.color = 'white';
        button.disabled = false;
        button.dataset.processing = 'false';
      }, 3000);
    });
  }

  function showWarningDetails(warning) {
    // Enhanced warning ID extraction with comprehensive normalization
    let warningId = warning.id || warning.data?.warningId || warning.data?._id || warning._id;

    if (!warningId) {
      return;
    }

    // Comprehensive ID normalization - remove all known prefixes
    if (typeof warningId === 'string') {
      warningId = warningId.replace(/^(stored_|warning_)/, '');
    }

    // Check if warning is already processed in any tracking system
    const isAlreadyProcessed =
      window.ZyncNotifications.acknowledgedWarnings.has(warningId) ||
      window.ZyncNotifications.activeWarningModals.has(warningId) ||
      window.ZyncNotifications.globalWarningTracker.has(warningId);

    if (isAlreadyProcessed) {
      return;
    }

    // Mark as active in all tracking systems immediately
    window.ZyncNotifications.activeWarningModals.add(warningId);
    window.ZyncNotifications.globalWarningTracker.add(warningId);

    // Clean up any existing warning modals with comprehensive cleanup
    const existingModals = document.querySelectorAll('.critical-warning-modal');
    existingModals.forEach(modal => {
      const existingWarningId = modal.getAttribute('data-warning-id');
      if (existingWarningId) {
        const normalizedExistingId = existingWarningId.replace(/^(stored_|warning_)/, '');
        window.ZyncNotifications.activeWarningModals.delete(normalizedExistingId);
        window.ZyncNotifications.activeWarningModals.delete(existingWarningId);
      }
      if (modal._keydownHandler) {
        document.removeEventListener('keydown', modal._keydownHandler);
      }
      modal.remove();
    });

    // Get the actual warning message with fallback
    const warningMessage = warning.message ||
      (warning.data && warning.data.message) ||
      'You have received a warning from the Zync moderation team.';

    // Create critical warning modal with enhanced unclosable behavior
    const warningModal = document.createElement('div');
    warningModal.className = 'critical-warning-modal';
    warningModal.setAttribute('data-warning-id', warningId);
    warningModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      backdrop-filter: blur(10px);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: all;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    warningModal.innerHTML = `
      <div class="critical-warning-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: not-allowed;"></div>
      <div class="critical-warning-content" style="
        position: relative;
        background: #ffffff;
        border-radius: 16px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        z-index: 100000;
        transform: scale(0.9);
        transition: transform 0.3s ease;
        border: 3px solid #ff6b6b;
      ">
        <div class="warning-header" style="
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #f0f0f0;
        ">
          <div class="warning-avatar" style="
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            color: white;
            font-size: 20px;
          ">
            <i class="fas fa-bolt"></i>
          </div>
          <div class="warning-sender">
            <h3 style="margin: 0; color: #2d3748; font-size: 18px; font-weight: 600;">Zync Official Team</h3>
            <p class="team-subtitle" style="margin: 5px 0 0 0; color: #718096; font-size: 14px;">Moderation Department</p>
            <span class="official-badge" style="
              background: #48bb78;
              color: white;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 500;
              display: inline-block;
              margin-top: 5px;
            ">Verified</span>
          </div>
        </div>
        <div class="warning-body" style="margin-bottom: 25px;">
          <div class="warning-icon" style="
            text-align: center;
            margin-bottom: 15px;
          ">
            <i class="fas fa-exclamation-triangle" style="
              font-size: 48px;
              color: #ff6b6b;
              animation: warningPulse 2s infinite;
            "></i>
          </div>
          <div class="warning-message">
            <h4 style="
              text-align: center;
              color: #2d3748;
              margin: 0 0 15px 0;font-size: 20px;
              font-weight: 600;
            ">⚠️ CRITICAL WARNING ⚠️</h4>
            <p style="
              color: #4a5568;
              line-height: 1.6;
              text-align: center;
              font-size: 16px;
              margin: 0;
              padding: 20px;
              background: #fff5f5;
              border-radius: 8px;
              border-left: 4px solid #ff6b6b;
              font-weight: 500;
            ">${warningMessage}</p>
            <div style="
              text-align: center;
              margin-top: 15px;
              padding: 10px;
              background: #fffacd;
              border-radius: 6px;
              border: 1px solid #f0ad4e;
              font-size: 14px;
              color: #8a6d3b;
            ">
              <strong>⚠️ This warning cannot be dismissed without acknowledgment ⚠️</strong>
            </div>
          </div>
        </div>
        <div class="warning-actions" style="text-align: center;">
          <button class="acknowledge-btn" data-warning-id="${warningId}" style="
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            animation: buttonPulse 3s infinite;
          ">
            <i class="fas fa-check"></i>
            I Understand & Acknowledge
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(warningModal);

    // Animate in
    setTimeout(() => {
      warningModal.style.opacity = '1';
      const content = warningModal.querySelector('.critical-warning-content');
      content.style.transform = 'scale(1)';
    }, 50);

    // Add click handler for acknowledge button with proper event handling
    const acknowledgeBtn = warningModal.querySelector('.acknowledge-btn');
    acknowledgeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const warningId = this.getAttribute('data-warning-id');
      acknowledgeWarning(warningId, this);
    });

    // ABSOLUTELY PREVENT any dismissal except through acknowledge button
    const preventDismissal = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      shakeModal(warningModal);
      return false;
    };

    // Block ALL click events on the modal except the acknowledge button
    warningModal.addEventListener('click', (e) => {
      // Only allow clicks on the acknowledge button
      if (!e.target.classList.contains('acknowledge-btn') && !e.target.closest('.acknowledge-btn')) {
        preventDismissal(e);
      }
    }, true);

    // Prevent ALL keyboard events from closing modal
    const handleKeydown = (e) => {
      // Block ALL keys including Escape, Enter, Space, etc.
      preventDismissal(e);
    };

    // Capture ALL events at document level
    document.addEventListener('keydown', handleKeydown, { capture: true });
    document.addEventListener('keyup', handleKeydown, { capture: true });
    document.addEventListener('keypress', handleKeydown, { capture: true });

    // Store handlers for cleanup
    warningModal._keydownHandler = handleKeydown;

    // Block mouse events
    document.addEventListener('mousedown', preventDismissal, { capture: true });
    document.addEventListener('mouseup', preventDismissal, { capture: true });

    // Block touch events on mobile
    document.addEventListener('touchstart', preventDismissal, { capture: true });
    document.addEventListener('touchend', preventDismissal, { capture: true });

    // Store all handlers for cleanup
    warningModal._eventHandlers = {
      keydown: handleKeydown,
      keyup: handleKeydown,
      keypress: handleKeydown,
      mousedown: preventDismissal,
      mouseup: preventDismissal,
      touchstart: preventDismissal,
      touchend: preventDismissal
    };

    // Also add to messages list if we're on messages page
    addWarningToMessages(warning);

    // Play critical sound
    playCriticalNotificationSound();

    // Add required CSS animations
    addWarningAnimations();
  }

  function shakeModal(warningModal) {
    const content = warningModal.querySelector('.critical-warning-content');
    content.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
      content.style.animation = '';
        }, 500);
  }

  function addWarningAnimations() {
    if (!document.getElementById('warning-animations-style')) {
      const animationsStyle = document.createElement('style');
      animationsStyle.id = 'warning-animations-style';
      animationsStyle.textContent = `
        @keyframes shake {
          0%, 100% { transform: scale(1) translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: scale(1) translateX(-8px); }
          20%, 40%, 60%, 80% { transform: scale(1) translateX(8px); }
        }
        @keyframes warningPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes buttonPulse {
          0%, 100% { box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
          50% { box-shadow: 0 6px 20px rgba(102, 126, 234, 0.8); }
        }
        .acknowledge-btn:hover {
          background: linear-gradient(135deg, #5a67d8, #667eea) !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5) !important;
        }
        .critical-warning-modal {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }
      `;
      document.head.appendChild(animationsStyle);
    }
  }

  function initializeNotificationSystem() {
    if (window.ZyncNotifications.notificationSystemStarted) {
      return;
    }

    window.ZyncNotifications.notificationSystemStarted = true;

    setTimeout(() => {
      if (areNotificationsSupported()) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            registerServiceWorker();
          } else {
            setupNotificationPolling();
          }
        }).catch(error => {
          console.error('Error requesting notification permission:', error);
          setupNotificationPolling();
        });
      } else {
        setupNotificationPolling();
      }
    }, 500);
  }

  // Expose the initialization function
  window.ZyncNotifications.initialize = initializePushNotifications;
  window.ZyncNotifications.showNotification = showNotification;
  window.ZyncNotifications.displayNativeNotification = displayNativeNotification;
  window.ZyncNotifications.showVisualNotification = showVisualNotification;
  window.ZyncNotifications.showWarningDetails = showWarningDetails;

  // Also expose functions globally for easy access
  window.showWarningDetails = showWarningDetails;
  window.acknowledgeWarning = acknowledgeWarning;

  // Add socket warning handler with enhanced deduplication
  window.addEventListener('DOMContentLoaded', () => {
    // Initialize tracking systems if not already done
    if (!window.ZyncNotifications.globalWarningTracker) {
      window.ZyncNotifications.globalWarningTracker = new Set();
    }
    if (!window.ZyncNotifications.acknowledgedWarnings) {
      window.ZyncNotifications.acknowledgedWarnings = new Set();
    }
    if (!window.ZyncNotifications.deliveredWarnings) {
      window.ZyncNotifications.deliveredWarnings = new Set();
    }
    if (!window.ZyncNotifications.activeWarningModals) {
      window.ZyncNotifications.activeWarningModals = new Set();
    }
    if (!window.ZyncNotifications.processedNotifications) {
      window.ZyncNotifications.processedNotifications = new Set();
    }

    // Set up socket warning listener if socket is available
    if (typeof io !== 'undefined') {
      const setupSocketWarningHandler = () => {
        const socket = window.socket;
        if (socket) {
          socket.on('warning', (warningData) => {
            // Normalize warning ID comprehensively
            let warningId = warningData.id;
            if (typeof warningId === 'string') {
              warningId = warningId.replace(/^(stored_|warning_)/, '');
            }

            // Create all possible ID variations for comprehensive checking
            const idVariations = [
              warningId,
              `warning_${warningId}`,
              `stored_${warningId}`,
              warningData.id // Original ID
            ];

            // Check against all tracking systems with all ID variations
            const isAlreadyProcessed = idVariations.some(id =>
              window.ZyncNotifications.globalWarningTracker.has(id) ||
              window.ZyncNotifications.acknowledgedWarnings.has(id) ||
              window.ZyncNotifications.activeWarningModals.has(id) ||
              window.ZyncNotifications.deliveredWarnings.has(id) ||
              window.ZyncNotifications.processedNotifications.has(id)
            );

            if (isAlreadyProcessed) {
              return;
            }

            // Add ALL variations to all tracking systems immediately
            idVariations.forEach(id => {
              window.ZyncNotifications.globalWarningTracker.add(id);
              window.ZyncNotifications.deliveredWarnings.add(id);
              window.ZyncNotifications.processedNotifications.add(id);
            });

            // Normalize warning data structure for consistent display
            const normalizedWarning = {
              id: warningId,
              message: warningData.message,
              timestamp: warningData.timestamp,
              type: 'warning',
              data: {
                type: 'warning',
                warningId: warningId,
                timestamp: warningData.timestamp
              }
            };

            showWarningDetails(normalizedWarning);
          });
        }
      };

      // Try to set up handler immediately, or wait for socket connection
      if (window.socket) {
        setupSocketWarningHandler();
      } else {
        // Wait for socket to be available
        const checkSocket = setInterval(() => {
          if (window.socket) {
            setupSocketWarningHandler();
            clearInterval(checkSocket);
          }
        }, 100);

        // Clear interval after 10 seconds to prevent infinite checking
        setTimeout(() => clearInterval(checkSocket), 10000);
      }
    }
  });

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotificationSystem);
  } else {
    initializeNotificationSystem();
  }
})();
// Export the main initialization function for compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        initializePushNotifications: () => {
            // Use the existing notification system initialization
            if (window.ZyncNotifications && typeof window.ZyncNotifications.initialize === 'function') {
                return window.ZyncNotifications.initialize();
            } else {
                console.warn('ZyncNotifications system not available, using polling fallback');
                if (typeof setupNotificationPolling === 'function') {
                    setupNotificationPolling();
                }
            }
        }
    };
}
