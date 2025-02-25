import { addKeyword, EVENTS } from '@builderbot/bot'
import { OpenAIService } from '../../services/ai/openai.js'
import { ChatHistoryService } from '../../services/database/chat-history.js'
import { ChatbotService } from '../../services/database/chatbots.js'
import { PromptsService } from '../../services/database/prompts.js'
import { FlowService } from '../../services/database/flows.js'
import { WelcomeService } from '../../services/database/welcomes.js'

// Constantes para configuración
const CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
}

const formatConversationHistory = (history) => {
    return history.map(entry => ([
        { role: 'user', content: entry.message },
        { role: 'assistant', content: entry.response }
    ])).flat()
}

// Función helper para reintentos
async function retry(fn, maxRetries) {
    let lastError
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn()
        } catch (error) {
            console.error(`Intento ${i + 1}/${maxRetries} falló:`, error)
            lastError = error
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY))
            }
        }
    }
    throw lastError
}

export const createAIChatFlow = () => {
    console.log('Creando flujo de IA...')
    
    return addKeyword(EVENTS.WELCOME, {
        sensitive: false
    })
    .addAction(async (ctx, { flowDynamic, endFlow, state }) => {
        try {
            console.log('🤖 IA: Iniciando procesamiento de mensaje')
            
            // Si estamos en medio de una recolección de datos, no intervenir
            const currentState = state.getMyState()
            if (currentState && Object.keys(currentState).length > 0) {
                console.log('🤖 IA: Flujo de datos en proceso, no intervengo')
                return endFlow()
            }

            const userMessage = ctx.body?.toLowerCase().trim()
            const phoneNumber = ctx.from.replace('@s.whatsapp.net', '')

            if (!ctx?.from) {
                console.error('❌ Contexto inválido')
                return endFlow()
            }

            // Obtener el chatbot activo
            const chatbot = await retry(() => 
                ChatbotService.getActiveChatbotByPhone(phoneNumber), 
                CONFIG.MAX_RETRIES
            )

            if (!chatbot) {
                console.log('❌ No se encontró chatbot activo')
                return endFlow()
            }

            // Verificar y enviar mensaje de bienvenida si corresponde
            const welcome = await retry(() => 
                WelcomeService.getActiveWelcome(chatbot.id), 
                CONFIG.MAX_RETRIES
            )

            if (welcome?.welcome_message) {
                const shouldSendWelcome = await WelcomeService.trackWelcomeMessage(welcome.id, phoneNumber)
                if (shouldSendWelcome) {
                    await retry(async () => {
                        try {
                            if (welcome.media_url) {
                                await flowDynamic([{
                                    body: welcome.welcome_message,
                                    media: welcome.media_url
                                }])
                                console.log('✅ Mensaje de bienvenida con media enviado')
                            } else {
                                await flowDynamic(welcome.welcome_message)
                                console.log('✅ Mensaje de bienvenida enviado')
                            }
                        } catch (sendError) {
                            console.error('❌ Error enviando mensaje de bienvenida:', sendError)
                            await flowDynamic(welcome.welcome_message)
                        }
                    }, CONFIG.MAX_RETRIES)
                }
            }

            // Si no hay mensaje del usuario, terminamos después de enviar bienvenida
            if (!userMessage) {
                console.log('🤖 IA: Mensaje vacío o inválido')
                return endFlow()
            }

            // Verificar si hay un flujo predefinido que coincida
            const flows = await FlowService.getActiveFlows(chatbot.id)
            console.log('🤖 IA: Flujos activos encontrados:', flows.length)
            
            const matchingFlow = flows.find(flow => 
                flow.keyword.some(keyword => 
                    userMessage.includes(keyword.toLowerCase())
                )
            )

            if (matchingFlow) {
                console.log('🤖 IA: Existe un flujo predefinido para:', matchingFlow.keyword)
                return endFlow()
            }

            console.log('🤖 IA: No hay flujo predefinido, procesando con IA')

            // Obtener prompts
            const [behaviorPrompt, knowledgePrompts] = await Promise.all([
                PromptsService.getActiveBehaviorPrompt(chatbot.id),
                PromptsService.getActiveKnowledgePrompts(chatbot.id)
            ])

            if (!behaviorPrompt) {
                console.log('🤖 IA: No hay prompt de comportamiento')
                await flowDynamic('Lo siento, no estoy configurado correctamente para responder en este momento.')
                return endFlow()
            }

            console.log('🤖 IA: Prompts obtenidos:', {
                behavior: behaviorPrompt?.id,
                knowledge: knowledgePrompts?.length || 0
            })

            // Obtener historial
            const history = await ChatHistoryService.getRecentHistory(chatbot.id, phoneNumber)
            const formattedHistory = formatConversationHistory(history)
            console.log('🤖 IA: Historial formateado:', formattedHistory.length, 'mensajes')

            // Agregar mensaje actual
            formattedHistory.push({
                role: 'user',
                content: userMessage
            })

            console.log('🤖 IA: Generando respuesta...')
            
            // Generar respuesta
            const aiResponse = await OpenAIService.generateChatResponse(
                formattedHistory,
                behaviorPrompt.prompt_text,
                knowledgePrompts?.map(p => p.prompt_text).join('\n\n') || ''
            )

            console.log('🤖 IA: Respuesta generada:', aiResponse?.substring(0, 50) + '...')

            // Guardar en historial
            await ChatHistoryService.addEntry(
                chatbot.user_id,
                chatbot.id,
                phoneNumber,
                userMessage,
                aiResponse
            )

            console.log('🤖 IA: Respuesta guardada en historial')
            await flowDynamic(aiResponse)
            console.log('🤖 IA: Respuesta enviada al usuario')
            
        } catch (error) {
            console.error('🤖 IA Error:', error)
            await flowDynamic('Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.')
        }
        
        return endFlow()
    })
} 