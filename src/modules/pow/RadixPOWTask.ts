import RadixPOW from './RadixPOW'

import { logger } from '../common/RadixLogger'

export default class RadixPOWTask {
    public pow: RadixPOW

    constructor(
        readonly magic: number,
        readonly seed: Buffer,
        readonly target: Buffer,
    ) {
        this.pow = new RadixPOW(magic, seed)

        logger.debug(target.toString('hex'))
    }

    public computePow() {
        return new Promise<RadixPOW>((resolve, reject) => {
            this.attemptPow(resolve)
        })
    }

    

    public attemptPow(callback: (pow: RadixPOW) => void) {
        for (let i = 0; i < 100; i++) {
            this.pow.incrementNonce()
            const hash = this.pow.getHash()

            if (this.meetsTarget(hash)) {
                logger.debug(hash.toString('hex'))

                setTimeout(() => {
                    callback(this.pow)
                })

                return
            }
        }

        // Non-blocking
        setTimeout(() => {
            this.attemptPow(callback)
        }, 0)
    }

    public meetsTarget(hash: Buffer) {
        return hash.compare(this.target) < 0
    }
}
