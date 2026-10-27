// Debt profile management functions
function addDebtProfile(name, type) {
  if (!name) {
    showError('নাম লিখুন');
    return;
  }
  
  const profile = {
    id: Date.now(),
    name,
    type,
    debt: 0,
    credit: 0,
    transactions: []
  };
  
  // Get existing profiles
  const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  profiles.push(profile);
  
  // Save profiles
  localStorage.setItem('debt_profiles', JSON.stringify(profiles));
  
  // Reload page
  loadDebtPage();
}

function deleteDebtProfile(profileId) {
  showConfirmationDialog('এই প্রোফাইলটি মুছে ফেলতে চান?', () => {
    const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
    const profileIndex = profiles.findIndex(p => p.id === profileId);
    
    if (profileIndex === -1) return;
    
    // Remove profile
    profiles.splice(profileIndex, 1);
    localStorage.setItem('debt_profiles', JSON.stringify(profiles));
    
    // Reload page
    loadDebtPage();
  });
}

function addDebtTransaction(profileId, amount, type, note) {
  if (!amount || amount <= 0) {
    showError('সঠিক পরিমাণ লিখুন');
    return;
  }
  
  if (!note) {
    showError('বিবরণ লিখুন');
    return;
  }
  
  const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  const profileIndex = profiles.findIndex(p => p.id === profileId);
  
  if (profileIndex === -1) return;
  
  const transaction = {
    id: Date.now(),
    amount,
    type,
    note,
    time: new Date().toLocaleString('bn-BD')
  };
  
  // Update profile
  if (type === 'debt') {
    profiles[profileIndex].debt += amount;
  } else {
    profiles[profileIndex].credit += amount;
  }
  
  profiles[profileIndex].transactions.push(transaction);
  
  // Save profiles
  localStorage.setItem('debt_profiles', JSON.stringify(profiles));
  
  // Reload page
  showDebtProfile(profileId);
}

function deleteDebtTransaction(profileId, transactionId) {
  showConfirmationDialog('এই লেনদেনটি মুছে ফেলতে চান?', () => {
    const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
    const profileIndex = profiles.findIndex(p => p.id === profileId);
    
    if (profileIndex === -1) return;
    
    const profile = profiles[profileIndex];
    const transactionIndex = profile.transactions.findIndex(t => t.id === transactionId);
    
    if (transactionIndex === -1) return;
    
    const transaction = profile.transactions[transactionIndex];
    
    // Update totals
    if (transaction.type === 'debt') {
      profile.debt -= transaction.amount;
    } else {
      profile.credit -= transaction.amount;
    }
    
    // Remove transaction
    profile.transactions.splice(transactionIndex, 1);
    
    // Save profiles
    localStorage.setItem('debt_profiles', JSON.stringify(profiles));
    
    // Reload profile
    showDebtProfile(profileId);
  });
}

function showDebtProfiles() {
  const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  const list = document.getElementById('debtProfileList');
  
  if (!list) return;
  
  list.innerHTML = '';
  profiles.forEach(profile => {
    const div = document.createElement('div');
    div.className = 'list-item';
    
    const left = document.createElement('div');
    left.style.flex = '1';
    left.style.cursor = 'pointer';
    left.addEventListener('click', () => showDebtProfile(profile.id));
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = profile.name;
    left.appendChild(nameSpan);
    
    const right = document.createElement('div');
    right.className = 'actions';
    
    const balance = document.createElement('span');
    balance.className = profile.debt > profile.credit ? 'expense-item-text' : 'income-item';
    balance.textContent = formatCurrency(Math.abs(profile.debt - profile.credit));
    balance.style.marginRight = '10px';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete profile';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteDebtProfile(profile.id);
    });
    
    right.appendChild(balance);
    right.appendChild(deleteBtn);
    
    div.appendChild(left);
    div.appendChild(right);
    list.appendChild(div);
  });
}

function showDebtProfile(profileId) {
  const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  const profile = profiles.find(p => p.id === profileId);
  
  if (!profile) return;
  
  const content = document.getElementById('content');
  
  content.innerHTML = `
    <div class="card">
      <h2>${profile.name}</h2>
      <div class="list-item">
        <span>মোট দেনা</span>
        <span class="expense-item-text">${formatCurrency(profile.debt)}</span>
      </div>
      <div class="list-item">
        <span>মোট পাওনা</span>
        <span class="income-item">${formatCurrency(profile.credit)}</span>
      </div>
      <div class="list-item">
        <span>ব্যালেন্স</span>
        <span class="${profile.debt > profile.credit ? 'expense-item-text' : 'income-item'}">
          ${formatCurrency(Math.abs(profile.debt - profile.credit))}
        </span>
      </div>
    </div>
    
    <div class="card">
      <h3>নতুন লেনদেন যোগ করুন</h3>
      <div class="input-group">
        <input type="number" id="amount" placeholder="পরিমাণ (৳)" step="0.01">
      </div>
      <div class="input-group">
        <select id="type">
          <option value="debt">দেনা</option>
          <option value="credit">পাওনা</option>
        </select>
      </div>
      <div class="input-group">
        <input type="text" id="note" placeholder="বিবরণ">
      </div>
      <button class="btn" onclick="addDebtTransaction(${profileId})">সংরক্ষণ করুন</button>
    </div>
    
    <div class="card">
      <h3>লেনদেনের হিসাব</h3>
      <div id="transactionList" class="list"></div>
    </div>
    
    <button class="btn" onclick="loadDebtPage()" style="margin-top: 15px">
      ← ফিরে যান
    </button>
  `;
  
  // Show transactions
  const list = document.getElementById('transactionList');
  profile.transactions.slice().reverse().forEach(t => {
    const div = document.createElement('div');
    div.className = 'list-item';
    
    const left = document.createElement('div');
    left.style.flex = '1';
    
    const span = document.createElement('span');
    span.className = t.type === 'debt' ? 'expense-item-text' : 'income-item';
    span.textContent = `${t.type === 'debt' ? 'দেনা' : 'পাওনা'} - ${formatCurrency(t.amount)} (${t.note}) [${t.time}]`;
    left.appendChild(span);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete transaction';
    deleteBtn.addEventListener('click', () => deleteDebtTransaction(profileId, t.id));
    
    div.appendChild(left);
    div.appendChild(deleteBtn);
    list.appendChild(div);
  });
} 