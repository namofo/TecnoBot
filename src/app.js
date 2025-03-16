import { join } from 'path'
import { createBot, createProvider, createFlow, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import dotenv from 'dotenv'
import { BlacklistService } from './services/database/blacklist.js'
import { PortAssignmentService } from './services/database/port-assignment.js'

// Import flows
import { createDataCollectionFlow } from './flows/data-collection/index.js'
import { createAIChatFlow } from './flows/ai-chat/index.js'
import { createDynamicFlows } from './flows/dynamic/index.js'

// Load environment variables
dotenv.config()

const PORT = process.env.PORT ?? 3010

// Set para trackear mensajes procesados
const processedMessages = new Set()

const main = async () => {
    try {
        console.log('Initializing bot...')
        
        // Validar asignación de puerto
        const port = process.env.PORT || 3010
        const userId = await PortAssignmentService.getUserIdByPort(port)
        
        if (!userId) {
            throw new Error(`No hay user_id asignado para el puerto ${port}`)
        }

        console.log(`✅ Bot iniciando en puerto ${port} para user_id: ${userId}`)
        
        const adapterProvider = createProvider(Provider)
        const adapterDB = new Database()

        // Initialize flows with provider
        console.log('Creating flows...')
        const flows = [
            {
                name: 'data-collection',
                flow: createDataCollectionFlow(), // Ya no es async
                priority: 1
            },
            {
                name: 'ai-chat',
                flow: createAIChatFlow(adapterProvider),
                priority: 2
            }
        ]

        // Verificar y ordenar flujos
        const validFlows = flows
            .filter(f => f.flow !== null && f.flow !== undefined)
            .sort((a, b) => a.priority - b.priority)
            .map(f => {
                console.log(`Adding flow: ${f.name}`)
                return f.flow
            })

        // Crear el flujo principal
        const dynamicFlows = await createDynamicFlows() // Este sí es async
        const allFlows = [...validFlows, dynamicFlows].filter(Boolean)

        const adapterFlow = createFlow(allFlows)

        const { handleMsg, handleCtx, httpServer } = await createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        })

        // Add message handler for ANY_MESSAGE event
        adapterProvider.on(EVENTS.MESSAGE, async (ctx) => {
            try {
                // Validate message context
                if (!ctx || !ctx.from) {
                    console.error('Invalid message context:', ctx)
                    return
                }

                // Format WhatsApp ID if needed
                const phoneNumber = ctx.from.replace('@s.whatsapp.net', '')
                ctx.from = phoneNumber // Store raw phone number

                // Generar un ID único para el mensaje
                const messageId = `${phoneNumber}-${Date.now()}`

                // Si el mensaje ya fue procesado, ignorarlo
                if (processedMessages.has(messageId)) {
                    console.log('Message already processed:', messageId)
                    return
                }

                console.log('Processing message:', {
                    from: phoneNumber,
                    body: ctx.body,
                    messageId
                })

                // Marcar el mensaje como procesado
                processedMessages.add(messageId)

                // Limpiar el ID del mensaje después de 5 segundos
                setTimeout(() => {
                    processedMessages.delete(messageId)
                }, 5000)

                // Normalize message body
                if (ctx.body) {
                    ctx.body = ctx.body.toLowerCase().trim()
                }

                // Process message
                await handleMsg(ctx)
            } catch (error) {
                console.error('Error processing message:', error)
                
                // Ignorar errores específicos
                if (error.message === 'Queue cleared' || error.message?.includes('Queue')) {
                    console.log('Ignoring Queue error')
                    return
                }
                
                try {
                    const provider = adapterProvider.getInstance()
                    if (provider && typeof provider.sendMessage === 'function') {
                        const to = ctx.from.includes('@s.whatsapp.net') ? ctx.from : `${ctx.from}@s.whatsapp.net`
                        await provider.sendMessage(to, { 
                            text: 'Lo siento, ocurrió un error al procesar tu mensaje.' 
                        })
                    }
                } catch (sendError) {
                    console.error('Error sending error message:', sendError)
                }
            }
        })

        // API endpoints
        adapterProvider.server.post(
            '/v1/messages',
            handleCtx(async (bot, req, res) => {
                const { number, message, urlMedia } = req.body
                await bot.sendMessage(number, message, { media: urlMedia ?? null })
                return res.end('sent')
            })
        )

        adapterProvider.server.post(
            '/v1/register',
            handleCtx(async (bot, req, res) => {
                const { number } = req.body
                await bot.dispatch('REGISTER_CLIENT', { from: number })
                return res.end('trigger')
            })
        )

        // Actualizar el endpoint de blacklist
        adapterProvider.server.post(
            '/v1/blacklist',
            handleCtx(async (bot, req, res) => {
                const { number, chatbotId, userId, action } = req.body

                try {
                    if (action === 'add') {
                        await BlacklistService.addToBlacklist(userId, chatbotId, number)
                    } else if (action === 'remove') {
                        await BlacklistService.removeFromBlacklist(chatbotId, number)
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ 
                        status: 'success', 
                        message: `Number ${action === 'add' ? 'added to' : 'removed from'} blacklist`,
                        number 
                    }))
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ 
                        status: 'error', 
                        message: error.message 
                    }))
                }
            })
        )

        httpServer(+PORT)
        console.log(`Server running on port ${PORT}`)
    } catch (error) {
        console.error('Error starting server:', error)
        process.exit(1)
    }
}

main()
