#!/usr/bin/env node
import {
  init,
  setHeader,
  login,
  getMyUser,
  deleteApiKey,
  createApiKey,
  getApiKeys,
} from "@immich/sdk";

const DEMO_SERVER = "https://demo.immich.app";
const DEMO_EMAIL = "demo@immich.app";
const DEMO_PASSWORD = "demo";

async function getDemoApiKey() {
  try {
    console.error("Connecting to Immich demo instance");

    // Initialize SDK
    init({ baseUrl: `${DEMO_SERVER}/api` });

    // Login with demo credentials
    console.error("Logging in with demo credentials");
    const authResponse = await login({
      loginCredentialDto: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      },
    });
    // Update SDK with access token
    setHeader(
      "Cookie",
      `immich_access_token=${authResponse.accessToken}; immich_auth_type=password; immich_is_authenticated=true`,
    );

    // Get user info to confirm authentication
    const userInfo = await getMyUser();
    console.error(`Authenticated as: ${userInfo.email}`);

    // Check for existing API keys
    console.error("Checking for existing API keys");
    const existingKeys = await getApiKeys();

    // Look for a key named "immich-book-demo"
    const existingKey = existingKeys.find(
      (key) => key.name === "immich-book-demo",
    );

    if (existingKey) {
      console.error("Found existing immich-book-demo API key, replacing it");
      await deleteApiKey({ id: existingKey.id });
    }

    // Create a new API key
    console.error("Creating new API key");
    const newKey = await createApiKey({
      apiKeyCreateDto: {
        name: "immich-book-demo",
        permissions: ["album.read", "asset.read", "asset.view"],
      },
    });

    console.error("API key created successfully!");
    console.error(newKey.apiKey);

    // Output the secret to stdout (only place it should go)
    console.log(newKey.secret);
  } catch (error) {
    console.error("Error:", error);
    if (error.response) {
      console.error("Response:", await error.response.text());
    }
    process.exit(1);
  }
}

getDemoApiKey();
