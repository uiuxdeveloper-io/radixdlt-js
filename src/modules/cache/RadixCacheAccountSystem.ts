import { Subject, Observable, Observer } from 'rxjs'
import { TSMap } from 'typescript-map'
import { filter } from 'rxjs/operators'

import RadixAccountSystem from '../account/RadixAccountSystem'
import RadixApplicationDataUpdate from '../account/RadixApplicationDataUpdate'
import RadixApplicationData from '../account/RadixApplicationData'
import RadixAtomUpdate from '../atom/RadixAtomUpdate'
import RadixAtomCacheProvider from './RadixAtomCacheProvider'

import { RadixAtom, RadixApplicationPayloadAtom } from '../RadixAtomModel'

export default class RadixCacheAccountSystem implements RadixAccountSystem {
    public name = 'CACHE'
    public atomCache: RadixAtomCacheProvider

    constructor(readonly keyPair, atomCache?: RadixAtomCacheProvider) {
        if (atomCache) {
            this.atomCache = atomCache
        }
    }

    public async processAtomUpdate(atomUpdate: RadixAtomUpdate) {
        if (!this.atomCache) {
            return
        }

        // Just put it in the cache
        if (atomUpdate.action === 'STORE') {
            this.atomCache.storeAtom(atomUpdate.atom)
        } else if (atomUpdate.action === 'DELETE') {
            this.atomCache.deleteAtom(atomUpdate.atom)
        }        
    }

    public async loadAtoms() {
        return this.atomCache.getAtoms(this.keyPair)
    }   
}
