import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import fs from 'fs'
import path from 'path'
import util from 'util'
import dotenv from 'dotenv'

dotenv.config()

class TextToSpeechService {
    constructor() {
        // Usar credenciales desde variables de entorno
        this.client = new TextToSpeechClient({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                project_id: process.env.GOOGLE_PROJECT_ID
            }
        })
        console.log('✅ TextToSpeechService inicializado')
    }

    async convertToSpeech(text) {
        try {
            console.log('🗣️ Iniciando conversión de texto a voz...')
            
            const request = {
                input: { text },
                voice: {
                    languageCode: 'es-US',
                    name: 'es-US-Standard-B', // Voz masculina ESTÁNDAR mas economica = es-US-Standard-B ó Voz masculina Wavenet = mas costosa es-US-Neural2-B*
                    ssmlGender: 'MALE'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    pitch: 0,
                    speakingRate: 1
                }
            }

            const [response] = await this.client.synthesizeSpeech(request)
            
            // Crear directorio temporal si no existe
            const tmpDir = path.join(process.cwd(), 'tmp')
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true })
            }

            const audioPath = path.join(tmpDir, `response_${Date.now()}.mp3`)
            await fs.promises.writeFile(audioPath, response.audioContent, 'binary')
            
            console.log('✅ Audio generado exitosamente')
            return audioPath
        } catch (error) {
            console.error('❌ Error en text-to-speech:', error)
            throw error
        }
    }
}

export default new TextToSpeechService()
