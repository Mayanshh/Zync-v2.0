
// Auth module
export class AuthModule {
  constructor() {
    this.csrfToken = null;
  }

  async fetchCSRFToken() {
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error('Error fetching security token');
      throw error;
    }
  }

  async login(username, password) {
    if (!this.csrfToken) {
      await this.fetchCSRFToken();
    }

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': this.csrfToken
      },
      body: JSON.stringify({ username, password })
    });

    return response;
  }

  async register(userData) {
    if (!this.csrfToken) {
      await this.fetchCSRFToken();
    }

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CSRF-Token': this.csrfToken
      },
      body: JSON.stringify(userData)
    });

    return response;
  }
}
