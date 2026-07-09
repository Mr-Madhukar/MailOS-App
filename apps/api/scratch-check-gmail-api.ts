import { createCorsair } from 'corsair';
import { gmail } from '@corsair-dev/gmail';

const corsair = createCorsair({
  plugins: [gmail()],
  kek: 'a'.repeat(32), // dummy 32-byte key
  multiTenancy: true,
});

const client = corsair.withTenant('dummy');
console.log("gmail api keys:", Object.keys(client.gmail.api));

const gmailApi = client.gmail.api as unknown as {
  users?: {
    getProfile?: unknown;
    get?: unknown;
    watch?: unknown;
  };
};

console.log("gmail api users keys:", Object.keys(gmailApi.users || {}));
console.log("gmail api users getProfile:", typeof gmailApi.users?.getProfile);
console.log("gmail api users get:", typeof gmailApi.users?.get);
console.log("gmail api users watch:", typeof gmailApi.users?.watch);
