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

    // ==================== PLACEHOLDER GETTERS ====================
    // These will be implemented in Sessions 2 and 3

    getCategories() {
        return [...this.categories];
    }

    getGroups() {
        return [...this.groups];
    }

    getTransactions() {
        return [...this.transactions];
    }

    getPayees() {
        return [...this.payees];
    }

    getAllocations() {
        return { ...this.allocations };
    }

    getTBBHistory() {
        return { ...this.tbbHistory };
    }
}
