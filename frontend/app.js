// DOM Elements - Auth
const authPage = document.getElementById('auth-page');
const mainApp = document.getElementById('main-app');
const tabBtns = document.querySelectorAll('.tab-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');

// DOM Elements - Navigation
const navBtns = document.querySelectorAll('.nav-btn');
const contentPages = document.querySelectorAll('.content-page');

// DOM Elements - Nearby
const nearbyUsersList = document.getElementById('nearby-users-list');
const locationStatusText = document.getElementById('location-status-text');
const refreshLocationBtn = document.getElementById('refresh-location-btn');

// DOM Elements - Posts

// Helper function to escape HTML and prevent XSS attacks
function escapeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const newPostContent = document.getElementById('new-post-content');
const postImageUpload = document.getElementById('post-image-upload');
const postImagePreview = document.getElementById('post-image-preview');
const submitPostBtn = document.getElementById('submit-post-btn');
const postsList = document.getElementById('posts-list');

// DOM Elements - Messages
const conversationsList = document.getElementById('conversations-list');
const chatInterface = document.getElementById('chat-interface');
const backToMessagesBtn = document.getElementById('back-to-messages-btn');
const chatUserName = document.getElementById('chat-user-name');
const chatMessages = document.getElementById('chat-messages');
const chatMessageInput = document.getElementById('chat-message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const viewProfileBtn = document.getElementById('view-profile-btn');

// DOM Elements - Profile
const profilePicture = document.getElementById('profile-picture');
const profilePictureUpload = document.getElementById('profile-picture-upload');
const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');
const profileBioText = document.getElementById('profile-bio-text');
const instagramProfile = document.getElementById('instagram-profile');
const facebookProfile = document.getElementById('facebook-profile');
const twitterProfile = document.getElementById('twitter-profile');
const linkedinProfile = document.getElementById('linkedin-profile');
const snapchatProfile = document.getElementById('snapchat-profile');
const spotifyProfile = document.getElementById('spotify-profile'); // Added Spotify profile
const hobbyTagInput = document.getElementById('hobby-tag-input');
const addHobbyBtn = document.getElementById('add-hobby-btn');
const hobbyTags = document.getElementById('hobby-tags');
const song1Input = document.getElementById('song-1');
const song2Input = document.getElementById('song-2');
const song3Input = document.getElementById('song-3');
const aboutMeText = document.getElementById('about-me-text');
const saveProfileBtn = document.getElementById('save-profile-btn');
const logoutBtn = document.getElementById('logout-btn');

// DOM Elements - Modals
const requestModal = document.getElementById('request-modal');
const requestText = document.getElementById('request-text');
const acceptRequestBtn = document.getElementById('accept-request-btn');
const rejectRequestBtn = document.getElementById('reject-request-btn');
const userProfileModal = document.getElementById('user-profile-modal');
const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
const modalProfilePicture = document.getElementById('modal-profile-picture');
const modalProfileName = document.getElementById('modal-profile-name');
const modalProfileUsername = document.getElementById('modal-profile-username');
const modalProfileBio = document.getElementById('modal-profile-bio');
const modalSocialProfiles = document.getElementById('modal-social-profiles');
const connectBtn = document.getElementById('connect-btn');
const messageBtn = document.getElementById('message-btn');

// Global Variables
let currentUser = null;
let socket = null;
let watchPositionId = null;
let currentPosition = null;
let nearbyUsersData = [];
let currentProfileUserId = null;
let currentChatUserId = null;
let imageDataUrl = null;
let conversations = [];
let csrfToken = null;
let currentRequestId = null;
let currentRequestUserId = null;
let isAnonymousMode = false;
let allUsers = []; // Store all users for search
let searchTimeout = null; // For debouncing search

// Variable to store pending connection requests
let pendingConnectionRequests = [];

// Function to check for pending requests after socket connection
function checkPendingRequests() {
    console.log('Checking for pending connection requests...');
    
    if (pendingConnectionRequests.length > 0) {
        console.log(`Found ${pendingConnectionRequests.length} pending requests`);
        
        // Show the first pending request
        const request = pendingConnectionRequests.shift();
        showConnectionRequestModal(request.requestId, request.fromUserId);
        
        // Save updated pending requests
        savePendingRequestsToStorage();
    } else {
        console.log('No pending requests found');
    }
}

// Function to show a connection request modal
function showConnectionRequestModal(requestId, fromUserId) {
    // Fetch sender's info and show request modal
    fetchUserInfo(fromUserId).then(userInfo => {
        currentRequestId = requestId;
        currentRequestUserId = fromUserId;
        
        // Update request text with name and verified badge
        const displayName = userInfo.isAnonymous ? 'Anonymous User' : (userInfo.fullName || userInfo.username);
        const verifiedBadge = !userInfo.isAnonymous && userInfo.verified ? ' <i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : '';
        requestText.innerHTML = `${escapeHTML(displayName)}${verifiedBadge} wants to connect with you!`;
        
        // Update profile picture
        const requestUserPicture = document.getElementById('request-user-picture');
        if (userInfo.isAnonymous) {
            requestUserPicture.innerHTML = '<i class="fas fa-mask"></i>';
            requestUserPicture.classList.add('anonymous');
            requestUserPicture.classList.remove('verified');
        } else if (userInfo.profilePicture) {
            requestUserPicture.innerHTML = `<img src="${userInfo.profilePicture}" alt="${displayName}">`;
            requestUserPicture.classList.remove('anonymous');
            if (userInfo.verified) {
                requestUserPicture.classList.add('verified');
            } else {
                requestUserPicture.classList.remove('verified');
            }
        } else {
            requestUserPicture.innerHTML = '<i class="fas fa-user"></i>';
            requestUserPicture.classList.remove('anonymous');
            if (userInfo.verified) {
                requestUserPicture.classList.add('verified');
            } else {
                requestUserPicture.classList.remove('verified');
            }
        }
        
        // Reset any previous request status
        const requestStatus = document.getElementById('request-status');
        requestStatus.innerHTML = '';
        
        // Show the buttons
        document.getElementById('accept-request-btn').disabled = false;
        document.getElementById('reject-request-btn').disabled = false;
        document.getElementById('accept-request-btn').classList.remove('hidden');
        document.getElementById('reject-request-btn').classList.remove('hidden');
        
        // Show the modal with animation
        requestModal.classList.remove('hidden');
        
        // Add a subtle entrance animation using GSAP
        const modalContent = requestModal.querySelector('.modal-content');
        gsap.fromTo(modalContent, 
            { scale: 0.8, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" }
        );

        // Remove this request from pending list once shown
        pendingConnectionRequests = pendingConnectionRequests.filter(req => 
            req.requestId !== requestId
        );

        // Store in localStorage to retrieve on page refresh/reconnect
        savePendingRequestsToStorage();
    }).catch(error => {
        console.error('Error fetching user info:', error);
        // Show error message in modal
        requestText.textContent = 'Error loading request details. Please try again later.';
        requestModal.classList.remove('hidden');
    });
}

// Save pending requests to localStorage
function savePendingRequestsToStorage() {
    localStorage.setItem('pendingRequests', JSON.stringify(pendingConnectionRequests));
}

// Load pending requests from localStorage
function loadPendingRequestsFromStorage() {
    const stored = localStorage.getItem('pendingRequests');
    if (stored) {
        try {
            pendingConnectionRequests = JSON.parse(stored);
            console.log('Loaded pending requests:', pendingConnectionRequests);
        } catch (e) {
            console.error('Error loading pending requests:', e);
            pendingConnectionRequests = [];
        }
    }
}

// Admin functionality
let isAdmin = false;

// Function to check admin status
async function checkAdminStatus() {
    try {
        const response = await fetch('/api/admin/check');
        if (response.ok) {
            isAdmin = true;
            // Show admin dashboard if on profile page
            if (document.getElementById('profile-page').classList.contains('active')) {
                showAdminDashboard();
            }
        }
    } catch (error) {
        console.error('Admin check error:', error);
    }
}

// Function to handle admin login
async function handleAdminLogin() {
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('admin-login-modal').classList.add('hidden');
            isAdmin = true;
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                showAdminDashboard();
                showToast('Success', 'Admin login successful');
            }
        } else {
            showToast('Error', 'Invalid admin credentials');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        showToast('Error', 'Failed to login as admin');
    }
}

// Function to show admin dashboard
async function showAdminDashboard() {
    if (!isAdmin) return;

    try {
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
            const stats = await response.json();
            const adminDashboard = document.createElement('div');
            adminDashboard.className = 'admin-dashboard';
            adminDashboard.innerHTML = `
                <div class="admin-stats">
                    <h3><i class="fas fa-chart-bar"></i> Admin Dashboard</h3>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <i class="fas fa-users"></i>
                            <h4>Total Users</h4>
                            <p>${stats.totalUsers}</p>
                        </div>
                        <div class="stat-card">
                            <i class="fas fa-newspaper"></i>
                            <h4>Total Posts</h4>
                            <p>${stats.totalPosts}</p>
                        </div>
                        <div class="stat-card">
                            <i class="fas fa-comment-dots"></i>
                            <h4>Total Messages</h4>
                            <p>${stats.totalMessages}</p>
                        </div>
                        <div class="stat-card">
                            <i class="fas fa-user-clock"></i>
                            <h4>Active Users (24h)</h4>
                            <p>${stats.activeUsers}</p>
                        </div>
                    </div>
                </div>
            `;
            
            const profileContainer = document.querySelector('.profile-container');
            profileContainer.insertBefore(adminDashboard, profileContainer.firstChild);
        }
    } catch (error) {
        console.error('Error fetching admin stats:', error);
    }
}

// Initialize App
async function init() {
    // Add admin trigger click handler
    const adminTrigger = document.querySelector('.subtle-admin-trigger');
    if (adminTrigger) {
        adminTrigger.addEventListener('dblclick', () => {
            document.getElementById('admin-login-modal').classList.remove('hidden');
        });
    }

    // Add admin login button event listener
    document.getElementById('admin-login-btn')?.addEventListener('click', handleAdminLogin);
    
    // Add forgot password functionality
    setupForgotPassword();
    // Fetch CSRF token first
    try {
        await fetchCSRFToken();
        console.log("CSRF token fetched successfully");

        // Check if user is logged in only after CSRF token is fetched
        const userId = localStorage.getItem('userId');
        if (userId) {
            // Auto login and fetch user data
            fetchUserData(userId);
        } else {
            showAuthPage();
        }
    } catch (error) {
        console.error("Error fetching CSRF token:", error);
        // Show auth page if we can't fetch the token
        showAuthPage();
    }

    console.log("Setting up event listeners");
    setupEventListeners();
    loadPendingRequestsFromStorage(); // Load pending requests on initialization
}

// Fetch CSRF token
async function fetchCSRFToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        csrfToken = data.csrfToken;
    } catch (error) {
        console.error('Error fetching security token');
        throw error;
    }
}

// Search functionality
let searchIndex = []; // For fast search indexing

async function fetchAllUsers() {
    try {
        // Check if we need to clear cache due to anonymous mode change
        const lastAnonymousState = localStorage.getItem('lastAnonymousState');
        const currentAnonymousState = isAnonymousMode.toString();
        
        if (lastAnonymousState !== currentAnonymousState) {
            // Clear cache when anonymous mode changes
            localStorage.removeItem('cachedUsers');
            localStorage.removeItem('lastUsersFetch');
            localStorage.setItem('lastAnonymousState', currentAnonymousState);
        }
        
        if (localStorage.getItem('lastUsersFetch') && 
            Date.now() - parseInt(localStorage.getItem('lastUsersFetch')) < 5 * 60 * 1000) {
            // Use cached data if less than 5 minutes old and anonymous state hasn't changed
            try {
                const cachedUsers = JSON.parse(localStorage.getItem('cachedUsers'));
                if (cachedUsers && cachedUsers.length > 0) {
                    allUsers = cachedUsers;
                    buildSearchIndex(allUsers);
                    console.log(`Loaded ${allUsers.length} users from cache`);
                    
                    // Update the UI if we're on the search page
                    if (document.getElementById('search-page').classList.contains('active')) {
                        const searchInput = document.getElementById('user-search');
                        if (searchInput.value.trim().length >= 2) {
                            performSearch(searchInput.value.trim());
                        }
                    }
                    return;
                }
            } catch (e) {
                console.error('Error parsing cached users:', e);
            }
        }
        
        // Show loading indicator in search results if we're on the search page
        if (document.getElementById('search-page').classList.contains('active')) {
            const searchResults = document.getElementById('search-results');
            searchResults.innerHTML = `
                <div class="search-result-loading">
                    <div class="search-loading-spinner">
                        <i class="fas fa-circle-notch fa-spin"></i>
                    </div>
                    <div class="search-result-info">
                        <div class="search-result-name">Loading users...</div>
                        <div class="search-result-username">Please wait</div>
                    </div>
                </div>
            `;
            searchResults.classList.remove('hidden');
        }
        
        // Add cache-busting parameter for anonymous mode changes
        const cacheBuster = `?t=${Date.now()}&anonymous=${isAnonymousMode}`;
        const response = await fetch(`/api/users/search${cacheBuster}`, {
            headers: {
                'Cache-Control': 'no-cache',
                'X-Anonymous-Mode': isAnonymousMode.toString()
            }
        });
        if (response.ok) {
            allUsers = await response.json();
            
            // Cache the results
            localStorage.setItem('cachedUsers', JSON.stringify(allUsers));
            localStorage.setItem('lastUsersFetch', Date.now().toString());
            
            // Build search index for fast searching
            buildSearchIndex(allUsers);
            
            console.log(`Loaded ${allUsers.length} users for search`);
            
            // Update the UI if we're on the search page
            if (document.getElementById('search-page').classList.contains('active')) {
                const searchInput = document.getElementById('user-search');
                if (searchInput.value.trim().length >= 2) {
                    performSearch(searchInput.value.trim());
                } else {
                    // Hide loading indicator if no search is active
                    document.getElementById('search-results').classList.add('hidden');
                }
            }
        } else {
            console.error('Failed to load users for search');
            // Show error in search results if we're on the search page
            if (document.getElementById('search-page').classList.contains('active')) {
                const searchResults = document.getElementById('search-results');
                searchResults.innerHTML = `
                    <div class="search-result-empty">
                        <i class="fas fa-exclamation-circle search-empty-icon"></i>
                        <div class="search-empty-text">Failed to load users. Please try again later.</div>
                    </div>
                `;
                searchResults.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error fetching users for search:', error);
        // Show error in search results if we're on the search page
        if (document.getElementById('search-page').classList.contains('active')) {
            const searchResults = document.getElementById('search-results');
            searchResults.innerHTML = `
                <div class="search-result-empty">
                    <i class="fas fa-exclamation-circle search-empty-icon"></i>
                    <div class="search-empty-text">An error occurred. Please try again later.</div>
                </div>
            `;
            searchResults.classList.remove('hidden');
        }
    }
}

// Create a search index for faster searches
function buildSearchIndex(users) {
    searchIndex = [];
    users.forEach(user => {
        if (currentUser && user._id === currentUser._id) return; // Skip current user
        
        // Add searchable fields to index
        const searchableText = [
            user.username || '',
            user.fullName || '',
        ].join(' ').toLowerCase();
        
        searchIndex.push({
            id: user._id,
            text: searchableText,
            user: user,
            score: 0
        });
    });
}

function setupSearchBar() {
    const searchInput = document.getElementById('user-search');
    const searchResults = document.getElementById('search-results');
    const clearSearchBtn = document.getElementById('clear-search');
    
    // Listen for search page activation
    document.querySelector('.nav-btn[data-page="search-page"]').addEventListener('click', () => {
        // Fetch users when the search page is activated
        fetchAllUsers();
        
        // Focus the search input for immediate searching
        setTimeout(() => {
            searchInput.focus();
        }, 300);
    });
    
    // Handle search input with optimized debounce
    let lastQuery = '';
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        
        // Don't repeat searches for the same query
        if (query === lastQuery) return;
        lastQuery = query;
        
        // Show/hide clear button
        if (query.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
            searchResults.classList.add('hidden');
        }
        
        // Debounce search with shorter delay for better responsiveness
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query.length >= 2) {
                performSearch(query);
            } else {
                searchResults.classList.add('hidden');
            }
        }, 150); // Reduced from 300ms to 150ms for faster response
    });
    
    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        lastQuery = '';
        searchResults.classList.add('hidden');
        clearSearchBtn.classList.add('hidden');
        searchInput.focus();
    });
    
    // Add keyboard navigation for search results
    searchInput.addEventListener('keydown', (e) => {
        if (!searchResults.classList.contains('hidden')) {
            const resultItems = searchResults.querySelectorAll('.search-result-item');
            let focusedItem = searchResults.querySelector('.search-result-item.focused');
            let focusedIndex = -1;
            
            if (focusedItem) {
                focusedIndex = Array.from(resultItems).indexOf(focusedItem);
            }
            
            // Handle arrow down
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (focusedIndex < resultItems.length - 1) {
                    if (focusedItem) focusedItem.classList.remove('focused');
                    resultItems[focusedIndex + 1].classList.add('focused');
                    resultItems[focusedIndex + 1].scrollIntoView({ block: 'nearest' });
                }
            }
            
            // Handle arrow up
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (focusedIndex > 0) {
                    if (focusedItem) focusedItem.classList.remove('focused');
                    resultItems[focusedIndex - 1].classList.add('focused');
                    resultItems[focusedIndex - 1].scrollIntoView({ block: 'nearest' });
                }
            }
            
            // Handle enter
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedItem) {
                    focusedItem.click();
                } else if (resultItems.length > 0) {
                    resultItems[0].click();
                }
            }
        }
    });
}

// Perform search and display results - optimized for speed
function performSearch(query) {
    // If we don't have users loaded yet, try to fetch them
    if (allUsers.length === 0 || searchIndex.length === 0) {
        fetchAllUsers();
        // Show a loading message
        showSearchResults([{ 
            _id: 'loading', 
            fullName: 'Loading users...', 
            username: 'Please wait' 
        }], query);
        return;
    }
    
    const searchResults = document.getElementById('search-results');
    
    // Convert query to lowercase for case-insensitive search
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);
    
    // Use the search index for faster searching
    searchIndex.forEach(item => {
        // Basic relevance scoring
        item.score = 0;
        
        // Skip empty queries
        if (queryLower === '') return;
        
        // Exact match bonus
        if (item.text.includes(queryLower)) {
            item.score += 10;
        }
        
        // Individual term matching
        queryTerms.forEach(term => {
            if (item.text.includes(term)) {
                item.score += 5;
                
                // Bonus for word boundaries
                const regex = new RegExp(`\\b${term}`, 'i');
                if (regex.test(item.text)) {
                    item.score += 3;
                }
                
                // Bonus for username matches (more specific)
                if (item.user.username && item.user.username.toLowerCase().includes(term)) {
                    item.score += 2;
                }
                
                // Bonus for starts with
                if (item.text.startsWith(term)) {
                    item.score += 5;
                }
            }
        });
    });
    
    // Get matches sorted by relevance
    const matchedUsers = searchIndex
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.user)
        .slice(0, 10); // Limit to 10 results
    
    showSearchResults(matchedUsers, query);
}

