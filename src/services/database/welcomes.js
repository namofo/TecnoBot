import supabase from '../../config/supabase.js'
import { TABLES, CONFIG } from '../../config/constants.js'

export const WelcomeService = {
    async createWelcome(userId, chatbotId, welcomeMessage, mediaUrl = null) {
        const { data, error } = await supabase
            .from(TABLES.WELCOMES)
            .insert({
                user_id: userId,
                chatbot_id: chatbotId,
                welcome_message: welcomeMessage,
                media_url: mediaUrl,
                is_active: true
            })
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async getActiveWelcome(chatbotId) {
        const { data, error } = await supabase
            .from(TABLES.WELCOMES)
            .select('*')
            .eq('chatbot_id', chatbotId)
            .eq('is_active', true)
            .single()

        if (error && error.code !== 'PGRST116') throw new Error(error.message)
        return data
    },

    async trackWelcomeMessage(welcomeId, phoneNumber) {
        try {
            // Limpiar registros antiguos primero
            await this.cleanOldWelcomeTracking()

            // Verificar si existe un tracking activo
            const { data: existing } = await supabase
                .from(TABLES.WELCOME_TRACKING)
                .select('*')
                .eq('welcome_id', welcomeId)
                .eq('phone_number', phoneNumber)
                .gt('expires_at', new Date().toISOString())
                .single()

            if (existing) {
                console.log('Found active welcome tracking for:', phoneNumber)
                return false // Ya existe un tracking activo
            }

            // Crear nuevo tracking
            const expiresAt = new Date(Date.now() + CONFIG.WELCOME_MESSAGE_EXPIRY)
            const { error } = await supabase
                .from(TABLES.WELCOME_TRACKING)
                .insert({
                    welcome_id: welcomeId,
                    phone_number: phoneNumber,
                    expires_at: expiresAt.toISOString()
                })

            if (error) {
                console.error('Error creating welcome tracking:', error)
                return false
            }

            console.log('Created welcome tracking for:', phoneNumber, 'expires:', expiresAt)
            return true
        } catch (error) {
            console.error('Error in trackWelcomeMessage:', error)
            return false
        }
    },

    async cleanOldWelcomeTracking() {
        try {
            const { error } = await supabase
                .from(TABLES.WELCOME_TRACKING)
                .delete()
                .lt('expires_at', new Date().toISOString())

            if (error) {
                console.error('Error cleaning old welcome tracking:', error)
            } else {
                console.log('Cleaned old welcome tracking records')
            }
        } catch (error) {
            console.error('Error in cleanOldWelcomeTracking:', error)
        }
    },

    async updateWelcome(welcomeId, userId, updates) {
        const { data, error } = await supabase
            .from(TABLES.WELCOMES)
            .update(updates)
            .eq('id', welcomeId)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async deleteWelcome(welcomeId, userId) {
        const { error } = await supabase
            .from(TABLES.WELCOMES)
            .delete()
            .eq('id', welcomeId)
            .eq('user_id', userId)

        if (error) throw new Error(error.message)
        return true
    }
} 