// DOM Core System Architecture Nodes references
const loginScreen = document.getElementById('loginScreen');
const appDashboard = document.getElementById('appDashboard');
const logoutBtn = document.getElementById('logoutBtn');
const welcomeName = document.getElementById('welcomeName');
const displayUsername = document.getElementById('displayUsername');
const userAvatar = document.getElementById('userAvatar');
const authErrorMessage = document.getElementById('authErrorMessage');

// Initialization lifecycle hook callback routine
window.onload = function () {
  try {
    google.accounts.id.initialize({
      // IMPORTANT: Replace this string text with your actual OAuth Client ID from Google Cloud Console
      client_id: "YOUR_GOOGLE_CLIENT_://googleusercontent.com",
      callback: handleCredentialResponse,
      ux_mode: "popup",       // Ensures a real interactive popup layer block drops down
      auto_select: false      // Disables background silence tracking so it waits for intent click gestures
    });

    // Render the explicit interactive button canvas anchor
    google.accounts.id.renderButton(
      document.getElementById("googleButtonDiv"),
      { theme: "filled_blue", size: "large", text: "signin_with", shape: "rectangular" }
    );
  } catch (error) {
    console.error("Google SDK Layer Initialization Error Node:", error);
    authErrorMessage.textContent = "Security block: Google Identity Engine failed to initialize. Run via Localhost server node.";
  }
};

// Safe Base64 JWT token decoder to avoid standard library parsing crashes
function decodeGoogleJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT Decoding failed:", e);
    return null;
  }
}

// Secure processing execution callback loop handling JWT token packet payloads
function handleCredentialResponse(response) {
  const googleUser = decodeGoogleJWT(response.credential);
  
  if (!googleUser) {
    authErrorMessage.textContent = "Authentication protocol mismatch error. Token parsing failed.";
    return;
  }
  
  // Launching the dashboard application using details extracted from the token securely
  if (googleUser.given_name) {
    launchDashboardApp(googleUser.given_name, googleUser.picture);
  } else if (googleUser.name) {
    launchDashboardApp(googleUser.name, null);
  } else {
    launchDashboardApp("Chef Operator", null);
  }
}

// Shell screen routing engine execution state function handler
function launchDashboardApp(fullName, avatarPictureUrl) {
  authErrorMessage.textContent = "";
  
  // Format string variables beautifully inside elements
  const cleanName = fullName.charAt(0).toUpperCase() + fullName.slice(1);
  welcomeName.textContent = cleanName;
  displayUsername.textContent = cleanName;

  if (avatarPictureUrl) {
    userAvatar.style.backgroundImage = `url('${avatarPictureUrl}')`;
    userAvatar.textContent = "";
  } else {
    userAvatar.style.backgroundImage = "none";
    userAvatar.textContent = cleanName.charAt(0).toUpperCase();
  }

  // Visual panel state rendering transformations
  loginScreen.style.display = 'none';
  appDashboard.style.display = 'flex';
}

// Log out screen switch routine reset execution layer
logoutBtn.addEventListener('click', () => {
  try {
    google.accounts.id.disableAutoSelect();
  } catch (err) {
    console.warn("Session clean loop mismatch skip:", err);
  }
  appDashboard.style.display = 'none';
  loginScreen.style.display = 'flex';
});
