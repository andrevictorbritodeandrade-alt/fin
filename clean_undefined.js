const fs = require('fs');

const appContent = fs.readFileSync('App.tsx', 'utf8');

// Looking for where setDoc is used in App.tsx
const match = appContent.match(/setDoc\(/g);
console.log(match ? match.length : 0);
