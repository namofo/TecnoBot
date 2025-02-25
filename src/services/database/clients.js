import supabase from '../../config/supabase.js'
import { TABLES, ERROR_MESSAGES } from '../../config/constants.js'
import { validators } from '../../utils/validators.js'

export const ClientDataService = {
    async createClientData(userId, chatbotId, clientData) {
        // Validate client data
        const validation = validators.validateClientData(clientData)
        if (!validation.isValid) {
            throw new Error(validation.errors.join(', '))
        }

        // Check for existing client with same identification
        const { data: existing } = await supabase
            .from(TABLES.CLIENT_DATA)
            .select('id')
            .eq('chatbot_id', chatbotId)
            .eq('identification_number', clientData.identification_number)
            .single()

        if (existing) {
            throw new Error(ERROR_MESSAGES.DUPLICATE_ENTRY)
        }

        // Create new client data
        const { data, error } = await supabase
            .from(TABLES.CLIENT_DATA)
            .insert({
                user_id: userId,
                chatbot_id: chatbotId,
                identification_number: clientData.identification_number,
                full_name: clientData.full_name,
                phone_number: clientData.phone_number,
                email: clientData.email,
                media_url: clientData.media_url
            })
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    },

    async getClientByPhone(chatbotId, phoneNumber) {
        const { data, error } = await supabase
            .from(TABLES.CLIENT_DATA)
            .select('*')
            .eq('chatbot_id', chatbotId)
            .eq('phone_number', phoneNumber)
            .single()

        if (error && error.code !== 'PGRST116') throw new Error(error.message)
        return data
    },

    async getClientById(chatbotId, identificationNumber) {
        const { data, error } = await supabase
            .from(TABLES.CLIENT_DATA)
            .select('*')
            .eq('chatbot_id', chatbotId)
            .eq('identification_number', identificationNumber)
            .single()

        if (error && error.code !== 'PGRST116') throw new Error(error.message)
        return data
    },

    async updateClientData(userId, clientId, updates) {
        // Validate updates if they contain client data
        if (Object.keys(updates).length > 0) {
            const validation = validators.validateClientData({ ...updates })
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '))
            }
        }

        const { data, error } = await supabase
            .from(TABLES.CLIENT_DATA)
            .update(updates)
            .eq('id', clientId)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return data
    }
} 