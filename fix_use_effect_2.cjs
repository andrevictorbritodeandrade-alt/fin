const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const replacement = `// 1. Ensure required expenses exist and are paid
        const expensesToEnsure = [
            { description: "ALUGUEL", amount: 1300, category: "Moradia", group: "MORADIA" },
            { description: "CARTÃO DO ITAÚ DO ANDRÉ", amount: 200, category: "Moradia", group: "MORADIA" },
            { description: "CARTÃO DO INTER DO ANDRÉ", amount: 386, category: "Moradia", group: "MORADIA" }
        ];

        // Clean up duplicates if any were created by previous bug
        const uniqueExpenses = [];
        const seenDescriptions = new Set();
        newData.expenses.forEach(e => {
            const desc = e.description.toUpperCase();
            
            // Map bad names to standard names
            let standardDesc = desc;
            if (desc === 'ALUGUEL DA CASA') standardDesc = 'ALUGUEL';
            if (desc === 'CARTÃO DO INTER') standardDesc = 'CARTÃO DO INTER DO ANDRÉ';

            if (seenDescriptions.has(standardDesc) && (standardDesc.includes('CARTÃO DO INTER') || standardDesc.includes('CARTÃO DO ITAÚ DO ANDRÉ') || standardDesc.includes('ALUGUEL'))) {
                // skip duplicate
                hasChanged = true;
            } else {
                seenDescriptions.add(standardDesc);
                uniqueExpenses.push({...e, description: e.description === 'ALUGUEL DA CASA' ? 'ALUGUEL' : (e.description === 'CARTÃO DO INTER' ? 'CARTÃO DO INTER DO ANDRÉ' : e.description)});
                if (e.description !== standardDesc) hasChanged = true;
            }
        });
        newData.expenses = uniqueExpenses;

        expensesToEnsure.forEach(eToEnsure => {`;

code = code.replace(/\/\/ 1\. Ensure required expenses exist and are paid\n\s*const expensesToEnsure = \[\n\s*\{ description: "ALUGUEL DA CASA", amount: 1300, category: "Moradia", group: "Moradia" \},\n\s*\{ description: "CARTÃO DO ITAÚ DO ANDRÉ", amount: 200, category: "Moradia", group: "Moradia" \},\n\s*\{ description: "CARTÃO DO INTER DO ANDRÉ", amount: 386, category: "Moradia", group: "Moradia" \}\n\s*\];\n\n\s*\/\/ Clean up duplicates if any were created by previous bug\n\s*const uniqueExpenses = \[\];\n\s*const seenDescriptions = new Set\(\);\n\s*newData\.expenses\.forEach\(e => \{\n\s*const desc = e\.description\.toUpperCase\(\);\n\s*if \(seenDescriptions\.has\(desc\) && \(desc\.includes\('CARTÃO DO INTER'\) \|\| desc\.includes\('CARTÃO DO ITAÚ DO ANDRÉ'\) \|\| desc\.includes\('ALUGUEL'\)\)\) \{\n\s*\/\/ skip duplicate\n\s*hasChanged = true;\n\s*\} else \{\n\s*seenDescriptions\.add\(desc\);\n\s*uniqueExpenses\.push\(e\);\n\s*\}\n\s*\}\);\n\s*newData\.expenses = uniqueExpenses;\n\n\s*expensesToEnsure\.forEach\(eToEnsure => \{/, replacement);

fs.writeFileSync('App.tsx', code);
