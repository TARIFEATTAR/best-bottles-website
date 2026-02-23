const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./data/grace_fitment.json', 'utf8'));
if (data.fitmentRules && Array.isArray(data.fitmentRules)) {
    fs.writeFileSync('./data/grace_fitment_array.json', JSON.stringify(data.fitmentRules, null, 2));
    console.log('Successfully created grace_fitment_array.json');
} else {
    console.log('Error: fitmentRules array not found in grace_fitment.json');
}
