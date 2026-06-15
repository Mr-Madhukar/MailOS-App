# Google Cloud Setup Guide for MailOS

Follow these step-by-step instructions to create a Google Cloud Project, enable the required APIs, and obtain the Client ID and Client Secret for Gmail and Google Calendar.

---

## Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.
3. In the top navigation bar, click the project dropdown and select **New Project**.
4. Name the project (e.g., `MailOS App`) and click **Create**.

---

## Step 2: Enable the APIs
You need to enable both the Gmail API and the Google Calendar API for your project.
1. Make sure your newly created project is selected in the top dropdown.
2. In the left sidebar, navigate to **APIs & Services** > **Library**.
3. In the search bar, type `Gmail API`. Click on it and click **Enable**.
4. Go back to the Library page, search for `Google Calendar API`. Click on it and click **Enable**.

---

## Step 3: Configure the OAuth Consent Screen
Before you can generate credentials, you must configure the OAuth consent screen.
1. Navigate to **APIs & Services** > **OAuth consent screen** in the left sidebar.
2. Choose **External** user type and click **Create**.
3. Fill in the required **App Information**:
   - **App name**: `MailOS`
   - **User support email**: Choose your email address.
   - **Developer contact information**: Enter your email address.
4. Click **Save and Continue**.
5. **Scopes:** Click **Add or Remove Scopes**. Search for and select the following scopes:
   - `https://www.googleapis.com/auth/gmail.modify` (or full access for read/write operations)
   - `https://www.googleapis.com/auth/calendar` (full calendar access)
   - Click **Update** at the bottom, then click **Save and Continue**.
6. **Test Users:** Under the test users section, click **Add Users** and add your own Google email address (the one you want to authenticate with). *Note: Since your app is in testing mode, only listed test users will be able to log in.*
7. Click **Save and Continue** and then **Back to Dashboard**.

---

## Step 4: Create OAuth 2.0 Credentials
1. Navigate to **APIs & Services** > **Credentials** in the left sidebar.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. For **Application type**, choose **Web application**.
4. Name the credentials (e.g., `MailOS Local Client`).
5. Under **Authorized redirect URIs**, click **+ Add URI** and enter:
   ```
   http://localhost:3000/api/auth/callback
   ```
6. Click **Create**.
7. A popup will appear displaying your **Client ID** and **Client Secret**. Copy these values!

---

## Step 5: Configure in MailOS
1. Start the MailOS app (`pnpm dev`).
2. Open the page in your browser (`http://localhost:3000`).
3. Click the **Settings** gear icon in the bottom-left corner.
4. Enter your **Google Client ID** and **Google Client Secret** in the form and click **Save**.
5. You can now click **Connect Gmail** and **Connect Google Calendar** to log in!
