import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { DIFYResponse, DIFYContext } from '../types';

export class DifyApiService {
    private static instance: DifyApiService;
    private readonly apiKey: string;
    private readonly apiUrl: string;

    private constructor() {
        this.apiKey = process.env.DIFY_API_KEY || '';
        this.apiUrl = process.env.DIFY_API_URL || '';
    }

    public static getInstance(): DifyApiService {
        if (!DifyApiService.instance) {
            DifyApiService.instance = new DifyApiService();
        }
        return DifyApiService.instance;
    }

    public async query(
        query: string, 
        context?: DIFYContext
    ): Promise<DIFYResponse> {
        try {
            // Generate a unique conversation ID for first-time queries
            const conversationId = context?.conversation_id || '';
            
            const payload = {
                inputs: {},
                query: query,
                response_mode: "blocking",
                conversation_id: conversationId,
                user: `vscode-${uuidv4()}`, // Unique identifier for each VS Code user
                files: [] // Optional: Add if needed
            };

            const response = await axios.post<DIFYResponse>(
                this.apiUrl,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
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
            if (error instanceof Error) {
                throw new Error(`DIFY API Error: ${error.message}`);
            }
            throw new Error('An unknown error occurred');
        }
    }
}