// Display search results with improved visuals and performance
function showSearchResults(users, query) {
    const searchResults = document.getElementById('search-results');
    
    if (users.length === 0) {
        searchResults.innerHTML = `
            <div class="search-result-empty">
                <i class="fas fa-search search-empty-icon"></i>
                <div class="search-empty-text">No users found</div>
            </div>
        `;
        searchResults.classList.remove('hidden');
        return;
    }
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // For loading state, show a nice loading indicator
    if (users.length === 1 && users[0]._id === 'loading') {
        const loadingItem = document.createElement('div');
        loadingItem.className = 'search-result-loading';
        loadingItem.innerHTML = `
            <div class="search-loading-spinner">
                <i class="fas fa-circle-notch fa-spin"></i>
            </div>
            <div class="search-result-info">
                <div class="search-result-name">Loading users...</div>
                <div class="search-result-username">Please wait</div>
            </div>
        `;
        fragment.appendChild(loadingItem);
        searchResults.innerHTML = '';
        searchResults.appendChild(fragment);
        searchResults.classList.remove('hidden');
        return;
    }
    
    // Process and display each user
    users.forEach((user, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.setAttribute('tabindex', '0'); // Make focusable for keyboard navigation
        
        // Add animation delay based on index
        resultItem.style.animationDelay = `${index * 30}ms`;
        
        // Check if user is anonymous
        const isAnonymous = user.isAnonymous || false;
        
        // Prepare display name and username
        let displayName = isAnonymous ? 'Anonymous User' : (user.fullName || user.username);
        let displayUsername = isAnonymous ? '@anonymous' : `@${user.username}`;
        
        // Do smart highlighting only for non-anonymous users
        if (!isAnonymous && query) {
            const queryLower = query.toLowerCase();
            const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);
            
            // Highlight name matches with smarter algorithm that handles multiple occurrences
            if (user.fullName) {
                displayName = highlightMatches(user.fullName, queryTerms);
            }
            
            // Highlight username matches
            if (user.username) {
                const highlightedUsername = highlightMatches(user.username, queryTerms);
                displayUsername = `@${highlightedUsername}`;
            }
        }
        
        // Check if user is verified
        const isVerified = !isAnonymous && (user.verified === true);

        resultItem.innerHTML = `
            <div class="search-result-picture ${isAnonymous ? 'anonymous' : ''} ${isVerified ? 'verified' : ''}">
                ${isAnonymous 
                    ? `<i class="fas fa-mask"></i>` 
                    : (user.profilePicture 
                        ? `<img src="${escapeHTML(user.profilePicture)}" alt="${escapeHTML(user.fullName || user.username)}">` 
                        : `<i class="fas fa-user"></i>`)}
            </div>
            <div class="search-result-info">
                <div class="search-result-name">
                    ${displayName}
                    ${isVerified ? '<i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : ''}
                </div>
                <div class="search-result-username">${displayUsername}</div>
            </div>
            <div class="search-result-action">
                <i class="fas fa-chevron-right"></i>
            </div>
        `;
        
        // Add click handler to view profile
        resultItem.addEventListener('click', () => {
            showUserProfile(user._id);
            searchResults.classList.add('hidden');
            document.getElementById('user-search').value = '';
            document.getElementById('clear-search').classList.add('hidden');
        });
        
        // Add key press handler
        resultItem.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                resultItem.click();
            }
        });
        
        fragment.appendChild(resultItem);
    });
    
    // Clear and append all at once for better performance
    searchResults.innerHTML = '';
    searchResults.appendChild(fragment);
    searchResults.classList.remove('hidden');
}

// Helper function for smart text highlighting
function highlightMatches(text, queryTerms) {
    // Start with the original text
    let highlighted = text;
    let lastIndex = 0;
    let highlightedParts = [];
    
    // Sort query terms by length (longest first) to avoid nested highlighting
    queryTerms.sort((a, b) => b.length - a.length);
    
    // Build a map of positions to highlight
    const positions = [];
    
    queryTerms.forEach(term => {
        if (!term) return;
        
        const textLower = text.toLowerCase();
        let currentIndex = 0;
        
        // Find all occurrences
        while (currentIndex < textLower.length) {
            const matchIndex = textLower.indexOf(term, currentIndex);
            if (matchIndex === -1) break;
            
            // Add to positions for highlighting
            positions.push({
                start: matchIndex,
                end: matchIndex + term.length
            });
            
            currentIndex = matchIndex + 1;
        }
    });
    
    // Sort positions by start index and merge overlapping ranges
    positions.sort((a, b) => a.start - b.start);
    const mergedPositions = [];
    
    positions.forEach(pos => {
        if (mergedPositions.length === 0) {
            mergedPositions.push(pos);
            return;
        }
        
        const lastPos = mergedPositions[mergedPositions.length - 1];
        if (pos.start <= lastPos.end) {
            // Overlapping or adjacent, merge them
            lastPos.end = Math.max(lastPos.end, pos.end);
        } else {
            // Not overlapping, add as new position
            mergedPositions.push(pos);
        }
    });
    
    // Build highlighted string from merged positions
    let result = '';
    let lastEnd = 0;
    
    mergedPositions.forEach(pos => {
        // Add text before highlight
        result += escapeHTML(text.substring(lastEnd, pos.start));
        // Add highlighted text
        result += `<span class="search-highlight">${escapeHTML(text.substring(pos.start, pos.end))}</span>`;
        lastEnd = pos.end;
    });
    
    // Add any remaining text
    result += escapeHTML(text.substring(lastEnd));
    
    return result;
}

// Setup all event listeners
function setupEventListeners() {
    // Setup search bar
    setupSearchBar();

    // Auth event listeners
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Tab clicked:', btn.dataset.tab);
            const tab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (tab === 'login') {
                loginForm.classList.add('active');
                registerForm.classList.remove('active');
            } else {
                loginForm.classList.remove('active');
                registerForm.classList.add('active');
            }
        });
    });

    // Re-query these elements to ensure we have them
    const loginBtnEl = document.getElementById('login-btn');
    const registerBtnEl = document.getElementById('register-btn');

    console.log("Login button found:", !!loginBtnEl);
    console.log("Register button found:", !!registerBtnEl);

    if (loginBtnEl) {
        loginBtnEl.addEventListener('click', handleLogin);
        console.log("Added login button event listener");
    } else {
        console.error('Login button not found in the DOM');
    }

    if (registerBtnEl) {
        registerBtnEl.addEventListener('click', handleRegister);
        console.log("Added register button event listener");
    } else {
        console.error('Register button not found in the DOM');
    }

    // Navigation event listeners
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;

            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            contentPages.forEach(p => p.classList.remove('active'));
            document.getElementById(page).classList.add('active');

            if (page === 'nearby-page') {
                startLocationTracking();
                fetchNearbyUsers();
            } else if (page === 'posts-page') {
                fetchPosts();
            } else if (page === 'messages-page') {
                fetchConversations();
            }
        });
    });

    // Nearby page event listeners
    refreshLocationBtn.addEventListener('click', () => {
        startLocationTracking();
        fetchNearbyUsers();
    });

    // Posts page event listeners
    postImageUpload.addEventListener('change', handlePostImageUpload);
    submitPostBtn.addEventListener('click', handleSubmitPost);

    // Profile page event listeners
    profilePictureUpload.addEventListener('change', handleProfilePictureUpload);
    saveProfileBtn.addEventListener('click', handleSaveProfile);
    logoutBtn.addEventListener('click', handleLogout);

    // Dark mode toggle
    document.getElementById('dark-mode-toggle').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        darkModeToggle.innerHTML = document.body.classList.contains('dark-mode') 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';

        // Store preference in localStorage
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });

    // Check for dark mode preference on load
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Anonymous mode toggle
    document.getElementById('anonymous-mode-toggle').addEventListener('click', () => {
        toggleAnonymousMode();
    });

    // Profile menu dropdown toggle
    document.getElementById('profile-menu-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        const menuContent = document.getElementById('profile-menu-content');
        menuContent.classList.toggle('show');
    });

    // Close profile menu when clicking outside
    document.addEventListener('click', (e) => {
        const menuContent = document.getElementById('profile-menu-content');
        const menuToggle = document.getElementById('profile-menu-toggle');
        
        if (!menuToggle.contains(e.target) && !menuContent.contains(e.target)) {
            menuContent.classList.remove('show');
        }
    });

    // Interests event listeners
    addHobbyBtn.addEventListener('click', () => {
        const hobby = hobbyTagInput.value.trim();
        if (hobby) {
            addHobbyTag(hobby);
            hobbyTagInput.value = '';
            hobbyTagInput.focus();
        }
    });

    hobbyTagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const hobby = hobbyTagInput.value.trim();
            if (hobby) {
                addHobbyTag(hobby);
                hobbyTagInput.value = '';
            }
        }
    });

    // Chat interface event listeners
    backToMessagesBtn.addEventListener('click', () => {
        chatInterface.classList.add('hidden');
        // Show the navigation bar when exiting messages
        document.querySelector('.navigation-container').classList.remove('hidden');
        currentChatUserId = null;
    });

    sendMessageBtn.addEventListener('click', handleSendMessage);
    chatMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    viewProfileBtn.addEventListener('click', () => {
        showUserProfile(currentChatUserId);
    });

    // Modal event listeners
    acceptRequestBtn.addEventListener('click', () => handleRequestResponse('accepted'));
    rejectRequestBtn.addEventListener('click', () => handleRequestResponse('rejected'));
    closeProfileModalBtn.addEventListener('click', () => userProfileModal.classList.add('hidden'));
    // Add event listener for back button
    document.getElementById('back-to-screen-btn').addEventListener('click', () => userProfileModal.classList.add('hidden'));
    connectBtn.addEventListener('click', () => handleConnect(currentProfileUserId));
    messageBtn.addEventListener('click', () => {
        openChat(currentProfileUserId);
        userProfileModal.classList.add('hidden');
    });
    
    // Helper function to exit chat and show navigation
    function exitChat() {
        chatInterface.classList.add('hidden');
        document.querySelector('.navigation-container').classList.remove('hidden');
        currentChatUserId = null;
    }
}

// Auth Functions
async function handleLogin() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }

    // If we don't have a CSRF token, try to fetch it
    if (!csrfToken) {
        try {
            await fetchCSRFToken();
        } catch (error) {
            alert('Could not fetch security token. Please try refreshing the page.');
            return;
        }
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('userId', data.userId);
            fetchUserData(data.userId);
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error occurred');
        alert('An error occurred during login. Please try again.');
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const fullname = document.getElementById('register-fullname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    // Validate all required fields
    if (!username || !fullname || !email || !password || !confirmPassword) {
        alert('Please fill in all required fields');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }

    // Validate password match
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    // Validate password strength (at least 6 characters)
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }

    // If we don't have a CSRF token, try to fetch it
    if (!csrfToken) {
        try {
            await fetchCSRFToken();
        } catch (error) {
            alert('Could not fetch security token. Please try refreshing the page.');
            return;
        }
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                username,
                password,
                fullName: fullname,
                email
            })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('userId', data.userId);
            fetchUserData(data.userId);
            showToast('Success', 'Registration successful!');
        } else {
            alert(data.error || 'Registration failed. Please try again.');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('An error occurred during registration. Please try again.');
    }
}

// Helper function to fetch user info with verified status
async function fetchUserInfo(userId) {
    try {
        const response = await fetch(`/api/user/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            credentials: 'same-origin'
        });

        if (response.ok) {
            const userData = await response.json();
            // Ensure verified status is properly set
            if (userData.verified === undefined) {
                userData.verified = false;
            }
            return userData;
        } else {
            throw new Error(`Failed to fetch user info: ${response.status}`);
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
        throw error;
    }
}

// Enhanced user data fetching with retry logic
async function fetchUserData(userId) {
    let retries = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // Start with 1 second delay
    
    const fetchWithRetry = async () => {
        try {
            // Show loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'global-loader';
            loadingIndicator.innerHTML = `
                <div class="loader-content">
                    <i class="fas fa-circle-notch fa-spin"></i>
                    <p>Loading your profile...</p>
                    <p class="retry-text">${retries > 0 ? `Retry attempt ${retries}/${maxRetries}` : ''}</p>
                </div>
            `;
            document.body.appendChild(loadingIndicator);
            
            // Add a timeout to abort long-running requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
            
            const response = await fetch(`/api/profile`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache', // Prevent caching of user data
                    'X-Requested-With': 'XMLHttpRequest' // For CSRF protection
                },
                credentials: 'same-origin',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId); // Clear timeout if request completes
            
            // Remove loading indicator
            if (document.body.contains(loadingIndicator)) {
                document.body.removeChild(loadingIndicator);
            }
            
            if (response.ok) {
                // Cache control validations
                const etag = response.headers.get('ETag');
                
                const userData = await response.json();
                currentUser = userData;
                
                // Cache the user data with timestamp
                try {
                    const cacheData = {
                        data: userData,
                        timestamp: Date.now(),
                        etag: etag
                    };
                    localStorage.setItem('userCache', JSON.stringify(cacheData));
                } catch (e) {
                    console.warn('Failed to cache user data', e);
                }
                
                // Update UI and initialize modules in order of importance
                updateProfileUI(userData);
                showMainApp();
                
                // Initialize each service with small delays to prevent overloading
                setTimeout(() => setupSocketConnection(userId), 100);
                // Notification initialization is handled separately in the HTML
                setTimeout(() => startLocationTracking(), 500);
                setTimeout(() => fetchNearbyUsers(), 700);
                
                return true;
            } else {
                if (response.status === 401) {
                    // Session expired, show login page
                    localStorage.removeItem('userId');
                    showAuthPage();
                    showToast('Session Expired', 'Please log in again');
                } else if (response.status === 429) {
                    // Rate limited - wait longer before retry
                    showToast('Too Many Requests', 'Please wait a moment before trying again');
                    if (retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay * 3)); // Triple delay for rate limits
                        retries++;
                        return fetchWithRetry();
                    }
                } else {
                    try {
                        const error = await response.json();
                        showToast('Error', error.error || 'Failed to load your profile');
                    } catch (e) {
                        showToast('Error', 'Something went wrong. Please try again later.');
                    }
                }
                
                return false;
            }
        } catch (error) {
            // Remove loading indicator
            const loadingIndicator = document.querySelector('.global-loader');
            if (loadingIndicator) {
                document.body.removeChild(loadingIndicator);
            }
            
            // Handle different error types
            if (error.name === 'AbortError') {
                console.warn('Request timed out');
                showToast('Connection Timeout', 'Request took too long to complete');
            } else if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
                console.warn('Network error:', error);
                showToast('Network Error', 'Please check your internet connection');
            } else {
                console.error('Fetch error:', error);
                showToast('Error', 'Unable to connect to Zync servers');
            }
            
            // Try to load from cache if available
            try {
                const cachedData = JSON.parse(localStorage.getItem('userCache'));
                if (cachedData && cachedData.data && Date.now() - cachedData.timestamp < 3600000) { // 1 hour cache validity
                    showToast('Offline Mode', 'Using cached data');
                    currentUser = cachedData.data;
                    updateProfileUI(cachedData.data);
                    showMainApp();
                    return true;
                }
            } catch (e) {
                console.warn('Failed to load cached data', e);
            }
            
            // Retry logic for network errors
            if (retries < maxRetries) {
                retries++;
                // Exponential backoff
                const delay = retryDelay * Math.pow(2, retries - 1);
                showToast('Reconnecting', `Attempt ${retries} of ${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchWithRetry();
            } else {
                // Max retries reached
                showToast('Connection Failed', 'Please try again later');
                localStorage.removeItem('userId');
                showAuthPage();
                return false;
            }
        }
    };
    
    return fetchWithRetry();
}

// Enhanced Socket.IO connection with better loading strategy
function setupSocketConnection(userId) {
    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
        console.log('Socket.IO not available. Attempting to load...');
        
        // Use a more reliable loading approach
        return loadSocketIOScript()
            .then(() => {
                if (typeof io !== 'undefined') {
                    console.log('Socket.IO loaded successfully');
                    return initializeSocket(userId);
                } else {
                    throw new Error('Socket.IO failed to initialize');
                }
            })
            .catch(error => {
                console.error('Socket.IO loading failed:', error);
                showToast('Connection Warning', 'Using polling mode for real-time features.');
                return { reconnect: () => false, getStatus: () => ({ connected: false, authenticated: false }) };
            });
    } else {
        return Promise.resolve(initializeSocket(userId));
    }
}

function loadSocketIOScript() {
    return new Promise((resolve, reject) => {
        // Check if already loading
        if (window.socketIOLoading) {
            return window.socketIOLoading;
        }
        
        // Clean up any existing failed scripts
        const existingScripts = document.querySelectorAll('script[src*="socket.io"]');
        existingScripts.forEach(script => script.remove());
        
        // Get CDN URLs from config, with local server as first option
        const socketIOUrls = [
            '/socket.io/socket.io.js', // Try local server first
            ...(window.SOCKET_IO_CDN_URLS || [
                'https://cdn.socket.io/4.7.2/socket.io.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js',
                'https://unpkg.com/socket.io-client@4.7.2/dist/socket.io.min.js'
            ])
        ];
        
        let currentAttempt = 0;
        let resolved = false;
        
        function tryLoadFromUrl(urlIndex) {
            if (urlIndex >= socketIOUrls.length) {
                if (!resolved) {
                    resolved = true;
                    window.socketIOLoading = null;
                    reject(new Error('All Socket.IO CDN URLs failed to load'));
                }
                return;
            }
            
            const script = document.createElement('script');
            script.src = socketIOUrls[urlIndex];
            script.async = false;
            script.defer = false;
            
            console.log(`Attempting to load Socket.IO from: ${script.src}`);
            
            script.onload = () => {
                if (!resolved) {
                    // Give it time to initialize
                    setTimeout(() => {
                        if (typeof io !== 'undefined') {
                            resolved = true;
                            window.socketIOLoading = null;
                            console.log(`Socket.IO loaded successfully from: ${script.src}`);
                            resolve();
                        } else {
                            console.warn(`Socket.IO script loaded but io object not available from: ${script.src}`);
                            // Try next URL
                            script.remove();
                            tryLoadFromUrl(urlIndex + 1);
                        }
                    }, 100);
                }
            };
            
            script.onerror = () => {
                if (!resolved) {
                    console.warn(`Socket.IO script failed to load from: ${script.src}`);
                    script.remove();
                    // Try next URL
                    tryLoadFromUrl(urlIndex + 1);
                }
            };
            
            // Timeout for each attempt
            setTimeout(() => {
                if (!resolved && script.parentNode) {
                    console.warn(`Socket.IO loading timeout from: ${script.src}`);
                    script.remove();
                    tryLoadFromUrl(urlIndex + 1);
                }
            }, 5000); // 5 second timeout per URL
            
            document.head.appendChild(script);
        }
        
        window.socketIOLoading = { resolve, reject };
        tryLoadFromUrl(0);
        
        // Overall timeout after trying all URLs
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                window.socketIOLoading = null;
                reject(new Error('Socket.IO loading timeout - all URLs failed'));
            }
        }, 30000); // 30 second overall timeout
    });
}

