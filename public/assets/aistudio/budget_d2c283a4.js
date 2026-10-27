function loadBudgetPage() {
  const content = document.getElementById('content');
  const budgets = JSON.parse(localStorage.getItem('budgets')) || [];
  
  content.innerHTML = `
    <div class="card">
      <h3>বাজেট</h3>
      <button class="btn" onclick="showAddBudgetModal()">
        <i class="fas fa-plus"></i> নতুন বাজেট
      </button>
      <div id="budgetList" class="list"></div>
    </div>
  `;
  
  showBudgets(budgets);
}

function showAddBudgetModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>নতুন বাজেট</h3>
      <div class="input-group">
        <input type="text" id="budgetName" placeholder="বাজেটের নাম (যেমন: বাজার, ওষুধ)">
      </div>
      <div class="btn-group">
        <button class="btn btn-danger" onclick="this.closest('.modal').remove()">বাতিল</button>
        <button class="btn" onclick="addBudget()">সংরক্ষণ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
}

function addBudget() {
  const name = document.getElementById('budgetName').value.trim();
  
  if (!name) {
    showError('বাজেটের নাম লিখুন');
    return;
  }
  
  const budget = {
    id: Date.now(),
    name,
    items: []
  };
  
  const budgets = JSON.parse(localStorage.getItem('budgets')) || [];
  budgets.push(budget);
  localStorage.setItem('budgets', JSON.stringify(budgets));
  
  document.querySelector('.modal').remove();
  loadBudgetPage();
}

function showBudgets(budgets) {
  const list = document.getElementById('budgetList');
  list.innerHTML = '';
  
  budgets.forEach(budget => {
    const total = budget.items.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0);
    
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div onclick="showBudgetDetails(${budget.id})" style="flex: 1; cursor: pointer;">
        <div>${budget.name}</div>
        <div class="budget-summary">
          <span>মোট: ${formatCurrency(total)}</span>
          <span>আইটেম: ${budget.items.length}টি</span>
        </div>
      </div>
      <button class="btn btn-danger" onclick="deleteBudget(${budget.id})">X</button>
    `;
    list.appendChild(div);
  });
}

function showBudgetDetails(budgetId) {
  const budgets = JSON.parse(localStorage.getItem('budgets')) || [];
  const budget = budgets.find(b => b.id === budgetId);
  
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <h3>${budget.name}</h3>
      
      <div class="summary-card">
        <div class="list-item">
          <span>মোট বাজেট</span>
          <span>${formatCurrency(budget.items.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0))}</span>
        </div>
      </div>
      
      <button class="btn" onclick="showAddItemModal(${budgetId})">
        <i class="fas fa-plus"></i> নতুন আইটেম
      </button>
      
      <div id="itemList" class="list"></div>
      
      <button class="btn" onclick="loadBudgetPage()">ফিরে যান</button>
    </div>
  `;
  
  showBudgetItems(budget);
}

function showAddItemModal(budgetId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>নতুন আইটেম</h3>
      <div class="input-group">
        <input type="text" id="itemName" placeholder="আইটেমের নাম">
      </div>
      <div class="input-group">
        <input type="number" id="itemCost" placeholder="খরচ (৳)">
      </div>
      <div class="btn-group">
        <button class="btn btn-danger" onclick="this.closest('.modal').remove()">বাতিল</button>
        <button class="btn" onclick="addItem(${budgetId})">সংরক্ষণ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
}

function addItem(budgetId) {
  const name = document.getElementById('itemName').value.trim();
  const cost = parseFloat(document.getElementById('itemCost').value);
  
  if (!name) {
    showError('আইটেমের নাম লিখুন');
    return;
  }
  
  if (!cost || cost <= 0) {
    showError('সঠিক খরচ লিখুন');
    return;
  }
  
  const item = {
    id: Date.now(),
    name,
    cost,
    bought: false
  };
  
  const budgets = JSON.parse(localStorage.getItem('budgets')) || [];
  const budgetIndex = budgets.findIndex(b => b.id === budgetId);
  
  if (budgetIndex === -1) return;
  
  budgets[budgetIndex].items.push(item);
  localStorage.setItem('budgets', JSON.stringify(budgets));
  
  document.querySelector('.modal').remove();
  showBudgetDetails(budgetId);
}

function showBudgetItems(budget) {
  const list = document.getElementById('itemList');
  list.innerHTML = '';
  
  budget.items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div style="display: flex; align-items: center;">
        <input type="checkbox" ${item.bought ? 'checked' : ''} 
          onchange="toggleItemBought(${budget.id}, ${item.id})">
        <span style="margin-left: 10px; ${item.bought ? 'text-decoration: line-through;' : ''}">
          ${item.name} - ${formatCurrency(item.cost)}
        </span>
      </div>
      <button class="btn btn-danger" onclick="deleteItem(${budget.id}, ${item.id})">X</button>
    `;
    list.appendChild(div);
  });
}

function toggleItemBought(budgetId, itemId) {
  const budgets = JSON.parse(localStorage.getItem('budgets')) || [];
  const budgetIndex = budgets.findIndex(b => b.id === budgetId);
  
  if (budgetIndex === -1) return;
  
  const itemIndex = budgets[budgetIndex].items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return;
  
  budgets[budgetIndex].items[itemIndex].bought = !budgets[budgetIndex].items[itemIndex].bought;
  localStorage.setItem('budgets', JSON.stringify(budgets));
  
  showBudgetDetails(budgetId);
}

function deleteItem(budgetId, itemId) {
  showConfirmationDialog('আপনি কি নিশ্চিত যে আপনি এই আইটেমটি মুছে ফেলতে চান?', () => {
    const budgets = JSON.parse(localStorage.getItem('budgets')) || [];
    const budgetIndex = budgets.findIndex(b => b.id === budgetId);
    
    if (budgetIndex === -1) return;
    
    const itemIndex = budgets[budgetIndex].items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;
    
    budgets[budgetIndex].items.splice(itemIndex, 1);
    localStorage.setItem('budgets', JSON.stringify(budgets));
    
    showBudgetDetails(budgetId);
  });
}

function deleteBudget(budgetId) {
  showConfirmationDialog('আপনি কি নিশ্চিত যে আপনি এই বাজেটটি মুছে ফেলতে চান?', () => {
    const budgets = JSON.parse(localStorage.getItem('budgets')) || [];
    const filteredBudgets = budgets.filter(b => b.id !== budgetId);
    localStorage.setItem('budgets', JSON.stringify(filteredBudgets));
    loadBudgetPage();
  });
} 