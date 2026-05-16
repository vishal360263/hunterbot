const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const autoeat = require('mineflayer-auto-eat').plugin
const minecraftData = require('minecraft-data')
const Vec3 = require('vec3')

function createBot() {

  const bot = mineflayer.createBot({
    host: 'leo4201.aternos.me',
    port: 36966,
    username: 'HunterBot2'   // 🔥 CHANGED
  })

  bot.loadPlugin(pathfinder)
  bot.loadPlugin(pvp)
  bot.loadPlugin(autoeat)

  let mcData
  let defaultMove
  let attacking = false
  let lastGoal = 0
  let bridging = false
  let digging = false
  let combatTarget = null

  // 🔥 BOT 2 = slower reaction
  const REACTION_DELAY = 400 + Math.random() * 600

  bot.once('spawn', () => {

    console.log("Hunter Bot 2 Started")

    mcData = minecraftData(bot.version)
    defaultMove = new Movements(bot, mcData)

    // 🔥 Bot 2 is more defensive/support style
    defaultMove.allowSprinting = true
    defaultMove.allowParkour = true
    defaultMove.maxDropDown = 3

    bot.pathfinder.setMovements(defaultMove)

    bot.autoEat.options = {
      priority: 'foodPoints',
      startAt: 16, // eats earlier (support role)
      offhand: true
    }
  })

  // 🔥 DIFFERENT AI LOOP
  bot.on('physicsTick', () => {

    const target = bot.players["leo4200"]
    if (!target || !target.entity) return

    const dist = bot.entity.position.distanceTo(target.entity.position)

    // 🔥 Bot 2 attacks from SIDE (flank behavior)
    const offsetPos = target.entity.position.offset(
      Math.sin(Date.now() / 500) * 2, // side movement
      0,
      Math.cos(Date.now() / 500) * 2
    )

    if (Date.now() - lastGoal > 800) {   // slower updates than Bot1

      bot.pathfinder.setGoal(
        new goals.GoalNear(
          offsetPos.x,
          offsetPos.y,
          offsetPos.z,
          2   // keeps distance, not direct rush
        )
      )

      lastGoal = Date.now()
    }

    // 🔥 Bot 2 attacks later + only if close
    if (dist <= 4 && !attacking) {

      attacking = true

      setTimeout(() => {

        const weapon =
          bot.inventory.items().find(i => i.name.includes('iron_sword')) ||
          bot.inventory.items().find(i => i.name.includes('stone_sword'))

        if (weapon) bot.equip(weapon, 'hand')

        bot.setControlState('strafeLeft', Math.random() > 0.5)
        bot.setControlState('strafeRight', Math.random() <= 0.5)

        bot.pvp.attack(target.entity)

        setTimeout(() => {
          bot.setControlState('strafeLeft', false)
          bot.setControlState('strafeRight', false)
          attacking = false
        }, 600)

      }, REACTION_DELAY)
    }

    // 🔥 LESS BRIDGING (support style only)
    if (dist > 6 && Math.random() < 0.02) {
      bridgeSupport(target.entity)
    }
  })

  // 🔥 SIMPLE SUPPORT BRIDGE (not aggressive spam)
  async function bridgeSupport(target) {
    try {
      const block = bot.inventory.items().find(i =>
        i.name.includes('cobblestone') ||
        i.name.includes('dirt')
      )

      if (!block) return

      await bot.equip(block, 'hand')

      const front = bot.blockAt(bot.entity.position.offset(0, -1, 1))
      if (!front || front.name !== 'air') return

      bot.setControlState('sneak', true)
      await bot.placeBlock(front, new Vec3(0, 1, 0))
      bot.setControlState('sneak', false)

    } catch {}
  }

  bot.on('death', () => console.log("Bot 2 died"))
  bot.on('error', console.log)
  bot.on('kicked', console.log)

  bot.on('end', () => {
    console.log("Bot 2 reconnecting...")
    setTimeout(createBot, 3000)
  })
}
createBot()

