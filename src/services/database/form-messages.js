import supabase from '../../config/supabase.js'

export const FormMessagesService = {
    async getFormMessages(chatbotId) {
        try {
            const { data, error } = await supabase
                .from('form_messages')
                .select('message_content')
                .eq('chatbot_id', chatbotId)
                .eq('is_active', true)
                .single()

            // Si hay datos, devolver el message_content
            if (data?.message_content) {
                return data.message_content
            }

            // Valores por defecto si no hay datos
            return {
                trigger_words: ['registro', 'registrar', 'registrarme'],
                welcome_message: '📝 Iniciemos tu registro. Escribe "cancelar" para detener el proceso.',
                success_message: ['✅ Registro completado exitosamente.', '¡Gracias por registrarte! 🎉'],
                cancel_message: 'Registro cancelado'
            }
        } catch (error) {
            console.error('Error getting form messages:', error)
            // Retornar mensajes por defecto en caso de error
            return {
                trigger_words: ['registro', 'registrar', 'registrarme'],
                welcome_message: '📝 Iniciemos tu registro. Escribe "cancelar" para detener el proceso.',
                success_message: ['✅ Registro completado exitosamente.', '¡Gracias por registrarte! 🎉'],
                cancel_message: 'Registro cancelado'
            }
        }
    },

    async updateMessages(chatbotId, data) {
        const { error } = await supabase
            .from('form_messages')
            .upsert({
                chatbot_id: chatbotId,
                ...data,
                updated_at: new Date()
            })

        if (error) throw error
        return true
    }
}
