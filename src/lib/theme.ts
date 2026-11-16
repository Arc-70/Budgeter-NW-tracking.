// Theme choice is remembered per device.
export type Theme = 'pastel-dark' | 'pastel-light'

const KEY = 'budgeter-theme'

export function getTheme(): Theme {
  return localStorage.getItem(KEY) === 'pastel-light' ? 'pastel-light' : 'pastel-dark'
}

export function applyTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  document.documentElement.dataset.theme = theme
}
