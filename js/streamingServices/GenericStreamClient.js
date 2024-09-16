import { GenericAuthClient } from "../AuthenticationClients/GenericAuthClient.js"
import { Settings } from "../settings.js"
import { ObjFilter } from "../utils.js"
//import { Obfuscator } from "../ID.js"

const AUTH_KEY = "AUTH_KEY"
const ERR_KEY = "ERR_KEY"
const USERNAME_KEY = "USER_KEY"
const ACTIVE_STREAMS_KEY = "ACTIVE_STREAMS"
const USER_ID = "TID" // for twitch

const KEYS = [AUTH_KEY, ERR_KEY, USERNAME_KEY, ACTIVE_STREAMS_KEY, USER_ID]

export class StreamInfo {
	/**
	 * @param {string} streamerName
	 * @param {string} streamURL 
	 * @param {string} iconURL 
	 * @param {string} description 
	 */
	constructor(streamerName, streamURL, iconURL, description=undefined){
		this.Name = streamerName
		this.Link = streamURL
		this.Icon = iconURL
		this.Desc = description
		//this.TypedData = new TypedStreamData(streamURL, iconURL, description)
	}
}


// const savedData = savedStreams[info.StreamerName] ??= {"Read":false}
// savedData[type] = {
// 	"Icon":info.IconURL,
// 	"Desc":info.Description,
// 	"Link":info.StreamURL
// }

export class TypedStreamData{
	/**
	 * @param {string} streamURL 
	 * @param {string} iconURL 
	 * @param {string} description 
	 */
	constructor(streamURL, iconURL, description=undefined){
		this.Link = streamURL
		this.Icon = iconURL
		this.Desc = description
	}
}

export class NamedStreamData{
	/**
	 * @param {string} type 
	 * @param {TypedStreamData} typedStreamData 
	 */
	constructor(type, typedStreamData, read=false){
		this.Read = read
		this.Types = {[type]:typedStreamData}
	}
}

export class GenericStreamClient{
	/**
	 * @type {GenericAuthClient}
	 */
	static AuthClientType = null
	static Type = ""

	/**
	 * @param {string} storageID
	 * @param {Object.<string, *>} config 
	 */
	constructor(storageID, config){
		console.log(config)
		this._AuthClient = new this.constructor.AuthClientType(config)
		this._Settings = new Settings(storageID, {...config, ...config["Options"]}, KEYS)
		this._ID = storageID
		//console.log(this._AuthClient, this._Settings)
	}

	/**
	 * @returns {string}
	 */
	static get AuthType(){return this.AuthClientType.Type}
	/**
	 * @returns {string}
	 */
	get AuthType(){return this.constructor.AuthClientType.Type}
	/**
	 * @returns {string}
	 */
	get Type(){return this.constructor.Type}

	get ID(){return this._ID}
	
	async _CallFuncWithAuth(func){
		try{
			//console.log(func, this)
			let auth = await this.GetAuthentication()
			if(auth == null)
				throw Error("Cannot invoke function without Authentication")
			try{
				return await func(auth)
			}catch(e1){
				// this is only intended to handle 401 unauthorized
				if(e1.cause !== 401)
					throw e1
				
				await this._Settings.Reset(AUTH_KEY) // hack to reset auth without being manually triggered
				auth = await this.GetAuthentication()
				if(auth == null)
					throw Error("Cannot invoke function without Authentication")
				return await func(auth)
			}
		}catch(e){
			await this.SetErrorState(e.toString())
			throw e
		}
	}

	/**
	 * @param {*} authentication fetched authentication for this call
	 * @returns {Promise<string>}
	 */
	async _GetUsername(authentication){return Error("Not Implemented")}

	/**
	 * @returns {Promise<string>}
	 */
	async GetUsername(refresh=false){
		if(!refresh){
			const cached = await this._Settings.Get(USERNAME_KEY)
			if(cached != null)
				return cached
		}
		const username = await this._CallFuncWithAuth(async auth=>this._GetUsername(auth))
		await this._Settings.Set(USERNAME_KEY, username)
		return username
	}

	async Get(id){return await this._Settings.Get(id)}
	async Set(id, value){return await this._Settings.Set(id, value)}
	OnUpdate(func){return this._Settings.OnUpdate((changes)=>func(ObjFilter(changes, ([k, v])=>!KEYS.includes(k))))}

	/**
	 * @param {*} authentication fetched authentication for this call
	 * @returns {Promise<[name:string, link:string, icon:string, desc:string][]>}
	 */
	async _GetActiveStreams(authentication){return Error("Not Implemented")}

	/** Returns all new streams found, and caches all found streams
	 * @returns {Promise<{string: [link:string, icon:string, desc:string]}>} // return all entries that have not been cached before
	 */
	async FetchStreams(){
		//try{
			const streams = Object.fromEntries((await this._CallFuncWithAuth(async auth=>this._GetActiveStreams(auth))).map(s=>[s.shift(), s]))
			//const old = await this.GetCachedStreams()
			await this.Set(ACTIVE_STREAMS_KEY, streams)

			//return ObjFilter(streams, ([k, v])=>!k in old) // return all entries that have not been cached before
		//}catch(e){
			//this.SetErrorState(e.toString())
		//	throw e
		//}
	}

	/** Returns all cached streams
	 * @returns {Promise<{string: [link:string, icon:string, desc:string]}>}
	 */
	async GetCachedStreams(){
		console.log(ACTIVE_STREAMS_KEY, (await this.Get(ACTIVE_STREAMS_KEY)))
		return await this.Get(ACTIVE_STREAMS_KEY) ?? {}
	}

	async GetAuthentication(manuallyTriggered=false){
		let auth = await this._Settings.Get(AUTH_KEY)
		if(manuallyTriggered || auth == null){
			//if(this._AuthClient == null){}
			auth = await this._AuthClient.Authenticate(manuallyTriggered)
			//console.log(auth)
			await this._Settings.Set(AUTH_KEY, auth)
		}
		return auth
	}

	/**
	 * @param {string} errorMessage 
	 */
	async SetErrorState(errorMessage){
		var existingErrs = await this._Settings.Get(ERR_KEY) ?? {}
		var existingCount = existingErrs[errorMessage] ?? 0
		existingErrs[errorMessage] = existingCount + 1
		return await this._Settings.Set(ERR_KEY, existingErrs)
	}
	async RemoveErrorState(errorMessage){
		var existingErrs = await this._Settings.Get(ERR_KEY) ?? {}
		delete existingErrs[errorMessage]
		return await this._Settings.Set(ERR_KEY, existingErrs)
	}
	async ClearErrorState(){return await this.Reset(ERR_KEY)}
	async GetErrorState(){return await this._Settings.Get(ERR_KEY)}
	async Reset(key=null){return await this._Settings.Reset(key)}
	async GetSite(){return await this._Settings.Get("Site")}
}