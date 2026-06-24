const fs = require('fs');
const key = fs.readFileSync('zoho_private.pem', 'utf8');
const formatted = key.split(/\r?\n/).join('\\n');
fs.appendFileSync('.env', '\n# Zoho Desk ASAP SDK Key\nZOHO_ASAP_PRIVATE_KEY="' + formatted + '"\n');
console.log('Appended to .env');
