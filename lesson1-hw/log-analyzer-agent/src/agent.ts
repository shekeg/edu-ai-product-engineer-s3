import Anthropic from "@anthropic-ai/sdk";
import {
  LogEntry,
  ErrorAnalysis,
  PRAnalysis,
  IncidentReport,
} from "./types.js";
import { GitHubClient, GitHubPR, GitHubFile } from "./github.js";

export class LogAnalyzerAgent {
  private client: Anthropic;
  private githubClient: GitHubClient;
  private readonly model = "claude-3-opus-20240229";

  constructor(apiKey: string, githubToken?: string) {
    this.client = new Anthropic({ apiKey });
    this.githubClient = new GitHubClient(githubToken);
  }

  private getService(log: LogEntry): string {
    return log.service || log.context?.service || "unknown-service";
  }

  private async determineSeverity(
    log: LogEntry
  ): Promise<"critical" | "non-critical"> {
    console.log(
      `🤖 Asking Claude to determine severity for: ${log.message.substring(
        0,
        50
      )}...`
    );

    const prompt = `Analyze this error and determine if it's CRITICAL or NON-CRITICAL.
      ERROR:
      Message: ${log.message}
      Stack trace: ${log.stack || "N/A"}
      Context: ${JSON.stringify(log.context || log.metadata || {}, null, 2)}

      CRITICAL errors are those that:
      - Cause complete system/service outage
      - Lead to data loss or corruption
      - Affect all users or critical business functions
      - Require immediate intervention

      NON-CRITICAL errors are those that:
      - Affect individual users or edge cases
      - Have workarounds available
      - Don't cause data loss
      - Can be scheduled for fix

      Respond with ONLY one word: "critical" or "non-critical"
`;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const response =
      message.content[0].type === "text"
        ? message.content[0].text.toLowerCase().trim()
        : "non-critical";

    return response.includes("critical") ? "critical" : "non-critical";
  }

  async analyzeLogs(logs: LogEntry[]): Promise<ErrorAnalysis> {
    console.log("\n🔍 Step 1: Analyzing logs for errors...");

    const errorLogs = logs.filter((log) => log.level === "ERROR");

    if (errorLogs.length === 0) {
      console.log("✅ No errors found in logs");
      return {
        hasErrors: false,
        errorCount: 0,
        criticalErrors: [],
        nonCriticalErrors: [],
        summary: "No errors detected",
      };
    }

    console.log(`⚠️  Found ${errorLogs.length} error(s) in logs`);

    // Use LLM to determine severity for each error
    const errorSeverities = await Promise.all(
      errorLogs.map(async (log) => ({
        log,
        severity: await this.determineSeverity(log),
      }))
    );

    const criticalErrors = errorSeverities
      .filter((item) => item.severity === "critical")
      .map((item) => item.log);
    const nonCriticalErrors = errorSeverities
      .filter((item) => item.severity === "non-critical")
      .map((item) => item.log);

    const prompt = `Analyze the following error logs and provide a concise summary of the issues:

      ${JSON.stringify(errorLogs, null, 2)}

      Provide a brief summary of:
      1. What errors occurred
      2. Which services are affected
      3. Potential impact on the system
    `;

    console.log("🤖 Asking Claude to analyze error patterns...");

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const summary =
      message.content[0].type === "text"
        ? message.content[0].text
        : "Unable to generate summary";

    console.log("\n📊 Analysis Summary:");
    console.log(summary);

    return {
      hasErrors: true,
      errorCount: errorLogs.length,
      criticalErrors,
      nonCriticalErrors,
      summary,
    };
  }

