# LinkedIn Developer App Setup Guide

This guide walks you through creating a LinkedIn Developer App, configuring the necessary API products, and getting your credentials ready for the Content Automation Tool.

**Time estimate:** 15 minutes for initial setup. Analytics API approval takes 1-4 weeks.

---

## Table of Contents

1. [Create a LinkedIn Company Page](#1-create-a-linkedin-company-page)
2. [Create a LinkedIn Developer App](#2-create-a-linkedin-developer-app)
3. [Add "Share on LinkedIn" Product](#3-add-share-on-linkedin-product)
4. [Request Community Management API Access](#4-request-community-management-api-access-for-analytics)
5. [Configure OAuth Redirect URI](#5-configure-oauth-redirect-uri)
6. [Get Client ID and Secret](#6-get-client-id-and-secret)
7. [Set API Version](#7-set-api-version)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Create a LinkedIn Company Page

A Company Page is required before you can create a Developer App. This applies even if you're building a tool for personal use only.

1. Go to [linkedin.com/company/create](https://www.linkedin.com/company/create)
2. Select your page type: **Small business** works fine for individual developers
3. Fill in the required fields:
   - **Company name** — something recognizable, e.g., "My Content Automation"
   - **LinkedIn public URL** — this becomes your page's permanent address
   - **Website** — your personal site or a placeholder URL
   - **Industry** — pick one that fits, e.g., "Technology"
   - **Company size** — "1" if this is just for you
   - **Organization type** — "Self-employed" or "Partnership"
4. Click **Create page**
5. Verify ownership:
   - LinkedIn sends a verification email to the address on your personal account
   - Click the link in the email to confirm
   - You can also verify through your LinkedIn profile if prompted

> **Tip:** You don't need to publish any content on this page. It exists solely to satisfy LinkedIn's requirement for Developer App registration.

[Screenshot: LinkedIn Company Page creation form]

---

## 2. Create a LinkedIn Developer App

1. Go to [linkedin.com/developers](https://www.linkedin.com/developers/)
2. Sign in with your LinkedIn account (the same one that owns the Company Page)
3. Click **Create App**
4. Fill in the app details:
   - **App name** — anything you like, e.g., "Content Automation Tool"
   - **LinkedIn Page** — select the Company Page you created in Step 1
   - **Privacy policy URL** — enter any valid URL for development (e.g., `https://example.com/privacy`). You can update this later.
   - **App logo** — optional, but uploading one makes the OAuth consent screen look more professional
5. Check the box to agree to LinkedIn's Developer Terms
6. Click **Create app**

You'll land on your app's dashboard. The **App ID** shown at the top is your Client ID, which you'll need in Step 6.

[Screenshot: LinkedIn Developer App creation form]

---

## 3. Add "Share on LinkedIn" Product

This product grants the `w_member_social` scope, which lets you post content and comments on behalf of a member. Approval is instant, no application required.

1. In your app dashboard, go to the **Products** tab
2. Click **Add Product**
3. Find **Share on LinkedIn** and click **Add**
4. The product appears in your list with a status of "Added" or "Approved"

That's it. You now have access to:
- `w_member_social` — post articles, share content, and manage comments

This scope alone is enough for the core content posting features of the tool.

[Screenshot: Products tab with Share on LinkedIn added]

---

## 4. Request Community Management API Access (for Analytics)

The Community Management API provides `r_member_postAnalytics`, which gives you access to post performance metrics like impressions, likes, comments, and shares. This scope requires a manual approval process.

1. In your app dashboard, go to the **Products** tab
2. Click **Add Product**
3. Find **Community Management API** and click **Add**
4. Fill out the access request form:
   - **Use case description** — explain why you need analytics. For example: "I'm building a personal content strategy tool to track which posts perform best. The API will help me monitor impressions, engagement rates, and audience growth for my own posts."
   - **Expected API usage** — be realistic. Something like: "Approximately 10-50 API calls per day to check metrics on recent posts."
   - **Implementation plan** — describe what you're building. Example: "A CLI tool that fetches post analytics daily and generates a simple performance report."
5. Submit the form

**What happens next:**
- LinkedIn reviews your request (typically 1-4 weeks, sometimes faster)
- You'll receive an email when it's approved or if they need more information
- Check the Products tab periodically for status updates

> **Important:** While you wait for approval, the analytics features in the Content Automation Tool will use mock data. Everything else (posting, commenting) works fine with just `w_member_social`.

[Screenshot: Community Management API access request form]

---

## 5. Configure OAuth Redirect URI

The OAuth flow redirects users back to your app after authentication. For local development, this points to a simple HTTP server that runs on port 3000.

1. In your app dashboard, go to the **Auth** tab
2. Under **Authorized redirect URLs for your app**, click **Add redirect URL**
3. Enter: `http://localhost:3000/callback`
4. Click **Update**

> **Note:** The redirect URI must match exactly what your app sends during the OAuth flow. A mismatch causes the "Redirect URI mismatch" error. If you change the port in your config, update this URL to match.

[Screenshot: Auth tab with redirect URI configured]

---

## 6. Get Client ID and Secret

These credentials authenticate your app with LinkedIn's API. Treat the Client Secret like a password.

1. In your app dashboard, go to the **Auth** tab
2. You'll see two fields at the top:
   - **Client ID** (also called App ID) — this is public and safe to include in client-side code
   - **Client Secret** — this is private, never share it or commit it to version control
3. Click the **eye icon** next to Client Secret to reveal it, then copy both values

**Store them securely:**

```bash
# Initialize the config file (interactive prompt)
bun run main.ts config init
```

Or add them manually to `config.json`:

```json
{
  "client_id": "your-client-id-here",
  "client_secret": "your-client-secret-here"
}
```

> **Security:** Add `config.json` to `.gitignore` if it isn't already. Never hardcode secrets in source files or push them to a repository.

[Screenshot: Auth tab showing Client ID and Secret fields]

---

## 7. Set API Version

LinkedIn uses monthly version numbers (e.g., `202605` for May 2026). Each version stays supported for 12 months before deprecation.

**How versioning works:**
- Version format: `YYYYMM` (year + month)
- You set the version via the `LinkedIn-Version` HTTP header on every API request
- Example: `LinkedIn-Version: 202605`
- LinkedIn announces deprecations on their [developer blog](https://engineering.linkedin.com/blog)

**In your config.json:**

```json
{
  "api_version": "202605"
}
```

**When to update:**
- When LinkedIn deprecates the version you're using (you'll get a `410 Gone` or similar error)
- Check the [LinkedIn API changelog](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) periodically
- Update the version in your config and test your API calls

> **Tip:** Don't use the absolute latest version unless you need a new feature. Using a version that's 1-2 months old gives LinkedIn time to fix any early bugs in newer releases.

---

## 8. Troubleshooting

### "Company Page required" error during app creation

LinkedIn requires you to associate every Developer App with a Company Page. If you see this error:

1. Make sure you created a Company Page (Step 1)
2. Verify you're logged into the same LinkedIn account that owns the page
3. Try refreshing the Developer Portal page and selecting your Company Page again
4. If the page was just created, wait a few minutes. LinkedIn sometimes takes a moment to make new pages available for selection

### "Scope not authorized" when calling the API

This means your app doesn't have permission for the API endpoint you're trying to use.

1. Go to your app's **Products** tab
2. Verify the required product is listed as "Approved" or "Added"
3. For posting content, you need **Share on LinkedIn** (`w_member_social`)
4. For analytics, you need **Community Management API** (`r_member_postAnalytics`)
5. If the product is listed but shows "Pending," wait for approval

### "Redirect URI mismatch" during OAuth

The redirect URI your app sends doesn't match what's registered in the Developer Portal.

1. Go to the **Auth** tab in your app settings
2. Check the **Authorized redirect URLs** list
3. Make sure it exactly matches what your app uses, including:
   - Protocol (`http://` vs `https://`)
   - Hostname (`localhost` vs `127.0.0.1`)
   - Port number (`:3000`)
   - Path (`/callback`)
4. Common mistake: using `https://localhost:3000/callback` when only `http://localhost:3000/callback` is registered

### Token refresh failures

If your access token stops working and refresh fails:

1. Access tokens expire after 60 days. Refresh tokens expire after 12 months.
2. Run the OAuth flow again to get fresh tokens
3. Check that your Client Secret hasn't been regenerated in the Developer Portal (this invalidates all existing tokens)
4. Verify `config.json` has the correct refresh token value

### Rate limiting (429 Too Many Requests)

LinkedIn enforces rate limits per application and per member.

1. Space out your API calls (the tool includes built-in delays)
2. If you hit a limit, wait and retry after a few minutes
3. LinkedIn's general limits:
   - 100 calls per day per member for most endpoints
   - 500 calls per day per app (varies by product)
4. Check the `X-RateLimit-Remaining` response header to monitor your usage
5. If you consistently hit limits, you may need to request a quota increase from LinkedIn

### "The request is not properly authenticated" (401)

Your access token is missing, expired, or malformed.

1. Check that your `config.json` contains a valid access token
2. Make sure the token starts with `AQ` (LinkedIn's standard prefix)
3. Verify you're sending it as a Bearer token: `Authorization: Bearer {token}`
4. If the token is expired, use the refresh token to get a new one
5. If refresh fails, re-run the full OAuth flow

### `w_member_social` scope not appearing

If you added "Share on LinkedIn" but the scope doesn't show up in your app:

1. Go to the **Products** tab and confirm the product is listed
2. Try removing and re-adding the product
3. Log out of the Developer Portal and log back in
4. In rare cases, LinkedIn's UI takes time to update. Wait 10-15 minutes and check again
5. Verify you're looking at the correct app (you might have multiple apps)

### Analytics returning empty/null data

If the Community Management API returns no data even though your posts exist:

1. Confirm **Community Management API** is approved on the **Products** tab
2. Make sure you're querying your own posts (the API only returns data for the authenticated member)
3. New posts may take up to 24 hours to appear in analytics data
4. Check that you're using the correct post URN format: `urn:li:share:{postId}`
5. If using mock data, this is expected while waiting for API approval (see Step 4)

---

## Next Steps

Once your Developer App is set up:

1. Run the OAuth flow: `bun run main.ts auth`
2. The tool opens a browser, you authorize the app, and tokens are saved to `config.json`
3. Start using the content features: `bun run main.ts post --help`
