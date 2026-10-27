function loadHomePage() {
  const content = document.getElementById('content');
  const currentMonthKey = getCurrentMonthKey();
  const previousMonthKey = getPreviousMonthKey();
  
  // Get data from localStorage
  const currentIncome = parseFloat(localStorage.getItem(`income_${currentMonthKey}`)) || 0;
  const currentExpense = parseFloat(localStorage.getItem(`expense_${currentMonthKey}`)) || 0;
  const previousBalance = parseFloat(localStorage.getItem(`balance_${previousMonthKey}`)) || 0;
  
  // Calculate total debt and credit
  let totalDebt = 0;
  let totalCredit = 0;
  const debtProfiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  debtProfiles.forEach(profile => {
    totalDebt += parseFloat(profile.debt || 0);
    totalCredit += parseFloat(profile.credit || 0);
  });
  
  // Calculate current balance including previous month's balance
  const currentBalance = currentIncome - currentExpense + previousBalance;
  
  // Save current balance for next month
  localStorage.setItem(`balance_${currentMonthKey}`, currentBalance);
  
  content.innerHTML = `
    <div class="summary-card">
      <h2>মাসিক সারাংশ</h2>
      <div class="list-item">
        <span>মোট আয়</span>
        <span class="income-item">${formatCurrency(currentIncome)}</span>
      </div>
      <div class="list-item">
        <span>মোট খরচ</span>
        <span class="expense-item-text">${formatCurrency(currentExpense)}</span>
      </div>
      <div class="list-item">
        <span>আগের মাসের অবশিষ্ট</span>
        <span>${formatCurrency(previousBalance)}</span>
      </div>
      <div class="list-item">
        <span>বর্তমান ব্যালেন্স</span>
        <span>${formatCurrency(currentBalance)}</span>
      </div>
    </div>
    
    <div class="summary-card">
      <h2>দেনা পাওনা</h2>
      <div class="list-item">
        <span>মোট দেনা</span>
        <span class="expense-item-text">${formatCurrency(totalDebt)}</span>
      </div>
      <div class="list-item">
        <span>মোট পাওনা</span>
        <span class="income-item">${formatCurrency(totalCredit)}</span>
      </div>
    </div>
    
    <div class="summary-card">
      <h2>বাজেট</h2>
      <div class="list-item">
        <span>মোট বাজেট</span>
        <span>${formatCurrency(calculateTotalBudget())}</span>
      </div>
    </div>
  `;
}

function calculateTotalBudget() {
  let total = 0;
  const budgets = JSON.parse(localStorage.getItem('budgets')) || [];
  budgets.forEach(budget => {
    budget.items.forEach(item => {
      total += parseFloat(item.cost || 0);
    });
  });
  return total;
} 