  async identifyCulpritPR(
    error: LogEntry,
    owner: string,
    repo: string
  ): Promise<PRAnalysis | null> {
    console.log(`\n🔎 Step 2: Searching for culprit PR in ${owner}/${repo}...`);

    try {
      const recentPRs = await this.githubClient.getRecentPRs(owner, repo, 20);
      const mergedPRs = recentPRs.filter((pr) => pr.merged_at !== null);

      console.log(`📋 Found ${mergedPRs.length} recently merged PRs`);

      if (mergedPRs.length === 0) {
        console.log("⚠️  No merged PRs found to analyze");
        return null;
      }

      // Get PR details with files
      console.log("🔍 Fetching PR details and file changes...");
      const prDetailsPromises = mergedPRs.slice(0, 10).map(async (pr) => {
        const files = await this.githubClient.getPRFiles(
          owner,
          repo,
          pr.number
        );
        return { pr, files };
      });

      const prDetails = await Promise.all(prDetailsPromises);

      const prSummaries = prDetails.map(({ pr, files }) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        mergedAt: pr.merged_at,
        filesChanged: files.map((f) => f.filename),
        description: pr.body || "No description",
      }));

      const prompt = `You are analyzing an error to identify which recent Pull Request likely caused it.

        ERROR DETAILS:
        Service: ${this.getService(error)}
        Message: ${error.message}
        Stack trace: ${error.stack || "N/A"}
        Context: ${JSON.stringify(
        error.context || error.metadata || {},
        null,
        2
      )}

        RECENT MERGED PRs:
        ${JSON.stringify(prSummaries, null, 2)}

        Based on the error details and the PRs, identify which PR is most likely to have caused this error.

        Respond in JSON format:
        {
          "prNumber": <number or null>,
          "confidence": <0-100>,
          "reasoning": "<brief explanation>",
          "isLikelyCulprit": <boolean>
        }
      `;

