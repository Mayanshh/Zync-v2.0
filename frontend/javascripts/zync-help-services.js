// Navigation
const navButtons = document.querySelectorAll('.nav-btn');
const sections = {
  'dashboard': document.getElementById('dashboard-section'),
  'user-management': document.getElementById('user-management-section')
};

// Initialize UI elements
const searchbarWrapper = document.querySelector('.searchbar-wrapper');
const searchInput = document.querySelector('#searchbar');
const searchButton = document.querySelector('#search-users-btn');
const userCardContainer = document.querySelector('.user-cards-container');
const userDetailsModal = document.querySelector('.user-details-modal');
const openUserModalBtns = document.querySelectorAll('#openUserModal-btn');
let isUserModalOpen = false;

// Set up navigation
navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const sectionName = btn.dataset.section;

    // Update navigation buttons
    navButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show/hide sections
    Object.values(sections).forEach(section => {
      section.classList.add('hidden-section');
      section.classList.remove('active-section');
    });

    sections[sectionName].classList.remove('hidden-section');
    sections[sectionName].classList.add('active-section');
  });
});

// Search functionality
function sanitizeInput(input) {
  return input.replace(/[<>]/g, '').trim().toLowerCase();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function performSearch() {
  const searchTerm = sanitizeInput(searchInput.value);
  const userCards = document.querySelectorAll('.user-card');

  userCards.forEach(card => {
    const name = card.querySelector('#name').textContent.toLowerCase();
    const username = card.querySelector('#username').textContent.toLowerCase();
    const isMatch = name.includes(searchTerm) || username.includes(searchTerm);
    card.style.display = isMatch ? 'flex' : 'none';
  });
}

// Event listeners
const debouncedSearch = debounce(performSearch, 300);
if (searchInput) {
  searchInput.addEventListener('input', debouncedSearch);
}
if (searchButton) {
  searchButton.addEventListener('click', performSearch);
}

// Modal functionality
openUserModalBtns.forEach(btn => {
  btn.addEventListener('click', () => toggleModal());
});

function toggleModal() {
  isUserModalOpen = !isUserModalOpen;

  if (isUserModalOpen) {
    userDetailsModal.style.display = 'block';
    setTimeout(() => {
      userDetailsModal.style.opacity = '1';
    }, 10);
    if (searchbarWrapper) searchbarWrapper.style.display = 'none';
    if (userCardContainer) userCardContainer.style.display = 'none';
  } else {
    userDetailsModal.style.opacity = '0';
    setTimeout(() => {
      userDetailsModal.style.display = 'none';
      if (searchbarWrapper) searchbarWrapper.style.display = 'flex';
      if (userCardContainer) userCardContainer.style.display = 'flex';

      // Reset to user management section
      Object.values(sections).forEach(section => {
        section.classList.add('hidden-section');
        section.classList.remove('active-section');
      });
      sections['user-management'].classList.remove('hidden-section');
      sections['user-management'].classList.add('active-section');

      // Update navigation buttons
      navButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelector('[data-section="user-management"]').classList.add('active');
    }, 300);
  }
}

// Function to show delete confirmation modal
function showDeleteConfirmation(message, onConfirm) {
  const existingModal = document.querySelector('.delete-confirmation-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'delete-confirmation-modal';
  modal.innerHTML = `
    <div class="delete-confirmation-content">
      <h3>Delete User</h3>
      <p>${message}</p>
      <div class="delete-confirmation-buttons">
        <button class="cancel-btn">Cancel</button>
        <button class="confirm-btn">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  const cancelBtn = modal.querySelector('.cancel-btn');
  const confirmBtn = modal.querySelector('.confirm-btn');

  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });

  confirmBtn.addEventListener('click', () => {
    onConfirm();
    modal.remove();
  });

  // Show modal with animation
  setTimeout(() => {
    modal.style.opacity = '1';
  }, 10);
}

// Function to handle user deletion
async function handleUserDeletion(userId, username) {
  // First confirmation
  showDeleteConfirmation(`Are you sure you want to delete user "${username}"?`, () => {
    // Second confirmation
    showDeleteConfirmation(`Please confirm again that you want to permanently delete user "${username}". This action cannot be undone.`, async () => {
      try {
        const response = await fetch(`/api/admin/user/${userId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          // Close the user details modal
          toggleModal();

          // Show success message
          const toast = document.createElement('div');
          toast.className = 'toast success';
          toast.innerHTML = `
            <div class="toast-content">
              <i class="fas fa-check-circle"></i>
              <span>User "${username}" has been deleted successfully</span>
            </div>
          `;
          document.body.appendChild(toast);

          // Remove toast after 3 seconds
          setTimeout(() => {
            toast.remove();
          }, 3000);

          // Refresh the user list if we're on the user management section
          if (document.getElementById('user-management-section').classList.contains('active-section')) {
            // You would need to implement this function to refresh the user list
            refreshUserList();
          }
        } else {
          throw new Error('Failed to delete user');
        }
      } catch (error) {
        console.error('Error deleting user:', error);

        // Show error message
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.innerHTML = `
          <div class="toast-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>Failed to delete user: ${error.message}</span>
          </div>
        `;
        document.body.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
          toast.remove();
        }, 3000);
      }
    });
  });
}

