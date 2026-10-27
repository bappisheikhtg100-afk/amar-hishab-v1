function deleteTransaction(transactionId) {
  const currentMonthKey = document.getElementById('monthSelector').value;
  let transactions = JSON.parse(localStorage.getItem(`transactions_${currentMonthKey}`)) || [];
  
  // Convert IDs to numbers for comparison
  const idToDelete = Number(transactionId);
  const transaction = transactions.find(t => Number(t.id) === idToDelete);
  
  if (!transaction) {
    return;
  }
  
  showConfirmationDialog(`"${transaction.note}" মুছে ফেলতে চান?`, () => {
    try {
      // Update income/expense totals
      let income = parseFloat(localStorage.getItem(`income_${currentMonthKey}`)) || 0;
      let expense = parseFloat(localStorage.getItem(`expense_${currentMonthKey}`)) || 0;
      
      const amount = parseFloat(transaction.amount);
      
      if (transaction.type === 'income') {
        income -= amount;
        localStorage.setItem(`income_${currentMonthKey}`, income.toString());
      } else {
        expense -= amount;
        localStorage.setItem(`expense_${currentMonthKey}`, expense.toString());
      }
      
      // Remove transaction
      transactions = transactions.filter(t => Number(t.id) !== idToDelete);
      localStorage.setItem(`transactions_${currentMonthKey}`, JSON.stringify(transactions));
      
      // Reload the page to show updated data
      loadIncomeExpensePage();
      
      // Show success message
      showError('লেনদেন মুছে ফেলা হয়েছে');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showError('দুঃখিত, কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  });
} 