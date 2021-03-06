import { TSMap } from 'typescript-map'

import RadixIdentity from './RadixIdentity'
import RadixSimpleIdentity from './RadixSimpleIdentity'

import { RadixKeyPair } from '../RadixAtomModel'

export default class RadixIdentityManager {
    public identities: TSMap<string, RadixIdentity> = new TSMap()

    public generateSimpleIdentity() {
        const keyPair = RadixKeyPair.generateNew()
        const identity = new RadixSimpleIdentity(keyPair)
        this.identities.set(keyPair.getAddress(), identity)

        return identity
    }

    public addSimpleIdentity(keyPair: RadixKeyPair) {
        const identity = new RadixSimpleIdentity(keyPair)
        this.identities.set(keyPair.getAddress(), identity)

        return identity
    }
}
