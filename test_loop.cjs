const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
code = code.replace(/hasChanged = true;/g, 'hasChanged = true; console.log("hasChanged is true at:", new Error().stack.split("\\n")[1]);');
fs.writeFileSync('App.tsx', code);
