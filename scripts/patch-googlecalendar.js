import fs from 'fs';
import path from 'path';

const filePath = 'D:/ALL CODING/ChaiCode WebDev/MailOS App/node_modules/.pnpm_patches/@corsair-dev/googlecalendar@0.1.3/dist/index.js';
let content = fs.readFileSync(filePath, 'utf8');

const target1 = 'eventType:e.enum(["default","outOfOffice","focusTime","workingLocation"]).optional()';
const replacement1 = 'eventType:e.string().optional()';

const target2 = 'eventType:o.enum(["default","outOfOffice","focusTime","workingLocation"]).optional()';
const replacement2 = 'eventType:o.string().optional()';

if (!content.includes(target1)) {
  console.error("Target 1 not found!");
  process.exit(1);
}

if (!content.includes(target2)) {
  console.error("Target 2 not found!");
  process.exit(1);
}

content = content.replace(target1, replacement1);
content = content.replace(target2, replacement2);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched index.js successfully!');
process.exit(0);
