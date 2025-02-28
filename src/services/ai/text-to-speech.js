import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import fs from 'fs'
import path from 'path'
import util from 'util'

class TextToSpeechService {
    constructor() {
        // Usar path.join para construir la ruta absoluta
        const credentialsPath = path.join(
            process.cwd(),
            'apigoogle',
            'tecnochattextovoz-0b6dd14bacf5.json'
        )

        // Verificar si existe el archivo de credenciales
        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`Archivo de credenciales no encontrado en: ${credentialsPath}`)
        }

        this.client = new TextToSpeechClient({
            keyFilename: credentialsPath
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
                    name: 'es-US-Neural2-B', // Voz masculina
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
