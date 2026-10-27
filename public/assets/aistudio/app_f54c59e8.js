// App initialization
document.addEventListener('DOMContentLoaded', () => {
  // Hide splash screen after 1 second
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
  }, 1000);

  // Initialize navigation
  initNavigation();
  
  // Load home page by default
  loadPage('home');
});

// Navigation handling
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      // Update active state
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Load page
      loadPage(page);
    });
  });
}

// Page loading
function loadPage(page) {
  const content = document.getElementById('content');
  
  switch(page) {
    case 'home':
      loadHomePage();
      break;
    case 'income-expense':
      loadIncomeExpensePage();
      break;
    case 'debt':
      loadDebtPage();
      break;
    case 'budget':
      loadBudgetPage();
      break;
  }
}

// Common utility functions
function formatCurrency(amount) {
  return '৳' + amount.toLocaleString('bn-BD');
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousMonthKey() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthForDisplay(monthKey) {
  const [year, month] = monthKey.split('-');
  const monthNames = ['জানুয়ারী', 'ফেব্রুয়ারী', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// Confirmation dialog
function showConfirmationDialog(message, callback) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  
  const content = document.createElement('div');
  content.className = 'modal-content confirmation-dialog';
  
  const text = document.createElement('p');
  text.textContent = message;
  
  const btnGroup = document.createElement('div');
  btnGroup.className = 'btn-group';
  
  const noBtn = document.createElement('button');
  noBtn.className = 'btn btn-danger';
  noBtn.textContent = 'না';
  noBtn.onclick = () => modal.remove();
  
  const yesBtn = document.createElement('button');
  yesBtn.className = 'btn';
  yesBtn.textContent = 'হ্যাঁ';
  yesBtn.onclick = () => {
    modal.remove();
    callback();
  };
  
  btnGroup.appendChild(noBtn);
  btnGroup.appendChild(yesBtn);
  
  content.appendChild(text);
  content.appendChild(btnGroup);
  modal.appendChild(content);
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  document.body.appendChild(modal);
}

// Error handling
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  
  // Remove any existing error messages
  const existingErrors = document.querySelectorAll('.error-message');
  existingErrors.forEach(error => error.remove());
  
  // Add the new error message
  document.body.appendChild(errorDiv);
  
  // Remove error message after 3 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
} 