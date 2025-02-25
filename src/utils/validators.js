import { VALIDATION_PATTERNS, ERROR_MESSAGES } from '../config/constants.js'

export const validators = {
    isValidPhone(phone) {
        return VALIDATION_PATTERNS.PHONE.test(phone)
    },

    isValidEmail(email) {
        return VALIDATION_PATTERNS.EMAIL.test(email)
    },

    isValidIdentification(id) {
        return VALIDATION_PATTERNS.IDENTIFICATION.test(id)
    },

    isValidFullName(name) {
        // Verificar que tenga al menos dos palabras (nombre y apellido)
        const words = name.trim().split(/\s+/)
        return words.length >= 2 && words.every(word => word.length >= 2)
    },

    validateClientData(data) {
        const errors = []

        if (!data.identification_number || !this.isValidIdentification(data.identification_number)) {
            errors.push('El número de identificación debe contener solo números')
        }

        if (!data.full_name || !this.isValidFullName(data.full_name)) {
            errors.push('El nombre debe incluir al menos nombre y apellido')
        }

        if (!data.phone_number || !this.isValidPhone(data.phone_number)) {
            errors.push(ERROR_MESSAGES.INVALID_PHONE)
        }

        if (data.email && !this.isValidEmail(data.email)) {
            errors.push('El formato del correo electrónico no es válido')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    },

    validateWelcomeMessage(message) {
        if (!message || message.trim().length < 10) {
            return {
                isValid: false,
                error: 'Welcome message must be at least 10 characters long'
            }
        }
        return { isValid: true }
    },

    validateFlow(flow) {
        const errors = []

        if (!flow.keyword || !Array.isArray(flow.keyword) || flow.keyword.length === 0) {
            errors.push('At least one keyword is required')
        }

        if (!flow.response_text || flow.response_text.trim().length < 1) {
            errors.push('Response text is required')
        }

        if (flow.media_url && typeof flow.media_url !== 'string') {
            errors.push('Media URL must be a string')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }
} 