function initializeSocket(userId) {
    
    // Track connection state
    const connectionState = {
        authenticated: false,
        reconnectCount: 0,
        lastHeartbeat: Date.now(),
        heartbeatInterval: null,
        statusIndicator: null
    };
    
    // Create status indicator
    if (!connectionState.statusIndicator) {
        connectionState.statusIndicator = document.createElement('div');
        connectionState.statusIndicator.className = 'connection-status-indicator';
        connectionState.statusIndicator.innerHTML = '<i class="fas fa-bolt"></i>';
        connectionState.statusIndicator.title = 'Connecting...';
        document.body.appendChild(connectionState.statusIndicator);
        
        // Initial style - disconnected
        connectionState.statusIndicator.classList.add('disconnected');
    }
    
    // Initialize socket with optimized settings
    socket = io({
        auth: {
            userId: userId,
            token: localStorage.getItem('socketToken') || 'none' // Additional security token
        },
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000, // Cap at 10 seconds
        randomizationFactor: 0.5,
        timeout: 15000,
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        upgrade: true, // Upgrade from polling to WebSocket when possible
        withCredentials: true // Send cookies for authenticated connections
    });

    // Setup connection listeners
    socket.on('connect', () => {
        console.log("Socket connected successfully with ID:", socket.id);
        
        // Update status indicator
        if (connectionState.statusIndicator) {
            connectionState.statusIndicator.classList.remove('disconnected');
            connectionState.statusIndicator.classList.add('connecting');
            connectionState.statusIndicator.title = 'Authenticating...';
        }

        // Reset reconnect count on successful connection
        connectionState.reconnectCount = 0;
        
        // Generate a new authentication token if needed
        if (!localStorage.getItem('socketToken')) {
            const randomToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem('socketToken', randomToken);
        }

        // Authenticate with the server with retry mechanism
        let authAttempts = 0;
        const maxAuthAttempts = 3;
        
        const attemptAuth = () => {
            authAttempts++;
            console.log(`Attempting socket authentication (attempt ${authAttempts}/${maxAuthAttempts})`);
            socket.emit('authenticate', userId);
        };
        
        attemptAuth();
        
        // Verify authentication with timeout
        const authTimeout = setTimeout(() => {
            if (!connectionState.authenticated) {
                console.warn(`Socket authentication timed out (attempt ${authAttempts}/${maxAuthAttempts})`);
                if (authAttempts < maxAuthAttempts) {
                    attemptAuth();
                } else {
                    console.error('Socket authentication failed after maximum attempts');
                    socket.disconnect().connect(); // Force reconnection
                }
            }
        }, 5000);

        // Setup heartbeat to detect dropped connections
        if (connectionState.heartbeatInterval) {
            clearInterval(connectionState.heartbeatInterval);
        }
        
        connectionState.heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('ping', { timestamp: Date.now() }, (response) => {
                    if (response && response.status === 'ok') {
                        connectionState.lastHeartbeat = Date.now();
                        
                        // Update status indicator once confirmed working
                        if (connectionState.statusIndicator && connectionState.authenticated) {
                            connectionState.statusIndicator.classList.remove('connecting', 'disconnected');
                            connectionState.statusIndicator.classList.add('connected');
                            connectionState.statusIndicator.title = 'Connected';
                            
                            // Fade out indicator after 5 seconds
                            setTimeout(() => {
                                if (connectionState.statusIndicator) {
                                    connectionState.statusIndicator.classList.add('fade-out');
                                }
                            }, 5000);
                        }
                    }
                });
                
                // Check if heartbeat is stale (30 seconds without response)
                if (Date.now() - connectionState.lastHeartbeat > 30000) {
                    console.warn('Heartbeat timeout detected, reconnecting socket');
                    socket.disconnect().connect();
                }
            }
        }, 15000); // Check every 15 seconds
        
        // Listen for authentication responses
        socket.on('auth_success', (data) => {
            clearTimeout(authTimeout);
            console.log("Socket authentication successful:", data);
            connectionState.authenticated = true;
            
            // Update status indicator
            if (connectionState.statusIndicator) {
                connectionState.statusIndicator.classList.remove('connecting', 'disconnected');
                connectionState.statusIndicator.classList.add('connected');
                connectionState.statusIndicator.title = 'Connected';
            }
            
            // Check for pending requests after successful connection
            checkPendingRequests();
        });

        socket.on('auth_error', (error) => {
            clearTimeout(authTimeout);
            console.error("Socket authentication failed:", error);
            connectionState.authenticated = false;
            
            if (connectionState.statusIndicator) {
                connectionState.statusIndicator.classList.remove('connecting', 'connected');
                connectionState.statusIndicator.classList.add('disconnected');
                connectionState.statusIndicator.title = 'Authentication failed: ' + error.error;
            }
        });

        // Admin warning handler
        socket.on('warning', (data) => {
            console.log('Received admin warning:', data);
            showAdminWarningModal(data.message, data.timestamp);
        });

        // Fallback authentication check
        setTimeout(() => {
            if (!connectionState.authenticated) {
                socket.emit('ping', {userId: userId}, (response) => {
                    if (response && response.status === 'ok') {
                        console.log("Socket authentication verified via ping");
                        connectionState.authenticated = true;
                        
                        // Update status indicator
                        if (connectionState.statusIndicator) {
                            connectionState.statusIndicator.classList.remove('connecting', 'disconnected');
                            connectionState.statusIndicator.classList.add('connected');
                            connectionState.statusIndicator.title = 'Connected';
                        }
                        
                        // Check for pending requests after successful connection
                        checkPendingRequests();
                    }
                });
            }
        }, 2000);
    });

    // Handle connection errors with exponential backoff
    socket.on('connect_error', (error) => {
        console.warn('Socket connection error:', error.message);
        
        // Update status indicator
        if (connectionState.statusIndicator) {
            connectionState.statusIndicator.classList.remove('connected', 'connecting');
            connectionState.statusIndicator.classList.add('disconnected');
            connectionState.statusIndicator.title = 'Connection error: ' + error.message;
            connectionState.statusIndicator.classList.remove('fade-out');
        }
        
        // Implement exponential backoff
        connectionState.reconnectCount++;
        
        // If too many failures, show a reconnect button
        if (connectionState.reconnectCount > 5 && !document.getElementById('socket-reconnect-btn')) {
            const reconnectBtn = document.createElement('button');
            reconnectBtn.id = 'socket-reconnect-btn';
            reconnectBtn.className = 'reconnect-button';
            reconnectBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Reconnect';
            reconnectBtn.title = 'Click to reconnect';
            reconnectBtn.addEventListener('click', () => {
                // Manual reconnection attempt
                if (socket) {
                    socket.disconnect().connect();
                    reconnectBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Connecting...';
                    setTimeout(() => {
                        if (document.body.contains(reconnectBtn)) {
                            document.body.removeChild(reconnectBtn);
                        }
                    }, 5000);
                }
            });
            document.body.appendChild(reconnectBtn);
        }
    });

    // Event handlers with improved reliability
    socket.on('new-request', (data) => {
        // Validate data
        if (!data || !data.fromUserId || !data.requestId) {
            console.error('Invalid request data received:', data);
            return;
        }
        
        // Add request ID check to prevent duplicates
        if (pendingConnectionRequests.some(req => req.requestId === data.requestId)) {
            console.log('Duplicate request received, ignoring');
            return;
        }

        // Show notification with improved UX
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('New Connection Request', {
                body: 'Someone wants to connect with you!',
                icon: '/favicon.ico',
                tag: `request-${data.requestId}`,
                requireInteraction: true
            });
            
            notification.onclick = () => {
                window.focus();
                showConnectionRequestModal(data.requestId, data.fromUserId);
            };
        } else {
            showToast('New Connection Request', 'Someone wants to connect with you!');
        }

        // Either show modal or add to queue
        if (!requestModal.classList.contains('hidden')) {
            pendingConnectionRequests.push({
                requestId: data.requestId,
                fromUserId: data.fromUserId,
                timestamp: Date.now()
            });
            savePendingRequestsToStorage();
        } else {
            showConnectionRequestModal(data.requestId, data.fromUserId);
        }
    });

    // Improved message handler with optimistic UI updates
    socket.on('new-message', (data) => {
        // Validate data
        if (!data || !data.fromUserId || !data.messageId || data.content === undefined) {
            console.error('Invalid message data received:', data);
            return;
        }
        
        // Create a unique ID for this message to prevent duplicates
        const messageKey = `msg_${data.messageId}`;
        
        // Check if we've already processed this message
        if (window.processedMessages && window.processedMessages.has(messageKey)) {
            console.log('Duplicate message received, ignoring:', messageKey);
            return;
        }
        
        // Mark message as processed
        if (!window.processedMessages) {
            window.processedMessages = new Set();
        }
        window.processedMessages.add(messageKey);
        
        // Limit the size of the processed messages set to avoid memory leaks
        if (window.processedMessages.size > 1000) {
            const iterator = window.processedMessages.values();
            window.processedMessages.delete(iterator.next().value);
        }

        // Handle message based on context
        if (currentChatUserId === data.fromUserId) {
            // In current chat - add message and play subtle sound
            addMessageToChat(data.fromUserId, data.content, 'received', new Date(), data.isAnonymous);
            
            // Play subtle notification sound
            const subtleSound = new Audio('/notification-sound.mp3');
            subtleSound.volume = 0.3;
            subtleSound.play().catch(e => console.log('Error playing sound:', e));
            
            // Mark as read immediately on server
            fetch('/api/mark-message-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ messageId: data.messageId })
            }).catch(err => console.warn('Failed to mark message as read:', err));
        } else {
            // Not in current chat - show notification
            showMessageNotification(data.fromUserId, data.content, data.messageId);
        }

        // Update conversations list if on messages page or cache the update for later
        if (document.getElementById('messages-page').classList.contains('active')) {
            fetchConversations();
        } else {
            // Mark conversation for refresh when user views messages
            window.conversationsNeedRefresh = true;
        }
    });

    // Enhanced disconnect handler
    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        
        // Update status indicator
        if (connectionState.statusIndicator) {
            connectionState.statusIndicator.classList.remove('connected', 'connecting');
            connectionState.statusIndicator.classList.add('disconnected');
            connectionState.statusIndicator.title = 'Disconnected: ' + reason;
            connectionState.statusIndicator.classList.remove('fade-out');
        }
        
        // Reset authenticated state
        connectionState.authenticated = false;

        // If manual disconnect, don't reconnect
        if (reason === 'io client disconnect' || reason === 'io server disconnect') {
            return;
        }

        // Implement smarter reconnection for dropped connections
        const backoffDelay = Math.min(1000 * Math.pow(1.5, connectionState.reconnectCount), 30000);
        
        setTimeout(() => {
            if (socket && !socket.connected) {
                console.log(`Attempting to reconnect socket (attempt ${connectionState.reconnectCount + 1})...`);
                
                // Check if network is available before attempting reconnection
                if (navigator.onLine) {
                    socket.connect();
                    
                    // Re-authenticate after reconnection
                    setTimeout(() => {
                        if (socket.connected && userId) {
                            socket.emit('authenticate', userId);
                        }
                    }, 500);
                } else {
                    // Browser reports offline, show offline indicator
                    showToast('Offline', 'Waiting for network connection');
                }
            }
        }, backoffDelay);
    });
    
    // Listen for network status changes
    window.addEventListener('online', () => {
        if (socket && !socket.connected) {
            showToast('Back Online', 'Reconnecting...');
            socket.connect();
            
            // Re-authenticate after reconnection
            setTimeout(() => {
                if (socket.connected && userId) {
                    socket.emit('authenticate', userId);
                }
            }, 500);
        }
    });
    
    window.addEventListener('offline', () => {
        showToast('Offline', 'Waiting for network connection');
    });
    
    // Enhanced cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
        // Socket cleanup
        if (socket && socket.connected) {
            socket.disconnect();
        }
        
        // Interval cleanup
        if (connectionState.heartbeatInterval) {
            clearInterval(connectionState.heartbeatInterval);
        }
        
        // Location tracking cleanup
        if (watchPositionId) {
            navigator.geolocation.clearWatch(watchPositionId);
        }
        
        // Observer cleanup
        if (nearbyObserver) nearbyObserver.disconnect();
        if (postsObserver) postsObserver.disconnect();
        if (conversationsObserver) conversationsObserver.disconnect();
        
        // Clear caches
        if (window.processedMessages) {
            window.processedMessages.clear();
        }
        
        // Clear timeouts
        if (searchTimeout) clearTimeout(searchTimeout);
        
        // Remove event listeners
        document.removeEventListener('click', document._globalClickHandler);
        document.removeEventListener('visibilitychange', document._visibilityChangeHandler);
    });
    
    return {
        // Expose methods for socket management
        reconnect: () => {
            if (socket) {
                socket.disconnect().connect();
                return true;
            }
            return false;
        },
        getStatus: () => ({
            connected: socket ? socket.connected : false,
            authenticated: connectionState.authenticated,
            reconnectCount: connectionState.reconnectCount,
            transportType: socket ? socket.io.engine.transport.name : 'none'
        })
    };
}

// Location Functions
function startLocationTracking() {
    if (navigator.geolocation) {
        locationStatusText.textContent = 'Location: Updating...';

        // Clear previous watch
        if (watchPositionId) {
            navigator.geolocation.clearWatch(watchPositionId);
        }

        // iOS-specific options
        const options = {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
            // Required for iOS 13+ to get accurate location
            requirePermit: true
        };

        // Get position once first for immediate update
        navigator.geolocation.getCurrentPosition(
            handlePositionUpdate,
            handleLocationError,
            options
        );

        // Then watch position for continuous updates
        watchPositionId = navigator.geolocation.watchPosition(
            handlePositionUpdate,
            handleLocationError,
            {
                ...options,
                maximumAge: 30000,
                timeout: 27000
            }
        );

        // iOS-specific permission check
        if (window.location.protocol !== 'https:') {
            showToast('Location Warning', 'Please use HTTPS for accurate location services');
        }
    } else {
        locationStatusText.textContent = 'Location: Not supported by browser';
        showToast('Error', 'Geolocation is not supported by this browser');
    }
}

// Track last fetch time to limit how frequently we update nearby users
let lastNearbyFetchTime = 0;
const NEARBY_FETCH_INTERVAL = 10000; // 10 seconds minimum between fetches

function handlePositionUpdate(position) {
    try {
        // Add some small random variation to coordinates to ensure different devices don't report identical values
        // This small jitter (up to ~2 meters) helps with testing nearby functionality
        const latitude = parseFloat(position.coords.latitude);
        const longitude = parseFloat(position.coords.longitude);

        if (isNaN(latitude) || isNaN(longitude) ||
            latitude < -90 || latitude > 90 || 
            longitude < -180 || longitude > 180) {
            locationStatusText.textContent = 'Location: Invalid coordinates received';
            console.error('Invalid coordinates:', position.coords);
            return;
        }

        // Don't add jitter every time - this causes flickering
        // Only use jitter when first setting up the position
        if (!currentPosition) {
            // Add tiny random jitter for testing (about 0-2 meters)
            // 0.00001 degrees is roughly 1 meter at the equator
            const jitter = 0.00002 * Math.random();
            const jitterDirection = Math.random() > 0.5 ? 1 : -1;

            currentPosition = {
                latitude: latitude + (jitter * jitterDirection),
                longitude: longitude + (jitter * jitterDirection)
            };
        } else {
            // Only update position if it's significantly different (> 10 meters)
            const lastLat = currentPosition.latitude;
            const lastLng = currentPosition.longitude;

            // Check if position has changed significantly
            const distanceChanged = calculateDistance(
                {latitude: latitude, longitude: longitude},
                {latitude: lastLat, longitude: lastLng}
            ) > 10;

            if (distanceChanged) {
                currentPosition = {
                    latitude: latitude,
                    longitude: longitude
                };
            }
        }

        locationStatusText.textContent = 'Location: Active';

        // Update location on server - but don't fetch nearby users every time
        updateLocation(latitude, longitude);

        // Only fetch nearby users if we're on the nearby page AND enough time has passed
        const now = Date.now();
        if (document.getElementById('nearby-page').classList.contains('active') && 
            (now - lastNearbyFetchTime > NEARBY_FETCH_INTERVAL)) {
            lastNearbyFetchTime = now;
            setTimeout(() => {
                fetchNearbyUsers();
            }, 500);
        }
    } catch (error) {
        console.error('Error processing location:', error);
        locationStatusText.textContent = 'Location: Error processing coordinates';
    }
}

function handleLocationError(error) {
    console.log("Geolocation error:", error);
    locationStatusText.textContent = 'Location: Error - ' + (error.message || 'Unknown error');

    // Handle permission denied error
    if (error && error.code === 1) {
        // Check if using Safari
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isSafari) {
            showPermissionPrompt('location', 
                'Safari requires location access to find nearby users. Please enable location services in your browser settings.');
        } else {
            showPermissionPrompt('location', 
                'Please enable location access to find nearby users.');
        }
    } 
    // Handle position unavailable error
    else if (error && error.code === 2) {
        showToast('Location Error', 'Unable to determine your location. Please check your device settings.');
    } 
    // Handle timeout error
    else if (error && error.code === 3) {
        showToast('Location Error', 'Location request timed out. Please try again.');
        
        // Add retry button
        const retryBtn = document.createElement('button');
        retryBtn.className = 'retry-location-btn';
        retryBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Retry Location';
        retryBtn.onclick = startLocationTracking;
        
        const nearbyList = document.getElementById('nearby-users-list');
        nearbyList.innerHTML = '';
        nearbyList.appendChild(retryBtn);
    } 
    // Handle other errors
    else {
        showToast('Location Error', 'There was a problem accessing your location. Please try again.');
    }
}

// Helper function to check permissions
async function checkLocationPermission() {
    try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'denied') {
            showPermissionPrompt('location', 
                'Location access is required to find nearby users. Please enable location services.');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking location permission:', error);
        return true; // Continue with regular flow if permissions API is not supported
    }
}

