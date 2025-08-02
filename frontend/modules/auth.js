
// Auth module
export class AuthModule {
  constructor() {
    this.csrfToken = null;
  }

  async fetchCSRFToken() {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error('Error fetching security token:', error);
      throw error;
    }
  }

  async apiRequest(url, options = {}) {
    // Add CSRF token automatically for non-GET requests
    if (!options.method || options.method.toUpperCase() !== 'GET') {
      if (!this.csrfToken) {
        await this.fetchCSRFToken();
      }
      
      if (!options.headers) {
        options.headers = {};
      }
      options.headers['CSRF-Token'] = this.csrfToken;
    }
    
    // Ensure credentials are included
    options.credentials = 'same-origin';
    
    try {
      const response = await fetch(url, options);
      
      // If CSRF token is invalid, try to refetch it once
      if (response.status === 403 && response.statusText.includes('CSRF')) {
        console.log('CSRF token expired, refetching...');
        await this.fetchCSRFToken();
        
        // Retry the request with new token
        if (!options.method || options.method.toUpperCase() !== 'GET') {
          options.headers['CSRF-Token'] = this.csrfToken;
        }
        return await fetch(url, options);
      }
      
      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async login(username, password) {
    return await this.apiRequest('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
  }

  async register(userData) {
    return await this.apiRequest('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
  }
}
