// DemoData - Generates a fictional but realistic dataset for the demo site.
// Entirely made up; contains no real personal financial information.
// Produces data in DataStore's native shape, dated relative to "today" so the
// dashboard always looks current. Used by the "Load demo data" button.

const DemoData = (function () {
    // Deterministic PRNG (mulberry32) so the demo looks the same on every load.
    function makeRng(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const pad2 = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const iso = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString();

    function generate() {
        const rng = makeRng(20260612);
        const round2 = (n) => Math.round(n * 100) / 100;
        const pick = (arr) => arr[Math.floor(rng() * arr.length)];
        const jitter = (base, pct) => round2(base * (1 + (rng() * 2 - 1) * pct));

        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const MONTHS_BACK = 3; // current month + 3 prior = 4 months of history

        // ---- Accounts (balances stored directly; not derived from transactions) ----
        const accounts = [
            { id: 'demo-acc-checking', name: 'Everyday Checking', type: 'chequing',  balance: 4218.55 },
            { id: 'demo-acc-savings',  name: 'High-Yield Savings', type: 'savings',   balance: 18540.00 },
            { id: 'demo-acc-cash',     name: 'Cash Wallet',        type: 'cash',      balance: 145.00 },
            { id: 'demo-acc-credit',   name: 'Rewards Credit Card',type: 'credit',    balance: -1243.18 },
            { id: 'demo-acc-invest',   name: 'Brokerage',          type: 'investment',balance: 32675.40 },
        ].map(a => ({ ...a, currency: 'USD', notes: '', createdAt: iso(today), updatedAt: iso(today) }));

        // ---- Groups ----
        const groups = [
            { id: 'demo-grp-bills',     name: 'Monthly Bills',  monthlyLimit: null },
            { id: 'demo-grp-everyday',  name: 'Everyday',       monthlyLimit: null },
            { id: 'demo-grp-lifestyle', name: 'Lifestyle',      monthlyLimit: null },
            { id: 'demo-grp-savings',   name: 'Savings Goals',  monthlyLimit: null },
        ].map(g => ({ ...g, createdAt: iso(today), updatedAt: iso(today) }));

        // ---- Categories ----
        const categories = [
            { id: 'demo-cat-rent',      name: 'Rent',           groupId: 'demo-grp-bills',     monthlyLimit: 1800 },
            { id: 'demo-cat-electric',  name: 'Electricity',    groupId: 'demo-grp-bills',     monthlyLimit: 120 },
            { id: 'demo-cat-internet',  name: 'Internet',       groupId: 'demo-grp-bills',     monthlyLimit: 70 },
            { id: 'demo-cat-phone',     name: 'Phone',          groupId: 'demo-grp-bills',     monthlyLimit: 55 },
            { id: 'demo-cat-subs',      name: 'Subscriptions',  groupId: 'demo-grp-bills',     monthlyLimit: 45 },
            { id: 'demo-cat-insurance', name: 'Insurance',      groupId: 'demo-grp-bills',     monthlyLimit: 160 },
            { id: 'demo-cat-groceries', name: 'Groceries',      groupId: 'demo-grp-everyday',  monthlyLimit: 600 },
            { id: 'demo-cat-dining',    name: 'Dining Out',     groupId: 'demo-grp-everyday',  monthlyLimit: 250 },
            { id: 'demo-cat-fuel',      name: 'Gas & Transit',  groupId: 'demo-grp-everyday',  monthlyLimit: 160 },
            { id: 'demo-cat-coffee',    name: 'Coffee',         groupId: 'demo-grp-everyday',  monthlyLimit: 60 },
            { id: 'demo-cat-shopping',  name: 'Shopping',       groupId: 'demo-grp-lifestyle', monthlyLimit: 200 },
            { id: 'demo-cat-fitness',   name: 'Fitness',        groupId: 'demo-grp-lifestyle', monthlyLimit: 50 },
            { id: 'demo-cat-fun',       name: 'Entertainment',  groupId: 'demo-grp-lifestyle', monthlyLimit: 120 },
            { id: 'demo-cat-personal',  name: 'Personal Care',  groupId: 'demo-grp-lifestyle', monthlyLimit: 80 },
            { id: 'demo-cat-emergency', name: 'Emergency Fund', groupId: 'demo-grp-savings',   monthlyLimit: 300 },
            { id: 'demo-cat-vacation',  name: 'Vacation',       groupId: 'demo-grp-savings',   monthlyLimit: 200 },
        ].map(c => ({ ...c, createdAt: iso(today), updatedAt: iso(today) }));

        const transactions = [];
        const payeeSet = new Set();
        let counter = 0;
        const mkId = () => `demo-txn-${(counter++).toString(36)}`;

        function addExpense(date, payee, accountId, splits, notes) {
            if (date > today) return;
            payeeSet.add(payee);
            const total = round2(splits.reduce((s, sp) => s + sp.amount, 0));
            transactions.push({
                id: mkId(), date: ymd(date), type: 'expense', payee, accountId,
                totalAmount: total, notes: notes || '', splits,
                toAccountId: null, createdAt: iso(date), updatedAt: iso(date),
            });
        }
        function addIncome(date, payee, accountId, amount, notes) {
            if (date > today) return;
            payeeSet.add(payee);
            transactions.push({
                id: mkId(), date: ymd(date), type: 'income', payee, accountId,
                totalAmount: round2(amount), notes: notes || '', splits: [],
                toAccountId: null, createdAt: iso(date), updatedAt: iso(date),
            });
        }
        function addTransfer(date, fromId, toId, amount, notes) {
            if (date > today) return;
            transactions.push({
                id: mkId(), date: ymd(date), type: 'transfer', payee: '', accountId: fromId,
                totalAmount: round2(amount), notes: notes || '', splits: [],
                toAccountId: toId, createdAt: iso(date), updatedAt: iso(date),
            });
        }

        const dateIn = (monthOffset, day) => {
            const d = new Date(today.getFullYear(), today.getMonth() - monthOffset, day);
            d.setHours(12, 0, 0, 0);
            return d;
        };

        const groceryPayees = ['Whole Foods', "Trader Joe's", 'Safeway', 'Costco'];
        const diningPayees = ['Chipotle', 'Olive Garden', 'Local Bistro', 'Sushi Yama', 'Pizza Co'];
        const fuelPayees = ['Shell', 'Chevron', 'Metro Transit'];
        const coffeePayees = ['Blue Bottle', 'Starbucks', 'Stumptown'];
        const shopPayees = ['Amazon', 'Target', 'Uniqlo', 'Best Buy'];
        const funPayees = ['AMC Theatres', 'Steam', 'Concert Tickets', 'Spotify Live'];

        // Build month by month, oldest to newest.
        for (let m = MONTHS_BACK; m >= 0; m--) {
            // Income: biweekly payroll (1st and 15th)
            addIncome(dateIn(m, 1), 'Acme Corp Payroll', 'demo-acc-checking', jitter(2450, 0.01), 'Salary');
            addIncome(dateIn(m, 15), 'Acme Corp Payroll', 'demo-acc-checking', jitter(2450, 0.01), 'Salary');

            // Recurring bills
            addExpense(dateIn(m, 1),  'Skyline Apartments',  'demo-acc-checking', [{ categoryId: 'demo-cat-rent', amount: 1800 }]);
            addExpense(dateIn(m, 8),  'City Power',          'demo-acc-checking', [{ categoryId: 'demo-cat-electric', amount: jitter(115, 0.18) }]);
            addExpense(dateIn(m, 6),  'Comlink Fiber',       'demo-acc-checking', [{ categoryId: 'demo-cat-internet', amount: 69.99 }]);
            addExpense(dateIn(m, 12), 'Cellone Wireless',    'demo-acc-checking', [{ categoryId: 'demo-cat-phone', amount: 55 }]);
            addExpense(dateIn(m, 3),  'Netflix',             'demo-acc-credit',   [{ categoryId: 'demo-cat-subs', amount: 15.49 }]);
            addExpense(dateIn(m, 3),  'Spotify',             'demo-acc-credit',   [{ categoryId: 'demo-cat-subs', amount: 11.99 }]);
            addExpense(dateIn(m, 10), 'SafeGuard Insurance', 'demo-acc-checking', [{ categoryId: 'demo-cat-insurance', amount: 158 }]);
            addExpense(dateIn(m, 5),  'FitLife Gym',         'demo-acc-credit',   [{ categoryId: 'demo-cat-fitness', amount: 49 }]);
            addExpense(dateIn(m, 18), 'Clip & Co',           'demo-acc-credit',   [{ categoryId: 'demo-cat-personal', amount: jitter(35, 0.2) }]);

            // Weekly groceries (~4/month)
            [4, 11, 18, 25].forEach(day => {
                addExpense(dateIn(m, day), pick(groceryPayees), 'demo-acc-credit',
                    [{ categoryId: 'demo-cat-groceries', amount: jitter(115, 0.25) }]);
            });

            // Dining (~6/month)
            [2, 7, 13, 17, 22, 27].forEach(day => {
                addExpense(dateIn(m, day), pick(diningPayees), 'demo-acc-credit',
                    [{ categoryId: 'demo-cat-dining', amount: jitter(34, 0.4) }]);
            });

            // Fuel / transit (~3/month)
            [5, 16, 26].forEach(day => {
                addExpense(dateIn(m, day), pick(fuelPayees), 'demo-acc-credit',
                    [{ categoryId: 'demo-cat-fuel', amount: jitter(48, 0.25) }]);
            });

            // Coffee (~8/month)
            [2, 5, 9, 12, 16, 20, 23, 28].forEach(day => {
                addExpense(dateIn(m, day), pick(coffeePayees), 'demo-acc-credit',
                    [{ categoryId: 'demo-cat-coffee', amount: jitter(5.25, 0.25) }]);
            });

            // Shopping (~2/month)
            [9, 21].forEach(day => {
                addExpense(dateIn(m, day), pick(shopPayees), 'demo-acc-credit',
                    [{ categoryId: 'demo-cat-shopping', amount: jitter(62, 0.5) }]);
            });

            // Entertainment (~2/month)
            [14, 24].forEach(day => {
                addExpense(dateIn(m, day), pick(funPayees), 'demo-acc-credit',
                    [{ categoryId: 'demo-cat-fun', amount: jitter(28, 0.45) }]);
            });

            // A multi-split run once a month (groceries + personal care + shopping)
            addExpense(dateIn(m, 20), 'Target', 'demo-acc-credit', [
                { categoryId: 'demo-cat-groceries', amount: jitter(46, 0.2) },
                { categoryId: 'demo-cat-personal',  amount: jitter(18, 0.2) },
                { categoryId: 'demo-cat-shopping',  amount: jitter(31, 0.3) },
            ], 'Weekend run');

            // Savings transfers
            addTransfer(dateIn(m, 2),  'demo-acc-checking', 'demo-acc-savings', 300, 'Monthly savings');
            // Credit card payment
            addTransfer(dateIn(m, 15), 'demo-acc-checking', 'demo-acc-credit', jitter(950, 0.1), 'Credit card payment');
        }

        // ---- Allocations: fully fund each category for current & previous 3 months ----
        const allocations = {};
        for (let m = MONTHS_BACK; m >= 0; m--) {
            const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
            const year = d.getFullYear();
            const month = d.getMonth(); // 0-based, matching app's allocation keys
            categories.forEach(c => {
                if (c.monthlyLimit && c.monthlyLimit > 0) {
                    allocations[`${c.id}-${year}-${month}`] = c.monthlyLimit;
                }
            });
        }

        return {
            accounts,
            groups,
            categories,
            transactions,
            payees: Array.from(payeeSet),
            allocations,
        };
    }

    return { generate };
})();

if (typeof window !== 'undefined') window.DemoData = DemoData;
