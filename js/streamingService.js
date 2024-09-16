import { Browser } from "./browser.js"
import { ID } from "./ID.js"
import { Settings } from "./settings.js"
import { GenericStreamClient } from "./streamingServices/GenericStreamClient.js"
import { ServiceMapping } from "./streamingServices/Services.js"
import { AsyncFilter, GroupBy, IsStr, IsStrWithVal, PromiseAll } from "./utils.js"

const ID_METADATA_KEY = "Meta"
const READ_STREAMS_KEY = "Read"
const CLIENT_TYPE_KEY = "Type"
const CREATED_KEY = "Created"

export class StreamClientController{
	constructor(settings){
		this._Settings = settings
	}

	static async Create(){
		const settings = await Settings.Create("Clients", "../services.json", [ID_METADATA_KEY, READ_STREAMS_KEY])
		const controller = new StreamClientController(settings)
		// delete clients that have not been created or deleted
		await PromiseAll(Object.entries(await settings.Get(ID_METADATA_KEY) ?? {}).filter(([k, v])=>!v[CREATED_KEY]).map(([k, v])=>controller.Delete(k)))
		return controller
	}

	static ClientTypes(){
		//console.log(ServiceMapping)
		return Object.keys(ServiceMapping)
	}

	/**
	 * @param {string} clientType
	 * @returns {string} 
	 */
	static GetAuthTypeByClientType(clientType){
		return ServiceMapping[clientType].AuthType
	}

	async GetClientTypeByID(id){
		//console.log(id)
		const clientType = (await this._GetMetadata(id))?.[CLIENT_TYPE_KEY]
		//console.log(metadata)
		if(clientType == null)
			throw Error(`Metadata missing for ${id} id`)
		return clientType
	}
	
	/**
	 * @returns {Promise<string[]>} 
	 */
	async GetClientIDs(includeAll=false){
		return (await AsyncFilter(Object.entries(await this._Settings.Get(ID_METADATA_KEY) ?? {}), ([k, v])=>{
			//console.log(k, v)
			return includeAll || v[CREATED_KEY]
		}) ?? {}).map(([k, v])=>k)
	}

	/**
	 * @param {string} clientType 
	 */
	GetClientTypeConfig(clientType){
		const config = this._Settings.GetMetadata(clientType)
		//console.log(clientType, config)
		if(config == null)
			throw Error(`Service Client Type ${clientType} does not have a config in services.json`)
		return config
	}

	/**
	 * @param {string} id
	 * @returns {Promise<*>} 
	 */
	async _GetMetadata(id){
		const metadata = (await this._Settings.Get(ID_METADATA_KEY))?.[id]
		if(metadata == null)
			throw Error(`Could not find metadata reference for ${id}`)
		return metadata
	}

	/**
	 * @param {string} id 
	 * @param {Object.<string, *>} metadata
	 */
	async _SetMetadata(id, metadata={}){
		let saved = await this._Settings.Get(ID_METADATA_KEY) ?? {}
		saved[id] = {...saved?.[id], ...metadata}
		await this._Settings.Set(ID_METADATA_KEY, saved)
	}

	async _deleteMetadata(id){
		console.log(await chrome.storage.sync.get())
		let metadata = await this._Settings.Get(ID_METADATA_KEY)
		delete metadata[id]
		await this._Settings.Set(ID_METADATA_KEY, metadata)
		console.log(await chrome.storage.sync.get())
	}

	/**
	 * @param {string} clientType 
	 * @returns {Promise<string>} created service ID
	 */
	async CreateClientID(clientType){
		if(ServiceMapping[clientType] == null)
			throw Error(`The Client Type [${clientType}] is not a recognized streaming service type.`)
		
		const id = Browser.UUID()
		await this._SetMetadata(id, {[CLIENT_TYPE_KEY]:clientType, [CREATED_KEY]:false})
		return id
	}