// Update startLocationTracking to use permission check
function startLocationTracking() {
    if (navigator.geolocation) {
        checkLocationPermission().then(permitted => {
            if (permitted) {
                locationStatusText.textContent = 'Location: Updating...';

                // Clear previous watch
                if (watchPositionId) {
                    navigator.geolocation.clearWatch(watchPositionId);
                }

                // Get position with high accuracy
                navigator.geolocation.getCurrentPosition(
                    handlePositionUpdate,
                    handleLocationError,
                    { 
                        enableHighAccuracy: true, 
                        timeout: 20000,
                        maximumAge: 0
                    }
                );

                // Watch position for updates
                watchPositionId = navigator.geolocation.watchPosition(
                    handlePositionUpdate,
                    handleLocationError,
                    {
                        enableHighAccuracy: true,
                        maximumAge: 30000,
                        timeout: 27000
                    }
                );
            }
        });
    } else {
        locationStatusText.textContent = 'Location: Not supported';
        showToast('Error', 'Geolocation is not supported by this browser');
    }
}

async function updateLocation(latitude, longitude) {
    try {
        // Parse coordinates to ensure they're valid numbers
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        // Validate coordinates before sending to server
        if (isNaN(lat) || isNaN(lng) || 
            lat < -90 || lat > 90 || 
            lng < -180 || lng > 180) {
            console.error('Invalid coordinates for server update:', { latitude, longitude });
            locationStatusText.textContent = 'Location: Invalid coordinates';
            return;
        }

        console.log('Sending location update:', { latitude: lat, longitude: lng });

        const response = await fetch('/api/location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({ latitude: lat, longitude: lng })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server rejected location update:', errorData);
            locationStatusText.textContent = 'Location: Update failed';
        } else {
            locationStatusText.textContent = 'Location: Active';
        }
    } catch (error) {
        console.error('Update location error:', error);
        locationStatusText.textContent = 'Location: Error updating';
    }
}

// Nearby Users Functions
async function fetchNearbyUsers() {
    try {
        // Make sure we have valid location data first
        if (!currentPosition || !currentPosition.latitude || !currentPosition.longitude) {
            nearbyUsersList.innerHTML = '<p>Location data is not available. Please enable location services and refresh your location.</p>' +
                                        '<button id="refresh-location-now-btn" class="primary-btn">Refresh Location Now</button>';

            document.getElementById('refresh-location-now-btn').addEventListener('click', () => {
                startLocationTracking();
            });
            return;
        }

        // Show optimized loading state
        nearbyUsersList.innerHTML = `
            <div class="nearby-loading">
                <div class="loading-spinner">
                    <i class="fas fa-circle-notch fa-spin"></i>
                </div>
                <p>Finding users nearby...</p>
                ${isAnonymousMode ? '<small>You are in anonymous mode</small>' : ''}
            </div>
        `;

        console.log('Fetching nearby users with position:', currentPosition);

        // Add cache-busting parameter to ensure fresh data after anonymous mode changes
        const cacheBuster = isAnonymousMode ? `?anonymous=${Date.now()}` : `?normal=${Date.now()}`;
        const response = await fetch(`/api/nearby${cacheBuster}`, {
            headers: {
                'Cache-Control': 'no-cache',
                'X-Anonymous-Mode': isAnonymousMode.toString()
            }
        });

        if (response.ok) {
            const users = await response.json();
            console.log(`Found ${users.length} nearby users:`, users);
            nearbyUsersData = users;
            renderNearbyUsers(users);
        } else {
            const error = await response.json();
            console.error('Fetch nearby users error:', error);

            // Handle specific error cases
            if (error.error === 'Invalid user location data') {
                nearbyUsersList.innerHTML = `<p>Your location data appears to be invalid. Please refresh your location.</p>
                                           <button id="reset-location-btn" class="primary-btn">Reset Location</button>`;

                document.getElementById('reset-location-btn').addEventListener('click', () => {
                    // Force location refresh
                    if (watchPositionId) {
                        navigator.geolocation.clearWatch(watchPositionId);
                        watchPositionId = null;
                    }
                    startLocationTracking();
                });
            } else {
                nearbyUsersList.innerHTML = `<p>Error fetching nearby users: ${error.error || 'Unknown error'}</p>
                                           <button id="retry-fetch-btn" class="primary-btn">Retry</button>`;

                document.getElementById('retry-fetch-btn').addEventListener('click', () => {
                    startLocationTracking();
                    fetchNearbyUsers();
                });
            }
        }
    } catch (error) {
        console.error('Fetch nearby users error:', error);
        nearbyUsersList.innerHTML = '<p>An error occurred while fetching nearby users. Please try again later.</p>' +
                                   '<button id="retry-fetch-error-btn" class="primary-btn">Retry</button>'+
                                   '<button id="force-location-btn" class="secondary-btn">Force Update Location</button>';

        document.getElementById('retry-fetch-error-btn').addEventListener('click', () => {
            fetchNearbyUsers();
        });

        document.getElementById('force-location-btn').addEventListener('click', () => {
            if (watchPositionId) {
                navigator.geolocation.clearWatch(watchPositionId);
                watchPositionId = null;
            }
            startLocationTracking();
            // Add a message showing current coordinates
            locationStatusText.textContent = `Location: Updating (Current: ${currentPosition ? 
                `Lat: ${currentPosition.latitude.toFixed(6)}, Lng: ${currentPosition.longitude.toFixed(6)}` : 
                'Unknown'})`;
        });
    }
}

function renderNearbyUsers(users) {
    nearbyUsersList.innerHTML = '';

    if (users.length === 0) {
        nearbyUsersList.innerHTML = '<p>No users nearby. Try again later.</p>';
        return;
    }

    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'user-card';

        // Check if user is anonymous and verified
        const isAnonymous = user.isAnonymous || false;
        const isVerified = !isAnonymous && (user.verified === true);

        userElement.innerHTML = `
            <div class="user-picture ${isAnonymous ? 'anonymous' : ''} ${isVerified ? 'verified' : ''}">
                ${isAnonymous 
                    ? `<i class="fas fa-mask"></i>` 
                    : (user.profilePicture 
                        ? `<img src="${escapeHTML(user.profilePicture)}" alt="${escapeHTML(user.fullName || user.username)}">` 
                        : `<i class="fas fa-user"></i>`)}
            </div>
            <div class="user-info">
                <h4 class="user-name">
                    ${escapeHTML(isAnonymous ? 'Anonymous User' : (user.fullName || user.username))}
                    ${isVerified ? '<i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : ''}
                    ${isAnonymous ? '<span class="anonymous-indicator"><i class="fas fa-mask"></i></span>' : ''}
                </h4>
                <p class="user-distance">~${calculateDistance(currentPosition, user.lastLocation)} meters away</p>
            </div>
        `;

        userElement.addEventListener('click', () => {
            showUserProfile(user._id);
        });

        nearbyUsersList.appendChild(userElement);
    });
}

function calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return 'unknown';

    // Haversine formula to calculate distance between two points on Earth
    const R = 6371e3; // Earth radius in meters
    const φ1 = pos1.latitude * Math.PI / 180;
    const φ2 = pos2.latitude * Math.PI / 180;
    const Δφ = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const Δλ = (pos2.longitude - pos1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return Math.round(distance);
}

// Posts Functions
// Modern image processing with better compression and error handling
async function handlePostImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
        showToast('Invalid File', 'Please select a valid image file (JPEG, PNG, GIF, WebP)');
        postImageUpload.value = '';
        return;
    }

    // Check initial file size
    if (file.size > 10 * 1024 * 1024) { // 10MB initial limit
        showToast('File Too Large', 'Please select an image smaller than 10MB');
        postImageUpload.value = '';
        return;
    }

    // Show loading indicator
    postImagePreview.innerHTML = '<div class="loading-indicator"><i class="fas fa-circle-notch fa-spin"></i> Processing image...</div>';
    postImagePreview.classList.remove('hidden');

    try {
        // Create blob URL for preview
        const blobUrl = URL.createObjectURL(file);
        
        // Load image for dimension check
        const img = new Image();
        img.onload = async () => {
            try {
                // Calculate dimensions while maintaining aspect ratio
                let { width, height } = calculateAspectRatioFit(
                    img.width,
                    img.height,
                    2048, // Max width
                    2048  // Max height
                );

                // Create canvas for resizing
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob with quality control
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', 0.85);
                });

                // Convert blob to data URL
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Store the processed image data
                    imageDataUrl = reader.result;

                    // Create preview
                    const imgElement = document.createElement('img');
                    imgElement.src = imageDataUrl;
                    imgElement.alt = "Post Image";
                    imgElement.loading = "lazy";

                    const removeBtn = document.createElement('button');
                    removeBtn.className = "remove-image";
                    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                    removeBtn.setAttribute('aria-label', 'Remove image');

                    postImagePreview.innerHTML = '';
                    postImagePreview.appendChild(imgElement);
                    postImagePreview.appendChild(removeBtn);

                    removeBtn.onclick = (e) => {
                        e.stopPropagation();
                        postImagePreview.classList.add('hidden');
                        postImagePreview.innerHTML = '';
                        postImageUpload.value = '';
                        imageDataUrl = null;
                    };
                };
                reader.readAsDataURL(blob);
            } catch (error) {
                console.error('Error processing image:', error);
                showToast('Error', 'Failed to process image. Please try another.');
                postImagePreview.classList.add('hidden');
                postImagePreview.innerHTML = '';
                postImageUpload.value = '';
            }
        };

        img.onerror = () => {
            showToast('Error', 'Failed to load image. Please try another.');
            postImagePreview.classList.add('hidden');
            postImagePreview.innerHTML = '';
            postImageUpload.value = '';
        };

        img.src = blobUrl;
    } catch (error) {
        console.error('Error processing image:', error);
        showToast('Error', 'Failed to process image. Please try another.');
        postImagePreview.classList.add('hidden');
        postImagePreview.innerHTML = '';
        postImageUpload.value = '';
    }
}

// Helper function to calculate aspect ratio fit
function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
        width: Math.round(srcWidth * ratio),
        height: Math.round(srcHeight * ratio)
    };
}

// Helper function to read file as data URL with promise
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsDataURL(file);
    });
}

// Enhanced image compression with WebP support and progressive loading
async function compressImage(dataUrl, options = {}) {
    const { maxWidth = 1024, maxHeight = 1024, quality = 0.85 } = options;
    
    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            img.onload = function() {
                // Calculate optimal dimensions
                const { width, height } = calculateOptimalDimensions(img.width, img.height, maxWidth, maxHeight);
                
                // Create offscreen canvas for better performance
                const canvas = new OffscreenCanvas ? new OffscreenCanvas(width, height) : document.createElement('canvas');
                if (!canvas.width) {
                    canvas.width = width;
                    canvas.height = height;
                }
                
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Apply basic image filtering for better quality
                ctx.filter = 'contrast(1.1) brightness(1.02)';
                ctx.drawImage(img, 0, 0, width, height);
                
                // Determine best format and quality
                const supportsWebP = isWebPSupported();
                const format = supportsWebP ? 'image/webp' : 'image/jpeg';
                const finalQuality = supportsWebP ? quality + 0.05 : quality; // WebP can handle slightly higher quality
                
                if (canvas.convertToBlob) {
                    // Use modern blob API for better performance
                    canvas.convertToBlob({ type: format, quality: finalQuality })
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        })
                        .catch(reject);
                } else {
                    // Fallback to toDataURL
                    resolve(canvas.toDataURL(format, finalQuality));
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUrl;
        } catch (err) {
            reject(err);
        }
    });
}

function calculateOptimalDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    const aspectRatio = originalWidth / originalHeight;
    
    let width = originalWidth;
    let height = originalHeight;
    
    if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
    }
    
    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }
    
    return { width: Math.round(width), height: Math.round(height) };
}

function isWebPSupported() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

async function handleSubmitPost() {
    const content = newPostContent.value.trim();

    if (!content && !imageDataUrl) {
        alert('Please add some content or an image to your post');
        return;
    }

    // Disable button to prevent multiple submissions
    submitPostBtn.disabled = true;
    submitPostBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

    try {
        // Create post data object
        const postData = {
            content: content || ""
        };

        // Add image only if it exists, and check for valid data URL format
        if (imageDataUrl && typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:')) {
            // Compress the image to reduce payload size
            const compressedImage = await compressImage(imageDataUrl);
            postData.image = compressedImage;
        }

        // Send the request with proper error handling
        const response = await fetch('/api/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
            const responseData = await response.json();
            throw new Error(responseData.error || 'Server returned an error');
        }

        const responseData = await response.json();

        // Clear form
        newPostContent.value = '';
        postImageUpload.value = '';
        imageDataUrl = null;
        postImagePreview.classList.add('hidden');
        postImagePreview.innerHTML = '';

        // Refresh posts
        fetchPosts();        alert('Post created successfully!');
    } catch (error) {
        console.error('Submit post error:', error);
        alert('Error creating post: ' + (error.message || 'Unknown error. Pleasetry again later.'));
    } finally {
        // Re-enable button
        submitPostBtn.disabled = false;
        submitPostBtn.innerHTML = 'Post';
    }
}

// Function to compress image before uploading
async function compressImage(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            // Create canvas for compression
            const canvas = document.createElement('canvas');
            // Set max dimensions to 800x800 while maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            const maxSize = 800;

            if (width > height && width > maxSize) {
                height = (height / width) * maxSize;
                width = maxSize;
            } else if (height > width && height > maxSize) {
                width = (width / height) * maxSize;
                height = maxSize;
            }

            canvas.width = width;
            canvas.height = height;

            // Draw image on canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Get compressed data URL (lower quality for JPEG)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
            resolve(compressedDataUrl);
        };
        img.src = dataUrl;
    });
}

async function fetchPosts() {
    try {
        const response = await fetch('/api/posts');

        if (response.ok) {
            const posts = await response.json();
            renderPosts(posts);
        } else {
            const error = await response.json();
            console.error('Fetch posts error:', error);
        }
    } catch (error) {
        console.error('Fetch posts error:', error);
    }
}

function renderPosts(posts) {
    postsList.innerHTML = '';

    if (!posts || posts.length === 0) {
        postsList.innerHTML = '<p>No posts yet. Be the first to share something!</p>';
        return;
    }

    console.log(`Rendering ${posts.length} posts`);

    posts.forEach(post => {
        try {
            if (!post || !post._id) {
                console.error('Invalid post data:', post);
                return;
            }

            const postElement = document.createElement('div');
            postElement.className = 'post-card';
            postElement.dataset.postId = post._id;
            postElement.style.opacity = '1'; // Ensure post is fully visible
            
            const date = new Date(post.createdAt);
            const formattedDate = date.toLocaleString();

            // Check if current user has liked this post
            const isLiked = post.likes && Array.isArray(post.likes) && currentUser && 
                          post.likes.some(id => {
                              if (typeof id === 'string') return id === currentUser._id;
                              if (typeof id === 'object' && id._id) return id._id === currentUser._id;
                              return false;
                          });

            // Make sure we have valid counts
            const likesCount = post.likes && Array.isArray(post.likes) ? post.likes.length : 0;
            const commentsCount = post.comments && Array.isArray(post.comments) ? post.comments.length : 0;

            // Safely render comments with error handling
            let commentsHTML = '';
            if (post.comments && Array.isArray(post.comments)) {
                commentsHTML = post.comments.map(comment => {
                    try {
                        if (!comment) return '';

                        const commentUsername = comment.user ? 
                            (typeof comment.user === 'object' ? 
                                (comment.user.fullName || comment.user.username || 'Unknown User') : 
                                'Unknown User') : 
                            'Unknown User';

                        const commentTime = comment.timestamp ? 
                            new Date(comment.timestamp).toLocaleString() : 'Unknown time';

                        const commentUserVerified = comment.user && 
                            (typeof comment.user === 'object') && 
                            (comment.user.verified === true);

                        return `
                            <div class="post-comment" style="opacity: 1 !important;">
                                <div class="comment-user">
                                    ${commentUsername}
                                    ${commentUserVerified ? '<i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : ''}
                                </div>
                                <div class="comment-text">${comment.text || ''}</div>
                                <div class="comment-time">${commentTime}</div>
                            </div>
                        `;
                    } catch (err) {
                        console.error('Error rendering comment:', err);
                        return '';
                    }
                }).join('');
            }

            // Check if current user is the post creator
            const isPostCreator = currentUser && post.user && 
                (typeof post.user === 'object' ? post.user._id === currentUser._id : post.user === currentUser._id);

            // Create the post HTML - ensure we guard against null values
            // Create elements safely to prevent XSS
            const postContent = document.createElement('div');
            postContent.style.opacity = '1'; // Ensure content is fully visible
            
            // Check if post user is verified
            const postUserVerified = post.user && (post.user.verified === true);
            const postUserName = post.user ? (post.user.fullName || post.user.username || 'Unknown User') : 'Unknown User';
            
            postContent.innerHTML = `
                <div class="post-header" style="opacity: 1 !important;">
                    <div class="user-picture ${postUserVerified ? 'verified' : ''}" style="opacity: 1 !important;">
                        ${post.user && post.user.profilePicture 
                            ? `<img src="${escapeHTML(post.user.profilePicture)}" alt="${escapeHTML(postUserName)}" style="opacity: 1 !important;">` 
                            : `<i class="fas fa-user" style="opacity: 1 !important;"></i>`}
                    </div>
                    <div class="user-info" style="opacity: 1 !important;">
                        <div class="user-name" style="opacity: 1 !important;">
                            ${escapeHTML(postUserName)}
                            ${postUserVerified ? '<i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : ''}
                        </div>
                        <div class="post-timestamp" style="opacity: 1 !important;">${escapeHTML(formattedDate)}</div>
                    </div>
                    ${isPostCreator ? `<button class="delete-post-btn icon-btn" title="Delete post" style="opacity: 1 !important;"><i class="fas fa-trash"></i></button>` : ''}
                </div>`;

            // Add post content if exists (properly sanitized)
            if (post.content) {
                const contentDiv = document.createElement('div');
                contentDiv.className = 'post-content';
                contentDiv.style.opacity = '1';
                contentDiv.textContent = post.content; // Using textContent prevents XSS
                postContent.appendChild(contentDiv);
            }

            // Add post image if exists
            if (post.image) {
                if (post.image.startsWith('data:image/')) {
                    const img = document.createElement('img');
                    img.src = post.image;
                    img.alt = "Post image";
                    img.className = "post-image";
                    img.style.opacity = '1';
                    postContent.appendChild(img);
                }
            }

            postElement.innerHTML = postContent.innerHTML + `
                <div class="post-actions-bar" style="opacity: 1 !important;">
                    <div class="post-action like-action ${isLiked ? 'liked' : ''}" style="opacity: 1 !important;">
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart" style="opacity: 1 !important;"></i>
                        <span class="like-count" style="opacity: 1 !important;">${likesCount}</span>
                    </div>
                    <div class="post-action comment-action" style="opacity: 1 !important;">
                        <i class="far fa-comment" style="opacity: 1 !important;"></i>
                        <span style="opacity: 1 !important;">${commentsCount}</span>
                    </div>
                </div>
                <div class="post-comments-section ${commentsCount > 0 ? '' : 'hidden'}" style="opacity: 1 !important;">
                    <div class="post-comments" style="opacity: 1 !important;">
                        ${commentsHTML}
                    </div>
                    <div class="post-comment-form" style="opacity: 1 !important;">
                        <input type="text" class="comment-input" placeholder="Add a comment..." style="opacity: 1 !important;">
                        <button class="post-comment-btn" style="opacity: 1 !important;"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            `;

            // Add the post to the DOM first
            postsList.appendChild(postElement);
            
            // Apply full opacity via JavaScript to ensure it overrides any CSS
            postElement.style.opacity = '1';
            Array.from(postElement.querySelectorAll('*')).forEach(el => {
                el.style.opacity = '1';
            });

            // Now add event listeners

            // Like action
            const likeAction = postElement.querySelector('.like-action');
            if (likeAction) {
                likeAction.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Like clicked for post:', post._id);
                    handlePostLike(post._id, likeAction);
                });
            }

            // Comment action
            const commentAction = postElement.querySelector('.comment-action');
            const commentsSection = postElement.querySelector('.post-comments-section');
            if (commentAction && commentsSection) {
                commentAction.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    commentsSection.classList.toggle('hidden');
                });
            }

            // Delete post action
            const deleteBtn = postElement.querySelector('.delete-post-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
                        handleDeletePost(post._id, postElement);
                    }
                });
            }

            // Comment form
            const commentForm = postElement.querySelector('.post-comment-form');
            if (commentForm) {
                const commentInput = commentForm.querySelector('.comment-input');
                const commentBtn = commentForm.querySelector('.post-comment-btn');

                if (commentBtn && commentInput) {
                    commentBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const commentText = commentInput.value.trim();
                        if (commentText) {
                            console.log('Comment button clicked for post:', post._id);
                            handlePostComment(post._id, commentText, postElement);
                            commentInput.value = '';
                        }
                    });

                    commentInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const commentText = commentInput.value.trim();
                            if (commentText) {
                                console.log('Comment submitted via Enter for post:', post._id);
                                handlePostComment(post._id, commentText, postElement);
                                commentInput.value = '';
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error rendering post:', error, post);
        }
    });
}

