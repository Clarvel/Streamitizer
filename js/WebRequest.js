import { EncodeDataURL, EncodeQuery } from "./utils.js"

/**
 * @typedef {Object} WebRequestOptions
 * @property {*} query
 * @property {*} body
 * @property {*} headers
 * @property {T} responseClass
 */

export class WebRequest{
	/** If no T template passed in, retruns JSON
	 * @param {string} uri
	 * @param {string} method 
	 * @param {WebRequestOptions} options 
	 * @returns {Promise<T>} 
	 * @template T
	 */
	static async Fetch(uri, method, {query=undefined, body=undefined, headers=undefined, responseClass=undefined}){
		let requestOptions = {"method":method}
		if(body != null)
			requestOptions["body"] = EncodeQuery(body)
		if(headers != null)
			requestOptions["headers"] = headers

		let response = await fetch(query ? EncodeDataURL(uri, query) : uri, requestOptions)

		if(!response?.ok){
			throw Error(`Network request failed with status ${response.status} ${response.statusText}: [${await response.text().catch()}]`, {cause:response.status})
		}
		console.debug(uri, responseClass, method, query, body, headers)

		if(typeof responseClass === 'string')
			return response.text()
			
		const json = await response.json()
		console.debug(json)
		return responseClass != null ? new responseClass(json) : json
	}

	/**
	 * @param {string} uri 
	 * @param {WebRequestOptions} options
	 * @returns {Promise<T>}
	 * @template T 
	 */
	static POST = (uri, options=undefined) => WebRequest.Fetch(uri, "POST", options)
	
	/**
	 * @param {string} uri 
	 * @param {WebRequestOptions} options 
	 * @returns {Promise<T>}
	 * @template T
	 */
	static GET(uri, options=undefined){
		if(options?.["body"] != null)
			throw Error("GET request cannot have a 'body' option")
		return WebRequest.Fetch(uri, "GET", options)
	}
}