	/**
	 * @param {string} id
	 * @returns {Promise<GenericStreamClient>} 
	 */
	async GetClient(id){
		//console.log(await this._GetMetadata(id))
		const clientType = (await this._GetMetadata(id))?.[CLIENT_TYPE_KEY]
		if(clientType == null)
			throw Error(`No saved metadata found for id ${id}`)
			const serviceClass = ServiceMapping[clientType]
			if(serviceClass == null)
				throw Error(`The Type [${clientType}] is not a recognized streaming service type.`)
			return new serviceClass(id, this.GetClientTypeConfig(clientType))
	}

	/**
	 * @param {string} id if omitted, will delete all services
	 */
	async Delete(id=null){
		console.log(await chrome.storage.sync.get())
		if(id == null){
			await PromiseAll((await this.GetClientIDs()).map(async id=>(await this.GetClient(id)).Reset()))
			await this._Settings.Reset(ID_METADATA_KEY)
		}else{
			await (await this.GetClient(id)).Reset()
			await this._deleteMetadata(id)
			await this.FetchStreams()
		}
		console.log(await chrome.storage.sync.get())
	}

	OnUpdate(func){
		return this._Settings.OnUpdate((changes)=>{
			//console.log(changes)
			if(ID_METADATA_KEY in changes){
				const metadata = changes[ID_METADATA_KEY] ?? {} // if metadata is empty, stuff has been deleted
				// only return the existing IDs, null can acount as object here
				const response = Object.entries(metadata).filter(([k, v])=>v[CREATED_KEY]).map(([k, v])=>k) // only call updates on fully created entries
				//console.log(response, changes)
				if(response.length > 0 || Object.keys(metadata).length === 0) // if there is a response, or the update is there is nothing, invoke. This should filter out entries not fully created
					func(response)
			}
		})
	}

	// OnStreamCacheUpdate(func){
	// 	return this._Settings.OnUpdate((changes)=>{
	// 		if(READ_STREAMS_KEY in changes){
	// 			const streams = changes[READ_STREAMS_KEY] ?? {}
	// 			func(streams)
	// 		}
	// 	})
	// }

	/**
	 * Checks for uniqueness based on stream type and username
	 * DOESN'T check for unique ID, they should *all* be unique
	 * @param {GenericStreamClient} client
	 */
	async IsUnique(client){
		const username = await client.GetUsername()
		return (await AsyncFilter(await this.GetClientIDs(), async id=>{
			//console.log(id)
			if(id === client.ID) // DON'T include self
				return false
			const compare = await this.GetClient(id)
			return compare.Type === client.Type && await compare.GetUsername() === username
		})).length === 0
	}

	/**
	 * @param {string} id 
	 */
	async IsCreated(id){
		return this._GetMetadata(id)?.[CREATED_KEY] ?? false
	}

	// /**
	//  * @returns {Promise<Object.<string, boolean>>}
	//  */
	// async GetReadStreamCache(){
	// 	return await this._Settings.Get(READ_STREAMS_KEY) ?? {}
	// }

	/** Returns an array of objects containing <streamName, [Link, Icon, Desc]> key-value pairs for all newly discovered streams
	 * @param {string[]} clientIDs
	 */
	async FetchStreams(clientIDs=null){
		clientIDs ??= await this.GetClientIDs()
		await PromiseAll(clientIDs.map(async id=>await (await this.GetClient(id)).FetchStreams()))
	}

