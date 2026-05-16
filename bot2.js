const { spawn } = require('child_process')

// 🔥 Start Bot 1
const bot1 = spawn('node', ['bot1.js'], {
  stdio: 'inherit'
})

// 🔥 Start Bot 2
const bot2 = spawn('node', ['bot2.js'], {
  stdio: 'inherit'
})

// 🧠 If Bot 1 crashes → restart it
bot1.on('close', (code) => {
  console.log(`Bot1 exited with code ${code}, restarting...`)
  setTimeout(() => {
    spawn('node', ['bot1.js'], { stdio: 'inherit' })
  }, 3000)
})

// 🧠 If Bot 2 crashes → restart it
bot2.on('close', (code) => {
  console.log(`Bot2 exited with code ${code}, restarting...`)
  setTimeout(() => {
    spawn('node', ['bot2.js'], { stdio: 'inherit' })
  }, 3000)
})

// 💀 Safety logs
process.on('uncaughtException', (err) => {
  console.log("CRASH:", err)
})

process.on('unhandledRejection', (err) => {
  console.log("PROMISE ERROR:", err)
})
