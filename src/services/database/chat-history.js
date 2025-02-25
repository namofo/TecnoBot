import supabase from '../../config/supabase.js'
import { TABLES, CONFIG } from '../../config/constants.js'
import { OpenAIService } from '../ai/openai.js'

export const ChatHistoryService = {
    async addEntry(userId, chatbotId, phoneNumber, message, response) {
        try {
            // Generate embedding for the message for future semantic search
            const embedding = await OpenAIService.generateEmbedding(message)

            const { data, error } = await supabase
                .from(TABLES.CHAT_HISTORY)
                .insert({
                    user_id: userId,
                    chatbot_id: chatbotId,
                    phone_number: phoneNumber,
                    message: message,
                    response: response,
                    embedding: embedding
                })
                .select()
                .single()

            if (error) throw new Error(error.message)
            return data
        } catch (error) {
            console.error('Error adding chat history:', error)
            throw error
        }
    },

    async getRecentHistory(chatbotId, phoneNumber, limit = CONFIG.MAX_CHAT_HISTORY) {
        const { data, error } = await supabase
            .from(TABLES.CHAT_HISTORY)
            .select('message, response, created_at')
            .eq('chatbot_id', chatbotId)
            .eq('phone_number', phoneNumber)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw new Error(error.message)
        return data.reverse() // Return in chronological order
    },

    async findSimilarConversations(chatbotId, query, limit = 5) {
        try {
            // Generate embedding for the query
            const queryEmbedding = await OpenAIService.generateEmbedding(query)

            // Perform similarity search using the embedding
            const { data, error } = await supabase
                .rpc('match_chat_history', {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.7, // Similarity threshold
                    match_count: limit,
                    p_chatbot_id: chatbotId
                })

            if (error) throw new Error(error.message)
            return data
        } catch (error) {
            console.error('Error finding similar conversations:', error)
            throw error
        }
    },

    async deleteOldHistory(chatbotId, daysToKeep = 30) {
        const { error } = await supabase
            .from(TABLES.CHAT_HISTORY)
            .delete()
            .eq('chatbot_id', chatbotId)
            .lt('created_at', new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString())

        if (error) throw new Error(error.message)
        return true
    }
} 