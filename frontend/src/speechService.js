export class BrowserSpeechProvider {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  }

  isSupported() {
    return Boolean(this.synth && 'SpeechSynthesisUtterance' in window)
  }

  getVoices() {
    if (!this.isSupported()) return []
    return this.synth.getVoices()
  }

  getNorwegianVoices() {
    return this.getVoices().filter(voice => {
      const lang = (voice.lang || '').toLowerCase()
      return lang.startsWith('nb') || lang.startsWith('nn') || lang.startsWith('no')
    })
  }

  speak(text, voiceURI) {
    if (!this.isSupported() || !text) return false

    this.synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'nb-NO'

    const voices = this.getVoices()
    const selected = voices.find(voice => voice.voiceURI === voiceURI)
      || this.getNorwegianVoices()[0]

    if (selected) {
      utterance.voice = selected
      utterance.lang = selected.lang || 'nb-NO'
    }

    this.synth.speak(utterance)
    return true
  }

  stop() {
    if (this.synth) this.synth.cancel()
  }
}

export class SpeechService {
  constructor(provider = new BrowserSpeechProvider()) {
    this.provider = provider
  }

  isSupported() {
    return this.provider.isSupported()
  }

  getAvailableVoices() {
    return this.provider.getVoices()
  }

  getNorwegianVoices() {
    return this.provider.getNorwegianVoices()
  }

  speak(text, voiceURI) {
    return this.provider.speak(text, voiceURI)
  }

  stop() {
    this.provider.stop()
  }
}

export const speechService = new SpeechService()
