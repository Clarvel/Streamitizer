export class Authentication{
	/**
	 * @param {boolean} manuallyTriggered 
	 * @returns {Promise<Object.<string, *>>}
	 */
	async Authenticate(manuallyTriggered=false){throw Error("Not Implemented")}

	/**
	 * @param {*} auth authentication that needs refreshing
	 * @returns {Promise<Object.<string, *>>}
	 */
	async Refresh(auth){return this.Authenticate(false)}
}