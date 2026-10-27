let currentFilter = 'all';

function loadIncomeExpensePage() {
  const content = document.getElementById('content');
  const currentMonthKey = getCurrentMonthKey();
  
  // Get data from localStorage
  const income = parseFloat(localStorage.getItem(`income_${currentMonthKey}`)) || 0;
  const expense = parseFloat(localStorage.getItem(`expense_${currentMonthKey}`)) || 0;
  const transactions = JSON.parse(localStorage.getItem(`transactions_${currentMonthKey}`)) || [];
  
  // Get all available months
  const months = getAllMonthKeys();
  
  content.innerHTML = `
    <div class="card">
      <div class="month-navigation">
        <button class="btn" onclick="navigateMonth('prev')">
          <i class="fas fa-chevron-left"></i> <span>আগের মাস</span>
        </button>
        <div class="input-group" style="flex: 1; margin: 0 10px;">
          <select id="monthSelector" onchange="changeMonth()">
            ${months.map(month => `
              <option value="${month}" ${month === currentMonthKey ? 'selected' : ''}>
                ${formatMonthForDisplay(month)}
              </option>
            `).join('')}
          </select>
        </div>
        <button class="btn" onclick="navigateMonth('next')">
          <span>পরের মাস</span> <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <div class="summary-card">
      <h2>${formatMonthForDisplay(currentMonthKey)}</h2>
      <div class="list-item">
        <span>মোট আয়</span>
        <span class="income-item">${formatCurrency(income)}</span>
      </div>
      <div class="list-item">
        <span>মোট খরচ</span>
        <span class="expense-item-text">${formatCurrency(expense)}</span>
      </div>
      <div class="list-item">
        <span>ব্যালেন্স</span>
        <span>${formatCurrency(income - expense)}</span>
      </div>
    </div>
    
    <div class="card">
      <h3>নতুন আয়/খরচ যোগ করুন</h3>
      <form id="transactionForm" onsubmit="handleTransactionSubmit(event)">
        <div class="input-group">
          <input type="number" id="amount" placeholder="পরিমাণ (৳)" step="0.01" required>
        </div>
        <div class="input-group">
          <select id="type" required>
            <option value="income">আয়</option>
            <option value="expense">খরচ</option>
          </select>
        </div>
        <div class="input-group">
          <input type="text" id="note" placeholder="বিবরণ" required>
        </div>
        <button type="submit" class="btn">সংরক্ষণ করুন</button>
      </form>
    </div>
    
    <div class="card">
      <h3>আয়/খরচের হিসাব</h3>
      <div class="filter-group">
        <div class="input-group">
          <select id="filter" onchange="filterTransactions()">
            <option value="all">সব হিসাব</option>
            <option value="income">শুধু আয়</option>
            <option value="expense">শুধু খরচ</option>
          </select>
        </div>
        <div class="transaction-count" id="transactionCount"></div>
      </div>
      <div id="transactionList" class="list"></div>
    </div>
  `;
  
  showTransactions(transactions);
}

function getAllMonthKeys() {
  const monthKeys = new Set();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Add months from localStorage
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('transactions_') || key.startsWith('income_') || key.startsWith('expense_')) {
      const monthKey = key.split('_')[1];
      monthKeys.add(monthKey);
    }
  });
  
  // Add a range of months (12 months before and after current month)
  for (let i = -12; i <= 12; i++) {
    const date = new Date(currentYear, currentMonth - 1 + i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthKeys.add(monthKey);
  }
  
  // Convert to array and sort in descending order
  return Array.from(monthKeys).sort().reverse();
}

