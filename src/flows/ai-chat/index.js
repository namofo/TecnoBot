import { addKeyword, EVENTS } from '@builderbot/bot'
import { OpenAIService } from '../../services/ai/openai.js'
import { ChatHistoryService } from '../../services/database/chat-history.js'
import { ChatbotService } from '../../services/database/chatbots.js'
import { PromptsService } from '../../services/database/prompts.js'
import { FlowService } from '../../services/database/flows.js'
import { WelcomeService } from '../../services/database/welcomes.js'
import AudioTranscriber from '../../services/ai/audio-transcriber.js'
import TextToSpeechService from '../../services/ai/text-to-speech.js'
import fs from 'fs'
import { BlacklistService } from '../../services/database/blacklist.js'

// Constantes para configuración
const CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
}

const formatConversationHistory = (history) => {
    return history.map(entry => ([{ role: 'user', content: entry.message }, { role: 'assistant', content: entry.response }])).flat()
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

export const createAIChatFlow = (adapterProvider) => {
    console.log('Creando flujo de IA...')

    return addKeyword([EVENTS.WELCOME, EVENTS.VOICE_NOTE], {
        sensitive: false
    })
        .addAction(async (ctx, { flowDynamic, endFlow, state }) => {
            try {
                console.log('🤖 IA: Iniciando procesamiento de mensaje')

                // Verificación temprana de blacklist
                const phoneNumber = ctx.from.replace('@s.whatsapp.net', '')
                const chatbot = await ChatbotService.getActiveChatbotForPort(phoneNumber)
                
                if (!chatbot) {
                    console.log('❌ No se encontró chatbot para:', phoneNumber)
                    return endFlow()
                }

                // Verificar blacklist antes de cualquier procesamiento
                const isBlacklisted = await BlacklistService.isBlacklisted(chatbot.id, phoneNumber)
                if (isBlacklisted === true) {
                    console.log('🚫 MENSAJE BLOQUEADO - Número en lista negra:', phoneNumber)
                    return endFlow()
                }

                // Si estamos en medio de una recolección de datos, no intervenir
                const currentState = state.getMyState()
                if (currentState && Object.keys(currentState).length > 0) {
                    console.log('🤖 IA: Flujo de datos en proceso, no intervengo')
                    return endFlow()
                }

                let userMessage

                // Procesar audio si existe
                if (ctx.message?.audioMessage || ctx.message?.pttMessage) {
                    try {
                        await flowDynamic('Procesando mensaje de voz...')
                        userMessage = await AudioTranscriber.transcribeAudio(ctx, adapterProvider.getInstance())

                        if (!userMessage) {
                            throw new Error('No se pudo transcribir el audio')
                        }

                        await flowDynamic('He entendido: "' + userMessage + '"')
                    } catch (error) {
                        console.error('Error procesando audio:', error)
                        await flowDynamic('No pude procesar el mensaje de voz correctamente.')
                        return endFlow()
                    }
                } else {
                    userMessage = ctx.body?.toLowerCase().trim()
                }

                if (!ctx?.from) {
                    console.error('❌ Contexto inválido')
                    return endFlow()
                }

                // Verificar y enviar mensaje de bienvenida si corresponde
                const welcome = await retry(() => WelcomeService.getActiveWelcome(chatbot.id), CONFIG.MAX_RETRIES)

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

                // Detectar si el mensaje original era audio
                const isAudioMessage = Boolean(ctx.message?.audioMessage || ctx.message?.pttMessage)

                if (isAudioMessage) {
                    try {
                        console.log('🔊 Generando respuesta de audio...')
                        // Convertir respuesta de IA a audio
                        const audioPath = await TextToSpeechService.convertToSpeech(aiResponse)
                        
                        // Enviar el audio usando flowDynamic
                        await flowDynamic([{
                            media: audioPath,
                            ptt: true, // Esto lo envía como nota de voz
                            type: 'audio'
                        }])

                        console.log('✅ Audio enviado correctamente')

                        // Limpiar archivo temporal
                        if (fs.existsSync(audioPath)) {
                            await fs.promises.unlink(audioPath)
                            console.log('🧹 Archivo temporal eliminado')
                        }
                    } catch (audioError) {
                        console.error('❌ Error en proceso de audio:', audioError)
                        // Fallback a respuesta en texto
                        await flowDynamic(aiResponse)
                    }
                } else {
                    // Respuesta normal en texto
                    await flowDynamic(aiResponse)
                }

                console.log('🤖 IA: Respuesta enviada al usuario')

            } catch (error) {
                console.error('🤖 IA Error:', error)
                await flowDynamic('Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.')
            }

            return endFlow()
        })
}