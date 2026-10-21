# NetSuite SuiteTalk REST Integration Guide

This guide describes how to connect PayPilot to a real Oracle NetSuite account (Production or Sandbox) using **SuiteTalk REST Web Services** and **Token-Based Authentication (TBA)** with HMAC-SHA256 signatures.

---

## 1. Prerequisites
- NetSuite account with **Administrator** access.
- NetSuite Account ID (found at **Setup > Company > Company Information** in the *Account ID* field, e.g. `1234567` or `1234567_SB1`).

---

## 2. Enable SuiteTalk REST & Token-Based Authentication
1. Navigate to **Setup > Company > Enable Features**.
2. Click the **SuiteCloud** tab.
3. Under **SuiteTalk (Web Services)**:
   - Check **REST Web Services**.
4. Under **Manage Authentication**:
   - Check **Token-Based Authentication**.
5. Click **Save**.

---

## 3. Create a PayPilot Integration Record
1. Navigate to **Setup > Integration > Manage Integrations > New**.
2. Fill out the integration settings:
   - **Name**: `PayPilot Connector`
   - **State**: `Enabled`
3. Under **Authentication**:
   - Check **Token-Based Authentication**.
   - Uncheck **TBA: Authorization Flow** (server-to-server integration uses direct tokens).
   - Uncheck **User Credentials (User/Password)**.
4. Click **Save**.
5. **CRITICAL**: Copy and securely store the **Consumer Key / Client ID** and **Consumer Secret / Client Secret**. *NetSuite only displays these values once upon save.*

---

## 4. Set Role Permissions for PayPilot
1. Navigate to **Setup > Users/Roles > Manage Roles > New** (or customize an existing integration role).
2. Assign the following permissions:
   - **Transactions**:
     - *Bills*: **Full**
     - *Pay Bills*: **Full**
     - *Find Transaction*: **View**
   - **Lists**:
     - *Vendors*: **Full**
     - *Accounts*: **View**
     - *Currency*: **View**
   - **Setup**:
     - *REST Web Services*: **Full**
     - *Log in using Access Tokens*: **Full**
3. Save the role and assign it to your designated integration user (**Setup > Users/Roles > Manage Users**).

---

## 5. Issue Token ID and Token Secret
1. Navigate to **Setup > Users/Roles > Access Tokens > New**.
2. Complete the fields:
   - **Application Name**: Select `PayPilot Connector` (created in Step 3).
   - **User**: Select the integration user.
   - **Role**: Select the integration role configured in Step 4.
   - **Token Name**: `PayPilot API Token`
3. Click **Save**.
4. **CRITICAL**: Copy the **Token ID** and **Token Secret**. *NetSuite only displays these values once.*

---

## 6. Configure PayPilot Environment Variables
Add the following credentials to your `.env` file or cloud secrets manager:

```env
# NetSuite Account & TBA Configuration
NETSUITE_ACCOUNT_ID="1234567"
NETSUITE_CONSUMER_KEY="your-consumer-key-from-step-3"
NETSUITE_CONSUMER_SECRET="your-consumer-secret-from-step-3"
NETSUITE_TOKEN_ID="your-token-id-from-step-5"
NETSUITE_TOKEN_SECRET="your-token-secret-from-step-5"

# For Sandbox environments, format Account ID with hyphen in subdomain:
# e.g., https://1234567-sb1.suitetalk.api.netsuite.com/services/rest/record/v1
```

---

## 7. Verifying the Connection
Once credentials are set, verify connectivity using the PayPilot test runner or REST API:

```bash
# Verify connector contract tests locally against NetSuite SuiteTalk mock:
pnpm --filter @paypilot/connectors test

# Or initiate live sync status check:
curl -X GET "http://localhost:3000/v1/connectors/netsuite/status" \
  -H "Authorization: Bearer <your-paypilot-jwt>"
```

### Expected SuiteTalk REST Record Mappings:
| PayPilot Entity | NetSuite REST Record | SuiteTalk Endpoint |
|---|---|---|
| **Contractor** | `vendor` | `/services/rest/record/v1/vendor` |
| **Approved Invoice** | `vendorBill` | `/services/rest/record/v1/vendorBill` |
| **Payment Execution** | `vendorPayment` | `/services/rest/record/v1/vendorPayment` |
| **Chart of Accounts** | `account` | `/services/rest/record/v1/account` |
