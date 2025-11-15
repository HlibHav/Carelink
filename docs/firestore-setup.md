# Firestore Setup Guide

## Overview

CareLink uses Google Cloud Firestore for storing user data, memories, conversations, and ACE playbooks.

## Configuration

### Environment Variables

Set these in your `.env` file (or `.env/.env`):

```bash
# Google Cloud Project ID
GOOGLE_PROJECT_ID=carelink-478309

# Path to service account credentials JSON file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/carelink-478309-49d23b3dbd49.json

# Optional: Use Firestore Emulator for local development
# FIRESTORE_EMULATOR_HOST=localhost:9090
```

### Service Account Credentials

1. **Get credentials file**: The service account JSON file should be placed in `backend/carelink-478309-49d23b3dbd49.json`
2. **Set path**: Update `GOOGLE_APPLICATION_CREDENTIALS` to point to this file
3. **Verify project ID**: Ensure `GOOGLE_PROJECT_ID` matches the `project_id` in the credentials file

### Local Development with Emulator

For local development, you can use the Firestore Emulator:

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Start the emulator**:
   ```bash
   firebase emulators:start --only firestore
   ```

3. **Set emulator host** in `.env`:
   ```bash
   FIRESTORE_EMULATOR_HOST=localhost:9090
   ```

4. **Note**: When using emulator, `GOOGLE_APPLICATION_CREDENTIALS` is not required.

## Project Structure

Firestore collections follow this structure:

```
users/{userId}/
  ├── profile (document)
  ├── facts/ (subcollection)
  ├── goals/ (subcollection)
  ├── gratitude/ (subcollection)
  ├── conversations/ (subcollection)
  │   └── {sessionId}/
  │       └── turns/ (subcollection)
  └── playbooks/ (subcollection)
      └── default (document)
```

## Verification

To verify Firestore is working:

1. **Check Memory Manager health**:
   ```bash
   curl http://localhost:4103/healthz
   ```

2. **Test a memory retrieval**:
   ```bash
   curl -X POST http://localhost:4103/memory/test_user/retrieve-for-dialogue \
     -H "Content-Type: application/json" \
     -d '{"query":"test"}'
   ```

3. **Check logs**: Look for any Firestore connection errors in the Memory Manager logs.

## Troubleshooting

### Common Issues

1. **"Could not load the default credentials"**
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to a valid JSON file
   - Verify the file has correct permissions (readable)

2. **"Project ID mismatch"**
   - Ensure `GOOGLE_PROJECT_ID` matches the `project_id` in credentials file
   - Current: `GOOGLE_PROJECT_ID=carelink-478309` (matches credentials)

3. **"Permission denied"**
   - Verify the service account has Firestore permissions
   - Check IAM roles: `roles/datastore.user` or `roles/datastore.owner`

4. **Emulator not connecting**
   - Ensure emulator is running: `firebase emulators:start --only firestore`
   - Check `FIRESTORE_EMULATOR_HOST` is set correctly
   - Verify port 9090 is not blocked

## Production Setup

For production deployment:

1. **Use Google Secret Manager** for credentials
2. **Set environment variables** in Cloud Run/Cloud Functions
3. **Ensure service account** has proper IAM roles
4. **Disable emulator** (remove `FIRESTORE_EMULATOR_HOST`)

