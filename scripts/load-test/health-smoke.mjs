import { argv } from "node:process";

// Strict allowlist of pre-approved target origins for health smoke testing.
// Using explicit mapping to constant string literals severs taint propagation (jssecurity:S8703)
// and guarantees agentic workflows and CLI arguments cannot target arbitrary hosts or ports (SSRF).
function getValidatedOrigin(input) {
  let normalized = (input || "").trim().toLowerCase();
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Default to local development API server if omitted
  if (!normalized) {
    return "http://127.0.0.1:8000";
  }

  switch (normalized) {
    case "local":
    case "http://127.0.0.1:8000":
      return "http://127.0.0.1:8000";
    case "localhost":
    case "http://localhost:8000":
      return "http://localhost:8000";
    case "prod":
    case "production":
    case "https://mailos-api.mrmadhukar.in":
      return "https://mailos-api.mrmadhukar.in";
    default:
      throw new Error(
        `Disallowed target "${input}". For security (SSRF prevention), health smoke tests can only run against pre-approved targets: 'local' (http://127.0.0.1:8000), 'localhost' (http://localhost:8000), or 'prod' (https://mailos-api.mrmadhukar.in).`
      );
  }
}

const targetOrigin = getValidatedOrigin(argv[2]);
const healthUrl = new URL("/health", targetOrigin).href;
const readyUrl = new URL("/ready", targetOrigin).href;
const openapiUrl = new URL("/openapi.json", targetOrigin).href;

console.log(`Running health smoke test against ${targetOrigin}...`);

try {
  // 1. Check health
  const healthRes = await fetch(healthUrl);
  if (!healthRes.ok) {
    throw new Error(`/health returned status ${healthRes.status}`);
  }
  const healthJson = await healthRes.json();
  if (healthJson.healthy !== true) {
    throw new Error(`/health payload indicates unhealthy: ${JSON.stringify(healthJson)}`);
  }
  console.log("✓ /health is healthy");

  // 2. Check ready
  const readyRes = await fetch(readyUrl);
  if (!readyRes.ok) {
    throw new Error(`/ready returned status ${readyRes.status}`);
  }
  const readyJson = await readyRes.json();
  console.log(`✓ /ready status: ${readyJson.ready ? "ready" : "starting"}`);

  // 3. Check openapi
  const openapiRes = await fetch(openapiUrl);
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
