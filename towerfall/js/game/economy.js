// Spielwirtschaft: genau eine Ressource – Gold. Keine Lager, keine Produktion.
import { BALANCE } from '../config/balance.js'

export class Wallet {
  constructor(gold) {
    this.gold = gold
    this.earned = 0
    this.spent = 0
  }

  canAfford(amount) { return this.gold >= amount }

  spend(amount) {
    if (!this.canAfford(amount)) return false
    this.gold -= amount
    this.spent += amount
    return true
  }

  earn(amount) {
    const n = Math.max(0, Math.round(amount))
    this.gold += n
    this.earned += n
    return n
  }

  refund(amount) { this.gold += amount }
}

// Rückerstattung beim Verkauf: fester Anteil des insgesamt investierten Goldes
export const sellValue = (invested) => Math.floor(invested * BALANCE.sellRefund)

export const waveBonus = (waveNumber) => BALANCE.waveBonusBase + BALANCE.waveBonusPerWave * waveNumber

export const earlyCallBonus = (secondsLeft) => Math.max(0, Math.floor(secondsLeft * BALANCE.earlyCallGoldPerSecond))
