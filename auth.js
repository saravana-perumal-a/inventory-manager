// public/js/auth.js - Authentication Flow

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      
      const originalText = submitBtn.innerText;
      submitBtn.innerText = 'Signing in...';
      submitBtn.disabled = true;

      try {
        const data = await api.post('/auth/login', { email, password });
        
        if (data && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          showToast('Login successful!');
          
          // Switch view
          initApp();
        }
      } catch (error) {
        // Error already handled by api.js toast
      } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.hash = ''; // Clear hash
      initApp(); // Re-evaluate state
    });
  }
});
