let isSignUpMode = true; 

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

// Handle flipping between Sign Up and Sign In views manually
toggleAuthModeBtn.addEventListener('click', () => {
  isSignUpMode = !isSignUpMode;
  authErrorMessage.textContent = ""; 
  userCredentialInput.value = "";
  userPasswordInput.value = "";
  
  if (isSignUpMode) {
    authTitle.textContent = "Sign Up";
    credentialLabel.textContent = "Choose Username or Email";
    authSubmitBtn.textContent = "Create Free Account";
    toggleAuthModeBtn.innerHTML = 'Already have an account? <strong>Sign In Instead</strong>';
  } else {
    authTitle.textContent = "Sign In";
    credentialLabel.textContent = "Enter Username or Email";
    authSubmitBtn.textContent = "Enter Dashboard";
    toggleAuthModeBtn.innerHTML = 'Need a new account? <strong>Sign Up Now</strong>';
  }
});

// Handle form operations for account initialization and authentication
document.getElementById('authForm').addEventListener('submit', (event) => {
  event.preventDefault();
  authErrorMessage.textContent = ""; 

  const credential = userCredentialInput.value.trim().toLowerCase();
  const password = userPasswordInput.value;

  if (password.length < 6) {
    authErrorMessage.textContent = "Password must be at least 6 characters long.";
    return;
  }

  let accountsDB = JSON.parse(localStorage.getItem('restaurantOS_users')) || [];

  if (isSignUpMode) {
    const profileExists = accountsDB.some(account => account.identifier === credential);
    if (profileExists) {
      authErrorMessage.textContent = "This username or email is already registered.";
      return;
    }

    const newProfile = { identifier: credential, password: password };
    accountsDB.push(newProfile);
    localStorage.setItem('restaurantOS_users', JSON.stringify(accountsDB));

    // Flip directly to Sign In mode upon successful registration
    isSignUpMode = false;
    authTitle.textContent = "Sign In";
    credentialLabel.textContent = "Enter Username or Email";
    authSubmitBtn.textContent = "Enter Dashboard";
    toggleAuthModeBtn.innerHTML = 'Need a new account? <strong>Sign Up Now</strong>';
    userCredentialInput.value = credential;
    userPasswordInput.value = "";
  } else {
    const matchedAccount = accountsDB.find(account => account.identifier === credential && account.password === password);
    if (!matchedAccount) {
      authErrorMessage.textContent = "Invalid username/email or password credentials.";
      return;
    }

    launchDashboardApp(credential);
  }
});

// Open main dashboard panel view layout
function launchDashboardApp(usernameOrEmail) {
  userCredentialInput.value = "";
  userPasswordInput.value = "";

  const parts = usernameOrEmail.split('@'); 
  const identityString = parts[0]; 
  const displayString = identityString.charAt(0).toUpperCase() + identityString.slice(1);

  welcomeName.textContent = displayString;
  displayUsername.textContent = displayString;
  userAvatar.textContent = displayString.charAt(0).toUpperCase();

  loginScreen.style.display = 'none';
  appDashboard.style.display = 'flex';
}

// Log out of the workspace dashboard layout state view window
logoutBtn.addEventListener('click', () => {
  appDashboard.style.display = 'none';
  loginScreen.style.display = 'flex';
});
