const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
code = code.replace(/hasChanged = true; window\["dbg_" \+ Math.random\(\)\] = new Error\(\)\.stack;/g, 'hasChanged = true;');
code = code.replace(/console\.log\("hasChanged is true! Reasons:", Object\.keys\(window\)\.filter\(k => k\.startsWith\('dbg_'\)\)\);\n\s*if \(hasChanged\) \{\n\s*\/\/ Wait to prevent immediate loop issues, just in case/g, 'if (hasChanged) {\n            // Wait to prevent immediate loop issues, just in case');
fs.writeFileSync('App.tsx', code);
