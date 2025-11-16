# Installing Google Cloud SDK (gcloud CLI)

## Option 1: Install via Homebrew (Recommended for macOS)

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Google Cloud SDK
brew install --cask google-cloud-sdk

# Initialize gcloud
gcloud init

# Authenticate
gcloud auth login

# Set project
gcloud config set project carelink-478309
```

## Option 2: Install via Official Installer

1. **Download**: https://cloud.google.com/sdk/docs/install
2. **Run installer**:
   ```bash
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   ```
3. **Initialize**:
   ```bash
   gcloud init
   ```

## Option 3: Use Cloud Shell (No Installation Needed)

If you prefer not to install locally, use Google Cloud Shell:

1. Go to: https://console.cloud.google.com/
2. Click the **Cloud Shell** icon (top right)
3. Run commands directly in the browser

## Verify Installation

After installation, verify:

```bash
gcloud --version
gcloud config get-value project
```

## Authenticate Service Account

To use service account credentials:

```bash
gcloud auth activate-service-account carelink@carelink-478309.iam.gserviceaccount.com \
  --key-file=/Users/Glebazzz/Carelink/backend/carelink-478309-49d23b3dbd49.json \
  --project=carelink-478309
```

## After Installation

Once gcloud is installed, you can use it for:
- Google Cloud operations
- Service account management
