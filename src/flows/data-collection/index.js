import { addKeyword } from '@builderbot/bot'
import { ClientDataService } from '../../services/database/clients.js'
import { ChatbotService } from '../../services/database/chatbots.js'
import { FormFieldsService } from '../../services/database/form-fields.js'
import { FormMessagesService } from '../../services/database/form-messages.js'

export const createDataCollectionFlow = () => {
    return addKeyword(['registro', 'registrar', 'registrarme'])
        .addAction(async (ctx, { flowDynamic, state }) => {
            const chatbot = await ChatbotService.getActiveChatbotForPort()
            if (!chatbot) {
                await flowDynamic('❌ Servicio no disponible')
                return
            }

            try {
                // Obtener mensajes configurados
                const messages = await FormMessagesService.getFormMessages(chatbot.id)
                console.log('Mensajes obtenidos:', messages)

                // Obtener campos configurados
                const formFields = await FormFieldsService.getFormFields(chatbot.id)
                if (!formFields.length) {
                    await flowDynamic('❌ Formulario no configurado')
                    return
                }

                // Inicializar estado
                await state.update({
                    currentField: 0,
                    fields: formFields,
                    answers: {},
                    messages: messages
                })

                // Enviar mensaje de bienvenida y primer campo
                await flowDynamic(messages.welcome_message)
                await flowDynamic(formFields[0].field_label)
            } catch (error) {
                console.error('Error en inicio de registro:', error)
                await flowDynamic('❌ Error al iniciar el registro')
            }
        })
        .addAnswer(
            '',
            { capture: true },
            async (ctx, { fallBack, state, endFlow, flowDynamic }) => {
                const currentState = state.getMyState()
                const input = ctx.body.trim()

                if (input.toLowerCase() === 'cancelar') {
                    await state.clear()
                    await flowDynamic(currentState.messages.cancel_message)
                    return endFlow()
                }

                const currentField = currentState.fields[currentState.currentField]
                
                // Validar respuesta
                const isValid = await FormFieldsService.validateField(
                    input, 
                    currentField.validation_type
                )

                if (!isValid) {
                    return fallBack('❌ Respuesta no válida. Intenta nuevamente.')
                }

                // Guardar respuesta
                currentState.answers[currentField.field_name] = input

                // Verificar si hay más campos
                if (currentState.currentField < currentState.fields.length - 1) {
                    currentState.currentField++
                    await state.update(currentState)
                    return fallBack(currentState.fields[currentState.currentField].field_label)
                }

                // Guardar datos
                try {
                    const chatbot = await ChatbotService.getActiveChatbotForPort()
                    const formAnswers = currentState.answers

                    // Asegurar que el nombre se guarde correctamente
                    if (formAnswers.nombres) {
                        formAnswers.full_name = formAnswers.nombres
                    }

                    await ClientDataService.createClientData(
                        chatbot.user_id,
                        chatbot.id,
                        {
                            ...formAnswers,
                            phone_number: ctx.from
                        }
                    )

                    await flowDynamic(currentState.messages.success_message)
                } catch (error) {
                    console.error('Error saving data:', error)
                    await flowDynamic('❌ Error al guardar los datos')
                }

                await state.clear()
                return endFlow()
            }
        )
}

export const handleDataCollection = async (ctx) => {
    try {
        const chatbot = await ChatbotService.getActiveChatbotByPhone(ctx.from)
        if (!chatbot) return null

        return createDataCollectionFlow()
    } catch (error) {
        console.error('Error creating data collection flow:', error)
        return null
    }
}
