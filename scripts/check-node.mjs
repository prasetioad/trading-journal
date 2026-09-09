// Preflight: Vite 8 / rolldown need Node 20.19+. The machine default here is
// Node 16, so fail loudly with the fix instead of a cryptic `styleText` error.
const [major, minor] = process.versions.node.split('.').map(Number)
const ok = major > 20 || (major === 20 && minor >= 19)

if (!ok) {
  const msg = `
\x1b[31m✖ Node ${process.versions.node} terlalu lama untuk project ini.\x1b[0m

  Butuh Node >= 20.19. Kamu sudah punya versinya (lihat \`nvm ls\`), tinggal aktifkan:

    \x1b[36mnvm use\x1b[0m            # membaca .nvmrc -> Node 20
    npm run dev

  Kalau belum ada:  \x1b[36mnvm install 20\x1b[0m
`
  console.error(msg)
  process.exit(1)
}