// Add click handlers for admin action buttons
document.addEventListener('DOMContentLoaded', () => {
  const adminActions = document.querySelector('.admin-actions');
  if (adminActions) {
    // Ban/Unban button
    const banBtn = adminActions.querySelector('.ban');
    if (banBtn) {
      banBtn.addEventListener('click', async function() {
        const userId = this.getAttribute('data-user-id');
        const isBanned = this.classList.contains('banned');

        // Confirm the action
        if (!confirm(`Are you sure you want to ${isBanned ? 'unban' : 'ban'} this user?`)) {
          return;
        }

        try {
          const action = isBanned ? 'unban' : 'ban';

          // Show loading state
          const originalHtml = this.innerHTML;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
          this.disabled = true;

          const response = await fetch(`/api/admin/user/${userId}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to ${action} user`);
          }

          // Update button state
          this.classList.toggle('banned');
          this.innerHTML = isBanned ? 
            '<i class="fas fa-user-check"></i> Unban User' : 
            '<i class="fas fa-user-slash"></i> Ban User';

          // Update status badge
          const statusBadge = document.querySelector('.status-badge:nth-child(2)');
          if (statusBadge) {
            statusBadge.className = `status-badge ${isBanned ? 'active' : 'banned'}`;
            statusBadge.textContent = isBanned ? 'Active' : 'Banned';
          }

          // Show success message
          showToast('Success', `User ${isBanned ? 'unbanned' : 'banned'} successfully`);

          // Update dashboard stats in the background
          updateDashboardStats();
        } catch (error) {
          console.error(`${isBanned ? 'Unban' : 'Ban'} error:`, error);
          showToast('Error', error.message || `Failed to ${isBanned ? 'unban' : 'ban'} user`);

          // Reset button on error
          this.innerHTML = originalHtml;
        } finally {
          this.disabled = false;
        }
      });
    }

    // Warn button
    const warnBtn = adminActions.querySelector('.warn');
    if (warnBtn) {
      warnBtn.addEventListener('click', async function() {
        const userId = this.getAttribute('data-user-id');
        const warningMessage = prompt('Enter warning message for user:');
        if (!warningMessage) return;

        try {
          const response = await fetch(`/api/admin/user/${userId}/warn`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: warningMessage })
          });

          if (!response.ok) throw new Error('Failed to send warning');

          // Show success toast for admin
          showToast('Success', 'Warning sent successfully');

          // Refresh user details to show updated warnings
          const userResponse = await fetch(`/api/admin/users/${userId}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            // Update warnings count in status badges if it exists
            const warningsBadge = document.querySelector('.status-badge.warnings');
            if (warningsBadge && userData.warnings) {
              warningsBadge.textContent = `${userData.warnings.length} Warnings`;
            }
          }
        } catch (error) {
          console.error('Warning error:', error);
          showToast('Error', error.message);
        }
      });
    }

    // Delete button
    const deleteBtn = adminActions.querySelector('.delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        const userId = this.getAttribute('data-user-id');
        const username = document.getElementById('modal-username').textContent;
        handleUserDeletion(userId, username.replace('@', ''));
      });
    }

    // Verify button
    const verifyBtnAction = adminActions.querySelector('.verify-btn');
    if (verifyBtnAction) {
      verifyBtnAction.addEventListener('click', async function() {
        const userId = this.getAttribute('data-user-id');
        const isVerified = this.classList.contains('verified');

        // Confirm the action
        if (!confirm(`Are you sure you want to ${isVerified ? 'remove verification from' : 'verify'} this user?`)) {
          return;
        }

        try {
          const action = isVerified ? 'unverify' : 'verify';

          // Show loading state
          const originalHtml = this.innerHTML;
          this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
          this.disabled = true;

          const response = await fetch(`/api/admin/user/${userId}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to ${action} user`);
          }

          // Update button state
          this.classList.toggle('verified');
          this.innerHTML = isVerified ? 
            '<i class="fas fa-check-circle"></i> <span>Verify User</span>' : 
            '<i class="fas fa-check-circle"></i> <span>Remove Verification</span>';

          // Show success message
          showToast('Success', `User ${isVerified ? 'verification removed' : 'verified'} successfully`);

          // Update dashboard stats in the background
          updateDashboardStats();
        } catch (error) {
          console.error(`${isVerified ? 'Unverify' : 'Verify'} error:`, error);
          showToast('Error', error.message || `Failed to ${isVerified ? 'remove verification from' : 'verify'} user`);

          // Reset button on error
          this.innerHTML = originalHtml;
        } finally {
          this.disabled = false;
        }
      });
    }
  }
});

// Close modal when clicking the close button
document.querySelector('.close-modal-btn').addEventListener('click', toggleModal);

// Function to update dashboard stats
async function updateDashboardStats() {
  try {
    const response = await fetch('/api/admin/stats');
    if (!response.ok) throw new Error('Failed to fetch stats');

    const stats = await response.json();

    // Helper function to update stat with error handling
    const updateStat = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = value !== undefined && value !== null ? value : 'Error loading';
        element.classList.toggle('error-text', value === undefined || value === null);
      }
    };

    // Update all stats with error handling
    updateStat('.stat-card:nth-child(1) .stat-number', stats.totalUsers);
    updateStat('.stat-card:nth-child(2) .stat-number', stats.activeUsers);
    updateStat('.stat-card:nth-child(3) .stat-number', stats.newUsers);
    updateStat('.stat-card:nth-child(4) .stat-number', stats.warnedUsers);
    updateStat('.stat-card:nth-child(5) .stat-number', stats.warnedUsers);
    updateStat('.stat-card:nth-child(6) .stat-number', stats.verifiedUsers);
    updateStat('.stat-card:nth-child(7) .stat-number', stats.bannedUsers);
    updateStat('.stat-card:nth-child(8) .stat-number', stats.deletedUsers);

    // Update system status indicators
    const statusItems = document.querySelectorAll('.status-item');
    statusItems.forEach(item => {
      const type = item.querySelector('span').textContent.toLowerCase();
      const indicator = item.querySelector('.status-indicator');

      if (type.includes('database')) {
        indicator.className = `status-indicator ${stats.systemStatus.database ? 'online' : 'offline'}`;
      } else if (type.includes('websocket')) {
        indicator.className = `status-indicator ${stats.systemStatus.webSocket ? 'online' : 'offline'}`;
      } else if (type.includes('web server')) {
        indicator.className = `status-indicator ${stats.systemStatus.webServer ? 'online' : 'offline'}`;
      }
    });

  } catch (error) {
    console.error('Error updating dashboard:', error);
  }
}

// Update stats initially and every 30 seconds
updateDashboardStats();
setInterval(updateDashboardStats, 30000);


// Function to fetch and display users
async function fetchAndDisplayUsers() {
  try {
    const response = await fetch('/api/admin/users');
    if (!response.ok) throw new Error('Failed to fetch users');

    const users = await response.json();
    const userCardsContainer = document.querySelector('.user-cards-container');

    if (!users.length) {
      userCardsContainer.innerHTML = '<p class="no-users">No users found</p>';
      return;
    }

    userCardsContainer.innerHTML = users.map(user => `
      <div class="user-card" data-user-id="${user._id}">
        <aside>
          <img src="${user.profilePicture || '/images/default-avatar.png'}" alt="User Profile" id="user-profile-img"/>
        </aside>
        <aside>
          <div id="username-wrapper">
            <p id="name">${user.fullName || 'No Name'} ${user.verified ? '<i class="fas fa-check-circle verified-badge" title="Verified"></i>' : ''}</p>
            <p id="username">@${user.username}</p>
          </div>
          <div id="btn-wrapper">
            <button class="view-user-btn">view</button>
          </div>
        </aside>
      </div>
    `).join('');

    // Add event listeners to the newly created view buttons
    const viewButtons = document.querySelectorAll('.view-user-btn');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.closest('.user-card').dataset.userId;
        await showUserDetails(userId);
        toggleModal();
      });
    });

    async function showUserDetails(userId) {
  const modal = document.querySelector('.user-details-modal');
  if (!modal) return;
      try {
        const response = await fetch(`/api/admin/users/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch user details');

        const user = await response.json();

        // Update modal with user details
        const modalName = document.querySelector('#modal-name');
        modalName.innerHTML = `${user.fullName || 'No Name'} ${user.verified ? '<i class="fas fa-check-circle verified-badge" title="Verified"></i>' : ''}`;
        document.querySelector('#modal-username').textContent = `@${user.username}`;
        document.querySelector('#modal-user-img').src = user.profilePicture || '/images/default-avatar.png';

        // Update account information
        const detailItems = document.querySelectorAll('.detail-item');
        detailItems[0].querySelector('p').textContent = user._id || 'N/A';
        // Format and display IP address
        const ipDisplay = user.ip && user.ip !== 'unknown' ? user.ip.split(',')[0].trim() : 'Not available';
        detailItems[1].querySelector('p').textContent = ipDisplay;
        detailItems[1].querySelector('p').title = `Last known IP: ${ipDisplay}`;
        detailItems[2].querySelector('p').textContent = user.email || 'Not available';
        detailItems[3].querySelector('p').textContent = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';

        // Enhanced logging for debugging
        console.log('User details:', {
          id: user._id,
          ip: user.ip,
          email: user.email,
          createdAt: user.createdAt
        });

        // Update status badges
        const statusBadges = document.querySelectorAll('.status-badge');

        // Check both socket connection and last activity (within last 30 minutes)
        const lastActive = user.lastLocation?.lastUpdated ? new Date(user.lastLocation.lastUpdated) : null;
        const isRecentlyActive = lastActive && (new Date(lastActive) > new Date(Date.now() - 30 * 60 * 1000));

        // Fetch room info to check if user has active socket connections
        fetch(`/api/admin/user-status/${user._id}`)
          .then(response => response.json())
          .then(data => {
            const isOnline = data.hasActiveSocket || isRecentlyActive;
            statusBadges[0].className = `status-badge ${isOnline ? 'online' : 'offline'}`;
            statusBadges[0].textContent = isOnline ? 'Online' : 'Offline';
          })
          .catch(err => {
            console.error('Error checking user status:', err);
            // Fallback to just activity check if socket check fails
            statusBadges[0].className = `status-badge ${isRecentlyActive ? 'online' : 'offline'}`;
            statusBadges[0].textContent = isRecentlyActive ? 'Online' : 'Offline';
          });

        // Update ban status badge and button
        statusBadges[1].className = `status-badge ${user.banned ? 'banned' : 'active'}`;
        statusBadges[1].textContent = user.banned ? 'Banned' : 'Active';

        // Update ban button state
        const banBtn = document.querySelector('.admin-actions .ban');
        if (banBtn) {
          banBtn.classList.toggle('banned', user.banned);
          banBtn.innerHTML = user.banned ? 
            '<i class="fas fa-user-check"></i> Unban User' : 
            '<i class="fas fa-user-slash"></i> Ban User';
          banBtn.setAttribute('data-user-id', user._id);
        }

        // Set user ID for other action buttons
        const warnBtn = document.querySelector('.admin-actions .warn');
        const deleteBtn = document.querySelector('.admin-actions .delete');
        const verifyBtnModal = document.querySelector('.admin-actions .verify-btn');
        if (warnBtn) warnBtn.setAttribute('data-user-id', user._id);
        if (deleteBtn) deleteBtn.setAttribute('data-user-id', user._id);
        if (verifyBtnModal) {
          verifyBtnModal.setAttribute('data-user-id', user._id);
          
          // Update verify button state based on user verification status
          if (user.verified) {
            verifyBtnModal.classList.add('verified');
            verifyBtnModal.innerHTML = '<i class="fas fa-check-circle"></i> <span>Remove Verification</span>';
          } else {
            verifyBtnModal.classList.remove('verified');
            verifyBtnModal.innerHTML = '<i class="fas fa-check-circle"></i> <span>Verify User</span>';
          }
        }

        statusBadges[2].className = `status-badge ${user.anonymousMode ? 'anonymous' : 'normal'}`;
        statusBadges[2].textContent = user.anonymousMode ? 'Anonymous' : 'Normal';

        // Add verified status badge if it doesn't exist
        let verifiedBadge = document.querySelector('.status-badge.verified, .status-badge.not-verified');
        let verifiedItem = document.querySelector('.status-item:has(.status-badge.verified), .status-item:has(.status-badge.not-verified)');
        
        if (!verifiedBadge) {
          const statusGrid = document.querySelector('.status-grid');
          verifiedItem = document.createElement('div');
          verifiedItem.className = 'status-item';
          verifiedItem.innerHTML = `
            <span>Verification Status</span>
            <p class="status-badge verified">Verified</p>
          `;
          statusGrid.appendChild(verifiedItem);
          verifiedBadge = verifiedItem.querySelector('.status-badge');
        }
        
        // Ensure we're checking the correct verified property
        const isVerified = user.verified === true || user.verified === 'true';
        verifiedBadge.className = `status-badge ${isVerified ? 'verified' : 'not-verified'}`;
        verifiedBadge.textContent = isVerified ? 'Verified' : 'Not Verified';
        
        // Add icon to the verification status
        if (isVerified) {
          verifiedBadge.innerHTML = '<i class="fas fa-check-circle"></i> Verified';
        } else {
          verifiedBadge.innerHTML = '<i class="fas fa-times-circle"></i> Not Verified';
        }
        
        // Update the verify button state
        const verifyBtnElement = document.getElementById('verify-btn');
        const verifyBtnTextElement = document.getElementById('verify-btn-text');
        if (verifyBtnElement && verifyBtnTextElement) {
          if (isVerified) {
            verifyBtnElement.classList.add('verified');
            verifyBtnTextElement.textContent = 'Remove Verification';
          } else {
            verifyBtnElement.classList.remove('verified');
            verifyBtnTextElement.textContent = 'Verify User';
          }
        }


        // Fetch and display user posts after loading user details
        await fetchAndDisplayUserPosts(userId, user.anonymousMode);
      } catch (error) {
        console.error('Error fetching user details:', error);
        showToast('Error', 'Failed to load user details');
      }
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    const userCardsContainer = document.querySelector('.user-cards-container');
    userCardsContainer.innerHTML = '<p class="error-message">Error loading users. Please try again.</p>';
  }
}

// User management functions
async function banUser(userId) {
  try {
    const response = await fetch(`/api/admin/user/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to ban user');
    await fetchAndDisplayUsers(); // Refresh the list
    showToast('Success', 'User has been banned');
  } catch (error) {
    console.error('Error banning user:', error);
    showToast('Error', 'Failed to ban user');
  }
}

async function unbanUser(userId) {
  try {
    const response = await fetch(`/api/admin/user/${userId}/unban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to unban user');
    await fetchAndDisplayUsers(); // Refresh the list
    showToast('Success', 'User has been unbanned');
  } catch (error) {
    console.error('Error unbanning user:', error);
    showToast('Error', 'Failed to unban user');
  }
}

async function warnUser(userId) {
  const warningMessage = prompt('Enter warning message:');
  if (!warningMessage) return;

  try {
    const response = await fetch(`/api/admin/user/${userId}/warn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: warningMessage })
    });

    if (!response.ok) throw new Error('Failed to warn user');
    showToast('Success', 'Warning sent to user');
  } catch (error) {
    console.error('Error warning user:', error);
    showToast('Error', 'Failed to send warning');
  }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

  try {
    const response = await fetch(`/api/admin/user/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to delete user');
    await fetchAndDisplayUsers(); // Refresh the list
    showToast('Success', 'User has been deleted');
  } catch (error) {
    console.error('Error deleting user:', error);
    showToast('Error', 'Failed to delete user');
  }
}

// Helper function to show toast notifications
function showToast(title, message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <div>
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  
  // Show toast with animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function handleRegister() {
    const username = document.getElementById('register-username').value;
    const fullname = document.getElementById('register-fullname').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (!username || !fullname || !email || !password) {
        alert('Please fill all required fields');
        return;
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        alert('Please enter a valid email address');
        return;
    }

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, fullName: fullname, email })
        });

        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.message || 'Registration failed');
            return;
        }

        alert('Registration successful!');
        // Optionally redirect to login page
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again later.');
    }
}


