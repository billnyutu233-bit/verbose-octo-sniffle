# RestaurantOS — GitHub Pages Website

This is the **static HTML, CSS and JavaScript** version of the Restaurant Management System class project. It is prepared for GitHub Pages, so you do not need Python, Flask, XAMPP, WAMP, or a server.

## Publish it on GitHub Pages

1. Download and extract `restaurant_management_github_pages.zip`.
2. Sign in to GitHub and create a new repository. For a public class project, you can name it `restaurant-management-system`.
3. Open the repository and choose **Add file → Upload files**.
4. Upload the contents of this extracted folder (`index.html`, `style.css`, `script.js`, and this `README.md`). Upload the files themselves to the repository root, not a nested folder.
5. Click **Commit changes**.
6. Open **Settings → Pages**.
7. Under **Build and deployment**, select **Deploy from a branch**.
8. Select branch **main** and folder **/(root)**, then click **Save**.
9. Wait a few minutes and open the published URL shown in Settings → Pages.

## Included features

- Responsive dashboard for desktop and mobile
- Inventory list with add, edit, delete, search and category/status filters
- Low-stock and out-of-stock alerts
- Record sales and automatically deduct quantities from inventory
- Sales and orders history
- Inventory summary reports and category stock-value bars
- Export inventory as CSV
- Workspace name and currency preferences
- Sample data to demonstrate the project immediately

## Important limitation of GitHub Pages

GitHub Pages serves static files only. This version stores demo data in the current browser using `localStorage`; it does not have a shared database, real user accounts, or secure login. Data will not automatically sync across different browsers or devices. Do not enter real customer, employee, or business-sensitive data. A real multi-user system needs a backend and database.

## Project structure

```text
restaurant-management-system/
├── index.html
├── style.css
├── script.js
└── README.md
```
