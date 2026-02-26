// BudgetBuddy - Main Application

class BudgetBuddy {
    constructor() {
        // Initialize services
        this.moneyService = new MoneyService();
        this.uiState = new UIStateManager();
        this.dataStore = new DataStore();

        // Data (will be migrated to DataStore in phases)
        // Phase 2 Session 1: accounts migrated to DataStore
        // Phase 2 Session 2: categories and groups migrated to DataStore
        this.transactions = this.loadData('transactions') || [];
        this.payees = this.loadData('payees') || [];
        this.allocations = this.loadData('allocations') || {};
        this.tbbHistory = this.loadData('tbb_history') || {};

        // Current editing state
        this.currentAccountId = null;
        this.currentCategoryId = null;
        this.currentGroupId = null;
        this.currentTransactionId = null;
        this.currentAllocation = null;

        // Budget calculation cache
        this.tbbCache = {}; // Cache for TBB calculations: key = 'year-month', value = {totalIncome, totalAllocated, totalOverspending, available}

        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupAccountManagement();
        this.setupCategoryManagement();
        this.setupGroupManagement();
        this.setupTransactionManagement();
        this.setupAllocationModal();
        this.setupDataManagement();
        this.setupSettingsNav();
        this.setupGlobalDropdownHandler();
        this.renderCategories();
        this.updateDashboard();

        // Check for orphaned transactions (transactions with invalid accountIds)
        this.checkOrphanedTransactions();
    }

    // ==================== DATA MIGRATION ====================

    checkOrphanedTransactions() {
        const orphaned = this.transactions.filter(t => {
            const account = this.dataStore.getAccount(t.accountId);
            return !account;
        });

        if (orphaned.length > 0) {
            console.warn(`Found ${orphaned.length} transactions with missing accounts`);
            // Show migration prompt after a brief delay to let UI load
            setTimeout(() => this.showOrphanedTransactionsMigration(orphaned), 1000);
        }
    }

    showOrphanedTransactionsMigration(orphanedTransactions) {
        const message = `Found ${orphanedTransactions.length} transaction(s) that reference deleted accounts.\n\nWould you like to fix this now? You'll be able to reassign them to existing accounts.`;

        if (confirm(message)) {
            this.openMigrationTool(orphanedTransactions);
        }
    }

    openMigrationTool(orphanedTransactions) {
        // Create a simple prompt-based migration
        const accountList = this.dataStore.getAccounts()
            .map((a, i) => `${i + 1}. ${a.name}`)
            .join('\n');

        const choice = prompt(
            `Reassign ${orphanedTransactions.length} orphaned transactions:\n\n` +
            `Available accounts:\n${accountList}\n\n` +
            `Enter account number (1-${this.dataStore.getAccounts().length}) to assign ALL orphaned transactions to that account.\n` +
            `Or enter 0 to delete all orphaned transactions.`
        );

        if (choice === null) return; // User cancelled

        const accountIndex = parseInt(choice) - 1;

        if (choice === '0') {
            // Delete orphaned transactions
            this.transactions = this.transactions.filter(t => {
                const account = this.dataStore.getAccount(t.accountId);
                return account !== null;
            });
            this.saveData('transactions', this.transactions);
            alert(`Deleted ${orphanedTransactions.length} orphaned transactions.`);
            this.renderTransactions();
            this.updateDashboard();
        } else if (accountIndex >= 0 && accountIndex < this.dataStore.getAccounts().length) {
            // Reassign to selected account
            const targetAccount = this.dataStore.getAccounts()[accountIndex];
            orphanedTransactions.forEach(orphan => {
                const idx = this.transactions.findIndex(t => t.id === orphan.id);
                if (idx !== -1) {
                    this.transactions[idx].accountId = targetAccount.id;
                }
            });
            this.saveData('transactions', this.transactions);
            alert(`Reassigned ${orphanedTransactions.length} transactions to "${targetAccount.name}".`);
            this.renderTransactions();
            this.updateDashboard();
        } else {
            alert('Invalid selection. Migration cancelled.');
        }
    }

    // Global handler for closing dropdowns when clicking outside (prevents memory leaks)
    setupGlobalDropdownHandler() {
        document.addEventListener('click', (e) => {
            // Find all active dropdowns
            const activeDropdowns = document.querySelectorAll('.searchable-select-dropdown.active');

            activeDropdowns.forEach(dropdown => {
                const wrapper = dropdown.closest('.searchable-select-wrapper');
                if (!wrapper) return;

                const searchInput = wrapper.querySelector('.searchable-select-input');

                // Close dropdown if click is outside both input and dropdown
                if (searchInput && !searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            });
        });
    }

    // Data Management
    loadData(key) {
        const data = localStorage.getItem(`budgetbuddy_${key}`);
        return data ? JSON.parse(data) : null;
    }

    saveData(key, data) {
        localStorage.setItem(`budgetbuddy_${key}`, JSON.stringify(data));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }


    // Generic modal setup helper to eliminate duplication
    setupModal(config) {
        const {
            modalId,
            closeCallback,
            submitCallback,
            deleteCallback = null,
            deleteBtnId = null
        } = config;

        const modal = document.getElementById(modalId);
        const closeBtn = document.getElementById(`close-${modalId}`);
        const cancelBtn = document.getElementById(`cancel-${modalId.replace('-modal', '-btn')}`);
        const form = document.getElementById(`${modalId.replace('-modal', '-form')}`);

        if (!modal || !closeBtn || !cancelBtn || !form) {
            console.warn(`Modal setup incomplete for ${modalId}`);
            return;
        }

        // Close button listeners
        closeBtn.addEventListener('click', closeCallback);
        cancelBtn.addEventListener('click', closeCallback);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeCallback();
        });

