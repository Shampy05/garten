export function randomColor() {
  const hue = Math.floor(Math.random() * 360)
  const sat = 60 + Math.floor(Math.random() * 20)
  const lig = 55 + Math.floor(Math.random() * 15)
  return `hsl(${hue}, ${sat}%, ${lig}%)`
}
