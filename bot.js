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
    username: 'HunterBot'
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

  bot.once('spawn', () => {

    console.log("Hunter Bot Started")

    mcData = minecraftData(bot.version)

    defaultMove = new Movements(bot, mcData)

    // FAST MOVEMENT SETTINGS
    defaultMove.allow1by1towers = true
    defaultMove.canDig = true
    defaultMove.allowParkour = true
    defaultMove.allowSprinting = true
    defaultMove.maxDropDown = 4

    // IMPORTANT
    defaultMove.placeCost = 2
    defaultMove.digCost = 1

    bot.pathfinder.setMovements(defaultMove)

    // AUTO EAT
    bot.autoEat.options = {
      priority: 'foodPoints',
      startAt: 10,
      bannedFood: []
    }

    console.log("Bot Ready")
  })

  // MAIN AI LOOP
  bot.on('physicsTick', async () => {

    try {

      const target = bot.players["leo4200"]

      if (!target || !target.entity) {
        bot.pvp.stop()
        return
      }

      const distance = bot.entity.position.distanceTo(target.entity.position)

      // UPDATE PATH ONLY EVERY 0.5 SEC
      if (Date.now() - lastGoal > 500) {

        const goal = new goals.GoalNear(
          target.entity.position.x,
          target.entity.position.y,
          target.entity.position.z,
          1
        )

        bot.pathfinder.setGoal(goal, true)

        lastGoal = Date.now()
      }

      // LOOK AT PLAYER
      bot.lookAt(
        target.entity.position.offset(0, 1.5, 0),
        true
      )

      // AUTO SPRINT
      bot.setControlState('sprint', true)

      // JUMP WHEN TARGET HIGHER
      async function towerUp() {

  try {

    // prevent spam
    if (bot.entity.velocity.y > 0.1) return

    // find blocks
    const blockItem = bot.inventory.items().find(item =>
      item.name.includes('cobblestone') ||
      item.name.includes('stone') ||
      item.name.includes('dirt') ||
      item.name.includes('planks')
    )

    if (!blockItem) return

    await bot.equip(blockItem, 'hand')

    // block below bot
    const below = bot.blockAt(
      bot.entity.position.offset(0, -1, 0)
    )

    if (!below) return

    // LOOK STRAIGHT DOWN
    await bot.look(Math.PI / 2, 0)

    // JUMP
    bot.setControlState('jump', true)

    // PERFECT TIMING
    setTimeout(async () => {

      try {

        await bot.placeBlock(
          below,
          new Vec3(0, 1, 0)
        )

      } catch {}

    }, 180)

    // stop jump
    setTimeout(() => {
      bot.setControlState('jump', false)
    }, 300)

  } catch (err) {}
}
      // ATTACK
      if (distance <= 3.5 && !attacking) {

        attacking = true

        const weapon =
          bot.inventory.items().find(i => i.name.includes('netherite_sword')) ||
          bot.inventory.items().find(i => i.name.includes('diamond_sword')) ||
          bot.inventory.items().find(i => i.name.includes('iron_sword')) ||
          bot.inventory.items().find(i => i.name.includes('axe'))

        if (weapon) {
          await bot.equip(weapon, 'hand')
        }

        // CRITS
        if (bot.entity.onGround) {
          bot.setControlState('jump', true)

          setTimeout(() => {
            bot.setControlState('jump', false)
          }, 120)
        }

        bot.pvp.attack(target.entity)

        setTimeout(() => {
          attacking = false
        }, 350)
      }

      // BREAK BLOCKS
      if (!digging) {
        await breakBlocks(target.entity)
      }

      // BRIDGE
      if (!bridging) {
        await bridgeForward(target.entity)
      }

    } catch (err) {
      console.log("AI Error:", err.message)
    }
  })

  // FAST BRIDGE
  async function bridgeForward(target) {

    try {

      bridging = true

      const dir = target.position.minus(bot.entity.position)

      const dx = Math.sign(dir.x)
      const dz = Math.sign(dir.z)

      const front = bot.entity.position.floored().offset(dx, -1, dz)

      const block = bot.blockAt(front)

      if (!block || block.name === 'air') {

        const placeBlock =
          bot.inventory.items().find(i =>
            i.name.includes('cobblestone') ||
            i.name.includes('dirt') ||
            i.name.includes('stone')
          )

        if (!placeBlock) {
          bridging = false
          return
        }

        await bot.equip(placeBlock, 'hand')

        const ref = bot.blockAt(front.offset(0, -1, 0))

        if (!ref) {
          bridging = false
          return
        }

        bot.setControlState('sneak', true)

        await bot.lookAt(front.offset(0.5, 0, 0.5))

        await bot.placeBlock(ref, new Vec3(0, 1, 0))

        bot.setControlState('sneak', false)
      }

      bridging = false

    } catch (err) {

      bridging = false
    }
  }

  // SMART BLOCK BREAK
  async function breakBlocks(target) {

    try {

      digging = true

      const dir = target.position.minus(bot.entity.position)

      const checkPos = bot.entity.position.floored().offset(
        Math.sign(dir.x),
        1,
        Math.sign(dir.z)
      )

      const block = bot.blockAt(checkPos)

      if (
        block &&
        block.name !== 'air' &&
        !block.name.includes('bedrock') &&
        !block.name.includes('obsidian')
      ) {

        const tool = bot.pathfinder.bestHarvestTool(block)

        if (tool) {
          await bot.equip(tool, 'hand')
        }

        if (bot.canDigBlock(block)) {
          await bot.dig(block)
        }
      }

      digging = false

    } catch (err) {

      digging = false
    }
  }

  bot.on('death', () => {
    console.log("Bot died")
  })

  bot.on('kicked', console.log)

  bot.on('error', console.log)

  bot.on('end', () => {

    console.log("Reconnecting...")

    setTimeout(createBot, 3000)
  })
}

createBot()