        // Form submit
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            submitCallback();
        });

        // Optional delete button
        if (deleteCallback && deleteBtnId) {
            const deleteBtn = document.getElementById(deleteBtnId);
            if (deleteBtn) {
                deleteBtn.addEventListener('click', deleteCallback);
            }
        }
    }

    // Navigation
    setupNavigation() {
        document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.switchView(item.dataset.view);
            });
        });
    }

    switchView(viewName) {
        // Update nav buttons
        document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');

        // Show/hide sidebar account list
        const accountList = document.getElementById('sidebar-account-list');
        if (accountList) accountList.style.display = viewName === 'transactions' ? 'block' : 'none';

        // Update data when switching to certain views
        if (viewName === 'dashboard') {
            this.updateDashboard();
        } else if (viewName === 'categories') {
            this.renderCategories();
        } else if (viewName === 'transactions') {
            this.renderTransactions();
        }
    }

    // Account Management
    setupAccountManagement() {
        this.setupModal({
            modalId: 'account-modal',
            closeCallback: () => this.closeAccountModal(),
            submitCallback: () => this.saveAccount()
        });
    }

    openAccountModal(accountId = null) {
        const modal = document.getElementById('account-modal');
        const title = document.getElementById('account-modal-title');
        const form = document.getElementById('account-form');

        this.currentAccountId = accountId;

        if (accountId) {
            // Edit mode
            title.textContent = 'Edit Account';
            const account = this.dataStore.getAccount(accountId);
            if (account) {
                document.getElementById('account-name').value = account.name;
                document.getElementById('account-type').value = account.type;
                document.getElementById('account-balance').value = account.balance;
                document.getElementById('account-notes').value = account.notes || '';
            }
        } else {
            // Add mode
            title.textContent = 'Add Account';
            form.reset();
        }

        modal.classList.add('active');
    }

    closeAccountModal() {
        const modal = document.getElementById('account-modal');
        modal.classList.remove('active');
        document.getElementById('account-form').reset();
        this.currentAccountId = null;
    }

    saveAccount() {
        const name = document.getElementById('account-name').value.trim();
        const type = document.getElementById('account-type').value;
        const balance = parseFloat(document.getElementById('account-balance').value);
        const notes = document.getElementById('account-notes').value.trim();

        if (!name || !type || isNaN(balance)) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            if (this.currentAccountId) {
                // Update existing account
                this.dataStore.updateAccount(this.currentAccountId, {
                    name,
                    type,
                    balance,
                    notes
                });
            } else {
                // Create new account
                this.dataStore.addAccount({
                    name,
                    type,
                    balance,
                    currency: 'USD', // Default currency
                    notes
                });
            }

            this.renderSidebarAccountList();
            this.updateDashboard();
            this.closeAccountModal();
        } catch (error) {
            alert('Error saving account: ' + error.message);
        }
    }

    deleteAccount(accountId) {
        if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
            return;
        }

        const success = this.dataStore.deleteAccount(accountId);
        if (success) {
            this.uiState.setFilterAccounts(this.uiState.getFilterAccounts().filter(id => id !== accountId));
            this.uiState.setDashFilterAccounts(this.uiState.getDashFilterAccounts().filter(id => id !== accountId));
            this.renderSidebarAccountList();
            this.updateDashboard();
        } else {
            alert('Account not found');
        }
    }

    // Group Management
    setupGroupManagement() {
        const addBtn = document.getElementById('add-group-btn');

        // Open modal for new group
        addBtn.addEventListener('click', () => {
            this.currentGroupId = null;
            this.openGroupModal();
        });

        this.setupModal({
            modalId: 'group-modal',
            closeCallback: () => this.closeGroupModal(),
            submitCallback: () => this.saveGroup(),
            deleteCallback: () => {
                const groupId = this.currentGroupId;
                this.closeGroupModal();
                this.deleteGroup(groupId);
            },
            deleteBtnId: 'delete-group-btn'
        });
    }

    openGroupModal(groupId = null) {
        const modal = document.getElementById('group-modal');
        const title = document.getElementById('group-modal-title');
        const form = document.getElementById('group-form');

        this.currentGroupId = groupId;

        if (groupId) {
            // Edit mode
            title.textContent = 'Edit Group';
            const group = this.dataStore.getGroup(groupId);
            if (group) {
                document.getElementById('group-name').value = group.name;
                document.getElementById('group-limit').value = group.monthlyLimit || '';
            }
        } else {
            // Add mode
            title.textContent = 'Add Group';
            form.reset();
        }

        document.getElementById('delete-group-btn').style.display = groupId ? '' : 'none';
        modal.classList.add('active');
    }

    closeGroupModal() {
        const modal = document.getElementById('group-modal');
        modal.classList.remove('active');
        document.getElementById('group-form').reset();
        this.currentGroupId = null;
    }

    saveGroup() {
        const name = document.getElementById('group-name').value.trim();
        const limitValue = document.getElementById('group-limit').value;
        const monthlyLimit = limitValue ? parseFloat(limitValue) : null;

        if (!name) {
            alert('Please enter a group name');
            return;
        }

        if (monthlyLimit !== null && (isNaN(monthlyLimit) || monthlyLimit < 0)) {
            alert('Please enter a valid monthly limit');
            return;
        }

        try {
            if (this.currentGroupId) {
                // Update existing group
                this.dataStore.updateGroup(this.currentGroupId, {
                    name,
                    monthlyLimit
                });
            } else {
                // Create new group
                this.dataStore.addGroup({
                    name,
                    monthlyLimit
                });
            }

            this.renderCategories();
            this.closeGroupModal();
        } catch (error) {
            alert('Error saving group: ' + error.message);
        }
    }

    deleteGroup(groupId) {
        if (!confirm('Are you sure you want to delete this group? Categories in this group will become ungrouped.')) {
            return;
        }

        // Ungroup all categories in this group
        this.dataStore.getCategories().forEach(cat => {
            if (cat.groupId === groupId) {
                this.dataStore.updateCategory(cat.id, { groupId: null });
            }
        });

        const success = this.dataStore.deleteGroup(groupId);
        if (success) {
            this.renderCategories();
        }
    }

    // Category Management
    setupCategoryManagement() {
        const addBtn = document.getElementById('add-category-btn');

        // Open modal for new category
        addBtn.addEventListener('click', () => {
            this.currentCategoryId = null;
            this.openCategoryModal();
        });

        this.setupModal({
            modalId: 'category-modal',
            closeCallback: () => this.closeCategoryModal(),
            submitCallback: () => this.saveCategory(),
            deleteCallback: () => {
                const categoryId = this.currentCategoryId;
                this.closeCategoryModal();
                this.deleteCategory(categoryId);
            },
            deleteBtnId: 'delete-category-btn'
        });
    }

    openCategoryModal(categoryId = null) {
        const modal = document.getElementById('category-modal');
        const title = document.getElementById('category-modal-title');
        const form = document.getElementById('category-form');
        const groupSelect = document.getElementById('category-group');

        this.currentCategoryId = categoryId;

        // Populate groups dropdown
        groupSelect.innerHTML = '<option value="">No Group</option>';
        this.dataStore.getGroups().forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });

        if (categoryId) {
            // Edit mode
            title.textContent = 'Edit Category';
            const category = this.dataStore.getCategory(categoryId);
            if (category) {
                document.getElementById('category-name').value = category.name;
                document.getElementById('category-group').value = category.groupId || '';
                document.getElementById('category-limit').value = category.monthlyLimit || '';
            }
        } else {
            // Add mode
            title.textContent = 'Add Category';
            form.reset();
        }

        document.getElementById('delete-category-btn').style.display = categoryId ? '' : 'none';
        modal.classList.add('active');
    }

    closeCategoryModal() {
        const modal = document.getElementById('category-modal');
        modal.classList.remove('active');
        document.getElementById('category-form').reset();
        this.currentCategoryId = null;
    }

    saveCategory() {
        const name = document.getElementById('category-name').value.trim();
        const groupId = document.getElementById('category-group').value || null;
        const limitValue = document.getElementById('category-limit').value;
        const monthlyLimit = limitValue ? parseFloat(limitValue) : null;

        if (!name) {
            alert('Please enter a category name');
            return;
        }

        if (monthlyLimit !== null && (isNaN(monthlyLimit) || monthlyLimit < 0)) {
            alert('Please enter a valid monthly limit');
            return;
        }

        try {
            if (this.currentCategoryId) {
                // Update existing category
                this.dataStore.updateCategory(this.currentCategoryId, {
                    name,
                    groupId,
                    monthlyLimit
                });
            } else {
                // Create new category
                this.dataStore.addCategory({
                    name,
                    groupId,
                    monthlyLimit
                });
            }

            this.renderCategories();
            this.closeCategoryModal();
        } catch (error) {
            alert('Error saving category: ' + error.message);
        }
    }

    deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
            return;
        }

        const success = this.dataStore.deleteCategory(categoryId);
        if (success) {
            this.uiState.setDashFilterCategories(this.uiState.getDashFilterCategories().filter(id => id !== categoryId));
            this.renderCategories();
        }
    }

    openAllocateModal(categoryId, year, month) {
        const modal = document.getElementById('allocate-modal');
        const category = this.dataStore.getCategories().find(c => c.id === categoryId);
        if (!category) return;

        this.currentAllocation = { categoryId, year, month };

        // Get current values
        const allocKey = `${categoryId}-${year}-${month}`;
        const currentAllocation = this.allocations[allocKey] || 0;
        const available = this.calculateAvailableFunds(year, month);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

        // Populate modal
        document.getElementById('allocate-category-name').textContent = category.name;
        document.getElementById('allocate-month').textContent = `${monthNames[month]} ${year}`;
        document.getElementById('allocate-available').textContent = this.moneyService.formatCurrency(available);
        document.getElementById('allocate-current').textContent = this.moneyService.formatCurrency(currentAllocation);
        document.getElementById('allocate-amount').value = currentAllocation || '';

        // Update quick action buttons
        const limitValue = category.monthlyLimit || 0;
        document.getElementById('allocate-limit-value').textContent = limitValue;
        document.getElementById('allocate-use-limit').style.display = limitValue > 0 ? '' : 'none';

        modal.classList.add('active');
        document.getElementById('allocate-amount').focus();
    }

    closeAllocateModal() {
        document.getElementById('allocate-modal').classList.remove('active');
        this.currentAllocation = null;
    }

    saveAllocation() {
        if (!this.currentAllocation) return;

        const { categoryId, year, month } = this.currentAllocation;
        const amountInput = document.getElementById('allocate-amount');
        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount < 0) {
            alert('Please enter a valid amount (0 or greater)');
            return;
        }

        // Save allocation
        const allocKey = `${categoryId}-${year}-${month}`;
        if (amount === 0) {
            delete this.allocations[allocKey];
        } else {
            this.allocations[allocKey] = amount;
        }

        this.saveData('allocations', this.allocations);
        this.invalidateTBBCache(year, month);
        this.closeAllocateModal();
        this.renderCategories();
    }

    useMonthlyLimit() {
        const category = this.dataStore.getCategories().find(c => c.id === this.currentAllocation.categoryId);
        if (category && category.monthlyLimit) {
            document.getElementById('allocate-amount').value = category.monthlyLimit;
        }
    }

    useAllAvailable() {
        const { year, month } = this.currentAllocation;
        const available = this.calculateAvailableFunds(year, month);
        document.getElementById('allocate-amount').value = Math.max(0, available);
    }

    autoAllocateAll() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        let allocated = 0;
        this.dataStore.getCategories().forEach(cat => {
            if (cat.monthlyLimit && cat.monthlyLimit > 0) {
                const allocKey = `${cat.id}-${year}-${month}`;
                this.allocations[allocKey] = cat.monthlyLimit;
                allocated++;
            }
        });

        if (allocated > 0) {
            this.saveData('allocations', this.allocations);
            this.invalidateTBBCache(year, month);
            this.renderCategories();
            alert(`Auto-allocated ${allocated} categories using their monthly limits.`);
        } else {
            alert('No categories have monthly limits set.');
        }
    }

    openQuickAllocate(year, month) {
        if (this.dataStore.getCategories().length === 0) {
            alert('No categories available. Create categories first.');
            return;
        }

        const available = this.calculateAvailableFunds(year, month);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

        const message = `Quick Allocate for ${monthNames[month]} ${year}\n\nAvailable: ${this.moneyService.formatCurrency(available)}\n\nOptions:\n1. Auto-allocate using monthly limits\n2. Distribute evenly across all categories\n3. Cancel`;

        // Simple prompt for now - can be enhanced with a proper modal later
        const choice = prompt(message, '1');

        if (choice === '1') {
            // Auto-allocate using limits
            let allocated = 0;
            this.dataStore.getCategories().forEach(cat => {
                if (cat.monthlyLimit && cat.monthlyLimit > 0) {
                    const allocKey = `${cat.id}-${year}-${month}`;
                    this.allocations[allocKey] = cat.monthlyLimit;
                    allocated++;
                }
            });

            if (allocated > 0) {
                this.saveData('allocations', this.allocations);
                this.invalidateTBBCache(year, month);
                this.renderCategories();
                alert(`Auto-allocated ${allocated} categories.`);
            } else {
                alert('No categories have monthly limits set.');
            }
        } else if (choice === '2') {
            // Distribute evenly
            const perCategory = Math.floor((available / this.dataStore.getCategories().length) * 100) / 100;
            if (perCategory > 0) {
                this.dataStore.getCategories().forEach(cat => {
                    const allocKey = `${cat.id}-${year}-${month}`;
                    this.allocations[allocKey] = perCategory;
                });

                this.saveData('allocations', this.allocations);
                this.invalidateTBBCache(year, month);
                this.renderCategories();
                alert(`Allocated ${this.moneyService.formatCurrency(perCategory)} to each of ${this.dataStore.getCategories().length} categories.`);
            } else {
                alert('Not enough funds to distribute.');
            }
        }
    }

    setupAllocationModal() {
        const modal = document.getElementById('allocate-modal');
        const closeBtn = modal.querySelector('.close-btn');
        const cancelBtn = modal.querySelector('.btn-secondary');
        const saveBtn = document.getElementById('save-allocation-btn');
        const useLimitBtn = document.getElementById('allocate-use-limit');
        const useAvailableBtn = document.getElementById('allocate-use-available');
        const autoAllocateBtn = document.getElementById('auto-allocate-btn');

        closeBtn.addEventListener('click', () => this.closeAllocateModal());
        cancelBtn.addEventListener('click', () => this.closeAllocateModal());
        saveBtn.addEventListener('click', () => this.saveAllocation());
        useLimitBtn.addEventListener('click', () => this.useMonthlyLimit());
        useAvailableBtn.addEventListener('click', () => this.useAllAvailable());
        autoAllocateBtn.addEventListener('click', () => this.autoAllocateAll());

        // Keyboard shortcuts
        document.getElementById('allocate-amount').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.saveAllocation();
            if (e.key === 'Escape') this.closeAllocateModal();
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeAllocateModal();
        });
    }

    // Data Import/Export
    setupDataManagement() {
        // Export modal
        const exportBtn = document.getElementById('export-data-btn');
        const exportModal = document.getElementById('export-modal');
        const closeExportBtn = document.getElementById('close-export-modal');
        const cancelExportBtn = document.getElementById('cancel-export-btn');
        const downloadExportBtn = document.getElementById('download-export-btn');

        exportBtn.addEventListener('click', () => this.openExportModal());
        closeExportBtn.addEventListener('click', () => this.closeExportModal());
        cancelExportBtn.addEventListener('click', () => this.closeExportModal());
        downloadExportBtn.addEventListener('click', () => this.executeExport());
        exportModal.addEventListener('click', (e) => {
            if (e.target === exportModal) this.closeExportModal();
        });

        // Import modal
        const importBtn = document.getElementById('import-data-btn');
        const importModal = document.getElementById('import-modal');
        const closeImportBtn = document.getElementById('close-import-modal');
        const cancelImportBtn = document.getElementById('cancel-import-btn');
        const executeImportBtn = document.getElementById('execute-import-btn');
        const importFileInput = document.getElementById('import-file');

        importBtn.addEventListener('click', () => this.openImportModal());
        closeImportBtn.addEventListener('click', () => this.closeImportModal());
        cancelImportBtn.addEventListener('click', () => this.closeImportModal());
        executeImportBtn.addEventListener('click', () => this.executeImport());
        importFileInput.addEventListener('change', (e) => this.handleImportFileSelect(e));
        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) this.closeImportModal();
        });
    }

    openExportModal() {
        const modal = document.getElementById('export-modal');
        modal.classList.add('active');
    }

    closeExportModal() {
        const modal = document.getElementById('export-modal');
        modal.classList.remove('active');
    }

    openImportModal() {
        const modal = document.getElementById('import-modal');
        document.getElementById('import-file').value = '';
        document.getElementById('execute-import-btn').disabled = true;
        document.getElementById('import-preview').style.display = 'none';
        modal.classList.add('active');
    }

    closeImportModal() {
        const modal = document.getElementById('import-modal');
        modal.classList.remove('active');
    }

    async executeExport() {
        const exportAccounts = document.getElementById('export-accounts').checked;
        const exportCategories = document.getElementById('export-categories').checked;
        const exportGroups = document.getElementById('export-groups').checked;
        const exportTransactions = document.getElementById('export-transactions').checked;
        const exportAllocations = document.getElementById('export-allocations').checked;
        const dateFrom = document.getElementById('export-date-from').value;
        const dateTo = document.getElementById('export-date-to').value;

        const selectedCount = [exportAccounts, exportCategories, exportGroups, exportTransactions, exportAllocations].filter(Boolean).length;

        if (selectedCount === 0) {
            alert('Please select at least one data type to export');
            return;
        }

        const files = {};

        // Generate CSV files for selected data types
        if (exportAccounts) {
            files['accounts.csv'] = this.generateAccountsCSV();
        }
        if (exportCategories) {
            files['categories.csv'] = this.generateCategoriesCSV();
        }
        if (exportGroups) {
            files['groups.csv'] = this.generateGroupsCSV();
        }
        if (exportTransactions) {
            files['transactions.csv'] = this.generateTransactionsCSV(dateFrom, dateTo);
        }
        if (exportAllocations) {
            files['allocations.csv'] = this.generateAllocationsCSV();
        }

        // Download files individually
        const filenames = Object.keys(files);

        // Download each file with a small delay to prevent browser blocking
        for (let i = 0; i < filenames.length; i++) {
            const filename = filenames[i];
            const content = files[filename];

            // Add small delay between downloads (except for first file)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            this.downloadFile(filename, content, 'text/csv');
        }

        this.closeExportModal();
    }

    generateAccountsCSV() {
        const headers = ['ID', 'Name', 'Type', 'Balance', 'Notes'];
        const rows = this.dataStore.getAccounts().map(acc => [
            acc.id,
            this.escapeCSV(acc.name),
            acc.type,
            acc.balance,
            this.escapeCSV(acc.notes || '')
        ]);
        return this.arrayToCSV([headers, ...rows]);
    }

    generateCategoriesCSV() {
        const headers = ['ID', 'Name', 'Group ID', 'Group Name', 'Monthly Limit'];
        const rows = this.dataStore.getCategories().map(cat => {
            const group = cat.groupId ? this.dataStore.getGroups().find(g => g.id === cat.groupId) : null;
            return [
                cat.id,
                this.escapeCSV(cat.name),
                cat.groupId || '',
                group ? this.escapeCSV(group.name) : '',
                cat.monthlyLimit || ''
            ];
        });
        return this.arrayToCSV([headers, ...rows]);
    }

    generateGroupsCSV() {
        const headers = ['ID', 'Name', 'Monthly Limit'];
        const rows = this.dataStore.getGroups().map(grp => [
            grp.id,
            this.escapeCSV(grp.name),
            grp.monthlyLimit || ''
        ]);
        return this.arrayToCSV([headers, ...rows]);
    }

    generateTransactionsCSV(dateFrom, dateTo) {
        const headers = ['Transaction ID', 'Split #', 'Date', 'Type', 'Payee', 'Account ID', 'Account Name', 'To Account ID', 'To Account Name', 'Total Amount', 'Category ID', 'Category Name', 'Split Amount', 'Notes'];

        let transactions = this.transactions;

        // Filter by date range if provided
        if (dateFrom) {
            transactions = transactions.filter(t => t.date >= dateFrom);
        }
        if (dateTo) {
            transactions = transactions.filter(t => t.date <= dateTo);
        }

        const rows = [];
        transactions.forEach(t => {
            const account = this.dataStore.getAccounts().find(a => a.id === t.accountId);
            const toAccount = t.toAccountId ? this.dataStore.getAccounts().find(a => a.id === t.toAccountId) : null;

            if (t.splits && t.splits.length > 0) {
                // Multiple rows for split transaction
                t.splits.forEach((split, idx) => {
                    const category = this.dataStore.getCategories().find(c => c.id === split.categoryId);
                    rows.push([
                        t.id,
                        idx + 1,
                        t.date,
                        t.type,
                        this.escapeCSV(t.payee || ''),
                        t.accountId,
                        account ? this.escapeCSV(account.name) : '',
                        t.toAccountId || '',
                        toAccount ? this.escapeCSV(toAccount.name) : '',
                        t.totalAmount,
                        split.categoryId,
                        category ? this.escapeCSV(category.name) : '',
                        split.amount,
                        idx === 0 ? this.escapeCSV(t.notes || '') : ''
                    ]);
                });
            } else {
                // Single row for non-split transaction
                rows.push([
                    t.id,
                    1,
                    t.date,
                    t.type,
                    this.escapeCSV(t.payee || ''),
                    t.accountId,
                    account ? this.escapeCSV(account.name) : '',
                    t.toAccountId || '',
                    toAccount ? this.escapeCSV(toAccount.name) : '',
                    t.totalAmount,
                    '',
                    '',
                    '',
                    this.escapeCSV(t.notes || '')
                ]);
            }
        });

        return this.arrayToCSV([headers, ...rows]);
    }

    generateAllocationsCSV() {
        const headers = ['Category ID', 'Category Name', 'Year', 'Month', 'Month Name', 'Amount'];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const rows = [];
        Object.keys(this.allocations).forEach(key => {
            const [categoryId, year, month] = key.split('-');
            const category = this.dataStore.getCategories().find(c => c.id === categoryId);
            const amount = this.allocations[key];

            rows.push([
                categoryId,
                category ? this.escapeCSV(category.name) : '',
                year,
                parseInt(month) + 1,
                monthNames[parseInt(month)],
                amount
            ]);
        });

        return this.arrayToCSV([headers, ...rows]);
    }

    escapeCSV(str) {
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    arrayToCSV(array) {
        return array.map(row => row.join(',')).join('\n');
    }

    downloadFile(filename, content, mimeType) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async handleImportFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            document.getElementById('execute-import-btn').disabled = true;
            return;
        }

        try {
            let parsedData = {};

            if (file.name.endsWith('.csv')) {
                // Handle CSV file
                const text = await file.text();
                const parsed = this.parseCSV(text);

                // Detect data type from CSV headers
                const dataType = this.detectDataType(parsed);
                if (dataType) {
                    parsedData[dataType] = parsed;
                } else {
                    alert('Unable to determine data type from CSV headers. Please use exported CSV files.');
                    return;
                }
            } else {
                alert('Please select a CSV file');
                return;
            }

            // Store parsed data for import
            this.importData = parsedData;

            // Show preview
            this.showImportPreview(parsedData);
            document.getElementById('execute-import-btn').disabled = false;

        } catch (error) {
            alert('Error reading file: ' + error.message);
            document.getElementById('execute-import-btn').disabled = true;
        }
    }

    parseCSV(text) {
        const lines = text.trim().split('\n');

        // Detect delimiter (tab or comma)
        const firstLine = lines[0];
        const delimiter = firstLine.includes('\t') ? '\t' : ',';

        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i], delimiter);
            const obj = {};
            headers.forEach((header, idx) => {
                obj[header] = values[idx] || '';
            });
            rows.push(obj);
        }

        return rows;
    }

    parseCSVLine(line, delimiter = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    detectDataType(parsedData) {
        if (!parsedData || parsedData.length === 0) return null;

        // Get the column headers (keys from first row)
        const headers = Object.keys(parsedData[0]);

        // Check for transaction-specific headers
        if (headers.includes('Transaction ID') || headers.includes('Split #')) {
            return 'transactions';
        }

        // Check for account-specific headers
        if (headers.includes('Balance') && headers.includes('Type') && !headers.includes('Group ID')) {
            return 'accounts';
        }

        // Check for category-specific headers
        if (headers.includes('Group ID') || headers.includes('Group Name')) {
            return 'categories';
        }

        // Check for group-specific headers (has Name and Monthly Limit, but not Group ID)
        if (headers.includes('Name') && headers.includes('Monthly Limit') && !headers.includes('Group ID')) {
            return 'groups';
        }

        // Check for allocation-specific headers
        if (headers.includes('Category ID') && headers.includes('Month') && headers.includes('Amount')) {
            return 'allocations';
        }

        return null;
    }

    showImportPreview(parsedData) {
        const preview = document.getElementById('import-preview');
        const content = document.getElementById('import-preview-content');

        const summary = [];
        if (parsedData.accounts) summary.push(`${parsedData.accounts.length} accounts`);
        if (parsedData.categories) summary.push(`${parsedData.categories.length} categories`);
        if (parsedData.groups) summary.push(`${parsedData.groups.length} groups`);
        if (parsedData.transactions) summary.push(`${parsedData.transactions.length} transaction rows`);
        if (parsedData.allocations) summary.push(`${parsedData.allocations.length} allocations`);

        content.textContent = 'Ready to import: ' + summary.join(', ');
        preview.style.display = 'block';
    }

    executeImport() {
        console.log('=== IMPORT STARTED ===');

        if (!this.importData) {
            alert('No data to import');
            return;
        }

        console.log('Import data types:', Object.keys(this.importData));
        console.log('Accounts to import:', this.importData.accounts?.length || 0);
        console.log('Categories to import:', this.importData.categories?.length || 0);
        console.log('Transactions to import:', this.importData.transactions?.length || 0);

        const mode = document.querySelector('input[name="import-mode"]:checked').value;
        console.log('Import mode:', mode);

        const confirmMsg = mode === 'replace'
            ? 'This will REPLACE ALL your current data. Are you sure?'
            : 'This will ADD the imported data to your current data. Continue?';

        if (!confirm(confirmMsg)) {
            console.log('Import cancelled by user');
            return;
        }

        try {
            // In replace mode, only clear data types that are being imported
            if (mode === 'replace') {
                if (this.importData.accounts) {
                    this.dataStore.accounts = [];
                    this.dataStore.saveData('accounts', []);
                }
                if (this.importData.groups) {
                    this.dataStore.groups = [];
                    this.dataStore.saveData('groups', []);
                }
                if (this.importData.categories) {
                    this.dataStore.categories = [];
                    this.dataStore.saveData('categories', []);
                }
                if (this.importData.transactions) {
                    this.transactions = [];
                    this.payees = [];
                }
                if (this.importData.allocations) {
                    this.allocations = {};
                }
            }

            // Import data
            if (this.importData.accounts) {
                this.importAccounts(this.importData.accounts, mode);
            }
            if (this.importData.groups) {
                this.importGroups(this.importData.groups, mode);
            }
            if (this.importData.categories) {
                this.importCategories(this.importData.categories, mode);
            }
            if (this.importData.transactions) {
                console.log(`Calling importTransactions with ${this.importData.transactions.length} rows...`);
                this.importTransactions(this.importData.transactions, mode);
                console.log(`After importTransactions, this.transactions has ${this.transactions.length} items`);
            }
            if (this.importData.allocations) {
                this.importAllocations(this.importData.allocations, mode);
            }

            // Save all data
            // Note: Import methods manipulate DataStore arrays directly for performance
            // (avoiding multiple saves), so we save once here at the end
            this.dataStore.saveData('categories', this.dataStore.categories);
            this.dataStore.saveData('groups', this.dataStore.groups);
            this.saveData('transactions', this.transactions);
            this.saveData('allocations', this.allocations);
            this.saveData('payees', this.payees);

            // Refresh UI
            this.renderCategories();
            this.renderTransactions();
            this.updateDashboard();

            this.closeImportModal();
            alert('Data imported successfully!');

        } catch (error) {
            alert('Error importing data: ' + error.message);
        }
    }

    importAccounts(data, mode) {
        console.log('=== IMPORT ACCOUNTS DEBUG ===');
        console.log('First row data:', data[0]);

        data.forEach(row => {
            // Clean balance value by removing currency symbols and commas
            const balanceStr = (row.Balance || '0').replace(/[$,]/g, '');

            console.log('Processing account:', {
                name: row.Name,
                rawBalance: row.Balance,
                cleanedBalance: balanceStr,
                parsedBalance: parseFloat(balanceStr)
            });

            const account = {
                id: row.ID || this.generateId(),
                name: row.Name,
                type: row.Type,
                balance: parseFloat(balanceStr) || 0,
                notes: row.Notes || '',
                currency: 'USD',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (mode === 'merge') {
                // Check for duplicates by ID or name
                const existingIndex = this.dataStore.accounts.findIndex(a => a.id === account.id || a.name === account.name);
                if (existingIndex !== -1) {
                    // Update existing account with imported data
                    const existing = this.dataStore.accounts[existingIndex];
                    this.dataStore.accounts[existingIndex] = {
                        ...existing,
                        type: account.type || existing.type,
                        balance: account.balance,
                        notes: account.notes || existing.notes,
                        updatedAt: new Date().toISOString()
                    };
                    console.log(`Updated existing account: ${account.name} with balance ${account.balance}`);
                } else {
                    this.dataStore.accounts.push(account);
                    console.log(`Added new account: ${account.name}`);
                }
            } else {
                this.dataStore.accounts.push(account);
            }
        });
        this.dataStore.saveData('accounts', this.dataStore.accounts);
    }

    importGroups(data, mode) {
        // Note: Directly manipulate DataStore array for bulk import performance
        // Data is saved once after all imports complete
        data.forEach(row => {
            const group = {
                id: row.ID || this.generateId(),
                name: row.Name,
                monthlyLimit: row['Monthly Limit'] ? parseFloat(row['Monthly Limit']) : null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (mode === 'merge') {
                // Check for duplicates by ID or name
                const existing = this.dataStore.groups.find(g => g.id === group.id || g.name === group.name);
                if (!existing) {
                    this.dataStore.groups.push(group);
                }
            } else {
                this.dataStore.groups.push(group);
            }
        });
    }

    importCategories(data, mode) {
        // Note: Directly manipulate DataStore array for bulk import performance
        // Data is saved once after all imports complete
        data.forEach(row => {
            // Match group by ID or name, or create if doesn't exist
            let groupId = row['Group ID'] || null;
            if (!groupId && row['Group Name']) {
                let group = this.dataStore.groups.find(g => g.name === row['Group Name']);

                // Auto-create group if it doesn't exist
                if (!group && row['Group Name'].trim()) {
                    group = {
                        id: this.generateId(),
                        name: row['Group Name'].trim(),
                        monthlyLimit: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    this.dataStore.groups.push(group);
                    console.log(`Auto-created group: ${group.name}`);
                }

                groupId = group ? group.id : null;
            }

            const category = {
                id: row.ID || this.generateId(),
                name: row.Name,
                groupId: groupId,
                monthlyLimit: row['Monthly Limit'] ? parseFloat(row['Monthly Limit']) : null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (mode === 'merge') {
                // Check for duplicates by ID or name
                const existing = this.dataStore.categories.find(c => c.id === category.id || c.name === category.name);
                if (!existing) {
                    this.dataStore.categories.push(category);
                }
            } else {
                this.dataStore.categories.push(category);
            }
        });
    }

    importTransactions(data, mode) {
        // Group by transaction ID or generate new groups
        const transactionMap = {};
        let txCounter = 1;

        data.forEach(row => {
            let txId = row['Transaction ID'];
            if (!txId) {
                // Generate transaction ID based on date and counter
                txId = `imported-tx-${row.Date}-${txCounter++}`;
            }
            if (!transactionMap[txId]) {
                transactionMap[txId] = [];
            }
            transactionMap[txId].push(row);
        });

        // Convert to transactions
        Object.keys(transactionMap).forEach(txId => {
            const rows = transactionMap[txId];
            const firstRow = rows[0];

            // Match account by ID or name
            let accountId = firstRow['Account ID'];
            // Check if account with this ID exists, if not try matching by name
            if (accountId && !this.dataStore.getAccount(accountId)) {
                console.log(`Account ID ${accountId} not found, trying to match by name: ${firstRow['Account Name']}`);
                accountId = null;
            }
            if (!accountId && firstRow['Account Name']) {
                let account = this.dataStore.getAccounts().find(a => a.name === firstRow['Account Name']);

                // Auto-create account if it doesn't exist (Option B)
                if (!account && firstRow['Account Name'].trim()) {
                    const newAccount = {
                        id: this.generateId(),
                        name: firstRow['Account Name'].trim(),
                        type: 'chequing', // Default type
                        balance: 0, // Will be calculated from transactions
                        notes: 'Auto-created during import',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    this.dataStore.accounts.push(newAccount);
                    account = newAccount;
                    console.log(`Auto-created account: ${account.name}`);
                }

                accountId = account ? account.id : null;
                console.log(`Matched account by name "${firstRow['Account Name']}" -> ${accountId || 'NOT FOUND'}`);
            }

            // Match to-account by ID or name (for transfers)
            let toAccountId = firstRow['To Account ID'] || null;
            // Check if account with this ID exists, if not try matching by name
            if (toAccountId && !this.dataStore.getAccount(toAccountId)) {
                toAccountId = null;
            }
            if (!toAccountId && firstRow['To Account Name']) {
                let toAccount = this.dataStore.getAccounts().find(a => a.name === firstRow['To Account Name']);

                // Auto-create to-account if it doesn't exist (for transfers)
                if (!toAccount && firstRow['To Account Name'].trim()) {
                    const newAccount = {
                        id: this.generateId(),
                        name: firstRow['To Account Name'].trim(),
                        type: 'chequing', // Default type
                        balance: 0, // Will be calculated from transactions
                        notes: 'Auto-created during import',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    this.dataStore.accounts.push(newAccount);
                    toAccount = newAccount;
                    console.log(`Auto-created to-account: ${toAccount.name}`);
                }

                toAccountId = toAccount ? toAccount.id : null;
            }

            // Build splits, matching categories by ID or name
            const splits = rows.map(row => {
                let categoryId = row['Category ID'];
                // Check if category with this ID exists, if not try matching by name
                if (categoryId && !this.dataStore.getCategories().find(c => c.id === categoryId)) {
                    categoryId = null;
                }
                if (!categoryId && row['Category Name']) {
                    const category = this.dataStore.categories.find(c => c.name === row['Category Name']);
                    categoryId = category ? category.id : null;
                }

                return {
                    categoryId: categoryId,
                    amount: parseFloat(row['Split Amount']) || parseFloat(row['Total Amount']) || 0
                };
            }).filter(split => split.categoryId);

            const transaction = {
                id: txId,
                date: firstRow.Date,
                type: firstRow.Type,
                payee: firstRow.Payee || '',
                accountId: accountId,
                toAccountId: toAccountId,
                totalAmount: parseFloat(firstRow['Total Amount']) || 0,
                splits: splits.length > 0 ? splits : [],
                notes: firstRow.Notes || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Skip if account not found
            if (!transaction.accountId) {
                console.warn(`Skipping transaction - account not found: ${firstRow['Account Name']}`);
                return;
            }

            // Debug: Log successful import
            console.log(`Importing transaction: ${transaction.date} ${transaction.type} ${transaction.totalAmount} for account ${accountId}`);

            if (transaction.payee && !this.payees.includes(transaction.payee)) {
                this.payees.push(transaction.payee);
            }

            if (mode === 'merge') {
                const existing = this.transactions.find(t => t.id === transaction.id);
                if (!existing) {
                    this.transactions.push(transaction);
                    console.log(`Added transaction (merge mode): ${transaction.id}`);
                }
            } else {
                this.transactions.push(transaction);
                console.log(`Added transaction (replace mode): ${transaction.id}`);
            }
        });
    }

    importAllocations(data, mode) {
        data.forEach(row => {
            // Match category by ID or name
            let categoryId = row['Category ID'];
            if (!categoryId && row['Category Name']) {
                const category = this.dataStore.categories.find(c => c.name === row['Category Name']);
                categoryId = category ? category.id : null;
            }

            if (!categoryId) {
                console.warn('Allocation skipped: category not found', row);
                return;
            }

            const year = row.Year;
            const month = parseInt(row.Month) - 1; // Convert from 1-indexed to 0-indexed
            const amount = parseFloat(row.Amount) || 0;
            const key = `${categoryId}-${year}-${month}`;

            if (mode === 'merge') {
                if (!this.allocations[key]) {
                    this.allocations[key] = amount;
                }
            } else {
                this.allocations[key] = amount;
            }
        });
    }

    shiftCategoryView(direction) {
        this.uiState.setCategoryViewOffset(this.uiState.getCategoryViewOffset() + direction);
        this.renderCategories();
    }

    renderCategories() {
        const container = document.getElementById('categories-container');

        if (this.dataStore.getGroups().length === 0 && this.dataStore.getCategories().length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📁</div>
                    <div class="empty-state-text">No categories or groups yet. Create a group or add categories to get started!</div>
                </div>
            `;
            return;
        }

        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const centerTotal = currentYear * 12 + currentMonth + this.uiState.getCategoryViewOffset();

        // Compute 3 visible months: current, 2 future
        const months = [];
        for (let i = 0; i <= 2; i++) {
            const total = centerTotal + i;
            months.push({
                year: Math.floor(total / 12),
                month: ((total % 12) + 12) % 12
            });
        }

        // Pre-compute spending map: key = "catId-year-month", value = net spent (expense +, income -)
        // Use cached version if available
        if (!this.uiState.getSpendingMapCache()) {
            const spentMap = {};
            this.transactions.forEach(t => {
                if (!t.splits) return;
                const parts = t.date.split('-');
                const tYear = parseInt(parts[0], 10);
                const tMonth = parseInt(parts[1], 10) - 1;
                t.splits.forEach(split => {
                    const key = `${split.categoryId}-${tYear}-${tMonth}`;
                    if (!spentMap[key]) spentMap[key] = 0;
                    spentMap[key] += t.type === 'expense' ? split.amount : -split.amount;
                });
            });
            this.uiState.setSpendingMapCache(spentMap);
        }
        const spentMap = this.uiState.getSpendingMapCache();

        // Helper: generate Budget / Spent / Balance cells for one month with click handler
        const genCellsWithClick = (categoryId, budget, spent, isCurrent, year, month) => {
            const balance = budget - spent;
            const cm = isCurrent ? ' current-month' : '';
            const budgetCell = `<div class="category-cell category-budget-cell month-start${cm} editable-budget" onclick="app.openAllocateModal('${categoryId}', ${year}, ${month})" title="Click to allocate">${this.moneyService.formatCurrency(budget)}</div>`;
            return budgetCell +
                   `<div class="category-cell category-spent-cell${spent < 0 ? ' income' : ''}${cm}">${this.moneyService.formatCurrency(spent)}</div>` +
                   `<div class="category-cell category-balance-cell${balance >= 0 ? ' positive' : ' negative'}${cm}">${this.moneyService.formatCurrency(balance)}</div>`;
        };

        // Helper: generate Budget / Spent / Balance cells for group rows (no click)
        const genCells = (budget, spent, isCurrent) => {
            const balance = budget - spent;
            const cm = isCurrent ? ' current-month' : '';
            return `<div class="category-cell category-budget-cell month-start${cm}">${this.moneyService.formatCurrency(budget)}</div>` +
                   `<div class="category-cell category-spent-cell${spent < 0 ? ' income' : ''}${cm}">${this.moneyService.formatCurrency(spent)}</div>` +
                   `<div class="category-cell category-balance-cell${balance >= 0 ? ' positive' : ' negative'}${cm}">${this.moneyService.formatCurrency(balance)}</div>`;
        };

        // Header row 1: month names
        let headerMonths = '<div class="category-header-month name-col">Category</div>';
        months.forEach(m => {
            const isCurrent = m.year === currentYear && m.month === currentMonth;
            headerMonths += `<div class="category-header-month${isCurrent ? ' current' : ''}" style="grid-column: span 3">${MONTH_NAMES[m.month]} ${m.year}</div>`;
        });

        // Header row 2: Budget / Spent / Balance labels
        let headerSubs = '<div class="category-header-sub name-col"></div>';
        months.forEach(m => {
            const isCurrent = m.year === currentYear && m.month === currentMonth;
            const cm = isCurrent ? ' current' : '';
            headerSubs += `<div class="category-header-sub${cm} month-start">Budget</div>`;
            headerSubs += `<div class="category-header-sub${cm}">Spent</div>`;
            headerSubs += `<div class="category-header-sub${cm}">Balance</div>`;
        });

        // Helper: single category row
        const renderCatRow = (category, grouped, isEven) => {
            const evenOddClass = isEven ? ' category-row-even' : ' category-row-odd';
            let row = `<div class="category-row${grouped ? ' category-grouped-row' : ''}${evenOddClass}">`;
            row += `<div class="category-cell category-name-cell" onclick="app.openCategoryModal('${category.id}')">${this.escapeHtml(category.name)}</div>`;
            months.forEach(m => {
                const spent = spentMap[`${category.id}-${m.year}-${m.month}`] || 0;
                const budget = this.getCategoryBudget(category.id, m.year, m.month);
                row += genCellsWithClick(category.id, budget, spent, m.year === currentYear && m.month === currentMonth, m.year, m.month);
            });
            row += '</div>';
            return row;
        };

        // Helper: group summary row
        const renderGroupRow = (group, cats) => {
            const budget = cats.reduce((sum, cat) => sum + (cat.monthlyLimit || 0), 0);
            const isCollapsed = this.uiState.getCollapsedGroups().has(group.id);
            const chevron = `<span class="group-chevron${isCollapsed ? ' collapsed' : ''}"></span>`;
            let row = '<div class="category-row category-group-row">';
            row += `<div class="category-cell category-name-cell category-group-name" onclick="app.toggleGroupCollapse('${group.id}')" ondblclick="app.openGroupModal('${group.id}'); event.stopPropagation();">${chevron}${this.escapeHtml(group.name)}</div>`;
            months.forEach(m => {
                const isCurrent = m.year === currentYear && m.month === currentMonth;
                let groupSpent = 0;
                cats.forEach(cat => {
                    groupSpent += spentMap[`${cat.id}-${m.year}-${m.month}`] || 0;
                });
                row += genCells(budget, groupSpent, isCurrent);
            });
            row += '</div>';
            return row;
        };

        // Build body rows
        let body = '';
        let categoryCounter = 0;
        this.dataStore.getGroups().forEach(group => {
            const groupCats = this.dataStore.getCategories().filter(c => c.groupId === group.id);
            body += renderGroupRow(group, groupCats);
            if (!this.uiState.getCollapsedGroups().has(group.id)) {
                groupCats.forEach(cat => {
                    body += renderCatRow(cat, true, categoryCounter % 2 === 0);
                    categoryCounter++;
                });
            }
        });

        const ungrouped = this.dataStore.getCategories().filter(c => !c.groupId);
        if (ungrouped.length > 0) {
            if (this.dataStore.getGroups().length > 0) {
                body += '<div class="category-row category-section-divider">';
                body += '<div class="category-cell category-name-cell">Ungrouped</div>';
                months.forEach(m => {
                    const isCurrent = m.year === currentYear && m.month === currentMonth;
                    const cm = isCurrent ? ' current-month' : '';
                    body += `<div class="category-cell month-start${cm}"></div>`;
                    body += `<div class="category-cell${cm}"></div>`;
                    body += `<div class="category-cell${cm}"></div>`;
                });
                body += '</div>';
            }
            ungrouped.forEach(cat => {
                body += renderCatRow(cat, false, categoryCounter % 2 === 0);
                categoryCounter++;
            });
        }

        // Navigation bar (moved to top)
        const navLabel = `${MONTH_NAMES[months[0].month]} ${months[0].year} \u2013 ${MONTH_NAMES[months[2].month]} ${months[2].year}`;
        const nav = `<div class="category-nav">
            <button class="category-nav-btn" onclick="app.shiftCategoryView(-1)">&larr;</button>
            <span class="category-nav-label">${navLabel}</span>
            <button class="category-nav-btn" onclick="app.shiftCategoryView(1)">&rarr;</button>
        </div>`;

        // TBB Banners for each visible month (aligned with table columns)
        // True YNAB model: Show cascading global TBB
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

        let tbbBanners = '<div class="tbb-banners-wrapper"><div class="tbb-banners-container">';
        tbbBanners += '<div class="tbb-spacer"></div>'; // Empty space for category name column

        months.forEach((m, idx) => {
            // Calculate TBB up to the PREVIOUS month (to show available for THIS month)
            const prevMonth = m.month === 0 ? 11 : m.month - 1;
            const prevYear = m.month === 0 ? m.year - 1 : m.year;
            const tbbBeforeMonth = this.calculateGlobalTBB(prevYear, prevMonth);

            // Calculate this month's allocations
            let thisMonthAllocated = 0;
            this.dataStore.getCategories().forEach(cat => {
                const allocKey = `${cat.id}-${m.year}-${m.month}`;
                thisMonthAllocated += this.allocations[allocKey] || 0;
            });

            const available = tbbBeforeMonth.available;
            const isCurrent = m.year === currentYear && m.month === currentMonth;

            tbbBanners += `<div class="tbb-banner${isCurrent ? ' current-month-tbb' : ''}" onclick="app.openQuickAllocate(${m.year}, ${m.month})">
                <div class="tbb-inner">
                    <div class="tbb-label">${monthNames[m.month]} ${m.year}</div>
                    <div class="tbb-amount${available < 0 ? ' negative' : available === 0 ? ' zero' : ''}">${this.moneyService.formatCurrency(available)}</div>
                    <div class="tbb-sublabel">Available to Budget</div>
                    <div class="tbb-details">
                        <span class="tbb-detail-item">Total Income: ${this.moneyService.formatCurrency(tbbBeforeMonth.totalIncome)}</span>
                        <span class="tbb-detail-item">Total Allocated: ${this.moneyService.formatCurrency(tbbBeforeMonth.totalAllocated)}</span>
                        ${tbbBeforeMonth.totalOverspending > 0 ? `<span class="tbb-detail-item tbb-overspending" title="Total overspending from previous months">Overspent: ${this.moneyService.formatCurrency(tbbBeforeMonth.totalOverspending)}</span>` : ''}
                    </div>
                </div>
            </div>`;
        });
        tbbBanners += '</div></div>';

        container.innerHTML = nav + tbbBanners +
            '<div class="category-table-wrapper"><div class="category-table">' +
            headerMonths + headerSubs + body +
            '</div></div>';
    }

    // Transaction Management
    setupTransactionManagement() {
        const addBtn = document.getElementById('add-transaction-btn');
        const modal = document.getElementById('transaction-modal');
        const closeBtn = document.getElementById('close-transaction-modal');
        const cancelBtn = document.getElementById('cancel-transaction-btn');
        const form = document.getElementById('transaction-form');
        const addSplitBtn = document.getElementById('add-split-btn');
        const amountInput = document.getElementById('transaction-amount');
        const categorySelect = document.getElementById('transaction-category');
        const saveAndAddBtn = document.getElementById('save-and-add-btn');

        // Open modal for new transaction
        addBtn.addEventListener('click', () => {
            this.currentTransactionId = null;
            this.openTransactionModal();
        });

        // Close modal
        closeBtn.addEventListener('click', () => this.closeTransactionModal());
        cancelBtn.addEventListener('click', () => this.closeTransactionModal());

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTransactionModal();
            }
        });

        // Handle category selection change (now listening on hidden input)
        const categoryHiddenInput = document.getElementById('transaction-category');
        categoryHiddenInput.addEventListener('change', (e) => {
            const splitsSection = document.getElementById('splits-section');
            const singleCategorySection = document.getElementById('single-category-section');

            if (e.target.value === '__split__') {
                // Show splits section
                splitsSection.style.display = 'block';
                categoryHiddenInput.removeAttribute('required');
                // Add initial split if none exist
                if (document.querySelectorAll('.split-item').length === 0) {
                    this.addSplitRow();
                }
            } else {
                // Hide splits section
                splitsSection.style.display = 'none';
                categoryHiddenInput.setAttribute('required', 'required');
            }
        });

        // Handle type selection change (show/hide transfer fields)
        document.getElementById('transaction-type').addEventListener('change', () => {
            this.updateTransferFields();
        });

        // Add split button
        addSplitBtn.addEventListener('click', () => {
            this.addSplitRow();
        });

        // Update splits total when amount changes
        amountInput.addEventListener('input', () => {
            const splitsSection = document.getElementById('splits-section');
            if (splitsSection.style.display !== 'none') {
                this.updateSplitsTotal();
            }
        });

        // Handle form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTransaction();
        });

        // Handle save and add another
        saveAndAddBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.uiState.setSaveAndAddAnother(true);
            form.requestSubmit();
        });

        // Action bar buttons
        document.getElementById('action-bar-edit-btn').addEventListener('click', () => {
            this.openBulkEditModal();
        });
        document.getElementById('action-bar-delete-btn').addEventListener('click', () => {
            this.deleteSelectedTransactions();
        });

        // Bulk edit modal
        this.setupModal({
            modalId: 'bulk-edit-modal',
            closeCallback: () => this.closeBulkEditModal(),
            submitCallback: () => this.saveBulkEdit()
        });

        // Setup searchable category select
        this.setupSearchableSelect('transaction-category');
    }

    setupSearchableSelect(fieldId) {
        const searchInput = document.getElementById(`${fieldId}-search`);
        const hiddenInput = document.getElementById(fieldId);
        const dropdown = document.getElementById(`${fieldId}-dropdown`);

        if (!searchInput || !dropdown) return;

        // Populate dropdown initially
        this.updateSearchableDropdown(fieldId, '');

        // Show dropdown on focus
        searchInput.addEventListener('focus', () => {
            dropdown.classList.add('active');
            this.updateSearchableDropdown(fieldId, searchInput.value);
        });

        // Filter on input
        searchInput.addEventListener('input', (e) => {
            this.updateSearchableDropdown(fieldId, e.target.value);
        });

        // Note: Dropdown closing on outside click is handled by global handler in setupGlobalDropdownHandler()

        // Handle keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.classList.remove('active');
            }
        });
    }

    updateSearchableDropdown(fieldId, searchTerm) {
        const dropdown = document.getElementById(`${fieldId}-dropdown`);
        const hiddenInput = document.getElementById(fieldId);
        const searchInput = document.getElementById(`${fieldId}-search`);

        if (!dropdown) return;

        const term = searchTerm.toLowerCase().trim();

        // Build options list
        let options = [];

        // Add "Split Transaction" option for main category only
        if (fieldId === 'transaction-category') {
            options.push({
                value: '__split__',
                label: 'Split Transaction',
                isSplit: true
            });
        }

        // Add categories
        this.dataStore.getCategories().forEach(cat => {
            if (!term || cat.name.toLowerCase().includes(term)) {
                options.push({
                    value: cat.id,
                    label: cat.name,
                    isSplit: false
                });
            }
        });

        // Render options
        if (options.length === 0) {
            dropdown.innerHTML = '<div class="searchable-select-empty">No categories found</div>';
        } else {
            dropdown.innerHTML = options.map(opt => {
                const selectedClass = hiddenInput.value === opt.value ? ' selected' : '';
                const splitClass = opt.isSplit ? ' split-option' : '';
                return `<div class="searchable-select-option${selectedClass}${splitClass}" data-value="${opt.value}">${this.escapeHtml(opt.label)}</div>`;
            }).join('');

            // Add click handlers
            dropdown.querySelectorAll('.searchable-select-option').forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.getAttribute('data-value');
                    const label = option.textContent;

                    hiddenInput.value = value;
                    searchInput.value = label;
                    searchInput.classList.add('has-value');
                    dropdown.classList.remove('active');

                    // Trigger change event for split transaction handling
                    if (fieldId === 'transaction-category') {
                        const event = new Event('change', { bubbles: true });
                        hiddenInput.dispatchEvent(event);
                    }
                });
            });
        }
    }

    toggleSort(column) {
        this.uiState.toggleSort(column);
        this.renderTransactions();
    }

    selectFilterAccount(accountId) {
        // Handle empty string, null, undefined as "all accounts"
        this.uiState.setFilterAccounts((accountId && accountId !== 'null') ? [accountId] : []);
        this.uiState.clearSelectedTransactions();
        this.updateActionBar();
        this.renderTransactions();
    }

    toggleManageAccounts() {
        this.uiState.toggleManageAccounts();
        this.renderSidebarAccountList();
    }

    toggleTransactionSelect(transactionId) {
        this.uiState.toggleTransactionSelect(transactionId);
        this.updateActionBar();
        this.renderTransactions();
    }

    selectAllTransactions() {
        const filteredTransactions = this.getFilteredTransactions();
        const selectedTransactions = this.uiState.getSelectedTransactions();
        const allSelected = filteredTransactions.every(t => selectedTransactions.has(t.id));
        if (allSelected) {
            filteredTransactions.forEach(t => selectedTransactions.delete(t.id));
        } else {
            filteredTransactions.forEach(t => selectedTransactions.add(t.id));
        }
        this.updateActionBar();
        this.renderTransactions();
    }

    updateActionBar() {
        const actionBar = document.getElementById('action-bar');
        const actionBarInfo = document.getElementById('action-bar-info');
        const count = this.uiState.getSelectedTransactions().size;
        if (count > 0) {
            actionBar.classList.add('active');
            actionBarInfo.textContent = `${count} transaction${count !== 1 ? 's' : ''} selected`;
        } else {
            actionBar.classList.remove('active');
        }
    }

    deleteSelectedTransactions() {
        const count = this.uiState.getSelectedTransactions().size;
        if (count === 0) return;
        if (!confirm(`Are you sure you want to delete ${count} transaction${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
            return;
        }
        // Collect dates for TBB cache invalidation
        const affectedMonths = new Set();

        // Reverse balance effects of deleted transactions
        this.transactions.forEach(t => {
            if (this.uiState.getSelectedTransactions().has(t.id)) {
                this.applyTransactionEffect(t, -1);
                const [tYear, tMonth] = t.date.split('-');
                affectedMonths.add(`${tYear}-${parseInt(tMonth) - 1}`);
            }
        });
        this.transactions = this.transactions.filter(t => !this.uiState.getSelectedTransactions().has(t.id));
        this.saveData('transactions', this.transactions);

        // Invalidate TBB cache for affected months
        affectedMonths.forEach(monthKey => {
            const [year, month] = monthKey.split('-');
            this.invalidateTBBCache(parseInt(year), parseInt(month));
        });

        // Invalidate spending map cache
        this.uiState.invalidateSpendingCache();

        this.uiState.clearSelectedTransactions();
        this.updateActionBar();
        this.renderTransactions();

        // Force dashboard refresh to update account balances
        this.uiState.setLastAccountsHash(null); // Invalidate cache
        this.updateDashboard();
    }

    openBulkEditModal() {
        const modal = document.getElementById('bulk-edit-modal');
        const accountSelect = document.getElementById('bulk-edit-account');

        // Populate accounts dropdown
        accountSelect.innerHTML = '<option value="">No change</option>';
        this.dataStore.getAccounts().forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            accountSelect.appendChild(option);
        });

        // Reset fields
        document.getElementById('bulk-edit-date').value = '';
        accountSelect.value = '';

        modal.classList.add('active');
    }

    closeBulkEditModal() {
        document.getElementById('bulk-edit-modal').classList.remove('active');
        document.getElementById('bulk-edit-form').reset();
    }

    saveBulkEdit() {
        const dateValue = document.getElementById('bulk-edit-date').value;
        const accountValue = document.getElementById('bulk-edit-account').value;

        if (!dateValue && !accountValue) {
            alert('Please fill in at least one field to edit.');
            return;
        }

        // Build confirmation message
        const count = this.uiState.getSelectedTransactions().size;
        const changes = [];
        if (dateValue) changes.push(`Date \u2192 ${this.formatDate(dateValue)}`);
        if (accountValue) {
            const account = this.dataStore.getAccounts().find(a => a.id === accountValue);
            changes.push(`Account \u2192 ${account ? account.name : 'Unknown'}`);
        }

        if (!confirm(`Update ${count} transaction${count !== 1 ? 's' : ''}:\n${changes.join('\n')}`)) {
            return;
        }

        // Apply changes
        this.transactions.forEach(t => {
            if (this.uiState.getSelectedTransactions().has(t.id)) {
                if (accountValue) {
                    // Reverse old effect, update account, reapply
                    this.applyTransactionEffect(t, -1);
                    t.accountId = accountValue;
                    this.applyTransactionEffect(t, 1);
                }
                if (dateValue) t.date = dateValue;
                t.updatedAt = new Date().toISOString();
            }
        });

        this.saveData('transactions', this.transactions);

        // Invalidate spending map cache if transactions modified
        this.uiState.invalidateSpendingCache();

        this.uiState.clearSelectedTransactions();
        this.updateActionBar();
        this.closeBulkEditModal();
        this.renderTransactions();

        // Force dashboard refresh to update account balances
        this.uiState.setLastAccountsHash(null); // Invalidate cache
        this.updateDashboard();
    }

    getFilteredTransactions() {
        let filtered = this.transactions;
        const filterAccounts = this.uiState.getFilterAccounts();
        if (filterAccounts.length > 0) {
            filtered = filtered.filter(t =>
                filterAccounts.includes(t.accountId) ||
                (t.type === 'transfer' && filterAccounts.includes(t.toAccountId))
            );
        }
        return filtered;
    }

    renderSidebarAccountList() {
        const container = document.getElementById('sidebar-account-list');
        if (!container) return;

        const filterAccounts = this.uiState.getFilterAccounts();
        const activeAccountId = filterAccounts.length > 0 ? filterAccounts[0] : null;

        if (this.uiState.isManageAccountsMode()) {
            const accountItems = this.dataStore.getAccounts().map(account => `
                <div class="sidebar-account-item manage-item">
                    <span onclick="app.openAccountModal('${account.id}')" style="cursor: pointer; flex: 1;" title="Click to edit">${this.escapeHtml(account.name)}</span>
                    <button class="delete-account-btn" onclick="app.deleteAccount('${account.id}')" title="Delete">×</button>
                </div>
            `).join('');

            container.innerHTML = `
                <div class="sidebar-account-list-inner">
                    <button class="add-account-btn" onclick="app.openAccountModal()">+ Add Account</button>
                    ${accountItems || '<div style="padding:6px 12px 6px 24px;color:rgba(255,255,255,0.4);font-size:13px;">No accounts yet</div>'}
                    <button class="edit-accounts-btn" onclick="app.toggleManageAccounts()">Done</button>
                </div>
            `;
        } else {
            const allClass = activeAccountId === null ? ' active' : '';
            const accountItems = this.dataStore.getAccounts().map(account => {
                const activeClass = account.id === activeAccountId ? ' active' : '';
                return `<button class="sidebar-account-item${activeClass}" onclick="app.selectFilterAccount('${account.id}')">${this.escapeHtml(account.name)}</button>`;
            }).join('');

            container.innerHTML = `
                <div class="sidebar-account-list-inner">
                    <button class="sidebar-account-item${allClass}" onclick="app.selectFilterAccount('')">All Accounts</button>
                    ${accountItems}
                    <button class="edit-accounts-btn" onclick="app.toggleManageAccounts()">Edit Accounts</button>
                </div>
            `;
        }

        this.renderMobileAccountFilter();
    }

    renderMobileAccountFilter() {
        const container = document.getElementById('mobile-account-filter');
        if (!container) return;

        const filterAccounts = this.uiState.getFilterAccounts();
        const activeAccountId = filterAccounts.length > 0 ? filterAccounts[0] : null;
        const allClass = activeAccountId === null ? ' active' : '';

        const chips = this.dataStore.getAccounts().map(account => {
            const activeClass = account.id === activeAccountId ? ' active' : '';
            return `<button class="account-chip${activeClass}" onclick="app.selectFilterAccount('${account.id}')">${this.escapeHtml(account.name)}</button>`;
        }).join('');

        container.innerHTML = `
            <button class="account-chip${allClass}" onclick="app.selectFilterAccount('')">All</button>
            ${chips}
        `;
    }

    renderTransactions() {
        this.renderSidebarAccountList();
        const container = document.getElementById('transactions-list');

        if (this.transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💸</div>
                    <div class="empty-state-text">No transactions yet. Add your first transaction to get started!</div>
                </div>
            `;
            return;
        }

        let filteredTransactions = this.getFilteredTransactions();

        // Apply sorting
        filteredTransactions = [...filteredTransactions].sort((a, b) => {
            let comparison = 0;
            switch (this.uiState.getSortColumn()) {
                case 'date':
                    comparison = new Date(a.date) - new Date(b.date);
                    break;
                case 'payee':
                    comparison = a.payee.localeCompare(b.payee);
                    break;
                case 'account': {
                    const nameA = (this.dataStore.getAccounts().find(acc => acc.id === a.accountId) || {}).name || '';
                    const nameB = (this.dataStore.getAccounts().find(acc => acc.id === b.accountId) || {}).name || '';
                    comparison = nameA.localeCompare(nameB);
                    break;
                }
                case 'categories': {
                    const catA = a.splits && a.splits[0] ? (this.dataStore.getCategories().find(c => c.id === a.splits[0].categoryId) || {}).name || '' : '';
                    const catB = b.splits && b.splits[0] ? (this.dataStore.getCategories().find(c => c.id === b.splits[0].categoryId) || {}).name || '' : '';
                    comparison = catA.localeCompare(catB);
                    break;
                }
                case 'expense':
                    comparison = (a.type === 'expense' ? a.totalAmount : 0) - (b.type === 'expense' ? b.totalAmount : 0);
                    break;
                case 'income':
                    comparison = (a.type === 'income' ? a.totalAmount : 0) - (b.type === 'income' ? b.totalAmount : 0);
                    break;
            }
            return this.uiState.getSortDirection() === 'asc' ? comparison : -comparison;
        });

        const sortIcon = (column) => this.uiState.getSortColumn() === column
            ? `<span class="sort-indicator">${this.uiState.getSortDirection() === 'asc' ? '▲' : '▼'}</span>`
            : '';

        const allSelected = filteredTransactions.length > 0 && filteredTransactions.every(t => this.uiState.getSelectedTransactions().has(t.id));

        const headerRow = `
            <div class="transaction-header-row">
                <div class="transaction-header-cell">
                    <input type="checkbox" class="select-all-checkbox" ${allSelected ? 'checked' : ''} onchange="app.selectAllTransactions()">
                </div>
                <div class="transaction-header-cell sortable" onclick="app.toggleSort('date')">Date${sortIcon('date')}</div>
                <div class="transaction-header-cell sortable" onclick="app.toggleSort('payee')">Payee${sortIcon('payee')}</div>
                <div class="transaction-header-cell sortable" onclick="app.toggleSort('account')">Account${sortIcon('account')}</div>
                <div class="transaction-header-cell sortable" onclick="app.toggleSort('categories')">Categories${sortIcon('categories')}</div>
                <div class="transaction-header-cell sortable" onclick="app.toggleSort('expense')">Expense${sortIcon('expense')}</div>
                <div class="transaction-header-cell sortable" onclick="app.toggleSort('income')">Income${sortIcon('income')}</div>
            </div>
        `;

        let transactionRows;
        if (filteredTransactions.length === 0) {
            transactionRows = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-text">No transactions match the current filters.</div>
                </div>
            `;
        } else {
            transactionRows = filteredTransactions.map(transaction => {
                let accountName;
                if (transaction.type === 'transfer') {
                    const fromAcc = this.dataStore.getAccounts().find(a => a.id === transaction.accountId);
                    const toAcc = this.dataStore.getAccounts().find(a => a.id === transaction.toAccountId);
                    accountName = `${this.escapeHtml(fromAcc ? fromAcc.name : 'Unknown')} → ${this.escapeHtml(toAcc ? toAcc.name : 'Unknown')}`;
                } else {
                    const account = this.dataStore.getAccounts().find(a => a.id === transaction.accountId);
                    accountName = account ? account.name : 'Unknown';
                }

                let categoriesText = '';
                if (transaction.splits && transaction.splits.length > 0) {
                    if (transaction.splits.length === 1) {
                        const category = this.dataStore.getCategories().find(c => c.id === transaction.splits[0].categoryId);
                        categoriesText = category ? this.escapeHtml(category.name) : 'Uncategorized';
                    } else {
                        categoriesText = transaction.splits.map(split => {
                            const category = this.dataStore.getCategories().find(c => c.id === split.categoryId);
                            const categoryName = category ? category.name : 'Uncategorized';
                            return `<span class="transaction-category-item">${this.escapeHtml(categoryName)} (${this.moneyService.formatCurrency(split.amount)})</span>`;
                        }).join('');
                    }
                }

                const isSelected = this.uiState.getSelectedTransactions().has(transaction.id);
                const editAttr = `onclick="app.editTransactionInline('${transaction.id}')" title="Click to edit"`;
                const expenseCell = (transaction.type === 'expense' || transaction.type === 'transfer')
                    ? `<div class="transaction-amount ${transaction.type} editable" ${editAttr}>${this.moneyService.formatCurrency(transaction.totalAmount)}</div>`
                    : '<div class="transaction-amount expense"></div>';
                const incomeCell = transaction.type === 'income'
                    ? `<div class="transaction-amount income editable" ${editAttr}>${this.moneyService.formatCurrency(transaction.totalAmount)}</div>`
                    : '<div class="transaction-amount income"></div>';
                return `
                    <div class="transaction-row ${transaction.type} ${isSelected ? 'selected' : ''}" data-transaction-id="${transaction.id}">
                        <input type="checkbox" class="transaction-checkbox" ${isSelected ? 'checked' : ''} onchange="app.toggleTransactionSelect('${transaction.id}')">
                        <div class="transaction-date editable" onclick="app.editTransactionInline('${transaction.id}')" title="Click to edit">${this.formatDate(transaction.date)}</div>
                        <div class="transaction-payee editable" onclick="app.editTransactionInline('${transaction.id}')" title="Click to edit">${this.escapeHtml(transaction.payee)}</div>
                        <div class="transaction-account editable" onclick="app.editTransactionInline('${transaction.id}')" title="Click to edit">${this.escapeHtml(accountName)}</div>
                        <div class="transaction-categories editable" onclick="app.editTransactionInline('${transaction.id}')" title="Click to edit">${categoriesText}</div>
                        ${expenseCell}
                        ${incomeCell}
                        ${transaction.notes ? `<div class="transaction-notes-row editable" onclick="app.editTransactionInline('${transaction.id}')" title="Click to edit">${this.escapeHtml(transaction.notes)}</div>` : ''}
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = headerRow + transactionRows;
    }

    editTransactionInline(transactionId) {
        this.openTransactionModal(transactionId);
    }

    updateTransferFields() {
        const type = document.getElementById('transaction-type').value;
        const isTransfer = type === 'transfer';

        document.getElementById('payee-section').style.display = isTransfer ? 'none' : 'block';
        document.getElementById('to-account-section').style.display = isTransfer ? 'block' : 'none';
        document.getElementById('transaction-payee').toggleAttribute('required', !isTransfer);
        document.getElementById('transaction-to-account').toggleAttribute('required', isTransfer);

        document.querySelector('label[for="transaction-account"]').textContent = isTransfer ? 'From Account *' : 'Account *';

        if (isTransfer) {
            document.getElementById('single-category-section').style.display = 'none';
            document.getElementById('splits-section').style.display = 'none';
            const catSelect = document.getElementById('transaction-category');
            if (catSelect) catSelect.removeAttribute('required');
        } else {
            // Check if we're currently in split mode
            const catSelect = document.getElementById('transaction-category');
            const splitsSection = document.getElementById('splits-section');
            const isSplitMode = catSelect.value === '__split__' && splitsSection.style.display === 'block';

            if (!isSplitMode) {
                // Only show single category section if NOT in split mode
                document.getElementById('single-category-section').style.display = 'block';
                catSelect.setAttribute('required', 'required');
            }
            // If in split mode, leave everything as is (split section visible, main category = '__split__')
        }
    }

    openTransactionModal(transactionId = null) {
        const modal = document.getElementById('transaction-modal');
        const title = document.getElementById('transaction-modal-title');
        const form = document.getElementById('transaction-form');
        const accountSelect = document.getElementById('transaction-account');
        const categorySelect = document.getElementById('transaction-category');
        const categorySearchInput = document.getElementById('transaction-category-search');
        const splitsSection = document.getElementById('splits-section');
        const singleCategorySection = document.getElementById('single-category-section');

        this.currentTransactionId = transactionId;
        this.uiState.resetSplitCounter();

        // Populate accounts dropdown
        accountSelect.innerHTML = '<option value="">Select account...</option>';
        this.dataStore.getAccounts().forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            accountSelect.appendChild(option);
        });

        // Populate to-account dropdown (for transfers)
        const toAccountSelect = document.getElementById('transaction-to-account');
        toAccountSelect.innerHTML = '<option value="">Select account...</option>';
        this.dataStore.getAccounts().forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            toAccountSelect.appendChild(option);
        });

        // Populate payees datalist
        const payeeList = document.getElementById('payee-list');
        payeeList.innerHTML = '';
        this.payees.forEach(payee => {
            const option = document.createElement('option');
            option.value = payee;
            payeeList.appendChild(option);
        });

        // Reset searchable category select
        categorySelect.value = '';
        categorySearchInput.value = '';
        categorySearchInput.classList.remove('has-value');

        // Clear splits container
        document.getElementById('splits-container').innerHTML = '';

        if (transactionId) {
            // Edit mode
            title.textContent = 'Edit Transaction';
            const transaction = this.transactions.find(t => t.id === transactionId);
            if (transaction) {
                document.getElementById('transaction-date').value = transaction.date;
                document.getElementById('transaction-type').value = transaction.type;
                document.getElementById('transaction-payee').value = transaction.payee;
                document.getElementById('transaction-account').value = transaction.accountId;
                document.getElementById('transaction-amount').value = transaction.totalAmount;
                document.getElementById('transaction-notes').value = transaction.notes || '';

                // Set to-account for transfers
                if (transaction.type === 'transfer' && transaction.toAccountId) {
                    document.getElementById('transaction-to-account').value = transaction.toAccountId;
                }

                // Load splits or single category
                if (transaction.splits && transaction.splits.length > 1) {
                    // Multiple splits - show splits section
                    categorySelect.value = '__split__';
                    categorySearchInput.value = 'Split Transaction';
                    categorySearchInput.classList.add('has-value');
                    splitsSection.style.display = 'block';
                    categorySelect.removeAttribute('required');
                    transaction.splits.forEach(split => {
                        this.addSplitRow(split.categoryId, split.amount);
                    });
                    this.updateSplitsTotal();
                } else if (transaction.splits && transaction.splits.length === 1) {
                    // Single category
                    const selectedCategory = this.dataStore.getCategories().find(c => c.id === transaction.splits[0].categoryId);
                    categorySelect.value = transaction.splits[0].categoryId;
                    categorySearchInput.value = selectedCategory ? selectedCategory.name : '';
                    categorySearchInput.classList.add('has-value');
                    splitsSection.style.display = 'none';
                    categorySelect.setAttribute('required', 'required');
                }
            }
        } else {
            // Add mode
            title.textContent = 'Add Transaction';
            form.reset();
            // Set today's date as default
            document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
            // Set expense as default type
            document.getElementById('transaction-type').value = 'expense';
            // Hide splits section
            splitsSection.style.display = 'none';
            categorySelect.setAttribute('required', 'required');
        }

        this.updateTransferFields();
        modal.classList.add('active');
    }

    closeTransactionModal() {
        const modal = document.getElementById('transaction-modal');
        const splitsSection = document.getElementById('splits-section');
        const categorySelect = document.getElementById('transaction-category');
        const categorySearchInput = document.getElementById('transaction-category-search');

        modal.classList.remove('active');
        document.getElementById('transaction-form').reset();
        document.getElementById('splits-container').innerHTML = '';

        // Reset to single category mode
        splitsSection.style.display = 'none';
        categorySelect.setAttribute('required', 'required');
        categorySearchInput.value = '';
        categorySearchInput.classList.remove('has-value');

        this.currentTransactionId = null;
        this.uiState.resetSplitCounter();
        this.uiState.setSaveAndAddAnother(false);
    }

    addSplitRow(categoryId = '', amount = '') {
        const container = document.getElementById('splits-container');
        const splitId = `split-${this.uiState.incrementSplitCounter()}`;
        const searchId = `${splitId}-search`;
        const hiddenId = `${splitId}-category`;
        const dropdownId = `${splitId}-dropdown`;

        const splitDiv = document.createElement('div');
        splitDiv.className = 'split-item';
        splitDiv.id = splitId;

        // Get category name if selected
        const selectedCategory = categoryId ? this.dataStore.getCategories().find(c => c.id === categoryId) : null;
        const categoryName = selectedCategory ? selectedCategory.name : '';
        const hasValueClass = categoryId ? ' has-value' : '';

        splitDiv.innerHTML = `
            <div class="form-group">
                <div class="searchable-select-wrapper">
                    <input type="text" id="${searchId}" class="searchable-select-input${hasValueClass}" placeholder="Search..." autocomplete="off" value="${this.escapeHtml(categoryName)}">
                    <input type="hidden" id="${hiddenId}" class="split-category" value="${categoryId}">
                    <div class="searchable-select-dropdown" id="${dropdownId}"></div>
                </div>
            </div>
            <div class="form-group">
                <input type="number" class="split-amount" step="0.01" placeholder="0.00" value="${amount}" oninput="app.updateSplitsTotal()">
            </div>
            <button type="button" class="remove-split-btn" onclick="app.removeSplitRow('${splitId}')">&times;</button>
        `;

        container.appendChild(splitDiv);

        // Initialize searchable select for this split
        this.setupSplitSearchableSelect(searchId, hiddenId, dropdownId);

        this.updateSplitsTotal();
    }

    setupSplitSearchableSelect(searchId, hiddenId, dropdownId) {
        const searchInput = document.getElementById(searchId);
        const hiddenInput = document.getElementById(hiddenId);
        const dropdown = document.getElementById(dropdownId);

        if (!searchInput || !dropdown) return;

        // Populate dropdown initially
        this.updateSplitDropdown(dropdownId, hiddenId, '');

        // Show dropdown on focus
        searchInput.addEventListener('focus', () => {
            dropdown.classList.add('active');
            this.updateSplitDropdown(dropdownId, hiddenId, searchInput.value);
        });

        // Filter on input
        searchInput.addEventListener('input', (e) => {
            this.updateSplitDropdown(dropdownId, hiddenId, e.target.value);
        });

        // Note: Dropdown closing on outside click is handled by global handler in setupGlobalDropdownHandler()

        // Handle keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.classList.remove('active');
            }
        });
    }

    updateSplitDropdown(dropdownId, hiddenId, searchTerm) {
        const dropdown = document.getElementById(dropdownId);
        const hiddenInput = document.getElementById(hiddenId);
        const searchInput = dropdown.previousElementSibling.previousElementSibling;

        if (!dropdown) return;

        const term = searchTerm.toLowerCase().trim();

        // Build options list (no split option for splits)
        let options = this.dataStore.getCategories()
            .filter(cat => !term || cat.name.toLowerCase().includes(term))
            .map(cat => ({ value: cat.id, label: cat.name }));

        // Render options
        if (options.length === 0) {
            dropdown.innerHTML = '<div class="searchable-select-empty">No categories found</div>';
        } else {
            dropdown.innerHTML = options.map(opt => {
                const selectedClass = hiddenInput.value === opt.value ? ' selected' : '';
                return `<div class="searchable-select-option${selectedClass}" data-value="${opt.value}">${this.escapeHtml(opt.label)}</div>`;
            }).join('');

            // Add click handlers
            dropdown.querySelectorAll('.searchable-select-option').forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.getAttribute('data-value');
                    const label = option.textContent;

                    hiddenInput.value = value;
                    searchInput.value = label;
                    searchInput.classList.add('has-value');
                    dropdown.classList.remove('active');

                    // Update splits total
                    this.updateSplitsTotal();
                });
            });
        }
    }

    removeSplitRow(splitId) {
        const splitRow = document.getElementById(splitId);
        if (splitRow) {
            splitRow.remove();
            this.updateSplitsTotal();
        }
    }

    updateSplitsTotal() {
        const totalAmount = parseFloat(document.getElementById('transaction-amount').value) || 0;
        const splitAmounts = document.querySelectorAll('.split-amount');

        let splitsTotal = 0;
        splitAmounts.forEach(input => {
            splitsTotal += parseFloat(input.value) || 0;
        });

        const totalElement = document.getElementById('splits-total-amount');
        const differenceElement = document.getElementById('splits-difference');

        totalElement.textContent = this.moneyService.formatCurrency(splitsTotal);

        const difference = totalAmount - splitsTotal;
        differenceElement.className = 'splits-difference';

        if (Math.abs(difference) < 0.01) {
            differenceElement.textContent = '';
        } else if (difference > 0) {
            differenceElement.textContent = `(${this.moneyService.formatCurrency(difference)} remaining)`;
            differenceElement.classList.add('under');
        } else {
            differenceElement.textContent = `(${this.moneyService.formatCurrency(Math.abs(difference))} over)`;
            differenceElement.classList.add('over');
        }
    }

    applyTransactionEffect(transaction, sign) {
        const fromAccount = this.dataStore.getAccount(transaction.accountId);
        if (!fromAccount) return;

        const amount = this.moneyService.moneyMultiply(sign, transaction.totalAmount);
        let newFromBalance;

        if (transaction.type === 'income') {
            newFromBalance = this.moneyService.moneyAdd(fromAccount.balance, amount);
            this.dataStore.updateAccountBalance(transaction.accountId, newFromBalance);
        } else if (transaction.type === 'expense') {
            newFromBalance = this.moneyService.moneySubtract(fromAccount.balance, amount);
            this.dataStore.updateAccountBalance(transaction.accountId, newFromBalance);
        } else if (transaction.type === 'transfer') {
            newFromBalance = this.moneyService.moneySubtract(fromAccount.balance, amount);
            this.dataStore.updateAccountBalance(transaction.accountId, newFromBalance);

            const toAccount = this.dataStore.getAccount(transaction.toAccountId);
            if (toAccount) {
                const newToBalance = this.moneyService.moneyAdd(toAccount.balance, amount);
                this.dataStore.updateAccountBalance(transaction.toAccountId, newToBalance);
            }
        }
    }

    // Get transaction form data
    getTransactionFormData() {
        return {
            date: document.getElementById('transaction-date').value,
            type: document.getElementById('transaction-type').value,
            payee: document.getElementById('transaction-payee').value.trim(),
            accountId: document.getElementById('transaction-account').value,
            totalAmount: parseFloat(document.getElementById('transaction-amount').value),
            notes: document.getElementById('transaction-notes').value.trim(),
            categorySelect: document.getElementById('transaction-category'),
            splitsSection: document.getElementById('splits-section')
        };
    }

    // Validate transaction data
    validateTransactionData(data) {
        const { date, type, payee, accountId, totalAmount } = data;

        if (!date || !type || (!payee && type !== 'transfer') || !accountId || isNaN(totalAmount) || totalAmount <= 0) {
            alert('Please fill in all required fields');
            return false;
        }
        return true;
    }

    // Collect and validate splits or transfer data
    collectTransactionSplits(data) {
        const { type, accountId, totalAmount, categorySelect, splitsSection } = data;
        let splits = [];
        let toAccountId = null;

        if (type === 'transfer') {
            toAccountId = document.getElementById('transaction-to-account').value;
            if (!toAccountId) {
                alert('Please select a destination account');
                return null;
            }
            if (toAccountId === accountId) {
                alert('Source and destination accounts must be different');
                return null;
            }
        } else if (categorySelect.value === '__split__') {
            // Split transaction - collect all splits
            const splitElements = document.querySelectorAll('.split-item');
            let splitsTotal = 0;

            splitElements.forEach(splitEl => {
                const categoryId = splitEl.querySelector('.split-category').value;
                const amount = parseFloat(splitEl.querySelector('.split-amount').value) || 0;

                if (categoryId && amount > 0) {
                    splits.push({ categoryId, amount });
                    splitsTotal += amount;
                }
            });

            // Validate splits total matches transaction amount
            if (Math.abs(totalAmount - splitsTotal) > 0.01) {
                alert('Split amounts must equal the total transaction amount');
                return null;
            }

            if (splits.length === 0) {
                alert('Please add at least one category split');
                return null;
            }
        } else {
            // Single category
            const categoryId = categorySelect.value;
            if (!categoryId) {
                alert('Please select a category');
                return null;
            }
            splits = [{ categoryId, amount: totalAmount }];
        }

        return { splits, toAccountId };
    }

    // Main save transaction method - now much simpler
    saveTransaction() {
        const data = this.getTransactionFormData();

        if (!this.validateTransactionData(data)) return;

        const splitsResult = this.collectTransactionSplits(data);
        if (!splitsResult) return;

        const { splits, toAccountId } = splitsResult;
        const { date, type, payee, accountId, totalAmount, notes } = data;

        // Save payee if new
        if (payee && !this.payees.includes(payee)) {
            this.payees.push(payee);
            this.saveData('payees', this.payees);
        }

        if (this.currentTransactionId) {
            // Update existing transaction
            const transactionIndex = this.transactions.findIndex(t => t.id === this.currentTransactionId);
            if (transactionIndex === -1) {
                alert('Error: Transaction not found. It may have been deleted.');
                this.closeTransactionModal();
                this.renderTransactions();
                return;
            }

            // Reverse the old transaction's effect on balances
            this.applyTransactionEffect(this.transactions[transactionIndex], -1);

            this.transactions[transactionIndex] = {
                ...this.transactions[transactionIndex],
                date,
                type,
                payee: type === 'transfer' ? '' : payee,
                accountId,
                totalAmount,
                notes,
                splits,
                toAccountId,
                updatedAt: new Date().toISOString()
            };

            // Apply the updated transaction's effect
            this.applyTransactionEffect(this.transactions[transactionIndex], 1);
        } else {
            // Create new transaction
            const newTransaction = {
                id: this.generateId(),
                date,
                type,
                payee: type === 'transfer' ? '' : payee,
                accountId,
                totalAmount,
                notes,
                splits,
                toAccountId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.transactions.push(newTransaction);

            // Apply the new transaction's effect on balances
            this.applyTransactionEffect(newTransaction, 1);
        }

        this.saveData('transactions', this.transactions);

        // Invalidate TBB cache for transaction month
        const [tYear, tMonth] = date.split('-');
        this.invalidateTBBCache(parseInt(tYear), parseInt(tMonth) - 1);

        // Invalidate spending map cache
        this.uiState.invalidateSpendingCache();

        this.renderTransactions();
        this.updateDashboard();

        // Handle save and add another
        if (this.uiState.getSaveAndAddAnother() && !this.currentTransactionId) {
            // Keep modal open, reset form with preserved account
            const savedAccount = accountId;
            this.currentTransactionId = null;
            this.uiState.resetSplitCounter();

            // Reset form
            document.getElementById('transaction-form').reset();

            // Refresh payees datalist with updated list
            const payeeList = document.getElementById('payee-list');
            payeeList.innerHTML = '';
            this.payees.forEach(payee => {
                const option = document.createElement('option');
                option.value = payee;
                payeeList.appendChild(option);
            });

            // Set defaults
            document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('transaction-type').value = 'expense';
            document.getElementById('transaction-account').value = savedAccount;
            this.updateTransferFields();

            // Reset category to single mode
            const splitsSection = document.getElementById('splits-section');
            const categorySelect = document.getElementById('transaction-category');
            const categorySearchInput = document.getElementById('transaction-category-search');

            splitsSection.style.display = 'none';
            categorySelect.setAttribute('required', 'required');
            document.getElementById('splits-container').innerHTML = '';
            categorySelect.value = '';
            categorySearchInput.value = '';
            categorySearchInput.classList.remove('has-value');

            // Reset the flag
            this.uiState.setSaveAndAddAnother(false);

            // Focus on payee field for quick entry
            document.getElementById('transaction-payee').focus();
        } else {
            this.closeTransactionModal();
        }
    }

    formatDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    setupSettingsNav() {
        const navItems = document.querySelectorAll('.settings-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabName = item.dataset.settingsTab;

                // Update nav items
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Update tabs
                document.querySelectorAll('.settings-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelector(`.settings-tab[data-tab="${tabName}"]`).classList.add('active');
            });
        });
    }

    updateNetWorth() {
        const total = this.moneyService.moneySum(this.dataStore.getAccounts().map(a => a.balance));
        const el = document.getElementById('sidebar-net-worth-value');
        if (el) {
            el.textContent = this.moneyService.formatCurrency(total);
            el.classList.toggle('negative', total < 0);
        }
    }

    // Dashboard with smart re-rendering
    updateDashboard() {
        // Always update net worth (fast operation)
        this.updateNetWorth();

        // Check if accounts changed
        const accountsHash = this.uiState.simpleHash(this.dataStore.getAccounts());
        const accountsChanged = accountsHash !== this.uiState.getLastAccountsHash();
        if (accountsChanged) {
            this.uiState.setLastAccountsHash(accountsHash);
            this.updateAccountsSummary();
        }

        // Check if transactions or filters changed
        const transactionsHash = this.uiState.simpleHash(this.transactions);
        const filterState = JSON.stringify({
            accounts: this.uiState.getDashFilterAccounts(),
            categories: this.uiState.getDashFilterCategories(),
            dateRange: this.uiState.getDashFilterDateRange()
        });
        const transactionsChanged = transactionsHash !== this.uiState.getLastTransactionsHash();
        const filtersChanged = filterState !== this.uiState.getLastDashFilterState();

        if (transactionsChanged || filtersChanged) {
            this.uiState.setLastTransactionsHash(transactionsHash);
            this.uiState.setLastDashFilterState(filterState);
            this.uiState.invalidateSpendingCache();
            this.renderDashboardSidebar();
            this.renderSpendingChart();
            this.renderTrendChart();
        }
    }

    /**
     * Calculate global TBB up to (and including) a specific month
     * True YNAB model: all income received - all allocations made - overspending
     * Results are cached for performance
     */
    calculateGlobalTBB(upToYear, upToMonth) {
        const cacheKey = `${upToYear}-${upToMonth}`;

        // Return cached result if available
        if (this.tbbCache[cacheKey]) {
            return this.tbbCache[cacheKey];
        }

        // Calculate total income received up to and including this month
        const incomeAmounts = [];
        this.transactions.forEach(t => {
            if (t.type !== 'income') return;
            const [tYear, tMonthStr] = t.date.split('-');
            const tDate = parseInt(tYear) * 12 + parseInt(tMonthStr) - 1;
            const upToDate = upToYear * 12 + upToMonth;
            if (tDate <= upToDate) {
                incomeAmounts.push(t.totalAmount);
            }
        });
        const totalIncome = this.moneyService.moneySum(incomeAmounts);

        // Calculate total allocated up to and including this month
        const allocatedAmounts = [];
        Object.keys(this.allocations).forEach(key => {
            const [catId, year, month] = key.split('-');
            const allocDate = parseInt(year) * 12 + parseInt(month);
            const upToDate = upToYear * 12 + upToMonth;
            if (allocDate <= upToDate) {
                allocatedAmounts.push(this.allocations[key]);
            }
        });
        const totalAllocated = this.moneyService.moneySum(allocatedAmounts);

        // Calculate total overspending up to this month
        let totalOverspending = 0;
        // Get all unique months that have been budgeted
        const budgetedMonths = new Set();
        Object.keys(this.allocations).forEach(key => {
            const [catId, year, month] = key.split('-');
            budgetedMonths.add(`${year}-${month}`);
        });

        budgetedMonths.forEach(monthKey => {
            const [year, month] = monthKey.split('-').map(n => parseInt(n));
            const monthDate = year * 12 + month;
            const upToDate = upToYear * 12 + upToMonth;

            if (monthDate < upToDate) { // Only count overspending from previous months
                this.dataStore.getCategories().forEach(cat => {
                    const budget = this.getCategoryBudget(cat.id, year, month);
                    const spent = this.getCategorySpent(cat.id, year, month);
                    const balance = budget - spent;
                    if (balance < 0) {
                        totalOverspending += Math.abs(balance);
                    }
                });
            }
        });

        const result = {
            totalIncome,
            totalAllocated,
            totalOverspending,
            available: totalIncome - totalAllocated - totalOverspending
        };

        // Cache the result
        this.tbbCache[cacheKey] = result;

        return result;
    }

    /**
     * Legacy method - kept for compatibility, redirects to global TBB
     */
    calculateAvailableFunds(year, month) {
        return this.calculateGlobalTBB(year, month).available;
    }

    /**
     * Get budget for a category in a specific month
     * Returns allocated amount (not monthlyLimit)
     */
    getCategoryBudget(categoryId, year, month) {
        const key = `${categoryId}-${year}-${month}`;
        return this.allocations[key] || 0;
    }

    /**
     * Get spent amount for a category in a specific month
     */
    getCategorySpent(categoryId, year, month) {
        let spent = 0;
        this.transactions.forEach(t => {
            if (!t.splits) return;
            const [tYear, tMonthStr] = t.date.split('-');
            if (parseInt(tYear) === year && parseInt(tMonthStr) - 1 === month) {
                t.splits.forEach(split => {
                    if (split.categoryId === categoryId) {
                        spent += t.type === 'expense' ? split.amount : -split.amount;
                    }
                });
            }
        });
        return spent;
    }

    /**
     * Invalidate TBB cache for a specific month and all subsequent months
     * Since TBB is cumulative, changing month X affects all months >= X
     */
    invalidateTBBCache(year, month) {
        const changedDate = year * 12 + month;

        // Remove all cache entries for months >= the changed month
        Object.keys(this.tbbCache).forEach(cacheKey => {
            const [cacheYear, cacheMonth] = cacheKey.split('-').map(n => parseInt(n));
            const cacheDate = cacheYear * 12 + cacheMonth;

            if (cacheDate >= changedDate) {
                delete this.tbbCache[cacheKey];
            }
        });
    }

    updateAccountsSummary() {
        const container = document.getElementById('accounts-summary');

        if (this.dataStore.getAccounts().length === 0) {
            container.innerHTML = 'No accounts yet';
            return;
        }

        const summary = this.dataStore.getAccounts().map(account => {
            const balance = this.moneyService.formatCurrency(account.balance);
            return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>${this.escapeHtml(account.name)}</span>
                    <strong>${balance}</strong>
                </div>
            `;
        }).join('');

        const total = this.moneyService.moneySum(this.dataStore.getAccounts().map(a => a.balance));

        container.innerHTML = summary + `
            <div class="accounts-summary-total">
                <span>Total Balance</span>
                <strong>${this.moneyService.formatCurrency(total)}</strong>
            </div>
        `;
    }

    renderAccountBalancesChart() {
        const container = document.getElementById('account-balances-chart');

        const typeColors = {
            chequing:   '#2563EB',
            savings:    '#059669',
            cash:       '#D97706',
            credit:     '#DC2626',
            tfsa:       '#7C3AED',
            rrsp:       '#0D9488',
            investment: '#4338CA',
            mortgage:   '#E11D48'
        };

        if (this.dataStore.getAccounts().length === 0) {
            container.innerHTML = '<div class="chart-empty">No accounts yet. Add an account to see the chart.</div>';
            return;
        }

        const visible = this.uiState.getDashFilterAccounts().length > 0
            ? this.dataStore.getAccounts().filter(a => this.uiState.getDashFilterAccounts().includes(a.id))
            : this.dataStore.getAccounts();

        if (visible.length === 0) {
            container.innerHTML = '<div class="chart-empty">No accounts selected</div>';
            return;
        }

        const maxBalance = Math.max(...visible.map(a => Math.abs(a.balance)), 0.01);
        const isDebt = type => type === 'credit' || type === 'mortgage';

        container.innerHTML = visible.map(account => {
            const color = typeColors[account.type] || '#6B7280';
            const widthPct = (Math.abs(account.balance) / maxBalance) * 100;
            const debt = isDebt(account.type);
            return `<div class="chart-bar-row">
                <div class="chart-bar-label">
                    <span class="chart-bar-dot" style="background-color: ${color}"></span>
                    <span class="chart-bar-name">${this.escapeHtml(account.name)}</span>
                </div>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill${debt ? ' debt' : ''}" style="width: ${widthPct}%; background-color: ${color}"></div>
                </div>
                <div class="chart-bar-value${debt ? ' debt' : ''}">${this.moneyService.formatCurrency(account.balance)}</div>
            </div>`;
        }).join('');
    }

    renderSpendingChart() {
        const canvas = document.getElementById('spending-pie-chart');
        const layout = document.getElementById('spending-chart-layout');
        const legendContainer = document.getElementById('spending-chart-legend');
        const totalContainer = document.getElementById('spending-chart-total');

        const categoryPalette = [
            '#2563EB', '#059669', '#DC2626', '#D97706', '#7C3AED',
            '#0D9488', '#E11D48', '#4338CA', '#65A30D', '#EA580C',
            '#6366F1', '#14B8A6'
        ];

        // Filter: expenses in date range from selected accounts
        const { start, end } = this.getDashDateRange();
        const filtered = this.transactions.filter(t =>
            t.type === 'expense' &&
            (this.uiState.getDashFilterAccounts().length === 0 || this.uiState.getDashFilterAccounts().includes(t.accountId)) &&
            t.date >= start && t.date <= end
        );

        // Aggregate by category (respecting category filter)
        const totals = {};
        filtered.forEach(t => {
            if (!t.splits) return;
            t.splits.forEach(split => {
                if (this.uiState.getDashFilterCategories().length > 0 && !this.uiState.getDashFilterCategories().includes(split.categoryId)) return;
                totals[split.categoryId] = (totals[split.categoryId] || 0) + split.amount;
            });
        });

        // Sort descending, assign palette colors
        const data = Object.entries(totals)
            .map(([id, amount]) => {
                const cat = this.dataStore.getCategories().find(c => c.id === id);
                return { name: cat ? cat.name : 'Uncategorized', amount: Math.round(amount * 100) / 100 };
            })
            .sort((a, b) => b.amount - a.amount)
            .map((item, i) => ({ ...item, color: categoryPalette[i % categoryPalette.length] }));

        const total = data.reduce((sum, d) => sum + d.amount, 0);

        if (data.length === 0) {
            layout.style.display = 'none';
            totalContainer.innerHTML = '<div class="chart-empty">No spending data for this period</div>';
            return;
        }

        layout.style.display = '';

        // Draw pie on canvas
        const size = 240;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2, cy = size / 2, r = size / 2 - 6;
        let startAngle = -Math.PI / 2;

        data.forEach(item => {
            const sliceAngle = (item.amount / total) * 2 * Math.PI;

            ctx.beginPath();
            if (data.length > 1) ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
            if (data.length > 1) ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();

            // Percentage label on slice (only if slice is large enough to fit text)
            const pct = (item.amount / total) * 100;
            if (pct >= 6) {
                const mid = startAngle + sliceAngle / 2;
                ctx.fillStyle = this.getPieTextColor(item.color);
                ctx.font = 'bold 13px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    pct.toFixed(1) + '%',
                    cx + r * 0.6 * Math.cos(mid),
                    cy + r * 0.6 * Math.sin(mid)
                );
            }

            startAngle += sliceAngle;
        });

        // Legend
        legendContainer.innerHTML = data.map(item => {
            const pct = ((item.amount / total) * 100).toFixed(1);
            return `<div class="legend-item">
                <span class="legend-dot" style="background-color: ${item.color}"></span>
                <span class="legend-name">${this.escapeHtml(item.name)}</span>
                <span class="legend-value">${this.moneyService.formatCurrency(item.amount)}</span>
                <span class="legend-percent">${pct}%</span>
            </div>`;
        }).join('');

        totalContainer.innerHTML = `Total Spending: <strong>${this.moneyService.formatCurrency(total)}</strong>`;
    }

    getDashDateRange() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const pad = n => String(n).padStart(2, '0');
        const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

        let start, end;
        switch (this.uiState.getDashFilterDateRange()) {
            case 'last-month':
                start = new Date(y, m - 1, 1);
                end   = new Date(y, m, 0);
                break;
            case 'last-3-months':
                start = new Date(y, m - 2, 1);
                end   = new Date(y, m + 1, 0);
                break;
            case 'last-year':
                start = new Date(y, m - 11, 1);
                end   = new Date(y, m + 1, 0);
                break;
            case 'all-time':
                start = new Date(1970, 0, 1);
                end   = new Date(9999, 11, 31);
                break;
            default: // this-month
                start = new Date(y, m, 1);
                end   = new Date(y, m + 1, 0);
        }
        return { start: fmt(start), end: fmt(end) };
    }

    renderDashboardSidebar() {
        const sidebar = document.getElementById('dashboard-sidebar');

        const dateOptions = [
            ['this-month',    'This Month'],
            ['last-month',    'Last Month'],
            ['last-3-months', '3 Months'],
            ['last-year',     'Last Year'],
            ['all-time',      'All Time']
        ];

        const dateButtons = dateOptions.map(([val, label]) =>
            `<button class="sidebar-type-btn${this.uiState.getDashFilterDateRange() === val ? ' active' : ''}" onclick="app.setDashFilterDateRange('${val}')">${label}</button>`
        ).join('');

        const accountItems = this.dataStore.getAccounts().map(account =>
            `<button class="sidebar-filter-item${this.uiState.getDashFilterAccounts().includes(account.id) ? ' active' : ''}" onclick="app.toggleDashFilterAccount('${account.id}')">${this.escapeHtml(account.name)}</button>`
        ).join('');

        const categoryItems = this.dataStore.getCategories().map(cat =>
            `<button class="sidebar-filter-item${this.uiState.getDashFilterCategories().includes(cat.id) ? ' active' : ''}" onclick="app.toggleDashFilterCategory('${cat.id}')">${this.escapeHtml(cat.name)}</button>`
        ).join('');

        sidebar.innerHTML = `
            <div class="sidebar-section${this.uiState.getDashExpandedSections().has('date') ? ' expanded' : ''}">
                <div class="sidebar-section-title" onclick="app.toggleDashSection('date')">Date Range</div>
                <div class="sidebar-type-buttons">${dateButtons}</div>
            </div>
            <div class="sidebar-section${this.uiState.getDashExpandedSections().has('account') ? ' expanded' : ''}">
                <div class="sidebar-section-title" onclick="app.toggleDashSection('account')">Account</div>
                <div class="sidebar-type-buttons">${accountItems || '<div class="sidebar-empty">No accounts yet</div>'}</div>
            </div>
            <div class="sidebar-section${this.uiState.getDashExpandedSections().has('category') ? ' expanded' : ''}">
                <div class="sidebar-section-title" onclick="app.toggleDashSection('category')">Category</div>
                <div class="sidebar-type-buttons">${categoryItems || '<div class="sidebar-empty">No categories yet</div>'}</div>
            </div>
        `;
    }

    toggleDashFilterAccount(accountId) {
        const currentFilters = this.uiState.getDashFilterAccounts();
        const index = currentFilters.indexOf(accountId);
        if (index === -1) {
            currentFilters.push(accountId);
        } else {
            currentFilters.splice(index, 1);
        }
        this.uiState.setDashFilterAccounts(currentFilters);
        this.updateDashboard();
    }

    toggleDashFilterCategory(categoryId) {
        const currentFilters = this.uiState.getDashFilterCategories();
        const index = currentFilters.indexOf(categoryId);
        if (index === -1) {
            currentFilters.push(categoryId);
        } else {
            currentFilters.splice(index, 1);
        }
        this.uiState.setDashFilterCategories(currentFilters);
        this.updateDashboard();
    }

    setDashFilterDateRange(range) {
        this.uiState.setDashFilterDateRange(range);
        this.updateDashboard();
    }

    toggleDashSection(name) {
        this.uiState.toggleDashSection(name);
        this.renderDashboardSidebar();
    }

    toggleGroupCollapse(groupId) {
        this.uiState.toggleGroupCollapse(groupId);
        this.renderCategories();
    }

    renderTrendChart() {
        const controlsContainer = document.getElementById('trend-chart-controls');
        const canvas = document.getElementById('trend-chart');

        // Only expense/income toggles as inline controls
        controlsContainer.innerHTML =
            `<button class="trend-toggle-btn${this.uiState.getTrendShowExpense() ? ' active expense-btn' : ''}" onclick="app.toggleTrendExpense()">Expenses</button>` +
            `<button class="trend-toggle-btn${this.uiState.getTrendShowIncome() ? ' active income-btn' : ''}" onclick="app.toggleTrendIncome()">Income</button>`;

        const pad2 = n => String(n).padStart(2, '0');
        let { start, end } = this.getDashDateRange();

        // "All time" bounds: cap end to current month, start to earliest matching transaction
        if (this.uiState.getDashFilterDateRange() === 'all-time') {
            const now = new Date();
            end = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`;
            const relevant = this.transactions.filter(t => {
                if (this.uiState.getDashFilterAccounts().length > 0 && !this.uiState.getDashFilterAccounts().includes(t.accountId)) return false;
                return t.type === 'expense' || t.type === 'income';
            });
            start = relevant.length > 0
                ? relevant.reduce((min, t) => t.date < min ? t.date : min, relevant[0].date)
                : `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
        }

        // Generate every calendar day in [start, end]
        const days = [];
        let cur = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');
        while (cur <= endDate && days.length < 3650) {
            days.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`);
            cur.setDate(cur.getDate() + 1);
        }

        // Aggregate transactions per day
        const expenseByDay = {};
        const incomeByDay = {};
        days.forEach(d => { expenseByDay[d] = 0; incomeByDay[d] = 0; });

        this.transactions.forEach(t => {
            if (this.uiState.getDashFilterAccounts().length > 0 && !this.uiState.getDashFilterAccounts().includes(t.accountId)) return;
            if (t.type !== 'expense' && t.type !== 'income') return;
            if (!(t.date in expenseByDay)) return;

            let amount;
            if (this.uiState.getDashFilterCategories().length > 0) {
                amount = (t.splits || [])
                    .filter(s => this.uiState.getDashFilterCategories().includes(s.categoryId))
                    .reduce((sum, s) => sum + s.amount, 0);
            } else {
                amount = t.totalAmount;
            }

            if (t.type === 'expense') expenseByDay[t.date] += amount;
            else incomeByDay[t.date] += amount;
        });

        const expenseValues = days.map(d => Math.round(expenseByDay[d] * 100) / 100);
        const incomeValues = days.map(d => Math.round(incomeByDay[d] * 100) / 100);

        const allValues = [
            ...(this.uiState.getTrendShowExpense() ? expenseValues : []),
            ...(this.uiState.getTrendShowIncome() ? incomeValues : []),
            0
        ];
        const maxVal = Math.max(...allValues);

        // Canvas setup - use parent card width for full-width chart
        const dpr = window.devicePixelRatio || 1;
        const card = canvas.closest('.card');
        const parentWidth = card ? card.offsetWidth : canvas.parentElement.offsetWidth;
        // Subtract card padding (24px * 2 = 48px)
        const cssW = parentWidth > 48 ? parentWidth - 48 : 680;
        const cssH = Math.round(cssW / 3.5);
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cssW, cssH);

        // Layout margins
        const pad = { top: 20, right: 24, bottom: 44, left: 64 };
        const chartW = cssW - pad.left - pad.right;
        const chartH = cssH - pad.top - pad.bottom;

        if (days.length === 0 || (!this.uiState.getTrendShowExpense() && !this.uiState.getTrendShowIncome())) {
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No data to display', cssW / 2, cssH / 2);
            return;
        }

        // Y-axis: nice round steps
        const yStep = this.getNiceStep(maxVal, 5);
        const yMax = yStep * Math.ceil((maxVal || 1) / yStep);
        const yTicks = [];
        for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);

        // Grid lines + Y labels
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        yTicks.forEach(val => {
            const yPos = pad.top + chartH - (val / yMax) * chartH;
            ctx.beginPath();
            ctx.moveTo(pad.left, yPos);
            ctx.lineTo(pad.left + chartW, yPos);
            ctx.stroke();
            ctx.fillText('$' + val.toLocaleString(), pad.left - 8, yPos);
        });

        // X-axis labels (auto-spaced based on range)
        const slotW = chartW / days.length;
        const xLabels = this.getChartDayLabels(days, chartW);
        ctx.fillStyle = '#6B7280';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        xLabels.forEach(({ i, label }) => {
            ctx.fillText(label, pad.left + slotW * i + slotW / 2, pad.top + chartH + 8);
        });

        // Draw a line series (no dots)
        const drawLine = (values, color, fillColor) => {
            if (values.length === 0) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            // Fill area under line
            ctx.beginPath();
            ctx.moveTo(pad.left + slotW / 2, pad.top + chartH);
            values.forEach((val, i) => {
                ctx.lineTo(pad.left + slotW * i + slotW / 2, pad.top + chartH - (val / yMax) * chartH);
            });
            ctx.lineTo(pad.left + slotW * (values.length - 1) + slotW / 2, pad.top + chartH);
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();

            // Stroke line
            ctx.beginPath();
            values.forEach((val, i) => {
                const x = pad.left + slotW * i + slotW / 2;
                const yPos = pad.top + chartH - (val / yMax) * chartH;
                if (i === 0) ctx.moveTo(x, yPos);
                else ctx.lineTo(x, yPos);
            });
            ctx.stroke();
        };

        // Draw expense first (behind), then income (on top)
        if (this.uiState.getTrendShowExpense()) drawLine(expenseValues, '#DC2626', 'rgba(220,38,38,0.08)');
        if (this.uiState.getTrendShowIncome())  drawLine(incomeValues,  '#059669', 'rgba(5,150,105,0.08)');
    }

    // Returns [{i, label}, …] for X-axis tick labels, auto-spaced to avoid overlap
    getChartDayLabels(days, chartW) {
        const n = days.length;
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const labels = [];
        const parse = d => {
            const [y, m, dd] = d.split('-').map(Number);
            return { year: y, month: m - 1, day: dd };
        };

        if (n <= 7) {
            // Label every day
            days.forEach((d, i) => {
                const { month, day } = parse(d);
                labels.push({ i, label: `${MONTHS[month]} ${day}` });
            });
        } else if (n <= 60) {
            // First day always labelled; then at every 1st-of-month, minimum 7 days apart
            const { month, day } = parse(days[0]);
            labels.push({ i: 0, label: `${MONTHS[month]} ${day}` });
            let lastIdx = 0;
            for (let i = 1; i < n; i++) {
                if (days[i].endsWith('-01') && i - lastIdx >= 7) {
                    const p = parse(days[i]);
                    labels.push({ i, label: `${MONTHS[p.month]} ${p.day}` });
                    lastIdx = i;
                }
            }
        } else {
            // Month boundaries only; skip any that would land closer than ~45 px
            const minDaySpacing = Math.max(7, Math.ceil(45 / (chartW / n)));
            let lastIdx = -minDaySpacing;
            let first = true;
            for (let i = 0; i < n; i++) {
                if (i === 0 || days[i].endsWith('-01')) {
                    if (i - lastIdx < minDaySpacing && i !== 0) continue;
                    const { year, month } = parse(days[i]);
                    // Show year on the very first label and every January
                    const showYear = first || month === 0;
                    labels.push({ i, label: showYear ? `${MONTHS[month]} ${year}` : MONTHS[month] });
                    first = false;
                    lastIdx = i;
                }
            }
        }
        return labels;
    }

    getNiceStep(maxVal, targetTicks) {
        if (maxVal === 0) return 100;
        const raw = maxVal / targetTicks;
        const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
        const normalized = raw / magnitude;
        let nice;
        if (normalized <= 1) nice = 1;
        else if (normalized <= 2) nice = 2;
        else if (normalized <= 5) nice = 5;
        else nice = 10;
        return nice * magnitude;
    }

    toggleTrendExpense() {
        this.uiState.toggleTrendExpense();
        this.renderTrendChart();
    }

    toggleTrendIncome() {
        this.uiState.toggleTrendIncome();
        this.renderTrendChart();
    }

    getPieTextColor(hexColor) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1E3A5F' : '#ffffff';
    }

    // Utility Functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app
const app = new BudgetBuddy();
