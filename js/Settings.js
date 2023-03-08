import { Browser } from "./browser.js"
import { Config } from "./config.js"
import { ObjFilter } from "./utils.js"

export class Settings{
	/**
	 * @param {string} storageID
	 * @param {Object<string, *>} defaultConfig if the 'value' object has a 'value' key, a default Get request will return that, otherwise returns the object
	 * @param {Array<string>} additionalKeys generic empty keys to config that can still be saved to and fetched from
	 */
	constructor(storageID, defaultConfig, additionalKeys=[]){
		this._storageID = storageID
		this._config = defaultConfig
		for (const key of additionalKeys) {if(!(key in this._config))this._config[key]=null}

		//Browser.GetStorage().then((s)=>console.log(this._storageID, this._config, s))
	}

	/**
	 * This helper function can be skipped if you know your storageID and defaultConfig
	 * @param {string} storageID 
	 * @param {string} configPath 
	 * @param {Array<string>} additionalKeys
	 */
	static async Create(storageID=undefined, configPath=undefined, additionalKeys=[]){
		if(storageID == null && configPath == null){ // set to default global settings if both are not present
			storageID = "Settings"
			configPath = "../options.json"
		}
		if(storageID != null && configPath != null)
			return new Settings(storageID, await Config.Fetch(configPath), additionalKeys)
		throw Error(`Could not create Settings object; missing ${storageID == null ? "storageID" : "configPath"}!`)
	}

	Keys(){return Object.keys(this._config)}

	/**
	 * @param {string} key 
	 */
	IsValid(key){
		//console.log(key, this.Keys())
		return this.Keys().includes(key)
	}

	/**
	 * @param {string} key 
	 */
	_EnsureKeyIsValid(key){
		if(!this.IsValid(key))
			throw Error(`Key [${key}] is invalid for storage in [${this._storageID}] store.`)
		return true
	}

	/**
	 * @param {string} key 
	 */
	_CreateKey(key){return this._storageID+key}

	/**
	 * @param {string} key if empty, resets ALL keys
	 */
	async Reset(key=null){
		let keys = key == null ? this.Keys() : [this._EnsureKeyIsValid(key) ? key : undefined]
		console.log(`Resetting ALL Settings for [${this._storageID}] ID on keys: `, keys)
		await Browser.RemoveStorage(keys.map(k=>this._CreateKey(k)))
	}

	/**
	 * @param {string} key 
	 */
	async Set(key, value){
		this._EnsureKeyIsValid(key)
		await Browser.SetStorage({[this._CreateKey(key)]:value})
	}

	_GetDefault(key){
		const val = this._config[key]
		return (val != null && typeof val === 'object' && "value" in val) ? val["value"] : val
	}

	/**
	 * @param {string} key 
	 */
	async Get(key){
		this._EnsureKeyIsValid(key)
		let k = this._CreateKey(key)
		return (await Browser.GetStorage(k))[k] ?? this._GetDefault(key)
	}

	/**
	 * @param {string} key 
	 */
	GetMetadata(key){
		this._EnsureKeyIsValid(key)
		return this._config[key]
	}

	/**
	 * @param {Function} func 
	 */
	OnUpdate(func){
		return Browser.OnStorageStateChanged((changes)=>{
			var updates = {}
			Object.entries(changes).map(([k, v], i)=>{
				if(k.startsWith(this._storageID)){
					const key = k.slice(this._storageID.length)
					if(this.IsValid(key)){
						updates[key] = v["newValue"] ?? this._GetDefault(key) // only provide newvalue, or default if the update is a reset
					}
				}
			})
			if(Object.keys(updates).length !== 0){
				//console.log(updates, changes)
				return func(updates)
			}
		})
	}
}