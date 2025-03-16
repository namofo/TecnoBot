import { addKeyword } from '@builderbot/bot'
import { ChatbotService } from '../../services/database/chatbots.js'
import { FlowService } from '../../services/database/flows.js'

// Función para normalizar texto
const normalizeText = (text) => {
    return text.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .trim()
}

// Función para verificar coincidencia
const checkKeywordMatch = (message, keywords) => {
    const normalizedMessage = normalizeText(message)
    
    // Verificar coincidencia exacta primero
    const exactMatch = keywords.some(keyword => 
        normalizeText(keyword) === normalizedMessage
    )
    if (exactMatch) return true

    // Verificar coincidencia parcial
    return keywords.some(keyword => {
        const normalizedKeyword = normalizeText(keyword)
        return normalizedMessage.includes(normalizedKeyword) ||
               normalizedKeyword.includes(normalizedMessage)
    })
}

export const createDynamicFlows = async () => {
    console.log('Creando flujo dinámico base...')
    
    // Palabras clave base que activarán el flujo
    const baseKeywords = [
        'menu', 'ayuda', 'info', 
        'servicios', 'productos',
        'precio', 'costo', 'valor', 'planes',
        'contacto', 'comunicar', 'asesor',
        'ubicacion', 'horario'
    ]
    
    // Crear un flujo principal que maneje todos los flujos dinámicos
    const mainFlow = addKeyword(baseKeywords, {
        sensitive: false
    })
    .addAnswer('Un momento, estoy buscando la información...', null, async (ctx, { flowDynamic, endFlow }) => {
        try {
            console.log('⚡ Flujo dinámico activado')
            const message = ctx.body?.toLowerCase().trim() || ''
            console.log('📝 Mensaje recibido:', message)
            console.log('📱 Número:', ctx?.from)

            if (!ctx?.from) {
                console.log('❌ Número de teléfono no válido')
                return endFlow()
            }

            // Obtener el chatbot activo
            const chatbot = await ChatbotService.getActiveChatbotForPort()
            console.log('🤖 Chatbot encontrado:', chatbot?.id)

            if (!chatbot) {
                console.log('❌ No se encontró un chatbot activo')
                await flowDynamic('Lo siento, el servicio no está disponible en este momento.')
                return endFlow()
            }

            // Obtener los flujos activos del chatbot
            const flows = await FlowService.getActiveFlows(chatbot.id)
            console.log('🔍 Flujos encontrados:', flows?.length || 0)

            if (!flows || flows.length === 0) {
                console.log('❌ No hay flujos configurados')
                await flowDynamic('Lo siento, no tengo respuestas configuradas en este momento.')
                return endFlow()
            }

            // Mostrar flujos disponibles y sus palabras clave
            flows.forEach(flow => {
                console.log('📌 Flujo:', {
                    id: flow.id,
                    keywords: flow.keyword,
                    response: flow.response_text.substring(0, 50) + '...',
                    media: flow.media_url ? 'Sí' : 'No'
                })
            })

            // Buscar coincidencia con mejor logging
            console.log('🔍 Buscando coincidencia para mensaje:', message)
            const matchingFlow = flows.find(flow => {
                const matches = checkKeywordMatch(message, flow.keyword)
                console.log(`Verificando keywords ${flow.keyword.join(', ')}: ${matches ? 'Coincide' : 'No coincide'}`)
                return matches
            })

            if (matchingFlow) {
                console.log('✅ Coincidencia encontrada:', {
                    id: matchingFlow.id,
                    keywords: matchingFlow.keyword,
                    hasMedia: !!matchingFlow.media_url
                })

                try {
                    if (matchingFlow.media_url) {
                        // Enviar mensaje con media
                        await flowDynamic([{
                            body: matchingFlow.response_text,
                            media: matchingFlow.media_url
                        }])
                        console.log('✅ Mensaje con media enviado')
                    } else {
                        // Enviar solo mensaje de texto
                        await flowDynamic(matchingFlow.response_text)
                        console.log('✅ Mensaje de texto enviado')
                    }
                } catch (mediaError) {
                    console.error('❌ Error enviando media:', mediaError)
                    // Si falla el envío con media, enviar solo el texto
                    await flowDynamic(matchingFlow.response_text)
                    console.log('✅ Fallback: Mensaje de texto enviado')
                }
            } else {
                console.log('❌ No se encontraron coincidencias para:', message)
                await flowDynamic([
                    'Lo siento, no encontré información específica para tu consulta.',
                    'Puedes preguntarme sobre:\n- Servicios\n- Precios\n- Contacto'
                ])
            }
            
            return endFlow()
        } catch (error) {
            console.error('❌ Error en flujo dinámico:', error)
            await flowDynamic('Lo siento, ocurrió un error al procesar tu consulta.')
            return endFlow()
        }
    })

    console.log('Flujo dinámico base creado ✅')
    return mainFlow
}