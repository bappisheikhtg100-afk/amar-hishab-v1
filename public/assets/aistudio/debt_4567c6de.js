function loadDebtPage() {
  const content = document.getElementById('content');
  const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  
  content.innerHTML = `
    <div class="card">
      <h3>দেনা পাওনা</h3>
      <button class="btn" onclick="showAddProfileModal()">
        <i class="fas fa-plus"></i> নতুন প্রোফাইল
      </button>
      <div id="profileList" class="list"></div>
    </div>
  `;
  
  showProfiles(profiles);
}

function showAddProfileModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>নতুন প্রোফাইল</h3>
      <div class="input-group">
        <input type="text" id="profileName" placeholder="নাম">
      </div>
      <div class="input-group">
        <input type="text" id="profilePhone" placeholder="মোবাইল নম্বর">
      </div>
      <div class="input-group">
        <input type="text" id="profileAddress" placeholder="ঠিকানা">
      </div>
      <div class="btn-group">
        <button class="btn btn-danger" onclick="this.closest('.modal').remove()">বাতিল</button>
        <button class="btn" onclick="addProfile()">সংরক্ষণ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'block';
}

function addProfile() {
  const name = document.getElementById('profileName').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();
  const address = document.getElementById('profileAddress').value.trim();
  
  if (!name) {
    showError('নাম লিখুন');
    return;
  }
  
  const profile = {
    id: Date.now(),
    name,
    phone,
    address,
    debt: 0,
    credit: 0,
    transactions: []
  };
  
  const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  profiles.push(profile);
  localStorage.setItem('debt_profiles', JSON.stringify(profiles));
  
  document.querySelector('.modal').remove();
  loadDebtPage();
}

function showProfiles(profiles) {
  const list = document.getElementById('profileList');
  list.innerHTML = '';
  
  profiles.forEach(profile => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div onclick="showProfileDetails(${profile.id})" style="flex: 1; cursor: pointer;">
        <div>${profile.name}</div>
        <small>${profile.phone}</small>
        <div class="debt-credit-summary">
          <span class="expense-item-text">দেনা: ${formatCurrency(profile.debt)}</span>
          <span class="income-item">পাওনা: ${formatCurrency(profile.credit)}</span>
        </div>
      </div>
      <button class="btn btn-danger" onclick="deleteProfile(${profile.id})">X</button>
    `;
    list.appendChild(div);
  });
}

function showProfileDetails(profileId) {
  const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  const profile = profiles.find(p => p.id === profileId);
  
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <h3>${profile.name}</h3>
      <p>${profile.phone}</p>
      <p>${profile.address}</p>
      
      <div class="summary-card">
        <div class="list-item">
          <span>মোট দেনা</span>
          <span class="expense-item-text">${formatCurrency(profile.debt)}</span>
        </div>
        <div class="list-item">
          <span>মোট পাওনা</span>
          <span class="income-item">${formatCurrency(profile.credit)}</span>
        </div>
      </div>
      
      <button class="btn" onclick="showAddTransactionModal(${profileId})">
        <i class="fas fa-plus"></i> নতুন লেনদেন
      </button>
      
      <div id="transactionList" class="list"></div>
      
      <button class="btn" onclick="loadDebtPage()">ফিরে যান</button>
    </div>
  `;
  
  showProfileTransactions(profile);
}

function showAddTransactionModal(profileId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>নতুন লেনদেন</h3>
      <div class="input-group">
        <select id="transactionType">
          <option value="debt">দেনা</option>
          <option value="credit">পাওনা</option>
        </select>
      </div>
      <div class="input-group">
        <input type="number" id="transactionAmount" placeholder="পরিমাণ (৳)" step="0.01">
      </div>
      <div class="input-group">
        <input type="text" id="transactionNote" placeholder="বিবরণ (ঐচ্ছিক)">
      </div>
      <div class="btn-group">
        <button class="btn btn-danger" onclick="this.closest('.modal').remove()">না</button>
        <button class="btn" onclick="addTransaction(${profileId})">হ্যাঁ</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function addTransaction(profileId) {
  const type = document.getElementById('transactionType').value;
  const amount = parseFloat(document.getElementById('transactionAmount').value);
  const note = document.getElementById('transactionNote').value.trim();
  
  if (!amount || amount <= 0) {
    showError('সঠিক পরিমাণ লিখুন');
    return;
  }
  
  const transaction = {
    id: Date.now(),
    type,
    amount,
    note,
    time: new Date().toLocaleString('bn-BD')
  };
  
  const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
  const profileIndex = profiles.findIndex(p => p.id === profileId);
  
  if (profileIndex === -1) return;
  
  profiles[profileIndex].transactions.push(transaction);
  
  if (type === 'debt') {
    profiles[profileIndex].debt += amount;
  } else {
    profiles[profileIndex].credit += amount;
  }
  
  localStorage.setItem('debt_profiles', JSON.stringify(profiles));
  document.querySelector('.modal').remove();
  showProfileDetails(profileId);
}

function showProfileTransactions(profile) {
  const list = document.getElementById('transactionList');
  list.innerHTML = '';
  
  profile.transactions.slice().reverse().forEach(transaction => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div>
        <span class="${transaction.type === 'debt' ? 'expense-item-text' : 'income-item'}">
          ${transaction.type === 'debt' ? 'দেনা' : 'পাওনা'} - ${formatCurrency(transaction.amount)}
        </span>
        ${transaction.note ? `<br><small>${transaction.note}</small>` : ''}
        <br>
        <small>${transaction.time}</small>
      </div>
      <button class="btn btn-danger" onclick="deleteTransaction(${profile.id}, ${transaction.id})">X</button>
    `;
    list.appendChild(div);
  });
}

function deleteTransaction(profileId, transactionId) {
  showConfirmationDialog('আপনি কি নিশ্চিত যে আপনি এই লেনদেনটি মুছে ফেলতে চান?', () => {
    const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
    const profileIndex = profiles.findIndex(p => p.id === profileId);
    
    if (profileIndex === -1) return;
    
    const transactionIndex = profiles[profileIndex].transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) return;
    
    const transaction = profiles[profileIndex].transactions[transactionIndex];
    
    if (transaction.type === 'debt') {
      profiles[profileIndex].debt -= transaction.amount;
    } else {
      profiles[profileIndex].credit -= transaction.amount;
    }
    
    profiles[profileIndex].transactions.splice(transactionIndex, 1);
    localStorage.setItem('debt_profiles', JSON.stringify(profiles));
    
    showProfileDetails(profileId);
  });
}

function deleteProfile(profileId) {
  showConfirmationDialog('আপনি কি নিশ্চিত যে আপনি এই প্রোফাইলটি মুছে ফেলতে চান?', () => {
    const profiles = JSON.parse(localStorage.getItem('debt_profiles')) || [];
    const filteredProfiles = profiles.filter(p => p.id !== profileId);
    localStorage.setItem('debt_profiles', JSON.stringify(filteredProfiles));
    loadDebtPage();
  });
} 