
# Log Analyzer Agent

An intelligent agent that uses Claude SDK to analyze application logs, identify errors, correlate them with GitHub PRs, and propose fixes.

## Overview

Modern applications generate massive amounts of log data, making it difficult to quickly identify the root cause of errors and correlate them with recent code changes. This log analyzer agent solves this problem by:

- Automatically identifying errors in application logs
- Correlating errors with recently merged GitHub pull requests
- Proposing concrete fixes based on root cause analysis
- Generating actionable incident reports with severity-based recommendations

The agent streamlines incident response by connecting the dots between symptoms (errors in logs), causes (code changes), and solutions (fix proposals), reducing time to resolution from hours to minutes.

## Architecture

The agent uses Claude AI at each stage:

1. **Log Analysis Stage**: Parses log files, identifies ERROR-level entries, categorizes severity (critical vs non-critical), and uses Claude to summarize error patterns

2. **PR Correlation Stage**: Fetches recent merged PRs from GitHub, analyzes changes and metadata, then uses Claude to correlate errors with likely culprit PRs with confidence scores

3. **Fix Proposal Stage**: Performs root cause analysis using Claude to generate specific, actionable fix proposals with implementation steps and verification methods

4. **Incident Reporting Stage**: Generates detailed incident reports with severity-based recommendations (critical errors trigger immediate page/rollback suggestions, non-critical errors suggest monitoring)

## Setup

**Prerequisites**:
- Node.js 22 or higher
- Anthropic API key ([get one here](https://console.anthropic.com/))
- GitHub Personal Access Token (optional, for higher API rate limits)

**Installation**:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your keys:
   ```env
   ANTHROPIC_API_KEY=your_api_key_here
   GITHUB_TOKEN=your_github_token_here  # optional
   LOGS_PATH=./logs.json
   GITHUB_REPO=owner/repo-name
   ```

3. Build the project:
   ```bash
   npm run build
   ```

**Running the Agent**:

```bash
npm run dev  # Development mode with tsx
# or
npm start    # Production mode after build
```

## Results

**Sample Output**:

The agent successfully analyzes logs, identifies culprit PRs, and generates fix proposals:

```
🚀 Starting Log Analyzer Agent...
📄 Analyzing logs from: ./logs.json
🔗 GitHub repository: shekeg/ai-feature-flags

🔍 Step 1: Analyzing logs for errors...
⚠️  Found 3 error(s) in logs
🤖 Asking Claude to analyze error patterns...

📊 Analysis Summary:
The logs show multiple errors related to the feature flag service...

────────────────────────────────────────────────────────────────────────────────

🔍 Processing error: Failed to fetch feature flags...

🔎 Step 2: Searching for culprit PR in shekeg/ai-feature-flags...
📋 Found 15 recently merged PRs
🤖 Asking Claude to identify the culprit PR...

🎯 Identified culprit PR: #42
   Title: Refactor feature flag service
   Confidence: 85%

🔧 Step 3: Proposing a fix...
💡 Root Cause: The refactored code doesn't handle undefined...
   Solution: Add null check before accessing...

📝 Step 4: Generating incident report...
🚨 INCIDENT REPORT - CRITICAL SEVERITY

✅ Analysis complete!
```

Screenshots are in the `screenshots/` folder.

**Performance Metrics**:
- Average analysis time: ~30-45 seconds per error
- PR correlation accuracy: High confidence (85%+) on errors with clear code paths
- Successfully identifies culprit PRs even when multiple PRs were merged recently
- Transparent reasoning process visible in console logs

## Learnings

**What worked well**:
- Claude SDK's structured output makes it easy to build an agent
- Breaking the task into discrete stages (analyze → correlate → propose → report) improves accuracy
- GitHub PR metadata + file changes provide rich context for correlation

**Challenges discovered**:
- Agent needs sufficient log context around errors to propose accurate fixes
- Correlation accuracy depends heavily on how descriptive PR titles and commit messages are
- Some errors may be caused by combinations of PRs, not just a single culprit

## Future Work

With more time, I would improve:

1. **Enhanced PR Correlation**: Implement multi-PR causality analysis for errors caused by interaction between multiple changes

2. **Historical Analysis**: Build a database of past error-PR correlations to improve accuracy over time through pattern learning

3. **Automated Fix Application**: Add capability to automatically create fix PRs with proposed changes (with human approval)

4. **Not Just Errors**: Extend analysis to warnings and performance issues, not just ERROR-level logs