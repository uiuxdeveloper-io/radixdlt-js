import { Subject, Observable, Observer, BehaviorSubject } from 'rxjs'
import { TSMap } from 'typescript-map'

import RadixAccountSystem from './RadixAccountSystem'
import RadixTransaction from './RadixTransaction'
import RadixTransactionUpdate from './RadixTransactionUpdate'

import { radixConfig } from '../common/RadixConfig'
import {
    RadixAtomUpdate, RadixParticle, RadixAddress, RadixOwnedTokensParticle, RadixFeeParticle, RadixSpin, RadixEUID,
} from '../atommodel'
import { RadixDecryptionState } from './RadixDecryptionAccountSystem';

import BN from 'bn.js'
import { radixTokenManager } from '../token/RadixTokenManager';
import Decimal from 'decimal.js';

export default class RadixTransferAccountSystem implements RadixAccountSystem {
    public name = 'TRANSFER'

    public transactions: TSMap<string, RadixTransaction> = new TSMap()
    public balance: { [tokenId: string]: BN } = {}

    public transactionSubject: Subject<RadixTransactionUpdate> = new Subject()
    public balanceSubject: BehaviorSubject<{ [tokenId: string]: BN }>

    private unspentConsumables: TSMap<string, RadixOwnedTokensParticle> = new TSMap()
    private spentConsumables: TSMap<string, RadixOwnedTokensParticle> = new TSMap()

    constructor(readonly address: RadixAddress) {
        // Add default radix token to balance
        // this.balance[
        //     radixTokenManager.getTokenByISO(radixConfig.mainTokenISO).id.toString()
        // ] = 0
        this.balanceSubject = new BehaviorSubject(this.balance)
    }

    public async processAtomUpdate(atomUpdate: RadixAtomUpdate) {
        const atom = atomUpdate.atom
        if (!atom.containsParticle(RadixOwnedTokensParticle)) {
            return
        }

        if (atomUpdate.action === 'STORE') {
            this.processStoreAtom(atomUpdate)
        } else if (atomUpdate.action === 'DELETE') {
            this.processDeleteAtom(atomUpdate)
        }
    }

    private processStoreAtom(atomUpdate: RadixAtomUpdate) {
        const atom = atomUpdate.atom


        // Skip existing atoms
        if (this.transactions.has(atom.hid.toString())) {
            return
        }

        const transactionUpdate: RadixTransactionUpdate = {
            action: 'STORE',
            hid: atom.hid.toString(),
            transaction: {
                hid: atom.hid.toString(),
                balance: {},
                fee: 0,
                participants: {},
                timestamp: atom.getTimestamp(),
                message: '',
            },
        }
        
        const transaction = transactionUpdate.transaction

        // Get transaction message
        if (atomUpdate.processedData.decryptedData 
            && atomUpdate.processedData.decryptedData.decryptionState !== RadixDecryptionState.CANNOT_DECRYPT) {
            transaction.message = atomUpdate.processedData.decryptedData.data
        }

        const consumables = atom.getSpunParticlesOfType(RadixOwnedTokensParticle)

        // Get transaction details
        for (const consumable of consumables) {

            const spin = consumable.spin
            const particle = consumable.particle as RadixOwnedTokensParticle
            const tokenClassReference = particle.getTokenClassReference()
            

            const ownedByMe = particle.getAddress().equals(this.address)

            const isFee = particle instanceof RadixFeeParticle

            // Assumes POW fee
            if (ownedByMe && !isFee) {
                const quantity = new BN(1)
                if (spin === RadixSpin.DOWN) {
                    quantity.isub(particle.getAmount())

                    this.unspentConsumables.delete(particle._id)
                    this.spentConsumables.set(particle._id, particle)
                } else if (spin === RadixSpin.UP) {
                    quantity.iadd(particle.getAmount())

                    if (!this.spentConsumables.has(particle._id)) {
                        this.unspentConsumables.set(particle._id, particle)
                    }
                }

                if (!(tokenClassReference.toString() in transaction.balance)) {
                    transaction.balance[tokenClassReference.toString()] = new BN(0)
                }
                transaction.balance[tokenClassReference.toString()].iadd(quantity)
            } else if (!ownedByMe && !isFee) {
                transaction.participants[particle.getAddress().toString()] = particle.getAddress()
            }
        }

        this.transactions.set(transactionUpdate.hid, transaction)

        // Update balance
        for (const tokenId in transaction.balance) {
            if (!(tokenId in this.balance)) {
                this.balance[tokenId] = new BN(0)
            }

            this.balance[tokenId].iadd(transaction.balance[tokenId])
        }

        this.balanceSubject.next(this.balance)
        this.transactionSubject.next(transactionUpdate)
    }