	/** Returns an array of kvp pairs containing <streamName, {service:[Link, Icon, Desc]}> key-value pairs for all cached streams
	 * @param {string[]} clientIDs
	 * @returns {Promise<[[Name:string, {string:[Link:string, Icon:string, Desc:string]}]]>}
	 */
	async GetCachedStreams(clientIDs=null, mergeSameNames=false){
		clientIDs ??= await this.GetClientIDs()
		const cache = {}
		const acc = (a, b, d) => (cache[a] ??= {})[b] = d
		const MSNAccFlip = mergeSameNames ? (t, n, d)=>acc(n, t, d) : acc
		await PromiseAll(clientIDs.map(async id=>{
			const client = await this.GetClient(id)
			Object.entries(await client.GetCachedStreams()).forEach(([n, d])=>MSNAccFlip(client.Type, n, d))
		}))
		const entries = Object.entries(cache)
		return mergeSameNames ? entries : entries.map(([t, s])=>Object.entries(s).map(([n, d])=>[n, {[t]:d}])).flat()
		
		
		//if(mergeSameNames){
			// cache = {Name:[Type, Link, Icon, Desc]}
			// this simplification works because javascript isn't multithreaded

		//	return Object.entries(cache)
		//}else{
			// cache = {Type:{Name:[Link, Icon, Desc]}}
		//	await PromiseAll(clientIDs.map(async id=>{
		//		const client = await this.GetClient(id)
		//		Object.entries(await client.GetCachedStreams()).forEach(([n, d])=>acc(client.Type, n, d))
		//	}))
		//	return Object.entries(cache).map(([t, s])=>Object.entries(s).map(([n, d])=>arr.push([n, {[t]:d}]))).flat()
		//}

		//const groupedClients = GroupBy(await PromiseAll(clientIDs.map(id=>this.GetClient(id))), c=>c.Type)
		//console.log(groupedClients)


		// GetCachedStreams returns a {name: {streamType: link, icon, desc}} to support duplicate entries
		//await PromiseAll(Object.entries(groupedClients).map(async ([ct, cs])=>{
			// all unique streams from 1 type, should be {name: [link, con, desc]}
			//const ts = {...await PromiseAll(cs.map(c=>c.GetCachedStreams()))}
			//Object.entries(ts).forEach(([n, d])=>(cached[n] ??= {})[ct]=d)
		//}))

		//console.log(cached)
		//return cached
	}

	static GetCachedStreamsCount(cache){
		return Object.values(cache).map(d=>Object.keys(d).length).reduce((a,b)=>a+b, 0)
	}

	/**
	 * @param {string[]} clientIDs
	 * @returns {Promise<string[]>} errors 
	 */
	async GetErrors(clientIDs=null){
		clientIDs ??= await this.GetClientIDs()
		console.log(clientIDs)
		let errors = await PromiseAll(clientIDs.map(async id=>await (await this.GetClient(id)).GetErrorState()), true)
		console.log(errors)
		return errors
	}

	// async _RebuildReadCacheAndFindNewStreams(streams, appendExisting){
	// 	const savedStreams = await this.GetReadStreamCache()
	// 	const activeStreams = appendExisting ? savedStreams : {}
	// 	const newStreams = {}

	// 	for(const [name, link, icon, desc] of streams){
	// 		const existingReadFlag = savedStreams[name]
	// 		const newReadFlag = activeStreams[name] ??= existingReadFlag ?? false 
	// 		if(existingReadFlag == null){
	// 			const newStream = newStreams[name] ??= [newReadFlag, []]
	// 			newStream[1].push([link, icon, desc])
	// 		}
	// 	}
	// 	await this._Settings.Set(READ_STREAMS_KEY, activeStreams)
	// 	return newStreams
	// }

	/**
	 * @param {string} clientID
	 */
	async Activate(clientID){
		var client = await this.GetClient(clientID)
		await client.GetAuthentication(true)

		if(!await this.IsUnique(client))
			throw Error(`Connection already exists for ${await client.GetUsername()}!`)

		const newStreams = await client.FetchStreams()
		
		await this._SetMetadata(client.ID, {[CREATED_KEY]:true})
		return newStreams
	}
	
	static async CreateNotificationsForStreams(streams){
		return PromiseAll(Object.entries(streams).map(async([id, [read, data]])=>{
			if(data.length > 1){
				await Browser.CreateNotification("OPEN_POPUP"+Browser.UUID(), id, "In multiple places", "")
			}else{
				await Browser.CreateNotification(data[0][0], id, data[0][2], data[0][1])
			}
		}))
	}
}