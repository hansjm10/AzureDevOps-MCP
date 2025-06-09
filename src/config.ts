import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { AzureDevOpsConfig } from './Interfaces/AzureDevOps';
import { AIAssistedDevelopmentToolMethods } from './Tools/AIAssistedDevelopmentTools';
import { ArtifactManagementToolMethods } from './Tools/ArtifactManagementTools';
import { BoardsSprintsToolMethods } from './Tools/BoardsSprintsTools';
import { DevSecOpsToolMethods } from './Tools/DevSecOpsTools';
import { GitToolMethods } from './Tools/GitTools';
import { ProjectToolMethods } from './Tools/ProjectTools';
import { TestingCapabilitiesToolMethods } from './Tools/TestingCapabilitiesTools';
import { WorkItemToolMethods } from './Tools/WorkItemTools';

// Try to load environment variables from .env file with multiple possible locations
function loadEnvFile() {
  // Build debug info
  const debugInfo: string[] = [];
  debugInfo.push('=== Environment Configuration Loading ===');
  debugInfo.push('Process details:');
  debugInfo.push(`  - Current directory (process.cwd()): ${process.cwd()}`);
  debugInfo.push(`  - Script directory (__dirname): ${__dirname}`);
  debugInfo.push(`  - Script filename (__filename): ${__filename}`);
  debugInfo.push(`  - Main module: ${require.main?.filename}`);
  debugInfo.push(`  - Node executable: ${process.execPath}`);
  debugInfo.push(`  - Command line args: ${process.argv.join(' ')}`);
  
  // FIRST: Try the project root (relative to the script location)
  // This ensures we load the correct .env file for THIS project
  const scriptDir = __dirname;
  const projectRootEnv = path.join(scriptDir, '..', '.env');
  debugInfo.push(`\nChecking project root (relative to script): ${projectRootEnv}`);
  debugInfo.push(`  - Resolved path: ${path.resolve(projectRootEnv)}`);
  debugInfo.push(`  - File exists: ${fs.existsSync(projectRootEnv)}`);
  if (fs.existsSync(projectRootEnv)) {
    debugInfo.push('  ✓ Found .env at project root: ' + projectRootEnv);
    dotenv.config({ path: projectRootEnv });
    writeEnvDebugLog(debugInfo.join('\n'));
    return;
  }
  
  // SECOND: Try the current directory (but warn if found)
  const cwdEnvPath = path.join(process.cwd(), '.env');
  debugInfo.push(`\nChecking current directory: ${cwdEnvPath}`);
  debugInfo.push(`  - File exists: ${fs.existsSync(cwdEnvPath)}`);
  if (fs.existsSync('.env')) {
    debugInfo.push('  ⚠️  Found .env in current directory - this might be the wrong project!');
    debugInfo.push('  ⚠️  Current dir: ' + process.cwd());
    debugInfo.push('  ⚠️  Expected project: /mnt/c/Users/Jordan.HHHC/Documents/MCP/AzureDevOps-MCP');
    // Don't load it - continue checking other paths
  }

  // If we still haven't loaded env vars, try a few other common locations
  const possiblePaths = [
    // One level above the dist directory
    path.join(process.cwd(), '.env'),
    // Project root (two levels up from dist/config.js)
    path.join(scriptDir, '..', '..', '.env'),
    // User's home directory
    path.join(process.env.HOME || '', '.azuredevops.env')
  ];

  debugInfo.push('\nChecking additional paths:');
  for (const p of possiblePaths) {
    const resolvedPath = path.resolve(p);
    const exists = fs.existsSync(p);
    debugInfo.push(`  - ${p}`);
    debugInfo.push(`    Resolved: ${resolvedPath}`);
    debugInfo.push(`    Exists: ${exists}`);
    
    if (exists) {
      debugInfo.push('    ✓ Found .env at: ' + p);
      dotenv.config({ path: p });
      writeEnvDebugLog(debugInfo.join('\n'));
      return;
    }
  }

  debugInfo.push('\n❌ No .env file found. Using environment variables if available.');
  debugInfo.push('Please ensure .env file is in one of the checked locations.');
  writeEnvDebugLog(debugInfo.join('\n'));
}

// Write debug info to a file that can be read even in MCP mode
function writeEnvDebugLog(message: string) {
  try {
    // Write to the same logs directory as our main logger
    const baseDir = path.dirname(require.main?.filename || __dirname);
    const logsDir = path.join(baseDir, 'logs');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const debugLogPath = path.join(logsDir, 'env-loading-debug.log');
    const timestamp = new Date().toISOString();
    const logEntry = `\n${timestamp}\n${message}\n${'='.repeat(80)}\n`;
    
    fs.appendFileSync(debugLogPath, logEntry, 'utf8');
    
    // Also output to console if not in MCP mode
    if (process.env.MCP_MODE !== 'true') {
      console.log(message);
    }
  } catch (error) {
    // If we can't write the debug log, at least try to show in console
    console.error('Failed to write env debug log:', error);
    console.log(message);
  }
}