// Initialize user management
document.addEventListener('DOMContentLoaded', () => {
  fetchAndDisplayUsers();

  // Add refresh button functionality
  const refreshBtn = document.getElementById('refresh-users-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchAndDisplayUsers);
  }
});

async function deleteUserPost(postId, postElement) {
    try {
        // Add confirmation dialog
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }

        // Show loading state
        const deleteBtn = postElement.querySelector('.delete-post-btn');
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            deleteBtn.disabled = true;
        }

        const response = await fetch(`/api/admin/post/${postId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            // Fade out animation
            postElement.style.opacity = '0';
            postElement.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                postElement.remove();
                if (document.querySelectorAll('.modal-post').length === 0) {
                    document.getElementById('user-posts-container').innerHTML = '<div class="modal-posts-empty">No posts available</div>';
                }
            }, 300);
        } else {
            console.error('Failed to delete post:', await response.text());
            alert('Failed to delete post. Please try again.');

            // Reset delete button
            if (deleteBtn) {
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post. Please try again.');

        // Reset delete button
        const deleteBtn = postElement.querySelector('.delete-post-btn');
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.disabled = false;
        }
    }
}

async function fetchAndDisplayUserPosts(userId, isAnonymous) {
    const postsContainer = document.getElementById('user-posts-container');
    if (!postsContainer) {
        console.error('Posts container not found');
        return;
    }

    // Show loading state
    postsContainer.innerHTML = `
        <div class="modal-posts-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading posts...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/admin/users/${userId}/posts`);
        if (!response.ok) {
            throw new Error('Failed to fetch posts');
        }

        const posts = await response.json();

        if (posts.length === 0) {
            postsContainer.innerHTML = '<div class="modal-posts-empty">No posts available</div>';
            return;
        }

        // Clear loading message and create posts HTML
        postsContainer.innerHTML = '';

        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.className = 'modal-post';

            const date = new Date(post.createdAt);
            const formattedDate = date.toLocaleString();

            let postHTML = `
                <div class="modal-post-content">${post.content || ''}</div>
            `;

            if (post.image) {
                postHTML += `<img src="${post.image}" alt="Post image" class="modal-post-image">`;
            }

            postHTML += `
                <div class="modal-post-stats">
                    <div class="modal-post-stat">
                        <i class="far fa-heart"></i>
                        <span>${post.likes ? post.likes.length : 0}</span>
                    </div>
                    <div class="modal-post-stat">
                        <i class="far fa-comment"></i>
                        <span>${post.comments ? post.comments.length : 0}</span>
                    </div>
                    <div class="modal-post-delete">
                        <button class="delete-post-btn" data-post-id="${post._id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="modal-post-timestamp">${formattedDate}</div>
            `;

            postElement.innerHTML = postHTML;
            postsContainer.appendChild(postElement);

            // Add click event listener for delete button
            const deleteBtn = postElement.querySelector('.delete-post-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    deleteUserPost(deleteBtn.dataset.postId, postElement);
                });
            }
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        postsContainer.innerHTML = '<div class="modal-posts-error">Error loading posts</div>';
    }
}

// Socket.IO connection setup
let socket = null;

// Initialize Socket.IO connection
function initializeSocket() {
    if (typeof io === 'undefined') {
        console.error('Socket.IO not loaded');
        return;
    }

    socket = io({
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        maxReconnectionAttempts: 10
    });

    socket.on('connect', () => {
        console.log('Socket connected');
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator online';
            statusIndicator.title = 'Connected';
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator offline';
            statusIndicator.title = 'Disconnected';
        }
    });

    socket.on('connect_error', (error) => {
        console.warn('Socket connection error:', error);
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator offline';
            statusIndicator.title = 'Connection lost: ' + error.message;
        }
    });
}

// Initialize socket when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeSocket, 1000);
});