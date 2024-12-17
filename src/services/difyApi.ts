import * as vscode from 'vscode';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { DIFYResponse, DIFYContext, ProjectStructure } from '../types';
import { DIFY_API_KEY, DIFY_API_URL } from '../config';
import { ProjectContextService } from './projectContext';

export class DifyApiService {
    private static instance: DifyApiService;
    private apiKey: string = '';
    private readonly apiUrl: string = DIFY_API_URL;
    private static secretStorage: vscode.SecretStorage;

    private constructor() {}

    public static async initialize(context: vscode.ExtensionContext): Promise<void> {
        DifyApiService.secretStorage = context.secrets;
        
        const storedKey = await context.secrets.get('difyApiKey');
        if (!storedKey) {
            await context.secrets.store('difyApiKey', DIFY_API_KEY);
        }
    }

    public static getInstance(): DifyApiService {
        if (!DifyApiService.instance) {
            DifyApiService.instance = new DifyApiService();
        }
        return DifyApiService.instance;
    }

    private async getApiKey(): Promise<string> {
        if (!this.apiKey) {
            this.apiKey = await DifyApiService.secretStorage.get('difyApiKey') || '';
            
            if (!this.apiKey) {
                this.apiKey = DIFY_API_KEY;
                await DifyApiService.secretStorage.store('difyApiKey', this.apiKey);
            }
        }
        return this.apiKey;
    }

    public async query(
        query: string,
        context?: DIFYContext,
        projectStructure?: ProjectStructure
    ): Promise<DIFYResponse> {
        try {
            const apiKey = await this.getApiKey();
            if (!apiKey) {
                throw new Error('API key not available');
            }

            const conversationId = context?.conversation_id || '';
            
            // Generate project context if available
            const projectContextService = ProjectContextService.getInstance();
            const projectContextSummary = projectStructure 
                ? projectContextService.generateProjectSummary(projectStructure)
                : '';

            // Combine project context with query
            const enhancedQuery = projectContextSummary 
                ? `Project Context:\n${projectContextSummary}\n\nQuestion: ${query}` 
                : query;

            const payload = {
                inputs: {
                    project_context: projectContextSummary
                },
                query: enhancedQuery,
                response_mode: "blocking",
                conversation_id: conversationId,
                user: `vscode-${uuidv4()}`,
                files: []
            };

            const response = await axios.post<DIFYResponse>(
                this.apiUrl,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                event: 'message',
                message_id: response.data.message_id,
                conversation_id: response.data.conversation_id,
                mode: response.data.mode || 'chat',
                answer: response.data.answer,
                metadata: response.data.metadata,
                created_at: response.data.created_at || Date.now()
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    await DifyApiService.secretStorage.delete('difyApiKey');
                    this.apiKey = '';
                    throw new Error('Invalid API key configuration');
                }
                throw new Error(`DIFY API Error: ${error.response?.data?.message || error.message}`);
            }
            throw new Error(`DIFY API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}