async function handlePostLike(postId, likeElement) {
    try {
        // Disable the like button temporarily to prevent double-clicks
        likeElement.style.pointerEvents = 'none';

        const response = await fetch(`/api/post/${postId}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            credentials: 'include' // Use 'include' to ensure cookies are sent
        });

        if (response.ok) {
            const data = await response.json();

            // Update UI
            const likeCount = likeElement.querySelector('.like-count');
            const likeIcon = likeElement.querySelector('i');

            if (data.liked) {
                likeElement.classList.add('liked');
                likeIcon.classList.remove('far');
                likeIcon.classList.add('fas');
                likeCount.textContent = parseInt(likeCount.textContent || '0') + 1;
            } else {
                likeElement.classList.remove('liked');
                likeIcon.classList.remove('fas');
                likeIcon.classList.add('far');
                likeCount.textContent = Math.max(0, parseInt(likeCount.textContent || '0') - 1);
            }
        } else {
            console.error('Like post error status:', response.status);

            // Try to get error details
            let errorMsg = 'Failed to like post';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                // If we can't parse the JSON, use default message
                console.error('Error parsing JSON response:', e);
            }

            // Log full error details
            console.error('Like post error details:', { postId, status: response.status, message: errorMsg });

            // Check for specific error cases
            if (response.status === 401) {
                // If unauthorized, try to refresh the session
                fetchUserData(localStorage.getItem('userId'))
                    .then(() => alert('Session refreshed. Please try again.'))
                    .catch(() => {
                        alert('Your session has expired. Please log in again.');
                        showAuthPage();
                    });
            } else {
                alert(errorMsg);
            }
        }
    } catch (error) {
        console.error('Like post error:', error);
        alert('Error liking post. Please try again.');
    } finally {
        // Re-enable the like button
        setTimeout(() => {
            likeElement.style.pointerEvents = 'auto';
        }, 500);
    }
}

async function handlePostComment(postId, commentText, postElement) {
    if (!commentText.trim()) {
        alert('Please enter a comment');
        return;
    }

    try {
        // Disable the comment button temporarily
        const commentBtn = postElement.querySelector('.post-comment-btn');
        if (commentBtn) commentBtn.disabled = true;

        // Prepare the comment payload
        const payload = { text: commentText };

        console.log('Sending comment:', { postId, text: commentText });

        const response = await fetch(`/api/post/${postId}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            credentials: 'include', // Use 'include' to ensure cookies are sent
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('Comment posted successfully');

            // Update UI
            const commentsContainer = postElement.querySelector('.post-comments');
            const commentCount = postElement.querySelector('.comment-action span');

            if (commentsContainer && commentCount) {
                const commentElement = document.createElement('div');
                commentElement.className = 'post-comment';
                commentElement.innerHTML = `
                    <div class="comment-user">${currentUser.fullName || currentUser.username}</div>
                    <div class="comment-text">${commentText}</div>
                    <div class="comment-time">Just now</div>
                `;

                commentsContainer.appendChild(commentElement);
                const newCount = parseInt(commentCount.textContent || '0') + 1;
                commentCount.textContent = newCount;

                // Make sure the comments section is visible
                const commentsSection = postElement.querySelector('.post-comments-section');
                if (commentsSection) {
                    commentsSection.classList.remove('hidden');
                }
            }
        } else {
            console.error('Comment post error status:', response.status);

            // Try to get error details
            let errorMsg = 'Failed to post comment';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                // If we can't parse the JSON, use default message
                console.error('Error parsing JSON response:', e);
            }

            // Log full error details
            console.error('Comment post error details:', { postId, status: response.status, message: errorMsg });

            // Check for specific error cases
            if (response.status === 401) {
                // If unauthorized, try to refresh the session
                fetchUserData(localStorage.getItem('userId'))
                    .then(() => alert('Session refreshed. Please try again.'))
                    .catch(() => {
                        alert('Your session has expired. Please log in again.');
                        showAuthPage();
                    });
            } else {
                alert(errorMsg);
            }
        }
    } catch (error) {
        console.error('Comment post error:', error);
        alert('Error posting comment. Please try again.');
    } finally {
        // Re-enable the comment button
        const commentBtn = postElement.querySelector('.post-comment-btn');
        if (commentBtn) {
            setTimeout(() => {
                commentBtn.disabled = false;
            }, 500);
        }
    }
}

