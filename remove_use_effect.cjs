const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /\/\/ Automatic management of expenses for July 2026.*?\}, \[monthData, currentYear, currentMonth\]\);/s;

if (regex.test(code)) {
    code = code.replace(regex, '');
    fs.writeFileSync('App.tsx', code);
    console.log("Successfully removed useEffect");
} else {
    console.log("useEffect not found");
}
