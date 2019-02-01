import 'mocha'
import { expect } from 'chai'

import BN from 'bn.js'

import { RadixTimestampParticle, RadixOwnedTokensParticle, RadixFungibleType, RadixTokenClassReference, RadixAddress } from '../..'
import { RadixUInt256 } from '../../../atommodel/index'

describe('RadixOwnedTokensParticle', () => {
    const amount = new BN(123)
    const type = RadixFungibleType.MINT
    const address = RadixAddress.generateNew()
    const nonce = 456
    const tokenReference = new RadixTokenClassReference(address, 'TEST')
    const planck = 789
    const granularity = new RadixUInt256(1)
    const particle = new RadixOwnedTokensParticle(amount, granularity, type, address, 456, tokenReference, planck)

    it(`should compute hid`, () => {
        expect(particle.getHID.bind(particle)).to.not.throw()
    })

    it(`should get type`, () => {
        expect(particle.getType()).to.equal(type)
    })

    it(`should get nonce`, () => {
        expect(particle.getNonce()).to.equal(nonce)
    })

    it(`should get planck`, () => {
        expect(particle.getPlanck()).to.equal(planck)
    })

    it(`should get address`, () => {
        expect(particle.getAddress()).to.deep.equal(address)
    })

    it(`should get token reference`, () => {
        expect(particle.getTokenClassReference()).to.deep.equal(tokenReference)
    })
})
