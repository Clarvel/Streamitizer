import { Config, Settings } from "./settings.js"
import { ObjVMap, ObjAVMap, DeleteNested, IncrementNestedValue } from "./utils.js"
import { Picarto } from "./providers/picarto.js"
import { Piczel } from "./providers/piczel.js"
import { Twitch } from "./providers/twitch.js"
import { Youtube } from "./providers/youtube.js"
import { CACHE_KEY, CLIENTS_KEY, ERRS_KEY, GROUP_STREAMS, SERVER_ERR_KEY } from "./IDs.js"

const SERVER_ERR_RETRYS = 2

const METADATA = Config.Fetch("../services.json")
const SETTINGS = new Settings()

const PROVIDERS = {
	"picarto": Picarto,
	"piczel": Piczel,
	"twitch": Twitch,
	"youtube": Youtube
}

export const FlatClientsData = obj => obj ? Object.values(obj).flatMap(clients => Object.values(clients).flatMap(data => Object.values(data))) : []

export async function PROVIDER_TYPES(){
	const metadata = await METADATA
	return Object.keys(PROVIDERS).filter(provider => metadata[provider] && !metadata[provider]["Disabled"])
}

export class StreamsService{
	static async GetClientNames(){
		const providers = await SETTINGS.GetSingle(CLIENTS_KEY)
		const result = ObjVMap(providers??{}, (provider, clients) => ObjVMap(clients, (UID, [auth, name]) => name)) // returns {provider: [[UID, name]]} // TODO: return array not obj?
		return result
	}

	static GetErrors(){
		return SETTINGS.GetSingle(ERRS_KEY) ?? {}
	}

	static ClearError(provider, UID, message){
		return SETTINGS.Modify(ERRS_KEY, (errs) => {
			const msgs = Object.keys(errs?.[provider]?.[UID] ?? {})
			if(msgs.includes(message))
				if(msgs.length === 1)
					delete errs[provider][UID]
				else 
					delete errs[provider][UID][message]
			console.log(provider, UID, message, errs)
			return errs
		})
	}

	// existingUID's presence determines if we are reconnecting, or making a new connection. The process is the same
	static async Create(provider, existingUID=null){
		const type = PROVIDERS[provider]
		if(type == null) throw Error(`Unrecognized [${provider}] Type.`)
		const config = (await METADATA)?.[provider]
		if(config == null) throw Error(`Cannot find [${provider}] config.`)

		const client = new type(config)
		const auth = await client.Authenticate(true)

		const [UID, name] = await client.GetUIDAndName(auth)
		if(existingUID && existingUID !== UID)
			throw Error(`Re-connection does not match requested account`)
		await SETTINGS.Modify(CLIENTS_KEY, async (providers={}) => {
			if(existingUID == null && providers[provider]?.[UID])
				throw Error(`Already connected to ${name} account`)
			;(providers[provider]??={})[UID] = [auth, name] // semicolon required here
			// delete any existing errors here, becasue cache should refresh the options container
			await SETTINGS.Modify(ERRS_KEY, o => DeleteNested(o, provider, UID))
			return providers
		}) // auth info saved here
		return SETTINGS.Modify(CACHE_KEY, async (cache={}) => {
			;(cache[provider]??={})[UID] = await client.FetchStreams(auth, UID)
			return cache
		}) // stream cache saved here
	}

	static async Delete(provider, UID){
		if((await METADATA)?.[provider] == null)
			throw Error(`Unrecognized [${provider}] Type.`)
		return Promise.all([
			SETTINGS.Modify(CLIENTS_KEY, o => DeleteNested(o, provider, UID)), // delete auth info
			SETTINGS.Modify(ERRS_KEY, o => DeleteNested(o, provider, UID)), // delete errors
			SETTINGS.Modify(CACHE_KEY, o => DeleteNested(o, provider, UID)) // delete cached streams
		])
	}

	static DeleteAll(){return SETTINGS.Del([CLIENTS_KEY, ERRS_KEY, CACHE_KEY])}

	static async FetchStreams(){
		let errsModified = false
		let [[providers, errs], metadata] = await Promise.all([SETTINGS.Get([CLIENTS_KEY, ERRS_KEY]), METADATA])
		errs ??= {}
		return ObjAVMap(providers ?? {}, async (provider, clients) => {
			const client = new PROVIDERS[provider](metadata[provider])
			return ObjAVMap(clients, async (UID, [auth, name]) => {
				const prevErrs = errs[provider]?.[UID]
				const prevErrTypes = Object.keys(prevErrs ?? {}).length
				if(prevErrTypes === 0 || (prevErrTypes === 1 && prevErrs[SERVER_ERR_KEY] <= SERVER_ERR_RETRYS)){ // if an error exists for this client, don't fetch
					try{
						const fetched = await client.FetchStreams(auth, UID)
						if(prevErrs){ // if fetch succeeds, any errors were temporary and should be cleared
							errsModified = true
							DeleteNested(errs, provider, UID)
						}
						return fetched
					}catch(e){
						if(e instanceof TypeError)
							throw e // likely means network disconnected, so discard ALL work and don't update cache
						if(600 > e.cause && e.cause >= 500){ // problem with network or server, carry over cache on first 2 attempts
							errsModified = true
							const incr = IncrementNestedValue(errs, provider, UID, SERVER_ERR_KEY)
							return incr <= SERVER_ERR_RETRYS ? (await SETTINGS.GetSingle(CACHE_KEY))?.[provider]?.[UID] ?? [] : []
						}
						if(e.cause === 401){
							try{
								auth = await client.Refresh(auth)
								let [newUID, newName] = await client.GetUIDAndName(auth)
								if(newUID !== UID) throw Error("UID Mismatch on Re-Auth attempt")
								await SETTINGS.Modify(CLIENTS_KEY, providers => {
									providers[provider][UID] = [auth, newName]
									return providers
								}) // update auth info

								return await client.FetchStreams(auth, UID)
							}catch(e1){
								console.warn(e, e1)
							}
						}
						errsModified = true
						console.warn(e)
						console.log(e.cause)
						console.log(e.name)
						console.log(e.message)
						console.log(e.toString())
						IncrementNestedValue(errs, provider, UID, e.cause + e.toString())
					}
				}
				return []
			})
		}).then(cache => {
			console.debug(cache, errs)
			if(errsModified)
				SETTINGS.Set(ERRS_KEY, errs) // don't care when this finishes
			return SETTINGS.Set(CACHE_KEY, cache)
		}, console.warn)
	}

	static async ErrsCount(errs=null){
		return FlatClientsData(errs ?? await StreamsService.GetErrors()).reduce((acc, len) => acc + len, 0)
	}
	
	static async StreamsCount(streams=null){
		return (await StreamsService.GetRemappedStreams(streams)).length
	}

	// supports passing in streams to shortcut awaiting CACHE_KEY
	static async GetRemappedStreams(streams=null){
		let output = []
		let func = (provider, title, url, icon, desc) => output.push([title, {[provider]:[url, icon, desc]}])
		if(await SETTINGS.GetSingle(GROUP_STREAMS)){
			output = {}
			func = (provider, title, url, icon, desc) => (output[title] ??= {})[provider] = [url, icon, desc]
		}
		Object.entries(streams ?? (await SETTINGS.GetSingle(CACHE_KEY)) ?? {}).forEach(([provider, clients])=>Object.entries(clients).forEach(([UID, streams])=>streams.forEach(stream => func(provider, ...stream))))
		return Array.isArray(output) ? array : Object.entries(output)
	}
}