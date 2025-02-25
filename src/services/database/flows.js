import supabase from '../../config/supabase.js'
import { TABLES } from '../../config/constants.js'
import { validators } from '../../utils/validators.js'

export const FlowService = {
    async createFlow(userId, chatbotId, flowData) {
        // Validar el flujo antes de crearlo
        const validation = validators.validateFlow(flowData)
        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '))
        }

        const { data, error } = await supabase
            .from(TABLES.BOT_FLOWS)
            .insert({
                user_id: userId,
                chatbot_id: chatbotId,
                keyword: flowData.keyword,
                response_text: flowData.response_text,
                media_url: flowData.media_url,
                is_active: true,
                priority: flowData.priority || 0
            })
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async getActiveFlows(chatbotId) {
        const { data, error } = await supabase
            .from(TABLES.BOT_FLOWS)
            .select('*')
            .eq('chatbot_id', chatbotId)
            .eq('is_active', true)
            .order('priority', { ascending: true })

        if (error) throw new Error(error.message)
        return data || []
    },

    async updateFlow(flowId, userId, updates) {
        // Validar las actualizaciones si contienen datos del flujo
        if (updates.keyword || updates.response_text || updates.media_url) {
            const validation = validators.validateFlow({
                keyword: updates.keyword,
                response_text: updates.response_text,
                media_url: updates.media_url
            })
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '))
            }
        }

        const { data, error } = await supabase
            .from(TABLES.BOT_FLOWS)
            .update(updates)
            .eq('id', flowId)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async deleteFlow(flowId, userId) {
        const { error } = await supabase
            .from(TABLES.BOT_FLOWS)
            .delete()
            .eq('id', flowId)
            .eq('user_id', userId)

        if (error) throw new Error(error.message)
        return true
    },

    async toggleFlowStatus(flowId, userId, isActive) {
        const { data, error } = await supabase
            .from(TABLES.BOT_FLOWS)
            .update({ is_active: isActive })
            .eq('id', flowId)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    }
} 