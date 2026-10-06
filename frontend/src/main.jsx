import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { speechService } from './speechService'
import './styles.css'

const defaultPages = [
  { id: 1, title: 'Hei!', text: 'I dag skal vi lese en liten tekst sammen.' },
  { id: 2, title: 'En tur ut', text: 'Solen skinner. Vi tar på sko og går ut.' },
  { id: 3, title: 'Ferdig', text: 'Bra jobbet. Nå er teksten ferdig.' },
]

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
  const [savedAt, setSavedAt] = useState(null)
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('sarepta-voice') || '')
  const [speechStatus, setSpeechStatus] = useState('Klar')

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
  }, [selectedVoice])

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('sarepta-pages', JSON.stringify(pages))
      setSavedAt(new Date())
    }, 350)
    return () => clearTimeout(timer)
  }, [pages])

  useEffect(() => {
    const onKey = (event) => {
      if (mode !== 'student') return

      if (['ArrowRight', ' '].includes(event.key)) {
        event.preventDefault()
        setActive(i => Math.min(i + 1, pages.length - 1))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActive(i => Math.max(i - 1, 0))
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        const page = pages[active]
        speechService.speak(`${page.title}. ${page.text}`, selectedVoice)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, pages, active, selectedVoice])

  const current = pages[active] || pages[0]

  const updatePage = (index, field, value) => {
    setPages(prev => prev.map((page, i) => i === index ? { ...page, [field]: value } : page))
  }

  const addPage = () => {
    setPages(prev => [...prev, { id: Date.now(), title: 'Ny side', text: 'Skriv tekst her.' }])
  }

  const readCurrentPage = async () => {
    setSpeechStatus('Starter tale…')
    await speechService.speak(
      `${current.title}. ${current.text}`,
      selectedVoice,
      {
        onStart: voice => setSpeechStatus(`Leser opp med ${voice?.name || 'standardstemme'}`),
        onEnd: () => setSpeechStatus('Ferdig'),
        onError: error => setSpeechStatus(`Feil: ${error}`)
      }
    )
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
                <select value={selectedVoice} onChange={event => setSelectedVoice(event.target.value)}>
                  <option value="">Automatisk norsk stemme</option>
                  {voices.map(voice => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
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
              <button onClick={readCurrentPage}>🔊 Les opp</button>
              <button onClick={() => { speechService.stop(); setSpeechStatus('Stoppet') }}>Stopp tale</button>
              <button onClick={() => setMode('student')}>Åpne elevvisning</button>
            </div>

            <div className="note">
              Prototypen bruker nettleser-/operativsystembasert talesyntese. Talestøtten er lagt bak et eget SpeechService-grensesnitt, slik at en annen TTS-leverandør kan kobles inn senere uten å bygge om resten av applikasjonen.
            </div>
          </section>
        </section>
      ) : (
        <section className="student" aria-label="Elevmodus">
          <div className="progress" aria-label={`Side ${active + 1} av ${pages.length}`}>{active + 1} / {pages.length}</div>

          <article className="studentCard" tabIndex="0">
            <h2>{current.title}</h2>
            <p>{current.text}</p>
          </article>

          <div className="studentActions">
            <button disabled={active === 0} onClick={() => setActive(i => Math.max(i - 1, 0))}>← Forrige</button>
            <button onClick={readCurrentPage}>🔊 Les opp</button>
            <button disabled={active === pages.length - 1} onClick={() => setActive(i => Math.min(i + 1, pages.length - 1))}>Neste →</button>
          </div>

          <div className="studentVoice">
            Tale: {voices.find(v => v.voiceURI === selectedVoice)?.name || 'automatisk norsk stemme'}
          </div>

          <div className="switchHelp">
            Brytersimulering: <kbd>←</kbd> forrige · <kbd>→</kbd> eller <kbd>mellomrom</kbd> neste · <kbd>T</kbd> les opp
          </div>

          <button className="backBtn" onClick={() => setMode('adult')}>Tilbake til voksenmodus</button>
        </section>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
