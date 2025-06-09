import * as azdev from "azure-devops-node-api";
import { WorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi";
import {
  AzureDevOpsConfig,
  RawWorkItemResponse,
} from "../Interfaces/AzureDevOps";
import {
  getPersonalAccessTokenHandler,
  getNtlmHandler,
  getBasicHandler,
} from "azure-devops-node-api/WebApi";
import * as VsoBaseInterfaces from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces";
import {
  IRequestHandler,
} from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces";
import { logger } from "../utils/logger";

export class AzureDevOpsService {
  protected connection: azdev.WebApi;
  protected config: AzureDevOpsConfig;
  protected authHandler: IRequestHandler | undefined;

  constructor(config: AzureDevOpsConfig) {
    this.config = config;
    
    logger.info('AzureDevOpsService', 'Initializing service', {
      authType: config.auth?.type,
      isOnPremises: config.isOnPremises,
      orgUrl: config.orgUrl?.replace(/\/\/[^\/]+/, '//***')
    });

    // Get the appropriate authentication handler

    if (config.auth?.type === "entra") {
      if (config.isOnPremises) {
        const error = new Error(
          "Azure Identity (DefaultAzureCredential) authentication is not supported for on-premises Azure DevOps."
        );
        logger.error('AzureDevOpsService', 'Invalid authentication configuration', error);
        throw error;
      }
      if(!config.entraAuthHandler) {
        const error = new Error(
          "Entra authentication requires an instance of EntraAuthHandler."
        );
        logger.error('AzureDevOpsService', 'Missing Entra auth handler', error);
        throw error;
      }
      logger.info('AzureDevOpsService', 'Using Entra authentication');
      this.authHandler = config.entraAuthHandler;
    } else if (config.isOnPremises && config.auth) {
      switch (config.auth.type) {
        case 'ntlm':
          if (!config.auth.username || !config.auth.password) {
            const error = new Error(
              "NTLM authentication requires username and password"
            );
            logger.error('AzureDevOpsService', 'Missing NTLM credentials', error);
            throw error;
          }
          logger.info('AzureDevOpsService', 'Using NTLM authentication', {
            username: config.auth.username,
            domain: config.auth.domain || 'default'
          });
          this.authHandler = getNtlmHandler(
            config.auth.username,
            config.auth.password,
            config.auth.domain
          );
          break;
        case 'basic':
          if (!config.auth.username || !config.auth.password) {
            const error = new Error(
              "Basic authentication requires username and password"
            );
            logger.error('AzureDevOpsService', 'Missing Basic auth credentials', error);
            throw error;
          }
          logger.info('AzureDevOpsService', 'Using Basic authentication', {
            username: config.auth.username
          });
          this.authHandler = getBasicHandler(
            config.auth.username,
            config.auth.password
          );
          break;
        case 'pat':
        default: // Default to PAT for on-premises if auth type is missing or unrecognized
          if (!config.personalAccessToken) {
            const error = new Error(
              "PAT authentication requires a personal access token for on-premises if specified or as fallback."
            );
            logger.error('AzureDevOpsService', 'Missing PAT token', error);
            throw error;
          }
          logger.info('AzureDevOpsService', 'Using PAT authentication');
          this.authHandler = getPersonalAccessTokenHandler(config.personalAccessToken);
      }
    } else {
      // Cloud environment, and not 'entra'
      if (config.auth?.type === "pat" || !config.auth) {
        // Explicitly PAT or no auth specified (defaults to PAT for cloud)
        if (!config.personalAccessToken) {
          const error = new Error(
            "Personal Access Token is required for cloud authentication when auth type is PAT or not specified."
          );
          logger.error('AzureDevOpsService', 'Missing PAT token for cloud', error);
          throw error;
        }
        logger.info('AzureDevOpsService', 'Using PAT authentication for cloud');
        this.authHandler = getPersonalAccessTokenHandler(config.personalAccessToken);
      } else {
        // This case should ideally not be reached if config is validated correctly
        const error = new Error(
          `Unsupported authentication type "${config.auth?.type}" for Azure DevOps cloud.`
        );
        logger.error('AzureDevOpsService', 'Unsupported auth type', error, { authType: config.auth?.type });
        throw error;
      }
    }

    // Create the connection with the appropriate base URL
    let baseUrl = config.orgUrl;
    if (config.isOnPremises && config.collection) {
      // For on-premises, ensure the collection is included in the URL
      baseUrl = `${config.orgUrl}/${config.collection}`;
    }
    
    logger.info('AzureDevOpsService', 'Connecting to Azure DevOps', {
      baseUrl: baseUrl?.replace(/\/\/[^\/]+/, '//***'),
      isOnPremises: config.isOnPremises,
      collection: config.collection
    });

    // Create options for the WebApi
    const requestOptions: VsoBaseInterfaces.IRequestOptions = {};

    // For on-premises with API version specification, we'll add it to request headers
    if (config.isOnPremises && config.apiVersion) {
      requestOptions.headers = {
        Accept: `application/json;api-version=${config.apiVersion}`,
      };
    }

    // Create the WebApi instance
    // At this point, authHandler is guaranteed to be defined or an error would have been thrown.
    try {
      this.connection = new azdev.WebApi(baseUrl, this.authHandler, requestOptions);
      logger.info('AzureDevOpsService', 'Successfully created Azure DevOps connection');
    } catch (error) {
      logger.logConnectionFailure('AzureDevOpsService', error as Error, config);
      throw error;
    }
  }

  /**
   * Get the WorkItemTracking API client
   */
  protected async getWorkItemTrackingApi(): Promise<WorkItemTrackingApi> {
    return await this.connection.getWorkItemTrackingApi();
  }

  /**
   * List work items based on a WIQL query
   */
  public async listWorkItems(wiqlQuery: string): Promise<RawWorkItemResponse> {
    try {
      const witApi = await this.getWorkItemTrackingApi();

      // Execute the WIQL query
      const queryResult = await witApi.queryByWiql(
        {
          query: wiqlQuery,
        },
        {
          project: this.config.project,
        }
      );

      // Return the work items
      return {
        workItems: queryResult.workItems || [],
        count: queryResult.workItems?.length || 0,
      };
    } catch (error) {
      logger.error('AzureDevOpsService', 'Error listing work items', error as Error, {
        wiqlQuery,
        project: this.config.project
      });
      throw error;
    }
  }
}
