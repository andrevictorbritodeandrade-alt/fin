const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const replacement = `// 1. Ensure required expenses exist and are paid
        const expensesToEnsure = [
            { description: "ALUGUEL DA CASA", amount: 1300, category: "Moradia", group: "Moradia" },
            { description: "CARTÃO DO ITAÚ DO ANDRÉ", amount: 200, category: "Moradia", group: "Moradia" },
            { description: "CARTÃO DO INTER DO ANDRÉ", amount: 386, category: "Moradia", group: "Moradia" }
        ];

        // Clean up duplicates if any were created by previous bug
        const uniqueExpenses = [];
        const seenDescriptions = new Set();
        newData.expenses.forEach(e => {
            const desc = e.description.toUpperCase();
            if (seenDescriptions.has(desc) && (desc.includes('CARTÃO DO INTER') || desc.includes('CARTÃO DO ITAÚ DO ANDRÉ') || desc.includes('ALUGUEL'))) {
                // skip duplicate
                hasChanged = true;
            } else {
                seenDescriptions.add(desc);
                uniqueExpenses.push(e);
            }
        });
        newData.expenses = uniqueExpenses;

        expensesToEnsure.forEach(eToEnsure => {`;

code = code.replace(/\/\/ 1\. Ensure required expenses exist and are paid\n\s*const expensesToEnsure = \[\n\s*\{ description: "ALUGUEL", amount: 1300, category: "Moradia", group: "Moradia" \},\n\s*\{ description: "CARTÃO DO ITAÚ DO ANDRÉ", amount: 200, category: "Moradia", group: "Moradia" \},\n\s*\{ description: "CARTÃO DO INTER", amount: 386, category: "Moradia", group: "Moradia" \}\n\s*\];\n\n\s*expensesToEnsure\.forEach\(eToEnsure => \{/, replacement);

fs.writeFileSync('App.tsx', code);
