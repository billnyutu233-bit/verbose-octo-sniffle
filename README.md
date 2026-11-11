# RestaurantOS Management Dashboard

A self-contained front-end web application for restaurant operations, featuring Google sign-in authentication and multi-panel dashboard navigation.

## Folder Structure

- `index.html` — Main HTML layout containing the login screen, Google sign-in prompt modal, sidebar navigation, and dashboard views.
- `styles.css` — Styling rules for the login interface, modal dialog, responsive grids, tables, and dashboard panels.
- `auth.js` — Client-side logic handling Google sign-in validation, `localStorage` session persistence, logout, and sidebar panel switching.
- `README.md` — Project documentation.

## How to Run

1. Extract all files from the zip archive into the same folder.
2. Double-click `index.html` to open it in any web browser (or serve it with a local development server).
3. Click **Sign in with Google**, enter an email address, and click **Continue** to access the dashboard.
4. Use the left sidebar to switch between **Overview**, **Inventory**, **Kitchen Orders**, and **Analytics**.
