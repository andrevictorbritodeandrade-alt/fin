const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /\/\/ Automatic management of expenses for July 2026.*?\}, \[monthData, currentYear, currentMonth\]\);/s;

code = code.replace(regex, `// Automatic management of expenses for July 2026
    useEffect(() => {
        if (!monthData || currentYear !== 2026 || currentMonth !== 7) return;

        let hasChanged = false;
        // Deep clone to avoid mutating local state!
        const newData = JSON.parse(JSON.stringify(monthData));

        // 1. Ensure required expenses exist and are paid
        const expensesToEnsure = [
            { description: "ALUGUEL", amount: 1300, category: "Moradia", group: "Moradia" },
            { description: "CARTÃO DO ITAÚ DO ANDRÉ", amount: 200, category: "Moradia", group: "Moradia" },
            { description: "CARTÃO DO INTER", amount: 386, category: "Moradia", group: "Moradia" }
        ];

        expensesToEnsure.forEach(eToEnsure => {
            const existingIndex = newData.expenses.findIndex(e => e.description.toUpperCase().includes(eToEnsure.description.toUpperCase()));
            if (existingIndex !== -1) {
                const e = newData.expenses[existingIndex];
                // Check if amount is correct, paid is true, and category/group is Moradia
                if (Math.abs(e.amount - eToEnsure.amount) > 0.01 || !e.paid || e.category !== eToEnsure.category || e.group !== eToEnsure.group) {
                    newData.expenses[existingIndex] = { 
                        ...e, 
                        amount: eToEnsure.amount, 
                        category: eToEnsure.category, 
                        group: eToEnsure.group, 
                        paid: true, 
                        paidAt: e.paidAt || new Date().toISOString(), 
                        userModifiedPaid: true 
                    };
                    hasChanged = true;
                }
            } else {
                newData.expenses.push({
                    id: \`exp_\${eToEnsure.description.toLowerCase().replace(/\\s/g, '_')}_\${currentYear}_\${currentMonth}\`,
                    description: eToEnsure.description,
                    amount: eToEnsure.amount,
                    category: eToEnsure.category,
                    paid: true,
                    paidAt: new Date().toISOString(),
                    userModifiedPaid: true,
                    dueDate: \`\${currentYear}-\${currentMonth.toString().padStart(2,'0')}-01\`,
                    installments: { current: 1, total: 1 },
                    group: eToEnsure.group
                });
                hasChanged = true;
            }
        });

        // 2. Mark other requested expenses as paid
        const descriptionsToMark = ["CARTÃO DO ITAÚ DA MARCELLY"];

        newData.expenses = newData.expenses.map(e => {
            if (!e.paid && descriptionsToMark.some(d => e.description.toUpperCase().includes(d))) {
                hasChanged = true;
                return { ...e, paid: true, paidAt: new Date().toISOString(), userModifiedPaid: true };
            }
            return e;
        });

        if (hasChanged) {
            // Wait to prevent immediate loop issues, just in case
            setTimeout(() => {
                saveData(newData, currentYear, currentMonth);
            }, 100);
        }
    }, [monthData, currentYear, currentMonth]);`);
fs.writeFileSync('App.tsx', code);
