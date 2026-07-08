const fs = require('fs');
let code = fs.readFileSync('utils/financeUtils.ts', 'utf8');

// Update Andre Salary
code = code.replace(/3100\.00/g, '3334.00');

// Update Cartão do Iago in financeUtils (from 430.00 to 1204.00)
code = code.replace(/finalAmount = 430\.00;/g, 'finalAmount = 1204.00;');

fs.writeFileSync('utils/financeUtils.ts', code);