async function handleDeletePost(postId, postElement) {
    try {
        // Show loading state
        const deleteBtn = postElement.querySelector('.delete-post-btn');
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            deleteBtn.disabled = true;
        }

        console.log('Deleting post:', postId);

        const response = await fetch(`/api/post/${postId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            credentials: 'include' // Use 'include' to ensure cookies are sent
        });

        if (response.ok) {
            console.log('Post deleted successfully');

            // Animate the post removal with GSAP
            gsap.to(postElement, {
                opacity: 0,
                y: -20,
                duration: 0.3,
                onComplete: () => {
                    // Remove the post element from DOM
                    postElement.remove();

                    // If no posts left, show "no posts" message
                    if (document.querySelectorAll('.post-card').length === 0) {
                        postsList.innerHTML = '<p>No posts yet. Be the first to share something!</p>';
                    }
                }
            });
        } else {
            // Try to get error details
            let errorMsg = 'Failed to delete post';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                console.error('Error parsing JSON response:', e);
            }

            console.error('Delete post error details:', { postId, status: response.status, message: errorMsg });

            if (response.status === 401) {
                fetchUserData(localStorage.getItem('userId'))
                    .then(() => alert('Session refreshed. Please try again.'))
                    .catch(() => {
                        alert('Your session has expired. Please log in again.');
                        showAuthPage();
                    });
            } else {
                alert(errorMsg);
            }

            // Reset delete button
            if (deleteBtn) {
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.disabled = false;
            }
        }
    } catch (error) {
        console.error('Delete post error:', error);
        alert('Error deleting post. Please try again.');

        // Reset delete button
        const deleteBtn = postElement.querySelector('.delete-post-btn');
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.disabled = false;
        }
    }
}

// Messages and Chat Functions
async function fetchConversations() {
    try {
        const response = await fetch('/api/conversations');

        if (response.ok) {
            conversations = await response.json();
            
            // Sort conversations with priority:
            // 1. New connections (no messages yet) at the top
            // 2. Then by most recent message
            conversations.sort((a, b) => {
                // Check if these are new connections (no messages)
                const isNewA = !a.lastMessage;
                const isNewB = !b.lastMessage;
                
                // If one is new and the other isn't, prioritize the new one
                if (isNewA && !isNewB) return -1;
                if (!isNewA && isNewB) return 1;
                
                // If both are new or both have messages, sort by time
                const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp) : new Date();
                const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp) : new Date();
                return timeB - timeA;
            });
            
            // Store the original sorted conversations for filtering
            window.originalConversations = [...conversations];
            
            renderConversations(conversations);
            
            // Initialize search functionality after conversations are loaded
            initializeMessagesSearch();
        } else {
            const error = await response.json();
            console.error('Fetch conversations error:', error);
        }
    } catch (error) {
        console.error('Fetch conversations error:', error);
    }
}

// Initialize messages search functionality
function initializeMessagesSearch() {
    const searchInput = document.getElementById('messages-search-input');
    if (!searchInput) return;
    
    // Debounce function to limit search frequency
    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
    // Search function
    const searchConversations = debounce((query) => {
        // If no query, show all conversations
        if (!query || query.trim() === '') {
            if (window.originalConversations) {
                renderConversations(window.originalConversations);
            }
            return;
        }
        
        query = query.toLowerCase().trim();
        
        // Filter conversations based on search query
        const filteredConversations = (window.originalConversations || []).filter(convo => {
            // Search in username, fullName
            const username = convo.user.username ? convo.user.username.toLowerCase() : '';
            const fullName = convo.user.fullName ? convo.user.fullName.toLowerCase() : '';
            
            // Search in last message content if exists
            const lastMessageContent = convo.lastMessage?.content ? 
                convo.lastMessage.content.toLowerCase() : '';
            
            // Check if matches any field
            return username.includes(query) || 
                   fullName.includes(query) || 
                   lastMessageContent.includes(query);
        });
        
        // Render filtered conversations
        renderConversations(filteredConversations);
        
        // Show empty state if no results
        if (filteredConversations.length === 0) {
            const conversationsList = document.getElementById('conversations-list');
            if (conversationsList) {
                conversationsList.innerHTML = `
                    <div class="search-empty-state">
                        <i class="fas fa-search"></i>
                        <p>No conversations found for "${query}"</p>
                        <button class="clear-search-btn">Clear Search</button>
                    </div>
                `;
                
                // Add click handler for clear button
                const clearBtn = conversationsList.querySelector('.clear-search-btn');
                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        searchInput.value = '';
                        if (window.originalConversations) {
                            renderConversations(window.originalConversations);
                        }
                    });
                }
            }
        }
    }, 300); // 300ms debounce
    
    // Add input event listener
    searchInput.addEventListener('input', (e) => {
        searchConversations(e.target.value);
    });
    
    // Add clear button functionality if it exists
    const clearSearchBtn = document.querySelector('.messages-search .clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchConversations('');
        });
    }
}

// Function to format message time with smart display
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    // If less than 1 minute ago
    if (diffMins < 1) {
        return 'Just now';
    }
    
    // If less than 1 hour ago
    if (diffMins < 60) {
        return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    }
    
    // If less than 24 hours ago
    if (diffHours < 24) {
        // Use time format: 2:45 PM
        return messageDate.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
    }
    
    // If yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    
    // If within the last 7 days
    if (diffMs < 7 * 24 * 60 * 60 * 1000) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[messageDate.getDay()];
    }
    
    // Otherwise show date
    return messageDate.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

function renderConversations(conversations) {
    conversationsList.innerHTML = '';

    if (conversations.length === 0) {
        conversationsList.innerHTML = '<p>No conversations yet. Connect with users nearby to start chatting!</p>';
        return;
    }

    // Create fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Get current search query if any
    const searchQuery = document.getElementById('messages-search-input')?.value?.trim().toLowerCase() || '';
    
    // Process each conversation
    conversations.forEach(conversation => {
        const conversationElement = document.createElement('div');
        conversationElement.className = 'conversation-item';
        conversationElement.dataset.userId = conversation.user._id;

        // Check if this is a new connection (no messages)
        const isNewConnection = !conversation.lastMessage;
        if (isNewConnection) {
            conversationElement.classList.add('new-connection');
        }

        // Get last activity time
        let lastMessageTime = '';
        let lastMessageDate = null;
        if (conversation.lastMessage) {
            lastMessageDate = new Date(conversation.lastMessage.timestamp);
            // Format time intelligently based on how recent it is
            lastMessageTime = formatConversationTime(lastMessageDate);
        } else {
            // For new connections without messages, show "New" badge
            lastMessageTime = 'New';
        }

        // Check if user is anonymous
        const isAnonymous = conversation.user.isAnonymous || false;
        
        // Get display name and last message content
        const displayName = isAnonymous ? 'Anonymous User' : (conversation.user.fullName || conversation.user.username);
        const lastMessageContent = conversation.lastMessage ? conversation.lastMessage.content : 'New connection';
        
        // Apply highlighting if there's a search query
        let highlightedName = displayName;
        let highlightedLastMessage = lastMessageContent;
        
        if (searchQuery) {
            // Highlight name if not anonymous
            if (!isAnonymous) {
                highlightedName = highlightSearchMatch(displayName, searchQuery);
            }
            
            // Highlight last message content
            highlightedLastMessage = highlightSearchMatch(lastMessageContent, searchQuery);
        }

        // Check if user is verified
        const isVerified = !isAnonymous && (conversation.user.verified === true);

        conversationElement.innerHTML = `
            <div class="user-picture ${isAnonymous ? 'anonymous' : ''} ${isVerified ? 'verified' : ''}">
                ${isAnonymous 
                    ? `<i class="fas fa-mask"></i>` 
                    : (conversation.user.profilePicture 
                        ? `<img src="${escapeHTML(conversation.user.profilePicture)}" alt="${escapeHTML(displayName)}">` 
                        : `<i class="fas fa-user"></i>`)}
            </div>
            <div class="conversation-info">
                <div class="user-name">
                    ${highlightedName}
                    ${isVerified ? '<i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : ''}
                    ${isAnonymous ? '<span class="anonymous-indicator"><i class="fas fa-mask"></i></span>' : ''}
                    ${isNewConnection ? '<span class="new-connection-indicator">New</span>' : ''}
                </div>
                <div class="last-message ${conversation.lastMessage && !conversation.lastMessage.read ? 'unread' : ''}">${highlightedLastMessage}</div>
            </div>
            ${lastMessageTime 
                ? `<div class="message-time ${isNewConnection ? 'new-badge' : ''}">${lastMessageTime}</div>` 
                : ''}
            ${conversation.lastMessage && !conversation.lastMessage.read 
                ? '<div class="unread-badge"></div>' 
                : ''}
        `;

        conversationElement.addEventListener('click', () => {
            openChat(conversation.user._id);
        });

        fragment.appendChild(conversationElement);
    });
    
    // Append all conversations at once for better performance
    conversationsList.appendChild(fragment);
    
    // Add enhanced animation for new connections
    const items = conversationsList.querySelectorAll('.conversation-item');
    items.forEach((item, index) => {
        item.style.animationDelay = `${index * 30}ms`;
        item.classList.add('animate-in');
        
        // Add special animation for new connections
        if (item.classList.contains('new-connection')) {
            item.classList.add('highlight-new');
        }
    });
}

// Format message time for conversation list with smart display
function formatConversationTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    // If less than 1 minute ago
    if (diffMins < 1) {
        return 'Just now';
    }
    
    // If less than 1 hour ago
    if (diffMins < 60) {
        return `${diffMins}m`;
    }
    
    // If less than 24 hours ago
    if (diffHours < 24) {
        return `${diffHours}h`;
    }
    
    // If less than 7 days ago
    if (diffDays < 7) {
        return date.toLocaleDateString(undefined, {weekday: 'short'});
    }
    
    // Otherwise show date
    return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

// Helper function to highlight search matches
function highlightSearchMatch(text, query) {
    if (!query || !text) return text;
    
    // Escape the text to prevent XSS
    const safeText = escapeHTML(text);
    
    // If query is found in text, wrap it with highlight span
    const queryRegex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    return safeText.replace(queryRegex, '<span class="search-highlight">$1</span>');
}

// Helper function to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function openChat(userId) {
    currentChatUserId = userId;

    // Find user data
    const user = conversations.find(c => c.user._id === userId)?.user || 
                 nearbyUsersData.find(u => u._id === userId);

    if (user) {
        // Check if user is anonymous and verified
        const isAnonymous = user.isAnonymous || false;
        const isVerified = !isAnonymous && (user.verified === true);
        const displayName = isAnonymous ? 'Anonymous User' : (user.fullName || user.username);
        const verifiedBadge = isVerified ? ' <i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : '';
        
        chatUserName.innerHTML = `${escapeHTML(displayName)}${verifiedBadge}`;

        // Update chat header user picture with verified status
        const chatHeaderPicture = document.querySelector('.chat-header .user-picture');
        if (chatHeaderPicture) {
            if (isAnonymous) {
                chatHeaderPicture.innerHTML = '<i class="fas fa-mask"></i>';
                chatHeaderPicture.classList.add('anonymous');
                chatHeaderPicture.classList.remove('verified');
            } else {
                if (user.profilePicture) {
                    chatHeaderPicture.innerHTML = `<img src="${escapeHTML(user.profilePicture)}" alt="${escapeHTML(displayName)}">`;
                } else {
                    chatHeaderPicture.innerHTML = '<i class="fas fa-user"></i>';
                }
                chatHeaderPicture.classList.remove('anonymous');
                if (isVerified) {
                    chatHeaderPicture.classList.add('verified');
                } else {
                    chatHeaderPicture.classList.remove('verified');
                }
            }
        }

        // Update view profile button visibility
        if (isAnonymous) {
            viewProfileBtn.setAttribute('disabled', 'disabled');
            viewProfileBtn.title = "Profile hidden in anonymous mode";
        } else {
            viewProfileBtn.removeAttribute('disabled');
            viewProfileBtn.title = "View profile";
        }
    }

    // Clear chat messages
    chatMessages.innerHTML = '';

    // Show chat interface
    chatInterface.classList.remove('hidden');
    
    // Hide the navigation bar
    document.querySelector('.navigation-container').classList.add('hidden');
    
    // Reset any layout issues
    document.querySelector('.chat-input-container').style.position = 'sticky';
    
    // Focus the chat input field for immediate typing
    setTimeout(() => {
        chatMessageInput.focus();
    }, 300);

    // Fetch messages
    fetchMessages(userId);
}

// Function to render no messages state
function renderNoMessagesState() {
    chatMessages.innerHTML = `
        <div class="no-messages">
            <div class="no-messages-icon">
                <i class="fas fa-comment-dots"></i>
            </div>
            <div class="no-messages-title">No messages yet</div>
            <div class="no-messages-subtitle">Start the conversation!</div>
        </div>
    `;
    
    // Focus the chat input even when no messages
    setTimeout(() => {
        chatMessageInput.focus();
    }, 300);
}

async function fetchMessages(userId) {
    try {
        const response = await fetch(`/api/messages/${userId}`);

        if (response.ok) {
            const messages = await response.json();

            // Also fetch user info to check if they're anonymous
            const userResponse = await fetch(`/api/user/${userId}`);
            if (userResponse.ok) {
                const userData = await userResponse.json();
                renderMessages(messages, userData);
            } else {
                renderMessages(messages);
            }
        } else {
            console.error('Fetch messages error:', response.status);
            chatMessages.innerHTML = '<p class="no-messages">Error loading messages. Please try again.</p>';
        }
    } catch (error) {
        console.error('Fetch messages error:', error);
        chatMessages.innerHTML = '<p class="no-messages">Error loading messages. Please try again.</p>';
    }
}

function renderMessages(messages, userData = null) {
    chatMessages.innerHTML = '';

    if (messages.length === 0) {
        chatMessages.innerHTML = '<p class="no-messages">No messages yet. Start the conversation!</p>';
        // Focus the chat input even when no messages
        setTimeout(() => {
            chatMessageInput.focus();
        }, 300);
        return;
    }

    // Check if the user is anonymous
    const isAnonymous = userData && userData.isAnonymous;

    messages.forEach(message => {
        addMessageToChat(
            message.from, 
            message.content, 
            message.from === currentUser._id ? 'sent' : 'received',
            new Date(message.timestamp),
            isAnonymous && message.from !== currentUser._id // Only apply anonymous styling to received messages
        );
    });

    // Scroll to bottom and ensure input is visible
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatMessageInput.focus();
        
        // Reset any position issues with input container
        const inputContainer = document.querySelector('.chat-input-container');
        if (inputContainer) {
            inputContainer.style.position = 'sticky';
            inputContainer.style.bottom = '0';
        }
    }, 300);
}

function addMessageToChat(userId, content, type, timestamp = new Date(), isAnonymous = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;

    if (isAnonymous && type === 'received') {
        messageElement.classList.add('anonymous-message');
    }

    const formattedTime = timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    // Create message content based on type
    if (type === 'sent') {
        messageElement.innerHTML = `
            <div class="message-wrapper">
                <div class="message-bubble">${content}</div>
                <div class="message-time">
                    <span class="time-text">${formattedTime}</span>
                    <span class="message-status"><i class="fas fa-check"></i></span>
                </div>
            </div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="message-content-wrapper">
                <div class="message-bubble">${content}</div>
                <div class="message-time">
                    <span class="time-text">${formattedTime}</span>
                </div>
            </div>
        `;
    }

    chatMessages.appendChild(messageElement);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to mark messages as read
function markMessagesAsRead() {
    if (!currentChatUserId) return;
    
    // In a real app, this would make an API call to mark messages as read
    console.log(`Marking all messages from ${currentChatUserId} as read`);
    
    // For demonstration, we'll update the UI to show all messages as read
    document.querySelectorAll('.conversation-item').forEach(item => {
        if (item.dataset.userId === currentChatUserId) {
            item.classList.remove('unread');
            const unreadBadge = item.querySelector('.unread-badge');
            if (unreadBadge) {
                unreadBadge.remove();
            }
        }
    });
}

function addMessageToChat(userId, content, type, timestamp = new Date(), isAnonymous = false, isConsecutive = false, userProfilePicture = '', container = null, isLastMessage = false, readStatus = 'sent') {
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    
    if (isConsecutive) {
        messageElement.classList.add('consecutive');
    } else {
        messageElement.classList.add('new-group');
    }
    
    if (isAnonymous && type === 'received') {
        messageElement.classList.add('anonymous-message');
    }

    // Format time with smart display
    const formattedTime = formatMessageTime(timestamp);

    // Check if this is a message with an image (just a basic check for demonstration)
    const isImageMessage = content.startsWith('http') && 
        (content.endsWith('.jpg') || content.endsWith('.png') || content.endsWith('.gif'));
    
    if (isImageMessage) {
        messageElement.classList.add('image-message');
    }

    // Create message content based on type
    if (type === 'received') {
        // Add avatar for received messages (only for first in group)
        if (!isConsecutive) {
            const avatarElement = document.createElement('div');
            avatarElement.className = 'message-avatar';
            avatarElement.innerHTML = userProfilePicture;
            messageElement.appendChild(avatarElement);
        }
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';
        messageElement.appendChild(contentWrapper);
        
        // Create the message bubble
        const bubbleElement = document.createElement('div');
        bubbleElement.className = 'message-bubble';
        
        // Add message content (image or text)
        if (isImageMessage) {
            bubbleElement.innerHTML = `<img src="${content}" alt="Shared image">`;
        } else {
            bubbleElement.textContent = content;
            
            // Add anonymous indicator if needed
            if (isAnonymous) {
                const anonymousIndicator = document.createElement('div');
                anonymousIndicator.className = 'message-anonymous-indicator';
                anonymousIndicator.innerHTML = '<i class="fas fa-mask"></i>';
                bubbleElement.appendChild(anonymousIndicator);
            }
        }
        
        contentWrapper.appendChild(bubbleElement);
        
        // Add time with improved styling
        if (!isConsecutive || isLastMessage) {
            const timeElement = document.createElement('div');
            timeElement.className = 'message-time';
            timeElement.innerHTML = `
                <span class="time-text">${formattedTime}</span>
            `;
            contentWrapper.appendChild(timeElement);
        }
        
        // Reactions are now only added when explicitly triggered by user interaction
    } else {
        // For sent messages
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';
        
        // Create the message bubble
        const bubbleElement = document.createElement('div');
        bubbleElement.className = 'message-bubble';
        
        // Add message content (image or text)
        if (isImageMessage) {
            bubbleElement.innerHTML = `<img src="${content}" alt="Shared image">`;
        } else {
            bubbleElement.textContent = content;
        }
        
        messageWrapper.appendChild(bubbleElement);
        
        // Add time with improved styling
        if (!isConsecutive || isLastMessage) {
            const timeElement = document.createElement('div');
            timeElement.className = 'message-time';
            
            // Add read status indicators
            let statusIcon = '';
            if (readStatus === 'sent') {
                statusIcon = '<i class="fas fa-check"></i>';
            } else if (readStatus === 'delivered') {
                statusIcon = '<i class="fas fa-check-double"></i>';
            } else if (readStatus === 'read') {
                statusIcon = '<i class="fas fa-check-double seen"></i>';
            }
            
            timeElement.innerHTML = `
                <span class="time-text">${formattedTime}</span>
                <span class="message-status message-${readStatus}">${statusIcon}</span>
            `;
            messageWrapper.appendChild(timeElement);
        }
        
        // Add message menu for options
        const messageMenu = document.createElement('div');
        messageMenu.className = 'message-menu';
        messageMenu.innerHTML = `
            <button class="message-menu-btn">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="message-menu-dropdown">
                <div class="menu-item"><i class="fas fa-reply"></i> Reply</div>
                <div class="menu-item"><i class="fas fa-trash"></i> Delete</div>
                <div class="menu-item"><i class="fas fa-copy"></i> Copy</div>
            </div>
        `;
        messageWrapper.appendChild(messageMenu);
        
        // Add event listener for message menu
        messageMenu.querySelector('.message-menu-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            messageMenu.classList.toggle('active');
        });
        
        // Reactions will only be added through user interaction
        
        messageElement.appendChild(messageWrapper);
    }

    // Add to container or chat-messages
    if (container) {
        container.appendChild(messageElement);
    } else {
        chatMessages.appendChild(messageElement);
    }

    // Add context menu functionality for all messages
    messageElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageContextMenu(e, messageElement, type);
    });

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper function to format message time with smart display
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    // If less than 1 minute ago
    if (diffMins < 1) {
        return 'Just now';
    }
    
    // If less than 1 hour ago
    if (diffMins < 60) {
        return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    }
    
    // If less than 24 hours ago
    if (diffHours < 24) {
        // Use time format: 2:45 PM
        return messageDate.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
    }
    
    // If yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    
    // If within the last 7 days
    if (diffMs < 7 * 24 * 60 * 60 * 1000) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[messageDate.getDay()];
    }
    
    // Otherwise show date
    return messageDate.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

// Function to show context menu for messages
function showMessageContextMenu(event, messageElement, messageType) {
    // Remove existing context menus
    document.querySelectorAll('.message-context-menu').forEach(menu => {
        menu.remove();
    });
    
    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.className = 'message-context-menu';
    
    // Different options based on message type
    if (messageType === 'sent') {
        contextMenu.innerHTML = `
            <div class="menu-item"><i class="fas fa-reply"></i> Reply</div>
            <div class="menu-item"><i class="fas fa-edit"></i> Edit</div>
            <div class="menu-item"><i class="fas fa-trash"></i> Delete</div>
            <div class="menu-item"><i class="fas fa-copy"></i> Copy</div>
            <div class="menu-item"><i class="fas fa-forward"></i> Forward</div>
        `;
    } else {
        contextMenu.innerHTML = `
            <div class="menu-item"><i class="fas fa-reply"></i> Reply</div>
            <div class="menu-item"><i class="fas fa-copy"></i> Copy</div>
            <div class="menu-item"><i class="fas fa-forward"></i> Forward</div>
            <div class="menu-item"><i class="fas fa-info-circle"></i> Info</div>
        `;
    }
    
    // Position menu at click coordinates
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    
    // Add to body
    document.body.appendChild(contextMenu);
    
    // Check if menu is out of viewport and adjust position
    const menuRect = contextMenu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    if (menuRect.right > windowWidth) {
        contextMenu.style.left = `${windowWidth - menuRect.width - 10}px`;
    }
    
    if (menuRect.bottom > windowHeight) {
        contextMenu.style.top = `${windowHeight - menuRect.height - 10}px`;
    }
    
    // Add click handlers for menu items
    contextMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            // Handle menu actions (demonstration only)
            const action = item.textContent.trim();
            if (action.includes('Copy')) {
                const content = messageElement.querySelector('.message-bubble').textContent;
                navigator.clipboard.writeText(content)
                    .then(() => showToast('Copied', 'Message copied to clipboard'))
                    .catch(err => console.error('Could not copy text: ', err));
            } else if (action.includes('Delete')) {
                messageElement.classList.add('deleting');
                setTimeout(() => {
                    messageElement.remove();
                    showToast('Deleted', 'Message deleted');
                }, 300);
            } else {
                showToast('Action', `"${action}" selected`);
            }
            contextMenu.remove();
        });
    });
    
    // Close context menu when clicking elsewhere
    document.addEventListener('click', function closeContextMenu() {
        contextMenu.remove();
        document.removeEventListener('click', closeContextMenu);
    });
}

async function handleSendMessage() {
    const content = chatMessageInput.value.trim();

    if (!content || !currentChatUserId) {
        return;
    }

    // Clear the input field immediately for better UX
    chatMessageInput.value = '';

    // Show the message with 'sent' status before it's actually sent
    addMessageToChat(currentUser._id, content, 'sent', new Date(), false, false, '', null, true, 'sent');

    try {
        const response = await fetch('/api/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                toUserId: currentChatUserId,
                content
            })
        });

        if (response.ok) {
            // Message sent successfully - would normally update the status based on server response
            // For now, let's simulate status changes for better UX
            setTimeout(() => {
                const lastMessageBubble = chatMessages.querySelector('.message-sent:last-child .message-time .message-status');
                if (lastMessageBubble) {
                    lastMessageBubble.innerHTML = '<i class="fas fa-check-double"></i>';
                    lastMessageBubble.className = 'message-status message-delivered';
                }
                
                // Then after another delay, show as read for demo purposes
                setTimeout(() => {
                    if (lastMessageBubble) {
                        lastMessageBubble.innerHTML = '<i class="fas fa-check-double seen"></i>';
                        lastMessageBubble.className = 'message-status message-read';
                    }
                }, 2000);
            }, 1000);
            
            // Scroll to bottom to ensure the new message is visible
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            const error = await response.json();
            showToast('Error', error.error || 'Failed to send message');
            
            // Visual indication that message failed
            const lastMessage = chatMessages.querySelector('.message-sent:last-child');
            if (lastMessage) {
                const errorIndicator = document.createElement('div');
                errorIndicator.className = 'message-error-indicator';
                errorIndicator.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to send';
                lastMessage.appendChild(errorIndicator);
            }
        }
    } catch (error) {
        console.error('Send message error:', error);
        showToast('Error', 'An error occurred while sending your message');
        
        // Visual indication that message failed
        const lastMessage = chatMessages.querySelector('.message-sent:last-child');
        if (lastMessage) {
            const errorIndicator = document.createElement('div');
            errorIndicator.className = 'message-error-indicator';
            errorIndicator.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to send';
            lastMessage.appendChild(errorIndicator);
        }
    }
}

// Profile Functions
// Function to toggle anonymous mode
async function toggleAnonymousMode() {
    try {
        // Get current state before making request
        const wasAnonymous = isAnonymousMode;
        const newAnonymousMode = !wasAnonymous;
        
        // Immediately update UI for better UX (optimistic update)
        updateAnonymousModeUI(newAnonymousMode, true);
        
        // Show loading state
        const anonymousModeToggle = document.getElementById('anonymous-mode-toggle');
        const originalIcon = anonymousModeToggle.innerHTML;
        anonymousModeToggle.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        anonymousModeToggle.disabled = true;

        const response = await fetch('/api/toggle-anonymous', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            }
        });

        if (response.ok) {
            const data = await response.json();
            isAnonymousMode = data.anonymousMode;
            
            // Update current user immediately
            currentUser.anonymousMode = isAnonymousMode;
            currentUser.isAnonymous = isAnonymousMode;

            // Confirm UI state matches server response
            updateAnonymousModeUI(isAnonymousMode, false);

            // Show success notification
            showToast(
                isAnonymousMode ? 'Anonymous mode activated' : 'Anonymous mode deactivated',
                isAnonymousMode ? 'Your identity is now hidden from other users' : 'Your profile is now visible to other users'
            );

            // Immediately refresh all relevant data
            refreshAnonymousModeData();
            
        } else {
            // Revert optimistic update on error
            updateAnonymousModeUI(wasAnonymous, false);
            
            const error = await response.json();
            showToast('Error', error.error || 'Failed to toggle anonymous mode');
        }
    } catch (error) {
        console.error('Toggle anonymous mode error:', error);
        
        // Revert optimistic update on error
        updateAnonymousModeUI(wasAnonymous, false);
        showToast('Error', 'Network error while toggling anonymous mode');
    } finally {
        // Restore button state
        const anonymousModeToggle = document.getElementById('anonymous-mode-toggle');
        anonymousModeToggle.innerHTML = '<i class="fas fa-mask"></i>';
        anonymousModeToggle.disabled = false;
    }
}

// Helper function to update anonymous mode UI consistently
function updateAnonymousModeUI(anonymousMode, isOptimistic = false) {
    const anonymousModeToggle = document.getElementById('anonymous-mode-toggle');
    const anonymousBadge = document.querySelector('.anonymous-badge');
    
    if (anonymousMode) {
        anonymousModeToggle.classList.add('active');
        anonymousBadge.classList.remove('hidden');
        
        // Add visual feedback for optimistic update
        if (isOptimistic) {
            anonymousModeToggle.style.opacity = '0.7';
            anonymousBadge.style.opacity = '0.7';
        } else {
            anonymousModeToggle.style.opacity = '1';
            anonymousBadge.style.opacity = '1';
        }
    } else {
        anonymousModeToggle.classList.remove('active');
        anonymousBadge.classList.add('hidden');
        
        if (isOptimistic) {
            anonymousModeToggle.style.opacity = '0.7';
        } else {
            anonymousModeToggle.style.opacity = '1';
        }
    }
}

// Helper function to refresh all data affected by anonymous mode
function refreshAnonymousModeData() {
    // Update the current state
    isAnonymousMode = currentUser.anonymousMode;
    
    // Refresh nearby users immediately if on nearby page
    if (document.getElementById('nearby-page').classList.contains('active')) {
        fetchNearbyUsers();
    }
    
    // Refresh search results if there are any active searches
    if (!document.getElementById('search-results').classList.contains('hidden')) {
        // Clear cached users to force fresh data
        allUsers = [];
        localStorage.removeItem('cachedUsers');
        localStorage.removeItem('lastUsersFetch');
        
        // Re-fetch users with new anonymous state
        fetchAllUsers();
    }
    
    // Refresh conversations if on messages page
    if (document.getElementById('messages-page').classList.contains('active')) {
        fetchConversations();
    }
    
    // Refresh posts if on posts page
    if (document.getElementById('posts-page').classList.contains('active')) {
        fetchPosts();
    }
    
    // Update profile UI to reflect anonymous state
    updateProfileUIForAnonymousMode();
}

// Helper function to update profile UI based on anonymous mode
function updateProfileUIForAnonymousMode() {
    const profileName = document.getElementById('profile-name');
    const profileUsername = document.getElementById('profile-username');
    const profilePicture = document.getElementById('profile-picture');
    
    if (isAnonymousMode && currentUser) {
        // Store original data if not already stored
        if (!currentUser._originalData) {
            currentUser._originalData = {
                displayName: profileName.innerHTML,
                username: profileUsername.textContent,
                profilePicture: profilePicture.innerHTML
            };
        }
        
        // Show anonymous state in profile
        const anonymousOverlay = document.createElement('div');
        anonymousOverlay.className = 'anonymous-profile-overlay';
        anonymousOverlay.innerHTML = `
            <div class="anonymous-notice">
                <i class="fas fa-mask"></i>
                <span>Your profile appears as "Anonymous User" to others</span>
            </div>
        `;
        
        // Remove existing overlay if present
        const existingOverlay = document.querySelector('.anonymous-profile-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Add overlay to profile container
        const profileContainer = document.querySelector('.profile-container');
        if (profileContainer && !profileContainer.querySelector('.anonymous-profile-overlay')) {
            profileContainer.insertBefore(anonymousOverlay, profileContainer.firstChild);
        }
    } else {
        // Remove anonymous overlay when not in anonymous mode
        const anonymousOverlay = document.querySelector('.anonymous-profile-overlay');
        if (anonymousOverlay) {
            anonymousOverlay.remove();
        }
        
        // Restore original data if available
        if (currentUser && currentUser._originalData) {
            profileName.innerHTML = currentUser._originalData.displayName;
            profileUsername.textContent = currentUser._originalData.username;
            profilePicture.innerHTML = currentUser._originalData.profilePicture;
        }
    }
}

// Function to show admin warning modal
function showAdminWarningModal(message, timestamp) {
    console.log('Showing admin warning modal:', message);
    
    // Remove any existing warning modals
    const existingModals = document.querySelectorAll('.admin-warning-modal');
    existingModals.forEach(modal => modal.remove());
    
    // Create warning modal
    const warningModal = document.createElement('div');
    warningModal.className = 'admin-warning-modal';
    warningModal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content admin-warning-content">
            <div class="warning-header">
                <i class="fas fa-exclamation-triangle warning-icon"></i>
                <h3>Admin Warning</h3>
            </div>
            <div class="warning-body">
                <p class="warning-message">${escapeHTML(message)}</p>
                <div class="warning-timestamp">
                    <i class="fas fa-clock"></i>
                    <span>${new Date(timestamp).toLocaleString()}</span>
                </div>
            </div>
            <div class="warning-actions">
                <button class="primary-btn" id="acknowledge-warning-btn">
                    <i class="fas fa-check"></i>
                    Acknowledge
                </button>
            </div>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(warningModal);
    
    // Add event listener for acknowledge button
    const acknowledgeBtn = document.getElementById('acknowledge-warning-btn');
    acknowledgeBtn.addEventListener('click', () => {
        console.log('Warning acknowledged by user');
        
        // Animate out the modal
        const modalContent = warningModal.querySelector('.modal-content');
        gsap.to(modalContent, {
            scale: 0.8,
            opacity: 0,
            duration: 0.3,
            ease: "back.in(1.7)",
            onComplete: () => {
                warningModal.remove();
                showToast('Acknowledged', 'Warning has been acknowledged');
            }
        });
        
        gsap.to(warningModal.querySelector('.modal-overlay'), {
            opacity: 0,
            duration: 0.3
        });
    });
    
    // Close on overlay click
    warningModal.querySelector('.modal-overlay').addEventListener('click', () => {
        acknowledgeBtn.click();
    });
    
    // Animate in
    const modalContent = warningModal.querySelector('.modal-content');
    gsap.fromTo(modalContent, 
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" }
    );
    
    gsap.fromTo(warningModal.querySelector('.modal-overlay'),
        { opacity: 0 },
        { opacity: 1, duration: 0.3 }
    );
}

// Function to show toast notification
function showToast(title, message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Animate out and remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, duration);
}

function updateProfileUI(userData) {
    // Update profile information with verified badge
    const isVerified = userData.verified === true;
    const verifiedBadge = isVerified ? ' <i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : '';
    
    profileName.innerHTML = escapeHTML(userData.fullName || 'Set your name') + verifiedBadge;
    profileUsername.textContent = `@${userData.username}`;
    profileBioText.value = userData.bio || '';

    // Update anonymous mode UI
    isAnonymousMode = userData.anonymousMode || false;
    const anonymousModeToggle = document.getElementById('anonymous-mode-toggle');
    const anonymousBadge = document.querySelector('.anonymous-badge');

    if (isAnonymousMode) {
        anonymousModeToggle.classList.add('active');
        anonymousBadge.classList.remove('hidden');
    } else {
        anonymousModeToggle.classList.remove('active');
        anonymousBadge.classList.add('hidden');
    }

    // Update social profiles
    if (userData.socialProfiles) {
        instagramProfile.value = userData.socialProfiles.instagram || '';
        facebookProfile.value = userData.socialProfiles.facebook || '';
        twitterProfile.value = userData.socialProfiles.twitter || '';
        linkedinProfile.value = userData.socialProfiles.linkedin || '';
        snapchatProfile.value = userData.socialProfiles.snapchat || '';
        spotifyProfile.value = userData.socialProfiles.spotify || '';
    }

    // Update interests
    if (userData.interests) {
        // Render hobby tags
        hobbyTags.innerHTML = '';
        if (userData.interests.hobbies && userData.interests.hobbies.length > 0) {
            userData.interests.hobbies.forEach(hobby => {
                addHobbyTag(hobby);
            });
        }

        // Update top songs
        if (userData.interests.topSongs && userData.interests.topSongs.length > 0) {
            song1Input.value = userData.interests.topSongs[0] || '';
            song2Input.value = userData.interests.topSongs[1] || '';
            song3Input.value = userData.interests.topSongs[2] || '';
        }

        // Update about me
        aboutMeText.value = userData.interests.aboutMe || '';
    }

    // Update profile picture with verified status
    if (userData.profilePicture) {
        profilePicture.innerHTML = `<img src="${escapeHTML(userData.profilePicture)}" alt="${escapeHTML(userData.fullName || userData.username)}">`;
    }
    
    // Add verified class to profile picture if user is verified
    if (isVerified) {
        profilePicture.classList.add('verified');
    } else {
        profilePicture.classList.remove('verified');
    }
}

// Function to add a hobby tag to the UI
function addHobbyTag(hobby) {
    if (!hobby || hobby.trim() === '') return;

    const tag = document.createElement('div');
    tag.className = 'interest-tag';
    tag.dataset.hobby = hobby;

    tag.innerHTML = `
        <span>${hobby}</span>
        <button class="tag-remove-btn"><i class="fas fa-times"></i></button>
    `;

    // Add remove functionality
    tag.querySelector('.tag-remove-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        tag.remove();
    });

    hobbyTags.appendChild(tag);
}

async function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.type.match('image.*')) {
        alert('Please select an image file (JPEG, PNG, GIF, etc.).');
        return;
    }

    const reader = new FileReader();
reader.onload = (e) => {
        const imageDataUrl = e.target.result;
        showImageCropModal(imageDataUrl);
    };
    reader.readAsDataURL(file);
}

// Image cropping functionality
let cropperInstance = null;

function showImageCropModal(imageUrl) {
    // Create crop modal
    const cropModal = document.createElement('div');
    cropModal.className = 'crop-modal';

    cropModal.innerHTML = `
        <div class="crop-container">
            <img src="${imageUrl}" alt="Profile Picture" class="crop-img" id="crop-image">
        </div>
        <div class="crop-controls">
            <button class="icon-btn" id="rotate-left-btn" title="Rotate Left">
                <i class="fas fa-undo"></i>
            </button>
            <button class="icon-btn" id="rotate-right-btn" title="Rotate Right">
                <i class="fas fa-redo"></i>
            </button>
            <button class="icon-btn" id="zoom-in-btn" title="Zoom In">
                <i class="fas fa-search-plus"></i>
            </button>
            <button class="icon-btn" id="zoom-out-btn" title="Zoom Out">
                <i class="fas fa-search-minus"></i>
            </button>
        </div>
        <div class="crop-actions">
            <button class="secondary-btn" id="cancel-crop-btn">Cancel</button>
            <button class="primary-btn" id="apply-crop-btn">Apply</button>
        </div>
    `;

    document.body.appendChild(cropModal);

    // Initialize cropper
    const image = document.getElementById('crop-image');

    // Initialize Cropper.js with a square aspect ratio for profile pictures
    cropperInstance = new Cropper(image, {
        aspectRatio: 1,
        viewMode: 1,
        guides: true,
        autoCropArea: 0.8,
        responsive: true,
        background: false
    });

    // Set up event listeners
    document.getElementById('cancel-crop-btn').addEventListener('click', () => {
        cropperInstance.destroy();
        document.body.removeChild(cropModal);
        profilePictureUpload.value = '';
    });

    document.getElementById('apply-crop-btn').addEventListener('click', () => {
        applyCrop(cropModal);
    });

    // Set up crop control buttons
    document.getElementById('rotate-left-btn').addEventListener('click', () => {
        cropperInstance.rotate(-90);
    });

    document.getElementById('rotate-right-btn').addEventListener('click', () => {
        cropperInstance.rotate(90);
    });

    document.getElementById('zoom-in-btn').addEventListener('click', () => {
        cropperInstance.zoom(0.1);
    });

    document.getElementById('zoom-out-btn').addEventListener('click', () => {
        cropperInstance.zoom(-0.1);
    });
}

function applyCrop(cropModal) {
    try {
        // Make sure we have a valid cropper instance
        if (!cropperInstance) {
            console.error('Cropper instance is not available');
            return;
        }

        // Get the cropped canvas with proper settings
        const canvas = cropperInstance.getCroppedCanvas({
            width: 300,
            height: 300,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

        if (!canvas) {
            console.error('Failed to get cropped canvas');
            return;
        }

        // Convert to data URL with good quality
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

        // Update profile picture
        profilePicture.innerHTML = `<img src="${imageDataUrl}" alt="Profile Picture">`;

        // Store in current user data
        currentUser.profilePicture = imageDataUrl;

        // Clean up and close modal
        if (cropperInstance.destroy) {
            cropperInstance.destroy();
        }
        document.body.removeChild(cropModal);
        profilePictureUpload.value = '';

        // Automatically save profile to store the image in the database
        // This ensures the image persists after page refresh
        handleSaveProfile();
    } catch (error) {
        console.error('Error applying crop:', error);
        alert('There was an error processing your image. Please try again.');
        document.body.removeChild(cropModal);
        profilePictureUpload.value = '';
    }
}

async function handleSaveProfile() {
    try {
        // Get the profile picture from the current user object
        const profilePictureData = currentUser.profilePicture || '';

        // Collect all hobby tags
        const hobbies = Array.from(hobbyTags.querySelectorAll('.interest-tag')).map(tag => tag.dataset.hobby);

        // Collect top songs
        const topSongs = [
            song1Input.value.trim(),
            song2Input.value.trim(),
            song3Input.value.trim()
        ].filter(song => song !== ''); // Remove empty songs

        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                fullName: document.getElementById('profile-name').textContent,
                bio: profileBioText.value,
                profilePicture: profilePictureData,
                socialProfiles: {
                    instagram: instagramProfile.value,
                    facebook: facebookProfile.value,
                    twitter: twitterProfile.value,
                    linkedin: linkedinProfile.value,
                    snapchat: snapchatProfile.value,
                    spotify: spotifyProfile.value
                },
                interests: {
                    hobbies: hobbies,
                    topSongs: topSongs,
                    aboutMe: aboutMeText.value.trim()
                }
            })
        });

        if (response.ok) {
            // Update currentUser with the server response to ensure data consistency
            const updatedUser = await response.json();
            if (updatedUser.user) {
                currentUser = updatedUser.user;
            }

            // Show success animation
            const profileContainer = document.querySelector('.profile-container');
            if (profileContainer) {
                gsap.fromTo(
                    profileContainer,
                    { boxShadow: '0 0 0 3px rgba(108, 92, 231, 0.4)' },
                    { 
                        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.07)', 
                        duration: 1.5,
                        ease: "elastic.out(1, 0.3)"
                    }
                );
            }

            alert('Profile updated successfully');
        } else {
            const error = await response.json();
            alert(error.error);
        }
    } catch (error) {
        console.error('Save profile error:', error);
        alert('An error occurred while saving your profile');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { 
            method: 'POST',
            headers: {
                'CSRF-Token': csrfToken
            }
        });

        // Clear local storage and user data
        localStorage.removeItem('userId');
        localStorage.removeItem('pendingRequests'); // Clear pending requests on logout
        currentUser = null;

        // Disconnect socket
        if (socket) {
            socket.disconnect();
        }

        // Stop location tracking
        if (watchPositionId) {
            navigator.geolocation.clearWatch(watchPositionId);
            watchPositionId = null;
        }

        // Show auth page
        showAuthPage();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// User Profile Modal Functions
async function showUserProfile(userId) {
    currentProfileUserId = userId;

    try {
        const user = await fetchUserInfo(userId);

        // Check if user is anonymous and verified
        const isAnonymous = user.isAnonymous || false;
        const isVerified = !isAnonymous && (user.verified === true);

        // Update modal with user information
        const displayName = isAnonymous ? 'Anonymous User' : (user.fullName || user.username);
        const verifiedBadge = isVerified ? ' <i class="fas fa-check-circle verified-badge" title="Verified Account"></i>' : '';
        
        modalProfileName.innerHTML = escapeHTML(displayName) + verifiedBadge;
        modalProfileUsername.textContent = isAnonymous ? '@anonymous' : `@${user.username}`;
        modalProfileBio.textContent = isAnonymous ? 'This user is in anonymous mode' : (user.bio || 'No bio available');

        // Update profile picture
        if (isAnonymous) {
            modalProfilePicture.innerHTML = `<i class="fas fa-mask"></i>`;
            modalProfilePicture.classList.add('anonymous');
            modalProfilePicture.classList.remove('verified');
        } else if (user.profilePicture) {
            modalProfilePicture.innerHTML = `<img src="${escapeHTML(user.profilePicture)}" alt="${escapeHTML(user.fullName || user.username)}">`;
            modalProfilePicture.classList.remove('anonymous');
            if (isVerified) {
                modalProfilePicture.classList.add('verified');
            } else {
                modalProfilePicture.classList.remove('verified');
            }
        } else {
            modalProfilePicture.innerHTML = `<i class="fas fa-user"></i>`;
            modalProfilePicture.classList.remove('anonymous');
            if (isVerified) {
                modalProfilePicture.classList.add('verified');
            } else {
                modalProfilePicture.classList.remove('verified');
            }
        }

        // Update interests
        const modalInterests = document.getElementById('modal-interests');
        modalInterests.innerHTML = '';

        if (isAnonymous) {
            modalInterests.innerHTML = '<div class="modal-interests-empty">Hidden in anonymous mode</div>';
        } else if (user.interests && user.interests.hobbies && user.interests.hobbies.length > 0) {
            user.interests.hobbies.forEach(hobby => {
                const tag = document.createElement('div');
                tag.className = 'interest-tag';
                tag.innerHTML = `<span>${hobby}</span>`;
                modalInterests.appendChild(tag);
            });
        } else {
            modalInterests.innerHTML = '<div class="modal-interests-empty">No interests shared yet</div>';
        }

        // Update top songs
        const modalSongs = document.getElementById('modal-songs');
        modalSongs.innerHTML = '';

        if (isAnonymous) {
            modalSongs.innerHTML = '<div class="modal-songs-empty">Hidden in anonymous mode</div>';
        } else if (user.interests && user.interests.topSongs && user.interests.topSongs.length > 0) {
            user.interests.topSongs.forEach((song, index) => {
                if (song.trim() !== '') {
                    const songEl = document.createElement('div');
                    songEl.className = 'modal-song';
                    songEl.style.setProperty('--index', index);
                    songEl.innerHTML = `
                        <i class="fas fa-music"></i>
                        <span>${song}</span>
                    `;
                    modalSongs.appendChild(songEl);
                }
            });

            // If aboutMe is available, add it as a note
            if (user.interests.aboutMe && user.interests.aboutMe.trim() !== '') {
                const aboutSection = document.createElement('div');
                aboutSection.className = 'modal-about-me';
                aboutSection.innerHTML = `
                    <div class="modal-about-me-header">
                        <i class="fas fa-quote-left"></i>
                    </div>
                    <p>${user.interests.aboutMe}</p>
                `;
                modalSongs.appendChild(aboutSection);
            }
        } else {
            modalSongs.innerHTML = '<div class="modal-songs-empty">No favorite tracks shared yet</div>';
        }

        // Update social profiles
        modalSocialProfiles.innerHTML = '';

        if (isAnonymous) {
            modalSocialProfiles.innerHTML = '<p>Social profiles hidden in anonymous mode</p>';
        } else if (user.socialProfiles) {
            const socialIcons = {
                instagram: 'fab fa-instagram',
                facebook: 'fab fa-facebook',
                twitter: 'fab fa-twitter',
                linkedin: 'fab fa-linkedin',
                snapchat: 'fab fa-snapchat',
                spotify: 'fab fa-spotify'
            };

            for (const [platform, username] of Object.entries(user.socialProfiles)) {
                if (username) {
                    const socialItem = document.createElement('div');
                    socialItem.className = 'social-item';
                    socialItem.innerHTML = `
                        <i class="${socialIcons[platform]}"></i>
                        <span>${username}</span>
                    `;
                    modalSocialProfiles.appendChild(socialItem);
                }
            }

            if (modalSocialProfiles.children.length === 0) {
                modalSocialProfiles.innerHTML = '<p>No social profiles shared</p>';
            }
        } else {
            modalSocialProfiles.innerHTML = '<p>No social profiles shared</p>';
        }

        // Fetch and display user posts
        fetchAndDisplayUserPosts(userId, isAnonymous);

        // Check connection status
        const isConnected = await checkConnectionStatus(userId);

        if (isConnected) {
            connectBtn.classList.add('hidden');
            messageBtn.classList.remove('hidden');
        } else {
            connectBtn.classList.remove('hidden');
            messageBtn.classList.add('hidden');
        }

        // Reset scroll position to top
        const modalContent = userProfileModal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
        
        // Show modal with animation
        userProfileModal.classList.remove('hidden');

        // Animate the interests tags with staggered appearance
        const tags = userProfileModal.querySelectorAll('.interest-tag');
        gsap.fromTo(tags, 
            { scale: 0.8, opacity: 0 },
            { 
                scale: 1, 
                opacity: 1, 
                duration: 0.4, 
                stagger: 0.05,
                ease: "back.out(1.7)"
            }
        );
        
        // Highlight the modal sections with a subtle entrance animation
        const sections = userProfileModal.querySelectorAll('.modal-section');
        gsap.fromTo(sections, 
            { opacity: 0, y: 20 },
            { 
                opacity: 1, 
                y: 0, 
                duration: 0.4, 
                stagger: 0.1,
                ease: "power2.out"
            }
        );
    } catch (error) {
        console.error('Show user profile error:', error);
        alert('An error occurred while loading user profile');
    }
}

// Function to fetch and display a user's posts in their profile modal
async function fetchAndDisplayUserPosts(userId, isAnonymous) {
    const postsContainer = document.getElementById('modal-user-posts');
    postsContainer.innerHTML = '<div class="modal-posts-loading"><i class="fas fa-circle-notch fa-spin"></i><p>Loading posts...</p></div>';

    try {
        // If user is anonymous, show placeholder message
        if (isAnonymous && userId !== currentUser._id) {
            postsContainer.innerHTML = '<div class="modal-posts-empty">Posts hidden in anonymous mode</div>';
            return;
        }

        // Fetch user's posts
        const response = await fetch(`/api/user/${userId}/posts`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch user posts');
        }
        
        const posts = await response.json();
        
        // Display posts or empty message
        if (posts.length === 0) {
            postsContainer.innerHTML = '<div class="modal-posts-empty">No posts yet</div>';
            return;
        }
        
        // Clear loading message
        postsContainer.innerHTML = '';
        
        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Add each post to the container
        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.className = 'modal-post';
            
            const date = new Date(post.createdAt);
            const formattedDate = date.toLocaleString();
            
            // Build post HTML
            let postHTML = `
                <div class="modal-post-content">${post.content || ''}</div>
            `;
            
            // Add image if exists
            if (post.image) {
                postHTML += `<img src="${post.image}" alt="Post image" class="modal-post-image">`;
            }
            
            // Add post stats and timestamp
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
                </div>
                <div class="modal-post-timestamp">${formattedDate}</div>
            `;
            
            postElement.innerHTML = postHTML;
            fragment.appendChild(postElement);
        });
        
        // Add all posts to the container at once
        postsContainer.appendChild(fragment);
        
        // Animate posts with a staggered entrance
        const postElements = postsContainer.querySelectorAll('.modal-post');
        gsap.fromTo(postElements, 
            { y: 20, opacity: 0 },
            { 
                y: 0, 
                opacity: 1, 
                duration: 0.4, 
                stagger: 0.1,
                ease: "power1.out"
            }
        );
        
    } catch (error) {
        console.error('Error fetching user posts:', error);
        postsContainer.innerHTML = '<div class="modal-posts-empty">Error loading posts</div>';
    }
}

