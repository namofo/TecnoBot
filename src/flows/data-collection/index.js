import { addKeyword } from '@builderbot/bot'
import { ClientDataService } from '../../services/database/clients.js'
import { ChatbotService } from '../../services/database/chatbots.js'
import { validators } from '../../utils/validators.js'

export const createDataCollectionFlow = () => {
    return addKeyword(['registro', 'registrar', 'registrarme'])
        .addAnswer([
            '📝 Iniciemos tu registro. Por favor, sigue las instrucciones.',
            '❗ En cualquier momento puedes escribir "cancelar" para detener el proceso.',
            'Ingresa tu número de identificación (solo números):'
        ])
        .addAnswer(
            '',
            { capture: true },
            async (ctx, { fallBack, state, endFlow, flowDynamic }) => {
                const input = ctx.body.trim().toLowerCase()
                const currentState = state.getMyState() || { step: 'identification' }

                // Verificar cancelación en cualquier paso
                if (input === 'cancelar') {
                    await state.clear()
                    await flowDynamic([
                        '🚫 Registro cancelado.',
                        'Si deseas intentarlo de nuevo, escribe "registrarme".',
                        'O puedes preguntarme cualquier otra cosa.'
                    ])
                    return endFlow()
                }

                // Manejar cada paso del registro
                switch (currentState.step) {
                    case 'identification':
                        if (!validators.isValidIdentification(input)) {
                            await fallBack('❌ El número de identificación debe contener solo números. Por favor, intenta nuevamente.')
                            return
                        }
                        await state.update({ 
                            ...currentState,
                            step: 'name',
                            identification: input 
                        })
                        return fallBack('Ingresa tu nombre completo (nombre y apellido):')

                    case 'name':
                        if (!validators.isValidFullName(input)) {
                            await fallBack('❌ Por favor ingresa tu nombre completo (nombre y apellido).')
                            return
                        }
                        await state.update({ 
                            ...currentState,
                            step: 'email',
                            fullName: input 
                        })
                        return fallBack('Ingresa tu correo electrónico:')

                    case 'email':
                        if (!validators.isValidEmail(input)) {
                            await fallBack('❌ El formato del correo electrónico no es válido. Por favor, intenta nuevamente.')
                            return
                        }

                        try {
                            const chatbot = await ChatbotService.getActiveChatbotByPhone(ctx.from)
                            if (!chatbot) {
                                await flowDynamic('❌ Lo siento, ocurrió un error en el registro. No se encontró un chatbot activo.')
                                await state.clear()
                                return endFlow()
                            }

                            const clientData = {
                                identification_number: currentState.identification,
                                full_name: currentState.fullName,
                                phone_number: ctx.from,
                                email: input
                            }

                            const validation = validators.validateClientData(clientData)
                            if (!validation.isValid) {
                                await flowDynamic([
                                    '❌ Lo siento, hay errores en los datos:',
                                    validation.errors.join('\n')
                                ])
                                await state.clear()
                                return endFlow()
                            }

                            await ClientDataService.createClientData(chatbot.user_id, chatbot.id, clientData)

                            await flowDynamic([
                                '✅ Datos registrados correctamente:',
                                `📋 Identificación: ${clientData.identification_number}`,
                                `👤 Nombre: ${clientData.full_name}`,
                                `📧 Email: ${clientData.email}`,
                                `📱 Teléfono: ${clientData.phone_number}`,
                                '\n¡Gracias por registrarte! 🎉'
                            ])

                        } catch (error) {
                            console.error('Error saving client data:', error)
                            await flowDynamic('❌ Lo siento, ocurrió un error al guardar tus datos. Por favor, intenta nuevamente más tarde.')
                        }

                        await state.clear()
                        return endFlow()

                    default:
                        await state.clear()
                        return endFlow()
                }
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
