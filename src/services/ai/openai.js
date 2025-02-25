import OpenAI from 'openai'
import { CONFIG } from '../../config/constants.js'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no está configurada en el archivo .env')
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export const OpenAIService = {
    async generateChatResponse(messages, behaviorPrompt = '', knowledgePrompt = '') {
        try {
            console.log('🤖 OpenAI: Preparando mensajes para generar respuesta')
            
            // Preparar mensajes del sistema
            const systemMessages = []
            
            if (behaviorPrompt) {
                console.log('🤖 OpenAI: Agregando prompt de comportamiento')
                systemMessages.push({
                    role: 'system',
                    content: behaviorPrompt
                })
            }
            
            if (knowledgePrompt) {
                console.log('🤖 OpenAI: Agregando prompt de conocimiento')
                systemMessages.push({
                    role: 'system',
                    content: knowledgePrompt
                })
            }

            // Combinar mensajes
            const fullMessages = [
                ...systemMessages,
                ...messages
            ]

            console.log('🤖 OpenAI: Total de mensajes:', fullMessages.length)

            // Generar respuesta
            console.log('🤖 OpenAI: Llamando a la API...')
            const completion = await openai.chat.completions.create({
                model: CONFIG.AI_CONFIG.MODEL,
                messages: fullMessages,
                max_tokens: CONFIG.AI_CONFIG.MAX_TOKENS,
                temperature: CONFIG.AI_CONFIG.TEMPERATURE
            })

            const response = completion.choices[0].message.content
            console.log('🤖 OpenAI: Respuesta generada:', response.substring(0, 50) + '...')

            return response
        } catch (error) {
            console.error('🤖 OpenAI Error:', {
                message: error.message,
                type: error.type,
                code: error.code
            })
            throw new Error('Error generando respuesta de IA: ' + error.message)
        }
    },

    async generateEmbedding(text) {
        try {
            console.log('🤖 OpenAI: Generando embedding para texto')
            const response = await openai.embeddings.create({
                model: CONFIG.AI_CONFIG.EMBEDDING_MODEL,
                input: text
            })

            console.log('🤖 OpenAI: Embedding generado exitosamente')
            return response.data[0].embedding
        } catch (error) {
            console.error('🤖 OpenAI Embedding Error:', error)
            throw new Error('Error generando embedding: ' + error.message)
        }
    },

    async isResponseRelevant(question, answer, threshold = 0.8) {
        try {
            console.log('🤖 OpenAI: Verificando relevancia de respuesta')
            
            // Generar embeddings
            const [questionEmbedding, answerEmbedding] = await Promise.all([
                this.generateEmbedding(question),
                this.generateEmbedding(answer)
            ])

            // Calcular similitud
            const similarity = this.cosineSimilarity(questionEmbedding, answerEmbedding)
            console.log('🤖 OpenAI: Similitud calculada:', similarity)
            
            return similarity >= threshold
        } catch (error) {
            console.error('🤖 OpenAI Relevance Error:', error)
            return false
        }
    },

    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0)
        const normA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0))
        const normB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0))
        return dotProduct / (normA * normB)
    }
} 