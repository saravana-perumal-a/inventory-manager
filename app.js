// public/js/app.js - SPA Routing and App Initialization

const appState = {
  currentView: ''
};

// Start logic
function initApp() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  const authView = document.getElementById('auth-view');
  const mainView = document.getElementById('main-view');
  
  if (!token || !userStr) {
    // Show login page
    authView.style.display = 'flex';
    mainView.style.display = 'none';
  } else {
    // Check role, set UI
    const user = JSON.parse(userStr);
    document.getElementById('user-name-display').innerText = user.name;
    
    authView.style.display = 'none';
    mainView.style.display = 'flex';
    
    // Fetch notifications
    fetchNotifications();

    // Hash routing
    handleRoute();
  }
}

// Simple Hash Router
function handleRoute() {
  const hash = window.location.hash.substring(1) || 'dashboard'; // Default to dashboard
  appState.currentView = hash;
  
  // Update sidebar active state
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.view === hash) {
      item.classList.add('active');
    }
  });

  // Render view
  renderView(hash);
}

window.addEventListener('hashchange', handleRoute);

// View Renderer Mapping
const views = {
  dashboard: window.renderDashboard,
  products: window.renderProducts,
  orders: window.renderOrders,
  suppliers: window.renderSuppliers,
  inventory: async (container) => {
    let logs = [];
    try {
      logs = await api.get('/inventory-logs');
    } catch (e) {}

    const logRows = logs.length === 0
      ? `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No logs found yet.</td></tr>`
      : logs.map(l => {
          const isOut = l.type === 'Stock Out';
          const badgeClass = isOut ? 'status-danger' : 'status-success';
          const icon = isOut ? 'fa-arrow-up' : 'fa-arrow-down';
          const sign = isOut ? '-' : '+';
          const dateStr = new Date(l.date || l.createdAt).toLocaleString();
          
          return `
            <tr>
              <td>${dateStr}</td>
              <td><span class="status-badge ${badgeClass}"><i class="fa-solid ${icon}" style="margin-right:4px;"></i> ${l.type}</span></td>
              <td style="font-family: monospace; letter-spacing: 0.5px;">${l.sku}</td>
              <td style="font-weight:bold; color: ${isOut ? 'var(--danger)' : 'var(--success)'}">${sign}${l.quantityChanged}</td>
              <td>${l.user} <span style="display:block; color:var(--text-muted); font-size: 0.75rem;">${l.reason}</span></td>
            </tr>
          `;
        }).join('');

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Inventory Logs (Audit Trail)</h1>
        <div>
          <button class="btn btn-outline" style="margin-right: 0.5rem;"><i class="fa-solid fa-filter"></i> Filter</button>
          <button class="btn btn-primary"><i class="fa-solid fa-download"></i> Export</button>
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr><th>Date / Time</th><th>Type</th><th>Product SKU</th><th>Quantity</th><th>User / Reason</th></tr>
          </thead>
          <tbody>
            ${logRows}
          </tbody>
        </table>
      </div>
    `;
  },
  settings: window.renderSettings
};

async function renderView(viewName) {
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';
  
  try {
    const renderer = views[viewName] || views.dashboard;
    await renderer(contentArea);
  } catch (error) {
    console.error(error);
    contentArea.innerHTML = `<div class="card" style="border-color: var(--danger);"><h3 style="color:var(--danger)">Error loading view</h3><p>${error.message}</p></div>`;
  }
}

// UI Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Mobile Sidebar Toggle
  const toggleBtn = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  
  if(toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Sidebar navigation clicks
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      window.location.hash = item.dataset.view;
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
      }
    });
  });

  // Global Modal Close Logic
  const overlay = document.getElementById('global-modal');
  const closeBtn = document.getElementById('close-modal');
  const cancelBtn = document.getElementById('modal-cancel');
  
  const closeModal = () => overlay.classList.remove('active');
  
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Notifications Toggle
  const notifToggle = document.getElementById('notification-toggle');
  const notifDropdown = document.getElementById('notification-dropdown');
  if (notifToggle) {
    notifToggle.addEventListener('click', (e) => {
      // Prevent closing when clicking inside dropdown
      if (e.target.closest('#notification-dropdown') && e.target.id !== 'mark-notifications-read') return;
      if (notifDropdown.style.display === 'none') {
        notifDropdown.style.display = 'block';
      } else {
        notifDropdown.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!notifToggle.contains(e.target)) {
        notifDropdown.style.display = 'none';
      }
    });
  }

  const markRead = document.getElementById('mark-notifications-read');
  if (markRead) {
    markRead.addEventListener('click', async () => {
      await api.post('/notifications/read');
      fetchNotifications();
      showToast('Notifications marked as read');
    });
  }

  // Boot up
  initApp();
});

// Fetch Notifications Logic
window.fetchNotifications = async function() {
  try {
    const notifs = await api.get('/notifications');
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.getElementById('notification-badge');
    if (unread > 0) {
      badge.style.display = 'block';
      badge.innerText = unread;
    } else {
      badge.style.display = 'none';
    }
    
    const list = document.getElementById('notification-list');
    if (notifs.length === 0) {
      list.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.875rem;">No new notifications</div>';
      return;
    }
    
    list.innerHTML = notifs.map(n => {
      let icon = '<i class="fa-solid fa-circle-info" style="color:var(--info);"></i>';
      if (n.type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--warning);"></i>';
      if (n.type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>';
      return `
        <div style="padding:1rem; border-bottom:1px solid var(--border-color); display:flex; gap:0.75rem; background:${n.read ? 'transparent' : 'rgba(37,99,235,0.05)'}">
          <div style="font-size:1.25rem;">${icon}</div>
          <div>
            <p style="margin:0; font-size:0.875rem; color:var(--text-main); font-weight:${n.read?'400':'500'}">${n.message}</p>
            <span style="font-size:0.75rem; color:var(--text-muted);">${n.time}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    console.error('Failed to fetch notifications', e);
  }
};

// Helper for opening modals explicitly
window.openModal = function(title, contentHtml, onSave) {
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-body').innerHTML = contentHtml;
  const overlay = document.getElementById('global-modal');
  overlay.classList.add('active');
  
  const saveBtn = document.getElementById('modal-save');
  // Remove old listeners
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  
  newSaveBtn.addEventListener('click', async () => {
    const btnText = newSaveBtn.innerText;
    newSaveBtn.innerText = 'Saving...';
    newSaveBtn.disabled = true;
    try {
      if (onSave) await onSave();
      overlay.classList.remove('active');
    } catch (e) {
      console.error(e);
    } finally {
      newSaveBtn.innerText = btnText;
      newSaveBtn.disabled = false;
    }
  });
};
