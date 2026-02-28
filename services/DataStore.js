// DataStore - Centralized data management and persistence
// Handles all CRUD operations and localStorage interactions

class DataStore {
    constructor() {
        // Load all data from localStorage
        this.accounts = this.loadData('accounts') || [];
        this.categories = this.loadData('categories') || [];
        this.groups = this.loadData('groups') || [];
        this.transactions = this.loadData('transactions') || [];
        this.payees = this.loadData('payees') || [];
        this.allocations = this.loadData('allocations') || {};
        this.tbbHistory = this.loadData('tbb_history') || {};
    }

    // ==================== CORE DATA METHODS ====================

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

    // ==================== ACCOUNTS ====================

    /**
     * Get all accounts
     * @returns {Array} Copy of accounts array
     */
    getAccounts() {
        return [...this.accounts];
    }

    /**
     * Get a single account by ID
     * @param {string} id - Account ID
     * @returns {Object|null} Account object or null if not found
     */
    getAccount(id) {
        const account = this.accounts.find(a => a.id === id);
        return account ? { ...account } : null;
    }

    /**
     * Add a new account
     * @param {Object} accountData - Account data {name, type, balance, currency}
     * @returns {Object} The created account
     */
    addAccount(accountData) {
        const { name, type, balance, currency } = accountData;

        // Validation
        if (!name || !type || balance === undefined || !currency) {
            throw new Error('Missing required account fields');
        }

        const newAccount = {
            id: this.generateId(),
            name: name.trim(),
            type,
            balance: parseFloat(balance) || 0,
            currency,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.accounts.push(newAccount);
        this.saveData('accounts', this.accounts);

        return { ...newAccount };
    }

    /**
     * Update an existing account
     * @param {string} id - Account ID
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated account or null if not found
     */
    updateAccount(id, updates) {
        const index = this.accounts.findIndex(a => a.id === id);
        if (index === -1) return null;

        // Update allowed fields
        const allowedFields = ['name', 'type', 'balance', 'currency'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                this.accounts[index][field] = updates[field];
            }
        });

        this.accounts[index].updatedAt = new Date().toISOString();
        this.saveData('accounts', this.accounts);

