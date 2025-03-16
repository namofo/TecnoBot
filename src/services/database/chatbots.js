import supabase from '../../config/supabase.js'
import { TABLES, ERROR_MESSAGES } from '../../config/constants.js'
import { PortAssignmentService } from './port-assignment.js'

export const ChatbotService = {
    async createChatbot(userId, name, description = '') {
        const { data, error } = await supabase
            .from(TABLES.CHATBOTS)
            .insert({
                user_id: userId,
                name_chatbot: name,
                description: description,
                is_active: true
            })
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async getChatbot(chatbotId, userId) {
        const { data, error } = await supabase
            .from(TABLES.CHATBOTS)
            .select('*')
            .eq('id', chatbotId)
            .eq('user_id', userId)
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async listUserChatbots(userId) {
        const { data, error } = await supabase
            .from(TABLES.CHATBOTS)
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)
        return data
    },

    async updateChatbot(chatbotId, userId, updates) {
        const { data, error } = await supabase
            .from(TABLES.CHATBOTS)
            .update(updates)
            .eq('id', chatbotId)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async toggleChatbotStatus(chatbotId, userId, isActive) {
        const { data, error } = await supabase
            .from(TABLES.CHATBOTS)
            .update({ is_active: isActive })
            .eq('id', chatbotId)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async deleteChatbot(chatbotId, userId) {
        const { error } = await supabase
            .from(TABLES.CHATBOTS)
            .delete()
            .eq('id', chatbotId)
            .eq('user_id', userId)

        if (error) throw new Error(error.message)
        return true
    },

    async getActiveChatbotForPort() {
        try {
            const port = process.env.PORT || 3010
            const userId = await PortAssignmentService.getUserIdByPort(port)

            if (!userId) {
                console.error('No se encontró user_id para el puerto:', port)
                return null
            }

            // Modificación: Obtener el chatbot más reciente si hay varios
            const { data: chatbots, error } = await supabase
                .from('chatbots')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)

            if (error) throw error
            
            // Retornar el primer chatbot (el más reciente)
            return chatbots?.[0] || null
        } catch (error) {
            console.error('Error getting active chatbot:', error)
            return null
        }
    }
}