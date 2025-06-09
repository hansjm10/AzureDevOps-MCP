import * as azdev from 'azure-devops-node-api';
import { GitApi } from 'azure-devops-node-api/GitApi';
import { AzureDevOpsConfig } from '../Interfaces/AzureDevOps';
import { AzureDevOpsService } from './AzureDevOpsService';
import { validatePullRequestRepository } from '../utils/repositoryValidation';
import {
  ListRepositoriesParams,
  GetRepositoryParams,
  CreateRepositoryParams,
  ListBranchesParams,
  SearchCodeParams,
  BrowseRepositoryParams,
  GetFileContentParams,
  GetCommitHistoryParams,
  CreatePullRequestParams,
  GetPullRequestParams,
  GetPullRequestCommentsParams,
  ApprovePullRequestParams,
  MergePullRequestParams,
  GetCommitsParams,
  GetPullRequestsParams,
  CompletePullRequestParams,
  AddPullRequestCommentParams
} from '../Interfaces/CodeAndRepositories';

export class GitService extends AzureDevOpsService {
  constructor(config: AzureDevOpsConfig) {
    super(config);
  }

  /**
   * Get the Git API client
   */
  private async getGitApi(): Promise<GitApi> {
    return await this.connection.getGitApi();
  }

  /**
   * List all repositories
   */
  public async listRepositories(params: ListRepositoriesParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      const repositories = await gitApi.getRepositories(
        params.projectId || this.config.project,
        params.includeHidden,
        params.includeAllUrls
      );
      
      return repositories;
    } catch (error) {
      console.error('Error listing repositories:', error);
      throw error;
    }
  }

  /**
   * Get repository details
   */
  public async getRepository(params: GetRepositoryParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      const repository = await gitApi.getRepository(
        params.repositoryId,
        params.projectId || this.config.project
      );
      
      return repository;
    } catch (error) {
      console.error(`Error getting repository ${params.repositoryId}:`, error);
      throw error;
    }
  }

  /**
   * Create a repository
   */
  public async createRepository(params: CreateRepositoryParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      const repository = await gitApi.createRepository({
        name: params.name,
        project: {
          id: params.projectId || this.config.project
        }
      }, params.projectId || this.config.project);
      
      return repository;
    } catch (error) {
      console.error(`Error creating repository ${params.name}:`, error);
      throw error;
    }
  }

  /**
   * List branches
   */
  public async listBranches(params: ListBranchesParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      const branches = await gitApi.getBranches(
        params.repositoryId,
        params.filter
      );
      
      if (params.top && branches.length > params.top) {
        return branches.slice(0, params.top);
      }
      
      return branches;
    } catch (error) {
      console.error(`Error listing branches for repository ${params.repositoryId}:`, error);
      throw error;
    }
  }

  /**
   * Search code (Note: This uses a simplified approach as the full-text search API
   * might require additional setup)
   */
  public async searchCode(params: SearchCodeParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // This is a simplified implementation using item search
      // For more comprehensive code search, you'd use the Search API
      const items = await gitApi.getItems(
        params.repositoryId || "",
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      
      // Simple filter based on the search text and file extension
      let filteredItems = items;
      
      if (params.searchText) {
        filteredItems = filteredItems.filter(item => 
          item.path && item.path.toLowerCase().includes(params.searchText.toLowerCase())
        );
      }
      
      if (params.fileExtension) {
        filteredItems = filteredItems.filter(item => 
          item.path && item.path.endsWith(params.fileExtension || "")
        );
      }
      
      // Limit results if top is specified
      if (params.top && filteredItems.length > params.top) {
        filteredItems = filteredItems.slice(0, params.top);
      }
      
      return filteredItems;
    } catch (error) {
      console.error(`Error searching code in repository ${params.repositoryId}:`, error);
      throw error;
    }
  }

  /**
   * Browse repository
   */
  public async browseRepository(params: BrowseRepositoryParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      const items = await gitApi.getItems(
        params.repositoryId,
        undefined,
        params.path,
        undefined,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      
      return items;
    } catch (error) {
      console.error(`Error browsing repository ${params.repositoryId}:`, error);
      throw error;
    }
  }

  /**
   * Get file content
   */
  public async getFileContent(params: GetFileContentParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Get the file content as a stream
      const content = await gitApi.getItemContent(
        params.repositoryId,
        params.path,
        undefined,
        undefined
      );
      
      // Convert content to string
      let fileContent = '';
      
      // Handle different content types
      if (Buffer.isBuffer(content)) {
        fileContent = content.toString('utf8');
      } else if (typeof content === 'string') {
        fileContent = content;
      } else {
        // If it's a stream or other type, return a placeholder
        fileContent = "[Content not available in this format]";
      }
      
      return {
        content: fileContent
      };
    } catch (error) {
      console.error(`Error getting file content for ${params.path}:`, error);
      throw error;
    }
  }

  /**
   * Get commit history
   */
  public async getCommitHistory(params: GetCommitHistoryParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Get commits without search criteria
      const commits = await gitApi.getCommits(
        params.repositoryId,
        {} // Empty search criteria
      );
      
      // Filter by path if provided
      let filteredCommits = commits;
      if (params.itemPath) {
        filteredCommits = commits.filter(commit => 
          commit.comment && commit.comment.includes(params.itemPath || "")
        );
      }
      
      // Apply pagination if specified
      if (params.skip && params.skip > 0) {
        filteredCommits = filteredCommits.slice(params.skip);
      }
      
      if (params.top && params.top > 0) {
        filteredCommits = filteredCommits.slice(0, params.top);
      }
      
      return filteredCommits;
    } catch (error) {
      console.error(`Error getting commit history for repository ${params.repositoryId}:`, error);
      throw error;
    }
  }

  /**
   * Get commits
   */
  public async getCommits(params: GetCommitsParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Get commits without search criteria
      const commits = await gitApi.getCommits(
        params.repositoryId,
        {} // Empty search criteria
      );
      
      // Filter by path if provided
      let filteredCommits = commits;
      if (params.path) {
        filteredCommits = commits.filter(commit => 
          commit.comment && commit.comment.includes(params.path || "")
        );
      }
      
      return filteredCommits;
    } catch (error) {
      console.error(`Error getting commits for repository ${params.repositoryId}:`, error);
      throw error;
    }
  }

  /**
   * Get pull requests
   */
  public async getPullRequests(params: GetPullRequestsParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Create search criteria with proper types
      const searchCriteria: any = {
        repositoryId: params.repositoryId,
        creatorId: params.creatorId,
        reviewerId: params.reviewerId,
        sourceRefName: params.sourceRefName,
        targetRefName: params.targetRefName
      };
      
      // Convert string status to number if provided
      if (params.status) {
        if (params.status === 'active') searchCriteria.status = 1;
        else if (params.status === 'abandoned') searchCriteria.status = 2;
        else if (params.status === 'completed') searchCriteria.status = 3;
        else if (params.status === 'notSet') searchCriteria.status = 0;
        // 'all' doesn't need to be set
      }
      
      const pullRequests = await gitApi.getPullRequests(
        params.repositoryId,
        searchCriteria
      );
      
      return pullRequests;
    } catch (error) {
      console.error(`Error getting pull requests for repository ${params.repositoryId}:`, error);
      throw error;
    }
  }

  /**
   * Create pull request
   */
  public async createPullRequest(params: CreatePullRequestParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      const pullRequest = {
        sourceRefName: params.sourceRefName,
        targetRefName: params.targetRefName,
        title: params.title,
        description: params.description,
        reviewers: params.reviewers ? params.reviewers.map(id => ({ id })) : undefined
      };
      
      const createdPullRequest = await gitApi.createPullRequest(
        pullRequest,
        params.repositoryId,
        this.config.project
      );
      
      return createdPullRequest;
    } catch (error) {
      console.error('Error creating pull request:', error);
      throw error;
    }
  }

  /**
   * Get pull request by ID
   */
  public async getPullRequest(params: GetPullRequestParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      const pullRequest = await gitApi.getPullRequest(
        params.repositoryId,
        params.pullRequestId,
        this.config.project
      );
      
      // Override status values with human-readable text for AI interpretation
      // Status values: 1=active, 2=abandoned, 3=completed
      const statusNumber = Number(pullRequest.status ?? 0);
      const statusText = this.getPullRequestStatusText(statusNumber);
      
      // Merge status values: 1=conflicts, 2=failure, 3=notSet, 4=queued, 5=rejectedByPolicy, 6=succeeded
      const mergeStatusNumber = Number(pullRequest.mergeStatus ?? 3);
      const mergeStatusText = this.getMergeStatusText(mergeStatusNumber);
      
      return {
        ...pullRequest,
        status: statusText,
        mergeStatus: mergeStatusText
      };
    } catch (error) {
      console.error(`Error getting pull request ${params.pullRequestId}:`, error);
      throw error;
    }
  }

  /**
   * Convert numeric status to human-readable text based on Azure DevOps API documentation
   * @param status Numeric status from Azure DevOps API
   * @returns Human-readable status text
   */
  private getPullRequestStatusText(status: number): string {
    switch (status) {
      case 0: return 'notSet';
      case 1: return 'active';
      case 2: return 'abandoned'; 
      case 3: return 'completed';
      default: return `unknown(${status})`;
    }
  }

  /**
   * Convert numeric merge status to human-readable text based on Azure DevOps API documentation
   * @param mergeStatus Numeric merge status from Azure DevOps API
   * @returns Human-readable merge status text
   */
  private getMergeStatusText(mergeStatus: number): string {
    switch (mergeStatus) {
      case 1: return 'conflicts';
      case 2: return 'failure';
      case 3: return 'notSet';
      case 4: return 'queued';
      case 5: return 'rejectedByPolicy';
      case 6: return 'succeeded';
      default: return `unknown(${mergeStatus})`;
    }
  }

  /**
   * Get pull request comments
   */
  public async getPullRequestComments(params: GetPullRequestCommentsParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Validate that the repository ID matches the pull request
      await validatePullRequestRepository(
        gitApi,
        params.repositoryId,
        params.pullRequestId,
        this.config.project
      );
      
      if (params.threadId) {
        const thread = await gitApi.getPullRequestThread(
          params.repositoryId,
          params.pullRequestId,
          params.threadId,
          this.config.project
        );
        
        return thread;
      } else {
        const threads = await gitApi.getThreads(
          params.repositoryId,
          params.pullRequestId,
          this.config.project
        );
        
        return threads;
      }
    } catch (error) {
      console.error(`Error getting comments for pull request ${params.pullRequestId}:`, error);
      throw error;
    }
  }

  /**
   * Approve pull request
   */
  public async approvePullRequest(params: ApprovePullRequestParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Validate that the repository ID matches the pull request
      await validatePullRequestRepository(
        gitApi,
        params.repositoryId,
        params.pullRequestId,
        this.config.project
      );
      
      const vote = {
        vote: 10
      };
      
      const result = await gitApi.createPullRequestReviewer(
        vote,
        params.repositoryId,
        params.pullRequestId,
        "me",
        this.config.project
      );
      
      return result;
    } catch (error) {
      console.error(`Error approving pull request ${params.pullRequestId}:`, error);
      throw error;
    }
  }

  /**
   * Merge pull request
   */
  public async mergePullRequest(params: MergePullRequestParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Validate that the repository ID matches the pull request
      await validatePullRequestRepository(
        gitApi,
        params.repositoryId,
        params.pullRequestId,
        this.config.project
      );
      
      // Convert string merge strategy to number
      let mergeStrategy = 1; // Default to noFastForward
      if (params.mergeStrategy === 'rebase') mergeStrategy = 2;
      else if (params.mergeStrategy === 'rebaseMerge') mergeStrategy = 3;
      else if (params.mergeStrategy === 'squash') mergeStrategy = 4;
      
      const result = await gitApi.updatePullRequest(
        { 
          status: 3, // 3 = completed in PullRequestStatus enum
          completionOptions: {
            mergeStrategy: mergeStrategy
          }
        },
        params.repositoryId,
        params.pullRequestId,
        this.config.project
      );
      
      return result;
    } catch (error) {
      console.error(`Error merging pull request ${params.pullRequestId}:`, error);
      throw error;
    }
  }

  /**
   * Add a comment to a pull request
   */
  public async addPullRequestComment(params: AddPullRequestCommentParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Validate that the repository ID matches the pull request
      await validatePullRequestRepository(
        gitApi,
        params.repositoryId,
        params.pullRequestId,
        this.config.project
      );
      
      if (params.threadId) {
        // Add comment to existing thread
        const comment = {
          content: params.content,
          parentCommentId: params.parentCommentId || 0,
          commentType: 1 // 1 = text comment
        };
        
        const result = await gitApi.createComment(
          comment,
          params.repositoryId,
          params.pullRequestId,
          params.threadId,
          this.config.project
        );
        
        return result;
      } else {
        // Create new thread with comment
        const thread: any = {
          comments: [{
            parentCommentId: 0,
            content: params.content,
            commentType: 1 // 1 = text comment
          }],
          status: 1 // 1 = active
        };
        
        // Add thread context if file/line information is provided
        if (params.threadContext || (params.filePath && params.lineNumber)) {
          thread.threadContext = params.threadContext || {
            filePath: params.filePath,
            rightFileStart: {
              line: params.lineNumber,
              offset: 1
            },
            rightFileEnd: {
              line: params.lineNumber,
              offset: 999
            }
          };
        }
        
        const result = await gitApi.createThread(
          thread,
          params.repositoryId,
          params.pullRequestId,
          this.config.project
        );
        
        return result;
      }
    } catch (error) {
      console.error(`Error adding comment to pull request ${params.pullRequestId}:`, error);
      throw error;
    }
  }

  /**
   * Complete pull request
   */
  public async completePullRequest(params: CompletePullRequestParams): Promise<any> {
    try {
      const gitApi = await this.getGitApi();
      
      // Validate that the repository ID matches the pull request
      await validatePullRequestRepository(
        gitApi,
        params.repositoryId,
        params.pullRequestId,
        this.config.project
      );
      
      // Get the current pull request
      const pullRequest = await gitApi.getPullRequestById(params.pullRequestId);
      
      // Convert string merge strategy to number
      let mergeStrategy = 1; // Default to noFastForward
      if (params.mergeStrategy === 'rebase') mergeStrategy = 2;
      else if (params.mergeStrategy === 'rebaseMerge') mergeStrategy = 3;
      else if (params.mergeStrategy === 'squash') mergeStrategy = 4;
      
      // Update the pull request to completed status
      const updatedPullRequest = await gitApi.updatePullRequest(
        {
          status: 3, // 3 = completed in PullRequestStatus enum
          completionOptions: {
            mergeStrategy: mergeStrategy,
            deleteSourceBranch: params.deleteSourceBranch
          }
        },
        params.repositoryId,
        params.pullRequestId
      );
      
      return updatedPullRequest;
    } catch (error) {
      console.error(`Error completing pull request ${params.pullRequestId}:`, error);
      throw error;
    }
  }
} 