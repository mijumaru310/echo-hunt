import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ゲーム画面を追加
import GameScreen from './components/GameScreen.tsx'

// URLから表示するページを判断
const params: URLSearchParams =
  new URLSearchParams(window.location.search)

const isGamePage: boolean = params.get('page') === 'game'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isGamePage ? (
      <GameScreen />
    ) : (
      <>
        <nav>
          <a href="?page=game">ゲーム画面へ</a>
        </nav>

        <App />
      </>
    )}
  </StrictMode>,
)