// Load environment variables
loadEnvFile();

/**
 * Get Azure DevOps configuration from environment variables
 */
export function getAzureDevOpsConfig(): AzureDevOpsConfig {
  const orgUrl = process.env.AZURE_DEVOPS_ORG_URL;
  const project = process.env.AZURE_DEVOPS_PROJECT;
  const personalAccessToken = process.env.AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN || '';
  const isOnPremises = process.env.AZURE_DEVOPS_IS_ON_PREMISES === 'true';
  const collection = process.env.AZURE_DEVOPS_COLLECTION;
  const apiVersion = process.env.AZURE_DEVOPS_API_VERSION;
  
  // Basic validation
  if (!orgUrl || !project) {
    const missingVars = [];
    if (!orgUrl) missingVars.push('AZURE_DEVOPS_ORG_URL');
    if (!project) missingVars.push('AZURE_DEVOPS_PROJECT');
    
    console.error('Environment variables check:');
    console.error('AZURE_DEVOPS_ORG_URL:', orgUrl ? 'SET' : 'NOT SET');
    console.error('AZURE_DEVOPS_PROJECT:', project ? 'SET' : 'NOT SET');
    console.error('Missing variables:', missingVars.join(', '));
    
    throw new Error(`Missing required Azure DevOps configuration: ${missingVars.join(', ')}. Please check .env file or environment variables.`);
  }

  // Authentication configuration
  const authTypeInput = process.env.AZURE_DEVOPS_AUTH_TYPE || 'pat';
  const authType = (authTypeInput === 'ntlm' || authTypeInput === 'basic' || authTypeInput === 'pat' || authTypeInput === 'entra')
    ? authTypeInput
    : 'pat';

  let auth: AzureDevOpsConfig['auth'];

  if (authType === 'entra') {
    if (isOnPremises) {
      throw new Error('Azure Identity (DefaultAzureCredential) authentication is not supported for on-premises Azure DevOps.');
    }
    auth = { type: 'entra' };
  } else if (isOnPremises) {
    switch (authType) {
      case 'ntlm':
        if (!process.env.AZURE_DEVOPS_USERNAME || !process.env.AZURE_DEVOPS_PASSWORD) {
          throw new Error('NTLM authentication requires username and password.');
        }
        auth = {
          type: 'ntlm',
          username: process.env.AZURE_DEVOPS_USERNAME,
          password: process.env.AZURE_DEVOPS_PASSWORD,
          domain: process.env.AZURE_DEVOPS_DOMAIN
        };
        break;
      case 'basic':
        if (!process.env.AZURE_DEVOPS_USERNAME || !process.env.AZURE_DEVOPS_PASSWORD) {
          throw new Error('Basic authentication requires username and password.');
        }
        auth = {
          type: 'basic',
          username: process.env.AZURE_DEVOPS_USERNAME,
          password: process.env.AZURE_DEVOPS_PASSWORD
        };
        break;
      case 'pat':
      default:
        if (!personalAccessToken) {
          throw new Error('PAT authentication requires a personal access token.');
        }
        auth = {
          type: 'pat'
        };
    }
  } else { // Cloud environment
    if (authType === 'pat') {
      if (!personalAccessToken) {
        throw new Error('PAT authentication requires a personal access token for Azure DevOps cloud unless AZURE_DEVOPS_AUTH_TYPE is set to entra.');
      }
      auth = { type: 'pat' };
    } else { // If not 'pat' and not 'entra' (already handled), then it's an unsupported type for cloud
      throw new Error(`Unsupported auth type "${authType}" for Azure DevOps cloud. Must be 'pat' or 'entra'.`);
    }
  }

  return {
    orgUrl,
    project,
    personalAccessToken,
    isOnPremises,
    collection,
    apiVersion,
    ...(auth && { auth })
  };
}

const ALL_ALLOWED_TOOLS = AIAssistedDevelopmentToolMethods
  .concat(ArtifactManagementToolMethods)
  .concat(BoardsSprintsToolMethods)
  .concat(DevSecOpsToolMethods)
  .concat(GitToolMethods)
  .concat(ProjectToolMethods)
  .concat(TestingCapabilitiesToolMethods)
  .concat(WorkItemToolMethods);

/**
 * Get allowed tools from `process.env.ALLOWED_TOOLS`.
 * 
 * For backward compatibility, if `process.env.ALLOWED_TOOLS` is `undefined`, all tools are allowed.
 */
export function getAllowedTools(): Set<string> {
  const ALLOWED_TOOLS = process.env.ALLOWED_TOOLS;
  if (!ALLOWED_TOOLS) return new Set(ALL_ALLOWED_TOOLS);
  const allowedTools = ALLOWED_TOOLS.split(',');
  return new Set(allowedTools);
}
