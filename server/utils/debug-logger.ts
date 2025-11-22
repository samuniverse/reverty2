import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface TimingCheckpoint {
  name: string;
  timestamp: number;
  elapsed: number;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

interface MethodAttempt {
  methodName: string;
  methodNumber: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  domState?: {
    canvasFound: boolean;
    canvasDimensions?: { width: number; height: number };
    shadowRootFound: boolean;
    smartframeEmbedFound: boolean;
    selectors: string[];
  };
  extractionDetails?: {
    format?: string;
    size?: number;
    dimensions?: { width: number; height: number };
    checksumStable?: boolean;
  };
}

interface ImageDebugSession {
  imageId: string;
  jobId: string;
  url: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  
  // Lifecycle stages
  stages: {
    queueAdded?: TimingCheckpoint;
    browserLaunch?: TimingCheckpoint;
    navigation?: TimingCheckpoint & { navigationAttempt: number; maxAttempts: number };
    cookieBanner?: TimingCheckpoint & { dismissed: boolean };
    initialWait?: TimingCheckpoint & { waitDuration: number };
    metadataExtraction?: TimingCheckpoint & {
      success: boolean;
      fieldsExtracted: string[];
      fieldsMissing: string[];
      timedOut: boolean;
    };
    metadataNormalization?: TimingCheckpoint & {
      captionGenerated: boolean;
      missingFields: string[];
    };
    shadowRootSetup?: TimingCheckpoint;
    cssExpansion?: TimingCheckpoint;
    viewportResize?: TimingCheckpoint & {
      steps: Array<{ size: string; waitMs: number }>;
    };
    canvasExtraction?: TimingCheckpoint & {
      mode: string;
      totalAttempts: number;
      successfulMethod?: string;
      methods: MethodAttempt[];
    };
    imageStorage?: TimingCheckpoint & {
      saved: boolean;
      path?: string;
    };
  };
  
  // Process state
  processState: {
    browserRestarts: number;
    memoryAtStart?: { heapUsed: number; rss: number };
    memoryAtEnd?: { heapUsed: number; rss: number };
    taskNumber?: number;
    queuePosition?: number;
  };
  
  // Final outcome
  outcome: {
    success: boolean;
    error?: string;
    errorStack?: string;
    skipped?: boolean;
    skipReason?: string;
    retryAttempt?: number;
  };
  
  // Screenshots and diagnostics
  diagnostics?: {
    screenshotPath?: string;
    htmlSnapshotPath?: string;
    consoleLogs?: string[];
    networkErrors?: string[];
  };
}

class DebugLogger {
  private sessionsDir: string;
  private currentSession: Map<string, ImageDebugSession> = new Map();
  private globalStartTime: number = Date.now();
  
  constructor() {
    this.sessionsDir = join(process.cwd(), "logs", "debug-sessions");
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }
  
  startImageSession(imageId: string, jobId: string, url: string): void {
    const session: ImageDebugSession = {
      imageId,
      jobId,
      url,
      startTime: Date.now(),
      stages: {},
      processState: {
        browserRestarts: 0,
      },
      outcome: {
        success: false,
      },
    };
    
    this.currentSession.set(imageId, session);
    this.logToConsole(`🔍 [DEBUG] Started session for ${imageId}`);
  }
  
  recordCheckpoint(
    imageId: string,
    stageName: keyof ImageDebugSession["stages"],
    details?: any
  ): void {
    const session = this.currentSession.get(imageId);
    if (!session) {
      console.warn(`No session found for ${imageId}`);
      return;
    }
    
    const mem = process.memoryUsage();
    const checkpoint: TimingCheckpoint = {
      name: stageName,
      timestamp: Date.now(),
      elapsed: Date.now() - session.startTime,
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(mem.external / 1024 / 1024 * 100) / 100,
        rss: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      },
    };
    
    session.stages[stageName] = { ...checkpoint, ...details } as any;
    
    this.logToConsole(
      `⏱️  [DEBUG] [${imageId}] ${stageName} @ ${checkpoint.elapsed}ms | Heap: ${checkpoint.memory?.heapUsed || 0}MB`
    );
  }
  
  recordMethodAttempt(
    imageId: string,
    methodName: string,
    methodNumber: number,
    startTime: number
  ): void {
    const session = this.currentSession.get(imageId);
    if (!session) return;
    
    if (!session.stages.canvasExtraction) {
      session.stages.canvasExtraction = {
        name: "canvasExtraction",
        timestamp: startTime,
        elapsed: startTime - session.startTime,
        mode: "unknown",
        totalAttempts: 0,
        methods: [],
      };
    }
    
    const attempt: MethodAttempt = {
      methodName,
      methodNumber,
      startTime,
      success: false,
    };
    
    session.stages.canvasExtraction.methods.push(attempt);
    session.stages.canvasExtraction.totalAttempts++;
    
    this.logToConsole(
      `🔬 [DEBUG] [${imageId}] Method ${methodNumber}: ${methodName} - Starting...`
    );
  }
  
  recordMethodResult(
    imageId: string,
    methodNumber: number,
    success: boolean,
    error?: string,
    domState?: MethodAttempt["domState"],
    extractionDetails?: MethodAttempt["extractionDetails"]
  ): void {
    const session = this.currentSession.get(imageId);
    if (!session || !session.stages.canvasExtraction) return;
    
    const method = session.stages.canvasExtraction.methods.find(
      (m) => m.methodNumber === methodNumber
    );
    
    if (!method) return;
    
    method.endTime = Date.now();
    method.duration = method.endTime - method.startTime;
    method.success = success;
    method.error = error;
    method.domState = domState;
    method.extractionDetails = extractionDetails;
    
    if (success && session.stages.canvasExtraction) {
      session.stages.canvasExtraction.successfulMethod = method.methodName;
    }
    
    const statusIcon = success ? "✅" : "❌";
    const domInfo = domState ? 
      `Canvas:${domState.canvasFound ? `✓(${domState.canvasDimensions?.width}x${domState.canvasDimensions?.height})` : '✗'} Shadow:${domState.shadowRootFound ? '✓' : '✗'} Embed:${domState.smartframeEmbedFound ? '✓' : '✗'}` : 
      "";
    
    this.logToConsole(
      `${statusIcon} [DEBUG] [${imageId}] Method ${methodNumber}: ${method.methodName} - ${success ? 'SUCCESS' : 'FAILED'} (${method.duration}ms) ${domInfo}${error ? ` - ${error}` : ''}`
    );
  }
  
  recordProcessState(
    imageId: string,
    state: Partial<ImageDebugSession["processState"]>
  ): void {
    const session = this.currentSession.get(imageId);
    if (!session) return;
    
    session.processState = { ...session.processState, ...state };
  }
  
  recordOutcome(
    imageId: string,
    success: boolean,
    error?: string,
    errorStack?: string,
    skipped?: boolean,
    skipReason?: string
  ): void {
    const session = this.currentSession.get(imageId);
    if (!session) return;
    
    session.endTime = Date.now();
    session.totalDuration = session.endTime - session.startTime;
    session.outcome = {
      success,
      error,
      errorStack,
      skipped,
      skipReason,
    };
    
    const statusIcon = success ? "✅" : skipped ? "⏭️" : "❌";
    this.logToConsole(
      `${statusIcon} [DEBUG] [${imageId}] Session complete - ${success ? 'SUCCESS' : skipped ? 'SKIPPED' : 'FAILED'} (${session.totalDuration}ms)`
    );
  }
  
  async saveDiagnostics(
    imageId: string,
    screenshotBuffer?: Buffer,
    htmlSnapshot?: string,
    consoleLogs?: string[],
    networkErrors?: string[]
  ): Promise<void> {
    const session = this.currentSession.get(imageId);
    if (!session) return;
    
    const diagnosticsDir = join(this.sessionsDir, imageId);
    if (!existsSync(diagnosticsDir)) {
      mkdirSync(diagnosticsDir, { recursive: true });
    }
    
    if (!session.diagnostics) {
      session.diagnostics = {};
    }
    
    if (screenshotBuffer) {
      const screenshotPath = join(diagnosticsDir, "failure-screenshot.png");
      writeFileSync(screenshotPath, screenshotBuffer);
      session.diagnostics.screenshotPath = screenshotPath;
      this.logToConsole(`📸 [DEBUG] [${imageId}] Screenshot saved to ${screenshotPath}`);
    }
    
    if (htmlSnapshot) {
      const htmlPath = join(diagnosticsDir, "failure-dom.html");
      writeFileSync(htmlPath, htmlSnapshot);
      session.diagnostics.htmlSnapshotPath = htmlPath;
      this.logToConsole(`📄 [DEBUG] [${imageId}] HTML snapshot saved to ${htmlPath}`);
    }
    
    if (consoleLogs) {
      session.diagnostics.consoleLogs = consoleLogs;
    }
    
    if (networkErrors) {
      session.diagnostics.networkErrors = networkErrors;
    }
  }
  
  endImageSession(imageId: string): void {
    const session = this.currentSession.get(imageId);
    if (!session) return;
    
    if (!session.endTime) {
      session.endTime = Date.now();
      session.totalDuration = session.endTime - session.startTime;
    }
    
    const sessionFile = join(
      this.sessionsDir,
      `${imageId}_${Date.now()}.json`
    );
    
    writeFileSync(sessionFile, JSON.stringify(session, null, 2));
    this.logToConsole(`💾 [DEBUG] Session saved to ${sessionFile}`);
    
    this.appendToSummary(session);
    this.currentSession.delete(imageId);
  }
  
  private appendToSummary(session: ImageDebugSession): void {
    const summaryFile = join(this.sessionsDir, "summary.jsonl");
    
    const summaryLine = {
      timestamp: new Date().toISOString(),
      imageId: session.imageId,
      jobId: session.jobId,
      duration: session.totalDuration,
      success: session.outcome.success,
      skipped: session.outcome.skipped,
      error: session.outcome.error,
      successfulMethod: session.stages.canvasExtraction?.successfulMethod,
      totalMethodAttempts: session.stages.canvasExtraction?.totalAttempts,
      metadataSuccess: session.stages.metadataExtraction?.success,
      metadataTimedOut: session.stages.metadataExtraction?.timedOut,
      browserRestarts: session.processState.browserRestarts,
      memoryUsed: session.processState.memoryAtEnd?.heapUsed,
    };
    
    appendFileSync(summaryFile, JSON.stringify(summaryLine) + "\n");
  }
  
  getMethodStatistics(): any {
    const summaryFile = join(this.sessionsDir, "summary.jsonl");
    if (!existsSync(summaryFile)) {
      return { message: "No summary data available yet" };
    }
    
    const content = require("fs").readFileSync(summaryFile, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    
    const methodStats: Record<string, { attempts: number; successes: number; failures: number; avgDuration: number; totalDuration: number }> = {};
    
    for (const sessionFile of require("fs").readdirSync(this.sessionsDir)) {
      if (!sessionFile.endsWith(".json")) continue;
      
      const session: ImageDebugSession = JSON.parse(
        require("fs").readFileSync(join(this.sessionsDir, sessionFile), "utf-8")
      );
      
      if (session.stages.canvasExtraction?.methods) {
        for (const method of session.stages.canvasExtraction.methods) {
          if (!methodStats[method.methodName]) {
            methodStats[method.methodName] = {
              attempts: 0,
              successes: 0,
              failures: 0,
              avgDuration: 0,
              totalDuration: 0,
            };
          }
          
          methodStats[method.methodName].attempts++;
          if (method.success) {
            methodStats[method.methodName].successes++;
          } else {
            methodStats[method.methodName].failures++;
          }
          if (method.duration) {
            methodStats[method.methodName].totalDuration += method.duration;
          }
        }
      }
    }
    
    for (const methodName in methodStats) {
      const stats = methodStats[methodName];
      stats.avgDuration = stats.totalDuration / stats.attempts;
    }
    
    return {
      totalSessions: lines.length,
      methodStatistics: methodStats,
    };
  }
  
  private logToConsole(message: string): void {
    console.log(message);
  }
}

export const debugLogger = new DebugLogger();
export type { ImageDebugSession, MethodAttempt, TimingCheckpoint };
