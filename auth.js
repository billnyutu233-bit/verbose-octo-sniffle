const loginScreen = document.getElementById('loginScreen');
const appDashboard = document.getElementById('appDashboard');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const googleModal = document.getElementById('googleModal');
const googlePromptForm = document.getElementById('googlePromptForm');
const googleEmailInput = document.getElementById('googleEmailInput');
const googleModalError = document.getElementById('googleModalError');
const googleCancelBtn = document.getElementById('googleCancelBtn');
const logoutBtn = document.getElementById('logoutBtn');

const welcomeName = document.getElementById('welcomeName');
const displayUsername = document.getElementById('displayUsername');
const displayUserEmail = document.getElementById('displayUserEmail');
const userAvatar = document.getElementById('userAvatar');

// Check if user is already logged in on page load
window.addEventListener('DOMContentLoaded', function () {
  const savedEmail = localStorage.getItem('restaurantOS_activeUser');
  if (savedEmail) {
    openDashboard(savedEmail);
  }
});

// Open Google sign-in modal on button click
googleSignInBtn.addEventListener('click', function () {
  googleModalError.textContent = '';
  googleEmailInput.value = '';
  googleModal.style.display = 'flex';
  googleEmailInput.focus();
});

// Close modal when clicking Cancel
googleCancelBtn.addEventListener('click', function () {
  googleModal.style.display = 'none';
});

// Validate email and sign in
googlePromptForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const email = googleEmailInput.value.trim().toLowerCase();

  if (!email.includes('@')) {
    googleModalError.textContent = 'Please enter a valid Google email address.';
    return;
  }

  localStorage.setItem('restaurantOS_activeUser', email);
  googleModal.style.display = 'none';
  openDashboard(email);
});

// Switch from login screen to dashboard
function openDashboard(email) {
  const rawName = email.split('@')[0];
  const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  welcomeName.textContent = cleanName;
  displayUsername.textContent = cleanName;
  displayUserEmail.textContent = email;
  userAvatar.textContent = cleanName.charAt(0).toUpperCase();

  loginScreen.style.display = 'none';
  appDashboard.style.display = 'flex';
}

// Log out and clear session
logoutBtn.addEventListener('click', function () {
  localStorage.removeItem('restaurantOS_activeUser');
  appDashboard.style.display = 'none';
  loginScreen.style.display = 'flex';
});
