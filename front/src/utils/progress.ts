let bar: HTMLDivElement | null = null
let timer: number | undefined

const ensureBar = () => {
  if (bar) return bar
  bar = document.createElement('div')
  bar.className = 'route-progress-bar'
  document.body.appendChild(bar)
  return bar
}

export const startProgress = () => {
  const el = ensureBar()
  window.clearTimeout(timer)
  el.classList.remove('done')
  el.style.opacity = '1'
  el.style.transform = 'scaleX(0.35)'
  timer = window.setTimeout(() => {
    el.style.transform = 'scaleX(0.75)'
  }, 120)
}

export const finishProgress = () => {
  const el = ensureBar()
  window.clearTimeout(timer)
  el.style.transform = 'scaleX(1)'
  el.classList.add('done')
  timer = window.setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'scaleX(0)'
  }, 220)
}