        return { ...this.accounts[index] };
    }

    /**
     * Delete an account
     * @param {string} id - Account ID
     * @returns {boolean} True if deleted, false if not found
     */
    deleteAccount(id) {
        const initialLength = this.accounts.length;
        this.accounts = this.accounts.filter(a => a.id !== id);

        if (this.accounts.length < initialLength) {
            this.saveData('accounts', this.accounts);
            return true;
        }

        return false;
    }

    /**
     * Update account balance (used by transaction effects)
     * @param {string} id - Account ID
     * @param {number} newBalance - New balance amount
     * @returns {boolean} True if updated, false if not found
     */
    updateAccountBalance(id, newBalance) {
        const account = this.accounts.find(a => a.id === id);
        if (!account) return false;

        account.balance = newBalance;
        account.updatedAt = new Date().toISOString();
        this.saveData('accounts', this.accounts);

        return true;
    }

    // ==================== CATEGORIES ====================

    /**
     * Get all categories
     * @returns {Array} Copy of categories array
     */
    getCategories() {
        return [...this.categories];
    }

    /**
     * Get a single category by ID
     * @param {string} id - Category ID
     * @returns {Object|null} Category object or null if not found
     */
    getCategory(id) {
        const category = this.categories.find(c => c.id === id);
        return category ? { ...category } : null;
    }

    /**
     * Add a new category
     * @param {Object} categoryData - Category data {name, groupId, monthlyLimit}
     * @returns {Object} The created category
     */
    addCategory(categoryData) {
        const { name, groupId, monthlyLimit } = categoryData;

        // Validation
        if (!name) {
            throw new Error('Category name is required');
        }

        const newCategory = {
            id: this.generateId(),
            name: name.trim(),
            groupId: groupId || null,
            monthlyLimit: monthlyLimit ? parseFloat(monthlyLimit) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.categories.push(newCategory);
        this.saveData('categories', this.categories);

        return { ...newCategory };
    }

    /**
     * Update an existing category
     * @param {string} id - Category ID
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated category or null if not found
     */
    updateCategory(id, updates) {
        const index = this.categories.findIndex(c => c.id === id);
        if (index === -1) return null;

        // Update allowed fields
        const allowedFields = ['name', 'groupId', 'monthlyLimit'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                this.categories[index][field] = updates[field];
            }
        });

        this.categories[index].updatedAt = new Date().toISOString();
        this.saveData('categories', this.categories);

        return { ...this.categories[index] };
    }

    /**
     * Delete a category
     * @param {string} id - Category ID
     * @returns {boolean} True if deleted, false if not found
     */
    deleteCategory(id) {
        const initialLength = this.categories.length;
        this.categories = this.categories.filter(c => c.id !== id);

        if (this.categories.length < initialLength) {
            this.saveData('categories', this.categories);
            return true;
        }

        return false;
    }

    // ==================== GROUPS ====================

    /**
     * Get all groups
     * @returns {Array} Copy of groups array
     */
    getGroups() {
        return [...this.groups];
    }

    /**
     * Get a single group by ID
     * @param {string} id - Group ID
     * @returns {Object|null} Group object or null if not found
     */
    getGroup(id) {
        const group = this.groups.find(g => g.id === id);
        return group ? { ...group } : null;
    }

    /**
     * Add a new group
     * @param {Object} groupData - Group data {name, monthlyLimit}
     * @returns {Object} The created group
     */
    addGroup(groupData) {
        const { name, monthlyLimit } = groupData;

        // Validation
        if (!name) {
            throw new Error('Group name is required');
        }

        const newGroup = {
            id: this.generateId(),
            name: name.trim(),
            monthlyLimit: monthlyLimit ? parseFloat(monthlyLimit) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.groups.push(newGroup);
        this.saveData('groups', this.groups);

        return { ...newGroup };
    }

    /**
     * Update an existing group
     * @param {string} id - Group ID
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated group or null if not found
     */
    updateGroup(id, updates) {
        const index = this.groups.findIndex(g => g.id === id);
        if (index === -1) return null;

        // Update allowed fields
        const allowedFields = ['name', 'monthlyLimit'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                this.groups[index][field] = updates[field];
            }
        });

        this.groups[index].updatedAt = new Date().toISOString();
        this.saveData('groups', this.groups);

        return { ...this.groups[index] };
    }

    /**
     * Delete a group
     * @param {string} id - Group ID
     * @returns {boolean} True if deleted, false if not found
     */
    deleteGroup(id) {
        const initialLength = this.groups.length;
        this.groups = this.groups.filter(g => g.id !== id);

        if (this.groups.length < initialLength) {
            this.saveData('groups', this.groups);
            return true;
        }

        return false;
    }

    // ==================== TRANSACTIONS ====================

    /**
     * Get all transactions
     * @returns {Array} Copy of transactions array
     */
    getTransactions() {
        return [...this.transactions];
    }

    /**
     * Get a single transaction by ID
     * @param {string} id - Transaction ID
     * @returns {Object|null} Transaction object or null if not found
     */
    getTransaction(id) {
        const transaction = this.transactions.find(t => t.id === id);
        return transaction ? { ...transaction } : null;
    }

    /**
     * Add a new transaction
     * Note: Does NOT update account balances - caller must handle balance effects
     * @param {Object} transactionData - Transaction data
     * @returns {Object} The created transaction
     */
    addTransaction(transactionData) {
        const {
            date,
            type,
            payee,
            accountId,
            totalAmount,
            notes,
            splits,
            toAccountId
        } = transactionData;

        // Validation
        if (!date || !type || !accountId || !totalAmount) {
            throw new Error('Required transaction fields missing');
        }

        const newTransaction = {
            id: this.generateId(),
            date,
            type,
            payee: type === 'transfer' ? '' : (payee || ''),
            accountId,
            totalAmount: parseFloat(totalAmount),
            notes: notes || '',
            splits: splits || [],
            toAccountId: toAccountId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.transactions.push(newTransaction);
        this.saveData('transactions', this.transactions);

        return { ...newTransaction };
    }

    /**
     * Update an existing transaction
     * Note: Does NOT update account balances - caller must handle balance effects
     * @param {string} id - Transaction ID
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated transaction or null if not found
     */
    updateTransaction(id, updates) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index === -1) return null;

        // Update allowed fields
        const allowedFields = ['date', 'type', 'payee', 'accountId', 'totalAmount', 'notes', 'splits', 'toAccountId'];
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                this.transactions[index][field] = updates[field];
            }
        });

        this.transactions[index].updatedAt = new Date().toISOString();
        this.saveData('transactions', this.transactions);

        return { ...this.transactions[index] };
    }

    /**
     * Delete a transaction
     * Note: Does NOT update account balances - caller must handle balance effects
     * @param {string} id - Transaction ID
     * @returns {boolean} True if deleted, false if not found
     */
    deleteTransaction(id) {
        const initialLength = this.transactions.length;
        this.transactions = this.transactions.filter(t => t.id !== id);

        if (this.transactions.length < initialLength) {
            this.saveData('transactions', this.transactions);
            return true;
        }

        return false;
    }

    // ==================== PAYEES ====================

    /**
     * Get all payees
     * @returns {Array} Copy of payees array
     */
    getPayees() {
        return [...this.payees];
    }

    /**
     * Add a payee if it doesn't already exist
     * @param {string} name - Payee name
     * @returns {boolean} True if added, false if already exists
     */
    addPayee(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Payee name must be a non-empty string');
        }

        const trimmedName = name.trim();
        if (!this.payees.includes(trimmedName)) {
            this.payees.push(trimmedName);
            this.saveData('payees', this.payees);
            return true;
        }
        return false;
    }

    /**
     * Delete a payee
     * @param {string} name - Payee name
     * @returns {boolean} True if deleted, false if not found
     */
    deletePayee(name) {
        const initialLength = this.payees.length;
        this.payees = this.payees.filter(p => p !== name);

        if (this.payees.length < initialLength) {
            this.saveData('payees', this.payees);
            return true;
        }

        return false;
    }

    // ==================== ALLOCATIONS ====================

    /**
     * Get all allocations
     * @returns {Object} Copy of allocations object
     */
    getAllocations() {
        return { ...this.allocations };
    }

    /**
     * Get a specific allocation
     * @param {string} key - Allocation key (categoryId-year-month)
     * @returns {number|null} Allocation amount or null if not found
     */
    getAllocation(key) {
        return this.allocations[key] !== undefined ? this.allocations[key] : null;
    }

    /**
     * Set an allocation
     * @param {string} key - Allocation key (categoryId-year-month)
     * @param {number} amount - Allocation amount
     */
    setAllocation(key, amount) {
        this.allocations[key] = parseFloat(amount);
        this.saveData('allocations', this.allocations);
    }

    /**
     * Delete an allocation
     * @param {string} key - Allocation key
     * @returns {boolean} True if deleted, false if not found
     */
    deleteAllocation(key) {
        if (this.allocations[key] !== undefined) {
            delete this.allocations[key];
            this.saveData('allocations', this.allocations);
            return true;
        }
        return false;
    }

    /**
     * Clear all allocations
     */
    clearAllocations() {
        this.allocations = {};
        this.saveData('allocations', this.allocations);
    }

    // ==================== TBB HISTORY (CACHE) ====================

    /**
     * Get TBB history cache
     * @returns {Object} Copy of tbbHistory object
     */
    getTBBHistory() {
        return { ...this.tbbHistory };
    }

    /**
     * Get a specific TBB history entry
     * @param {string} key - Cache key (year-month)
     * @returns {Object|null} TBB data or null if not found
     */
    getTBBHistoryEntry(key) {
        return this.tbbHistory[key] ? { ...this.tbbHistory[key] } : null;
    }

    /**
     * Set a TBB history entry
     * @param {string} key - Cache key (year-month)
     * @param {Object} value - TBB data
     */
    setTBBHistoryEntry(key, value) {
        this.tbbHistory[key] = value;
        this.saveData('tbb_history', this.tbbHistory);
    }

    /**
     * Delete a TBB history entry
     * @param {string} key - Cache key
     * @returns {boolean} True if deleted, false if not found
     */
    deleteTBBHistoryEntry(key) {
        if (this.tbbHistory[key] !== undefined) {
            delete this.tbbHistory[key];
            this.saveData('tbb_history', this.tbbHistory);
            return true;
        }
        return false;
    }

    /**
     * Clear all TBB history
     */
    clearTBBHistory() {
        this.tbbHistory = {};
        this.saveData('tbb_history', this.tbbHistory);
    }
}
