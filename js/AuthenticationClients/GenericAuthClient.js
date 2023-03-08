export class GenericAuthClient{
	static Type = ""
	static get Type(){return this.constructor.Type}

	/**
	 * @param {boolean} manuallyTriggered 
	 * @returns {Promise<Object.<string, *>>}
	 */
	async Authenticate(manuallyTriggered=false){
		throw Error("Not Implemented")
	}

	/**
	 * @param {*} token token or authentication that needs refreshing
	 * @returns {Promise<Object.<string, *>>}
	 */
	async Refresh(token){
		throw Error("Not Implemented")
	}
}