const calculateTime = (m: number) => (n: number) => Math.round(n * m)

export const toMS = {
  hours: calculateTime(36e5),
  minutes: calculateTime(6e4),
  seconds: calculateTime(1e3),
}
