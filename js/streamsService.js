import { Config, Settings } from "./settings.js"
import { ObjVMap, ObjAVMap } from "./utils.js"
import { Picarto } from "./providers/picarto.js"
import { Piczel } from "./providers/piczel.js"
import { Twitch } from "./providers/twitch.js"
import { Youtube } from "./providers/youtube.js"
import { CACHE_KEY, CLIENTS_KEY, ERRS_KEY } from "./IDs.js"

const METADATA = Config.Fetch("../services.json")
const SETTINGS = new Settings()

const PROVIDERS = {
	"picarto": Picarto,
	"piczel": Piczel,
	"twitch": Twitch,
	"youtube": Youtube
}

export const FlatClientsData = obj => obj ? Object.values(obj).flatMap(clients => Object.values(clients).flatMap(data => Object.values(data))) : []

export const PROVIDER_TYPES = () => Object.keys(PROVIDERS)

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

	static async Create(provider, isNew=true){
		const type = PROVIDERS[provider]
		if(type == null) throw Error(`Unrecognized [${provider}] Type.`)
		const config = (await METADATA)?.[provider]
		if(config == null) throw Error(`Cannot find [${provider}] config.`)

		const client = new type(config)
		const auth = await client.Authenticate(true)
		
		const [UID, name] = await client.GetUIDAndName(auth)
		await SETTINGS.Modify(CLIENTS_KEY, (providers={}) => {
			if(providers[provider]?.[UID] != null)
				if(isNew)
				throw Error(`Already connected to ${name} account`)
			else if(!isNew)
				throw Error(`Re-connection does not match any known account`)
			;(providers[provider]??={})[UID] = [auth, name] // semicolon required here
			console.log(providers)
			return providers
		}) // auth info saved here
		await SETTINGS.Modify(CACHE_KEY, async (cache={}) => {
			;(cache[provider]??={})[UID] = await client.FetchStreams(auth, UID)
			console.log(cache)
			return cache
		}) // stream cache saved here
	}

	static async Delete(provider, UID){
		if((await METADATA)?.[provider] == null)
			throw Error(`Unrecognized [${provider}] Type.`)
		const delFunc = (o) => {
			const UIDs = Object.keys(o?.[provider] ?? {})
			if(UIDs.includes(UID)){
				if(UIDs.length === 1)
				delete o[provider]
				else 
				delete o[provider][UID]
			}
			return o
		}
		return Promise.all([
			SETTINGS.Modify(CLIENTS_KEY, delFunc), // delete auth info
			SETTINGS.Modify(ERRS_KEY, delFunc), // delete errors
			SETTINGS.Modify(CACHE_KEY, delFunc) // delete cached streams
		])
	}

	static DeleteAll(){return SETTINGS.Del([CLIENTS_KEY, ERRS_KEY, CACHE_KEY])}

	static async FetchStreams(){
		let hasErr = false
		let [[providers, errs], metadata] = await Promise.all([SETTINGS.Get([CLIENTS_KEY, ERRS_KEY]), METADATA])
		errs ??= {}
		return ObjAVMap(providers ?? {}, async (provider, clients) => {
			const client = new PROVIDERS[provider](metadata[provider])
			return ObjAVMap(clients, async (UID, [auth, name]) => {
				try{
					return await client.FetchStreams(auth, UID)
				}catch(e){
					if(e instanceof TypeError)
						throw e// likely means network disconnected, so discard results
					try{ // if it wasn't a TypeError, it was likely an auth error, so try to re-auth
						auth = await client.Refresh(auth)
						let [newUID, newName] = await client.GetUIDAndName(auth)
						if(newUID !== UID) throw Error("UID Mismatch on Re-Auth attempt")
						await SETTINGS.Modify(CLIENTS_KEY, providers => {
							providers[provider][UID] = [auth, newName]
							return providers
						}) // update auth info

						return await client.FetchStreams(auth, UID)
					}catch(e1){
						console.log(e, e1)
						hasErr = true
						const err = e.toString()
						const errsObj = (errs[provider] ??= {})[UID] ??= {}
						errsObj[err] = (errsObj[err] ?? 0) + 1
						return []
					}
				}
			})
		}).then(cache => {
			console.debug(cache, errs)
			if(hasErr)
				SETTINGS.Set(ERRS_KEY, errs) // don't care when this finishes
			return SETTINGS.Set(CACHE_KEY, cache)
		}, console.warn)
	}

	static async GetCachedStreams(){
		return SETTINGS.GetSingle(CACHE_KEY) ?? {}
	}

	static async StreamsCount(streams=null){
		return FlatClientsData(streams ?? await StreamsService.GetCachedStreams()).length
	}

	static async ErrsCount(errs=null){
		return FlatClientsData(errs ?? await StreamsService.GetErrors()).reduce((acc, len) => acc + len, 0)
	}
}