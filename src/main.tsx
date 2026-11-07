import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ゲーム画面を追加
import GameApp from './components/GameApp.tsx'

// URLから表示するページを判断
const params: URLSearchParams =
  new URLSearchParams(window.location.search)

const isGamePage: boolean = params.get('page') !== 'audio'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isGamePage ? (
      <GameApp />
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
