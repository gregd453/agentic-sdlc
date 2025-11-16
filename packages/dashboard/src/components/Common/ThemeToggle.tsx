import { useTheme } from '../../contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      aria-label="Toggle theme"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        // Sun icon (for dark mode)
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.293 1.293a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm2.828 2.828a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm1.414 5.414a1 1 0 110-2h1a1 1 0 110 2h-1zm0 3.586a1 1 0 110 2h1a1 1 0 110-2h-1zm-1.414 2.828a1 1 0 111.414-1.414l.707.707a1 1 0 11-1.414 1.414l-.707-.707zm-2.828 1.414a1 1 0 111.414-1.414l.707.707a1 1 0 11-1.414 1.414l-.707-.707zM13 13a1 1 0 110-2h1a1 1 0 110 2h-1zm-3 0a1 1 0 110-2h1a1 1 0 110 2h-1zm-3 0a1 1 0 110-2h1a1 1 0 110 2h-1zm9-5a1 1 0 110-2h1a1 1 0 110 2h-1zm0-3.586a1 1 0 110-2h1a1 1 0 110 2h-1zm-9 9a1 1 0 110-2h1a1 1 0 110 2h-1zm0 3.586a1 1 0 110-2h1a1 1 0 110 2h-1zm-1.414-8.828a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm0-2.828a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 18a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      ) : (
        // Moon icon (for light mode)
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  )
}
