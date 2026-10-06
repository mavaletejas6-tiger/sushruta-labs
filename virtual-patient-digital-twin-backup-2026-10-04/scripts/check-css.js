const fs = require('fs');
const c = fs.readFileSync('virtual-patient-digital-twin/css/style.css', 'utf8');
let bal = 0;
for (const ch of c) { if (ch === '{') bal++; if (ch === '}') bal--; }
console.log('braces balance: ' + bal);
console.log('has Sohne stack: ' + (c.indexOf('Sohne') !== -1));
console.log('has font-face: ' + (c.indexOf('@font-face') !== -1));
console.log('css bytes: ' + c.length);
