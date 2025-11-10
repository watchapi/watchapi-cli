# @watchapi/cli

CLI tool for API monitoring and regression detection in CI/CD pipelines.

## Installation

```bash
npm install -g @watchapi/cli
# or
npx @watchapi/cli
```

## Quick Start

### 1. Set up environment variables

```bash
export WATCHAPI_TOKEN="your-api-token"
export WATCHAPI_URL="https://your-platform.com"  # optional, defaults to production
```

Or create a `.env` file:

```env
WATCHAPI_TOKEN=your-api-token
WATCHAPI_URL=https://your-platform.com
```

### 2. Run checks in your CI/CD pipeline

```bash
watchapi check --collection <collection-id> --env production
```

## Usage

### Check Command

Run API checks for a collection and detect regressions.

```bash
watchapi check [options]
```

**Options:**

- `-c, --collection <id>` - **(Required)** Collection ID to check
- `-e, --env <environment>` - Environment name (default: "production")
- `--api-url <url>` - Platform API URL (default: from WATCHAPI_URL env var)
- `--api-token <token>` - API authentication token (default: from WATCHAPI_TOKEN env var)
- `--fail-on <mode>` - When to fail the CI/CD pipeline:
  - `regressions` (default) - Fail only if regressions detected
  - `any` - Fail if any check fails

**Examples:**

```bash
# Basic usage
watchapi check --collection abc123

# Specify environment
watchapi check --collection abc123 --env staging

# Fail on any failure (not just regressions)
watchapi check --collection abc123 --fail-on any

# Use custom API URL
watchapi check --collection abc123 --api-url https://api.example.com
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Your deployment steps here
      - name: Deploy to production
        run: ./deploy.sh

      # Run API health checks
      - name: API Health Check
        run: npx @watchapi/cli check --collection ${{ secrets.COLLECTION_ID }} --env production
        env:
          WATCHAPI_TOKEN: ${{ secrets.WATCHAPI_TOKEN }}
```

### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - ./deploy.sh
    - npx @watchapi/cli check --collection $COLLECTION_ID --env production
  variables:
    WATCHAPI_TOKEN: $WATCHAPI_TOKEN
```

### CircleCI

```yaml
version: 2.1

jobs:
  deploy:
    docker:
      - image: node:20
    steps:
      - checkout
      - run: ./deploy.sh
      - run:
          name: API Health Check
          command: npx @watchapi/cli check --collection $COLLECTION_ID --env production
          environment:
            WATCHAPI_TOKEN: $WATCHAPI_TOKEN
```

### Jenkins

```groovy
pipeline {
  agent any

  environment {
    WATCHAPI_TOKEN = credentials('watchapi-token')
  }

  stages {
    stage('Deploy') {
      steps {
        sh './deploy.sh'
      }
    }

    stage('Health Check') {
      steps {
        sh 'npx @watchapi/cli check --collection ${COLLECTION_ID} --env production'
      }
    }
  }
}
```

## How It Works

1. **Fetch Collection**: CLI fetches your collection definition from the platform (endpoints, expected responses, etc.)
2. **Run Checks**: Executes HTTP requests to all endpoints in your environment
3. **Analyze Results**: Compares results with historical data to detect:
   - Status code changes (passing → failing)
   - Performance regressions (2x slower than average)
   - Response body changes
4. **Report**: Sends results back to platform for tracking
5. **Exit**: Returns appropriate exit code for CI/CD (0 = pass, 1 = fail)

## Regression Detection

The CLI automatically detects regressions by comparing current results with historical data:

### Status Regressions
- Endpoint was passing in last 3 checks → now failing
- Example: API returned 200 OK, now returns 500 Error

### Performance Regressions
- Response time is 2x slower than 5-check average
- Example: Average 100ms → now 250ms

### When using `--fail-on regressions`
- ✅ New endpoint fails: Won't block deployment (no baseline)
- ✅ Endpoint consistently failing: Won't block (not a regression)
- ❌ Previously passing endpoint fails: **Blocks deployment**
- ❌ Performance degradation (2x slower): **Blocks deployment**

### When using `--fail-on any`
- ❌ Any failure or error: **Blocks deployment**

## Output Example

```
============================================================
  API Check Results - production
============================================================

Summary:
  Total:  5
  ✓ Passed: 4
  ✗ Failed: 1
  ⚠ Errors: 0

⚠ REGRESSIONS DETECTED:
  • Endpoint api-endpoint-123: was passing in last 3 checks, now FAILED

Details:
✓ Endpoint api-endpoint-123
  Status: 200 | Response Time: 145ms

✗ Endpoint api-endpoint-456
  Failed assertions:
    • Status code: expected different, got 500
    • Response time: 2500ms (too slow)

============================================================
```

## Authentication

Get your API token from the platform:

1. Log in to your account
2. Go to Settings → API Tokens
3. Create a new token for CI/CD
4. Store it securely in your CI/CD secrets

## Troubleshooting

### "API token is required"
- Set `WATCHAPI_TOKEN` environment variable
- Or use `--api-token` flag

### "Collection not found"
- Verify collection ID is correct
- Ensure your API token has access to the collection

### Checks timing out
- Increase timeout in endpoint configuration on the platform
- Check network connectivity from CI/CD to your APIs

## Support

- Documentation: https://docs.watchapi.com
- Issues: https://github.com/yourusername/watchapi/issues
- Email: support@watchapi.com
