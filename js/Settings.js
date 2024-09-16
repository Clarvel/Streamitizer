import { Browser } from "./browser.js"
import { DEFAULT } from "./IDs.js"
import { Copy } from "./utils.js"

export class Config{
	/**
	 * @param {string} configPath
	 * @returns {Promise<Object.<string, string>>} config dictionary
	 */
	static Fetch = async configPath => await (await fetch(configPath)).json()
}

export class Settings{
    async Get(keys){
        const stored = await Browser.GetStorage(keys)
        return keys.map(k => stored[k])
    }
    
    async GetSingle(key){return this.Get([key]).then(r => r[0])}

    async _Get(keys){
        const stored = await Browser.GetStorage(keys)
        return keys.map(k => [k, stored[k]])
    }
    Set = (key, value) => Browser.SetStorage({[key]:value})
    Del(keys){return Browser.RemoveStorage(keys)} // accepts single string or an array of strings
    async Modify(key, func){await this.Set(key, await func(await this.GetSingle(key)))}

    // func will be invoked with an array of key, value pairs. value can be null
	OnUpdate(func){Browser.OnStorageStateChanged(changes => func(Object.entries(changes).map(([k, v], i) => [k, v["newValue"]])))} // TODO: is this used outside MetadataSettings?
}

export class MetadataSettings extends Settings{
    _Metadata = null
    constructor(configPath){
        super()
        this._Metadata = Config.Fetch(configPath)
    }

    async Get(keys){
        const [metadata, stored] = await Promise.all([this._Metadata, super._Get(keys)])
        //console.log(keys, metadata, stored)
        return stored.map(([k, v]) => v ?? metadata[k]?.[DEFAULT] ?? null) // can still have value = null
    }

    async GetSingle(key){return this.Get([key]).then(r => r[0])} // todo: do I need to redefine this in Settings?

    // returns an array of [key, object], where object.value is defined from storage, or the default
    async GetMetadata(){
        const metadata = Copy(await this._Metadata)
        const kvps = await super._Get(Object.keys(metadata))
        kvps.filter(([k, v]) => v != null).forEach(([k, v]) => metadata[k][DEFAULT] = v)
        return Object.entries(metadata)
    }

    async Reset(keys=null){return super.Del(keys ?? Object.keys(await this._Metadata))}

    OnUpdate(func){
        super.OnUpdate(async kvps => {
            const metadata = await this._Metadata
            console.debug(kvps, metadata)
            func(kvps.map(([k, v]) => [k, v ?? metadata[k]?.[DEFAULT]]))
        })
    }
}