    private processDeleteAtom(atomUpdate: RadixAtomUpdate) {
        const atom = atomUpdate.atom

        // Skip nonexisting atoms
        if (!this.transactions.has(atom.hid.toString())) {
            return
        }

        const hid = atom.hid.toString()
        const transaction = this.transactions.get(hid)
        const transactionUpdate: RadixTransactionUpdate = {
            action: 'DELETE',
            hid,
            transaction,
        }

        const consumables = atom.getSpunParticlesOfType(RadixOwnedTokensParticle)

        // Get transaction details
        for (const consumable of consumables) {

            const spin = consumable.spin
            const particle = consumable.particle as RadixOwnedTokensParticle
            const tokenClassReference = particle.getTokenClassReference()
            

            const ownedByMe = particle.getAddress().equals(this.address)

            const isFee = particle instanceof RadixFeeParticle

            // Assumes POW fee
            if (ownedByMe && !isFee) {
                const quantity = new BN(0)
                if (spin === RadixSpin.DOWN) {
                    quantity.iadd(particle.getAmount())

                    this.spentConsumables.delete(particle._id)
                    this.unspentConsumables.set(particle._id, particle)
                } else if (spin === RadixSpin.UP) {
                    quantity.isub(particle.getAmount())

                    this.unspentConsumables.delete(particle._id)
                    this.spentConsumables.set(particle._id, particle)
                }

                if (!(tokenClassReference.toString() in transaction.balance)) {
                    transaction.balance[tokenClassReference.toString()] = new BN(0)
                }
                transaction.balance[tokenClassReference.toString()].iadd(quantity)
            } else if (!ownedByMe && !isFee) {
                transaction.participants[particle.getAddress().toString()] = particle.getAddress()
            }
        }

        this.transactions.delete(transactionUpdate.hid)

        // Update balance
        for (const tokenId in transaction.balance) {
            if (!(tokenId in this.balance)) {
                this.balance[tokenId] = new BN(0)
            }

            this.balance[tokenId].isub(transaction.balance[tokenId])
        }

        this.balanceSubject.next(this.balance)
        this.transactionSubject.next(transactionUpdate)
    }

    public getAllTransactions(): Observable<RadixTransactionUpdate> {
        return Observable.create(
            (observer: Observer<RadixTransactionUpdate>) => {
                // Send all old transactions
                for (const transaction of this.transactions.values()) {
                    const transactionUpdate: RadixTransactionUpdate = {
                        action: 'STORE',
                        hid: transaction.hid,
                        transaction,
                    }

                    observer.next(transactionUpdate)
                }

                // Subscribe for new ones
                this.transactionSubject.subscribe(observer)
            }
        )
    }

    public getUnspentConsumables() {
        return this.unspentConsumables.values()
    }

    public getTokenUnitsBalance(): {[id: string]: Decimal} {
        return Object.keys(this.balance).reduce((result, key) => {
            const tokenClass = radixTokenManager.getTokenClassNoLoad(key)

            if (tokenClass) {
                result[key] = tokenClass.fromSubunitsToDecimal(this.balance[key])
            }

            return result
        }, {})
    }
}