async function fetchUserInfo(userId) {
    // First check if user is in nearby users list
    const nearbyUser = nearbyUsersData.find(u => u._id === userId);
    if (nearbyUser) return nearbyUser;

    // If not, fetch from server
    try {
        const response = await fetch(`/api/user/${userId}`);

        if (response.ok) {
            return await response.json();
        } else {
            throw new Error('Failed to fetch user info');
        }
    } catch (error) {
        console.error('Fetch user info error:', error);
        throw error;
    }
}

async function checkConnectionStatus(userId) {
    try {
        const response = await fetch(`/api/connection-status/${userId}`, {
            headers: {
                'Cache-Control': 'no-cache',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        });

        if (response.ok) {
            const data = await response.json();
            return data.status === 'connected';
        }

        // Check for session expiration
        if (response.status === 401) {
            showToast('Session Expired', 'Please log in again');
            return false;
        }

        return false;
    } catch (error) {
        console.error('Check connection status error:', error);
        return false;
    }
}

async function handleConnect(userId) {
    try {
        // Update button state to show loading
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        connectBtn.disabled = true;
        
        const response = await fetch('/api/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                toUserId: userId
            })
        });

        if (response.ok) {
            // Update button with success state
            connectBtn.innerHTML = '<i class="fas fa-check"></i> Request Sent';
            connectBtn.classList.add('request-sent');
            
            // Show success toast
            showToast(
                'Connection Request Sent', 
                'They will be notified of your request'
            );
            
            // Create a quick animation burst
            const successBurst = document.createElement('div');
            successBurst.className = 'success-burst';
            successBurst.style.position = 'absolute';
            successBurst.style.top = '50%';
            successBurst.style.left = '50%';
            successBurst.style.transform = 'translate(-50%, -50%)';
            successBurst.style.pointerEvents = 'none';
            
            connectBtn.appendChild(successBurst);
            
            // Animate the success burst
            gsap.fromTo(successBurst,
                { 
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(108, 92, 231, 0.3)',
                    opacity: 1
                },
                { 
                    width: '200px',
                    height: '200px',
                    opacity: 0,
                    duration: 1,
                    ease: "power2.out",
                    onComplete: () => {
                        if (successBurst.parentNode) {
                            successBurst.parentNode.removeChild(successBurst);
                        }
                    }
                }
            );
        } else {
            const error = await response.json();
            
            // Handle existing requests more gracefully
            if (error.status === 'pending') {
                connectBtn.innerHTML = '<i class="fas fa-clock"></i> Pending';
                connectBtn.classList.add('request-pending');
                
                showToast('Request Already Sent', 'Your connection request is pending');
            } else if (error.status === 'accepted') {
                connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
                connectBtn.classList.add('connected');
                
                // Show message button
                messageBtn.classList.remove('hidden');
                
                showToast('Already Connected', 'You are already connected with this user');
            } else {
                // General error
                connectBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed';
                connectBtn.disabled = false;
                
                setTimeout(() => {
                    connectBtn.innerHTML = 'Connect';
                }, 3000);
                
                showToast('Error', error.error || 'Failed to send request');
            }
        }
    } catch (error) {
        console.error('Handle connect error:', error);
        
        // Reset button
        connectBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
        connectBtn.disabled = false;
        
        setTimeout(() => {
            connectBtn.innerHTML = 'Connect';
        }, 3000);
        
        showToast('Connection Error', 'Network error. Please try again.');
    }
}

