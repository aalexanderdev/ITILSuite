/**
 * ITILSuite Vanilla JS Core (HTMX + Dropups + Theme + Modals)
 */

// 1. Theme Management (Light / Dark)
(function initTheme() {
  const saved = localStorage.getItem('itilsuite_theme');
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('itilsuite_theme', next);
  const themeLabel = document.getElementById('current-theme-label');
  if (themeLabel) {
    themeLabel.textContent = next === 'dark' ? 'Oscuro' : 'Claro';
  }
}

// 2. Bottom Dock & Vertical Dropups Management
document.addEventListener('DOMContentLoaded', () => {
  const dockWrapper = document.querySelector('.bottom-dock-wrapper');
  if (!dockWrapper) return;

  // Toggle dropup menu
  window.toggleDockMenu = function(menuId) {
    const allDropups = document.querySelectorAll('.dock-dropup');
    const allButtons = document.querySelectorAll('.dock-item, .dock-item-create');
    const targetDropup = document.getElementById('dropup-' + menuId);
    const targetButton = document.getElementById('dock-btn-' + menuId);

    const isAlreadyOpen = targetDropup && targetDropup.classList.contains('active');

    // Close all
    allDropups.forEach(d => d.classList.remove('active'));
    allButtons.forEach(b => b.classList.remove('menu-open'));

    // If wasn't open, open it
    if (!isAlreadyOpen && targetDropup) {
      targetDropup.classList.add('active');
      if (targetButton) targetButton.classList.add('menu-open');
    }
  };

  // Close dropups when clicking outside
  document.addEventListener('mousedown', (e) => {
    if (!dockWrapper.contains(e.target)) {
      document.querySelectorAll('.dock-dropup').forEach(d => d.classList.remove('active'));
      document.querySelectorAll('.dock-item, .dock-item-create').forEach(b => b.classList.remove('menu-open'));
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.dock-dropup').forEach(d => d.classList.remove('active'));
      document.querySelectorAll('.dock-item, .dock-item-create').forEach(b => b.classList.remove('menu-open'));
      closeAllModals();
    }
  });

  // Dock Collapse / Expand Toggle
  const toggleBtn = document.querySelector('.bottom-dock-toggle');
  const dockBar = document.querySelector('.bottom-dock-bar');
  if (toggleBtn && dockBar) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = dockBar.classList.toggle('hidden');
      toggleBtn.querySelector('span').textContent = isHidden ? 'Mostrar' : 'Menú';
      if (isHidden) {
        document.querySelectorAll('.dock-dropup').forEach(d => d.classList.remove('active'));
      }
    });
  }
});

// 3. Modal Helpers
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m => {
    m.classList.remove('active');
  });
  document.body.style.overflow = '';
}
