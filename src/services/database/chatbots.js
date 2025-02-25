import supabase from '../../config/supabase.js'
import { TABLES, ERROR_MESSAGES } from '../../config/constants.js'

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

    async getActiveChatbotByPhone(phoneNumber) {
        // Clean phone number
        const cleanPhone = phoneNumber.replace('@s.whatsapp.net', '')
        console.log('Looking for chatbot for phone:', cleanPhone)

        // First try to get the chatbot from chat history
        const { data: historyData, error: historyError } = await supabase
            .from(TABLES.CHAT_HISTORY)
            .select(`
                chatbot:${TABLES.CHATBOTS}!inner(*)
            `)
            .eq('phone_number', cleanPhone)
            .eq('chatbot.is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (historyData?.chatbot) {
            console.log('Found chatbot from history:', historyData.chatbot.id)
            return historyData.chatbot
        }

        // If no chat history found, get the MOST RECENT default active chatbot
        console.log('No chat history found, getting most recent active chatbot...')
        const { data: activeBots, error: activeBotsError } = await supabase
            .from(TABLES.CHATBOTS)
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })

        if (activeBotsError) {
            console.error('Error getting active chatbots:', activeBotsError)
            throw new Error(activeBotsError.message)
        }

        if (activeBots && activeBots.length > 0) {
            // Log all active bots for debugging
            console.log('Found active chatbots:', activeBots.map(bot => `${bot.id} (${bot.name_chatbot})`))
            
            // Return only the most recent one
            const mostRecent = activeBots[0]
            console.log('Using most recent chatbot:', mostRecent.id, mostRecent.name_chatbot)
            return mostRecent
        }

        console.log('No active chatbots found')
        return null
    }
} 