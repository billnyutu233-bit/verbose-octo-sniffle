document.addEventListener('DOMContentLoaded', function () {
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

  function openGoogleModal() {
    googleModalError.textContent = '';
    googleEmailInput.value = '';
    googleModal.style.display = 'flex';
    googleEmailInput.focus();
  }

  function closeGoogleModal() {
    googleModal.style.display = 'none';
  }

  function enterDashboard(email) {
    const emailParts = email.split('@');
    const rawName = emailParts[0] || 'User';
    const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    welcomeName.textContent = cleanName;
    displayUsername.textContent = cleanName;
    displayUserEmail.textContent = email;
    userAvatar.textContent = cleanName.charAt(0).toUpperCase();

    loginScreen.style.display = 'none';
    appDashboard.style.display = 'flex';
  }

  googleSignInBtn.addEventListener('click', openGoogleModal);

  googleCancelBtn.addEventListener('click', closeGoogleModal);

  googleModal.addEventListener('click', function (event) {
    if (event.target === googleModal) {
      closeGoogleModal();
    }
  });

  googlePromptForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const email = googleEmailInput.value.trim().toLowerCase();

    if (!email || !email.includes('@') || email.indexOf('@') === 0 || email.endsWith('@')) {
      googleModalError.textContent = 'Please enter a valid Google email address.';
      return;
    }

    try {
      localStorage.setItem('restaurantOS_activeUser', email);
    } catch (err) {
      // Ignore storage errors in restricted environments
    }

    closeGoogleModal();
    enterDashboard(email);
  });

  logoutBtn.addEventListener('click', function () {
    try {
      localStorage.removeItem('restaurantOS_activeUser');
    } catch (err) {
      // Ignore storage errors
    }

    appDashboard.style.display = 'none';
    loginScreen.style.display = 'flex';
  });

  // Restore saved session if present
  try {
    const savedEmail = localStorage.getItem('restaurantOS_activeUser');
    if (savedEmail && savedEmail.includes('@')) {
      enterDashboard(savedEmail);
    }
  } catch (err) {
    // Ignore storage errors
  }
});