      console.log("🤖 Asking Claude to identify the culprit PR...");

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "{}";

      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log("⚠️  Could not parse Claude response");
        return null;
      }

      const analysis = JSON.parse(jsonMatch[0]);

      if (!analysis.prNumber) {
        console.log("❌ No culprit PR identified");
        return null;
      }

      const culpritPR = prSummaries.find(
        (pr) => pr.number === analysis.prNumber
      );
      if (!culpritPR) {
        console.log("⚠️  Identified PR not found in recent PRs");
        return null;
      }

      console.log(`\n🎯 Identified culprit PR: #${culpritPR.number}`);
      console.log(`   Title: ${culpritPR.title}`);
      console.log(`   Author: ${culpritPR.author}`);
      console.log(`   Confidence: ${analysis.confidence}%`);
      console.log(`   Reasoning: ${analysis.reasoning}`);

      return {
        prNumber: culpritPR.number,
        title: culpritPR.title,
        author: culpritPR.author,
        filesChanged: culpritPR.filesChanged,
        isLikelyCulprit: analysis.isLikelyCulprit,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
      };
    } catch (error) {
      console.error("❌ Error analyzing PRs:", error);
      return null;
    }
  }

  async proposeFix(
    error: LogEntry,
    prAnalysis: PRAnalysis | null
  ): Promise<string> {
    console.log("\n🔧 Step 3: Proposing a fix...");

    const prompt = `You are a senior software engineer analyzing a production error.

      ERROR DETAILS:
      Service: ${this.getService(error)}
      Message: ${error.message}
      Stack trace: ${error.stack || "N/A"}
      Context: ${JSON.stringify(error.context || error.metadata || {}, null, 2)}

      ${prAnalysis
        ? `SUSPECTED CULPRIT PR:
      PR #${prAnalysis.prNumber}: ${prAnalysis.title}
      Author: ${prAnalysis.author}
      Files changed: ${prAnalysis.filesChanged.join(", ")}
      Reasoning: ${prAnalysis.reasoning}
      `
        : "No specific PR identified as the culprit."
      }

      Propose a concrete fix for this error. Be specific and actionable.
      Include:
      1. Root cause analysis
      2. Proposed solution (code changes if applicable)
      3. Steps to implement the fix
      4. How to verify the fix works
    `;

    console.log("🤖 Asking Claude to propose a fix...");

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const fix =
      message.content[0].type === "text"
        ? message.content[0].text
        : "Unable to generate fix";

    console.log("\n💡 Proposed Fix:");
    console.log(fix);

    return fix;
  }

  generateIncidentReport(
    error: LogEntry,
    prAnalysis: PRAnalysis | null,
    proposedFix: string,
    severity: "critical" | "non-critical"
  ): IncidentReport {
    console.log("\n📝 Step 4: Generating incident report...");

    const report: IncidentReport = {
      severity,
      affectedService: this.getService(error),
      errorMessage: error.message,
      suggestedAction: proposedFix,
      relatedPR: prAnalysis || undefined,
    };

    console.log("\n" + "=".repeat(80));
    console.log(`🚨 INCIDENT REPORT - ${severity.toUpperCase()} SEVERITY`);
    console.log("=".repeat(80));
    console.log(`\n📍 Affected Service: ${report.affectedService}`);
    console.log(`❌ Error: ${report.errorMessage}`);

    if (report.relatedPR) {
      console.log(
        `\n🔗 Related PR: #${report.relatedPR.prNumber} - ${report.relatedPR.title}`
      );
      console.log(`   Author: ${report.relatedPR.author}`);
      console.log(`   Confidence: ${report.relatedPR.confidence}%`);
    }

    console.log(`\n📋 Recommended Action:`);
    if (severity === "critical") {
      console.log("⚠️  CREATE CRITICAL INCIDENT IMMEDIATELY");
      console.log("   - Page on-call engineer");
      console.log("   - Start incident response process");
      console.log("   - Consider rollback if recent deployment");
    } else {
      console.log("ℹ️  CREATE STANDARD INCIDENT");
      console.log("   - Notify engineering team");
      console.log("   - Schedule fix in next sprint");
      console.log("   - Monitor error rates");
    }

    console.log("\n" + "=".repeat(80));

    return report;
  }

  async run(logsPath: string, githubRepo: string): Promise<void> {
    console.log("🚀 Starting Log Analyzer Agent...");
    console.log(`📄 Analyzing logs from: ${logsPath}`);
    console.log(`🔗 GitHub repository: ${githubRepo}\n`);

    try {
      // Read logs
      const logsContent = await import("fs").then((fs) =>
        fs.promises.readFile(logsPath, "utf-8")
      );
      const logs: LogEntry[] = JSON.parse(logsContent);

      // Step 1: Analyze logs
      const analysis = await this.analyzeLogs(logs);

      if (!analysis.hasErrors) {
        console.log("\n✅ No action needed - no errors found");
        return;
      }

      // Process each error
      const [owner, repo] = githubRepo.split("/");

      // Process critical errors
      for (const error of analysis.criticalErrors) {
        console.log("\n" + "─".repeat(80));
        console.log(
          `\n🔍 Processing CRITICAL error: ${error.message.substring(0, 80)}...`
        );

        // Step 2: Identify culprit PR
        const prAnalysis = await this.identifyCulpritPR(error, owner, repo);

        // Step 3: Propose fix
        const proposedFix = await this.proposeFix(error, prAnalysis);

        // Step 4: Generate incident report
        this.generateIncidentReport(error, prAnalysis, proposedFix, "critical");
      }

      // Process non-critical errors
      for (const error of analysis.nonCriticalErrors) {
        console.log("\n" + "─".repeat(80));
        console.log(
          `\n🔍 Processing NON-CRITICAL error: ${error.message.substring(
            0,
            80
          )}...`
        );

        // Step 2: Identify culprit PR
        const prAnalysis = await this.identifyCulpritPR(error, owner, repo);

        // Step 3: Propose fix
        const proposedFix = await this.proposeFix(error, prAnalysis);

        // Step 4: Generate incident report
        this.generateIncidentReport(
          error,
          prAnalysis,
          proposedFix,
          "non-critical"
        );
      }

      console.log("\n✅ Analysis complete!");
    } catch (error) {
      console.error("❌ Fatal error:", error);
      throw error;
    }
  }
}
