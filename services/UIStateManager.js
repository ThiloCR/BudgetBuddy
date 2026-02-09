// UIStateManager - Manages all UI state (view state, filters, selections, toggles)
// Centralized state management for the application's view layer

class UIStateManager {
    constructor() {
        // Transaction view state
        this.sortColumn = 'date';
        this.sortDirection = 'desc';
        this.filterAccounts = [];
        this.manageAccountsMode = false;
        this.selectedTransactions = new Set();

        // Category view state
        this.categoryViewOffset = 0;
        this.collapsedGroups = new Set();

        // Transaction form state
        this.splitCounter = 0;
        this.saveAndAddAnother = false;

        // Dashboard filters and state
        this.dashFilterAccounts = [];
        this.dashFilterCategories = [];
        this.dashFilterDateRange = 'this-month';
        this.dashExpandedSections = new Set();

        // Trend chart toggles
        this.trendShowExpense = true;
        this.trendShowIncome = true;

        // Change tracking for smart re-rendering
        this.lastTransactionsHash = null;
        this.lastAccountsHash = null;
        this.lastDashFilterState = null;
        this.spendingMapCache = null;
    }

    // Sorting
    getSortColumn() {
        return this.sortColumn;
    }

    getSortDirection() {
        return this.sortDirection;
    }

    toggleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
    }

    // Account filtering (Transactions view)
    getFilterAccounts() {
        return this.filterAccounts;
    }

    setFilterAccounts(accountIds) {
        this.filterAccounts = accountIds;
    }

    clearFilterAccounts() {
        this.filterAccounts = [];
    }

    // Account management mode
    isManageAccountsMode() {
        return this.manageAccountsMode;
    }

    toggleManageAccounts() {
        this.manageAccountsMode = !this.manageAccountsMode;
    }

    // Transaction selection
    getSelectedTransactions() {
        return this.selectedTransactions;
    }

    toggleTransactionSelect(transactionId) {
        if (this.selectedTransactions.has(transactionId)) {
            this.selectedTransactions.delete(transactionId);
        } else {
            this.selectedTransactions.add(transactionId);
        }
    }

    clearSelectedTransactions() {
        this.selectedTransactions.clear();
    }

    // Category view
    getCategoryViewOffset() {
        return this.categoryViewOffset;
    }

    setCategoryViewOffset(offset) {
        this.categoryViewOffset = offset;
    }

    getCollapsedGroups() {
        return this.collapsedGroups;
    }

    toggleGroupCollapse(groupId) {
        if (this.collapsedGroups.has(groupId)) {
            this.collapsedGroups.delete(groupId);
        } else {
            this.collapsedGroups.add(groupId);
        }
    }

    // Transaction form
    getSplitCounter() {
        return this.splitCounter;
    }

    incrementSplitCounter() {
        this.splitCounter++;
        return this.splitCounter;
    }

    resetSplitCounter() {
        this.splitCounter = 0;
    }

    getSaveAndAddAnother() {
        return this.saveAndAddAnother;
    }

    setSaveAndAddAnother(value) {
        this.saveAndAddAnother = value;
    }

    // Dashboard filters
    getDashFilterAccounts() {
        return this.dashFilterAccounts;
    }

    setDashFilterAccounts(accountIds) {
        this.dashFilterAccounts = accountIds;
    }

    getDashFilterCategories() {
        return this.dashFilterCategories;
    }

    setDashFilterCategories(categoryIds) {
        this.dashFilterCategories = categoryIds;
    }

    getDashFilterDateRange() {
        return this.dashFilterDateRange;
    }

    setDashFilterDateRange(range) {
        this.dashFilterDateRange = range;
    }

    getDashExpandedSections() {
        return this.dashExpandedSections;
    }

    toggleDashSection(name) {
        if (this.dashExpandedSections.has(name)) {
            this.dashExpandedSections.delete(name);
        } else {
            this.dashExpandedSections.add(name);
        }
    }

    // Trend chart toggles
    getTrendShowExpense() {
        return this.trendShowExpense;
    }

    setTrendShowExpense(value) {
        this.trendShowExpense = value;
    }

    getTrendShowIncome() {
        return this.trendShowIncome;
    }

    setTrendShowIncome(value) {
        this.trendShowIncome = value;
    }

    toggleTrendExpense() {
        this.trendShowExpense = !this.trendShowExpense;
    }

    toggleTrendIncome() {
        this.trendShowIncome = !this.trendShowIncome;
    }

    // Change tracking (for smart re-rendering)
    getLastTransactionsHash() {
        return this.lastTransactionsHash;
    }

    setLastTransactionsHash(hash) {
        this.lastTransactionsHash = hash;
    }

    getLastAccountsHash() {
        return this.lastAccountsHash;
    }

    setLastAccountsHash(hash) {
        this.lastAccountsHash = hash;
    }

    getLastDashFilterState() {
        return this.lastDashFilterState;
    }

    setLastDashFilterState(state) {
        this.lastDashFilterState = state;
    }

    getSpendingMapCache() {
        return this.spendingMapCache;
    }

    setSpendingMapCache(cache) {
        this.spendingMapCache = cache;
    }

    invalidateSpendingCache() {
        this.spendingMapCache = null;
    }

    // Utility function for hashing (used in change tracking)
    simpleHash(data) {
        return JSON.stringify(data).length + '-' + JSON.stringify(data).slice(0, 100);
    }
}
