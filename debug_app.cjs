const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/if \(hasChanged\) \{\n\s*\/\/ Wait to prevent immediate loop issues, just in case/, `console.log("hasChanged is true! Reasons:", Object.keys(window).filter(k => k.startsWith('dbg_')));\n        if (hasChanged) {\n            // Wait to prevent immediate loop issues, just in case`);

code = code.replace(/hasChanged = true;/g, 'hasChanged = true; window["dbg_" + Math.random()] = new Error().stack;');

fs.writeFileSync('App.tsx', code);
