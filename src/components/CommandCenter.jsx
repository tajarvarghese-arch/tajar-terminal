import { useEffect, useMemo, useState } from 'react'
import '../styles/command-center.css'

const weekDays = [
  { short: 'MON', day: '20', label: 'Monday, July 20' },
  { short: 'TUE', day: '21', label: 'Tuesday, July 21' },
  { short: 'WED', day: '22', label: 'Wednesday, July 22' },
  { short: 'THU', day: '23', label: 'Thursday, July 23' },
  { short: 'FRI', day: '24', label: 'Friday, July 24' },
  { short: 'SAT', day: '25', label: 'Saturday, July 25' },
  { short: 'SUN', day: '26', label: 'Sunday, July 26' },
]

const schedule = {
  0: [
    { time: '7:00', period: 'AM', title: 'Greenwich Central Men’s Meeting', type: 'community' },
    { time: '10:00', period: 'AM', title: 'Meeting with Philippa', type: 'work' },
    { time: '4:30', period: 'PM', title: 'Tennis with Anna', type: 'personal' },
  ],
  1: [
    { time: '10:15', period: 'AM', title: 'Piano lesson', note: 'Protect 15 minutes before for warm-up.', type: 'craft' },
  ],
  2: [
    { time: '7:00', period: 'AM', title: 'GMG meeting', type: 'community' },
    { time: '7:00', period: 'AM', title: 'Sight-read Mazurka ×2', note: 'Overlaps with GMG — move this practice block.', type: 'conflict' },
    { time: '8:00', period: 'AM', title: 'Encon maintenance', type: 'work' },
    { time: '2:30', period: 'PM', title: 'QSBS / Elova', note: 'Threshold gut-check with Citrin Cooperman.', type: 'priority' },
  ],
  3: [{ time: '7:00', period: 'AM', title: 'Sight-read Mazurka ×2', type: 'craft' }],
  4: [{ time: '7:00', period: 'AM', title: 'Sight-read Mazurka ×2', type: 'craft' }],
  5: [
    { time: '7:00', period: 'AM', title: 'Sight-read Mazurka ×2', type: 'craft' },
    { time: '2:00', period: 'PM', title: 'The Odyssey — IMAX', note: 'AMC Port Chester 14', type: 'personal' },
  ],
  6: [{ time: '7:00', period: 'AM', title: 'Sight-read Mazurka ×2', type: 'craft' }],
}

const initialTasks = [
  { id: 1, title: 'Write the three Elova threshold questions', meta: 'QSBS / WED', priority: true, done: false },
  { id: 2, title: 'Review the latest Field PULSE and VCAS signals', meta: 'FIELD MEDICAL / THU', priority: true, done: false },
  { id: 3, title: 'Confirm the post-maintenance Encon follow-up', meta: 'OPERATIONS / WED', priority: false, done: false },
  { id: 4, title: 'Complete three 10-minute Hogan sessions', meta: 'CRAFT / 0 OF 3', priority: false, done: false },
  { id: 5, title: 'Sight-read Mazurka twice before each workday', meta: 'PIANO / DAILY', priority: false, done: true },
]

const projects = [
  {
    name: 'Elova',
    eyebrow: 'STRUCTURE',
    description: 'Pressure-test the Section 1045 path before committing to a full engagement.',
    progress: 64,
    next: 'Wednesday advisory call',
    tone: 'amber',
  },
  {
    name: 'Field Medical',
    eyebrow: 'PORTFOLIO',
    description: 'Track clinical proof, leadership signals, and the expanding PFA market.',
    progress: 78,
    next: 'Review July VCAS coverage',
    tone: 'sage',
  },
  {
    name: 'Hogan Coach',
    eyebrow: 'BUILD',
    description: 'Turn Ben Hogan’s fundamentals into a repeatable ten-minute practice system.',
    progress: 42,
    next: 'Three sessions this week',
    tone: 'blue',
  },
]

const news = [
  {
    source: 'FIELD MEDICAL',
    date: 'JUL 11',
    title: 'Independent review calls the VCAS study a defining PFA clinical readout',
    context: 'Direct portfolio signal',
    url: 'https://www.fieldmedicalinc.com/news',
  },
  {
    source: 'PFA MARKET',
    date: 'APR 25',
    title: 'First-line PFA outperformed antiarrhythmic drugs in persistent AF at one year',
    context: 'Category tailwind · 56.0% vs 30.1%',
    url: 'https://newsroom.clevelandclinic.org/2026/04/25/cleveland-clinic-led-trial-shows-pulsed-field-ablation-procedure-more-effective-than-medications-for-persistent-atrial-fibrillation',
  },
  {
    source: 'STRUCTURE WATCH',
    date: '2025 RULES',
    title: 'Section 1045 still centers on a 60-day reinvestment window for eligible QSB stock gains',
    context: 'Decision context · verify with counsel',
    url: 'https://www.irs.gov/instructions/i1065sd',
  },
]

