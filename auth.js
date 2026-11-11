const loginScreen = document.getElementById('loginScreen');
const appDashboard = document.getElementById('appDashboard');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const googleModal = document.getElementById('googleModal');
const googlePromptForm = document.getElementById('googlePromptForm');
const googleEmailInput = document.getElementById('googleEmailInput');
const googleModalError = document.getElementById('googleModalError');
const googleCancelBtn = document.getElementById('googleCancelBtn');
const logoutBtn = document.getElementById('logoutBtn');
const quickAddStockBtn = document.getElementById('quickAddStockBtn');

const welcomeName = document.getElementById('welcomeName');
const displayUsername = document.getElementById('displayUsername');
const displayUserEmail = document.getElementById('displayUserEmail');
const userAvatar = document.getElementById('userAvatar');

const navLinks = document.querySelectorAll('.nav-link');
const viewSections = document.querySelectorAll('.view-section');
const currentPageTitle = document.getElementById('currentPageTitle');

const pageTitles = {
  overviewView: 'Dashboard Overview',
  inventoryView: 'Kitchen Inventory',
  ordersView: 'Kitchen Orders',
  analyticsView: 'Sales & Analytics'
};

function switchView(targetViewId) {
  if (!targetViewId) return;

  navLinks.forEach(function (btn) {
    if (btn.getAttribute('data-view') === targetViewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  viewSections.forEach(function (section) {
    section.style.display = 'none';
  });

  const targetSection = document.getElementById(targetViewId);
  if (targetSection) {
    targetSection.style.display = 'block';
  }

  if (currentPageTitle && pageTitles[targetViewId]) {
    currentPageTitle.textContent = pageTitles[targetViewId];
  }
}

navLinks.forEach(function (link) {
  link.addEventListener('click', function () {
    const targetViewId = link.getAttribute('data-view');
    switchView(targetViewId);
  });
});

if (quickAddStockBtn) {
  quickAddStockBtn.addEventListener('click', function () {
    switchView('inventoryView');
  });
}

window.addEventListener('DOMContentLoaded', function () {
  try {
    const savedEmail = localStorage.getItem('restaurantOS_activeUser');
    if (savedEmail) {
      openDashboard(savedEmail);
    }
  } catch (e) {}
});

googleSignInBtn.addEventListener('click', function () {
  googleModalError.textContent = '';
  googleEmailInput.value = '';
  googleModal.style.display = 'flex';
  googleEmailInput.focus();
});

googleCancelBtn.addEventListener('click', function () {
  googleModal.style.display = 'none';
});

googlePromptForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const email = googleEmailInput.value.trim().toLowerCase();

  if (email.indexOf('@') === -1) {
    googleModalError.textContent = 'Please enter a valid Google email address.';
    return;
  }

  try {
    localStorage.setItem('restaurantOS_activeUser', email);
  } catch (err) {}

  googleModal.style.display = 'none';
  openDashboard(email);
});

function openDashboard(email) {
  const emailParts = email.split('@');
  const rawName = emailParts[0] || 'User';
  const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  welcomeName.textContent = cleanName;
  displayUsername.textContent = cleanName;
  displayUserEmail.textContent = email;
  userAvatar.textContent = cleanName.charAt(0).toUpperCase();

  loginScreen.style.display = 'none';
  appDashboard.style.display = 'flex';
  switchView('overviewView');
}

logoutBtn.addEventListener('click', function () {
  try {
    localStorage.removeItem('restaurantOS_activeUser');
  } catch (err) {}

  appDashboard.style.display = 'none';
  loginScreen.style.display = 'flex';
});
