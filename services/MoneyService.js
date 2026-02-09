// MoneyService - Floating-point safe financial calculations
// Pure functions for handling money operations with proper rounding

class MoneyService {
    // Add two amounts with proper rounding to 2 decimal places
    moneyAdd(a, b) {
        return Math.round((a + b) * 100) / 100;
    }

    // Subtract two amounts with proper rounding to 2 decimal places
    moneySubtract(a, b) {
        return Math.round((a - b) * 100) / 100;
    }

    // Multiply an amount by a factor with proper rounding to 2 decimal places
    moneyMultiply(a, b) {
        return Math.round((a * b) * 100) / 100;
    }

    // Sum an array of amounts with proper rounding to 2 decimal places
    moneySum(amounts) {
        return Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
    }

    // Format a number as USD currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
}
