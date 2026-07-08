const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const filterRegex = /\/\/ 6\. Iago single transaction requested by user.*?return true;\n\s*\/\/ Ensure our new CARTÃO DO IAGO is correctly there/s;

code = code.replace(filterRegex, `// 6. Iago single transaction requested by user
            data.expenses = data.expenses.filter(e => {
                const isIago = e.category === 'Iago' || e.group === 'IAGO' || e.group === 'IAGO (CARTÃO NUBANK)' || e.description.toUpperCase().includes('IAGO');
                if (isIago && !e.description.includes('CARTÃO DO IAGO') && !e.description.includes('CARTAO DO IAGO')) {
                    // Remove old hardcoded stuff that the user overwrote
                    if (year === 2026 && month < 8) {
                        return false; 
                    }
                }
                return true;
            });

            data.avulsosItems = data.avulsosItems.filter(e => {
                const isIago = e.category === 'Iago' || e.group === 'IAGO' || e.group === 'IAGO (CARTÃO NUBANK)' || e.description.toUpperCase().includes('IAGO');
                if (isIago && !e.description.includes('CARTÃO DO IAGO') && !e.description.includes('CARTAO DO IAGO')) {
                     if (year === 2026 && month < 8) {
                        return false; 
                    }
                }
                return true;
            });

            // Ensure our new CARTÃO DO IAGO is correctly there`);

fs.writeFileSync('App.tsx', code);
