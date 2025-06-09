import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: any;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logDir: string;
  private currentLogFile: string;
  private isMcpMode: boolean;

  private constructor() {
    // Check if we're in MCP mode to avoid stdio interference
    this.isMcpMode = process.env.MCP_MODE === 'true';
    
    // Set up log directory - will be created in dist/logs when built
    const baseDir = path.dirname(require.main?.filename || process.cwd());
    this.logDir = path.join(baseDir, 'logs');
    
    // Ensure log directory exists
    this.ensureLogDirectory();
    
    // Set current log file with date
    const date = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.logDir, `mcp-azure-devops-${date}.log`);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      // If we can't create log directory, we'll just use console
      if (!this.isMcpMode) {
        console.error('Failed to create log directory:', error);
      }
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const baseLog = `${entry.timestamp} [${entry.level}] [${entry.component}] ${entry.message}`;
    
    let additionalInfo = '';
    
    if (entry.context) {
      additionalInfo += `\nContext: ${JSON.stringify(entry.context, null, 2)}`;
    }
    
    if (entry.error) {
      additionalInfo += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        additionalInfo += `\nStack: ${entry.error.stack}`;
      }
    }
    
    return baseLog + additionalInfo;
  }

  private writeToFile(logEntry: string): void {
    try {
      fs.appendFileSync(this.currentLogFile, logEntry + '\n\n', 'utf8');
    } catch (error) {
      // Silently fail file writing in MCP mode
      if (!this.isMcpMode) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  private log(level: LogLevel, component: string, message: string, context?: any, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      context,
      error
    };

    const formattedEntry = this.formatLogEntry(entry);
    
    // Always write to file
    this.writeToFile(formattedEntry);
    
    // Only write to console if not in MCP mode
    if (!this.isMcpMode) {
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedEntry);
          break;
        case LogLevel.WARN:
          console.warn(formattedEntry);
          break;
        case LogLevel.INFO:
          console.info(formattedEntry);
          break;
        case LogLevel.DEBUG:
          console.debug(formattedEntry);
          break;
      }
    }
  }

  public error(component: string, message: string, error?: Error, context?: any): void {
    this.log(LogLevel.ERROR, component, message, context, error);
  }

  public warn(component: string, message: string, context?: any): void {
    this.log(LogLevel.WARN, component, message, context);
  }

  public info(component: string, message: string, context?: any): void {
    this.log(LogLevel.INFO, component, message, context);
  }

  public debug(component: string, message: string, context?: any): void {
    this.log(LogLevel.DEBUG, component, message, context);
  }

  // Special method for connection failures with sanitized context
  public logConnectionFailure(component: string, error: Error, config: any): void {
    const sanitizedConfig = {
      orgUrl: config.orgUrl ? config.orgUrl.replace(/\/\/[^\/]+/, '//***') : 'not provided',
      authType: config.auth?.type || 'not specified',
      isOnPremises: config.isOnPremises,
      hasToken: !!config.personalAccessToken,
      hasUsername: !!config.auth?.username,
      collection: config.collection || 'not specified',
      apiVersion: config.apiVersion || 'not specified',
      project: config.project || 'not specified'
    };

    this.error(component, 'Connection failed', error, {
      config: sanitizedConfig,
      errorCode: (error as any).code,
      errorType: error.constructor.name
    });
  }

  // Get the current log file path
  public getLogFilePath(): string {
    return this.currentLogFile;
  }
}

// Export a singleton instance
export const logger = Logger.getInstance();