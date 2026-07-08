const fs = require('fs');
let code = fs.readFileSync('utils/financeUtils.ts', 'utf8');

code = code.replace(
    /\{ description: "CARTÃO DO IAGO", amount: 1819\.22, category: "Iago", day: 7, group: 'IAGO' \}/g,
    `{ description: "CARTÃO DO IAGO", amount: 1819.22, category: "Iago", day: 7, group: 'IAGO (CARTÃO NUBANK)' }`
);

fs.writeFileSync('utils/financeUtils.ts', code);
