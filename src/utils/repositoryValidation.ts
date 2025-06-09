import { GitApi } from 'azure-devops-node-api/GitApi';

/**
 * Validates that a pull request belongs to the specified repository
 * @param gitApi The Git API instance
 * @param repositoryId The repository ID to validate against
 * @param pullRequestId The pull request ID to validate
 * @param projectId The project ID
 * @throws Error if the pull request doesn't belong to the repository
 */
export async function validatePullRequestRepository(
  gitApi: GitApi,
  repositoryId: string,
  pullRequestId: number,
  projectId: string
): Promise<void> {
  const pullRequest = await gitApi.getPullRequest(
    repositoryId,
    pullRequestId,
    projectId
  );

  if (!pullRequest) {
    throw new Error(`Pull request ${pullRequestId} not found in repository ${repositoryId}`);
  }

  // Check if the repository ID in the PR matches the provided repository ID
  if (pullRequest.repository && pullRequest.repository.id !== repositoryId) {
    throw new Error(
      `Pull request ${pullRequestId} belongs to repository ${pullRequest.repository.id}, not ${repositoryId}`
    );
  }
}

/**
 * Validates that a work item belongs to the specified repository
 * This is a placeholder for future implementation when work items are linked to repositories
 */
export async function validateWorkItemRepository(
  repositoryId: string,
  workItemId: number
): Promise<void> {
  // TODO: Implement when work items have repository associations
  // For now, this is a no-op
  return;
}