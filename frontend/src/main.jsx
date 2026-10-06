import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { speechService } from './speechService'
import './styles.css'

const defaultPages = [
  { id: 1, title: 'Hei!', text: 'I dag skal vi lese en liten tekst sammen.' },
  { id: 2, title: 'En tur ut', text: 'Solen skinner. Vi tar på sko og går ut. Vi finner en rød ball.' },
  { id: 3, title: 'Ferdig', text: 'Bra jobbet. Nå er teksten ferdig.' },
]

const defaultPicturePages = [
  {
    id: 1,
    title: 'Bella i parken',
    description: 'Dette er Bella. Bella går i parken. Bella finner en rød ball.',
    mediaType: 'image',
    mediaUrl: '',
    altText: 'Eksempelbilde for bildebok'
  }
]

function splitSentences(text) {
  const cleaned = (text || '').trim()
  if (!cleaned) return []
  const matches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
  return (matches || [cleaned]).map(sentence => sentence.trim()).filter(Boolean)
}

function loadLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}

function App() {
  const [mode, setMode] = useState('adult')
  const [contentType, setContentType] = useState('text')
  const [pages, setPages] = useState(() => loadLocal('sarepta-pages', defaultPages))
  const [picturePages, setPicturePages] = useState(() => loadLocal('sarepta-picture-pages', defaultPicturePages))
  const [active, setActive] = useState(0)
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const [savedAt, setSavedAt] = useState(null)
  const [mediaMessage, setMediaMessage] = useState('')
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('sarepta-voice') || '')
  const [speechRate, setSpeechRate] = useState(() => Number(localStorage.getItem('sarepta-rate')) || 0.95)
  const [screenReaderMode, setScreenReaderMode] = useState(() => localStorage.getItem('sarepta-screen-reader') === 'true')
  const [speechStatus, setSpeechStatus] = useState('Klar')

  const collection = contentType === 'text' ? pages : picturePages
  const current = collection[active] || collection[0]
  const currentText = contentType === 'text' ? current?.text : current?.description
  const sentences = useMemo(() => splitSentences(currentText), [currentText])
  const currentSentence = sentences[sentenceIndex] || currentText || ''

  useEffect(() => {
    setActive(0)
    setSentenceIndex(0)
    speechService.stop()
  }, [contentType])

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
      localStorage.setItem('sarepta-picture-pages', JSON.stringify(picturePages))
      setSavedAt(new Date())
    }, 350)
    return () => clearTimeout(timer)
  }, [pages, picturePages])

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

  const readCurrentPage = () => {
    const body = contentType === 'text' ? current.text : current.description
    speakText(`${current.title}. ${body}`)
  }

  const readCurrentSentence = () => speakText(currentSentence)
  const testSpeechRate = () => speakText(`Dette er en test av talehastighet ${speechRate.toFixed(2)} ganger.`)

  const nextSentence = () => {
    if (sentenceIndex < sentences.length - 1) {
      setSentenceIndex(index => index + 1)
    } else if (active < collection.length - 1) {
      setActive(index => index + 1)
      setSentenceIndex(0)
    }
  }

  const previousSentence = () => {
    if (sentenceIndex > 0) {
      setSentenceIndex(index => index - 1)
    } else if (active > 0) {
      const previousPage = collection[active - 1]
      const text = contentType === 'text' ? previousPage.text : previousPage.description
      setActive(index => index - 1)
      setSentenceIndex(Math.max(0, splitSentences(text).length - 1))
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
  }, [mode, active, sentenceIndex, sentences.length, currentSentence, selectedVoice, speechRate, screenReaderMode, contentType])

  const updateTextPage = (index, field, value) => {
    setPages(prev => prev.map((page, i) => i === index ? { ...page, [field]: value } : page))
  }

  const updatePicturePage = (index, field, value) => {
    setPicturePages(prev => prev.map((page, i) => i === index ? { ...page, [field]: value } : page))
  }

  const addTextPage = () => {
    setPages(prev => [...prev, { id: Date.now(), title: 'Ny side', text: 'Skriv tekst her.' }])
  }

  const addPicturePage = () => {
    setPicturePages(prev => [...prev, {
      id: Date.now(),
      title: 'Ny bildebokside',
      description: 'Skriv en kort beskrivelse. Legg gjerne inn flere setninger.',
      mediaType: 'image',
      mediaUrl: '',
      altText: ''
    }])
    setActive(picturePages.length)
  }

  const handleMediaUpload = event => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 3 * 1024 * 1024) {
      setMediaMessage('Filen er over 3 MB. Velg en mindre fil i prototypen.')
      event.target.value = ''
      return
    }

    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')

    if (!isVideo && !isImage) {
      setMediaMessage('Velg et bilde eller et kort videoklipp.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      updatePicturePage(active, 'mediaUrl', reader.result)
      updatePicturePage(active, 'mediaType', isVideo ? 'video' : 'image')
      setMediaMessage(`${isVideo ? 'Video' : 'Bilde'} lagt til i prototypen.`)
    }
    reader.onerror = () => setMediaMessage('Kunne ikke lese filen.')
    reader.readAsDataURL(file)
  }

  const currentLabel = contentType === 'text' ? 'Tekst' : 'Billedbok'

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

      <nav className="contentTabs" aria-label="Velg innholdstype">
        <button className={contentType === 'text' ? 'active' : ''} onClick={() => setContentType('text')}>Tekst</button>
        <button className={contentType === 'picturebook' ? 'active' : ''} onClick={() => setContentType('picturebook')}>Billedbok</button>
      </nav>

      {mode === 'adult' ? (
        <section className="layout">
          <aside className="sidebar" aria-label={currentLabel}>
            <div className="sideTitle">{currentLabel}</div>

            {collection.map((page, i) => (
              <button key={page.id} className={active === i ? 'pageBtn selected' : 'pageBtn'} onClick={() => setActive(i)}>
                <span>{i + 1}</span>
                {page.title}
              </button>
            ))}

            {contentType === 'text'
              ? <button className="addBtn" onClick={addTextPage}>+ Ny tekstside</button>
              : <button className="addBtn" onClick={addPicturePage}>+ Ny bildebokside</button>}
          </aside>

          <section className="editor">
            <div className="sectionHeader">
              <div>
                <div className="eyebrow">{currentLabel}</div>
                <h2>{contentType === 'text' ? 'Rediger innhold' : 'Rediger bildebokside'}</h2>
              </div>
              <div className="saveState" aria-live="polite">
                {savedAt ? `Lagret ${savedAt.toLocaleTimeString('no-NO', {hour:'2-digit', minute:'2-digit'})}` : 'Lagrer…'}
              </div>
            </div>

            {contentType === 'text' ? (
              <>
                <label>
                  Tittel
                  <input value={current.title} onChange={event => updateTextPage(active, 'title', event.target.value)} />
                </label>

                <label>
                  Tekst
                  <textarea rows="8" value={current.text} onChange={event => updateTextPage(active, 'text', event.target.value)} />
                </label>
              </>
            ) : (
              <>
                <label>
                  Tittel
                  <input value={current.title} onChange={event => updatePicturePage(active, 'title', event.target.value)} />
                </label>

                <div className="mediaEditor">
                  <div className="mediaPreview" aria-label="Forhåndsvisning av media">
                    {current.mediaUrl ? (
                      current.mediaType === 'video'
                        ? <video src={current.mediaUrl} controls preload="metadata" />
                        : <img src={current.mediaUrl} alt={current.altText || ''} />
                    ) : (
                      <div className="mediaPlaceholder">
                        <span aria-hidden="true">▧</span>
                        <strong>Ingen media lagt til</strong>
                        <small>Last opp et bilde eller kort videoklipp.</small>
                      </div>
                    )}
                  </div>

                  <label className="fileLabel">
                    Bilde eller kort video
                    <input type="file" accept="image/*,video/*" onChange={handleMediaUpload} />
                  </label>

                  <div className="mediaMessage" aria-live="polite">{mediaMessage}</div>
                </div>

                <label>
                  Alternativ tekst for bildet
                  <input
                    value={current.altText || ''}
                    onChange={event => updatePicturePage(active, 'altText', event.target.value)}
                    placeholder="Kort beskrivelse av bildet for skjermleser"
                  />
                </label>

                <label>
                  Tekst og beskrivelse
                  <textarea
                    rows="7"
                    value={current.description}
                    onChange={event => updatePicturePage(active, 'description', event.target.value)}
                    placeholder="Skriv teksten eleven skal kunne navigere gjennom setning for setning."
                  />
                </label>
              </>
            )}

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
              {contentType === 'picturebook'
                ? 'Billedbok-prototypen viser opplasting av bilde/kort video, tilhørende tekst og setningsvis navigasjon. Media lagres kun lokalt i nettleseren i denne demonstrasjonen.'
                : 'Prototypen bruker nettleser-/operativsystembasert talesyntese bak et eget SpeechService-grensesnitt. Skjermlesermodus kan slå av innebygd tale.'}
            </div>
          </section>
        </section>
      ) : (
        <section className="student" aria-label="Elevmodus">
          <div className="studentType">{currentLabel}</div>
          <div className="progress" aria-label={`Side ${active + 1} av ${collection.length}, setning ${sentenceIndex + 1} av ${Math.max(1, sentences.length)}`}>
            Side {active + 1}/{collection.length} · Setning {sentenceIndex + 1}/{Math.max(1, sentences.length)}
          </div>

          <article className="studentCard" tabIndex="0" aria-live="polite">
            {contentType === 'picturebook' && (
              <div className="studentMedia">
                {current.mediaUrl ? (
                  current.mediaType === 'video'
                    ? <video src={current.mediaUrl} controls preload="metadata" aria-label={current.altText || current.title} />
                    : <img src={current.mediaUrl} alt={current.altText || ''} />
                ) : (
                  <div className="mediaPlaceholder compact">
                    <span aria-hidden="true">▧</span>
                    <strong>Media ikke lagt til ennå</strong>
                  </div>
                )}
              </div>
            )}

            <h2>{current.title}</h2>
            <p className="sentenceFocus">{currentSentence}</p>
          </article>

          <div className="studentActions">
            <button disabled={active === 0 && sentenceIndex === 0} onClick={previousSentence}>← Forrige setning</button>
            <button onClick={readCurrentSentence} disabled={screenReaderMode}>🔊 Les setningen</button>
            <button disabled={active === collection.length - 1 && sentenceIndex >= sentences.length - 1} onClick={nextSentence}>Neste setning →</button>
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
