import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { speechService } from './speechService'
import './styles.css'

const defaultPages = [
  { id: 1, title: 'Hei!', text: 'I dag skal vi lese en liten tekst sammen.' },
  { id: 2, title: 'En tur ut', text: 'Solen skinner. Vi tar på sko og går ut. Vi finner en rød ball.' },
  { id: 3, title: 'Ferdig', text: 'Bra jobbet. Nå er teksten ferdig.' },
]

function splitSentences(text) {
  const cleaned = (text || '').trim()
  if (!cleaned) return []
  const matches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
  return (matches || [cleaned]).map(sentence => sentence.trim()).filter(Boolean)
}

function App() {
  const [mode, setMode] = useState('adult')
  const [pages, setPages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sarepta-pages')) || defaultPages
    } catch {
      return defaultPages
    }
  })
  const [active, setActive] = useState(0)
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const [savedAt, setSavedAt] = useState(null)
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('sarepta-voice') || '')
  const [speechRate, setSpeechRate] = useState(() => Number(localStorage.getItem('sarepta-rate')) || 0.95)
  const [screenReaderMode, setScreenReaderMode] = useState(() => localStorage.getItem('sarepta-screen-reader') === 'true')
  const [speechStatus, setSpeechStatus] = useState('Klar')

  const current = pages[active] || pages[0]
  const sentences = useMemo(() => splitSentences(current?.text), [current?.text])
  const currentSentence = sentences[sentenceIndex] || current?.text || ''

  useEffect(() => {
    setSentenceIndex(0)
    speechService.stop()
  }, [active])

  useEffect(() => {
    if (sentenceIndex > Math.max(0, sentences.length - 1)) setSentenceIndex(0)
  }, [sentences.length, sentenceIndex])

  useEffect(() => {
    const loadVoices = () => {
      const norwegian = speechService.getNorwegianVoices()
      const all = speechService.getAvailableVoices()
      setVoices(norwegian.length ? norwegian : all)
    }

    loadVoices()

    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [])

  useEffect(() => {
    if (selectedVoice) localStorage.setItem('sarepta-voice', selectedVoice)
    localStorage.setItem('sarepta-rate', String(speechRate))
    localStorage.setItem('sarepta-screen-reader', String(screenReaderMode))
  }, [selectedVoice, speechRate, screenReaderMode])

  useEffect(() => {
    if (screenReaderMode) {
      speechService.stop()
      setSpeechStatus('Innebygd tale av – skjermlesermodus')
    } else if (speechStatus === 'Innebygd tale av – skjermlesermodus') {
      setSpeechStatus('Klar')
    }
  }, [screenReaderMode])

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('sarepta-pages', JSON.stringify(pages))
      setSavedAt(new Date())
    }, 350)
    return () => clearTimeout(timer)
  }, [pages])

  const speakText = async text => {
    if (screenReaderMode) {
      setSpeechStatus('Innebygd tale er slått av i skjermlesermodus')
      return
    }

    setSpeechStatus('Starter tale…')
    await speechService.speak(
      text,
      { voiceURI: selectedVoice, rate: speechRate },
      {
        onStart: voice => setSpeechStatus(`Leser opp med ${voice?.name || 'standardstemme'}`),
        onEnd: () => setSpeechStatus('Ferdig'),
        onError: error => setSpeechStatus(`Feil: ${error}`)
      }
    )
  }

  const readCurrentPage = () => speakText(`${current.title}. ${current.text}`)
  const readCurrentSentence = () => speakText(currentSentence)
  const testSpeechRate = () => speakText(`Dette er en test av talehastighet ${speechRate.toFixed(2)} ganger.`)

  const nextSentence = () => {
    if (sentenceIndex < sentences.length - 1) {
      setSentenceIndex(index => index + 1)
    } else if (active < pages.length - 1) {
      setActive(index => index + 1)
      setSentenceIndex(0)
    }
  }

  const previousSentence = () => {
    if (sentenceIndex > 0) {
      setSentenceIndex(index => index - 1)
    } else if (active > 0) {
      const previousPage = pages[active - 1]
      setActive(index => index - 1)
      setSentenceIndex(Math.max(0, splitSentences(previousPage.text).length - 1))
    }
  }

  useEffect(() => {
    const onKey = event => {
      if (mode !== 'student') return

      if (['ArrowRight', ' '].includes(event.key)) {
        event.preventDefault()
        nextSentence()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        previousSentence()
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        readCurrentSentence()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, active, sentenceIndex, sentences.length, currentSentence, selectedVoice, speechRate, screenReaderMode])

  const updatePage = (index, field, value) => {
    setPages(prev => prev.map((page, i) => i === index ? { ...page, [field]: value } : page))
  }

  const addPage = () => {
    setPages(prev => [...prev, { id: Date.now(), title: 'Ny side', text: 'Skriv tekst her.' }])
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">BENRA AS · teknisk prototype</div>
          <h1>Sarepta</h1>
        </div>
        <nav aria-label="Velg modus" className="modeSwitch">
          <button className={mode === 'adult' ? 'active' : ''} onClick={() => setMode('adult')}>Voksenmodus</button>
          <button className={mode === 'student' ? 'active' : ''} onClick={() => setMode('student')}>Elevmodus</button>
        </nav>
      </header>

      {mode === 'adult' ? (
        <section className="layout">
          <aside className="sidebar" aria-label="Sider">
            <div className="sideTitle">Innhold</div>
            {pages.map((page, i) => (
              <button key={page.id} className={active === i ? 'pageBtn selected' : 'pageBtn'} onClick={() => setActive(i)}>
                <span>{i + 1}</span>
                {page.title}
              </button>
            ))}
            <button className="addBtn" onClick={addPage}>+ Ny side</button>
          </aside>

          <section className="editor">
            <div className="sectionHeader">
              <div>
                <div className="eyebrow">Tekst</div>
                <h2>Rediger innhold</h2>
              </div>
              <div className="saveState" aria-live="polite">
                {savedAt ? `Lagret ${savedAt.toLocaleTimeString('no-NO', {hour:'2-digit', minute:'2-digit'})}` : 'Lagrer…'}
              </div>
            </div>

            <label>
              Tittel
              <input value={current.title} onChange={event => updatePage(active, 'title', event.target.value)} />
            </label>

            <label>
              Tekst
              <textarea rows="8" value={current.text} onChange={event => updatePage(active, 'text', event.target.value)} />
            </label>

            <section className="speechPanel" aria-labelledby="speech-heading">
              <div>
                <div className="eyebrow">Talestøtte</div>
                <h3 id="speech-heading">Norsk talesyntese</h3>
              </div>

              <label className="voiceLabel">
                Stemme på denne enheten
                <select value={selectedVoice} onChange={event => setSelectedVoice(event.target.value)} disabled={screenReaderMode}>
                  <option value="">Automatisk norsk stemme</option>
                  {voices.map(voice => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </label>

              <label className="rangeLabel">
                Talehastighet: <strong>{speechRate.toFixed(2)}×</strong>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  value={speechRate}
                  onChange={event => {
                    const nextRate = Number(event.target.value)
                    speechService.stop()
                    setSpeechRate(nextRate)
                    setSpeechStatus(`Hastighet ${nextRate.toFixed(2)}× valgt – start opplesning på nytt`)
                  }}
                  disabled={screenReaderMode}
                />
              </label>

              <div className="rateActions" aria-label="Test talehastighet">
                <button type="button" onClick={() => setSpeechRate(0.75)} disabled={screenReaderMode}>Rolig 0.75×</button>
                <button type="button" onClick={() => setSpeechRate(1)} disabled={screenReaderMode}>Normal 1.00×</button>
                <button type="button" onClick={() => setSpeechRate(1.25)} disabled={screenReaderMode}>Rask 1.25×</button>
                <button type="button" onClick={testSpeechRate} disabled={screenReaderMode}>🔊 Test hastighet</button>
              </div>

              <label className="toggleRow">
                <input
                  type="checkbox"
                  checked={screenReaderMode}
                  onChange={event => setScreenReaderMode(event.target.checked)}
                />
                <span>
                  <strong>Skjermlesermodus</strong>
                  <small>Slår av Sareptas innebygde tale for å unngå dobbel opplesning med for eksempel NVDA.</small>
                </span>
              </label>

              <div className="speechMeta" aria-live="polite">
                <strong>Status: {speechStatus}</strong><br />
                {speechService.isSupported()
                  ? voices.length
                    ? `${voices.length} relevant(e) stemme(r) funnet på denne enheten.`
                    : 'Ingen norsk stemme ble eksplisitt funnet. Nettleserens standardstemme brukes.'
                  : 'Nettleseren støtter ikke Web Speech API.'}
              </div>
            </section>

            <div className="actions">
              <button onClick={readCurrentPage} disabled={screenReaderMode}>🔊 Les hele siden</button>
              <button onClick={() => { speechService.stop(); setSpeechStatus('Stoppet') }} disabled={screenReaderMode}>Stopp tale</button>
              <button onClick={() => setMode('student')}>Åpne elevvisning</button>
            </div>

            <div className="note">
              Prototypen bruker nettleser-/operativsystembasert talesyntese bak et eget SpeechService-grensesnitt. Skjermlesermodus kan slå av innebygd tale, og talehastigheten kan tilpasses uten å endre innholdet.
            </div>
          </section>
        </section>
      ) : (
        <section className="student" aria-label="Elevmodus">
          <div className="progress" aria-label={`Side ${active + 1} av ${pages.length}, setning ${sentenceIndex + 1} av ${Math.max(1, sentences.length)}`}>
            Side {active + 1}/{pages.length} · Setning {sentenceIndex + 1}/{Math.max(1, sentences.length)}
          </div>

          <article className="studentCard" tabIndex="0" aria-live="polite">
            <h2>{current.title}</h2>
            <p className="sentenceFocus">{currentSentence}</p>
          </article>

          <div className="studentActions">
            <button disabled={active === 0 && sentenceIndex === 0} onClick={previousSentence}>← Forrige setning</button>
            <button onClick={readCurrentSentence} disabled={screenReaderMode}>🔊 Les setningen</button>
            <button disabled={active === pages.length - 1 && sentenceIndex >= sentences.length - 1} onClick={nextSentence}>Neste setning →</button>
          </div>

          <div className="studentVoice" aria-live="polite">
            {screenReaderMode
              ? 'Skjermlesermodus: innebygd tale er av.'
              : `Tale: ${voices.find(v => v.voiceURI === selectedVoice)?.name || 'automatisk norsk stemme'} · ${speechRate.toFixed(2)}×`}
          </div>

          <div className="switchHelp">
            Brytersimulering: <kbd>←</kbd> forrige setning · <kbd>→</kbd> eller <kbd>mellomrom</kbd> neste setning · <kbd>T</kbd> les setningen
          </div>

          <button className="backBtn" onClick={() => setMode('adult')}>Tilbake til voksenmodus</button>
        </section>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
