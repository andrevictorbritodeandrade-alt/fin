const fs = require('fs');
let code = fs.readFileSync('utils/financeUtils.ts', 'utf8');

code = code.replace(
    /if \(year === 2026 && month >= 6\) \{\n\s*finalAmount = 100\.00;\n\s*\}/,
    `if (year === 2026 && month === 7) {
                    finalAmount = 200.00;
                } else if (year === 2026 && month >= 6) {
                    finalAmount = 100.00;
                }`
);

fs.writeFileSync('utils/financeUtils.ts', code);
