import { argv } from "node:process";

const baseUrl = argv[2] || "http://127.0.0.1:8000";
console.log(`Running health smoke test against ${baseUrl}...`);

try {
  // 1. Check health
  const healthRes = await fetch(`${baseUrl}/health`);
  if (!healthRes.ok) {
    throw new Error(`/health returned status ${healthRes.status}`);
  }
  const healthJson = await healthRes.json();
  if (healthJson.healthy !== true) {
    throw new Error(`/health payload indicates unhealthy: ${JSON.stringify(healthJson)}`);
  }
  console.log("✓ /health is healthy");

  // 2. Check ready
  const readyRes = await fetch(`${baseUrl}/ready`);
  if (!readyRes.ok) {
    throw new Error(`/ready returned status ${readyRes.status}`);
  }
  const readyJson = await readyRes.json();
  console.log(`✓ /ready status: ${readyJson.ready ? "ready" : "starting"}`);

  // 3. Check openapi
  const openapiRes = await fetch(`${baseUrl}/openapi.json`);
  if (!openapiRes.ok) {
    throw new Error(`/openapi.json returned status ${openapiRes.status}`);
  }
  const openapiJson = await openapiRes.json();
  if (!openapiJson.paths) {
    throw new Error("openapi.json missing paths definitions");
  }
  console.log("✓ /openapi.json is valid");

  console.log("Health smoke test completed successfully!");
  process.exit(0);
} catch (error) {
  console.error("Health smoke test failed:", error);
  process.exit(1);
}
