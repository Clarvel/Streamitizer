export class Config{
	/**
	 * @param {string} configPath
	 * @returns {Promise<Object.<string, string>>} config dictionary
	 */
	static async Fetch(configPath){
		return await (await fetch(configPath)).json()
	}
}