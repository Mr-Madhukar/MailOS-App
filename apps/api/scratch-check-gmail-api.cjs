/* eslint-disable @typescript-eslint/no-require-imports */
const { getCorsair } = require('./src/corsair');
require('dotenv').config({ path: '../../.env' }); // load from project root .env

async function main() {
  const corsair = getCorsair();
  console.log("gmail api keys:", Object.keys(corsair.gmail.api));
  console.log("gmail api users keys:", Object.keys(corsair.gmail.api.users));
}

main().catch(console.error);
