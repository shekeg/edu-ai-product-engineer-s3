
# Branch Creator Workflow

An intelligent workflow that uses Claude SDK to read GitHub issues and automatically create well-named branches, streamlining the start of feature development and bug fixes.

## Overview

Starting work on a GitHub issue typically requires manual steps: reading the issue, thinking of a good branch name, creating the branch locally, and pushing it to the remote. This friction slows down development and can lead to inconsistent branch naming across teams. This branch creator workflow solves this problem by:

- Automatically fetching issue details from GitHub
- Using AI to generate concise, descriptive branch names from issue titles
- Creating branches with consistent naming convention: `issue-<id>/<concise-name>`
- Pushing branches directly to the remote repository

The workflow eliminates the friction of starting work on issues by automating the entire branch setup process, reducing time from "assigned issue" to "ready to code" from minutes to seconds while maintaining consistent naming conventions.

## Architecture

The workflow uses Claude AI for intelligent branch naming:

1. **Issue Fetching Stage**: Retrieves issue details from GitHub API including title, description, labels, and metadata to understand the work being started

2. **AI Naming Stage**: Uses Claude to analyze the issue title and generate a concise 2-4 word branch name that captures the essence of the work, following kebab-case conventions and removing unnecessary words

3. **Branch Creation Stage**: Creates the branch on GitHub via API from the specified base branch (defaults to `main`), ensuring it exists remotely before any local operations

4. **Local Setup Stage**: Fetches the newly created branch and checks it out locally, establishing tracking with the remote branch for seamless push/pull operations

## Setup

**Prerequisites**:
- Node.js 22 or higher
- Anthropic API key ([get one here](https://console.anthropic.com/))
- GitHub Personal Access Token with `repo` permissions ([generate here](https://github.com/settings/tokens))

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
   GITHUB_TOKEN=your_github_token_here
   GITHUB_REPO=owner/repo-name
   BASE_BRANCH=main  # optional, defaults to main
   ```

3. Build the project:
   ```bash
   npm run build
   ```

**Running the workflow**:

```bash
npm run dev <issue-number>  # Development mode with tsx
# or
npm start <issue-number>    # Production mode after build
```

**Example**:
```bash
npm run dev 42  # Creates branch for issue #42
```

## Results

**Sample Output**:

The workflow successfully fetches issues, generates intelligent branch names, and creates branches:

```
🚀 Starting Branch Creator Agent...
📋 Repository: shekeg/ai-feature-flags
🎯 Issue #3

📖 Step 1: Fetching GitHub issue...
✅ Issue found: "Issue with empty email handling"
   State: open
   Author: shekeg
   Created: 11/30/2025

🔤 Step 2: Generating concise branch name...
🤖 Asking Claude to generate a concise branch name...
✅ Generated branch name: issue-3/fix-empty-email-handling

🌿 Step 3: Creating branch on GitHub...
✅ Branch created successfully on GitHub

📤 Step 4: Setting up local branch and pushing to origin...
✅ Fetched branch from origin
✅ Checked out branch locally
✅ Branch is ready and tracking origin/issue-3/fix-empty-email-handling

================================================================================
📊 BRANCH CREATION SUMMARY
================================================================================
Issue #3: Issue with empty email handling
Branch: issue-3/fix-empty-email-handling
Created: ✅
Pushed: ✅

Successfully created and pushed branch: issue-3/fix-empty-email-handling
================================================================================
```

**Performance Metrics**:
- Average branch creation time: ~5-10 seconds per issue
- Branch naming quality: Consistently generates concise, descriptive names in kebab-case
- Successfully handles various issue title formats (bug reports, feature requests, tasks)
- Transparent AI reasoning process visible in console logs

**Branch Naming Examples**:
- "Add user authentication feature" → `issue-42/add-user-auth`
- "Fix: Memory leak in data processing" → `issue-123/fix-memory-leak`
- "Update documentation for API endpoints" → `issue-456/update-api-docs`

## Learnings

**What worked well**:
- Claude SDK excels at condensing verbose issue titles into concise branch names
- GitHub API makes branch creation straightforward without needing local git operations first
- Consistent naming convention (`issue-<id>/<name>`) makes it easy to trace branches back to issues
- Creating branch remotely first eliminates sync issues between local and remote

**Challenges discovered**:
- Git operations may fail if working directory is not a git repository or not tracking the correct remote
- Some issue titles are too generic ("Fix bug") requiring better context from issue body
- Branch names need to avoid special characters that git doesn't handle well

## Future Work

With more time, I would improve:

1. **Context-Aware Naming**: Use issue labels, description, and project context to generate even more descriptive branch names when titles are generic

2. **Team Conventions**: Allow configuration of custom naming patterns beyond `issue-<id>/<name>` to support different team workflows (e.g., `feature/`, `bugfix/` prefixes)

3. **Automatic Assignment**: Automatically assign the issue to the user running the workflow and add "In Progress" label when branch is created

4. **Multi-Issue Support**: Accept multiple issue numbers and create branches for all of them in parallel, or create branches for all open issues assigned to a user
