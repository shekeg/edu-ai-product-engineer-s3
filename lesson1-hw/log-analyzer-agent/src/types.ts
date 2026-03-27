export interface LogEntry {
  timestamp: string;
  level: "ERROR" | "WARN" | "INFO" | "DEBUG";
  message: string;
  stack?: string;
  context?: {
    [key: string]: any;
    function?: string;
  };
  // Legacy support for old format
  service?: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface ErrorAnalysis {
  hasErrors: boolean;
  errorCount: number;
  criticalErrors: LogEntry[];
  nonCriticalErrors: LogEntry[];
  summary: string;
}

export interface PRAnalysis {
  prNumber: number;
  title: string;
  author: string;
  filesChanged: string[];
  isLikelyCulprit: boolean;
  confidence: number;
  reasoning: string;
}

export interface IncidentReport {
  severity: "critical" | "non-critical";
  affectedService: string;
  errorMessage: string;
  suggestedAction: string;
  relatedPR?: PRAnalysis;
}
