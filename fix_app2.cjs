const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /\/\/ Ensure our new CARTÃO DO IAGO is correctly there.*?const applyPreserved = \(t: Transaction\) => \{/s;

code = code.replace(regex, `// Ensure our new CARTÃO DO IAGO is correctly there
            const hasCartaoIago = data.expenses.some(e => e.description === 'CARTÃO DO IAGO' || e.description.includes('NUBANK'));
            const targetIagoAmount = (year === 2026 && month === 7) ? 430.00 : (year > 2026 || (year === 2026 && month >= 8) ? 0 : 1819.22);
            if (!hasCartaoIago) {
                data.expenses.push({
                    id: \`exp_cartao_iago_\${year}_\${month}\`,
                    description: "CARTÃO DO IAGO (NUBANK)",
                    amount: targetIagoAmount,
                    category: "Iago",
                    paid: false,
                    dueDate: \`\${year}-\${month.toString().padStart(2,'0')}-07\`,
                    group: 'IAGO (CARTÃO NUBANK)'
                });
            } else {
                // Ensure it has the correct amount (in case user had a different amount saved locally)
                data.expenses = data.expenses.map(e => e.description.includes('IAGO') && (e.description.includes('CARTAO') || e.description.includes('CARTÃO')) ? { ...e, description: "CARTÃO DO IAGO (NUBANK)", amount: targetIagoAmount, dueDate: \`\${year}-\${month.toString().padStart(2,'0')}-07\`, group: 'IAGO (CARTÃO NUBANK)' } : e);
            }

            // Ensure EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO is correctly present for months 7, 8, 9, 10 in 2026
            if (year === 2026 && month === 6) {
                 data.expenses = data.expenses.filter(e => {
                     const d = e.description.toUpperCase();
                     return !(d.includes('EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO') || d.includes('EMPRESTIMO PARA PAGAR AS CONTAS DE JUNHO'));
                 });
            }
            if (year === 2026 && month >= 7 && month <= 10) {
                const currentInst = month - 6; // July is 1, Aug is 2, Sept is 3, Oct is 4
                const hasLoanContas = data.expenses.some(e => {
                    const d = e.description.toUpperCase();
                    return d.includes('EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO') || d.includes('EMPRESTIMO PARA PAGAR AS CONTAS DE JUNHO');
                });
                if (!hasLoanContas) {
                    data.expenses.push({
                        id: \`fin_EMPRÉSTIMOPARAPAGARASCONTASDEJUNHO_\${currentInst}\`,
                        description: "EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO",
                        amount: 486.00, // 1944.00 / 4
                        category: "Dívidas",
                        paid: month === 7,
                        dueDate: \`2026-\${month.toString().padStart(2,'0')}-20\`,
                        installments: { current: currentInst, total: 4 },
                        group: 'MARCIA BRITO'
                    });
                } else {
                    // Update to ensure correct installment, amount, group, etc.
                    data.expenses = data.expenses.map(e => {
                        const d = e.description.toUpperCase();
                        if (d.includes('EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO') || d.includes('EMPRESTIMO PARA PAGAR AS CONTAS DE JUNHO')) {
                            return {
                                ...e,
                                amount: 486.00,
                                category: "Dívidas",
                                dueDate: \`2026-\${month.toString().padStart(2,'0')}-20\`,
                                installments: { current: currentInst, total: 4 },
                                paid: month === 7 ? true : e.paid,
                                group: 'MARCIA BRITO'
                            };
                        }
                        return e;
                    });
                }
            }

            // Seguro do carro in July 2026 is skipped (congelado)
            if (year === 2026 && month === 7) {
                 data.expenses = data.expenses.map(e => {
                     if (e.description.toUpperCase() === "SEGURO DO CARRO") {
                         return { ...e, skipped: true };
                     }
                     return e;
                 });
            }

            // 7. Markings as Paid based on user request (LILI, ITAÚ DO ANDRÉ, MARCIA BRITO, CARTÃO DO IAGO)
            const markAsPaidLogic = (e: Transaction) => {
                const desc = e.description.toUpperCase();
                
                // Aluguel
                if (desc === 'ALUGUEL') {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                if (desc === 'INTERNET DA CASA') {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Itaú do André
                if (desc.includes('CARTÃO DO ITAÚ DO ANDRÉ') || desc.includes('CARTAO DO ITAU DO ANDRE')) {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Todas as contas com LILI
                if (e.group === 'LILI TORRES' || desc.includes('LILI')) {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Cartão do Iago
                if (desc.includes('CARTÃO DO IAGO') || desc.includes('CARTAO DO IAGO') || desc.includes('IAGO (CARTÃO NUBANK)')) {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                // Marcia Brito (exceto Alinhamento do carro, exceto Marcia Bispo, exceto empréstimo contas de junho)
                const isMarciaBrito = e.group === 'MARCIA BRITO' || (desc.includes('MARCIA') && !desc.includes('BISPO') && e.group !== 'MARCIA BISPO');
                if (isMarciaBrito && desc !== 'ALINHAMENTO DO CARRO' && !desc.includes('EMPRÉSTIMO PARA PAGAR AS CONTAS DE JUNHO') && !desc.includes('EMPRESTIMO PARA PAGAR AS CONTAS DE JUNHO')) {
                    return { ...e, paid: true, paidAt: e.paidAt || "2026-06-06T12:00:00Z" };
                }

                return e;
            };

            if (month === 6) {
                data.expenses = data.expenses.map(markAsPaidLogic);
                data.avulsosItems = data.avulsosItems.map(markAsPaidLogic);
            }
        }

        // New installment expenses for Iago starting in August 2026
        let iagoNewInst = 0;
        if (year === 2026 && month >= 8 && month <= 12) {
            iagoNewInst = month - 7; // Aug = 1, Sept = 2, Oct = 3, Nov = 4, Dec = 5
        } else if (year === 2027 && month === 1) {
            iagoNewInst = 6;
        }

        if ((year === 2026 && month >= 8) || (year === 2027 && month === 1)) {
            const addOrUpdateIagoExpense = (description: string, amount: number, idSuffix: string, installments: any) => {
                const hasExpense = data.expenses.some(e => e.description.toUpperCase().includes(description.toUpperCase()));
                if (!hasExpense) {
                    data.expenses.push({
                        id: \`exp_\${idSuffix}_iago_\${year}_\${month}\`,
                        description: \`\${description} (IAGO)\`,
                        amount: amount,
                        category: "Iago",
                        paid: false,
                        dueDate: \`\${year}-\${month.toString().padStart(2,'0')}-07\`,
                        installments: installments,
                        group: 'IAGO (CARTÃO NUBANK)'
                    });
                } else {
                    data.expenses = data.expenses.map(e => e.description.toUpperCase().includes(description.toUpperCase()) 
                        ? { ...e, description: \`\${description} (IAGO)\`, amount: amount, installments: installments, dueDate: \`\${year}-\${month.toString().padStart(2,'0')}-07\`, group: 'IAGO (CARTÃO NUBANK)' } : e);
                }
            };

            if (year === 2026 && month === 8) {
                addOrUpdateIagoExpense("ABASTECIMENTO", 310.00, "abastecimento", null);
            }
            if (iagoNewInst >= 1 && iagoNewInst <= 6) {
                addOrUpdateIagoExpense("ESTADIA DE MARAGOGI", 37.61, "maragogi", { current: iagoNewInst, total: 6 });
                addOrUpdateIagoExpense("PRIMEIRA ESTADIA EM SALVADOR", 30.95, "primeira_salvador", { current: iagoNewInst, total: 6 });
                addOrUpdateIagoExpense("ESTADIA EM ARACAJU", 52.17, "aracaju", { current: iagoNewInst, total: 6 });
                addOrUpdateIagoExpense("SEGUNDA ESTADIA EM SALVADOR", 92.85, "segunda_salvador", { current: iagoNewInst, total: 6 });
            }
            
            // Cleanup old variables
            data.expenses = data.expenses.filter(e => {
                const d = e.description.toUpperCase();
                return !(d.includes("ESTADIA EM SALVADOR (IAGO)") && !d.includes("PRIMEIRA") && !d.includes("SEGUNDA")) && 
                       !(d.includes("COMPRA (697+697)")) &&
                       !(d.includes("ALUGUEL DO CARRO (IAGO)"));
            });
        }

        // Apply preserved user states
        const applyPreserved = (t: Transaction) => {`);

fs.writeFileSync('App.tsx', code);
