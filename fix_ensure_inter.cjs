const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /\/\/ Seguro do carro in July 2026 is skipped \(congelado\)/;

const addition = `// Ensure CARTÃO DO INTER DO ANDRÉ for July 2026
            if (year === 2026 && month === 7) {
                const hasInter = data.expenses.some(e => e.description.toUpperCase().includes("CARTÃO DO INTER DO ANDRÉ") || e.description.toUpperCase().includes("CARTAO DO INTER DO ANDRE"));
                if (!hasInter) {
                    data.expenses.push({
                        id: \`exp_cartao_inter_andre_\${year}_\${month}\`,
                        description: "CARTÃO DO INTER DO ANDRÉ",
                        amount: 386.00,
                        category: "Moradia",
                        paid: true, // as requested earlier
                        userModifiedPaid: true,
                        dueDate: \`\${year}-07-10\`,
                        installments: { current: 1, total: 1 },
                        group: 'MORADIA'
                    });
                }
            }

            // Seguro do carro in July 2026 is skipped (congelado)`;

code = code.replace(regex, addition);

// Also add ALUGUEL mapping to ensure amount 1300 and paid
const regex2 = /\/\/ 2\. Cartão do Itaú do André is 100 reais/;

const addition2 = `// Ensure Aluguel is 1300
            data.expenses = data.expenses.map(e => {
                const desc = e.description.toUpperCase();
                if (desc === "ALUGUEL") {
                    return { ...e, amount: 1300.00 };
                }
                return e;
            });

            // 2. Cartão do Itaú do André is 100 reais`;

code = code.replace(regex2, addition2);

fs.writeFileSync('App.tsx', code);
