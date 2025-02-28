import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { downloadMediaMessage, downloadContentFromMessage } from '@whiskeysockets/baileys'

class AudioTranscriber {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        })
    }

    async transcribeAudio(ctx, provider) {
        try {
            console.log('🎤 Iniciando transcripción de audio')
            
            // Crear directorio temporal si no existe
            const tmpDir = path.join(process.cwd(), 'tmp')
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true })
            }

            // Obtener el mensaje de audio
            const audioMessage = ctx.message?.audioMessage || ctx.message?.pttMessage
            if (!audioMessage) {
                throw new Error('No audio message found')
            }

            console.log('📥 Descargando audio...', {
                mimetype: audioMessage.mimetype,
                seconds: audioMessage.seconds,
                ptt: audioMessage.ptt
            })

            let buffer
            try {
                // Descargar el contenido del audio usando downloadContentFromMessage
                const stream = await downloadContentFromMessage(audioMessage, 'audio')
                buffer = Buffer.from([])
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk])
                }
            } catch (downloadError) {
                console.error('Error downloading audio:', downloadError)
                throw new Error('Failed to download audio content')
            }

            // Generar nombre único para el archivo
            const audioPath = path.join(tmpDir, `audio_${Date.now()}.ogg`)
            
            try {
                // Guardar el buffer como archivo
                await fs.promises.writeFile(audioPath, buffer)
                console.log('📥 Audio guardado temporalmente:', audioPath)

                // Transcribir el audio
                const transcription = await this.openai.audio.transcriptions.create({
                    file: fs.createReadStream(audioPath),
                    model: "whisper-1",
                    language: "es"
                })

                console.log('✅ Audio transcrito exitosamente')
                return transcription.text

            } finally {
                // Limpiar archivo temporal
                if (fs.existsSync(audioPath)) {
                    await fs.promises.unlink(audioPath)
                    console.log('🧹 Archivo temporal eliminado')
                }
            }
        } catch (error) {
            console.error('❌ Error en transcripción:', error)
            throw error
        }
    }
}

export default new AudioTranscriber()
