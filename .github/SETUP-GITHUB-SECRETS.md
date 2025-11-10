# GitHub Secrets Configuration
## Setup Guide for CI/CD Workflows

**Date:** 2025-11-09
**Status:** Setup Instructions

---

## Quick Setup (5 minutes)

### Step 1: Navigate to Settings

1. Go to your repository on GitHub
2. Click **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**

---

## Required Secrets

### 1. GITHUB_TOKEN (Auto-provided)
**Status:** ✅ Already available - no action needed

This is automatically available in all GitHub Actions workflows.

---

### 2. DOCKER_REGISTRY_TOKEN (For Docker Image Push)

**Required for:** `deploy-with-validation.yml`

**Steps:**
1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `DOCKER_REGISTRY_TOKEN`
4. Value: Your Docker registry token (GitHub Container Registry or Docker Hub)

**How to get Docker Registry Token:**

**For GitHub Container Registry (ghcr.io):**
```bash
# Create PAT with these scopes:
# - write:packages (push images)
# - read:packages (pull images)
# - delete:packages (optional, for cleanup)

# Go to: https://github.com/settings/tokens/new
# Select scopes above
# Copy the token
```

**For Docker Hub:**
```bash
# Go to: https://hub.docker.com/settings/security
# Click "New Access Token"
# Give it read/write permissions
# Copy the token
```

---

## Optional Secrets

### 3. SLACK_WEBHOOK (For Slack Notifications)

**Required for:** Slack notifications on test failures/deployments

**Steps:**
1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `SLACK_WEBHOOK`
4. Value: Your Slack webhook URL

**How to get Slack Webhook:**
```
1. Go to: https://api.slack.com/apps
2. Create a new app or select existing
3. Navigate to "Incoming Webhooks"
4. Click "Add New Webhook to Workspace"
5. Select your channel (e.g., #deployments)
6. Copy the Webhook URL
```

**Usage in Workflow:**
```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1.24.0
  with:
    payload: |
      {
        "text": "E2E Tests Failed!",
        "channel": "#deployments"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

### 4. AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY

**Required for:** AWS deployments in `deploy-with-validation.yml`

**Skip if:** Not using AWS for deployments

**Steps:**
1. Go to **Settings → Secrets and variables → Actions**
2. Create TWO secrets:

**Secret 1:**
- Name: `AWS_ACCESS_KEY_ID`
- Value: Your AWS access key ID

**Secret 2:**
- Name: `AWS_SECRET_ACCESS_KEY`
- Value: Your AWS secret access key

**How to get AWS Credentials:**
```
1. Go to: https://console.aws.amazon.com/iam/
2. Click "Users" → Your user
3. Click "Security credentials" tab
4. Click "Create access key"
5. Copy the Access Key ID and Secret Access Key
```

---

## Verification

### Check Secrets are Set

```bash
# List all secrets (values are masked)
curl -H "Authorization: token YOUR_PAT" \
  https://api.github.com/repos/USERNAME/REPO/actions/secrets
```

### Test Secret Access

1. Go to **Actions** tab
2. Select **generate-and-test** workflow
3. Click **Run workflow**
4. Workflow will use secrets automatically

---

## Security Best Practices

✅ **DO:**
- Rotate credentials regularly
- Use least-privilege access (only needed permissions)
- Enable secret scanning: Settings → Security → Secret scanning
- Review secret access logs

❌ **DON'T:**
- Commit secrets to repository
- Share secrets with others
- Use production credentials in test workflows
- Log secrets in workflow output

---

## Troubleshooting

### Secret Not Found Error

```
Error: Unrecognized named-value: 'secrets.DOCKER_REGISTRY_TOKEN'
```

**Solution:**
1. Check secret name matches exactly (case-sensitive)
2. Secret must be created in same repository
3. Wait 1-2 minutes after creating secret
4. Refresh browser and try again

### Secret Value is Masked in Logs

This is **intentional** - GitHub automatically masks secret values.

To debug:
1. Add `ACTIONS_STEP_DEBUG: true` as secret
2. View detailed logs (requires admin access)

### Permission Denied on Docker Push

**Symptom:** `denied: requested access to the resource is denied`

**Solution:**
1. Verify token has `write:packages` scope
2. Test token locally: `echo PASSWORD | docker login -u USERNAME --password-stdin`
3. Regenerate token if needed

---

## Summary of Commands

```bash
# Quick reference for setup

# 1. List current secrets
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo/actions/secrets

# 2. Test Docker login
echo $DOCKER_REGISTRY_TOKEN | docker login -u USERNAME --password-stdin ghcr.io

# 3. Verify AWS credentials
aws sts get-caller-identity --region us-east-1

# 4. Test Slack webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -d '{"text":"Test message"}'
```

---

## Next Steps

1. ✅ Create required secrets above
2. ✅ Test with first PR push
3. ✅ Monitor workflow execution
4. ✅ Check workflow logs if issues occur

---

**Status:** Ready for configuration
**Time required:** ~5-10 minutes
**Difficulty:** Easy ⭐
