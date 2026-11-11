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

// 1. Restore saved user session on load
window.addEventListener('DOMContentLoaded', function () {
  try {
    const savedEmail = localStorage.getItem('restaurantOS_activeUser');
    if (savedEmail) {
      openDashboard(savedEmail);
    }
  } catch (e) {}
});

// 2. Open Google sign-in modal
googleSignInBtn.addEventListener('click', function () {
  googleModalError.textContent = '';
  googleEmailInput.value = '';
  googleModal.style.display = 'flex';
  googleEmailInput.focus();
});

// 3. Close Google sign-in modal
googleCancelBtn.addEventListener('click', function () {
  googleModal.style.display = 'none';
});

// 4. Validate email and log in
googlePromptForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const email = googleEmailInput.value.trim().toLowerCase();

  if (!email.includes('@')) {
    googleModalError.textContent = 'Please enter a valid Google email address.';
    return;
  }

  try {
    localStorage.setItem('restaurantOS_activeUser', email);
  } catch (err) {}

  googleModal.style.display = 'none';
  openDashboard(email);
});

// 5. Switch from login screen to dashboard
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
}

// 6. Log out and clear session
logoutBtn.addEventListener('click', function () {
  try {
    localStorage.removeItem('restaurantOS_activeUser');
  } catch (err) {}

  appDashboard.style.display = 'none';
  loginScreen.style.display = 'flex';
});

// 7. Sidebar Panel Switching
const navLinks = document.querySelectorAll('.nav-link');
const viewSections = document.querySelectorAll('.view-section');
const currentPageTitle = document.getElementById('currentPageTitle');

const pageTitles = {
  overviewView: 'Dashboard Overview',
  inventoryView: 'Kitchen Inventory',
  ordersView: 'Kitchen Orders',
  analyticsView: 'Sales & Analytics'
};

navLinks.forEach(function (link) {
  link.addEventListener('click', function () {
    const targetViewId = link.getAttribute('data-view');
    if (!targetViewId) return;

    navLinks.forEach(function (btn) {
      btn.classList.remove('active');
    });
    link.classList.add('active');

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
  });
});

// 8. Inventory Stock Add, Edit & Delete (CRUD)
const defaultInventory = [
  { name: 'Fresh Atlantic Salmon', category: 'Seafood', qty: '14 kg', status: 'ok' },
  { name: 'Extra Virgin Olive Oil', category: 'Pantry', qty: '3 Liters', status: 'low' },
  { name: 'San Marzano Tomatoes', category: 'Produce', qty: '42 Cans', status: 'ok' }
];

let inventoryItems = defaultInventory;
try {
  const stored = localStorage.getItem('restaurantOS_inventory');
  if (stored) {
    inventoryItems = JSON.parse(stored);
  }
} catch (e) {}

function updateLowStockCounters() {
  const lowCount = inventoryItems.filter(function (item) {
    return item.status === 'low';
  }).length;

  const badge = document.getElementById('lowStockBadge');
  const cardCount = document.getElementById('lowStockCardCount');
  if (badge) badge.textContent = lowCount;
  if (cardCount) cardCount.textContent = lowCount + (lowCount === 1 ? ' Item' : ' Items');
}

function saveAndRenderInventory() {
  try {
    localStorage.setItem('restaurantOS_inventory', JSON.stringify(inventoryItems));
  } catch (e) {}

  updateLowStockCounters();

  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  inventoryItems.forEach(function (item, index) {
    const badgeClass = item.status === 'low' ? 'low' : 'ok';
    const badgeLabel = item.status === 'low' ? 'Low Stock' : 'Optimal';

    const row = document.createElement('tr');
    row.innerHTML =
      '<td>' + item.name + '</td>' +
      '<td>' + item.category + '</td>' +
      '<td>' + item.qty + '</td>' +
      '<td><span class="badge ' + badgeClass + '">' + badgeLabel + '</span></td>' +
      '<td>' +
        '<button type="button" class="action-btn" onclick="openStockModal(' + index + ')">Edit</button>' +
        '<button type="button" class="action-btn del" onclick="deleteStockItem(' + index + ')">Delete</button>' +
      '</td>';
    tbody.appendChild(row);
  });
}

function openStockModal(index) {
  const modal = document.getElementById('stockModal');
  const title = document.getElementById('stockModalTitle');
  const editIndexInput = document.getElementById('editStockIndex');
  const nameInput = document.getElementById('stockNameInput');
  const categoryInput = document.getElementById('stockCategoryInput');
  const qtyInput = document.getElementById('stockQtyInput');
  const statusInput = document.getElementById('stockStatusInput');

  if (typeof index === 'number' && inventoryItems[index]) {
    const item = inventoryItems[index];
    title.textContent = 'Edit Stock Item';
    editIndexInput.value = index;
    nameInput.value = item.name;
    categoryInput.value = item.category;
    qtyInput.value = item.qty;
    statusInput.value = item.status;
  } else {
    title.textContent = 'Add Stock Item';
    editIndexInput.value = -1;
    nameInput.value = '';
    categoryInput.value = '';
    qtyInput.value = '';
    statusInput.value = 'ok';
  }

  modal.style.display = 'flex';
  nameInput.focus();
}

function closeStockModal() {
  document.getElementById('stockModal').style.display = 'none';
}

function deleteStockItem(index) {
  inventoryItems.splice(index, 1);
  saveAndRenderInventory();
}

document.getElementById('stockForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const editIndex = parseInt(document.getElementById('editStockIndex').value, 10);
  const newItem = {
    name: document.getElementById('stockNameInput').value.trim(),
    category: document.getElementById('stockCategoryInput').value.trim(),
    qty: document.getElementById('stockQtyInput').value.trim(),
    status: document.getElementById('stockStatusInput').value
  };

  if (editIndex >= 0) {
    inventoryItems[editIndex] = newItem;
  } else {
    inventoryItems.push(newItem);
  }

  saveAndRenderInventory();
  closeStockModal();
});

saveAndRenderInventory();