async function handleRequestResponse(status) {
    try {
        // Show loading state
        const requestStatus = document.getElementById('request-status');
        const acceptBtn = document.getElementById('accept-request-btn');
        const rejectBtn = document.getElementById('reject-request-btn');
        
        // Disable buttons during processing
        acceptBtn.disabled = true;
        rejectBtn.disabled = true;
        
        // Show loader
        requestStatus.innerHTML = `
            <div class="request-loader">
                <i class="fas fa-circle-notch fa-spin"></i>
                <span>Processing response...</span>
            </div>
        `;
        
        const response = await fetch(`/api/request/${currentRequestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            // Show success message with animation
            requestStatus.innerHTML = `
                <div class="request-result success">
                    <i class="fas fa-check-circle"></i>
                    <span>${status === 'accepted' ? 'Connection accepted' : 'Request declined'}</span>
                </div>
            `;
            
            // Hide the buttons
            acceptBtn.classList.add('hidden');
            rejectBtn.classList.add('hidden');
            
            // Animate success message
            const result = requestStatus.querySelector('.request-result');
            gsap.fromTo(result,
                { y: -20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
            );
            
            // Auto close the modal after a delay
            setTimeout(() => {
                // Animate out the modal
                const modalContent = requestModal.querySelector('.modal-content');
                gsap.to(modalContent, {
                    y: -20, 
                    opacity: 0, 
                    duration: 0.3, 
                    onComplete: () => {
                        requestModal.classList.add('hidden');
                        modalContent.style.opacity = '';
                        modalContent.style.transform = '';
                        
                        // If on nearby page, refresh
                        if (status === 'accepted' && document.getElementById('nearby-page').classList.contains('active')) {
                            fetchNearbyUsers();
                        }
                        
                        // Check for more pending requests
                        setTimeout(checkPendingRequests, 300);
                    }
                });
            }, 1500);
            
            // Show toast notification instead of alert
            showToast(
                status === 'accepted' ? 'Connection Accepted' : 'Request Declined',
                status === 'accepted' ? 'You can now message this user' : 'The connection request was declined'
            );
            
        } else {
            // Show error message
            const error = await response.json();
            requestStatus.innerHTML = `
                <div class="request-result error">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${error.error || 'An error occurred'}</span>
                </div>
            `;
            
            // Re-enable buttons
            acceptBtn.disabled = false;
            rejectBtn.disabled = false;
            
            // Animate error message
            const result = requestStatus.querySelector('.request-result');
            gsap.fromTo(result,
                { y: -20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
            );
            
            console.error('Request response error:', error);
        }
    } catch (error) {
        console.error('Handle request response error:', error);
        
        // Show error in the modal
        const requestStatus = document.getElementById('request-status');
        requestStatus.innerHTML = `
            <div class="request-result error">
                <i class="fas fa-exclamation-circle"></i>
                <span>Network error. Please try again.</span>
            </div>
        `;
        
        // Re-enable buttons
        document.getElementById('accept-request-btn').disabled = false;
        document.getElementById('reject-request-btn').disabled = false;
    }
}

// UI Helper Functions
function showAuthPage() {
    authPage.classList.remove('hidden');
    mainApp.classList.add('hidden');
}

function showMainApp() {
    authPage.classList.add('hidden');
    mainApp.classList.remove('hidden');
}

function showMessageNotification(userId, message) {
    // You can implement a notification system here
    // For simplicity, we'll just use a browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        fetchUserInfo(userId).then(user => {
            const senderName = user.isAnonymous ? 'Anonymous User' : (user.fullName || user.username);
            new Notification(`New message from ${senderName}`, {
                body: message
            });
        });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                fetchUserInfo(userId).then(user => {
                    const senderName = user.isAnonymous ? 'Anonymous User' : (user.fullName || user.username);
                    new Notification(`New message from ${senderName}`, {
                        body: message
                    });
                });
            }
        });
    }
}

// Helper function to add CSRF token to fetch options
function addCSRFToken(options = {}) {
    if (!options.headers) {
        options.headers = {};
    }

    if (csrfToken) {
        options.headers['CSRF-Token'] = csrfToken;
    }

    return options;
}

// Setup forgot password functionality
function setupForgotPassword() {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const closeForgotPasswordModal = document.getElementById('close-forgot-password-modal');
    const sendResetBtn = document.getElementById('send-reset-btn');
    const forgotEmail = document.getElementById('forgot-email');
    const messageContainer = document.getElementById('forgot-password-message');
    
    // Show forgot password modal
    forgotPasswordLink?.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.classList.remove('hidden');
        forgotEmail.focus();
    });
    
    // Close forgot password modal
    closeForgotPasswordModal?.addEventListener('click', () => {
        forgotPasswordModal.classList.add('hidden');
        forgotEmail.value = '';
        messageContainer.classList.add('hidden');
        messageContainer.textContent = '';
    });
    
    // Handle forgot password form submission
    sendResetBtn?.addEventListener('click', handleForgotPassword);
    forgotEmail?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleForgotPassword();
        }
    });
}

async function handleForgotPassword() {
    const forgotEmail = document.getElementById('forgot-email');
    const sendResetBtn = document.getElementById('send-reset-btn');
    const messageContainer = document.getElementById('forgot-password-message');
    
    const email = forgotEmail.value.trim();
    
    if (!email) {
        showForgotPasswordMessage('Please enter your email address', 'error');
        return;
    }
    
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        showForgotPasswordMessage('Please enter a valid email address', 'error');
        return;
    }
    
    // Update button state
    sendResetBtn.disabled = true;
    sendResetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    try {
        const response = await fetch('/api/reset-password-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showForgotPasswordMessage(data.message, 'success');
            forgotEmail.value = '';
            
            // Show spam folder reminder dialog
            showSpamFolderReminderDialog();
        } else {
            showForgotPasswordMessage(data.error || 'An error occurred', 'error');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showForgotPasswordMessage('Network error. Please try again.', 'error');
    } finally {
        // Reset button state
        sendResetBtn.disabled = false;
        sendResetBtn.innerHTML = '<span>Send Reset Link</span><i class="fas fa-paper-plane"></i>';
    }
}

function showForgotPasswordMessage(message, type) {
    const messageContainer = document.getElementById('forgot-password-message');
    messageContainer.textContent = message;
    messageContainer.className = `forgot-password-message ${type}`;
    messageContainer.classList.remove('hidden');
}

function showSpamFolderReminderDialog() {
    // Create the dialog
    const dialog = document.createElement('div');
    dialog.className = 'spam-reminder-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
            <div class="dialog-header">
                <i class="fas fa-envelope-open-text"></i>
                <h3>Email Sent Successfully!</h3>
            </div>
            <div class="dialog-body">
                <p>We've sent a password reset link to your email address.</p>
                <div class="important-note">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Important:</strong> Please check your spam/junk folder if you don't see the email in your inbox within a few minutes.
                </div>
                <p>The reset link will expire in 1 hour for security purposes.</p>
            </div>
            <div class="dialog-actions">
                <button class="primary-btn" id="spam-dialog-ok">Got it!</button>
            </div>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(dialog);
    
    // Add event listener for OK button
    document.getElementById('spam-dialog-ok').addEventListener('click', () => {
        // Animate out
        const dialogContent = dialog.querySelector('.dialog-content');
        gsap.to(dialogContent, {
            scale: 0.8,
            opacity: 0,
            duration: 0.3,
            ease: "back.in(1.7)",
            onComplete: () => {
                document.body.removeChild(dialog);
            }
        });
        
        gsap.to(dialog.querySelector('.dialog-overlay'), {
            opacity: 0,
            duration: 0.3
        });
    });
    
    // Close on overlay click
    dialog.querySelector('.dialog-overlay').addEventListener('click', () => {
        document.getElementById('spam-dialog-ok').click();
    });
    
    // Animate in
    const dialogContent = dialog.querySelector('.dialog-content');
    gsap.fromTo(dialogContent, 
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" }
    );
    
    gsap.fromTo(dialog.querySelector('.dialog-overlay'),
        { opacity: 0 },
        { opacity: 1, duration: 0.3 }
    );
}

// Initialize the app when DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupUIEnhancements();
});

// Modern UI enhancements
function setupUIEnhancements() {
    // Tab animation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab === 'register') {
                document.querySelector('.tabs').classList.add('second-tab');
            } else {
                document.querySelector('.tabs').classList.remove('second-tab');
            }
        });
    });

    // Add animation to page transitions
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Animate the current page out
            const currentPage = document.querySelector('.content-page.active');
            if (currentPage) {
                gsap.to(currentPage, {
                    opacity: 0,
                    y: -20,
                    duration: 0.2,
                    onComplete: () => {
                        currentPage.classList.remove('active');
                        currentPage.style.opacity = '';
                        currentPage.style.transform = '';

                        // Animate the new page in
                        const newPage = document.getElementById(btn.dataset.page);
                        newPage.classList.add('active');
                        gsap.fromTo(newPage, 
                            { opacity: 0, y: 20 },
                            { opacity: 1, y: 0, duration: 0.3 }
                        );
                    }
                });
            }
        });
    });

    // Add hover animations to buttons
    document.querySelectorAll('.post-action, .icon-btn').forEach(btn => {
        btn.addEventListener('mouseenter', (e) => {
            gsap.to(btn, { y: -2, duration: 0.2 });
        });

        btn.addEventListener('mouseleave', (e) => {
            gsap.to(btn, { y: 0, duration: 0.2 });
        });
    });

    // Add ripple effect to buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function(e) {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ripple = document.createElement('span');
            ripple.style.position = 'absolute';
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            ripple.style.transform = 'translate(-50%, -50%) scale(0)';
            ripple.style.background = 'rgba(255, 255, 255, 0.3)';
            ripple.style.borderRadius = '50%';
            ripple.style.width = '0';
            ripple.style.height = '0';
            ripple.style.pointerEvents = 'none';

            button.appendChild(ripple);

            gsap.to(ripple, {
                width: button.offsetWidth * 2.5,
                height: button.offsetWidth * 2.5,
                opacity: 0,
                duration: 0.6,
                scale: 1,
                onComplete: () => {
                    if (ripple && ripple.parentNode) {
                        ripple.parentNode.removeChild(ripple);
                    }
                }
            });
        });
    });

    // Staggered animation for lists
    function animateStaggeredItems(container, items) {
        // Check if ScrollTrigger is available
        if (window.ScrollTrigger) {
            gsap.from(items, {
                y: 20,
                opacity: 0,
                stagger: 0.07,
                duration: 0.4,
                ease: "power1.out",
                scrollTrigger: {
                    trigger: container,
                    start: "top 80%"
                }
            });
        } else {
            // Fallback animation without ScrollTrigger
            gsap.from(items, {
                y: 20,
                opacity: 0,
                stagger: 0.07,
                duration: 0.4,
                ease: "power1.out"
            });
        }
    }

    // Observer for nearby users list
    const nearbyObserver = new MutationObserver(() => {
        const userCards = document.querySelectorAll('#nearby-users-list .user-card');
        if (userCards.length > 0) {
            animateStaggeredItems('#nearby-users-list', userCards);
        }
    });

    nearbyObserver.observe(document.getElementById('nearby-users-list'), { childList: true });

    // Observer for posts list
    const postsObserver = new MutationObserver(() => {
        const postCards = document.querySelectorAll('#posts-list .post-card');
        if (postCards.length > 0) {
            animateStaggeredItems('#posts-list', postCards);
        }
    });

    postsObserver.observe(document.getElementById('posts-list'), { childList: true });

    // Observer for conversations list
    const conversationsObserver = new MutationObserver(() => {
        const conversationItems = document.querySelectorAll('#conversations-list .conversation-item');
        if (conversationItems.length > 0) {
            animateStaggeredItems('#conversations-list', conversationItems);
        }
    });

    conversationsObserver.observe(document.getElementById('conversations-list'), { childList: true });

    // Animated like button
    document.addEventListener('click', (e) => {
        if (e.target.closest('.like-action')) {
            const likeBtn = e.target.closest('.like-action');
            const icon = likeBtn.querySelector('i');

            if (!likeBtn.classList.contains('liked')) {
                gsap.fromTo(icon, 
                    { scale: 0.5 },
                    { scale: 1.4, duration: 0.3, ease: "elastic.out(1.2, 0.5)" }
                );

                // Create heart particles
                for (let i = 0; i < 5; i++) {
                    createHeartParticle(likeBtn);
                }
            }
        }
    });

    function createHeartParticle(parent) {
        const particle = document.createElement('i');
        particle.className = 'fas fa-heart';
        particle.style.position = 'absolute';
        particle.style.color = '#e74c3c';
        particle.style.fontSize = '10px';
        particle.style.pointerEvents = 'none';
        particle.style.opacity = 0;

        // Random position around the button
        const parentRect = parent.getBoundingClientRect();
        const x = parentRect.width / 2;
        const y = parentRect.height / 2;

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        parent.appendChild(particle);

        // Animate the particle
        gsap.to(particle, {
            x: gsap.utils.random(-30, 30),
            y: gsap.utils.random(-40, -10),
            scale: gsap.utils.random(0.5, 1.5),
            rotation: gsap.utils.random(-30, 30),
            opacity: 1,
            duration: 0.3,
            onComplete: () => {
                gsap.to(particle, {
                    opacity: 0,
                    y: '-=20',
                    duration: 0.5,
                    onComplete: () => {
                        if (particle.parentNode) {
                            particle.parentNode.removeChild(particle);
                        }
                    }
                });
            }
        });
    }

    // We'll handle dark mode toggle in the profile section
}

// Function to check for pending requests
function checkPendingRequests() {
    if (pendingConnectionRequests.length > 0 && requestModal.classList.contains('hidden')) {
        // Show the oldest request first
        const nextRequest = pendingConnectionRequests[0];
        showConnectionRequestModal(nextRequest.requestId, nextRequest.fromUserId);
    }
}