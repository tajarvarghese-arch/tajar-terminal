import { useState } from 'react'
import { useAppStore } from './stores/appStore'
import HomeScreen from './components/HomeScreen'
import LessonScreen from './components/LessonScreen'
import ProgressScreen from './components/ProgressScreen'
import LessonDetailScreen from './components/LessonDetailScreen'
import CommandCenter from './components/CommandCenter'

export default function App() {
  const [surface, setSurface] = useState('command')
  const screen = useAppStore(s => s.screen)

  if (surface === 'command') {
    return <CommandCenter onOpenHogan={() => setSurface('coach')} />
  }

  return (
    <div className="app-container">
      <button className="coach-return" onClick={() => setSurface('command')}>← Tajar OS</button>
      {screen === 'home' && <HomeScreen />}
      {screen === 'lesson-detail' && <LessonDetailScreen />}
      {screen === 'lesson' && <LessonScreen />}
      {screen === 'progress' && <ProgressScreen />}
    </div>
  )
}