function changeMonth() {
  const selectedMonth = document.getElementById('monthSelector').value;
  
  // Load transactions for the selected month
  const transactions = JSON.parse(localStorage.getItem(`transactions_${selectedMonth}`)) || [];
  const income = parseFloat(localStorage.getItem(`income_${selectedMonth}`)) || 0;
  const expense = parseFloat(localStorage.getItem(`expense_${selectedMonth}`)) || 0;
  
  // Update summary card
  const summaryCard = document.querySelector('.summary-card');
  summaryCard.innerHTML = `
    <h2>${formatMonthForDisplay(selectedMonth)}</h2>
    <div class="list-item">
      <span>মোট আয়</span>
      <span class="income-item">${formatCurrency(income)}</span>
    </div>
    <div class="list-item">
      <span>মোট খরচ</span>
      <span class="expense-item-text">${formatCurrency(expense)}</span>
    </div>
    <div class="list-item">
      <span>ব্যালেন্স</span>
      <span>${formatCurrency(income - expense)}</span>
    </div>
  `;
  
  // Show transactions for the selected month
  showTransactions(transactions);
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  
  const amountInput = document.getElementById('amount');
  const typeSelect = document.getElementById('type');
  const noteInput = document.getElementById('note');
  const monthSelect = document.getElementById('monthSelector');

  const amount = parseFloat(amountInput.value);
  const type = typeSelect.value;
  const note = noteInput.value.trim();
  const currentMonthKey = monthSelect.value;
  
  if (!amount || amount <= 0 || isNaN(amount)) {
    showError('সঠিক পরিমাণ লিখুন');
    amountInput.focus();
    return;
  }
  
  if (!note) {
    showError('বিবরণ লিখুন');
    noteInput.focus();
    return;
  }
  
  const now = new Date();
  const timeOptions = { 
    hour: 'numeric', 
    minute: 'numeric',
    hour12: true,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  
  const transaction = {
    id: Date.now(),
    amount,
    type,
    note,
    time: now.toLocaleString('bn-BD', timeOptions),
    monthKey: currentMonthKey // Store the month key with the transaction
  };
  
  try {
    // Get existing transactions
    const transactions = JSON.parse(localStorage.getItem(`transactions_${currentMonthKey}`)) || [];
    transactions.push(transaction);
    
    // Update income/expense totals
    const income = parseFloat(localStorage.getItem(`income_${currentMonthKey}`)) || 0;
    const expense = parseFloat(localStorage.getItem(`expense_${currentMonthKey}`)) || 0;
    
    if (type === 'income') {
      localStorage.setItem(`income_${currentMonthKey}`, income + amount);
    } else {
      localStorage.setItem(`expense_${currentMonthKey}`, expense + amount);
    }
    
    // Save transactions
    localStorage.setItem(`transactions_${currentMonthKey}`, JSON.stringify(transactions));
    
    // Clear inputs
    document.getElementById('transactionForm').reset();
    amountInput.focus();
    
    // Reload page
    loadIncomeExpensePage();
  } catch (error) {
    showError('দুঃখিত, কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
  }
}

function filterTransactions() {
  currentFilter = document.getElementById('filter').value;
  const currentMonthKey = document.getElementById('monthSelector').value;
  const transactions = JSON.parse(localStorage.getItem(`transactions_${currentMonthKey}`)) || [];
  showTransactions(transactions);
}

function navigateMonth(direction) {
  const monthSelector = document.getElementById('monthSelector');
  const currentIndex = monthSelector.selectedIndex;
  
  if (direction === 'prev' && currentIndex < monthSelector.options.length - 1) {
    monthSelector.selectedIndex = currentIndex + 1;
    changeMonth();
  } else if (direction === 'next' && currentIndex > 0) {
    monthSelector.selectedIndex = currentIndex - 1;
    changeMonth();
  }
}

function showTransactions(transactions) {
  const list = document.getElementById('transactionList');
  const countDiv = document.getElementById('transactionCount');
  const currentMonthKey = document.getElementById('monthSelector').value;
  list.innerHTML = '';
  
  // Filter transactions for current month only
  const monthTransactions = transactions.filter(t => String(t.monthKey) === String(currentMonthKey));
  
  const filteredTransactions = currentFilter === 'all' 
    ? monthTransactions 
    : monthTransactions.filter(t => t.type === currentFilter);
  
  // Show transaction count
  const typeText = currentFilter === 'all' ? 'মোট' : (currentFilter === 'income' ? 'আয়ের' : 'খরচের');
  countDiv.textContent = `${typeText} হিসাবঃ ${filteredTransactions.length}টি`;
  
  if (filteredTransactions.length === 0) {
    list.innerHTML = '<div class="list-item" style="justify-content: center; color: #666;">কোন হিসাব নেই</div>';
    return;
  }
  
  filteredTransactions.slice().reverse().forEach(t => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.setAttribute('data-id', t.id);
    
    const left = document.createElement('div');
    left.style.flex = '1';
    
    const span = document.createElement('span');
    span.className = t.type === 'income' ? 'income-item' : 'expense-item-text';
    span.textContent = `${t.type === 'income' ? 'আয়' : 'খরচ'} - ${formatCurrency(t.amount)} (${t.note}) [${t.time}]`;
    left.appendChild(span);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete transaction';
    deleteBtn.setAttribute('data-id', t.id);
    deleteBtn.onclick = () => deleteTransaction(t.id);
    
    div.appendChild(left);
    div.appendChild(deleteBtn);
    list.appendChild(div);
  });
}

function deleteTransaction(transactionId) {
  const currentMonthKey = document.getElementById('monthSelector').value;
  let transactions = JSON.parse(localStorage.getItem(`transactions_${currentMonthKey}`)) || [];
  
  // Convert transactionId to number and find the transaction
  const idToDelete = Number(transactionId);
  const transaction = transactions.find(t => Number(t.id) === idToDelete);
  
  if (!transaction) {
    return; // Silently return if transaction not found
  }
  
  showConfirmationDialog(`"${transaction.note}" মুছে ফেলতে চান?`, () => {
    try {
      // Update income/expense totals
      let income = parseFloat(localStorage.getItem(`income_${currentMonthKey}`)) || 0;
      let expense = parseFloat(localStorage.getItem(`expense_${currentMonthKey}`)) || 0;
      
      if (transaction.type === 'income') {
        income -= parseFloat(transaction.amount);
        localStorage.setItem(`income_${currentMonthKey}`, income.toString());
      } else {
        expense -= parseFloat(transaction.amount);
        localStorage.setItem(`expense_${currentMonthKey}`, expense.toString());
      }
      
      // Remove transaction
      transactions = transactions.filter(t => Number(t.id) !== idToDelete);
      localStorage.setItem(`transactions_${currentMonthKey}`, JSON.stringify(transactions));
      
      // Update UI directly instead of reloading the page
      const list = document.getElementById('transactionList');
      const itemToRemove = list.querySelector(`[data-id="${transactionId}"]`);
      if (itemToRemove) {
        itemToRemove.remove();
      }
      
      // Update summary
      const incomeElement = document.getElementById('incomeAmount');
      const expenseElement = document.getElementById('expenseAmount');
      const balanceElement = document.getElementById('balanceAmount');
      
      if (incomeElement) incomeElement.textContent = formatCurrency(income);
      if (expenseElement) expenseElement.textContent = formatCurrency(expense);
      if (balanceElement) balanceElement.textContent = formatCurrency(income - expense);
      
      // Show success message
      showError('লেনদেন মুছে ফেলা হয়েছে');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showError('দুঃখিত, কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  });
} 