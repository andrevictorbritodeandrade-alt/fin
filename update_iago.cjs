const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /\/\/ Ensure our new CARTÃO DO IAGO is correctly there.*?\}\s*\/\/ Ensure EMPRÉSTIMO PARA PAGAR/s;

const replacement = `// Ensure our new CARTÃO DO IAGO is correctly there
            const hasCartaoIago = data.expenses.some(e => e.description === 'CARTÃO DO IAGO' || e.description.includes('NUBANK'));
            const targetIagoAmount = (year === 2026 && month === 7) ? 1204.00 : (year > 2026 || (year === 2026 && month >= 8) ? 0 : 1819.22);
            if (!hasCartaoIago) {
                data.expenses.push({
                    id: \`exp_cartao_iago_\${year}_\${month}\`,
                    description: "CARTÃO DO IAGO (NUBANK)",
                    amount: targetIagoAmount,
                    category: "Iago",
                    paid: (year === 2026 && month === 7) ? true : false,
                    userModifiedPaid: (year === 2026 && month === 7) ? true : false,
                    dueDate: \`\${year}-\${month.toString().padStart(2,'0')}-07\`,
                    group: 'IAGO (CARTÃO NUBANK)'
                });
            } else {
                // Ensure it has the correct amount (in case user had a different amount saved locally)
                data.expenses = data.expenses.map(e => {
                    if (e.description.includes('IAGO') && (e.description.includes('CARTAO') || e.description.includes('CARTÃO'))) {
                        let isPaid = e.paid;
                        let userMod = e.userModifiedPaid;
                        if (year === 2026 && month === 7) {
                            isPaid = true;
                            userMod = true;
                        }
                        return { ...e, description: "CARTÃO DO IAGO (NUBANK)", amount: targetIagoAmount, paid: isPaid, userModifiedPaid: userMod, dueDate: \`\${year}-\${month.toString().padStart(2,'0')}-07\`, group: 'IAGO (CARTÃO NUBANK)' };
                    }
                    return e;
                });
            }

            // Ensure EMPRÉSTIMO PARA PAGAR`;

code = code.replace(regex, replacement);
fs.writeFileSync('App.tsx', code);
