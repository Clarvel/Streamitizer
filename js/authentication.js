export class Authentication{
	/**
	 * @param {boolean} manuallyTriggered 
	 * @returns {Promise<Object.<string, *>>}
	 */
	async Authenticate(manuallyTriggered=false, request={}){throw Error("Not Implemented")}

	/**
	 * @param {*} auth authentication that needs refreshing
	 * @returns {Promise<Object.<string, *>>}
	 */
	async Refresh(auth, manuallyTriggered=false, request={}){return this.Authenticate(manuallyTriggered, request)}
}