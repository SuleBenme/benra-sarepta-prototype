export class BrowserSpeechProvider {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    this.currentUtterance = null
  }

  isSupported() {
    return Boolean(this.synth && typeof window !== 'undefined' && 'SpeechSynthesisUtterance' in window)
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

  async waitForVoices(timeoutMs = 1200) {
    const existing = this.getVoices()
    if (existing.length) return existing

    return await new Promise(resolve => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        resolve(this.getVoices())
      }

      const timer = setTimeout(done, timeoutMs)
      const handler = () => {
        clearTimeout(timer)
        if (this.synth) this.synth.removeEventListener('voiceschanged', handler)
        done()
      }

      if (this.synth) this.synth.addEventListener('voiceschanged', handler, { once: true })
    })
  }

  async speak(text, voiceURI, callbacks = {}) {
    if (!this.isSupported() || !text?.trim()) {
      callbacks.onError?.('Talesyntese støttes ikke i denne nettleseren.')
      return false
    }

    try {
      await this.waitForVoices()
      this.synth.cancel()
      this.synth.resume()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'nb-NO'
      utterance.rate = 0.95
      utterance.pitch = 1
      utterance.volume = 1

      const voices = this.getVoices()
      const selected =
        voices.find(voice => voice.voiceURI === voiceURI) ||
        this.getNorwegianVoices()[0] ||
        voices[0]

      if (selected) {
        utterance.voice = selected
        utterance.lang = selected.lang || 'nb-NO'
      }

      utterance.onstart = () => callbacks.onStart?.(selected)
      utterance.onend = () => {
        callbacks.onEnd?.()
        this.currentUtterance = null
      }
      utterance.onerror = event => {
        callbacks.onError?.(event.error || 'Ukjent feil ved talesyntese.')
        this.currentUtterance = null
      }

      // Keep a strong reference. Some browsers may otherwise stop long utterances.
      this.currentUtterance = utterance
      this.synth.speak(utterance)

      // Chrome can occasionally remain paused after cancel()/tab switching.
      setTimeout(() => {
        if (this.synth?.paused) this.synth.resume()
      }, 100)

      return true
    } catch (error) {
      callbacks.onError?.(error?.message || 'Kunne ikke starte talesyntese.')
      return false
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel()
      this.synth.resume()
    }
    this.currentUtterance = null
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

  waitForVoices() {
    return this.provider.waitForVoices()
  }

  speak(text, voiceURI, callbacks) {
    return this.provider.speak(text, voiceURI, callbacks)
  }

  stop() {
    this.provider.stop()
  }
}

export const speechService = new SpeechService()
