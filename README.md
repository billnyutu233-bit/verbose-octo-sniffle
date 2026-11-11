# RestaurantOS Management Dashboard

A clean, modular front-end web application for restaurant inventory and kitchen operations management, featuring an interactive **Sign in with Google** authentication flow.

## Project Structure

```text
RestaurantOS/
├── index.html    # Main HTML structure (Login screen, Google modal, Dashboard shell)
├── styles.css    # Complete responsive styling and layout rules
├── auth.js       # Sign-in modal handling, validation, session storage, and logout logic
└── README.md     # Project documentation and setup instructions
```

## How to Run

1. Extract all files into the same folder.
2. Double-click `index.html` to open it in any web browser (Chrome, Edge, Firefox, Safari), or serve it with a local server such as VS Code **Live Server**.
3. Click **Sign in with Google**, enter your email address in the prompt modal, and click **Continue** to access the dashboard.

## Features

- **Interactive Google Sign-In Prompt:** Clicking the button opens a visible account dialog instead of failing silently.
- **Session Persistence:** Saves the active user session in `localStorage` so refreshing the browser keeps you signed in until you click **Log Out Dashboard**.
- **Clean Separation of Concerns:** HTML, CSS, and JavaScript are separated into dedicated files for easy maintenance.
