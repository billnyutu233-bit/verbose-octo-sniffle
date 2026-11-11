// Toggle state tracking variable
let isSignUpMode = true; 

// DOM References
const authTitle = document.getElementById('authTitle');
const credentialLabel = document.getElementById('credentialLabel');
const userCredentialInput = document.getElementById('userCredential');
const userPasswordInput = document.getElementById('userPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuthModeBtn = document.getElementById('toggleAuthMode');
const authErrorMessage = document.getElementById('authErrorMessage');

const loginScreen = document.getElementById('loginScreen');
const appDashboard = document.getElementById('appDashboard');
const logoutBtn = document.getElementById('logoutBtn');
const welcomeName = document.getElementById('welcomeName');
const displayUsername = document.getElementById('displayUsername');
const userAvatar = document.getElementById('userAvatar');

// Switch logic between Sign Up UI and Sign In UI forms
toggleAuthModeBtn.addEventListener('click', () => {
  isSignUpMode = !isSignUpMode;
  authErrorMessage.textContent = ""; // Clear errors
  
  if (isSignUpMode) {
    authTitle.textContent = "Sign Up";
    credentialLabel.textContent = "Choose Username or Email";
    userCredentialInput.placeholder = "e.g. chef_mario or admin@cafe.com";
    authSubmitBtn.textContent = "Create Free Account";
    toggleAuthModeBtn.innerHTML = 'Already have an account? <strong>Sign In Instead</strong>';
  } else {
    authTitle.textContent = "Sign In";
    credentialLabel.textContent = "Enter Username or Email";
    userCredentialInput.placeholder = "Your username or email address";
    authSubmitBtn.textContent = "Enter Dashboard";
    toggleAuthModeBtn.innerHTML = 'Need a new account? <strong>Sign Up Now</strong>';
  }
});

// Authentication Handling Routine via Browser LocalStorage Mock Database Backend Layer
document.getElementById('authForm').addEventListener('submit', (event) => {
  event.preventDefault();
  authErrorMessage.textContent = ""; // Reset Error Banner

  const credential = userCredentialInput.value.trim().toLowerCase();
  const password = userPasswordInput.value;

  if (password.length < 6) {
    authErrorMessage.textContent = "Password must be at least 6 characters long.";
    return;
  }

  // Retrieve existing local database array records
  let accountsDB = JSON.parse(localStorage.getItem('restaurantOS_users')) || [];

  if (isSignUpMode) {
    // Check if Username or Email is already occupied
    const profileExists = accountsDB.some(account => account.identifier === credential);
    if (profileExists) {
      authErrorMessage.textContent = "This username or email is already registered.";
      return;
    }

    // Save profile record into Mock Storage
    const newProfile = { identifier: credential, password: password };
    accountsDB.push(newProfile);
    localStorage.setItem('restaurantOS_users', JSON.stringify(accountsDB));

    // Grant Session Entry Access straight into app layout
    launchDashboardApp(credential);
  } else {
    // Process login routine lookup query logic
    const matchedAccount = accountsDB.find(account => account.identifier === credential && account.password === password);
    if (!matchedAccount) {
      authErrorMessage.textContent = "Invalid username/email or password credentials.";
      return;
    }

    launchDashboardApp(credential);
  }
});

// Launch function logic
function launchDashboardApp(usernameOrEmail) {
  // Clear credential entry parameters securely
  userCredentialInput.value = "";
  userPasswordInput.value = "";

  // Beautify UI displaying string name strings nicely
  let cleanName = usernameOrEmail.split('@')[0]; // Split if email, take first part
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  welcomeName.textContent = cleanName;
  displayUsername.textContent = cleanName;
  userAvatar.textContent = cleanName.charAt(0).toUpperCase();

  // Dynamic Page Presentation Switch layout display states
  loginScreen.style.display = 'none';
  appDashboard.style.display = 'flex';
}

// Log out screen switch routine reset execution layer
logoutBtn.addEventListener('click', () => {
  appDashboard.style.display = 'none';
  loginScreen.style.display = 'flex';
});