const searchItems = [
  ...initialTasks.map((item) => ({ kind: 'TASK', title: item.title, detail: item.meta, target: 'tasks' })),
  ...projects.map((item) => ({ kind: 'PROJECT', title: item.name, detail: item.next, target: 'projects' })),
  ...news.map((item) => ({ kind: 'SIGNAL', title: item.title, detail: item.source, url: item.url })),
]

function loadTasks() {
  try {
    const saved = localStorage.getItem('tajar-os-tasks')
    return saved ? JSON.parse(saved) : initialTasks
  } catch {
    return initialTasks
  }
}

export default function CommandCenter({ onOpenHogan }) {
  const [selectedDay, setSelectedDay] = useState(1)
  const [tasks, setTasks] = useState(loadTasks)
  const [taskView, setTaskView] = useState('open')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('tajar-os-tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    const handleKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const visibleTasks = useMemo(() => {
    if (taskView === 'done') return tasks.filter((task) => task.done)
    if (taskView === 'all') return tasks
    return tasks.filter((task) => !task.done)
  }, [taskView, tasks])

  const filteredSearch = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return searchItems.slice(0, 6)
    return searchItems.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(normalized)).slice(0, 8)
  }, [query])

  const completed = tasks.filter((task) => task.done).length
  const weekProgress = Math.round((completed / tasks.length) * 100)

  const toggleTask = (id) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task))
  }

  const navigate = (target) => {
    setMobileNavOpen(false)
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const selectSearchItem = (item) => {
    setSearchOpen(false)
    setQuery('')
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    } else {
      navigate(item.target)
    }
  }

  return (
    <div className="command-shell">
      <button className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation">
        <span />
        <span />
      </button>

      <aside className={`command-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <button className="brand-mark" onClick={() => navigate('today')} aria-label="Back to today">
          <span className="brand-orbit" />
          <span className="brand-core">T</span>
        </button>

        <nav className="side-nav" aria-label="Dashboard sections">
          <button className="active" onClick={() => navigate('today')}><span>01</span> Today</button>
          <button onClick={() => navigate('schedule')}><span>02</span> Schedule</button>
          <button onClick={() => navigate('tasks')}><span>03</span> Tasks</button>
          <button onClick={() => navigate('projects')}><span>04</span> Projects</button>
          <button onClick={() => navigate('signals')}><span>05</span> Signals</button>
        </nav>

        <div className="side-bottom">
          <button className="search-shortcut" onClick={() => setSearchOpen(true)}>
            <span>Search</span><kbd>⌘ K</kbd>
          </button>
          <button className="profile-chip" onClick={onOpenHogan}>
            <span className="profile-avatar">TV</span>
            <span><strong>Tajar</strong><small>Open Hogan Coach</small></span>
            <i>↗</i>
          </button>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="command-main">
        <header className="command-header" id="today">
          <div>
            <p className="eyebrow">PERSONAL COMMAND CENTER · WEEK 30</p>
            <h1>Good morning, Tajar.</h1>
            <p className="header-subtitle">A quiet day today. Use the space before Wednesday’s decisions.</p>
          </div>
          <div className="header-meta">
            <div><span>TUE</span><strong>21</strong></div>
            <p>JULY 2026<br /><span>GREENWICH · EDT</span></p>
          </div>
        </header>

        <section className="focus-strip" aria-label="Today's focus">
          <div className="focus-number">01</div>
          <div className="focus-copy">
            <p className="eyebrow">TODAY’S MOVE</p>
            <h2>Define what would make Elova worth doing.</h2>
            <p>Go into Wednesday’s QSBS call with three concrete thresholds—not a broad list of questions.</p>
          </div>
          <div className="focus-action">
            <span>60 min</span>
            <button onClick={() => navigate('tasks')}>Open priority <i>↘</i></button>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="panel schedule-panel" id="schedule">
            <div className="panel-heading">
              <div><p className="eyebrow">CALENDAR</p><h2>This week</h2></div>
              <span className="sync-state"><i /> Synced Jul 21</span>
            </div>

            <div className="week-selector" role="tablist" aria-label="Select day">
              {weekDays.map((day, index) => (
                <button
                  key={day.day}
                  className={selectedDay === index ? 'active' : ''}
                  onClick={() => setSelectedDay(index)}
                  role="tab"
                  aria-selected={selectedDay === index}
                >
                  <span>{day.short}</span>
                  <strong>{day.day}</strong>
                  {schedule[index].length > 1 && <i />}
                </button>
              ))}
            </div>

            <div className="day-heading">
              <p>{weekDays[selectedDay].label}</p>
              <span>{schedule[selectedDay].length} {schedule[selectedDay].length === 1 ? 'commitment' : 'commitments'}</span>
            </div>

            <div className="agenda-list">
              {schedule[selectedDay].map((event, index) => (
                <article className={`agenda-item ${event.type}`} key={`${event.time}-${event.title}`}>
                  <div className="agenda-time"><strong>{event.time}</strong><span>{event.period}</span></div>
                  <div className="agenda-rule"><i /></div>
                  <div className="agenda-copy">
                    <h3>{event.title}</h3>
                    {event.note && <p>{event.note}</p>}
                  </div>
                  {event.type === 'conflict' && <span className="conflict-badge">CONFLICT</span>}
                </article>
              ))}
            </div>
          </section>

          <section className="panel week-panel" aria-label="Week at a glance">
            <div className="panel-heading compact">
              <div><p className="eyebrow">WEEK AT A GLANCE</p><h2>Momentum</h2></div>
            </div>
            <div className="week-score">
              <div className="score-ring" style={{ '--score': `${weekProgress * 3.6}deg` }}>
                <span>{weekProgress}%</span>
              </div>
              <div><strong>{completed} of {tasks.length}</strong><p>key actions complete</p></div>
            </div>
            <dl className="week-stats">
              <div><dt>Deep work</dt><dd>2 blocks</dd></div>
              <div><dt>Decision calls</dt><dd>1</dd></div>
              <div><dt>Craft practice</dt><dd>5 days</dd></div>
            </dl>
            <p className="week-note"><span>NOTE</span> Wednesday 7:00 AM is double-booked. Move Mazurka practice to 8:45 AM.</p>
          </section>

          <section className="panel tasks-panel" id="tasks">
            <div className="panel-heading">
              <div><p className="eyebrow">EXECUTION</p><h2>Key things this week</h2></div>
              <div className="segmented-control">
                {['open', 'all', 'done'].map((view) => (
                  <button key={view} className={taskView === view ? 'active' : ''} onClick={() => setTaskView(view)}>{view}</button>
                ))}
              </div>
            </div>
            <div className="task-list">
              {visibleTasks.map((task) => (
                <button className={`task-row ${task.done ? 'done' : ''}`} key={task.id} onClick={() => toggleTask(task.id)}>
                  <span className="task-check">{task.done && '✓'}</span>
                  <span className="task-content"><strong>{task.title}</strong><small>{task.meta}</small></span>
                  {task.priority && <span className="priority-chip">PRIORITY</span>}
                  <i>↗</i>
                </button>
              ))}
              {visibleTasks.length === 0 && <p className="empty-state">Nothing here. The board is clear.</p>}
            </div>
          </section>

          <section className="panel projects-panel" id="projects">
            <div className="panel-heading">
              <div><p className="eyebrow">ACTIVE WORK</p><h2>Ongoing projects</h2></div>
              <span className="panel-count">03</span>
            </div>
            <div className="project-grid">
              {projects.map((project) => (
                <article className={`project-card ${project.tone}`} key={project.name}>
                  <div className="project-top"><span>{project.eyebrow}</span><i>↗</i></div>
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                  <div className="project-progress"><span style={{ width: `${project.progress}%` }} /></div>
                  <div className="project-next"><span>NEXT</span><strong>{project.next}</strong></div>
                  {project.name === 'Hogan Coach' && <button onClick={onOpenHogan}>Open coach <span>→</span></button>}
                </article>
              ))}
            </div>
          </section>

          <section className="panel signals-panel" id="signals">
            <div className="panel-heading">
              <div><p className="eyebrow">PORTFOLIO INTELLIGENCE</p><h2>Signals worth your attention</h2></div>
              <p className="signal-note">CURATED FOR RELEVANCE<br />NOT VOLUME</p>
            </div>
            <div className="news-list">
              {news.map((item) => (
                <a href={item.url} target="_blank" rel="noreferrer" className="news-row" key={item.title}>
                  <div className="news-source"><span>{item.source}</span><small>{item.date}</small></div>
                  <div className="news-copy"><h3>{item.title}</h3><p>{item.context}</p></div>
                  <i>↗</i>
                </a>
              ))}
            </div>
          </section>
        </div>

        <footer className="command-footer">
          <p>TAJAR OS <span>·</span> PERSONAL SIGNAL, WITHOUT THE NOISE</p>
          <button onClick={() => setSearchOpen(true)}>Find anything <kbd>⌘ K</kbd></button>
        </footer>
      </main>

      {searchOpen && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search dashboard" onMouseDown={() => setSearchOpen(false)}>
          <div className="search-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-input-row">
              <span>⌕</span>
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, projects, and signals…" />
              <kbd>ESC</kbd>
            </div>
            <div className="search-results">
              <p className="eyebrow">{query ? 'RESULTS' : 'QUICK ACCESS'}</p>
              {filteredSearch.map((item) => (
                <button key={`${item.kind}-${item.title}`} onClick={() => selectSearchItem(item)}>
                  <span>{item.kind}</span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                  <i>↗</i>
                </button>
              ))}
              {filteredSearch.length === 0 && <p className="empty-state">No matches found.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
