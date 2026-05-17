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
    username: 'parkhi'
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
  let verticalMode = false
  let lastKnownPos = null

  // 🔥 FIXED: combat system
  let combatTarget = null
  let lastDamageTime = 0

  bot.once('spawn', () => {

    console.log("Hunter Bot Started")

    mcData = minecraftData(bot.version)

    defaultMove = new Movements(bot, mcData)

    defaultMove.allow1by1towers = true
    defaultMove.canDig = true
    defaultMove.allowParkour = true
    defaultMove.allowSprinting = true
    defaultMove.maxDropDown = 4
    defaultMove.canSwim = true

    bot.pathfinder.setMovements(defaultMove)

    bot.autoEat.options = {
      priority: 'foodPoints',
      startAt: 18,
      bannedFood: [],
      offhand: true
    }

    console.log("Bot Ready")

    setTimeout(giveKit, 2000)
  })

  // 🔥 FIXED: better mob detection trigger
  bot.on('entityHurt', (entity) => {
    if (entity !== bot.entity) return

    lastDamageTime = Date.now()

    const mob = getNearestDangerMob()
    if (mob) {
      combatTarget = mob
      bot.pvp.attack(mob)
    }
  })

  // 🔥 FIXED: real hostile mob detection
  function getNearestDangerMob() {

    const hostileNames = [
      'zombie', 'skeleton', 'creeper', 'spider',
      'enderman', 'witch', 'drowned', 'husk',
      'slime', 'phantom', 'pillager'
    ]

    const mobs = Object.values(bot.entities).filter(e => {

      if (!e || !e.position) return false
      if (e === bot.entity) return false

      const name = (e.name || '').toLowerCase()

      const isHostile = hostileNames.some(m => name.includes(m))

      return isHostile &&
        e.position.distanceTo(bot.entity.position) < 16
    })

    if (mobs.length === 0) return null

    mobs.sort((a, b) =>
      a.position.distanceTo(bot.entity.position) -
      b.position.distanceTo(bot.entity.position)
    )

    return mobs[0]
  }

  bot.on('physicsTick', () => {

    try {

      // 🔥 PRIORITY: mob fight overrides player hunt
      if (combatTarget && combatTarget.isValid && combatTarget.health > 0) {

        const mobDist = bot.entity.position.distanceTo(combatTarget.position)

        if (mobDist < 16) {
          bot.pvp.attack(combatTarget)
          return
        } else {
          combatTarget = null
        }
      }

      const target = bot.players["destroyer8055"]

      // PLAYER VISIBLE
      if (target && target.entity) {

        lastKnownPos = target.entity.position.clone()

      } else {

        // FOLLOW LAST KNOWN COORDS
        if (lastKnownPos) {

          const goal = new goals.GoalNear(
            lastKnownPos.x,
            lastKnownPos.y,
            lastKnownPos.z,
            2
          )

          bot.pathfinder.setGoal(goal)
        }

        return
      }

      const distance = bot.entity.position.distanceTo(target.entity.position)
      const yDiff = target.entity.position.y - bot.entity.position.y

      // WATER CHASE
      if (bot.entity.isInWater) {

        bot.setControlState('jump', true)
        bot.setControlState('forward', true)

      } else {

        bot.setControlState('jump', false)
      }

      verticalMode = yDiff > 1.2

      if (Date.now() - lastGoal > 400) {

        let goal

        if (!verticalMode) {
          goal = new goals.GoalNear(
            target.entity.position.x,
            target.entity.position.y,
            target.entity.position.z,
            1
          )
        } else {
          goal = new goals.GoalNear(
            target.entity.position.x,
            target.entity.position.y,
            target.entity.position.z,
            2
          )
        }

        bot.pathfinder.setGoal(goal, true)
        lastGoal = Date.now()
      }

      if (distance <= 6) {
        bot.lookAt(target.entity.position.offset(0, 1.5, 0), true)
      }

      if (!verticalMode) bot.setControlState('sprint', true)
      else bot.setControlState('sprint', false)

      if (yDiff > 0.8) towerUp()

      // ATTACK PLAYER
      if (distance <= 3.5 && !attacking) {

        attacking = true

        const weapon =
          bot.inventory.items().find(i => i.name.includes('wooden_sword')) ||
          bot.inventory.items().find(i => i.name.includes('diamond_sword')) ||
          bot.inventory.items().find(i => i.name.includes('iron_sword')) ||
          bot.inventory.items().find(i => i.name.includes('axe'))

        if (weapon) bot.equip(weapon, 'hand')

        if (bot.entity.onGround) {
          bot.setControlState('jump', true)
          setTimeout(() => bot.setControlState('jump', false), 120)
        }

        bot.pvp.attack(target.entity)

        setTimeout(() => attacking = false, 500)
      }

      if (!digging) breakBlocks(target.entity)

      const frontBlock = bot.blockAt(bot.entity.position.offset(0, -1, 1))

      if ((!frontBlock || frontBlock.name === 'air') && !bridging) {
        bridgeForward(target.entity)
      }

    } catch (err) {
      console.log("AI Error:", err.message)
    }
  })

  // ===== AUTO TP SYSTEM =====

  const tpTarget = "destroyer8055"

  // Warn 1 minute before teleport
  setInterval(() => {

    const player = bot.players[tpTarget]

    if (player && player.entity) {
      bot.chat(`${tpTarget} I will teleport to you in 1 minute`)
    }

  }, 4 * 60 * 1000)

  // Teleport after 10 minutes
  setInterval(() => {

    const player = bot.players[tpTarget]

    if (player && player.entity) {
      bot.chat(`/tp parkhi ${tpTarget}`)
    }

  }, 5 * 60 * 1000)

  // 🧱 TOWER
  async function towerUp() {
    try {

      if (bot.entity.velocity.y > 0.15) return

      const blockItem = bot.inventory.items().find(item =>
        item.name.includes('cobblestone') ||
        item.name.includes('stone') ||
        item.name.includes('dirt') ||
        item.name.includes('planks')
      )

      if (!blockItem) return

      await bot.equip(blockItem, 'hand')

      const below = bot.blockAt(bot.entity.position.offset(0, -1, 0))
      if (!below) return

      bot.setControlState('sprint', false)

      await bot.look(bot.entity.yaw, 0)

      bot.setControlState('jump', true)

      setTimeout(async () => {
        try {
          await bot.placeBlock(below, new Vec3(0, 1, 0))
        } catch {}
      }, 50)

      setTimeout(() => {
        bot.setControlState('jump', false)
        bot.setControlState('sprint', true)
      }, 180)

    } catch {}
  }

  function giveKit() {
    try {

      bot.chat("/give parkhi minecraft:wooden_sword 1")
      bot.chat("/give parkhi minecraft:golden_apple 5")
      bot.chat("/give parkhi minecraft:stone_pickaxe 1")
      bot.chat("/effect give parkhi minecraft:regeneration infinite")
      bot.chat("i am coming destroyer :) ")
      bot.chat("/give parkhi minecraft:stone 124")

    } catch (err) {
      console.log("Kit error:", err.message)
    }
  }

  bot.on('death', () => {

    console.log("Bot died → waiting for respawn kit")

    setTimeout(() => {

      setTimeout(() => {
        console.log("Respawn kit giving...")
        giveKit()
      }, 3000)

    }, 1000)
  })

  // BRIDGE
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

    } catch {
      bridging = false
    }
  }

  // BREAK BLOCKS
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

        if (tool) await bot.equip(tool, 'hand')

        if (
          bot.canDigBlock(block) &&
          block.position.distanceTo(bot.entity.position) > 1.5
        ) {

          await bot.dig(block)
        }
      }

      digging = false

    } catch {
      digging = false
    }
  }

  bot.on('death', () => console.log("Bot died"))
  bot.on('kicked', console.log)
  bot.on('error', console.log)

  bot.on('end', () => {
    console.log("Reconnecting...")
    setTimeout(createBot, 3000)
  })
}

createBot()
