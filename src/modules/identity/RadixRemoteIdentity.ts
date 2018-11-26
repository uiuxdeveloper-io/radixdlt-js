import RadixECIES from '../crypto/RadixECIES'
import RadixIdentity from './RadixIdentity'
import RadixAccount from '../account/RadixAccount'
import RadixSignature from '../atom/RadixSignature'
import RadixSerializer from '../serializer/RadixSerializer'

import { RadixAtom, RadixKeyPair } from '../RadixAtomModel'

export default class RadixRemoteIdentity extends RadixIdentity {
    private token: string
    private remoteUrl: string
    private socket: WebSocket

    private constructor(readonly keyPair: RadixKeyPair, token: string, remoteUrl: string) {
        super(keyPair)

        this.token = token
        this.remoteUrl = remoteUrl
    }

    /**
     * Checks if a given web socket connection is still alive, otherwise creates a new one
     * 
     * @param _socket - WebSocket connection
     * @returns A WebSocket connection
     */
    private getSocketConnection(_socket: WebSocket): WebSocket {
        if (!_socket || _socket.readyState === _socket.CLOSING || _socket.readyState === _socket.CLOSED) {
            _socket = new WebSocket(this.remoteUrl)
        }
        return _socket
    }

    /**
     * Signs an atom with the wallet using the remote identity
     * 
     * @param atom - The atom to be signed
     * @returns A promise with the signed atom
     */
    public signAtom(atom: RadixAtom): Promise<RadixAtom> {
        return new Promise<RadixAtom>((resolve, reject) => {
            const socket = this.getSocketConnection(this.socket)

            socket.onopen = () => {
                socket.send(JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'sign_atom',
                    params: { 
                        token: this.token,
                        atom: atom.toJson(),
                    },
                    id: 0,
                }))
                socket.onmessage = (evt) => {
                    const response = JSON.parse(evt.data)
                    if (response.id === 0) {
                        if (response.result) {
                            atom.signatures = RadixSerializer.fromJson(response.result)
                            resolve(atom)
                        } else {
                            reject(response.error)
                        }
                    }
                }
                socket.onerror = (error) => reject(new Error(JSON.stringify(error)))
            }
        })
    }

    /**
     * Decrypt the payload of an atom
     * 
     * @param payload - The payload of the atom to be decrypted
     * @returns A promise with the decrypted payload
     */
    public decryptECIESPayload(payload: Buffer): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            const socket = this.getSocketConnection(this.socket)

            socket.onopen = () => {
                socket.send(JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'decrypt_ecies_payload',
                    params: {
                        token: this.token,
                        payload,
                    },
                    id: 1,
                }))
                socket.onmessage = (evt) => {
                    const response = JSON.parse(evt.data)
                    if (response.id === 1) {
                        if (response.result && response.result.data) {
                            resolve(response.result.data)
                        } else {
                            reject(response.error)
                        }
                    }
                }
                socket.onerror = (error) => reject(new Error(JSON.stringify(error)))
            }
        })
    }

    /**
     * Returns the public key of this identity synchronously
     * 
     * @returns The public key of the identity
     */
    public getPublicKey(): Buffer {
        return Buffer.from(this.keyPair.keyPair.getPublic().encode('be', true))
    }

    /**
     * Creates a new instance of a RadixRemoteIdentity
     * 
     * @param name - The name of the application that wants to use the remote identity
     * @param description - The description of the application that wants to use the remote identity
     * @param [host] - The host of the wallet
     * @param [port] - The port in which the wallet server is being exposed
     * @returns A promise with an instance of a RadixRemoteIdentity
     */
    public static async createNew(name: string, description: string, host = 'localhost', port = '54345'): Promise<RadixRemoteIdentity> {
        try {
            const token = await RadixRemoteIdentity.register(name, description, host, port)
            const publicKey = await RadixRemoteIdentity.getRemotePublicKey(token, host, port)

            return new RadixRemoteIdentity(RadixKeyPair.fromPublic(publicKey), token, `ws:${host}:${port}`)
        } catch (error) {
            throw error
        }
    }

    /**
     * Registers a RadixRemoteIdentity to the wallet
     * 
     * @param name - The name of the application that wants to use the remote identity
     * @param description - The description of the application that wants to use the remote identity
     * @param [host] - The host of the wallet
     * @param [port] - The port in which the wallet server is being exposed
     * @returns A promise with a valid token to interact with the wallet
     */
    public static register(name: string, description: string, host = 'localhost', port = '54345'): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            // This is an independant websocket because 'register' is a static method
            const socket = new WebSocket(`ws:${host}:${port}`)
            
            socket.onopen = () => {
                socket.send(JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'register',
                    params: {
                        name,
                        description,
                        permissions: ['sign_atom', 'decrypt_ecies_payload', 'get_public_key'],
                    },
                    id: 0,
                }))
                socket.onmessage = (evt) => {
                    const response = JSON.parse(evt.data)
                    if (response.result) {
                        resolve(response.result.token)
                    } else {
                        reject(response.error)
                    }
                }
                socket.onerror = (error) => reject(new Error(error))
            }
        })
    }

    /**
     * Returns the public key of this identity asynchronously
     * 
     * @param [host] - The host of the wallet
     * @param [port] - The port in which the wallet server is being exposed
     * @returns A promise with the public key of the identity
     */
    public static getRemotePublicKey(token, host = 'localhost', port = '54345'): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            // This is an independant websocket because 'getRemotePublicKey' is a static method
            const socket = new WebSocket(`ws:${host}:${port}`)
            
            socket.onopen = () => {
                socket.send(JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'get_public_key',
                    params: { token },
                    id: 0,
                }))
                socket.onmessage = (evt) => {
                    const response = JSON.parse(evt.data)
                    if (response.result) {
                        resolve(response.result.data)
                    } else {
                        reject(response.error)
                    }
                }
                socket.onerror = (error) => reject(new Error(error))
            }
        })
    }

    /**
     * Determines whether the server is up or down
     * 
     * @param [host] - The host of the wallet
     * @param [port] - The port in which the wallet server is being exposed
     * @returns A promise with true or false whether the server is up or down
     */
    public static isServerUp(host = 'localhost', port = '54345'): Promise<Boolean> {
        return new Promise<Boolean>((resolve, reject) => {
            const socket = new WebSocket(`ws://${host}:${port}`)
            
            setTimeout(() => {
                if (socket.readyState == socket.CLOSED) {
                    resolve(false)
                } else {
                    resolve(true)
                }
            }, 3000)
        })
    }
}